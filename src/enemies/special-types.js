export const FISH_SCHOOL = Object.freeze({ size: 4, scale: 4.5, spacing: 90 });
export const BOMBER = Object.freeze({ scale: 4, healthMultiplier: 3, speed: 210, range: 3000, reload: 9, warning: 1.2 });
export const RADIAL_DIRECTIONS = Object.freeze([
    { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 },
]);
export function schoolOffset(slot, leaderSlot = 0) {
    const positions = [[0, 0], [-90, 110], [90, 110], [0, 220]];
    return { x: positions[slot][0] - positions[leaderSlot][0], y: 0, z: positions[slot][1] - positions[leaderSlot][1] };
}
// Reserve a complete four-shot salvo within the shared hostile missile cap.
export function stepBomberWeapons(enemy, delta, distance, allowed, inFlight, cooldown, limit) {
    enemy.missileCooldown = Math.max(0, (enemy.missileCooldown ?? BOMBER.reload) - delta);
    if (!allowed || distance > BOMBER.range || distance < 250) { enemy.salvoWarning = 0; return false; }
    if (enemy.missileCooldown > 0 || cooldown > 0 || inFlight + 4 > limit) { enemy.salvoWarning = 0; return false; }
    enemy.salvoWarning = (enemy.salvoWarning || 0) + delta;
    if (enemy.salvoWarning < BOMBER.warning) return false;
    enemy.salvoWarning = 0;
    enemy.missileCooldown = BOMBER.reload;
    return true;
}
