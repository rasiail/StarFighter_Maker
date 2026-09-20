import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom, simulateRun, simulateMany, weaponPerformance } from '../src/balance/simulator.js';
import { calculateStats, createProgression } from '../src/progression/model.js';

test('같은 시드와 가정은 같은 시뮬레이션 결과를 만든다', () => {
    assert.deepEqual(simulateRun({ seed: 77, strategy: 'balanced' }), simulateRun({ seed: 77, strategy: 'balanced' }));
    const first = createSeededRandom(10), second = createSeededRandom(10);
    assert.deepEqual(Array.from({ length: 5 }, first), Array.from({ length: 5 }, second));
});

test('경험치 요구량 증가는 카드 선택을 줄이고 현재 곡선은 런당 약 14회를 제공한다', () => {
    const normal = simulateMany({ runs: 50, seed: 104 });
    const harder = simulateMany({ runs: 50, seed: 104, xpRequirementScale: 2 });
    assert.ok(normal.averageSelections >= 13 && normal.averageSelections <= 15);
    assert.ok(harder.averageSelections < normal.averageSelections);
    assert.throws(() => simulateMany({ xpRequirementScale: 0 }), RangeError);
});

test('명중률이 높으면 예상 플레이 시간이 줄어든다', () => {
    const slow = simulateMany({ runs: 20, cannonAccuracy: 0.15, missileAccuracy: 0.5, seed: 9 });
    const fast = simulateMany({ runs: 20, cannonAccuracy: 0.6, missileAccuracy: 0.95, seed: 9 });
    assert.ok(fast.averageSeconds < slow.averageSeconds);
    assert.equal(fast.timeline.at(-1).cumulativeTargets, 583);
});

test('무기 성능 계산은 화력 배율과 재장전 성장에 반응한다', () => {
    const base = createProgression();
    const upgraded = createProgression();
    upgraded.ranks.power = 5;
    upgraded.cards.reload = 5;
    const before = weaponPerformance(calculateStats(base));
    const after = weaponPerformance(calculateStats(upgraded));
    assert.ok(after.cannon.sustainedDps > before.cannon.sustainedDps);
    assert.ok(after.multiMissile.sustainedDps > before.multiMissile.sustainedDps * 2);
});

test('후보 수치는 원본을 변경하지 않고 적 수·성장·장전 성능에 반영된다', () => {
    const base = simulateRun({ seed: 12 });
    const fewer = simulateRun({ seed: 12, enemyCountScale: 0.5 });
    assert.ok(fewer.totalXp < base.totalXp);
    assert.ok(fewer.finalLevel < base.finalLevel);
    assert.deepEqual(simulateRun({ seed: 12 }), base);
    const stats = calculateStats(createProgression());
    const normal = weaponPerformance(stats);
    const slower = weaponPerformance(stats, { ...base.assumptions, multiReloadScale: 2 });
    assert.ok(slower.multiMissile.sustainedDps < normal.multiMissile.sustainedDps);
    assert.ok(slower.multiMissile.sustainedDps > normal.multiMissile.sustainedDps / 2);
    assert.equal(slower.standardMissile.sustainedDps, normal.standardMissile.sustainedDps);
});

test('멀티 일제 발사는 다중 표적과 단일 보스의 발사 한계를 구분한다', () => {
    const stats = { ...calculateStats(createProgression()), multiReloadSeconds: 0.01 };
    const base = simulateRun({ seed: 1 }).assumptions;
    const group = weaponPerformance(stats, { ...base, availableTargets: 4 });
    const boss = weaponPerformance(stats, { ...base, availableTargets: 1 });
    assert.equal(group.multiMissile.sustainedDps, boss.multiMissile.sustainedDps * 4);
    assert.throws(() => simulateMany({ runs: NaN }), RangeError);
});
