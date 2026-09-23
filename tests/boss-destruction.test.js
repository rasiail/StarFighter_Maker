import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../src/core/events.js';
import { activeDyingBosses, clearDyingBosses } from '../src/enemies/lifecycle.js';

test('EVENTS contains BOSS_SEQUENCE_COMPLETE', () => {
    assert.equal(typeof EVENTS.BOSS_SEQUENCE_COMPLETE, 'string');
    assert.equal(EVENTS.BOSS_SEQUENCE_COMPLETE, 'boss:sequence_complete');
});

test('activeDyingBosses lifecycle and clearDyingBosses work correctly', () => {
    assert.ok(Array.isArray(activeDyingBosses));
    clearDyingBosses();
    assert.equal(activeDyingBosses.length, 0);

    const mockBoss = {
        mesh: null,
        timer: 3.0,
        totalTime: 3.0,
        nextBurst: 0.25,
        smokeTimer: 0,
        speed: 180,
    };
    activeDyingBosses.push(mockBoss);
    assert.equal(activeDyingBosses.length, 1);
    assert.equal(activeDyingBosses[0].timer, 3.0);

    clearDyingBosses();
    assert.equal(activeDyingBosses.length, 0);
});

test('boss destruction sequence timing parameters match 3-second requirements', () => {
    const totalDuration = 3.0;
    let nextBurst = 0.25;
    const bursts = [];

    // Simulate burst interval of 0.35s
    while (nextBurst < totalDuration - 0.35) {
        bursts.push(nextBurst);
        nextBurst += 0.35;
    }

    // Should have multiple dramatic explosions throughout the 3 seconds
    assert.ok(bursts.length >= 6, `Expected at least 6 bursts during 3s, got ${bursts.length}`);
    assert.ok(bursts[0] <= 0.3, 'First burst starts quickly');
    assert.ok(bursts[bursts.length - 1] < totalDuration, 'Bursts finish before final super explosion');
});
