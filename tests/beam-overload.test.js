import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as beam from '../src/combat/beam-energy.js';
import { createPlayerFlight, replenishPlayerForSortie } from '../src/player/state.js';
import { createPadReader } from '../src/input/gamepad-state.js';

test('depletion requires overload then a full reload; no gradual recharge', () => {
    const state = { energy: 45, cooldown: 0, primed: true };
    assert.equal(beam.advanceBeamEnergy(state, 1, true), 1);
    assert.equal(state.energy, 0);
    assert.equal(state.overload, 2);
    assert.equal(state.reload, 5);
    assert.equal(beam.spendBeamPulse(state), false);
    beam.advanceBeamEnergy(state, 2, true);
    assert.equal(state.overload, 0);
    assert.equal(state.reload, 5);
    beam.advanceBeamEnergy(state, 4.9, true);
    assert.equal(state.energy, 0);
    assert.equal(beam.spendBeamPulse(state), false);
    beam.advanceBeamEnergy(state, 0.1, true);
    assert.equal(state.energy, 100);
    assert.equal(state.primed, false);
    assert.equal(beam.spendBeamPulse(state), true);
    assert.equal(state.energy, 88);
});

test('idle energy stays spent and a sub-shot remainder reloads without getting stuck', () => {
    const state = { energy: 50, cooldown: 0 };
    beam.advanceBeamEnergy(state, 20, false);
    assert.equal(state.energy, 50);
    state.energy = 4;
    assert.equal(beam.spendBeamPulse(state), false);
    assert.equal(state.reload, 5);
    assert.equal(state.overload, 0);
    beam.advanceBeamEnergy(state, 5, false);
    assert.equal(state.energy, 100);
    state.energy = 12;
    assert.equal(beam.spendBeamPulse(state), true);
    assert.equal(state.overload, 2);
    assert.equal(state.reload, 5);
});

test('a held beam cannot start without paying its pulse cost', () => {
    const state = { energy: 100, cooldown: 0 };
    assert.equal(beam.advanceBeamEnergy(state, 1, true), 0);
    assert.equal(state.energy, 100);
    assert.equal(beam.spendBeamPulse(state), true);
    assert.equal(state.energy, 88);
    assert.equal(beam.advanceBeamEnergy(state, 1, true), 1);
});

test('depletion and cooling are frame-rate independent, including long frames', () => {
    const run = dt => {
        const state = { energy: 45, cooldown: 0, primed: true };
        let duration = 0;
        for (let i = 0; i < Math.round(4 / dt); i++) duration += beam.advanceBeamEnergy(state, dt, true);
        return { state, duration };
    };
    for (const dt of [4, 1 / 30, 1 / 60, 1 / 144]) {
        const { state, duration } = run(dt);
        assert.ok(Math.abs(duration - 1) < 1e-8);
        assert.ok(Math.abs(state.energy) < 1e-8);
        assert.equal(state.overload, 0);
        assert.ok(Math.abs(state.reload - 4) < 1e-8);
    }
});

// Exercise actual trigger/HUD integration with rendering replaced by a damage log.
function runtime() {
    let source = readFileSync(new URL('../src/combat/beam.js', import.meta.url), 'utf8');
    source = source.replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
    const start = source.indexOf('function castBeam('), end = source.indexOf('function pulseBeam()', start);
    source = source.slice(0, start) + 'function castBeam(damage) { hits.push(damage); }\n' + source.slice(end);
    const hud = { style: {} };
    const hits = [];
    const context = vm.createContext({ ...beam, playerFlight: createPlayerFlight(null), playerMesh: {}, hits,
        spawnBeamBolt: (_source, damage) => hits.push(damage),
        gameState: { missileMode: 3, ownedWeapons: [1, 3] }, document: { getElementById: () => hud } });
    vm.runInContext(source, context);
    return { context, hud };
}

test('runtime charges once, preserves overload on clear/switch, and requires a new press', () => {
    const { context: c, hud } = runtime();
    c.pulseBeam();
    assert.equal(c.playerFlight.beamEnergy, 88);
    c.updateBeam(0.18, true);
    assert.equal(c.hits.length, 1);
    c.updateBeam(2, true);
    assert.ok(c.playerFlight.beamOverload > 0);
    assert.match(hud.textContent, /OVERLOAD/);
    const remaining = c.playerFlight.beamOverload;
    c.clearBeam(); c.gameState.missileMode = 1;
    assert.equal(c.playerFlight.beamOverload, remaining);
    c.updateBeam(remaining + 5, false);
    c.gameState.missileMode = 3;
    const shots = c.hits.length;
    c.updateBeam(1, true);
    assert.equal(c.hits.length, shots);
    assert.equal(c.playerFlight.beamEnergy, 100);
    c.pulseBeam();
    assert.equal(c.playerFlight.beamEnergy, 88);
    replenishPlayerForSortie(c.playerFlight);
    assert.equal(c.playerFlight.beamOverload, 0);
    assert.equal(c.playerFlight.beamCooldown, 0);
});

test('a rejected rapid re-press cannot reuse the preceding hold authorization', () => {
    const { context: c } = runtime();
    c.pulseBeam(); c.pulseBeam();
    c.updateBeam(1, true);
    assert.equal(c.hits.length, 1);
});

test('controller press pays once immediately and release does not add a second pulse', () => {
    const { context: c } = runtime();
    const pad = { connected: true, mapping: 'standard', index: 0, id: 'test', axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.assign(c.gameState, { phase: 'combat', activeModal: null, isGameRunning: true, isGamePaused: false });
    c.navigator = { getGamepads: () => [pad] };
    c.createPadReader = createPadReader;
    c.padInput = {};
    c.clearPadInput = () => Object.assign(c.padInput, { throttleUp: false, throttleDown: false, targetCam: false });
    c.tryFireMissile = c.pulseBeam;
    const source = readFileSync(new URL('../src/input/gamepad.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
    vm.runInContext(source, c);
    c.updateGamepad(0.01, 0);
    pad.buttons[1].pressed = true;
    c.updateGamepad(0.01, 1);
    assert.equal(c.playerFlight.beamEnergy, 88);
    assert.equal(c.padInput.beamHeld, true);
    c.updateGamepad(0.01, 1.1);
    assert.equal(c.hits.length, 1);
    pad.buttons[1].pressed = false;
    c.updateGamepad(0.01, 1.15);
    assert.equal(c.padInput.beamHeld, false);
    assert.equal(c.hits.length, 1);
});
