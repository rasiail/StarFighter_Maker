import { BALANCE } from '../data/generated/balance.js';

const standardMissile = BALANCE.weapons.standard_missile;
const multiMissile = BALANCE.weapons.multi_missile;

// 기체 밸런스 기본값. 무기 관련 값은 balance/weapons.xlsx에서 생성됩니다.
export const PLAYER_BASE_STATS = Object.freeze({
    minSpeed: 150,
    cruiseSpeed: 550,
    maxSpeed: 950,
    acceleration: 170,
    deceleration: 190,
    maxPitchRate: 1.45,
    maxRollRate: 2.85,
    maxYawRate: 0.55,
    maxHealth: 100,
    damageMultiplier: 1,
    stabilityMultiplier: 1,
    lockRangeMultiplier: 1,
    missileTurnMultiplier: 1,
    smartAssistMultiplier: 1.0,
    multiLockCount: 4,
    stdMaxBursts: standardMissile.readySlots,
    multiMaxBursts: multiMissile.readySlots,
    stdReloadSeconds: standardMissile.reloadSec,
    multiReloadSeconds: multiMissile.reloadSec,
});
