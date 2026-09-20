import { BALANCE } from '../data/generated/balance.js';

function toRuntimeCard(card) {
    const requires = Object.fromEntries(card.conditions.map(condition => [condition.requiredKey, condition.value]));
    return Object.freeze({ id: card.cardId, name: card.displayNameKo, description: card.descriptionKo, maxRank: card.maxRank ?? Infinity, stat: card.isStat, weight: card.drawWeight, effects: card.effects, ...(Object.keys(requires).length ? { requires } : {}) });
}
const runtimeCards = BALANCE.cards.map(toRuntimeCard);
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
    return CARDS.filter(card => cardRank(build, card) < card.maxRank && Object.entries(card.requires || {}).every(([stat, rank]) => build.ranks[stat] >= rank));
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
    build.pending--;
    return card;
}
