// Resolve every frame so entering/leaving focus while holding a key cannot
// leave the old throttle or turn action stuck until another keyboard event.
export function resolveFlightKeys(held, scheme, focusing) {
    const keys = { ...held, manualWasd: !!(held.keyW || held.keyS || held.keyA || held.keyD) };
    if (scheme === 'casual') {
        keys.rollLeft = !!(held.keyA || held.rollLeft);
        keys.rollRight = !!(held.keyD || held.rollRight);

    }
    return keys;
}

export function targetFollowActive(enabled, keys, pad) {
    return !!(enabled && !keys.manualWasd && (keys.targetCam || pad.targetCam));
}
