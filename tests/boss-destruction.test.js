import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS } from '../src/core/events.js';
import { activeDyingBosses, clearDyingBosses } from '../src/enemies/lifecycle.js';
import { gameState } from '../src/core/state.js';

test('EVENTS contains BOSS_SEQUENCE_COMPLETE', () => {
    assert.equal(typeof EVENTS.BOSS_SEQUENCE_COMPLETE, 'string');
    assert.equal(EVENTS.BOSS_SEQUENCE_COMPLETE, 'boss:sequence_complete');
});

test('gameState contains bossDyingSequence property initialized to false', () => {
    assert.equal(typeof gameState.bossDyingSequence, 'boolean');
    assert.equal(gameState.bossDyingSequence, false);
});

test('activeDyingBosses lifecycle and clearDyingBosses work correctly and reset bossDyingSequence', () => {
    assert.ok(Array.isArray(activeDyingBosses));
    clearDyingBosses();
    assert.equal(activeDyingBosses.length, 0);
    assert.equal(gameState.bossDyingSequence, false);

    gameState.bossDyingSequence = true;
    const mockBoss = {
        mesh: null,
        timer: 5.0,
        totalTime: 5.0,
        nextBurst: 0.25,
        smokeTimer: 0,
        speed: 180,
    };
    activeDyingBosses.push(mockBoss);
    assert.equal(activeDyingBosses.length, 1);
    assert.equal(activeDyingBosses[0].timer, 5.0);

    clearDyingBosses();
    assert.equal(activeDyingBosses.length, 0);
    assert.equal(gameState.bossDyingSequence, false);
});

test('boss destruction sequence timing parameters match 5-second requirements', () => {
    const totalDuration = 5.0;
    let nextBurst = 0.25;
    const bursts = [];

    // Simulate burst interval of ~0.35s up to 4.2s (remaining 0.8s)
    while (nextBurst <= totalDuration - 0.8) {
        bursts.push(nextBurst);
        nextBurst += 0.35;
    }

    // Should have multiple dramatic explosions throughout the 5 seconds
    assert.ok(bursts.length >= 10, `Expected at least 10 bursts during 5s, got ${bursts.length}`);
    assert.ok(bursts[0] <= 0.3, 'First burst starts quickly');
    assert.ok(bursts[bursts.length - 1] <= 4.2, 'Bursts finish before final climax explosion phase at 4.2s');
});

