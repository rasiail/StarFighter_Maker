import { BALANCE } from '../data/generated/balance.js';

export const REINFORCEMENT_INTERVAL = BALANCE.spawnRules.reinforcement_interval.value * 0.5;
export const WAVE_ACTIVE_GROWTH = 0.1;

// Wave indices are zero-based; each stage starts at its original population cap.
export function waveActiveLimit(stage, waveIndex) {
    return Math.round(stage.maxActive * (1 + Math.max(0, waveIndex) * WAVE_ACTIVE_GROWTH));
}
