import test from 'node:test';
import assert from 'node:assert/strict';
import { getStage } from '../src/config/stages.js';
import { createEncounter, recordEncounterKill, advanceEncounter, reinforcementCount } from '../src/game/encounter.js';
import { scheduleCombat, updateCombatSchedule, clearCombatSchedule } from '../src/core/scheduler.js';

test('3·4·5웨이브 완료 후 보스가 등장하며 보스 처치만 정비창을 연다', () => {
 for(const stageId of [1,2,3]) {
    const encounter = createEncounter(getStage(stageId));
    assert.equal(encounter.stage.waves.length, stageId + 2);
    for (let wave = 0; wave < encounter.stage.waves.length; wave++) {
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
 }
});
test('증원은 남은 필요 격추수의 1.5배 필드 몹 수를 유지하며 maxActive를 초과하지 않는다', () => {
    const e = createEncounter(getStage(1));
    e.wave = 0; // waves[0] = 16, maxActive = 30
    const total = e.stage.waves[e.wave];
    assert.equal(total, 16);

    // 시작 시 남은 격추수 16기 -> 목표 필드 몹 수 ceil(16 * 1.5) = 24기
    assert.equal(reinforcementCount(e, 0), 24);
    // 이미 14기가 살아있으면 10기 추가 증원
    assert.equal(reinforcementCount(e, 14), 10);
    // 이미 24기가 살아있으면 증원 없음 (0기)
    assert.equal(reinforcementCount(e, 24), 0);

    // 14기 격추 시: 남은 격추수 2기 -> 목표 필드 몹 수 ceil(2 * 1.5) = 3기
    e.kills = 14;
    assert.equal(reinforcementCount(e, 1), 2); // 1기 살아있으면 2기 리젠
    assert.equal(reinforcementCount(e, 3), 0); // 3기 채워져 있으면 리젠 없음

    // 15기 격추 시: 남은 격추수 1기 -> 목표 필드 몹 수 ceil(1 * 1.5) = 2기
    e.kills = 15;
    assert.equal(reinforcementCount(e, 0), 2);
    assert.equal(reinforcementCount(e, 1), 1);

    // 16기 목표 완료 시: transition 상태로 전이되어 증원 0
    e.kills = 16;
    e.transition = true;
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
