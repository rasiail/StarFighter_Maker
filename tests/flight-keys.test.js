import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFlightKeys, targetFollowActive } from '../src/input/flight-keys.js';

test('casual focus remaps held WASD to pitch and bank without throttle or rudder', () => {
    const held = { keyW: true, keyA: true, casualThrottleUp: true, yawLeft: true };
    const focused = resolveFlightKeys(held, 'casual', true);
    assert.equal(focused.pitchDown, true);
    assert.equal(focused.rollLeft, true);
    assert.equal(focused.casualThrottleUp, false);
    assert.equal(focused.yawLeft, false);
    assert.equal(focused.manualWasd, true);
    const releasedFocus = resolveFlightKeys(held, 'casual', false);
    assert.equal(releasedFocus.casualThrottleUp, true);
    assert.equal(releasedFocus.yawLeft, true);
    assert.equal(held.casualThrottleUp, true);
});

test('S/D map to climb and right bank; Shift and Alt remain available in focus', () => {
    const result = resolveFlightKeys({ keyS: true, keyD: true, casualThrottleDown: true, yawRight: true,
        throttleUp: true, throttleDown: true }, 'casual', true);
    assert.equal(result.pitchUp, true);
    assert.equal(result.rollRight, true);
    assert.equal(result.casualThrottleDown, false);
    assert.equal(result.yawRight, false);
    assert.equal(result.throttleUp, true);
    assert.equal(result.throttleDown, true);
});

test('both schemes detect held keys even when opposing inputs cancel, and release clears the override', () => {
    for (const scheme of ['standard', 'casual']) {
        assert.equal(resolveFlightKeys({keyW: true, keyS: true}, scheme, true).manualWasd, true);
        assert.equal(resolveFlightKeys({keyA: true, keyD: true}, scheme, true).manualWasd, true);
        assert.equal(resolveFlightKeys({}, scheme, true).manualWasd, false);
    }
});

test('standard pitch/roll/rudder bindings are unchanged during focus', () => {
    const held = {keyW: true, pitchDown: true, rollLeft: true, yawRight: true};
    assert.deepEqual(resolveFlightKeys(held, 'standard', true), {...held, manualWasd: true});
});

test('target follow works in both schemes and resumes only after all WASD keys are released', () => {
    for (const scheme of ['standard', 'casual']) {
        const held = { targetCam: true, keyW: true, keyA: true };
        assert.equal(targetFollowActive(true, resolveFlightKeys(held, scheme, true), {}), false);
        held.keyW = false;
        assert.equal(targetFollowActive(true, resolveFlightKeys(held, scheme, true), {}), false);
        held.keyA = false;
        assert.equal(targetFollowActive(true, resolveFlightKeys(held, scheme, true), {}), true);
        assert.equal(targetFollowActive(false, resolveFlightKeys(held, scheme, true), {}), false);
        held.targetCam = false;
        assert.equal(targetFollowActive(true, resolveFlightKeys(held, scheme, false), {}), false);
        assert.equal(targetFollowActive(true, resolveFlightKeys(held, scheme, true), { targetCam: true }), true);
    }
});
