// 실제 출격 로직의 목표 수/초기 공중 적 수를 유지합니다.
export const STAGES = Object.freeze([
    Object.freeze({ id: 1, name: 'OP: CANYON SCOUT', title: 'STAGE 01: CANYON SCOUT', waves: Object.freeze([30, 35, 40, 45, 50]), maxActive: 30, attackBudget: 4, enemyHealth: 80, bossHealth: 2200, bossName: 'CANYON LEVIATHAN' }),
    Object.freeze({ id: 2, name: 'OP: OCEAN TRIDENT', title: 'STAGE 02: OCEAN TRIDENT', waves: Object.freeze([40, 45, 50, 55, 60]), maxActive: 36, attackBudget: 5, enemyHealth: 100, bossHealth: 3400, bossName: 'OCEAN DREADNOUGHT' }),
    Object.freeze({ id: 3, name: 'OP: METROPOLIS SHIELD', title: 'STAGE 03: METROPOLIS SHIELD', waves: Object.freeze([50, 55, 60, 65, 70]), maxActive: 42, attackBudget: 6, enemyHealth: 120, bossHealth: 4800, bossName: 'METROPOLIS OVERLORD' }),
]);

export function getStage(id) {
    const stage = STAGES.find(stage => stage.id === id);
    if (!stage) throw new RangeError(`Unknown stage: ${id}`);
    return stage;
}
