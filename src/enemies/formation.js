import { BALANCE } from '../data/generated/balance.js';

// A ship occupies three target slots, including its two turrets.
export function formationKind(remaining, ocean, roll) {
    if (roll >= BALANCE.spawnRules.ground_or_ship_probability.value) return 'aircraft';
    if (!ocean) return 'tank';
    return remaining >= 3 ? 'ship' : 'aircraft';
}
