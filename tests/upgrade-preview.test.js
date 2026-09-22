import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpgradePreview } from '../src/ui/upgrade-preview.js';
import { CARDS, REPAIR_CARD, selectCard } from '../src/progression/cards.js';
import { createProgression, calculateStats, applyStats } from '../src/progression/model.js';
import { createPlayerFlight } from '../src/player/state.js';
import { BALANCE } from '../src/data/generated/balance.js';

const card = id => CARDS.find(c => c.id === id);

test('every offered card has an effect description and numeric changes, without mutating the build', () => {
    const build = createProgression();
    const saved = structuredClone(build);
    for (const c of [...CARDS, REPAIR_CARD]) {
        const preview = createUpgradePreview(build, c);
        assert.ok(preview.description.length > 10, c.id);
        assert.ok(preview.changes.length > 0, c.id);
        for (const row of preview.changes) {
            assert.ok(Number.isFinite(row.before) && Number.isFinite(row.after), c.id);
            assert.match(row.value, /→/);
        }
    }
    assert.deepEqual(build, saved);
});

test('rack and reload previews match actual application to partially spent/reloading weapons', () => {
    const build = createProgression();
    build.cards.reload = 2; build.cards.standardRack = 1; build.pending = 2;
    const flight = createPlayerFlight(null, calculateStats(build));
    flight.stdBursts = 0; flight.stdReloadTimers = [5];
    for (const id of ['standardRack', 'reload']) {
        const preview = createUpgradePreview(build, card(id), flight);
        selectCard(build, id, [card(id)]); applyStats(flight, calculateStats(build));
        if (id === 'standardRack') {
            assert.equal(preview.changes[0].after, flight.stdMaxBursts);
            assert.equal(flight.stdBursts, 0);
        } else {
            assert.equal(preview.changes[0].after, flight.stdReloadSeconds);
            assert.ok(preview.changes[0].after < preview.changes[0].before);
            assert.match(preview.changes[0].difference, /^−/);
        }
    }
});

test('warhead preview includes existing power bonuses and current weapon base damage', () => {
    const build = createProgression(); build.ranks.power = 3; build.cards.warhead = 1; build.pending = 1;
    const preview = createUpgradePreview(build, card('warhead'));
    selectCard(build, 'warhead', [card('warhead')]);
    assert.equal(preview.changes[1].after, BALANCE.weapons.standard_missile.damage * calculateStats(build).damageMultiplier);
});

test('defense displays current HP recovery and repair is capped at actual max health', () => {
    const build = createProgression(), flight = createPlayerFlight();
    flight.health = 90;
    const defense = createUpgradePreview(build, card('defense'), flight);
    build.ranks.defense = 1; applyStats(flight, calculateStats(build));
    assert.equal(defense.changes[1].after, flight.health);
    const repair = createUpgradePreview(build, REPAIR_CARD, flight);
    assert.equal(repair.changes[0].after, flight.maxHealth);
    assert.equal(repair.changes[0].difference, '+10 HP');
    flight.health = flight.maxHealth;
    assert.equal(createUpgradePreview(build, REPAIR_CARD, flight).changes[0].difference, '0 HP');
});

test('new source descriptions take precedence over the fallback and max salvo stays capped', () => {
    const build = createProgression(); build.cards.multiSalvo = 1;
    const preview = createUpgradePreview(build, { ...card('multiSalvo'), description: '원본 설명' });
    assert.equal(preview.description, '원본 설명');
    assert.equal(preview.changes[0].before, 6);
    assert.equal(preview.changes[0].after, 8);
});
