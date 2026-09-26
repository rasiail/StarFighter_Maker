const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
export const MOUSE_SYNC_DELAY = 0.5;
export function createMouseFlight() {
    return { x: 0, y: 0, pendingX: 0, pendingY: 0, frameX: 0, frameY: 0, aimDirection: null, motionX: 0, motionY: 0, idle: 0, syncAge: 0, motionStarted: false };
}
export function addMouseMotion(mouse, dx, dy, width, height) {
    mouse.pendingX += dx;
    mouse.pendingY += dy;
    // Position is only a deadzone guide, never a persistent steering command.
    mouse.x = clamp(mouse.x + dx / 240, Math.max(0, width / 2 - 16) / 240);
    mouse.y = clamp(mouse.y + dy / 240, Math.max(0, height / 2 - 16) / 240);
}
export function cameraSyncBlend(idle, delta) {
    return 1 - Math.exp(-6 * Math.min(delta, Math.max(0, idle - MOUSE_SYNC_DELAY)));
}
export function consumeMouseMotion(mouse, delta) {
    const moving = mouse.pendingX !== 0 || mouse.pendingY !== 0;
    const scale = 240 * Math.max(delta, 0.0001);
    mouse.motionX = clamp(mouse.pendingX / scale, 1);
    mouse.motionY = clamp(mouse.pendingY / scale, 1);
    mouse.frameX = mouse.pendingX;
    mouse.frameY = mouse.pendingY;
    mouse.pendingX = mouse.pendingY = 0;
    // Delay only the start of a gesture, not every mouse event: a sustained
    // movement must also let the camera catch up while still inside the zone.
    const newGesture = moving && (!mouse.motionStarted || mouse.idle >= MOUSE_SYNC_DELAY);
    mouse.syncAge = newGesture ? 0 : mouse.syncAge + delta;
    if (moving) mouse.motionStarted = true;
    mouse.idle = moving ? 0 : mouse.idle + delta;
    const blend = cameraSyncBlend(mouse.idle, delta);
    mouse.x *= 1 - blend;
    mouse.y *= 1 - blend;
}
