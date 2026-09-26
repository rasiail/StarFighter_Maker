import { BALANCE } from '../data/generated/balance.js';

function toRuntimeCard(card) {
    const requires = Object.fromEntries(card.conditions.map(condition => [condition.requiredKey, condition.value]));
    return Object.freeze({ id: card.cardId, name: card.displayNameKo, description: card.descriptionKo, maxRank: card.maxRank ?? Infinity, stat: card.isStat, weight: card.drawWeight, effects: card.effects, ...(Object.keys(requires).length ? { requires } : {}) });
}
const extra = (id, name, description, weapon, maxRank = 1) => Object.freeze({ id, name, description, weapon, maxRank, stat: false, weight: weapon ? 110 : 100, effects: [] });
const runtimeCards = [...BALANCE.cards.map(toRuntimeCard),
    extra('unlockMulti', '멀티 미사일 획득', '전방의 여러 표적을 동시에 공격하는 멀티 미사일을 장착합니다.', 2),
    extra('unlockBeam', '빔 무기 획득', '단발·홀드 시작 시 에너지 소모. 고갈 시 과부하 2초 후 재장전하여 전량 보충합니다.', 3),
    extra('beamWidth', '빔 집속 확장', '홀드 빔 굵기를 단계마다 0.7m 늘립니다(0.9→3m). 단발 빔 굵기는 30%씩 증가합니다.', null, 3),
    extra('beamEfficiency', '빔 소모 효율', '단발·지속 발사 에너지 소모를 15%씩 줄입니다.', null, 3),
    extra('beamRecharge', '빔 신속 재장전', '빔 재장전 시간을 15%씩 줄입니다. 과부하 시간은 유지됩니다.', null, 3),
];
const weaponRequirements = { multiRack: 2, multiSalvo: 2, beamWidth: 3, beamEfficiency: 3, beamRecharge: 3 };
export const CARDS = Object.freeze(runtimeCards.filter(card => card.id !== 'repair'));
export const REPAIR_CARD = runtimeCards.find(card => card.id === 'repair');
export function cardEffect(id, effectKey) {
    const source = BALANCE.cards.find(card => card.cardId === id)?.effects.find(effect => effect.effectKey === effectKey);
    if (!source) throw new RangeError(`Missing card effect: ${id}.${effectKey}`);
    return source;
}
export const cardEffectValue = (id, effectKey) => cardEffect(id, effectKey).value;
export const cardRank = (build, card) => (card.stat ? build.ranks[card.id] : build.cards[card.id]) || 0;
export function eligibleCards(build) {
    return CARDS.filter(card => cardRank(build, card) < card.maxRank && (!weaponRequirements[card.id] || build.weapons?.includes(weaponRequirements[card.id])) && Object.entries(card.requires || {}).every(([stat, rank]) => build.ranks[stat] >= rank));
}
export function drawCards(build, random = Math.random) {
    const pool = eligibleCards(build);
    const result = [];
    while (pool.length && result.length < 3) {
        const totalWeight = pool.reduce((sum, card) => sum + card.weight, 0);
        let roll = random() * totalWeight;
        let index = pool.findIndex(card => (roll -= card.weight) < 0);
        if (index < 0) index = pool.length - 1;
        result.push(pool.splice(index, 1)[0]);
    }
    if (result.length < 3) result.push(REPAIR_CARD);
    return result;
}
export function selectCard(build, id, offered) {
    if (build.pending <= 0 || !offered.some(card => card.id === id)) throw new Error('Card is not offered');
    const card = id === 'repair' ? REPAIR_CARD : eligibleCards(build).find(card => card.id === id);
    if (!card) throw new Error('Card is no longer eligible');
    if (id !== 'repair') {
        const ranks = card.stat ? build.ranks : build.cards;
        ranks[id] = (ranks[id] || 0) + 1;
    }
    if (card.weapon) { build.weapons ??= [1]; build.weapons.push(card.weapon); }
    build.pending--;
    return card;
}
