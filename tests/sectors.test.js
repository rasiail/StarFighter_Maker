import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTORS, findSectorByStage, getSector, getSectorStages, getSectorStageRoute } from '../src/config/sectors.js';

test('대표 섹터는 세 스테이지를 순서대로 묶고 각 스테이지에 보스전이 있다', () => {
    assert.equal(SECTORS.length, 1);
    const sector = getSector(1);
    assert.deepEqual([...sector.stageIds], [1, 2, 3]);
    const stages = getSectorStages(sector);
    assert.equal(stages.length, 3);
    assert.deepEqual(stages.map(stage => stage.waves.length), [3, 4, 5]);
    assert.ok(stages.every(stage => stage.bossName && stage.bossHealth > 0));
    assert.equal(findSectorByStage(2), sector);
});

test('첫 두 스테이지는 다음 스테이지로 이어지고 마지막 스테이지는 섹터를 끝낸다', () => {
    assert.deepEqual(getSectorStageRoute(1, 0), { sectorId: 1, stageIndex: 0, stageId: 1, stageCount: 3, nextStageId: 2, isFinal: false });
    assert.deepEqual(getSectorStageRoute(1, 1), { sectorId: 1, stageIndex: 1, stageId: 2, stageCount: 3, nextStageId: 3, isFinal: false });
    assert.deepEqual(getSectorStageRoute(1, 2), { sectorId: 1, stageIndex: 2, stageId: 3, stageCount: 3, nextStageId: null, isFinal: true });
    assert.throws(() => getSectorStageRoute(1, 3), RangeError);
});
