import { getStage } from './stages.js';

const sectorDefinitions = [
    {
        id: 1,
        name: 'FRONTIER BREAKTHROUGH',
        title: '국경 돌파 작전구역',
        theme: 'FRONTLINE',
        description: '사막 접근로, 해상 회랑, 수도 방공권을 차례로 돌파하는 3단계 작전입니다.',
        stageIds: [1, 2, 3],
    },
];

export const SECTORS = Object.freeze(sectorDefinitions.map(sector => Object.freeze({
    ...sector,
    stageIds: Object.freeze([...sector.stageIds]),
})));

export function getSector(id) {
    const sector = SECTORS.find(sector => sector.id === id);
    if (!sector) throw new RangeError(`Unknown sector: ${id}`);
    return sector;
}

export function getSectorStages(sectorOrId) {
    const sector = typeof sectorOrId === 'number' ? getSector(sectorOrId) : sectorOrId;
    return sector.stageIds.map(getStage);
}

export function findSectorByStage(stageId) {
    return SECTORS.find(sector => sector.stageIds.includes(stageId)) ?? null;
}

export function getSectorStageRoute(sectorOrId, stageIndex) {
    const sector = typeof sectorOrId === 'number' ? getSector(sectorOrId) : sectorOrId;
    if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= sector.stageIds.length) {
        throw new RangeError(`Unknown stage index ${stageIndex} for sector ${sector.id}`);
    }
    const nextStageId = sector.stageIds[stageIndex + 1] ?? null;
    return Object.freeze({
        sectorId: sector.id,
        stageIndex,
        stageId: sector.stageIds[stageIndex],
        stageCount: sector.stageIds.length,
        nextStageId,
        isFinal: nextStageId === null,
    });
}
