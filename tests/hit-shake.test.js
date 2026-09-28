import test from 'node:test';
import assert from 'node:assert/strict';
import { createHitShake, addHitShake, stepHitShake, renderWithHitShake } from '../src/camera/hit-shake.js';

test('hits produce small bounded shake, stack safely and settle in 280ms', () => {
    const state = createHitShake();
    addHitShake(state, 4);
    const offset = stepHitShake(state, 0.01);
    assert.ok(Math.abs(offset.x) > 0 && Math.abs(offset.pitch) > 0);
    for (let i = 0; i < 100; i++) addHitShake(state, 20);
    assert.equal(state.strength, 1);
    for (let i = 0; i < 30; i++) {
        const frame = stepHitShake(state, 0.01);
        assert.ok(Math.abs(frame.x) <= 0.055 && Math.abs(frame.y) <= 0.045);
        assert.ok(Math.abs(frame.pitch) <= 0.004 && Math.abs(frame.yaw) <= 0.003);
    }
    assert.equal(state.strength, 0);
});

test('equal elapsed time gives the same shake at different frame rates', () => {
    const sample = hz => {
        const state = createHitShake(); addHitShake(state, 14);
        let offset;
        for (let i = 0; i < hz / 5; i++) offset = stepHitShake(state, 1 / hz);
        return offset;
    };
    const a = sample(30), b = sample(120);
    for (const key of Object.keys(a)) assert.ok(Math.abs(a[key] - b[key]) < 1e-10);
});

test('render-only shake restores camera position and attitude even on render failure', () => {
    const value = initial => ({ ...initial, clone() { return { ...this }; }, copy(v) { Object.assign(this, v); } });
    const camera = { position: value({ x: 1, y: 2, z: 3 }), quaternion: value({ x: 0, y: 0, z: 0, w: 1 }),
        rotateX(v) { this.quaternion.x += v; }, rotateY(v) { this.quaternion.y += v; }, updateMatrixWorld() {} };
    const offset = { x: 0.02, y: -0.01, pitch: 0.002, yaw: 0.001 };
    assert.throws(() => renderWithHitShake(camera, offset, () => {
        assert.equal(camera.position.x, 1.02);
        assert.equal(camera.quaternion.x, 0.002);
        throw new Error('render failed');
    }), /render failed/);
    assert.equal(camera.position.x, 1);
    assert.equal(camera.position.y, 2);
    assert.equal(camera.quaternion.x, 0);
    assert.equal(camera.quaternion.y, 0);
});
