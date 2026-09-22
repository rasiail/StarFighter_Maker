import { BALANCE } from '../data/generated/balance.js';

// Conditional on an air spawn: roughly 20% elites, 80% cannon-only fighters.
export const ELITE_AIR_PROBABILITY = 0.20;
export function isEliteSpawn(roll) { return roll < ELITE_AIR_PROBABILITY; }

// A ship occupies three target slots, including its two turrets.
export function formationKind(remaining, ocean, roll) {
    if (roll >= BALANCE.spawnRules.ground_or_ship_probability.value) return 'aircraft';
    if (!ocean) return 'tank';
    return remaining >= 3 ? 'ship' : 'aircraft';
}
