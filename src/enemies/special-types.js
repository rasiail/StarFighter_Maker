export const FISH_SCHOOL = Object.freeze({ size: 4, scale: 3.25, spacing: 60 });
export const BOMBER = Object.freeze({ scale: 4, healthMultiplier: 3, speed: 210, range: 3000, reload: 9, warning: 1.2 });
export const RADIAL_DIRECTIONS = Object.freeze([
    { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 },
]);
export function schoolOffset(slot, leaderSlot = 0) {
    const side = FISH_SCHOOL.spacing;
    const depth = side * 1.25;
    const positions = [[0, 0], [-side, depth], [side, depth], [0, depth * 2]];
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

// Alternating wing cannons for the heavy bomber (B-52)
export function stepBomberCannons(enemy, delta, distance, alignment, allowed, random = Math.random) {
    enemy.cannonCooldown = Math.max(0, (enemy.cannonCooldown ?? 1.5) - delta);
    enemy.burstCooldown = Math.max(0, (enemy.burstCooldown ?? 0) - delta);

    const inRange = distance > 250 && distance < 2500;
    const inArc = alignment > 0.35;
    const canEngage = allowed && inRange && inArc && !enemy.salvoWarning;

    if (!canEngage && !enemy.cannonBurst) {
        return null;
    }

    if (canEngage && enemy.cannonCooldown <= 0 && (!enemy.cannonBurst || enemy.cannonBurst <= 0)) {
        enemy.cannonBurst = 6;
        enemy.cannonCooldown = 2.5 + random() * 0.8;
        enemy.burstCooldown = 0;
        enemy.cannonSide = random() < 0.5 ? 'left' : 'right';
    }

    if (enemy.cannonBurst > 0 && enemy.burstCooldown <= 0) {
        const side = enemy.cannonSide || 'left';
        enemy.cannonSide = side === 'left' ? 'right' : 'left';
        enemy.cannonBurst--;
        enemy.burstCooldown = 0.12;
        return { fire: true, side };
    }

    return null;
}
