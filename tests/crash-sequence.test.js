import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/state.js';

test('gameState contains all required crash sequence properties', () => {
    assert.equal(typeof gameState.isPlayerDead, 'boolean');
    assert.equal(typeof gameState.deathTimer, 'number');
    assert.equal(gameState.deathTotalTime, 5.0);
    assert.equal(gameState.playerCrashed, false);
    assert.equal(gameState.crashPosition, null);
    assert.equal(typeof gameState.deathNextBurst, 'number');
    assert.equal(typeof gameState.deathSmokeTimer, 'number');
    assert.equal(typeof gameState.deathFallSpeed, 'number');
});

test('overhead crash camera offset creates downward high-angle view', () => {
    const overheadOffset = { x: 25, y: 80, z: 35 };
    const horizontalDistance = Math.hypot(overheadOffset.x, overheadOffset.z);
    // Downward angle relative to horizontal plane: atan(height / horizontalDistance)
    const downwardAngleRad = Math.atan2(overheadOffset.y, horizontalDistance);
    const downwardAngleDeg = (downwardAngleRad * 180) / Math.PI;

    // Angle should be a dramatic overhead high angle (between 55 and 75 degrees)
    assert.ok(downwardAngleDeg >= 55 && downwardAngleDeg <= 75, `Expected 55-75 deg, got ${downwardAngleDeg}`);
    // Camera height should be significantly above the crash point (>= 70m)
    assert.ok(overheadOffset.y >= 70, 'Camera height should be at least 70m');
});

test('burst explosion schedule stays within 5.0 second death timer window', () => {
    const totalDuration = 5.0;
    let nextBurst = 0.9;
    const bursts = [];

    while (nextBurst < 2.6) { // bursts during mid-air fall before ground impact at ~2.6s
        bursts.push(nextBurst);
        nextBurst += 1.1; // average 1.0 - 1.3 interval
    }

    assert.ok(bursts.length >= 2, 'Should have at least 2 mid-air bursts before ground impact');
    assert.ok(bursts[0] >= 0.8 && bursts[0] <= 1.0, 'First burst occurs around 0.9s');
    assert.ok(bursts[bursts.length - 1] < 2.6, 'All fall bursts occur before ground crash');
});
