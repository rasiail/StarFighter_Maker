import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerFlight } from '../src/player/state.js';
import { consumeMagazine, tickMagazines } from '../src/combat/magazine.js';

test('표준 20발은 소진 후 10초에 전체 충전된다', () => {
    const flight = createPlayerFlight({});
    assert.equal(flight.stdBursts, 20);
    assert.equal(consumeMagazine(flight, 'std', 4), 1);
    tickMagazines(flight, 30);
    assert.equal(flight.stdBursts, 19);
    for (let i=0;i<19;i++) assert.equal(consumeMagazine(flight,'std',1),1);
    assert.deepEqual(flight.stdReloadTimers,[10]);
    tickMagazines(flight,9.9);
    assert.equal(consumeMagazine(flight,'std',1),0);
    tickMagazines(flight,0.11);
    assert.equal(flight.stdBursts,20);
});

test('멀티는 최대 4발, 총 16발 소진 후 20초에 전체 충전된다', () => {
    const flight = createPlayerFlight({});
    for(let i=0;i<4;i++) assert.equal(consumeMagazine(flight,'multi',10),4);
    assert.equal(flight.multiBursts,0);
    assert.deepEqual(flight.multiReloadTimers,[20]);
    assert.equal(consumeMagazine(flight,'std',1),1);
    tickMagazines(flight,19);
    assert.equal(flight.multiBursts,0);
    tickMagazines(flight,1);
    assert.equal(flight.multiBursts,16);
    assert.equal(consumeMagazine(flight,'multi',3),3);
    for(let i=0;i<3;i++) consumeMagazine(flight,'multi',4);
    assert.equal(consumeMagazine(flight,'multi',4),1);
    assert.deepEqual(flight.multiReloadTimers,[20]);
});
