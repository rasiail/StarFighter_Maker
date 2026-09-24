import { CASUAL_AIRCRAFT_SPEED, focusRates } from './casual.js';
export const AIM_SENSITIVITY = 0.0035 * 0.7;

function rotate(vector, axis, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const dot = vector.x * axis.x + vector.y * axis.y + vector.z * axis.z;
    return {
        x: vector.x * c + (axis.y * vector.z - axis.z * vector.y) * s + axis.x * dot * (1 - c),
        y: vector.y * c + (axis.z * vector.x - axis.x * vector.z) * s + axis.y * dot * (1 - c),
        z: vector.z * c + (axis.x * vector.y - axis.y * vector.x) * s + axis.z * dot * (1 - c),
    };
}
// The world-space goal persists when the mouse stops and when the camera moves.
export function moveAimDirection(direction, dx, dy, cameraRight, cameraUp) {
    const yawed = rotate(direction, cameraUp, -dx * AIM_SENSITIVITY);
    const result = rotate(yawed, cameraRight, -dy * AIM_SENSITIVITY);
    const length = Math.hypot(result.x, result.y, result.z);
    return { x: result.x / length, y: result.y / length, z: result.z / length };
}
export function mouseAimRates(localDirection, maxPitchRate, maxYawRate) {
    // focusRates accepts a target displacement; scale the unit direction so its
    // coincident-target guard cannot suppress small floating-point deviations.
    return focusRates({ x: localDirection.x * 1000, y: localDirection.y * 1000, z: localDirection.z * 1000 },
        maxPitchRate * CASUAL_AIRCRAFT_SPEED, maxYawRate * CASUAL_AIRCRAFT_SPEED);
}
export function aimOutsideDeadzone(localDirection, fov, aspect, percent) {
    const fraction = Math.max(0, Math.min(100, percent)) / 100;
    if (localDirection.z >= -0.0001) return true;
    const halfHeight = -localDirection.z * Math.tan(fov * Math.PI / 360);
    // A square measured against the shorter viewport dimension, in pixels.
    const halfSide = halfHeight * Math.min(1, aspect) * fraction;
    return Math.abs(localDirection.x) > halfSide || Math.abs(localDirection.y) > halfSide;
}
