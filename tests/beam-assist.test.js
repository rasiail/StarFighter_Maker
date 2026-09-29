import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBeamAssistTarget } from '../src/combat/beam-assist.js';

const enemy = (x, z = -1000, y = 0) => ({ alive: true, mesh: { position: { x, y, z } } });
const choose = (enemyList, lockedTarget = null, overrides = {}) => selectBeamAssistTarget({
    enemyList, lockedTarget, origin: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: -1 },
    project: p => ({ x: p.x / -p.z, y: p.y / -p.z, z: p.z < 0 ? 0.5 : 2 }),
    width: 1000, height: 600, radius: 140, ...overrides,
});

test('beam assists unselected enemies inside the circle, preferring the closest to its center', () => {
    const near = enemy(40), farther = enemy(200);
    assert.equal(choose([farther, near]), near);
    assert.equal(choose([near, farther]), near);
});

test('selected target takes priority only when eligible; selection is not changed', () => {
    const near = enemy(10), selected = enemy(250);
    assert.equal(choose([near, selected], selected), selected);
    selected.mesh.position.x = 300;
    assert.equal(choose([near, selected], selected), near);
    selected.mesh.position.x = 0;
    selected.mesh.position.z = -3001;
    assert.equal(choose([near, selected], selected), near);
    selected.mesh.position.z = -1000;
    selected.alive = false;
    assert.equal(choose([near, selected], selected), near);
});

test('range, forward direction, visibility, and screen-space assist radius are enforced', () => {
    assert.equal(choose([enemy(0, -3001), enemy(0, 100), enemy(281)]), null);
    const boundary = enemy(840, -3000);
    // Radial range includes the sideways displacement.
    assert.equal(choose([boundary]), null);
    const distant = enemy(0, -3000);
    assert.equal(choose([distant]), distant);
    const edge = enemy(280);
    assert.equal(choose([edge]), edge);
    assert.equal(choose([enemy(281)]), null);
    assert.notEqual(choose([enemy(281)], null, { radius: 200 }), null);
    assert.equal(choose([enemy(1001)], null, { radius: 1000 }), null);
});
