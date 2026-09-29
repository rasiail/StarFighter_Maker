import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats, createProgression } from '../src/progression/model.js';
import { benchmarkBeam, benchmarkMissile } from '../src/balance/weapon-audit.js';
import { BEAM_PULSE_DAMAGE, BEAM_PULSE_COST, BEAM_HOLD_DPS, BEAM_HOLD_DELAY, BEAM_HOLD_DRAIN, BEAM_OVERLOAD_SECONDS, BEAM_HOLD_MAX_MULTIPLIER, beamHoldDamage } from '../src/combat/beam-energy.js';

test('hold benchmark includes ramp damage and resets it on each overload/reload cycle', () => {
    const stats = calculateStats(createProgression());
    const duration = (100 - BEAM_PULSE_COST) / BEAM_HOLD_DRAIN;
    const damage = BEAM_PULSE_DAMAGE + beamHoldDamage({ target: null, seconds: 0 }, {}, duration);
    const cycle = BEAM_HOLD_DELAY + duration + BEAM_OVERLOAD_SECONDS + stats.beamReloadSeconds;
    assert.ok(Math.abs(benchmarkBeam(stats, { seconds: 1200 }).lateDps - damage / cycle) < 1);
    assert.ok(benchmarkBeam(stats, { mode: 'tap' }).lateDps < BEAM_PULSE_DAMAGE / BEAM_HOLD_DELAY);
});
test('even maximum energy upgrades still deplete and reload', () => {
    const build = createProgression(); build.cards = { beamEfficiency: 2, beamRecharge: 2 };
    const below = benchmarkBeam(calculateStats(build));
    assert.ok(below.depletedAt !== null);
    build.cards.beamEfficiency = 3;
    const above = benchmarkBeam(calculateStats(build));
    assert.ok(above.depletedAt !== null);
    assert.ok(above.lateDps < BEAM_HOLD_DPS * BEAM_HOLD_MAX_MULTIPLIER);
});
test('benchmarks converge at finer time resolution', () => {
    const stats = calculateStats(createProgression());
    for (const mode of ['hold', 'tap']) {
        const a = benchmarkBeam(stats, { mode });
        const b = benchmarkBeam(stats, { mode, dt: 0.005 });
        assert.ok(Math.abs(a.dps - b.dps) < 0.5);
    }
    const a = benchmarkMissile(stats, 'multi');
    const b = benchmarkMissile(stats, 'multi', { dt: 0.005 });
    assert.equal(a.shots, b.shots);
});
