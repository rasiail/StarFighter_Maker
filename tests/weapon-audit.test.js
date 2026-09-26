import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStats, createProgression } from '../src/progression/model.js';
import { benchmarkBeam, benchmarkMissile } from '../src/balance/weapon-audit.js';

test('overload and full-recovery restart reduce base hold DPS below continuous recharge output', () => {
    const stats = calculateStats(createProgression());
    assert.ok(benchmarkBeam(stats).lateDps < 100 * 20 / 45);
    assert.ok(benchmarkBeam(stats).lateDps > 15);
    assert.ok(benchmarkBeam(stats, { mode: 'tap' }).lateDps <= 35 * 20 / 12 + 1);
});
test('even maximum energy upgrades still deplete and reload', () => {
    const build = createProgression(); build.cards = { beamEfficiency: 2, beamRecharge: 2 };
    const below = benchmarkBeam(calculateStats(build));
    assert.ok(below.depletedAt !== null);
    build.cards.beamEfficiency = 3;
    const above = benchmarkBeam(calculateStats(build));
    assert.ok(above.depletedAt !== null);
    assert.ok(above.lateDps < 100);
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
