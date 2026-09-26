import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFlightKeys, targetFollowActive } from '../src/input/flight-keys.js';

test('casual keeps speed, roll and rudder bindings while focusing', () => {
    for (const focusing of [false, true]) {
        const held = { keyW: true, keyS: true, keyA: true, keyD: true,
            casualThrottleUp: true, casualThrottleDown: true, yawLeft: true, yawRight: true };
        const result = resolveFlightKeys(held, 'casual', focusing);
        assert.equal(result.casualThrottleUp, true);
        assert.equal(result.casualThrottleDown, true);
        assert.equal(result.rollLeft, true);
        assert.equal(result.rollRight, true);
        assert.equal(result.yawLeft, true);
        assert.equal(result.yawRight, true);
        assert.ok(!result.pitchUp && !result.pitchDown);
    }
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
