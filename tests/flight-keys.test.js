import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFlightKeys, targetFollowActive } from '../src/input/flight-keys.js';

test('casual W/S change from throttle to pitch only while focusing', () => {
    const held = { keyW: true, keyS: true, keyA: true, keyD: true,
        casualThrottleUp: true, casualThrottleDown: true, yawLeft: true, yawRight: true };
    const cruising = resolveFlightKeys(held, 'casual', false);
    assert.equal(cruising.casualThrottleUp, true);
    assert.equal(cruising.casualThrottleDown, true);
    assert.ok(!cruising.pitchUp && !cruising.pitchDown);

    const result = resolveFlightKeys(held, 'casual', true);
    assert.equal(result.casualThrottleUp, false);
    assert.equal(result.casualThrottleDown, false);
    assert.equal(result.pitchUp, true);
    assert.equal(result.pitchDown, true);
    for (const key of ['rollLeft', 'rollRight', 'yawLeft', 'yawRight']) {
        assert.equal(result[key], true);
    }

    const wOnly = resolveFlightKeys({ keyW: true, casualThrottleUp: true }, 'casual', true);
    assert.deepEqual(
        { pitchDown: wOnly.pitchDown, pitchUp: !!wOnly.pitchUp, throttleUp: wOnly.casualThrottleUp },
        { pitchDown: true, pitchUp: false, throttleUp: false }
    );
    const sOnly = resolveFlightKeys({ keyS: true, casualThrottleDown: true }, 'casual', true);
    assert.deepEqual(
        { pitchDown: !!sOnly.pitchDown, pitchUp: sOnly.pitchUp, throttleDown: sOnly.casualThrottleDown },
        { pitchDown: false, pitchUp: true, throttleDown: false }
    );
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
