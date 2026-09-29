import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerFlight } from '../src/player/state.js';
import { consumeMagazine, tickMagazines } from '../src/combat/magazine.js';

test('표준 미사일은 유휴 중 재장전 부채를 회복하고 소진 후 전체 충전된다', () => {
    const flight = createPlayerFlight({});
    assert.equal(flight.stdBursts, 20);
    assert.equal(consumeMagazine(flight, 'std', 4), 1);
    tickMagazines(flight, 30);
    assert.equal(flight.stdBursts, 19);
    for (let i=0;i<19;i++) assert.equal(consumeMagazine(flight,'std',1),1);
    assert.ok(Math.abs(flight.stdReloadTimers[0]-14.49975)<1e-9);
    tickMagazines(flight,14.4);
    assert.equal(consumeMagazine(flight,'std',1),0);
    tickMagazines(flight,0.11);
    assert.equal(flight.stdBursts,20);
});

test('멀티는 최대 4발, 총 8발 소진 후 30초에 전체 충전된다', () => {
    const flight = createPlayerFlight({});
    for(let i=0;i<2;i++) assert.equal(consumeMagazine(flight,'multi',10),4);
    assert.equal(flight.multiBursts,0);
    assert.deepEqual(flight.multiReloadTimers,[30]);
    assert.equal(consumeMagazine(flight,'std',1),1);
    tickMagazines(flight,29);
    assert.equal(flight.multiBursts,0);
    tickMagazines(flight,1);
    assert.equal(flight.multiBursts,8);
    assert.equal(consumeMagazine(flight,'multi',3),3);
    assert.equal(consumeMagazine(flight,'multi',4),4);
    assert.equal(consumeMagazine(flight,'multi',4),1);
    assert.deepEqual(flight.multiReloadTimers,[30]);
});
