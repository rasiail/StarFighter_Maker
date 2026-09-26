export const BEAM_CAPACITY = 100;
export const BEAM_OVERLOAD_SECONDS = 2;
export const BEAM_PULSE_DAMAGE = 35;
export const BEAM_HOLD_DPS = 100;
export const BEAM_HOLD_DELAY = 0.18;
function reload(state, reloadSeconds, exhausted = false) {
    if (exhausted) state.energy = 0;
    state.overload = exhausted ? BEAM_OVERLOAD_SECONDS : 0;
    state.reload = reloadSeconds;
    state.primed = false;
}
export function spendBeamPulse(state, efficiency = 1, reloadSeconds = 5) {
    const cost = 12 * efficiency;
    if (state.overload > 1e-9 || state.reload > 1e-9 || state.cooldown > 1e-9) return false;
    if (state.energy + 1e-9 < cost) { reload(state, reloadSeconds, state.energy <= 1e-9); return false; }
    state.energy = Math.max(0, state.energy - cost);
    state.cooldown = BEAM_HOLD_DELAY;
    state.primed = true;
    if (state.energy <= 1e-9) reload(state, reloadSeconds, true);
    return true;
}
export function advanceBeamEnergy(state, delta, held, efficiency = 1, reloadSeconds = 5) {
    state.cooldown = Math.max(0, state.cooldown - delta);
    const advanceReload = time => {
        const blocked = Math.min(time, state.overload || 0);
        state.overload = Math.max(0, (state.overload || 0) - blocked);
        if (state.reload > 0) {
            state.reload = Math.max(0, state.reload - (time - blocked));
            if (state.reload <= 1e-9) { state.reload = 0; state.energy = BEAM_CAPACITY; }
        }
    };
    if (state.reload > 0 || state.overload > 0) { advanceReload(delta); return 0; }
    if (!held || !state.primed) {
        // A released trigger with less than one shot left reloads automatically.
        if (!state.primed && state.energy + 1e-9 < 12 * efficiency) {
            reload(state, reloadSeconds, state.energy <= 1e-9);
            advanceReload(delta);
        }
        return 0;
    }
    const drain = 45 * efficiency;
    const duration = Math.min(delta, state.energy / drain);
    state.energy = Math.max(0, state.energy - drain * duration);
    if (state.energy <= 1e-9) {
        reload(state, reloadSeconds, true);
        advanceReload(delta - duration);
    }
    return duration;
}
