import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightState, stepFlight, stepAirWeapons } from '../src/enemies/flight-model.js';

const flat = () => 0;
const nose = { x: 0, y: 0, z: -1 };

test('a target ahead remains ahead, without reverse steering or roll', () => {
    const f = createFlightState(nose), p = { x: 0, y: 800, z: 0 };
    for (let i = 0; i < 120; i++) stepFlight(f, p, { x: 0, y: 800, z: -3000 }, 200, 1 / 60, flat);
    assert.ok(p.z < -399 && Math.abs(p.x) < 0.001);
    assert.equal(f.bank, 0);
});

test('low descending aircraft climb away without circling toward a low player', () => {
    for (const dt of [1 / 120, 1 / 30, 0.08]) {
        const f = createFlightState({ x: 0, y: -0.5, z: -Math.sqrt(0.75) });
        const p = { x: 0, y: 160, z: 0 };
        for (let t = 0; t < 6; t += dt) {
            stepFlight(f, p, { x: 0, y: 50, z: 200 }, 200, dt, flat);
            assert.ok(p.y >= 60);
            assert.ok(Math.abs(f.bank) <= 0.5);
        }
        assert.ok(!f.recovering && p.y > 300);
        assert.ok(p.z < -800);
    }
});

test('ridge avoidance starts well before the ridge and maintains clearance', () => {
    const ridge = (_x, z) => z < -900 ? 750 : 0;
    const f = createFlightState(nose), p = { x: 0, y: 800, z: 0 };
    const first = stepFlight(f, p, { x: 0, y: 100, z: -3000 }, 200, 1 / 60, ridge);
    assert.equal(first.state, 'RECOVER');
    for (let i = 0; i < 600; i++) {
        stepFlight(f, p, { x: 0, y: 100, z: -3000 }, 200, 1 / 60, ridge);
        assert.ok(p.y > ridge(p.x, p.z) + 150);
    }
});

test('close passes extend along a fixed heading instead of chasing a moving side point', () => {
    const f = createFlightState(nose), p = { x: 0, y: 800, z: 0 };
    for (let i = 0; i < 180; i++) {
        const r = stepFlight(f, p, { x: 50, y: 800, z: 0 }, 200, 1 / 60, flat);
        assert.equal(r.state, 'EXTEND');
        assert.equal(f.heading, 0);
    }
    assert.ok(p.z < -599);
});

test('heading seam and targets behind cannot cause roll flips; time steps agree', () => {
    const results = [];
    for (const dt of [1 / 120, 1 / 30]) {
        const f = createFlightState({ x: -0.01, y: 0, z: 1 });
        const p = { x: 0, y: 800, z: 0 };
        for (let t = 0; t < 10 - dt / 2; t += dt) {
            const bank = f.bank;
            stepFlight(f, p, { x: 1000, y: 1000, z: 4000 }, 200, dt, flat);
            assert.ok(Math.abs(f.bank - bank) <= 0.75 * dt + 1e-9);
            assert.ok(Math.abs(f.bank) <= 0.5);
        }
        results.push(p);
    }
    assert.ok(Math.hypot(results[0].x - results[1].x, results[0].z - results[1].z) < 15);
});

test('weapons require attack permission, stable lock and safe firing distances', () => {
    const e = { state: 'ENGAGE', isElite: true, fireCooldown: 0, missileCooldown: 0 };
    for (let i = 0; i < 60; i++) assert.equal(stepAirWeapons(e, 1 / 60, 1200, 1, true).missile, false);
    assert.equal(stepAirWeapons(e, 0.2, 1200, 1, true).missile, true);
    e.missileCooldown = 0;
    stepAirWeapons(e, 1, 1200, 0, true);
    assert.equal(stepAirWeapons(e, 0.2, 1200, 1, true).missile, false);
    for (const state of ['RECOVER', 'EXTEND', 'INTERCEPT']) {
        e.state = state; e.fireCooldown = 0; e.missileCooldown = 0;
        assert.deepEqual(stepAirWeapons(e, 2, 1200, 1, true), { cannon: false, missile: false });
    }
    e.state = 'ENGAGE';
    assert.deepEqual(stepAirWeapons(e, 2, 1200, 1, false), { cannon: false, missile: false });
    assert.deepEqual(stepAirWeapons(e, 2, 200, 1, true), { cannon: false, missile: false });
});

test('cannon fires short bursts with a readable recovery window', () => {
    const e = { state: 'ENGAGE', fireCooldown: 0, missileCooldown: 100 };
    const shots = [];
    for (let i = 0; i < 360; i++) {
        if (stepAirWeapons(e, 1 / 60, 1000, 1, true, () => 0).cannon) shots.push(i / 60);
    }
    assert.ok(shots.length >= 6 && shots.length <= 9);
    assert.ok(shots[3] - shots[2] >= 2.4 - 1e-9);
});
