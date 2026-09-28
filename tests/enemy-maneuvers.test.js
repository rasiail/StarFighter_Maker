import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight, stepAirWeapons } from '../src/enemies/flight-model.js';

const forward = { x: 0, y: 0, z: -1 }, flat = () => 0;
test('fighters alternate vertical maneuvers and full rolls with attack windows between them', () => {
    for (const hz of [30, 120]) {
        const f = createFlightState(forward), position = { x: 0, y: 900, z: 0 };
        const seen = new Set(); let high = 0, low = 0, bank = 0, roll = 0, attacks = 0;
        for (let i = 0; i < hz * 50; i++) {
            const result = stepFlight(f, position, { x: 0, y: 900, z: position.z - 1800 }, 306, 1 / hz, flat);
            if (f.maneuver) seen.add(f.maneuver);
            if (result.state === 'ENGAGE') attacks++;
            high = Math.max(high, f.pitch); low = Math.min(low, f.pitch);
            bank = Math.max(bank, Math.abs(f.bank)); roll = Math.max(roll, Math.abs(f.rollOffset));
            assert.ok(position.y >= 60);
        }
        assert.deepEqual([...seen].sort(), ['BARREL', 'HIGH_YOYO', 'SLICE']);
        assert.ok(high > 0.3 && low < -0.3, `pitch range ${low}..${high}`);
        assert.ok(bank > 0.8);
        assert.ok(roll > 6, 'barrel rolls complete nearly a full revolution');
        assert.ok(attacks > hz * 15, 'stable reacquisition windows remain available');
    }
});

test('missile threat triggers a roll, but terrain recovery takes immediate priority', () => {
    const f = createFlightState(forward), position = { x: 0, y: 900, z: 0 };
    const target = { x: 0, y: 900, z: -2000 };
    let result = stepFlight(f, position, target, 306, 0.05, flat, false, true);
    assert.equal(f.maneuver, 'BARREL');
    assert.equal(result.state, 'MANEUVER');
    for (let i = 0; i < 20; i++) stepFlight(f, position, target, 306, 0.05, flat, false, true);
    const previous = f.rollOffset;
    position.y = 100;
    result = stepFlight(f, position, target, 306, 0.05, flat, false, true);
    assert.equal(result.state, 'RECOVER');
    assert.equal(f.maneuver, null);
    const rollDelta = Math.atan2(Math.sin(f.rollOffset - previous), Math.cos(f.rollOffset - previous));
    assert.ok(Math.abs(rollDelta) <= 3 * 0.05 + 1e-8, 'cancelled roll recovers smoothly');
    assert.ok(f.pitch > 0);
});

test('heavy aircraft do not enter fighter aerobatics, even under threat', () => {
    const f = createFlightState(forward), position = { x: 0, y: 900, z: 0 };
    for (let i = 0; i < 600; i++) {
        stepFlight(f, position, { x: 300, y: 1000, z: position.z - 1800 }, 210, 1 / 30, flat, true, true);
        assert.equal(f.maneuver, null);
        assert.equal(f.rollOffset, 0);
        assert.ok(Math.abs(f.bank) <= 0.5);
    }
});

test('spawn attitude and altitude offset stagger maneuver timings across a formation', () => {
    const states = [-150, -50, 0, 75, 150].map(offset => createFlightState(forward, offset));
    assert.equal(new Set(states.map(f => f.maneuverCooldown)).size, states.length);
});

test('maneuvering aircraft cannot fire through their turn without an aim window', () => {
    const enemy = { state: 'MANEUVER', isElite: true, fireCooldown: 0, missileCooldown: 0, missileLockTime: 2 };
    assert.deepEqual(stepAirWeapons(enemy, 0.1, 1000, 1, true), { cannon: false, missile: false });
    assert.equal(enemy.missileLockTime, 0);
});
