import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, calculateStats, applyStats } from '../src/progression/model.js';
import { createPlayerFlight } from '../src/player/state.js';
import { eligibleCards, selectCard, drawCards } from '../src/progression/cards.js';
import { spendBeamPulse, advanceBeamEnergy } from '../src/combat/beam-energy.js';
const choose = (b, id) => { b.pending++; selectCard(b, id, eligibleCards(b)); };
test('hold width scales from thirty percent to the previous base width', () => {
    const build = createProgression();
    for (const rank of [0, 1, 2, 3]) {
        build.cards.beamWidth = rank;
        const stats = calculateStats(build);
        assert.ok(Math.abs(stats.beamWidth - [0.9, 1.6, 2.3, 3][rank]) < 1e-9);
        assert.equal(stats.beamBoltWidth, 3 * (1 + rank * 0.3));
    }
});
test('reload upgrade preserves completed progress and does not refill the magazine early', () => {
    const build = createProgression();
    const flight = createPlayerFlight(null, calculateStats(build));
    flight.beamEnergy = 0; flight.beamReloadRemaining = 2.5; flight.beamOverload = 1;
    build.cards.beamRecharge = 1;
    applyStats(flight, calculateStats(build));
    assert.equal(flight.beamReloadRemaining, 2.125);
    assert.equal(flight.beamEnergy, 0);
    assert.equal(flight.beamOverload, 1);
});
test('weapons unlock once, preserve acquisition order and gate their upgrades', () => {
    for (const order of [['unlockBeam', 'unlockMulti'], ['unlockMulti', 'unlockBeam']]) {
        const b = createProgression(); b.ranks.control = 5;
        assert.deepEqual(b.weapons, [1]);
        assert.ok(!eligibleCards(b).some(c => ['multiRack', 'multiSalvo', 'beamWidth', 'beamEfficiency', 'beamRecharge'].includes(c.id)));
        for (const id of order) choose(b, id);
        assert.deepEqual(b.weapons, [1, ...order.map(id => id === 'unlockBeam' ? 3 : 2)]);
        assert.ok(!eligibleCards(b).some(c => c.weapon));
        assert.ok(eligibleCards(b).some(c => c.id === 'beamWidth'));
        assert.ok(eligibleCards(b).some(c => c.id === 'multiSalvo'));
        assert.deepEqual(createProgression().weapons, [1]);
    }
});
test('beam pulse cost, cooldown, recharge and held drain remain bounded', () => {
    const s = { energy: 100, cooldown: 0 };
    assert.equal(spendBeamPulse(s), true); assert.equal(s.energy, 88);
    assert.equal(spendBeamPulse(s), false);
    advanceBeamEnergy(s, 1, true); assert.equal(s.energy, 43);
    advanceBeamEnergy(s, 5, false); assert.equal(s.energy, 43);
    s.energy = 0; assert.equal(spendBeamPulse(s), false);
    s.primed = false;
    const duration = advanceBeamEnergy(s, 0.1, true);
    assert.equal(duration, 0); assert.equal(s.energy, 0);
});
test('beam upgrades improve width, drain and recharge without refilling energy', () => {
    const b = createProgression(); choose(b, 'unlockBeam');
    const before = calculateStats(b);
    for (const id of ['beamWidth', 'beamEfficiency', 'beamRecharge']) choose(b, id);
    const after = calculateStats(b);
    assert.ok(after.beamWidth > before.beamWidth);
    assert.ok(after.beamEfficiency < before.beamEfficiency);
    assert.ok(after.beamReloadSeconds < before.beamReloadSeconds);
});

test('weapon unlocks have ten percent higher weight while beam upgrades keep normal weight', () => {
    let seed = 104;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (const beamOwned of [false, true]) {
        const build = createProgression();
        if (beamOwned) choose(build, 'unlockBeam');
        for (const card of eligibleCards(build)) {
            if (card.weapon) assert.equal(card.weight, 110);
            else if (card.id.startsWith('beam')) assert.equal(card.weight, 100);
        }
        const ids = beamOwned ? ['unlockMulti', 'beamWidth', 'beamEfficiency', 'beamRecharge'] : ['unlockMulti', 'unlockBeam'];
        const counts = Object.fromEntries(ids.map(id => [id, 0]));
        const trials = 10000;
        for (let i = 0; i < trials; i++) {
            const offered = drawCards(build, random);
            assert.equal(new Set(offered.map(c => c.id)).size, offered.length);
            for (const card of offered) if (card.id in counts) counts[card.id]++;
            if (beamOwned) assert.ok(!offered.some(c => c.id === 'unlockBeam'));
        }
        // Check the overall offer distribution and uniqueness with both ownership states.
        for (const [id, count] of Object.entries(counts)) {
            assert.ok(count / trials > 0.18 && count / trials < 0.35, `${id}: ${count}/${trials}`);
        }
    }
});
