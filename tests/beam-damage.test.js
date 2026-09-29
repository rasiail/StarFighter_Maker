import test from 'node:test';
import assert from 'node:assert/strict';
import { BEAM_RANGE, BEAM_PULSE_DAMAGE, BEAM_HOLD_DPS, beamHoldDamage } from '../src/combat/beam-energy.js';
import { BALANCE } from '../src/data/generated/balance.js';

test('beam range is 3000 m and both firing modes gain 50 percent base damage', () => {
    assert.equal(BEAM_RANGE, 3000);
    assert.equal(BEAM_PULSE_DAMAGE, Math.round(BALANCE.weapons.standard_missile.damage * 1.2) * 1.5);
    assert.equal(BEAM_HOLD_DPS, 150);
});

test('continuous contact ramps DPS and caps at 450 DPS after four seconds', () => {
    const contact = { target: null, seconds: 0 }, target = {};
    assert.equal(beamHoldDamage(contact, target, 1), 187.5);
    assert.equal(beamHoldDamage(contact, target, 1), 262.5);
    assert.equal(beamHoldDamage(contact, target, 2), 750);
    assert.equal(beamHoldDamage(contact, target, 1), 450);
    assert.equal(beamHoldDamage(contact, target, 10), 4500);
});

test('damage is frame-rate independent even across the ramp cap', () => {
    const target = {};
    const single = beamHoldDamage({ target: null, seconds: 0 }, target, 6);
    for (const fps of [30, 60, 144]) {
        const contact = { target: null, seconds: 0 };
        let total = 0;
        for (let frame = 0; frame < 6 * fps; frame++) total += beamHoldDamage(contact, target, 1 / fps);
        assert.ok(Math.abs(total - single) < 1e-8);
    }
});

test('missing, releasing, and changing targets reset the contact bonus', () => {
    const contact = { target: null, seconds: 0 }, target = {}, other = {};
    beamHoldDamage(contact, target, 4);
    assert.equal(beamHoldDamage(contact, other, 1), 187.5);
    assert.equal(beamHoldDamage(contact, null, 0), 0);
    assert.equal(contact.seconds, 0);
    assert.equal(beamHoldDamage(contact, other, 1), 187.5);
});
