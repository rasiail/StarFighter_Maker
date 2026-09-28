export function createHitShake() { return { strength: 0, age: 0 }; }
export function addHitShake(state, damage) {
    if (!(damage > 0)) return;
    state.strength = Math.min(1, state.strength + Math.min(0.8, 0.22 + damage * 0.025));
    state.age = 0;
}
export function stepHitShake(state, delta) {
    state.age += delta;
    if (state.age >= 0.28) state.strength = 0;
    const envelope = state.strength * Math.max(0, 1 - state.age / 0.28) ** 2;
    return { x: Math.sin(state.age * 157) * 0.055 * envelope,
        y: Math.cos(state.age * 131) * 0.045 * envelope,
        pitch: Math.sin(state.age * 139) * 0.004 * envelope,
        yaw: Math.cos(state.age * 113) * 0.003 * envelope };
}

// Restore the real camera even if rendering throws: input and tracking see no shake.
export function renderWithHitShake(camera, offset, render) {
    if (!offset) return render();
    const position = camera.position.clone(), quaternion = camera.quaternion.clone();
    try {
        camera.position.x += offset.x;
        camera.position.y += offset.y;
        camera.rotateX(offset.pitch);
        camera.rotateY(offset.yaw);
        return render();
    } finally {
        camera.position.copy(position);
        camera.quaternion.copy(quaternion);
        camera.updateMatrixWorld(true);
    }
}
