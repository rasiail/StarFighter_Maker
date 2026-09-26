// Motion commands last one frame; inertia supplies the short ease-out.
export const CASUAL_AIRCRAFT_SPEED = 0.8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function stepCasualTurn(previousRate, motionX, maxPitchRate, maxYawRate, speedRatio, delta, commandedYawRate = null) {
    const maxRate = Math.max(maxPitchRate, maxYawRate * 3);
    const target = commandedYawRate === null ? -clamp(motionX, -1, 1) * maxRate * CASUAL_AIRCRAFT_SPEED
        : clamp(commandedYawRate, -maxRate, maxRate);
    const rate = previousRate + (target - previousRate) * (1 - Math.exp(-7 * delta));
    const strength = clamp(rate / maxRate, -1, 1);
    const speed = clamp(speedRatio, 0, 1);
    return {
        rate,
        bank: strength * (0.65 + speed * 0.5),
        pitch: Math.abs(strength) * (0.04 + speed * 0.08),
    };
}

// World up expressed in the flight root's local frame. No Euler decomposition,
// so manual rolls and near-vertical flight cannot corrupt the stored attitude.
export function levelingRates(localUp, maxPitchRate, maxRollRate) {
    const horizon = Math.hypot(localUp.x, localUp.y);
    return {
        pitch: clamp(Math.asin(clamp(localUp.z, -1, 1)) * 1.2, -maxPitchRate * 0.5, maxPitchRate * 0.5),
        roll: horizon < 0.05 ? 0 : clamp(-Math.atan2(localUp.x, localUp.y) * 2, -maxRollRate * 0.6, maxRollRate * 0.6),
    };
}

export function focusRates(localTarget, maxPitchRate, maxYawRate) {
    const horizontal = Math.hypot(localTarget.x, localTarget.z);
    if (Math.hypot(horizontal, localTarget.y) < 1) return { pitch: 0, yaw: 0 };
    const enhancedYaw = Math.max(maxPitchRate, maxYawRate * 3);
    return {
        pitch: clamp(Math.atan2(localTarget.y, horizontal) * 2.5, -maxPitchRate, maxPitchRate),
        yaw: horizontal < 0.001 ? 0 : clamp(-Math.atan2(localTarget.x, -localTarget.z) * 2.5, -enhancedYaw, enhancedYaw),
    };
}

// A/D uses the same coordinated turn and visual bank as mouse steering.
export function keyboardBankRate(keys, maxPitchRate, maxYawRate) {
    return (Number(!!keys.bankLeft) - Number(!!keys.bankRight))
        * Math.max(maxPitchRate, maxYawRate * 3) * CASUAL_AIRCRAFT_SPEED;
}
