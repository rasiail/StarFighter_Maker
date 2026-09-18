import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_BASE_STATS } from '../src/config/player-stats.js';
import { createPlayerFlight, replenishPlayerForSortie } from '../src/player/state.js';
import { getStage } from '../src/config/stages.js';

test('서로 다른 기체가 스탯과 재장전 타이머를 공유하지 않는다', () => {
    const first = createPlayerFlight({ x: 0, y: 0, z: -1 });
    const second = createPlayerFlight({ x: 0, y: 0, z: -1 });
    first.maxHealth = 200;
    first.stdReloadTimers.push(1.1);
    assert.equal(second.maxHealth, 100);
    assert.deepEqual(second.stdReloadTimers, []);
    assert.equal(PLAYER_BASE_STATS.maxHealth, 100);
});

test('추가 스탯을 반영한 생성/재출격이 기본값으로 강제 복귀하지 않는다', () => {
    const flight = createPlayerFlight({}, { maxHealth: 150, stdMaxBursts: 3, cruiseSpeed: 600 });
    assert.equal(flight.health, 150);
    assert.equal(flight.speed, 600);
    flight.health = 4;
    flight.stdBursts = 0;
    flight.stdReloadTimers.push(2);
    flight.multiReloadTimers.push(1);
    flight.score = 3500;
    replenishPlayerForSortie(flight);
    assert.equal(flight.health, 150);
    assert.equal('missileCount' in flight, false);
    assert.equal(flight.stdBursts, 3);
    assert.deepEqual(flight.stdReloadTimers, []);
    assert.deepEqual(flight.multiReloadTimers, []);
    assert.equal(flight.score, 3500);
    assert.equal(flight.maxSpeed, PLAYER_BASE_STATS.maxSpeed);
});

test('알 수 없는 스테이지는 출격 전에 거부한다', () => {
    assert.throws(() => getStage(0), RangeError);
    assert.throws(() => getStage(4), RangeError);
});
