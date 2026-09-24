import test from 'node:test';
import assert from 'node:assert/strict';
import { moveAimDirection, mouseAimRates } from '../src/player/mouse-aim.js';
import { stepCasualTurn } from '../src/player/casual.js';
import { createMouseFlight, addMouseMotion, consumeMouseMotion } from '../src/input/mouse-flight.js';
const forward = { x: 0, y: 0, z: -1 }, right = { x: 1, y: 0, z: 0 }, up = { x: 0, y: 1, z: 0 };

test('mouse moves a persistent world direction; stopping or moving the camera does not erase it', () => {
    const goal = moveAimDirection(forward, 100, -50, right, up);
    assert.ok(goal.x > 0 && goal.y > 0);
    const held = moveAimDirection(goal, 0, 0, { x: 0, y: 0, z: 1 }, up);
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(held[axis] - goal[axis]) < 1e-12);
    assert.ok(mouseAimRates(goal, 1.45, 0.55).yaw < 0, 'aircraft continues turning without further movement');
});

test('raw displacement survives frame consumption without speed saturation losing aim travel', () => {
    const mouse = createMouseFlight();
    addMouseMotion(mouse, 400, -200, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    assert.equal(mouse.frameX, 400);
    assert.equal(mouse.frameY, -200);
    consumeMouseMotion(mouse, 1 / 60);
    assert.equal(mouse.frameX, 0);
});

test('same horizontal mouse travel yields the same goal regardless of event batching', () => {
    const once = moveAimDirection(forward, 200, 0, right, up);
    let many = forward;
    for (let i = 0; i < 100; i++) many = moveAimDirection(many, 2, 0, right, up);
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(once[axis] - many[axis]) < 1e-10);
});

test('aircraft reaches a held heading and stops turning at 30 and 144 FPS', () => {
    const goal = moveAimDirection(forward, 250, 0, right, up);
    const goalHeading = Math.atan2(-goal.x, -goal.z);
    for (const hz of [30, 144]) {
        let heading = 0, rate = 0;
        for (let i = 0; i < hz * 8; i++) {
            const error = goalHeading - heading;
            const local = { x: -Math.sin(error), y: 0, z: -Math.cos(error) };
            const command = mouseAimRates(local, 1.45, 0.55);
            assert.ok(Math.abs(command.yaw) <= 0.55 * 3 * 0.8 + 1e-12);
            rate = stepCasualTurn(rate, 0, 1.45, 0.55, 0.5, 1 / hz, command.yaw).rate;
            heading += rate / hz;
        }
        assert.ok(Math.abs(heading - goalHeading) < 0.001);
        assert.ok(Math.abs(rate) < 0.001);
    }
});

test('holding an elevated goal preserves climb instead of auto-leveling the pitch', () => {
    const desiredPitch = 0.4;
    let pitch = 0, rate = 0;
    for (let i = 0; i < 600; i++) {
        const error = desiredPitch - pitch;
        const command = mouseAimRates({ x: 0, y: Math.sin(error), z: -Math.cos(error) }, 1.45, 0.55);
        rate += (command.pitch - rate) * 7 / 60;
        pitch += rate / 60;
    }
    assert.ok(Math.abs(pitch - desiredPitch) < 0.001);
    assert.ok(Math.abs(rate) < 0.001);
});

test('AIM angular travel is 70% of the previous sensitivity on both axes', () => {
    const horizontal = moveAimDirection(forward, 100, 0, right, up);
    const vertical = moveAimDirection(forward, 0, -100, right, up);
    const expected = 100 * 0.0035 * 0.7;
    assert.ok(Math.abs(Math.atan2(horizontal.x, -horizontal.z) - expected) < 1e-12);
    assert.ok(Math.abs(Math.asin(vertical.y) - expected) < 1e-12);
});
