export const ATTACK_POLICY = Object.freeze({
    groundAttackers: 2,
    missileLimit: 4,
    missileSpacing: 2.5,
    bossMissileSpacing: 1.5,
});

export function selectAttackers(enemies, position, airBudget, policy = ATTACK_POLICY) {
    const distanceSq = e => {
        const p = e.mesh?.position ?? e.position;
        return (p.x - position.x) ** 2 + (p.y - position.y) ** 2 + (p.z - position.z) ** 2;
    };
    const alive = enemies.filter(e => e.alive && e.shipPart !== 'HULL');
    const priority = e => e.isBoss ? 2 : e.isElite && distanceSq(e) < 2200 ** 2 ? 1 : 0;
    const air = alive.filter(e => !e.isGround).sort((a, b) => priority(b) - priority(a) || distanceSq(a) - distanceSq(b));
    const ground = alive.filter(e => e.isGround).sort((a, b) => distanceSq(a) - distanceSq(b));
    return new Set([...air.slice(0, airBudget), ...ground.slice(0, policy.groundAttackers)]);
}

export function canLaunchMissile(cooldown, inFlight, policy = ATTACK_POLICY) {
    return cooldown <= 0 && inFlight < policy.missileLimit;
}
