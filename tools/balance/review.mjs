import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { BALANCE } from '../../src/data/generated/balance.js';
import { simulateMany, compareStrategies, DEFAULT_ASSUMPTIONS, weaponPerformance } from '../../src/balance/simulator.js';
import { calculateStats, createProgression } from '../../src/progression/model.js';
import { CARDS } from '../../src/progression/cards.js';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, ...value] = arg.replace(/^--/, '').split('=');
    return [key, value.join('=')];
}));
const targetMinutes = Number(args['target-minutes'] ?? 20);
const runs = Number(args.runs ?? 100);
const searchRuns = Number(args['search-runs'] ?? Math.min(runs, 100));
const seed = Number(args.seed ?? 104);
const multiRatioLimit = Number(args['multi-ratio-limit'] ?? 1.2);
if (![targetMinutes, runs, searchRuns, multiRatioLimit].every(v => Number.isFinite(v) && v > 0) || !Number.isInteger(runs) || !Number.isInteger(searchRuns) || runs > 5000 || searchRuns > 5000 || !Number.isFinite(seed)) throw new Error('Invalid target, runs, search runs, seed or ratio limit');
const reloadScales = (args['reload-scales'] ?? '1,1.25,1.5,1.75,2,2.5,3').split(',').map(Number);
const enemyScales = (args['enemy-scales'] ?? '0.65,0.7,0.75,0.8,0.85,0.9,0.95,1').split(',').map(Number);
if (![...reloadScales, ...enemyScales].every(v => Number.isFinite(v) && v > 0)) throw new Error('Scale lists must contain positive numbers');
const assumptions = { ...DEFAULT_ASSUMPTIONS, runs, seed };
const summarize = result => ({ minutes: result.averageSeconds / 60, p10Minutes: result.p10Seconds / 60, p90Minutes: result.p90Seconds / 60, level: result.averageFinalLevel, selections: result.averageSelections, targets: result.timeline.at(-1).cumulativeTargets });
const baseline = simulateMany(assumptions);
const candidates = [];
for (const multiReloadScale of reloadScales) {
    for (const enemyCountScale of enemyScales) {
        const options = { ...assumptions, runs: searchRuns, multiReloadScale, enemyCountScale };
        const result = simulateMany(options);
        // Equal usage shares isolate sustained weapon capacity from the user's preferred mode.
        const perf = weaponPerformance(calculateStats(createProgression()), { ...options, standardMissileShare: 1, multiMissileShare: 1 });
        const multiToStandardRatio = perf.multiMissile.sustainedDps / perf.standardMissile.sustainedDps;
        const errorMinutes = Math.abs(result.averageSeconds / 60 - targetMinutes);
        candidates.push({ multiReloadScale, enemyCountScale, reloadSeconds: BALANCE.weapons.multi_missile.reloadSec * multiReloadScale, ...summarize(result), multiToStandardRatio, errorMinutes,
            waves: BALANCE.stages.map(stage => ({ stageId: stage.stageId, targets: stage.waves.map(n => Math.max(1, Math.round(n * enemyCountScale))) })) });
    }
}
candidates.sort((a,b) => a.errorMinutes - b.errorMinutes || a.multiReloadScale - b.multiReloadScale);
const eligible = candidates.filter(row => row.multiToStandardRatio <= multiRatioLimit);
const recommended = eligible[0] ?? null;
const selected = recommended ?? candidates[0];
const selectedOptions = { ...assumptions, enemyCountScale: selected.enemyCountScale, multiReloadScale: selected.multiReloadScale };
const selectedResult = simulateMany(selectedOptions);
const strategies = Object.fromEntries(Object.entries(compareStrategies(selectedOptions)).map(([key,result]) => [key,summarize(result)]));
const sensitivity = [0.75, 1, 1.25].map(scale => ({ engagementScale: scale, ...summarize(simulateMany({ ...selectedOptions, engagementSecondsPerTarget: assumptions.engagementSecondsPerTarget * scale })) }));
const cardEffects = CARDS.map(card => {
    const build = createProgression();
    Object.assign(build.ranks, card.requires ?? {});
    const before = weaponPerformance(calculateStats(build), selectedOptions).totalDps;
    (card.stat ? build.ranks : build.cards)[card.id] = 1;
    const after = weaponPerformance(calculateStats(build), selectedOptions).totalDps;
    return { id: card.id, name: card.name, prerequisites: card.requires ?? {}, firstRankDpsPercent: (after / before - 1) * 100,
        coverage: ['power','warhead','reload','standardRack','multiRack','multiSalvo'].includes(card.id) ? '직접 화력 또는 발사 주기 효과' : '이 표의 지속 DPS 밖의 효과; 이벤트 모델의 런 시간에는 일부 반영' };
});
const report = { modelVersion: 3, dataSha256: createHash('sha256').update(JSON.stringify(BALANCE)).digest('hex'), targetMinutes, searchRuns, validationRuns: runs, multiRatioLimit, assumptions, baseline: summarize(baseline), recommended, closestTimeCandidate: candidates[0], candidates, strategies, sensitivity, cardEffects,
    selectedTimeline: selectedResult.timeline,
    averageCombat: selectedResult.averageCombat,
    limitations: ['완주 조건부 예상 시간이며 피격·사망률은 계산하지 않음', '표적 접근 시간과 기동·속도·유도·안정성 보정은 실측 전 가정', '실제 3차원 비행 경로와 적 공격 예산 생략', '생존 카드 효용과 실제 멀티 조작 편의성은 충분히 평가하지 못함', '비율 제한은 초기 무강화 지속 DPS 기준이며 설계자가 정한 목표; 보편적인 정답 아님', '백분위는 적 구성·명중·카드 추첨 변동만 포함; 모델 오차 범위가 아님', '원본 XLSX는 수정하지 않음'] };
