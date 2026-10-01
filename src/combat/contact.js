export const PLAYER_CONTACT_RADIUS = 6;
export const CONTACT_PLAYER_DAMAGE = 20;
export const CONTACT_ENEMY_DAMAGE = 40;
export const CONTACT_INTERVAL = 1;

const position = p => ({ x: p.x, y: p.y, z: p.z });
// Closest approach of two moving spheres, including fast crossing paths.
export function sweptContact(a0, a1, b0, b1, radius) {
    const x = a0.x - b0.x, y = a0.y - b0.y, z = a0.z - b0.z;
    const dx = a1.x - b1.x - x, dy = a1.y - b1.y - y, dz = a1.z - b1.z - z;
    const length = dx * dx + dy * dy + dz * dz;
    const t = length ? Math.max(0, Math.min(1, -(x * dx + y * dy + z * dz) / length)) : 0;
    return (x + dx * t) ** 2 + (y + dy * t) ** 2 + (z + dz * t) ** 2 <= radius ** 2;
}

export function createContactTracker() {
    let start;
    let snapshots = new Map();
    let cooldowns = new WeakMap();
    return {
        reset() { start = undefined; snapshots.clear(); cooldowns = new WeakMap(); },
        capture(player, enemies) {
            start = position(player);
            snapshots = new Map(enemies.filter(e => e.alive).map(e => [e, position(e.mesh.position)]));
        },
        update(delta, player, flight, enemies, onHit, onKill) {
            if (!start || flight.health <= 0) return;
            for (const enemy of enemies) {
                const cooldown = Math.max(0, (cooldowns.get(enemy) || 0) - delta);
                cooldowns.set(enemy, cooldown);
                // A ship's turrets share the hull collider, so a ram hits it once.
                if (!enemy.alive || enemy.isDying || enemy.isSinking || enemy.shipPart === 'TURRET' || cooldown > 1e-9) continue;
                const previous = snapshots.get(enemy);
                if (!previous) continue;
                if (!sweptContact(start, player, previous, enemy.mesh.position, PLAYER_CONTACT_RADIUS + enemy.hitRadius)) continue;
                cooldowns.set(enemy, CONTACT_INTERVAL);
                const damage = Math.min(flight.health, CONTACT_PLAYER_DAMAGE);
                flight.health = Math.max(0, flight.health - damage);
                enemy.health = Math.max(0, enemy.health - CONTACT_ENEMY_DAMAGE);
                onHit(enemy, damage);
                if (enemy.health <= 0) onKill(enemy);
                if (flight.health <= 0) break;
            }
            start = undefined;
            snapshots.clear();
        },
    };
}
