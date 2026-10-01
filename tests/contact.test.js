import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactTracker, sweptContact } from '../src/combat/contact.js';
import { ENEMY_SIZE_MULTIPLIER } from '../src/enemies/size.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const p = (x, y = 0, z = 0) => ({ x, y, z });
const enemy = (options = {}) => ({ alive: true, health: 100, hitRadius: 14, mesh: { position: p(0) }, ...options });

test('swept contact catches crossing aircraft and ignores near misses', () => {
    assert.equal(ENEMY_SIZE_MULTIPLIER, 1.4);
    assert.ok(sweptContact(p(-100), p(100), p(100), p(-100), 20));
    assert.ok(!sweptContact(p(-100, 21), p(100, 21), p(0), p(0), 20));
    assert.ok(sweptContact(p(20), p(20), p(0), p(0), 20));
});

test('collision damages both sides, throttles sustained contact and resets per battle', () => {
    const tracker = createContactTracker(), target = enemy(), flight = { health: 100 };
    let hits = 0;
    const step = delta => { tracker.capture(p(0), [target]); tracker.update(delta, p(0), flight, [target], () => hits++, () => {}); };
    step(1 / 60);
    assert.equal(flight.health, 80); assert.equal(target.health, 60);
    for (let i = 0; i < 59; i++) step(1 / 60);
    assert.equal(hits, 1);
    step(1 / 60); assert.equal(hits, 2);
    tracker.reset(); step(1 / 60); assert.equal(hits, 3);
});

test('dead targets and ship turrets cannot inflict duplicate ram damage', () => {
    const tracker = createContactTracker();
    const targets = [enemy({alive:false}), enemy({isDying:true}), enemy({isSinking:true}), enemy({shipPart:'TURRET'}), enemy({health:20})];
    const flight = {health:10}, killed = [], damage = [];
    tracker.capture(p(-100), targets);
    tracker.update(0.08, p(100), flight, targets, (_e, d) => damage.push(d), e => killed.push(e));
    assert.equal(flight.health, 0); assert.equal(targets.at(-1).health, 0);
    assert.deepEqual(damage, [10]); assert.deepEqual(killed, [targets.at(-1)]);
    tracker.capture(p(0), targets);
    tracker.update(2, p(0), flight, targets, () => assert.fail('dead player hit'), () => {});
});

test('newly spawned enemies are checked only after a movement snapshot', () => {
    const tracker = createContactTracker(), flight = {health:100};
    tracker.capture(p(0), []);
    tracker.update(0.08, p(0), flight, [enemy()], () => assert.fail(), () => {});
    assert.equal(flight.health,100);
});

test('runtime collision emits hit and death events and routes enemy kills through lifecycle', () => {
    const target = enemy({health:20}), events = [], kills = [];
    const context = vm.createContext({
        createContactTracker, enemies:[target], killEnemy:e => kills.push(e),
        playerMesh:{position:p(0)}, playerFlight:{health:20},
        gameState:{isGameRunning:true,isGamePaused:false,isPlayerDead:false},
        gameEvents:{emit:(event,payload)=>events.push({event,payload})},
        EVENTS:{PLAYER_HIT:'hit',PLAYER_DESTROYED:'dead'}, triggerExplosion:()=>{}, audio:undefined,
    });
    const source = readFileSync(new URL('../src/combat/collisions.js', import.meta.url),'utf8')
        .replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');
    vm.runInContext(source,context);
    context.capturePlayerContacts(); context.updatePlayerContacts(0.08);
    assert.equal(events[0].event,'hit'); assert.equal(events[0].payload.damage,20);
    assert.equal(events[1].event,'dead'); assert.deepEqual(kills,[target]);
    context.playerFlight.health=100; target.health=100;
    context.resetPlayerContacts(); context.gameState.isGamePaused=true;
    context.capturePlayerContacts(); context.updatePlayerContacts(0.08);
    assert.equal(context.playerFlight.health,100);
});
