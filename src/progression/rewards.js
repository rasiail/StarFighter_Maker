import { BALANCE } from '../data/generated/balance.js';

export function enemyExperience(enemyId, stage) {
    return Math.round(BALANCE.enemies[enemyId].xpReward * (stage?.xpRewardMultiplier ?? 1));
}
