import { PLAYER_BASE_STATS } from '../config/player-stats.js';
import { BALANCE } from '../data/generated/balance.js';
import { cardEffectValue } from './cards.js';

export const STAT_NAMES = Object.freeze({ mobility: '기동력', stability: '안정성', speed: '속도', defense: '방어력', power: '화력', control: '관제력' });
export function createProgression() {
    return { level: 1, xp: 0, pending: 0, ranks: Object.fromEntries(Object.keys(STAT_NAMES).map(key => [key, 0])), cards: {} };
}
export function xpToNextLevel(level) {
    const row = BALANCE.levels[level - 1];
    if (!row) throw new RangeError(`No XP curve defined for level ${level}`);
    return row.xpToNext;
}
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
    const mobility = cardEffectValue('mobility', 'max_pitch_rate_multiplier');
    const stability = cardEffectValue('stability', 'stability_multiplier');
    return {
        ...b,
        maxPitchRate: b.maxPitchRate * (1 + r.mobility * mobility),
        maxRollRate: b.maxRollRate * (1 + r.mobility * cardEffectValue('mobility', 'max_roll_rate_multiplier')),
        maxYawRate: b.maxYawRate * (1 + r.mobility * cardEffectValue('mobility', 'max_yaw_rate_multiplier')),
        stabilityMultiplier: 1 + r.stability * stability,
        cruiseSpeed: b.cruiseSpeed + r.speed * cardEffectValue('speed', 'cruise_speed'),
        maxSpeed: b.maxSpeed + r.speed * cardEffectValue('speed', 'max_speed'),
        acceleration: b.acceleration + r.speed * cardEffectValue('speed', 'acceleration'),
        deceleration: (b.deceleration || b.acceleration) + r.speed * cardEffectValue('speed', 'acceleration'),
        maxHealth: b.maxHealth + r.defense * cardEffectValue('defense', 'max_health'),
        damageMultiplier: (1 + r.power * cardEffectValue('power', 'damage_multiplier')) * (1 + (c.warhead || 0) * cardEffectValue('warhead', 'damage_multiplier')),
        lockRangeMultiplier: 1 + r.control * cardEffectValue('control', 'lock_range_multiplier'),
        missileTurnMultiplier: 1 + r.control * cardEffectValue('control', 'missile_turn_multiplier') + (c.guidance || 0) * cardEffectValue('guidance', 'missile_turn_multiplier'),
        smartAssistMultiplier: 1 + (c.smartAim || 0) * cardEffectValue('smartAim', 'smart_assist_multiplier'),
        multiLockCount: Math.min(8, b.multiLockCount + (c.multiSalvo || 0) * cardEffectValue('multiSalvo', 'multi_lock_count')),
        stdMaxBursts: b.stdMaxBursts + (c.standardRack || 0) * cardEffectValue('standardRack', 'standard_ready_slots'),
        multiMaxBursts: b.multiMaxBursts + (c.multiRack || 0) * cardEffectValue('multiRack', 'multi_ready_slots'),
        stdReloadSeconds: b.stdReloadSeconds * (1 - (c.reload || 0) * cardEffectValue('reload', 'missile_reload_multiplier')),
        multiReloadSeconds: b.multiReloadSeconds * (1 - (c.reload || 0) * cardEffectValue('reload', 'missile_reload_multiplier')),
    };
}

// Preserve spent slots and elapsed reload progress when upgrading mid-combat.
export function applyStats(flight, stats) {
    const healthGain = Math.max(0, stats.maxHealth - flight.maxHealth);
    for (const mode of ['std', 'multi']) {
        const max = `${mode}MaxBursts`, ready = `${mode}Bursts`, time = `${mode}ReloadSeconds`, timers = `${mode}ReloadTimers`;
        flight[ready] = flight[timers].length ? 0 : Math.min(stats[max], flight[ready] + Math.max(0, stats[max] - flight[max]));
        flight[timers] = flight[timers].map(t => t * stats[time] / flight[time]);
    }
    Object.assign(flight, stats);
    flight.defaultCruiseSpeed = stats.cruiseSpeed;
    flight.health = Math.min(stats.maxHealth, flight.health + healthGain);
}
