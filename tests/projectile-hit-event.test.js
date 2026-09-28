import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createEventBus, EVENTS } from '../src/core/events.js';

test('enemy cannon and missile impacts emit one hit event each with actual damage', () => {
    class Vector {
        constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
        addScaledVector(v, n) { this.x += v.x * n; this.y += v.y * n; this.z += v.z * n; return this; }
        distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    }
    const events = createEventBus(), hits = [];
    events.on(EVENTS.PLAYER_HIT, event => hits.push(event.damage));
    const playerMesh = { position: new Vector() };
    const bullets = [{ isPlayer: false, position: new Vector(), velocity: new Vector(), damage: 4, life: 1 }];
    const missiles = [{ isPlayer: false, mesh: { position: new Vector(), quaternion: { setFromUnitVectors() {} } },
        target: { mesh: playerMesh }, direction: new Vector(0, 0, -1), damage: 14, life: 1 }];
    const context = vm.createContext({ bullets, missiles, enemies: [], particles: [],
        playerMesh, playerFlight: { health: 100 }, gameEvents: events, EVENTS, THREE: { Vector3: Vector },
        updateBeamBolts() {}, advanceHomingMissile() {}, createSmokePuff() {}, triggerExplosion() {},
        scene: { remove() {} } });
    const source = readFileSync(new URL('../src/combat/projectiles.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function');
    vm.runInContext(source, context);
    context.updateProjectiles(1 / 60);
    assert.deepEqual(hits, [4, 14]);
    assert.equal(context.playerFlight.health, 82);
    context.updateProjectiles(1 / 60);
    assert.deepEqual(hits, [4, 14], 'removed projectiles cannot retrigger camera shake');
});
