import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceBeamEnergy, spendBeamPulse, BEAM_CAPACITY } from '../src/combat/beam-energy.js';
import { createProgression, calculateStats } from '../src/progression/model.js';
import { eligibleCards, selectCard } from '../src/progression/cards.js';

test('live recharge requires beam ownership and grants one energy per second', () => {
    const build = createProgression();
    assert.equal(calculateStats(build).beamRechargePerSecond, 0);
    assert.ok(!eligibleCards(build).some(c => c.id === 'beamLiveRecharge'));
    build.weapons.push(3); build.pending = 1;
    selectCard(build, 'beamLiveRecharge', eligibleCards(build));
    assert.equal(calculateStats(build).beamRechargePerSecond, 1);
    assert.ok(!eligibleCards(build).some(c => c.id === 'beamLiveRecharge'));
    const state = { energy: 4, cooldown: 0 };
    assert.equal(spendBeamPulse(state, 1, 5, 1), false);
    assert.equal(state.reload, undefined);
    advanceBeamEnergy(state, 2, false, 1, 5, 1);
    assert.equal(state.energy, 6);
    advanceBeamEnergy(state, 200, false, 1, 5, 1);
    assert.equal(state.energy, BEAM_CAPACITY);
});

test('live recharge works while firing but stops throughout depletion and reload', () => {
    const run = dt => {
        const state = { energy: 29, cooldown: 0, primed: true };
        let duration = 0;
        for (let i = 0; i < Math.round(4 / dt); i++) duration += advanceBeamEnergy(state, dt, true, 1, 5, 1);
        assert.ok(Math.abs(duration - 1) < 1e-8);
        assert.equal(state.energy, 0);
        assert.equal(state.overload, 0);
        assert.ok(Math.abs(state.reload - 4) < 1e-8);
        advanceBeamEnergy(state, 4, false, 1, 5, 1);
        assert.equal(state.energy, BEAM_CAPACITY);
    };
    for (const dt of [4, 1 / 30, 1 / 60, 1 / 144]) run(dt);
    const empty = { energy: 0, cooldown: 0 };
    advanceBeamEnergy(empty, 1, false, 1, 5, 1);
    assert.equal(empty.energy, 0);
    assert.equal(empty.reload, 5);
});
