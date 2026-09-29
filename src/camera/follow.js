const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A level chase view places the aircraft around 63–69% down the screen,
// leaving more room above it for the horizon and incoming targets.
export const CAMERA_FOLLOW_PITCH = 0;

export const CAMERA_ROLL_LAG = 15 * Math.PI / 180;
export const CAMERA_PITCH_YAW_LAG = 10 * Math.PI / 180;

// Counter the initial aircraft rotation up to fifteen degrees, then follow at the
// same rate. Once rotation stops, smoothly settle back behind the aircraft.
export function stepCameraRollLag(offset, rollRate, delta) {
    return stepCameraRotationLag(offset, rollRate, delta, CAMERA_ROLL_LAG);
}

export function stepCameraRotationLag(offset, rate, delta, limit = CAMERA_PITCH_YAW_LAG) {
    if (delta <= 0) return offset;
    if (Math.abs(rate) > 0.01) {
        return clamp(offset - rate * delta, -limit, limit);
    }
    const settled = offset * Math.exp(-5 * delta);
    return Math.abs(settled) < 0.0001 ? 0 : settled;
}

// Rear view follows from 9.375m at cruise to 12.5m at high speed.
// Side/front views keep the full orbit distance.
export function cameraFollowOffset(speedRatio = 0.5, yaw = 0, pitch = 0) {
    const speedT = clamp((clamp(speedRatio, 0, 1) - 0.5) / 0.3, 0, 1);
    const speedFactor = 0.75 + 0.25 * speedT;
    const rearAlignment = Math.max(0, Math.cos(yaw) * Math.cos(pitch));
    const factor = 1 + (speedFactor - 1) * rearAlignment;
    return { y: 1.4 + 0.8 * (factor - 0.5) / 0.5, z: 12.5 * factor };
}
