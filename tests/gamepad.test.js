import test from 'node:test';
import assert from 'node:assert/strict';
import { createPadReader, deadzone, padInput } from '../src/input/gamepad-state.js';
import { updateGamepad, resetGamepad } from '../src/input/gamepad.js';
import { gameState } from '../src/core/state.js';

function pad(...buttons) {
    return { index: 0, id: 'Test controller', connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: buttons.includes(i) ? 1 : 0 })) };
}
test('Circle holds at 180ms and L2 holds at 280ms, and never tap after a hold', () => {
    // Circle (button 1): 180ms
    {
        const reader = createPadReader();
        reader.read(pad(), 0, 'combat');
        assert.equal(reader.read(pad(1), 1, 'combat').hold[1], false);
        assert.equal(reader.read(pad(), 1.17, 'combat').tap[1], true);
        assert.equal(reader.read(pad(), 1.18, 'combat').tap[1], false);
        reader.read(pad(1), 2, 'combat');
        assert.equal(reader.read(pad(1), 2.181, 'combat').hold[1], true);
        const release = reader.read(pad(), 3, 'combat');
        assert.equal(release.tap[1], false);
        assert.equal(release.hold[1], false);
    }
    // L2 (button 6): 280ms (increased by 0.1s)
    {
        const reader = createPadReader();
        reader.read(pad(), 0, 'combat');
        assert.equal(reader.read(pad(6), 1, 'combat').hold[6], false);
        assert.equal(reader.read(pad(), 1.27, 'combat').tap[6], true);
        assert.equal(reader.read(pad(), 1.28, 'combat').tap[6], false);
        reader.read(pad(6), 2, 'combat');
        assert.equal(reader.read(pad(6), 2.281, 'combat').hold[6], true);
        const release = reader.read(pad(), 3, 'combat');
        assert.equal(release.tap[6], false);
        assert.equal(release.hold[6], false);
    }
});
test('Connection, context changes and reset suppress held buttons until released', () => {
    const reader = createPadReader();
    assert.equal(reader.read(pad(1, 7), 0, 'combat').down[7], false);
    assert.equal(reader.read(pad(), 0.1, 'combat').tap[1], false);
    reader.read(pad(1), 1, 'combat');
    reader.read(pad(1), 1.1, 'cards');
    assert.equal(reader.read(pad(), 1.15, 'cards').tap[1], false);
    reader.reset();
    assert.equal(reader.read(pad(1), 2, 'combat').hold[1], false);
    reader.read(pad(), 3, 'combat');
    assert.equal(reader.read(pad(1), 4, 'combat').pressed[1], true);
});
test('Square/Cross/Options trigger once per press and sticks have a rescaled deadzone', () => {
    const reader = createPadReader();
    reader.read(pad(), 0, 'combat');
    for (const time of [1, 2]) {
        const result = reader.read(pad(0, 2, 9), time, 'combat');
        for (const button of [0, 2, 9]) assert.equal(result.pressed[button], time === 1);
    }
    assert.equal(deadzone(0.17), 0);
    assert.equal(deadzone(-0.18), 0);
    assert.equal(deadzone(1), 1);
    assert.equal(deadzone(-1), -1);
    assert.ok(Math.abs(deadzone(0.59) - 0.5) < 1e-10);
});
test('Runtime mapping, pause, disconnect and API failure clear only controller input', () => {
    const descriptors = Object.fromEntries(['document', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const originalState = { ...gameState };
    let current = pad(), hidden = false, fail = false;
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { get hidden() { return hidden; }, hasFocus: () => true, getElementById: () => null } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads() { if (fail) throw new Error('denied'); return [current]; } } });
    try {
        Object.assign(gameState, { phase: 'combat', activeModal: null, isGameRunning: true, isGamePaused: false });
        resetGamepad();
        updateGamepad(0.016, 0);
        current = pad(7, 3, 4, 1, 6);
        current.axes = [1, -1, 0, 0];
        updateGamepad(0.016, 1);
        updateGamepad(0.016, 1.3);
        assert.deepEqual(padInput, { pitch: -1, roll: -1, yaw: 1, throttleUp: true, throttleDown: true, fireCannon: true, beamHeld: false, targetCam: true });
        gameState.isGamePaused = true;
        updateGamepad(0.016, 1.4);
        assert.equal(padInput.fireCannon, false);
        assert.equal(padInput.throttleUp, false);
        gameState.isGamePaused = false;
        updateGamepad(0.016, 1.5);
        assert.equal(padInput.fireCannon, false);
        current = null;
        updateGamepad(0.016, 2);
        assert.equal(padInput.pitch, 0);
        current = pad(7);
        updateGamepad(0.016, 3);
        assert.equal(padInput.throttleUp, false);
        hidden = true;
        updateGamepad(0.016, 4);
        assert.equal(padInput.roll, 0);
        hidden = false;
        fail = true;
        assert.doesNotThrow(() => updateGamepad(0.016, 5));
        fail = false;
        current.mapping = '';
        updateGamepad(0.016, 6);
        assert.equal(padInput.throttleUp, false);
    } finally {
        resetGamepad();
        Object.assign(gameState, originalState);
        for (const [key, descriptor] of Object.entries(descriptors)) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
});
