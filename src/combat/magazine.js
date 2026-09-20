// ReloadTimers contains zero or one timer: both missile types reload a whole magazine.
export function consumeMagazine(flight, mode, requested) {
    if (flight[`${mode}ReloadTimers`].length || flight[`${mode}ShotCooldown`] > 0) return 0;
    const count = Math.min(flight[`${mode}Bursts`], requested, mode === 'multi' ? Math.min(8, flight.multiLockCount) : 1);
    flight[`${mode}Bursts`] -= count;
    if (count > 0 && flight[`${mode}Bursts`] === 0) flight[`${mode}ReloadTimers`] = [flight[`${mode}ReloadSeconds`]];
    return count;
}

export function tickMagazines(flight, delta) {
    let changed = false;
    for (const mode of ['std', 'multi']) {
        flight[`${mode}ShotCooldown`] = Math.max(0, flight[`${mode}ShotCooldown`] - delta);
        const timers = flight[`${mode}ReloadTimers`];
        if (!timers.length) continue;
        changed = true;
        timers[0] -= delta;
        if (timers[0] <= 0) {
            timers.length = 0;
            flight[`${mode}Bursts`] = flight[`${mode}MaxBursts`];
        }
    }
    return changed;
}
