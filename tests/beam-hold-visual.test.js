import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as energy from '../src/combat/beam-energy.js';

test('hold beam follows the ship, hits immediately, and disappears on release or exhaustion', () => {
    class Vector {
        constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
        copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }
        clone() { return new Vector().copy(this); }
        sub(v) { return this.addScaledVector(v, -1); }
        addScaledVector(v, n) { this.x += v.x * n; this.y += v.y * n; this.z += v.z * n; return this; }
        applyQuaternion(q) { return q.forward ? this.copy(q.forward) : this; }
        dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
        lengthSq() { return this.dot(this); }
        normalize() { const length = Math.sqrt(this.lengthSq()); if (length) { this.x /= length; this.y /= length; this.z /= length; } return this; }
        lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t; return this; }
    }
    let visual, pulseDirection;
    let pulseSounds = 0, holdSound = false;
    class Mesh {
        constructor() {
            this.position = new Vector(); this.scale = { set() {} };
            this.quaternion = { setFromUnitVectors: (_, direction) => { this.direction = direction.clone(); } };
        }
    }
    const ship = { position: new Vector(), quaternion: {} };
    const enemy = { alive: true, health: 1000, mesh: { position: new Vector(0, 0, -300) } };
    const c = vm.createContext({ ...energy, audio: { playBeamPulse() { pulseSounds++; }, setBeamHold() { holdSound = true; }, stopBeamHold() { holdSound = false; } },
        THREE: { Vector3: Vector, Mesh, CylinderGeometry: class { rotateX() {} }, MeshBasicMaterial: class {} },
        scene: { add: mesh => { visual = mesh; } }, playerMesh: ship,
        playerFlight: { beamEnergy: 100, damageMultiplier: 1 }, enemies: [enemy],
        gameState: { missileMode: 3, ownedWeapons: [3] },
        document: { getElementById: () => null }, spawnBeamBolt(_source, _damage, _width, direction) { pulseDirection = direction; }, killEnemy() {},
    });
    c.getBeamAssistTarget = () => c.gameState.isGunAimOnTarget ? enemy : null;
    vm.runInContext(readFileSync(new URL('../src/combat/beam.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replaceAll('export function', 'function'), c);
    c.pulseBeam(); c.updateBeam(0.28, true);
    assert.ok(enemy.health < 1000, 'damage has no travel delay');
    assert.equal(visual.visible, true);
    assert.equal(holdSound, true);
    ship.position.x = 100;
    ship.quaternion.forward = new Vector(1, 0, 0);
    c.updateBeam(0.016, true);
    assert.equal(visual.position.x, 1600, 'beam center follows the new origin and heading');
    assert.equal(visual.position.z, 0);
    c.updateBeam(0.016, false);
    assert.equal(visual.visible, false, 'no lingering world-space visual');
    assert.equal(holdSound, false);
    assert.equal(pulseSounds, 1);
    c.updateBeam(1, false); c.pulseBeam(); c.updateBeam(0.28, true);
    assert.equal(visual.visible, true);
    c.playerFlight.beamEnergy = 0.1;
    c.updateBeam(0.016, true);
    assert.equal(visual.visible, false, 'exhaustion hides the beam in the same frame');
    assert.ok(c.playerFlight.beamOverload > 0);
    assert.equal(holdSound, false, 'exhaustion stops the hold sound');
    c.playerFlight.beamEnergy = 100; c.playerFlight.beamOverload = 0;
    c.playerFlight.beamReloadRemaining = 0; c.playerFlight.beamCooldown = 0;
    c.gameState.lockedEnemyIndex = 0;
    c.gameState.isGunAimOnTarget = true; c.gameState.isSmartGunEnabled = true;
    c.pulseBeam();
    const expected = enemy.mesh.position.clone().sub(ship.position).normalize();
    assert.ok(pulseDirection.clone().sub(expected).lengthSq() < 1e-20, 'single shot uses the hold beam target correction');
    c.playerFlight.beamCooldown = 0;
    c.gameState.isGunAimOnTarget = false;
    c.pulseBeam();
    assert.deepEqual(pulseDirection, ship.quaternion.forward, 'outside auto aim range the shot follows the nose');
    ship.position.x = 0; ship.quaternion.forward = new Vector(0, 0, -1);
    enemy.mesh.position.z = -2900;
    c.playerFlight.beamCooldown = 0;
    c.pulseBeam();
    const health = enemy.health;
    c.updateBeam(0.28, true);
    assert.ok(enemy.health < health, 'hold damage reaches 2900 m');
    enemy.mesh.position.z = -3100;
    const outsideHealth = enemy.health;
    c.updateBeam(0.1, true);
    assert.equal(enemy.health, outsideHealth, 'hold damage stops at 3000 m');
    c.gameState.isGunAimOnTarget = true;
    c.playerFlight.beamCooldown = 0;
    enemy.mesh.position.x = 100;
    c.pulseBeam();
    assert.deepEqual(pulseDirection, ship.quaternion.forward, 'stale HUD alignment cannot assist beyond 3000 m');
});
