import test from 'node:test';
import assert from 'node:assert/strict';
import { beamBoltIntersection, BEAM_BOLT } from '../src/combat/beam-bolt.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const origin = { x: 0, y: 0, z: 0 }, forward = { x: 0, y: 0, z: -1 };
test('a rifle bolt does not hit a distant enemy instantly, but sweeps across it during travel', () => {
    const target = { x: 0, y: 0, z: -300 };
    assert.equal(beamBoltIntersection(origin, forward, target, 15, BEAM_BOLT.length), null);
    assert.equal(beamBoltIntersection(origin, forward, target, 15, 400), 285);
});
test('sweep rejects off-axis, behind and out-of-range enemies', () => {
    assert.equal(beamBoltIntersection(origin, forward, { x: 30, y: 0, z: -100 }, 15, 300), null);
    assert.equal(beamBoltIntersection(origin, forward, { x: 0, y: 0, z: 100 }, 15, 300), null);
    assert.equal(beamBoltIntersection(origin, forward, { x: 0, y: 0, z: -1900 }, 15, BEAM_BOLT.range), null);
    assert.equal(beamBoltIntersection(origin, forward, origin, 15, 300), 0);
});
test('nearest hit ordering is independent of enemy array order', () => {
    const entries = [600, 100, 300].map(z => beamBoltIntersection(origin, forward, { x: 0, y: 0, z: -z }, 15, 800));
    assert.equal(Math.min(...entries), 85);
});

test('runtime spawns a finite bolt, damages only the first enemy on arrival, and clears expired bolts', () => {
    class Vector {
        constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
        copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }
        clone() { return new Vector(this.x, this.y, this.z); }
        addScaledVector(v, n) { this.x += v.x * n; this.y += v.y * n; this.z += v.z * n; return this; }
        applyQuaternion() { return this; }
    }
    class Mesh {
        constructor() {
            this.position = new Vector(); this.children = [];
            this.quaternion = { copy() {} }; this.scale = { set() {} };
        }
        add(...children) { this.children.push(...children); }
    }
    const objects = new Set();
    const enemy = z => ({ alive: true, health: 100, mesh: { position: new Vector(0, 0, z) } });
    const near = enemy(-300), far = enemy(-600);
    const context = vm.createContext({
        THREE: { Vector3: Vector, Group: Mesh, Mesh,
            CylinderGeometry: class { rotateX() {} }, MeshBasicMaterial: class {} },
        scene: { add: mesh => objects.add(mesh), remove: mesh => objects.delete(mesh) },
        enemies: [far, near], triggerExplosion() {}, killEnemy: enemy => { enemy.alive = false; },
    });
    const source = readFileSync(new URL('../src/combat/beam-bolt.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '');
    vm.runInContext(source, context);
    const ship = { position: new Vector(), quaternion: {} };
    context.spawnBeamBolt(ship, 35);
    assert.equal(objects.size, 1);
    assert.equal(near.health, 100, 'launch does not apply hitscan damage');
    const visual = [...objects][0];
    assert.equal(visual.position.z, -14);
    ship.position.z = 1000;
    context.updateBeamBolts(0.05);
    assert.equal(visual.position.z, -104, 'bolt travels independently of the shooter');
    assert.equal(near.health, 100);
    context.updateBeamBolts(0.3);
    assert.equal(near.health, 65);
    assert.equal(far.health, 100);
    assert.equal(objects.size, 0);
    context.updateBeamBolts(1);
    assert.equal(near.health, 65, 'each bolt deals damage once');
    context.enemies.length = 0;
    context.spawnBeamBolt(ship, 35);
    context.updateBeamBolts(2);
    assert.equal(objects.size, 0, 'missed bolt expires at range');
    context.spawnBeamBolt(ship, 35);
    context.clearBeamBolts();
    assert.equal(objects.size, 0);
});
