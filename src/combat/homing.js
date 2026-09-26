// Great-circle steering of the nose vector, independent of rendering and roll.
export function advanceHomingMissile(m, target, dt) {
    m.life -= dt;
    m.speed = Math.min(m.maxSpeed, m.speed + m.acceleration * dt);
    const steeringDt = Math.max(0, dt - (m.homingDelay || 0));
    m.homingDelay = Math.max(0, (m.homingDelay || 0) - dt);
    const d = m.direction, p = m.position;
    const x = target.x - p.x, y = target.y - p.y, z = target.z - p.z;
    const length = Math.hypot(x, y, z);
    if (length > 0.0001) {
        const tx = x / length, ty = y / length, tz = z / length;
        const dot = Math.max(-1, Math.min(1, d.x * tx + d.y * ty + d.z * tz));
        const angle = Math.acos(dot), turn = Math.min(angle, m.turnRate * steeringDt);
        let ax = tx - dot * d.x, ay = ty - dot * d.y, az = tz - dot * d.z;
        let axisLength = Math.hypot(ax, ay, az);
        if (axisLength < 1e-8 && dot < 0) {
            // A deterministic turn plane for a target exactly behind the missile.
            ax = -d.z; ay = 0; az = d.x;
            axisLength = Math.hypot(ax, az);
            if (axisLength < 1e-8) { ax = 1; ay = 0; az = 0; axisLength = 1; }
        }
        if (axisLength > 1e-8) {
            const c = Math.cos(turn), s = Math.sin(turn) / axisLength;
            d.x = d.x * c + ax * s; d.y = d.y * c + ay * s; d.z = d.z * c + az * s;
            const norm = Math.hypot(d.x, d.y, d.z);
            d.x /= norm; d.y /= norm; d.z /= norm;
        }
    }
    p.x += d.x * m.speed * dt; p.y += d.y * m.speed * dt; p.z += d.z * m.speed * dt;
}
