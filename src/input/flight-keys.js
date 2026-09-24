// Resolve every frame so entering/leaving focus while holding a key cannot
// leave the old throttle or turn action stuck until another keyboard event.
export function resolveFlightKeys(held, scheme, focusing) {
    const keys = { ...held, manualWasd: !!(held.keyW || held.keyS || held.keyA || held.keyD) };
    if (scheme === 'casual' && focusing) {
        keys.pitchDown = held.pitchDown || held.casualThrottleUp;
        keys.pitchUp = held.pitchUp || held.casualThrottleDown;
        keys.rollLeft = held.rollLeft || held.yawLeft;
        keys.rollRight = held.rollRight || held.yawRight;
        keys.casualThrottleUp = keys.casualThrottleDown = false;
        keys.yawLeft = keys.yawRight = false;
    }
    return keys;
}

export function targetFollowActive(enabled, keys, pad) {
    return !!(enabled && !keys.manualWasd && (keys.targetCam || pad.targetCam));
}
