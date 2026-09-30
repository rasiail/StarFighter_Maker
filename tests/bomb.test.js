import test from 'node:test';
import assert from 'node:assert/strict';

// Setup minimal globals for headless Node testing
globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
};
globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    AudioContext: class {
        createGain() { return { connect() {}, gain: { value: 1 } }; }
        createOscillator() { return { connect() {}, start() {}, stop() {} }; }
    }
};
globalThis.Audio = class {
    constructor() { this.loop = false; this.volume = 1; }
    play() {}
    pause() {}
};

// Vector3 mock for Node test environment
class Vector3Mock {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    clone() { return new Vector3Mock(this.x, this.y, this.z); }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    normalize() {
        const len = Math.hypot(this.x, this.y, this.z) || 1;
        this.x /= len; this.y /= len; this.z /= len;
        return this;
    }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
    distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    applyMatrix4() { return this; }
    applyQuaternion() { return this; }
}

globalThis.THREE = {
    Group: class {
        constructor() {
            this.children = [];
            this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
            this.position = new Vector3Mock();
            this.quaternion = { copy() {}, setFromUnitVectors() {} };
        }
        add(c) { this.children.push(c); }
        clone() {
            const g = new globalThis.THREE.Group();
            g.children = [...this.children];
            return g;
        }
    },
    CylinderGeometry: class { rotateX() {} },
    ConeGeometry: class { rotateX() {} },
    BoxGeometry: class {},
    MeshStandardMaterial: class {},
    MeshBasicMaterial: class {},
    Mesh: class {
        constructor(g, m) {
            this.geometry = g;
            this.material = m;
            this.position = new Vector3Mock();
            this.rotation = { z: 0 };
            this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
            this.quaternion = { copy() {}, setFromUnitVectors() {} };
        }
        clone() { return new globalThis.THREE.Mesh(this.geometry, this.material); }
    },
    Vector3: Vector3Mock,
    Color: class { constructor(c) { this.hex = c; } },
    SphereGeometry: class {},
    ShaderMaterial: class {
        constructor(opts) { Object.assign(this, opts); }
        dispose() {}
    },
    DoubleSide: 2,
};

import { initAudio } from '../src/audio/audio.js';
initAudio();

import {
    BOMB_WEAPON,
    createBombMesh,
    createDitherExplosion,
    updateDitherExplosions,
    clearDitherExplosions,
    activeDitherExplosions,
    detonateBomb,
    fireBomb,
} from '../src/combat/bomb.js';
import { initWeapons, missiles } from '../src/combat/weapons.js';
import { initEnemies, enemies } from '../src/enemies/fleet.js';
import { calculateStats, createProgression } from '../src/progression/model.js';

test('BOMB_WEAPON defines correct AOE weapon specs', () => {
    assert.equal(BOMB_WEAPON.weaponId, 'bomb_weapon');
    assert.equal(BOMB_WEAPON.directDamage, 80);
    assert.equal(BOMB_WEAPON.splashDamage, 150);
    assert.equal(BOMB_WEAPON.splashRadiusM, 200);
    assert.equal(BOMB_WEAPON.readySlots, 4);
    assert.equal(BOMB_WEAPON.reloadSec, 20);
    assert.equal(BOMB_WEAPON.lockRangeM, 2500);
});

test('bomb damage and radius upgrades add fifteen percent per rank', () => {
    const build = createProgression();
    build.cards.bombDamage = 1;
    build.cards.bombRadius = 1;
    const stats = calculateStats(build);
    assert.equal(stats.bombDamageMultiplier, 1.15);
    assert.equal(stats.bombRadiusMultiplier, 1.15);
    assert.equal(stats.bombReloadSeconds, 20);
});

test('createBombMesh produces a mesh scaled to 1.5x (150% larger than standard missile)', () => {
    const mesh = createBombMesh();
    assert.ok(mesh);
    assert.equal(mesh.scale.x, 1.5);
    assert.equal(mesh.scale.y, 1.5);
    assert.equal(mesh.scale.z, 1.5);
});

test('detonateBomb applies direct hit damage and splash damage with distance falloff', () => {
    initEnemies();
    const directTarget = {
        alive: true,
        health: 200,
        hitRadius: 15,
        mesh: { position: new Vector3Mock(0, 0, 0) }
    };
    const nearEnemy = {
        alive: true,
        health: 150,
        hitRadius: 15,
        mesh: { position: new Vector3Mock(50, 0, 0) }
    };
    const farEnemy = {
        alive: true,
        health: 150,
        hitRadius: 15,
        mesh: { position: new Vector3Mock(300, 0, 0) }
    };

    enemies.push(directTarget, nearEnemy, farEnemy);

    const hitPos = new Vector3Mock(0, 0, 0);
    detonateBomb(hitPos, directTarget, 80, 150, 200);

    assert.equal(directTarget.health, 120);

    // Near enemy takes splashDamage with distance falloff
    assert.ok(nearEnemy.health < 150, 'Near enemy should take splash damage');
    const expectedNearDmg = 150 * (1.0 - (50 / 215) * 0.5);
    assert.ok(Math.abs((150 - nearEnemy.health) - expectedNearDmg) < 1e-4);

    // Far enemy outside splash radius takes 0 damage
    assert.equal(farEnemy.health, 150, 'Enemy outside blast radius should be unharmed');

    // Clean up
    enemies.length = 0;
    clearDitherExplosions();
});

test('createDitherExplosion creates an expanding spherical mesh and updateDitherExplosions advances progress', () => {
    clearDitherExplosions();
    const pos = new Vector3Mock(10, 20, 30);
    const exp = createDitherExplosion(pos, 200);

    assert.ok(exp);
    assert.equal(activeDitherExplosions.length, 1);
    assert.equal(exp.maxRadius, 200);
    assert.equal(exp.age, 0);

    // Advance 0.3 seconds
    updateDitherExplosions(0.3);
    assert.equal(activeDitherExplosions.length, 1);
    assert.ok(exp.age >= 0.3);
    assert.ok(exp.material.uniforms.uProgress.value > 0);

    // Advance past duration (0.85s)
    updateDitherExplosions(0.6);
    assert.equal(activeDitherExplosions.length, 0, 'Explosion should be removed after duration');
});

test('fireBomb constructs a bomb projectile with 150% scaled mesh and isBomb flag', () => {
    initWeapons();
    const target = { alive: true, isLocked: true, mesh: { position: new Vector3Mock(0, 0, -500) } };
    const sourceMesh = {
        matrixWorld: null,
        quaternion: { copy() {} },
        position: new Vector3Mock(0, 100, 0)
    };

    const missile = fireBomb(target, true, sourceMesh);
    assert.ok(missile);
    assert.equal(missile.isBomb, true);
    assert.equal(missile.target, target);
    assert.equal(missile.damage, BOMB_WEAPON.directDamage);
    assert.equal(missile.splashDamage, BOMB_WEAPON.splashDamage);
    assert.equal(missile.splashRadius, BOMB_WEAPON.splashRadiusM);
    assert.equal(missiles.length, 1);

    // Clean up
    missiles.length = 0;
});
