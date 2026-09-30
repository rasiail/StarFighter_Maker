// Resolve every frame so entering/leaving focus while holding a key cannot
// leave the old throttle or turn action stuck until another keyboard event.
export function resolveFlightKeys(held, scheme, focusing) {
    const keys = { ...held, manualWasd: !!(held.keyW || held.keyS || held.keyA || held.keyD) };
    if (scheme === 'casual') {
        keys.rollLeft = !!(held.keyA || held.rollLeft);
        keys.rollRight = !!(held.keyD || held.rollRight);
        if (focusing) {
            // Focus mode temporarily gives W/S the standard pitch bindings.
            // Clear the keydown-owned casual throttle flags so one physical key
            // cannot change pitch and speed during the same frame.
            keys.pitchDown = !!(held.keyW || held.pitchDown);
            keys.pitchUp = !!(held.keyS || held.pitchUp);
            keys.casualThrottleUp = false;
            keys.casualThrottleDown = false;
        }
    }
    return keys;
}

export function targetFollowActive(enabled, keys, pad) {
    return !!(enabled && !keys.manualWasd && (keys.targetCam || pad.targetCam));
}
