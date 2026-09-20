// Standard Gamepad mapping: Cross, Circle, Square, Triangle, L1, R1, L2, R2.
export const HOLD_SECONDS = 0.18;
export const padInput = {};
export function clearPadInput() {
    Object.assign(padInput, { pitch: 0, roll: 0, yaw: 0, throttleUp: false, throttleDown: false, fireCannon: false, targetCam: false });
}
clearPadInput();
export function deadzone(value = 0, threshold = 0.18) {
    return Math.abs(value) <= threshold ? 0 : Math.sign(value) * (Math.min(1, Math.abs(value)) - threshold) / (1 - threshold);
}
export function createPadReader() {
    let previous = [], blocked = [], starts = {}, context = null;
    return {
        reset() { previous = []; blocked = []; starts = {}; context = null; },
        read(pad, now, nextContext) {
            const down = Array.from({ length: 17 }, (_, i) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value || 0) > 0.5);
            if (context !== nextContext) {
                blocked = down.slice();
                starts = {};
                previous = down.slice();
                context = nextContext;
            }
            const pressed = down.map((value, i) => value && !previous[i] && !blocked[i]);
            const tap = {}, hold = {};
            for (const i of [1, 6]) {
                if (pressed[i]) starts[i] = now;
                hold[i] = down[i] && starts[i] !== undefined && now - starts[i] >= HOLD_SECONDS;
                tap[i] = !down[i] && previous[i] && starts[i] !== undefined && now - starts[i] < HOLD_SECONDS;
                if (!down[i]) delete starts[i];
            }
            down.forEach((value, i) => { if (!value) blocked[i] = false; });
            previous = down;
            return { pressed, tap, hold, down: down.map((value, i) => value && !blocked[i]), axes: Array.from({ length: 4 }, (_, i) => deadzone(pad.axes[i])) };
        },
    };
}
