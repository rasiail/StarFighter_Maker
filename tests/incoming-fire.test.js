import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAttackers, canLaunchMissile } from '../src/enemies/attack-policy.js';
import { advanceHomingMissile } from '../src/combat/homing.js';
import { stepAirWeapons } from '../src/enemies/flight-model.js';
import { simulateIncomingFire } from '../src/balance/incoming-fire.js';

test('attack slots exclude dead units and hulls, cap batteries, and retain boss priority', () => {
    const make = (x, props = {}) => ({ position: { x, y: 800, z: 0 }, alive: true, ...props });
    const air = make(100), boss = make(1000, { isBoss: true });
    const ground = [1, 2, 3].map(x => make(x, { isGround: true }));
    const invalid = [make(0, { alive: false }), make(0, { isGround: true, shipPart: 'HULL' })];
    const selected = selectAttackers([...ground, ...invalid, air, boss], { x: 0, y: 800, z: 0 }, 1);
    assert.deepEqual([...selected], [boss, ground[0], ground[1]]);
});

test('blocked missiles keep their ready cooldown and lock without consuming a shot', () => {
    const e = { state: 'ENGAGE', isElite: true, fireCooldown: 5, missileCooldown: 0, missileLockTime: 2 };
    assert.equal(stepAirWeapons(e, 0.1, 1200, 1, true, () => 0, false).missile, false);
    assert.equal(e.missileCooldown, 0);
    assert.ok(e.missileLockTime >= 2);
    assert.equal(stepAirWeapons(e, 0.1, 1200, 1, true, () => 0, true).missile, true);
    assert.equal(canLaunchMissile(0, 2), false);
    assert.equal(canLaunchMissile(0.01, 0), false);
    assert.equal(canLaunchMissile(0, 1), true);
});

test('missile cannot exceed turn/speed limits, even for an antipodal target', () => {
    for (const target of [{ x: 1000, y: 0, z: 0 }, { x: 0, y: 0, z: 1000 }]) {
        const m = { position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: -1 },
            speed: 690, maxSpeed: 700, acceleration: 220, turnRate: 0.65, life: 6 };
        advanceHomingMissile(m, target, 0.1);
        assert.equal(m.speed, 700);
        assert.ok(Math.abs(Math.acos(-m.direction.z) - 0.065) < 1e-9);
        assert.ok(Math.abs(Math.hypot(m.direction.x, m.direction.y, m.direction.z) - 1) < 1e-9);
        assert.equal(m.life, 5.9);
    }
});

test('pressure simulation is reproducible and obeys the shared missile cap', () => {
    const options = { seed: 104, stageId: 3, motion: 'evade', seconds: 20 };
    const a = simulateIncomingFire(options), b = simulateIncomingFire(options);
    assert.deepEqual(a, b);
    assert.ok(a.fired.missile > 0);
    assert.ok(a.maxMissiles <= 2);
    assert.ok(a.fired.missile <= 4);
});

test('active evasion reduces damage in a fixed all-missile pressure fixture', () => {
    const weave = simulateIncomingFire({ seed: 104, motion: 'weave', legacyAllAircraftMissiles: true });
    const evade = simulateIncomingFire({ seed: 104, motion: 'evade', legacyAllAircraftMissiles: true });
    assert.ok(evade.totalDamage < weave.totalDamage);
    assert.ok(evade.hits.missile < weave.hits.missile);
});
