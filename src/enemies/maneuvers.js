const TAU = Math.PI * 2;
const approach = (value, target, step) => value + Math.max(-step, Math.min(step, target - value));

export function createManeuverState(heading, altitudeOffset) {
    const seed = Math.sin(heading * 7.13 + altitudeOffset * 0.037 + 1.7) * 437.58;
    const phase = seed - Math.floor(seed);
    return { maneuver: null, maneuverAge: 0, maneuverCooldown: 3 + phase * 2,
        maneuverIndex: Math.floor(phase * 3), maneuverSide: phase < 0.5 ? -1 : 1,
        evadeCooldown: 0, rollOffset: 0 };
}

export function stepManeuver(flight, { dt, distance, altitude, terrain, heavy, recovering, extending, evade }) {
    flight.maneuverCooldown = Math.max(0, flight.maneuverCooldown - dt);
    flight.evadeCooldown = Math.max(0, flight.evadeCooldown - dt);
    if (recovering || heavy) {
        flight.maneuver = null;
        flight.maneuverCooldown = Math.max(flight.maneuverCooldown, 2.5);
    } else if (!flight.maneuver && !extending && distance < 3800 && altitude > terrain + 350
        && (flight.maneuverCooldown <= 0 || (evade && flight.evadeCooldown <= 0))) {
        let kind = evade ? 'BARREL' : ['HIGH_YOYO', 'SLICE', 'BARREL'][flight.maneuverIndex % 3];
        if (kind === 'SLICE' && altitude < terrain + 650) kind = 'HIGH_YOYO';
        if (kind === 'HIGH_YOYO' && altitude > 1950) kind = altitude > terrain + 650 ? 'SLICE' : 'BARREL';
        flight.maneuver = kind;
        flight.maneuverAge = 0;
        flight.maneuverIndex++;
        flight.maneuverSide *= -1;
        flight.maneuverCooldown = 4 + (flight.maneuverIndex % 3) * 0.7;
        if (evade) flight.evadeCooldown = 8;
    }
    let heading = 0, pitch = 0;
    const kind = flight.maneuver;
    if (kind) {
        const duration = kind === 'BARREL' ? 3.2 : 3;
        flight.maneuverAge = Math.min(duration, flight.maneuverAge + dt);
        const t = flight.maneuverAge / duration;
        const envelope = Math.sin(Math.PI * t);
        heading = flight.maneuverSide * (kind === 'BARREL' ? 0.65 * Math.sin(TAU * t) : 1.1 * envelope);
        pitch = kind === 'HIGH_YOYO' ? 0.6 * envelope : kind === 'SLICE' ? -0.5 * envelope : 0.42 * Math.sin(TAU * t);
        if (kind === 'BARREL') flight.rollOffset = flight.maneuverSide * TAU * (t * t * (3 - 2 * t));
        if (t >= 1) {
            flight.maneuver = null;
            flight.maneuverCooldown = 4 + (flight.maneuverIndex % 3) * 0.7;
        }
    }
    if (kind !== 'BARREL') {
        // Recover from an interrupted roll toward the nearest upright attitude.
        const upright = Math.round(flight.rollOffset / TAU) * TAU;
        flight.rollOffset = approach(flight.rollOffset, upright, 3 * dt);
        if (Math.abs(flight.rollOffset - upright) < 1e-8) flight.rollOffset = 0;
    }
    return { heading, pitch, active: !!kind, kind };
}
