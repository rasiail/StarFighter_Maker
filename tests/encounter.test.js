import test from 'node:test';
import assert from 'node:assert/strict';
import { getStage } from '../src/config/stages.js';
import { createEncounter, recordEncounterKill, advanceEncounter, reinforcementCount } from '../src/game/encounter.js';
import { scheduleCombat, updateCombatSchedule, clearCombatSchedule } from '../src/core/scheduler.js';

test('5개의 목표를 각각 달성해야 보스가 등장하며 보스 처치만 정비창을 연다', () => {
    const encounter = createEncounter(getStage(1));
    for (let wave = 0; wave < 5; wave++) {
        assert.equal(encounter.wave, wave);
        assert.equal(encounter.phase, 'waves');
        for (let kill = 0; kill < encounter.stage.waves[wave]; kill++) recordEncounterKill(encounter, false);
        assert.equal(encounter.transition, true);
        recordEncounterKill(encounter, false);
        assert.equal(encounter.kills, encounter.stage.waves[wave]);
        advanceEncounter(encounter);
    }
    assert.equal(encounter.phase, 'boss');
    recordEncounterKill(encounter, false);
    assert.equal(advanceEncounter(encounter), false);
    recordEncounterKill(encounter, true);
    advanceEncounter(encounter);
    assert.equal(encounter.phase, 'hangar');
});
test('증원은 동시 적 수와 웨이브 전체 목표를 초과하지 않는다', () => {
    const e = createEncounter(getStage(1));
    e.wave = 2;
    assert.equal(reinforcementCount(e, 0), 30);
    e.spawned = 30;
    assert.equal(reinforcementCount(e, 25), 5);
    e.spawned = 39;
    assert.equal(reinforcementCount(e, 20), 1);
    e.spawned = 40;
    assert.equal(reinforcementCount(e, 0), 0);
});
test('전투 예약 작업은 시뮬레이션 시간에만 진행하며 새 런에서 제거된다', () => {
    clearCombatSchedule();
    let calls = 0;
    scheduleCombat(1, () => calls++);
    updateCombatSchedule(0.5);
    assert.equal(calls, 0);
    updateCombatSchedule(0.5);
    assert.equal(calls, 1);
    scheduleCombat(1, () => calls++);
    clearCombatSchedule();
    updateCombatSchedule(2);
    assert.equal(calls, 1);
});
