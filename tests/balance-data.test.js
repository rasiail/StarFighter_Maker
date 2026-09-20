import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/generated/balance.js';
import { PLAYER_BASE_STATS } from '../src/config/player-stats.js';
import { STAGES } from '../src/config/stages.js';
import { CARDS, REPAIR_CARD, cardEffectValue, drawCards, eligibleCards } from '../src/progression/cards.js';
import { createProgression } from '../src/progression/model.js';

test('생성된 밸런스 데이터가 웹 런타임 설정에 연결된다', () => {
    assert.equal(PLAYER_BASE_STATS.stdReloadSeconds, BALANCE.weapons.standard_missile.reloadSec);
    assert.equal(PLAYER_BASE_STATS.multiMaxBursts, BALANCE.weapons.multi_missile.readySlots);
    assert.deepEqual(STAGES[0].waves, [35, 40, 45]);
    assert.equal(STAGES[2].bossHealth, BALANCE.stages[2].bossHealth);
    assert.equal(CARDS.find(card => card.id === 'warhead').requires.power, 3);
    assert.equal(REPAIR_CARD.effects.find(effect => effect.effectKey === 'score').value, 500);
    assert.equal(cardEffectValue('reload', 'missile_reload_multiplier'), 0.1);
});

test('카드 후보 추첨이 XLSX의 draw_weight를 사용한다', () => {
    const build = createProgression();
    const first = drawCards(build, () => 0)[0];
    const last = drawCards(build, () => 0.999999)[0];
    assert.equal(first.id, CARDS[0].id);
    assert.equal(last.id, eligibleCards(build).at(-1).id);
});

test('엔진 중립 데이터의 ID와 참조가 고유하고 완전하다', () => {
    assert.equal(BALANCE.schemaVersion, 1);
    assert.equal(new Set(BALANCE.cards.map(card => card.cardId)).size, BALANCE.cards.length);
    assert.equal(new Set(BALANCE.stages.map(stage => stage.stageId)).size, BALANCE.stages.length);
    for (const card of BALANCE.cards) {
        for (const condition of card.conditions) assert.ok(BALANCE.cards.some(candidate => candidate.cardId === condition.requiredKey));
    }
});
