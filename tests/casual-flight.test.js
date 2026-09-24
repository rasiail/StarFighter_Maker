import test from 'node:test';
import assert from 'node:assert/strict';
import { stepCasualTurn, levelingRates, focusRates } from '../src/player/casual.js';

test('mouse yaw is faster than rudder, banks into turn, and lifts the nose', () => {
    const left = stepCasualTurn(0, -1, 1.2, 0.3, 0.5, 1);
    const right = stepCasualTurn(0, 1, 1.2, 0.3, 0.5, 1);
    assert.ok(left.rate > 0.3);
    assert.equal(left.rate, -right.rate);
    assert.equal(left.bank, -right.bank);
    assert.ok(left.pitch > 0);
    assert.equal(left.pitch, right.pitch);
    const fast = stepCasualTurn(0, -1, 1.2, 0.3, 1, 1);
    assert.ok(fast.bank > left.bank);
    assert.ok(fast.pitch > left.pitch);
});

test('neutral decays to level without overshoot; yaw smoothing is frame-rate independent', () => {
    const run = (hz, mouse, start) => {
        let turn = { rate: start };
        for (let i = 0; i < hz; i++) turn = stepCasualTurn(turn.rate, mouse, 1.2, 0.3, 0.5, 1 / hz);
        return turn;
    };
    assert.ok(Math.abs(run(30, 1, 0).rate - run(144, 1, 0).rate) < 1e-10);
    const stopped = run(60, 0, 1.2);
    assert.ok(stopped.rate >= 0 && stopped.rate < 0.002);
    assert.ok(stopped.bank < 0.002);
});

test('leveling corrects climb, dive and both banks, including inverted and vertical attitudes', () => {
    assert.ok(levelingRates({ x: 0, y: Math.cos(0.4), z: -Math.sin(0.4) }, 1.45, 2.85).pitch < 0);
    assert.ok(levelingRates({ x: 0, y: Math.cos(0.4), z: Math.sin(0.4) }, 1.45, 2.85).pitch > 0);
    for (const bank of [-2.8, -0.5, 0.5, 2.8]) {
        const rates = levelingRates({ x: Math.sin(bank), y: Math.cos(bank), z: 0 }, 1.45, 2.85);
        assert.ok(rates.roll * bank < 0);
        assert.ok(Math.abs(rates.roll) <= 2.85 * 0.6);
    }
    const vertical = levelingRates({ x: 0, y: 0, z: -1 }, 1.45, 2.85);
    assert.equal(vertical.roll, 0);
    assert.ok(Number.isFinite(vertical.pitch));
});

test('focus turns toward all quadrants and handles overhead, behind and coincident targets', () => {
    assert.ok(focusRates({ x: 100, y: 100, z: -100 }, 1.45, 0.55).yaw < 0);
    assert.ok(focusRates({ x: -100, y: -100, z: -100 }, 1.45, 0.55).pitch < 0);
    assert.equal(Math.abs(focusRates({ x: 0, y: 0, z: 100 }, 1.45, 0.55).yaw), 0.55 * 3);
    assert.equal(focusRates({ x: 0, y: 100, z: 0 }, 1.45, 0.55).yaw, 0);
    assert.deepEqual(focusRates({ x: 0, y: 0, z: 0 }, 1.45, 0.55), { pitch: 0, yaw: 0 });
    const turn = stepCasualTurn(0, 1, 1.45, 0.55, 0.5, 1, 1);
    assert.ok(turn.rate > 0, 'focus command overrides opposing mouse input');
});

test('closed-loop focus converges from a rear target at 30 and 144 FPS', () => {
    for (const hz of [30, 144]) {
        let heading = 0, yawRate = 0;
        const targetHeading = 2.8;
        for (let i = 0; i < hz * 8; i++) {
            const error = targetHeading - heading;
            const focus = focusRates({ x: -Math.sin(error) * 1000, y: 0, z: -Math.cos(error) * 1000 }, 1.45, 0.55);
            yawRate = stepCasualTurn(yawRate, 0, 1.45, 0.55, 0.5, 1 / hz, focus.yaw).rate;
            heading += yawRate / hz;
        }
        assert.ok(Math.abs(heading - targetHeading) < 0.001);
    }
});

test('neutral pitch leveling settles with flight inertia at 30 and 144 FPS', () => {
    for (const hz of [30, 144]) {
        let pitch = 0.7, rate = 0;
        for (let i = 0; i < hz * 8; i++) {
            const level = levelingRates({ x: 0, y: Math.cos(pitch), z: -Math.sin(pitch) }, 1.45, 2.85);
            rate += (level.pitch - rate) * Math.min(1, 7 / hz);
            pitch += rate / hz;
        }
        assert.ok(Math.abs(pitch) < 0.001);
    }
});
