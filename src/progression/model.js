import { PLAYER_BASE_STATS } from '../config/player-stats.js';

export const STAT_NAMES = Object.freeze({ mobility: '기동력', stability: '안정성', speed: '속도', defense: '방어력', power: '화력', control: '관제력' });
export function createProgression() {
    return { level: 1, xp: 0, pending: 0, ranks: Object.fromEntries(Object.keys(STAT_NAMES).map(key => [key, 0])), cards: {} };
}
export const xpToNextLevel = level => 40 + (level - 1) * 15;
export function grantExperience(state, amount) {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Experience must be nonnegative');
    state.xp += amount;
    let gained = 0;
    while (state.xp >= xpToNextLevel(state.level)) {
        state.xp -= xpToNextLevel(state.level);
        state.level++;
        state.pending++;
        gained++;
    }
    return gained;
}

// Always calculate from base values; never multiply already-upgraded values.
export function calculateStats(build) {
    const r = build.ranks, c = build.cards, b = PLAYER_BASE_STATS;
    return {
        ...b,
        maxPitchRate: b.maxPitchRate * (1 + r.mobility * 0.08),
        maxRollRate: b.maxRollRate * (1 + r.mobility * 0.08),
        maxYawRate: b.maxYawRate * (1 + r.mobility * 0.08),
        stabilityMultiplier: 1 + r.stability * 0.15,
        cruiseSpeed: b.cruiseSpeed + r.speed * 20,
        maxSpeed: b.maxSpeed + r.speed * 40,
        acceleration: b.acceleration + r.speed * 8,
        maxHealth: b.maxHealth + r.defense * 20,
        damageMultiplier: (1 + r.power * 0.2) * (1 + (c.warhead || 0) * 0.1),
        lockRangeMultiplier: 1 + r.control * 0.1,
        missileTurnMultiplier: 1 + r.control * 0.08 + (c.guidance || 0) * 0.15,
        multiLockCount: b.multiLockCount + Math.floor(r.control / 2),
        stdMaxBursts: b.stdMaxBursts + (c.standardRack || 0) * 2,
        multiMaxBursts: b.multiMaxBursts + (c.multiRack || 0) * 2,
        stdReloadSeconds: b.stdReloadSeconds * (1 - (c.reload || 0) * 0.1),
        multiReloadSeconds: b.multiReloadSeconds * (1 - (c.reload || 0) * 0.1),
    };
}

// Preserve spent slots and elapsed reload progress when upgrading mid-combat.
export function applyStats(flight, stats) {
    const healthGain = Math.max(0, stats.maxHealth - flight.maxHealth);
    for (const mode of ['std', 'multi']) {
        const max = `${mode}MaxBursts`, ready = `${mode}Bursts`, time = `${mode}ReloadSeconds`, timers = `${mode}ReloadTimers`;
        flight[ready] = Math.min(stats[max], flight[ready] + Math.max(0, stats[max] - flight[max]));
        flight[timers] = flight[timers].map(t => t * stats[time] / flight[time]);
    }
    Object.assign(flight, stats);
    flight.defaultCruiseSpeed = stats.cruiseSpeed;
    flight.health = Math.min(stats.maxHealth, flight.health + healthGain);
}
