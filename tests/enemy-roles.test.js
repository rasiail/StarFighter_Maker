import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { stepAirWeapons } from '../src/enemies/flight-model.js';
import { isEliteSpawn } from '../src/enemies/formation.js';
import { selectAttackers } from '../src/enemies/attack-policy.js';
import { createWaveTargets } from '../src/balance/combat-model.js';
import { createSeededRandom } from '../src/balance/simulator.js';
import { BALANCE } from '../src/data/generated/balance.js';
import { MECHA_FISH_ASSET } from '../src/assets/aircraft.js';

test('ordinary fighters fire cannon but never missiles, even with a ready lock', () => {
    const e = { state: 'ENGAGE', fireCooldown: 0, missileCooldown: 0, missileLockTime: 10 };
    let cannon = 0;
    for (let i = 0; i < 1200; i++) {
        const shot = stepAirWeapons(e, 1 / 60, 1200, 1, true, () => 0);
        cannon += Number(shot.cannon);
        assert.equal(shot.missile, false);
    }
    assert.ok(cannon > 0);
    assert.equal(e.missileLockTime, 0);
});

test('elites and bosses can launch missiles and still respect common launch denial', () => {
    for (const role of ['isElite', 'isBoss']) {
        const e = { state: 'ENGAGE', [role]: true, missileCooldown: 0, missileLockTime: 2 };
        assert.equal(stepAirWeapons(e, 0.1, 1200, 1, true, () => 0, false).missile, false);
        assert.equal(stepAirWeapons(e, 0.1, 1200, 1, true, () => 0, true).missile, true);
    }
});

test('air spawn distribution is 30% elite and uses elite health in combat simulation', () => {
    assert.equal(Array.from({ length: 100 }, (_, i) => isEliteSpawn(i / 100)).filter(Boolean).length, 30);
    const targets = createWaveTargets(BALANCE.stages[0], 10000, createSeededRandom(104));
    const elites = targets.filter(t => t.id === 'elite');
    const air = targets.filter(t => t.id === 'elite' || t.id === 'stage_aircraft');
    assert.ok(elites.length / air.length > 0.28 && elites.length / air.length < 0.32);
    assert.ok(elites.every(t => t.health === BALANCE.enemies.elite.health));
});

test('an elite in missile range receives a slot ahead of ordinary fighters', () => {
    const normal = { alive: true, position: { x: 0, y: 0, z: 500 } };
    const elite = { alive: true, isElite: true, position: { x: 0, y: 0, z: 1500 } };
    assert.ok(selectAttackers([normal, elite], { x: 0, y: 0, z: 0 }, 1).has(elite));
    elite.position.z = 4000;
    assert.ok(selectAttackers([normal, elite], { x: 0, y: 0, z: 0 }, 1).has(normal));
});

test('boss FBX and all four PBR maps resolve to the requested Mecha_Fish asset', () => {
    assert.match(MECHA_FISH_ASSET, /Enemy\/MechaFish\/Mecha_Fish\/Mecha_Fish$/);
    for (const ext of ['.fbx', '_texture.png', '_texture_roughness.png', '_texture_metallic.png', '_texture_normal.png']) {
        assert.ok(existsSync(new URL(`../${MECHA_FISH_ASSET}${ext}`, import.meta.url)), ext);
    }
});
