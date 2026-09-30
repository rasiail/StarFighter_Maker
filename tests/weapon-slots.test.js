import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_WEAPON_SLOTS, weaponModeForSlot, weaponModesBySlot } from '../src/combat/weapon-slots.js';

test('standard missile stays on 1 and acquired weapons fill 2 through 4 in acquisition order', () => {
    const beamThenMultiThenBomb = [1, 3, 2, 4];
    assert.deepEqual(weaponModesBySlot(beamThenMultiThenBomb), [1, 3, 2, 4]);
    assert.equal(weaponModeForSlot(beamThenMultiThenBomb, 0), 1);
    assert.equal(weaponModeForSlot(beamThenMultiThenBomb, 1), 3);
    assert.equal(weaponModeForSlot(beamThenMultiThenBomb, 2), 2);
    assert.equal(weaponModeForSlot(beamThenMultiThenBomb, 3), 4);
});

test('slot order restores standard, removes duplicates and never exceeds four keys', () => {
    assert.equal(MAX_WEAPON_SLOTS, 4);
    assert.deepEqual(weaponModesBySlot([3, 4, 3, 2, 5]), [1, 3, 4, 2]);
    assert.equal(weaponModeForSlot([1, 4], 2), null);
    assert.equal(weaponModeForSlot([1, 4], 4), null);
});
