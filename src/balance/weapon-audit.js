// Analysis only: uses the runtime energy and magazine rules without changing tuning.
import { advanceBeamEnergy, spendBeamPulse, BEAM_PULSE_DAMAGE, BEAM_HOLD_DPS, BEAM_HOLD_DELAY } from '../combat/beam-energy.js';
import { consumeMagazine, tickMagazines } from '../combat/magazine.js';
import { createPlayerFlight } from '../player/state.js';
import { BALANCE } from '../data/generated/balance.js';

export function benchmarkBeam(stats, { seconds = 120, dt = 0.01, mode = 'hold', accuracy = 1 } = {}) {
    const state = { energy: 100, cooldown: 0 };
    let damage = 0, lateDamage = 0, pulses = 0, depletedAt = null;
    // One initial pulse accompanies the held trigger in the runtime.
    if (spendBeamPulse(state, stats.beamEfficiency, stats.beamReloadSeconds)) { damage = BEAM_PULSE_DAMAGE; pulses++; }
    let heldTime = 0;
    for (let i = 0; i < Math.round(seconds / dt); i++) {
        const time = (i + 1) * dt;
        const warmup = mode === 'hold' ? Math.min(dt, Math.max(0, BEAM_HOLD_DELAY - heldTime)) : dt;
        advanceBeamEnergy(state, warmup, false, stats.beamEfficiency, stats.beamReloadSeconds);
        heldTime += dt;
        const duration = advanceBeamEnergy(state, dt - warmup, mode === 'hold',
            stats.beamEfficiency, stats.beamReloadSeconds);
        let stepDamage = duration * BEAM_HOLD_DPS;
        // Held benchmark releases after overload, waits for full energy, then
        // presses again. Every new firing sequence pays the initial pulse cost.
        if ((mode === 'tap' || (!state.primed && state.energy >= 100 - 1e-9)) && state.cooldown < 1e-9) {
            state.cooldown = 0;
            if (spendBeamPulse(state, stats.beamEfficiency, stats.beamReloadSeconds)) { stepDamage += BEAM_PULSE_DAMAGE; pulses++; heldTime = 0; }
        }
        if (state.energy < 1e-6 && depletedAt === null) depletedAt = time;
        damage += stepDamage;
        if (time > seconds / 2) lateDamage += stepDamage;
    }
    return { dps: damage * stats.damageMultiplier * accuracy / seconds,
        lateDps: lateDamage * stats.damageMultiplier * accuracy / (seconds / 2),
        depletedAt, energy: state.energy, pulses };
}

export function benchmarkMissile(stats, mode, { seconds = 120, targets = 4, accuracy = 1, dt = 0.01 } = {}) {
    const inventory = createPlayerFlight(null, stats);
    const weapon = BALANCE.weapons[mode === 'std' ? 'standard_missile' : 'multi_missile'];
    let shots = 0, lateShots = 0;
    for (let i = 0; i < Math.round(seconds / dt); i++) {
        if (i) tickMagazines(inventory, dt);
        if (inventory[`${mode}ShotCooldown`] < 1e-9) inventory[`${mode}ShotCooldown`] = 0;
        const fired = consumeMagazine(inventory, mode, targets);
        if (fired) inventory[`${mode}ShotCooldown`] = weapon.fireIntervalSec;
        shots += fired;
        if (i * dt >= seconds / 2) lateShots += fired;
    }
    return { shots, dps: shots * weapon.damage * stats.damageMultiplier * accuracy / seconds,
        lateDps: lateShots * weapon.damage * stats.damageMultiplier * accuracy / (seconds / 2) };
}
