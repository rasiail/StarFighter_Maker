import { STAT_NAMES } from './model.js';

const descriptions = {
    mobility: '피치·롤·요 최대 회전속도 +8%', stability: '회전 정리·역입력 응답 +15%',
    speed: '순항 +20 / 최고 +40 kts · 가속 +8', defense: '최대 체력 +20 · 증가분 회복',
    power: '기본 무기 피해 배율 +20%', control: '락온 거리 +10% · 유도 +8% · 2단계마다 표적 +1',
};
export const CARDS = Object.freeze([
    ...Object.entries(STAT_NAMES).map(([id, name]) => ({ id, name, description: descriptions[id], maxRank: 5, stat: true })),
    { id: 'standardRack', name: '표준 미사일 랙 확장', description: '표준 미사일 장전 슬롯 +2', maxRank: 3 },
    { id: 'multiRack', name: '멀티 미사일 랙 확장', description: '멀티 미사일 장전 슬롯 +2', maxRank: 3 },
    { id: 'reload', name: '신속 재장전', description: '두 미사일의 기본 재장전 시간 -10%', maxRank: 5 },
    { id: 'warhead', name: '고출력 탄두', description: '화력 보정 후 무기 피해 +10% · 화력 3 필요', maxRank: 3, requires: { power: 3 } },
    { id: 'guidance', name: '능동 유도 제어', description: '미사일 유도 선회 성능 +15% · 관제력 3 필요', maxRank: 3, requires: { control: 3 } },
]);
export const REPAIR_CARD = Object.freeze({ id: 'repair', name: '긴급 정비', description: '체력 30% 회복 · 점수 +500', maxRank: Infinity });
export const cardRank = (build, card) => (card.stat ? build.ranks[card.id] : build.cards[card.id]) || 0;
export function eligibleCards(build) {
    return CARDS.filter(card => cardRank(build, card) < card.maxRank && Object.entries(card.requires || {}).every(([stat, rank]) => build.ranks[stat] >= rank));
}
export function drawCards(build, random = Math.random) {
    const pool = eligibleCards(build);
    const result = [];
    while (pool.length && result.length < 3) result.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
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
