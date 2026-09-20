import { BALANCE } from '../data/generated/balance.js';

export const STAGES = Object.freeze(BALANCE.stages.map(stage => Object.freeze({
    id: stage.stageId,
    name: stage.operationName,
    title: stage.title,
    environmentTheme: stage.environmentTheme,
    waves: Object.freeze([...stage.waves]),
    maxActive: stage.maxActive,
    attackBudget: stage.attackBudget,
    enemyHealth: stage.aircraftHealth,
    bossHealth: stage.bossHealth,
    bossName: stage.bossName,
    xpRewardMultiplier: stage.xpRewardMultiplier ?? 1,
})));

export function getStage(id) {
    const stage = STAGES.find(stage => stage.id === id);
    if (!stage) throw new RangeError(`Unknown stage: ${id}`);
    return stage;
}
