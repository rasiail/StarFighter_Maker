// Flight controller uses world heading/pitch, with bank only as visual attitude.
// Local -Z is the nose. No Euler extraction/clamping across the +/- PI seam.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (a, b, step) => a + clamp(b - a, -step, step);

export function createFlightState(forward) {
    return {
        heading: Math.atan2(-forward.x, -forward.z),
        pitch: Math.asin(clamp(forward.y, -1, 1)), bank: 0,
        recovering: false, recoveryHeading: 0, egressTime: 0, egressHeading: 0,
    };
}

export function stepFlight(flight, position, target, speed, dt, surface, boss = false, evade = false) {
    const dx = target.x - position.x, dz = target.z - position.z;
    const distance = Math.hypot(dx, target.y - position.y, dz);
    const ground = surface(position.x, position.z);
    let terrain = ground;
    // Include descent and distant ridge heights before committing to a turn.
    for (let i = 1; i <= 12; i++) {
        const ahead = speed * i * 0.5;
        terrain = Math.max(terrain, surface(position.x - Math.sin(flight.heading) * ahead,
            position.z - Math.cos(flight.heading) * ahead));
    }
    const predictedY = position.y + Math.min(0, Math.sin(flight.pitch)) * speed * 2;
    if (!flight.recovering && (position.y < ground + 210 || predictedY < terrain + 170)) {
        flight.recovering = true;
        flight.recoveryHeading = flight.heading;
    }
    if (flight.recovering && position.y > terrain + 340 && flight.pitch >= 0) flight.recovering = false;

    if (!flight.recovering && flight.egressTime <= 0 && (distance < 480 || evade)) {
        flight.egressTime = 3.5;
        flight.egressHeading = flight.heading;
    }
    const egress = flight.egressTime > 0;
    flight.egressTime = Math.max(0, flight.egressTime - dt);
    let heading = Math.hypot(dx, dz) > 1 ? Math.atan2(-dx, -dz) : flight.heading;
    let pitch = clamp(Math.atan2(Math.max(ground + 300, Math.min(2300, target.y)) - position.y,
        Math.max(450, Math.hypot(dx, dz))), -0.38, 0.48);
    if (egress) {
        heading = flight.egressHeading;
        pitch = clamp((Math.max(ground + 350, Math.min(2200, target.y)) - position.y) / 1000, -0.18, 0.28);
    }
    if (flight.recovering) {
        heading = flight.recoveryHeading;
        pitch = clamp(Math.atan2(terrain + 420 - position.y, speed * 2), 0.22, 0.72);
        flight.egressTime = 0;
    }
    const turnRate = boss ? 0.38 : 0.55;
    const turn = clamp(wrap(heading - flight.heading), -turnRate * dt, turnRate * dt);
    flight.heading = wrap(flight.heading + turn);
    flight.pitch = approach(flight.pitch, pitch, (flight.recovering ? 0.8 : 0.38) * dt);
    const bank = flight.recovering ? 0 : clamp(turn / Math.max(dt, 0.0001) * 0.9, -0.5, 0.5);
    flight.bank = approach(flight.bank, bank, 0.75 * dt);
    const forward = {
        x: -Math.sin(flight.heading) * Math.cos(flight.pitch),
        y: Math.sin(flight.pitch), z: -Math.cos(flight.heading) * Math.cos(flight.pitch),
    };
    position.x += forward.x * speed * dt;
    position.y += forward.y * speed * dt;
    position.z += forward.z * speed * dt;
    // Last-resort collision guard for discontinuous terrain, never a steering input.
    position.y = Math.max(position.y, surface(position.x, position.z) + 60);
    return { forward, state: flight.recovering ? 'RECOVER' : egress ? 'EXTEND' : distance < 2200 ? 'ENGAGE' : 'INTERCEPT' };
}

export function stepAirWeapons(enemy, dt, distance, alignment, allowed, random = Math.random, missileAllowed = true) {
    enemy.fireCooldown = Math.max(0, (enemy.fireCooldown ?? 1.5) - dt);
    enemy.missileCooldown = Math.max(0, (enemy.missileCooldown ?? 5) - dt);
    const engaging = allowed && enemy.state === 'ENGAGE';
    const gunAim = engaging && distance > 320 && distance < 1600 && alignment > Math.cos(0.12);
    const missileAim = engaging && (enemy.isElite || enemy.isBoss) && distance > 700 && distance < 2200 && alignment > Math.cos(0.22);
    enemy.missileLockTime = missileAim ? (enemy.missileLockTime ?? 0) + dt : 0;
    let cannon = false, missile = false;
    if (!gunAim) enemy.burstShots = 0;
    if (gunAim && enemy.fireCooldown <= 0) {
        cannon = true;
        enemy.burstShots = (enemy.burstShots || (enemy.isBoss ? 4 : 3)) - 1;
        enemy.fireCooldown = enemy.burstShots > 0 ? 0.15 : (enemy.isBoss ? 0.8 : 1.2) + random() * 0.4;
    }
    if (missileAllowed && missileAim && enemy.missileCooldown <= 0 && enemy.missileLockTime >= 1.1) {
        missile = true;
        enemy.missileCooldown = (enemy.isBoss ? 2.5 : 4.5) + random() * 1.5;
        enemy.missileLockTime = 0;
    }
    return { cannon, missile };
}
