import test from 'node:test';
import assert from 'node:assert/strict';
import { createMouseFlight, addMouseMotion, consumeMouseMotion, cameraSyncBlend, MOUSE_SYNC_DELAY } from '../src/input/mouse-flight.js';

test('raw movement is consumed once; a stationary cursor supplies no new goal displacement', () => {
    const mouse = createMouseFlight();
    addMouseMotion(mouse, 300, -100, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    assert.equal(mouse.motionX, 1);
    consumeMouseMotion(mouse, 1 / 60);
    assert.ok(mouse.x > 0, 'cursor remains displaced during the delay');
    assert.equal(mouse.motionX, 0);
    assert.equal(mouse.motionY, 0);

});

test('equal movement speed gives equal commands at different frame rates and event counts', () => {
    for (const hz of [30, 60, 144]) {
        const mouse = createMouseFlight();
        for (let event = 0; event < 4; event++) addMouseMotion(mouse, 120 / hz / 4, 0, 1280, 800);
        consumeMouseMotion(mouse, 1 / hz);
        assert.ok(Math.abs(mouse.motionX - 0.5) < 1e-10);
    }
});

test('small motions respond immediately, and reversing direction works at the screen edge', () => {
    const mouse = createMouseFlight();
    addMouseMotion(mouse, 0.1, 0, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    assert.ok(mouse.motionX > 0);
    addMouseMotion(mouse, 10000, 0, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    addMouseMotion(mouse, -1, 0, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    assert.ok(mouse.x > 0 && mouse.motionX < 0);
});

test('synchronization waits 500ms then damps to the aircraft without frame-rate drift', () => {
    assert.equal(cameraSyncBlend(MOUSE_SYNC_DELAY, 0.02), 0);
    for (const hz of [30, 144]) {
        const mouse = createMouseFlight();
        mouse.x = 1;
        let orientationError = 1;
        for (let frame = 0; frame < hz; frame++) {
            consumeMouseMotion(mouse, 1 / hz);
            orientationError *= 1 - cameraSyncBlend(mouse.idle, 1 / hz);
        }
        const expected = Math.exp(-6 * (1 - MOUSE_SYNC_DELAY));
        assert.ok(Math.abs(orientationError - expected) < 1e-10);
        assert.ok(Math.abs(mouse.x - expected) < 1e-10);
        addMouseMotion(mouse, 1, 0, 1280, 800);
        consumeMouseMotion(mouse, 1 / hz);
        assert.equal(mouse.idle, 0);
        assert.equal(cameraSyncBlend(mouse.idle, 1 / hz), 0);
    }
});

test('continuous movement suppresses idle recentering; stopping enables it and moving again cancels it', () => {
    const mouse = createMouseFlight();
    for (let frame = 0; frame < 60; frame++) {
        addMouseMotion(mouse, 0.5, 0, 1280, 800);
        consumeMouseMotion(mouse, 1 / 60);
        assert.equal(cameraSyncBlend(mouse.idle, 1 / 60), 0);
    }
    for (let frame = 0; frame < 20; frame++) consumeMouseMotion(mouse, 1 / 60);
    assert.equal(cameraSyncBlend(mouse.idle, 1 / 60), 0, 'still held after the former return delay');
    for (let frame = 0; frame < 12; frame++) consumeMouseMotion(mouse, 1 / 60);
    assert.ok(cameraSyncBlend(mouse.idle, 1 / 60) > 0);
    addMouseMotion(mouse, 1, 0, 1280, 800);
    consumeMouseMotion(mouse, 1 / 60);
    assert.equal(cameraSyncBlend(mouse.idle, 1 / 60), 0);
});
