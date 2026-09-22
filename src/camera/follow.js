const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Rear view follows from 9.375m at cruise to 12.5m at high speed.
// Side/front views keep the full orbit distance.
export function cameraFollowOffset(speedRatio = 0.5, yaw = 0, pitch = 0) {
    const speedT = clamp((clamp(speedRatio, 0, 1) - 0.5) / 0.3, 0, 1);
    const speedFactor = 0.75 + 0.25 * speedT;
    const rearAlignment = Math.max(0, Math.cos(yaw) * Math.cos(pitch));
    const factor = 1 + (speedFactor - 1) * rearAlignment;
    return { y: 1.4 + 0.8 * (factor - 0.5) / 0.5, z: 12.5 * factor };
}
