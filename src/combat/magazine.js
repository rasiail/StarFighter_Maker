// ReloadTimers contains zero or one timer: both missile types reload a whole magazine.
export function consumeMagazine(flight, mode, requested) {
    if (flight[`${mode}ReloadTimers`].length || flight[`${mode}ShotCooldown`] > 0) return 0;
    const count = Math.min(flight[`${mode}Bursts`], requested, mode === 'multi' ? Math.min(8, flight.multiLockCount) : 1);
    
    if (count > 0) {
        flight[`${mode}Bursts`] -= count;
        
        const totalReload = flight[`${mode}ReloadSeconds`];
        const baseReload = totalReload * 0.333; // 1/3 is the base time
        const timePerMissile = (totalReload - baseReload) / flight[`${mode}MaxBursts`];
        
        flight[`${mode}ReloadDebt`] += count * timePerMissile;
        
        if (flight[`${mode}Bursts`] === 0) {
            flight[`${mode}ReloadTimers`] = [baseReload + flight[`${mode}ReloadDebt`]];
            flight[`${mode}ReloadDebt`] = 0; // Debt is consumed into the timer
        }
    }
    
    return count;
}

export function tickMagazines(flight, delta) {
    let changed = false;
    for (const mode of ['std', 'multi']) {
        flight[`${mode}ShotCooldown`] = Math.max(0, flight[`${mode}ShotCooldown`] - delta);
        
        const timers = flight[`${mode}ReloadTimers`];
        if (!timers.length) {
            // Decay debt over time if not reloading
            if (flight[`${mode}ReloadDebt`] > 0) {
                flight[`${mode}ReloadDebt`] = Math.max(0, flight[`${mode}ReloadDebt`] - delta);
            }
            continue;
        }
        
        changed = true;
        timers[0] -= delta;
        if (timers[0] <= 0) {
            timers.length = 0;
            flight[`${mode}Bursts`] = flight[`${mode}MaxBursts`];
            flight[`${mode}ReloadDebt`] = 0; // Ensure debt is clear after reload
        }
    }
    return changed;
}