const row = c => `| ${c.reloadSeconds.toFixed(2)} | ${c.waves.map(s=>s.targets.join('/')).join(' · ')} | ${c.minutes.toFixed(2)} | ${c.level.toFixed(1)} | ${c.selections.toFixed(1)} | ${c.multiToStandardRatio.toFixed(2)} |`;
const combat = report.averageCombat;
const markdown = `# 목표 기반 밸런스 검토\n\n목표: 평균 ${targetMinutes}분. ${candidates.length}개 후보는 각 ${searchRuns}회로 탐색하고, 현재값·선택안·전략 비교는 각 ${runs}회로 검증했습니다. 데이터 SHA-256: ${report.dataSha256}\n\n## 현재와 후보\n\n현재: ${report.baseline.minutes.toFixed(2)}분, Lv.${report.baseline.level.toFixed(1)}, 카드 ${report.baseline.selections.toFixed(1)}회.\n\n${recommended ? `초기 멀티/표준 지속 DPS 비율 ${multiRatioLimit} 이하라는 임시 설계 조건을 만족하는 후보 중 목표 시간에 가장 가까운 값입니다.` : '지정한 무기 비율 조건을 만족하는 후보가 없습니다. 아래는 시간만 가장 가까운 후보이며 추천 확정값이 아닙니다.'}\n\n| 멀티 기본 장전(초) | 스테이지별 웨이브 목표 | 평균(분) | 종료 레벨 | 카드 선택 | 멀티/표준 DPS |\n|---|---|---|---|---|---|\n${row(selected)}\n\n수정 위치: weapons.xlsx의 multi_missile reload_sec, waves_enemies.xlsx의 웨이브 목표. 적 감소는 경험치와 카드 횟수도 줄이므로 성장 결과를 함께 비교해야 합니다.\n\n## 시간에 가까운 상위 후보\n\n| 멀티 기본 장전(초) | 스테이지별 웨이브 목표 | 평균(분) | 종료 레벨 | 카드 선택 | 멀티/표준 DPS |\n|---|---|---|---|---|---|\n${candidates.slice(0,8).map(row).join('\n')}\n\n## 선택 후보의 카드 전략 비교\n\n${Object.entries(strategies).map(([k,v])=>`- ${k}: ${v.minutes.toFixed(2)}분, Lv.${v.level.toFixed(1)}, 카드 ${v.selections.toFixed(1)}회`).join('\n')}\n\n생존 전략은 피격과 사망을 모델링하지 않으므로 시간만으로 열등하다고 판정할 수 없습니다.\n\n## 선택 후보의 평균 전투 이벤트\n\n- 기관포 ${combat.cannonShots.toFixed(1)}발, 표준 미사일 ${combat.standardShots.toFixed(1)}발, 멀티 미사일 ${combat.multiShots.toFixed(1)}발\n- 표준 전체 재장전 ${combat.standardReloads.toFixed(1)}회, 멀티 전체 재장전 ${combat.multiReloads.toFixed(1)}회, 무기 전환 ${combat.switches.toFixed(1)}회\n- 전투 ${combat.combatSeconds.toFixed(1)}초, 표적 접근 ${combat.travelSeconds.toFixed(1)}초, 과잉 피해 ${combat.overkill.toFixed(1)}, 전함 연쇄 격파 ${combat.collateralKills.toFixed(1)}기\n\n## 기동 시간 가정 민감도\n\n${sensitivity.map(v=>`- 표적당 탐색 시간 ${v.engagementScale}배: ${v.minutes.toFixed(2)}분`).join('\n')}\n\n## 카드 1단계 직접 화력 영향\n\n해금 전제만 충족한 초기 빌드에서 카드 1단계를 추가한 효과입니다. 실제 획득 시점과 최대 성장 효율은 다를 수 있습니다.\n\n${cardEffects.map(c=>`- ${c.name}: DPS ${c.firstRankDpsPercent.toFixed(1)}% 변화. ${c.coverage}`).join('\n')}\n\n## 해석 범위\n\n${report.limitations.map(v=>`- ${v}`).join('\n')}\n`;
const output = resolve(args.out ?? 'balance/reports/latest');
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, 'review.json'), JSON.stringify(report,null,2)+'\n');
writeFileSync(resolve(output, 'review.md'), markdown);
console.log(markdown);
console.log(`\nReports: ${output}`);
