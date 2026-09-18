import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, grantExperience, calculateStats, applyStats } from '../src/progression/model.js';
import { drawCards, selectCard, CARDS, eligibleCards } from '../src/progression/cards.js';
import { createPlayerFlight } from '../src/player/state.js';

test('경험치가 여러 레벨을 넘으면 잔여 경험치와 선택권을 모두 적립한다', () => {
    const build = createProgression();
    assert.equal(grantExperience(build, 180), 3);
    assert.equal(build.level, 4);
    assert.equal(build.pending, 3);
    assert.equal(build.xp, 15);
    assert.throws(() => grantExperience(build, -1), RangeError);
});
test('이전 카드 선택으로 해금된 카드는 다음 후보 풀에 등장한다', () => {
    const build = createProgression();
    build.ranks.power = 2;
    build.pending = 2;
    assert.ok(!eligibleCards(build).some(c => c.id === 'warhead'));
    selectCard(build, 'power', [CARDS.find(c => c.id === 'power')]);
    assert.equal(build.pending, 1);
    assert.ok(eligibleCards(build).some(c => c.id === 'warhead'));
    assert.throws(() => selectCard(build, 'guidance', []));
});
test('최대 단계 카드가 재등장하지 않고 후보가 모두 소진되어도 선택권을 소비할 수 있다', () => {
    const build = createProgression();
    for (const card of CARDS) (card.stat ? build.ranks : build.cards)[card.id] = card.maxRank;
    build.pending = 2;
    const offered = drawCards(build);
    assert.deepEqual(offered.map(c => c.id), ['repair']);
    selectCard(build, 'repair', offered);
    selectCard(build, 'repair', drawCards(build));
    assert.equal(build.pending, 0);
    assert.throws(() => selectCard(build, 'repair', offered));
});
test('후보는 중복되지 않으며 스탯 보정은 반복 계산해도 누적 곱셈되지 않는다', () => {
    const build = createProgression();
    build.ranks.power = 2;
    build.ranks.mobility = 1;
    const cards = drawCards(build, () => 0);
    assert.equal(new Set(cards.map(c => c.id)).size, 3);
    const flight = createPlayerFlight({});
    applyStats(flight, calculateStats(build));
    applyStats(flight, calculateStats(build));
    assert.equal(flight.damageMultiplier, 1.4);
    assert.equal(flight.maxPitchRate, 1.45 * 1.08);
});
test('슬롯 확장은 준비 탄수만 늘리고 진행 중 재장전과 체력 증가는 보존한다', () => {
    const build = createProgression();
    const flight = createPlayerFlight({});
    flight.stdBursts = 1;
    flight.stdReloadTimers = [1.1];
    flight.health = 45;
    build.cards.standardRack = 1;
    build.cards.reload = 1;
    build.ranks.defense = 1;
    applyStats(flight, calculateStats(build));
    assert.equal(flight.stdMaxBursts, 4);
    assert.equal(flight.stdBursts, 3);
    assert.ok(Math.abs(flight.stdReloadTimers[0] - 0.99) < 1e-8);
    assert.equal(flight.health, 65);
    assert.equal(flight.maxHealth, 120);
});
