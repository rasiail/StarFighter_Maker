import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BALANCE } from '../../src/data/generated/balance.js';
import { calculateStats, createProgression, grantExperience } from '../../src/progression/model.js';
import { drawCards, selectCard } from '../../src/progression/cards.js';
import { enemyExperience } from '../../src/progression/rewards.js';
import { DEFAULT_ASSUMPTIONS, createSeededRandom } from '../../src/balance/simulator.js';
import { simulateCombat, createCombatInventory, resizeCombatInventory, createWaveTargets } from '../../src/balance/combat-model.js';
import { benchmarkBeam, benchmarkMissile } from '../../src/balance/weapon-audit.js';

const runs = Number(process.argv.find(a => a.startsWith('--runs='))?.split('=')[1] ?? 100);
if (!Number.isInteger(runs) || runs < 1 || runs > 5000) throw new Error('runs must be 1..5000');
const base = calculateStats(createProgression());
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
const scores = { power: 14, warhead: 13, reload: 12, multiSalvo: 11, multiRack: 10, standardRack: 9, control: 8, guidance: 8, mobility: 4, speed: 3, defense: 2, stability: 2 };

// Paired seeds separate enemy generation, card offers, and weapon hits.
// Beam is deliberately excluded here; it is measured separately, not treated as zero-DPS equipment.
function campaign(policy, seed) {
    const build = createProgression();
    if (policy === 'multi-at-start') { build.weapons.push(2); build.cards.unlockMulti = 1; }
    const enemyRng = createSeededRandom(seed), cardRng = createSeededRandom(seed + 7), hitRng = createSeededRandom(seed + 17041);
    let seconds = 0, selections = 0, multiShots = 0, unlock = null;
    for (const stage of BALANCE.stages) {
        const inventory = createCombatInventory(calculateStats(build));
        for (let wave = 0; wave <= stage.waves.length; wave++) {
            const boss = wave === stage.waves.length;
            const targets = boss ? [{ id: 'boss', health: stage.bossHealth }]
                : createWaveTargets(stage, stage.waves[wave], enemyRng);
            const assumptions = { ...DEFAULT_ASSUMPTIONS,
                multiMissileShare: build.weapons.includes(2) ? 0.65 : 0 };
            const result = simulateCombat(targets, calculateStats(build), assumptions, hitRng, inventory, boss ? 1 : stage.maxActive);
            seconds += result.seconds + (boss ? 0 : assumptions.waveTransitionSeconds);
            multiShots += result.multiShots;
            const oldStats = calculateStats(build);
            grantExperience(build, targets.reduce((sum, t) => sum + enemyExperience(t.id, stage), 0));
            while (build.pending > 0) {
                const offered = drawCards(build, cardRng);
                const score = card => {
                    if (card.id === 'unlockMulti') return policy === 'multi-card' ? 100 : -1000;
                    if (card.id === 'unlockBeam' || card.id.startsWith('beam')) return -2000;
                    return (scores[card.id] ?? 0) - ((card.stat ? build.ranks : build.cards)[card.id] ?? 0) * 0.35;
                };
                const selected = [...offered].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))[0];
                selectCard(build, selected.id, offered);
                selections++;
                if (selected.id === 'unlockMulti') unlock = { selection: selections, seconds, stage: stage.stageId, wave: wave + 1 };
            }
            resizeCombatInventory(inventory, oldStats, calculateStats(build));
        }
        seconds += DEFAULT_ASSUMPTIONS.hangarSeconds;
    }
    return { seconds, selections, multiShots, unlock };
}
const campaigns = {};
for (const policy of ['standard-only', 'multi-card', 'multi-at-start']) {
    const rows = Array.from({ length: runs }, (_, i) => campaign(policy, 104 + i * 9973));
    const acquired = rows.filter(r => r.unlock);
    campaigns[policy] = { minutes: mean(rows.map(r => r.seconds)) / 60,
        p10: percentile(rows.map(r => r.seconds), 0.1) / 60, p90: percentile(rows.map(r => r.seconds), 0.9) / 60,
        selections: mean(rows.map(r => r.selections)), multiShots: mean(rows.map(r => r.multiShots)),
        unlockRate: acquired.length / runs, unlockSelection: acquired.length ? mean(acquired.map(r => r.unlock.selection)) : null,
        unlockMinutes: acquired.length ? mean(acquired.map(r => r.unlock.seconds)) / 60 : null,
        unlockByStageOne: acquired.filter(r => r.unlock.stage === 1).length / runs };
}

const missileBenchmarks = [];
for (const targets of [1, 4, 8]) for (const mode of ['std', 'multi']) {
    missileBenchmarks.push({ mode, targets, ...benchmarkMissile(base, mode, { targets, accuracy: 0.82, seconds: 600 }) });
}
const missileUpgrades = [];
for (const [name, cards, control] of [
    ['base', {}, 0], ['salvo-1', { multiSalvo: 1 }, 2], ['salvo-2', { multiSalvo: 2 }, 2],
    ['rack-1', { multiRack: 1 }, 0], ['reload-1', { reload: 1 }, 0],
]) {
    const build = createProgression(); build.cards = cards; build.ranks.control = control;
    const stats = calculateStats(build);
    missileUpgrades.push({ name, controlPrerequisite: control, volley: stats.multiLockCount, magazine: stats.multiMaxBursts,
        openingDamage: stats.multiLockCount * BALANCE.weapons.multi_missile.damage,
        ...benchmarkMissile(stats, 'multi', { targets: 8, accuracy: 0.82, seconds: 600 }) });
}
const beamGrid = [];
for (let efficiency = 0; efficiency <= 3; efficiency++) for (let recharge = 0; recharge <= 3; recharge++) {
    const build = createProgression(); build.cards = { beamEfficiency: efficiency, beamRecharge: recharge };
    const stats = calculateStats(build);
    const drain = 45 * stats.beamEfficiency;
    beamGrid.push({ efficiency, recharge, cards: efficiency + recharge, reloadSeconds: stats.beamReloadSeconds, drain, unlimitedHold: false,
        hold: benchmarkBeam(stats), tap: benchmarkBeam(stats, { mode: 'tap' }) });
}

// Actual card draw/eligibility logic; wanted unlock always wins if offered.
const acquisition = {};
for (const wanted of ['unlockMulti', 'unlockBeam']) {
    const acquired = [];
    for (let trial = 0; trial < 10000; trial++) {
        const build = createProgression(), rng = createSeededRandom(104 + trial * 9973);
        let picked = null;
        for (let choice = 1; choice <= 14; choice++) {
            const offered = drawCards(build, rng);
            const selected = offered.find(c => c.id === wanted) ?? [...offered].sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0))[0];
            build.pending++;
            selectCard(build, selected.id, offered);
            if (selected.id === wanted) { picked = choice; break; }
        }
        acquired.push(picked);
    }
    acquisition[wanted] = { by3: acquired.filter(n => n !== null && n <= 3).length / 10000,
        by5: acquired.filter(n => n !== null && n <= 5).length / 10000,
        missingAt14: acquired.filter(n => n === null).length / 10000,
        medianChoice: percentile(acquired.filter(n => n !== null), 0.5), p90Choice: percentile(acquired.filter(n => n !== null), 0.9) };
}

const limitations = [
    '캠페인은 완주 조건부 추정: 피격·사망·실제 3D 조준·특수 적 행동을 생략합니다.',
    '캠페인은 기관포+미사일만 비교합니다. 빔 포함 캠페인 완주 시간으로 해석하면 안 됩니다.',
    '카드 선택은 웨이브 종료에 묶어 처리하므로 실제 웨이브 도중 해금보다 늦습니다.',
    '멀티 최초 지급은 카드 1회 비용도 없는 과거 방식의 가상 비교군입니다.',
    '미사일 벤치는 충분한 표적이 계속 존재하고 명중률 82%, 빔은 100% 명중 상한입니다. 실제 명중률을 곱해 비교해야 합니다.',
    '빔 피해·지연·에너지 함수는 런타임 코드를 공유합니다. 홀드는 고갈 후 버튼을 놓고 2초 과부하 및 재장전 완료를 기다린 뒤 다시 누르는 정책입니다.',
    '빔은 첫 표적 하나만 타격합니다. 빔 폭은 피해 증가가 아니라 명중 기회 증가이며 실제 조준 분포 없이 DPS 이득을 확정하지 않습니다.',
    '탭 벤치는 발사 가능 즉시 재입력하며, 정확히 고갈되면 과부하를 겪습니다. 에너지를 남기는 숙련된 탭 조절의 최적값은 아닙니다.',
    '미사일은 런타임 재장전 부채 감소를 반영합니다. 구형 DPS 산식의 고정 재장전 분모와 다릅니다.',
];
const sources = ['src/data/generated/balance.js', 'src/combat/beam.js', 'src/combat/beam-energy.js', 'src/combat/magazine.js', 'src/progression/cards.js', 'src/progression/model.js'];
const report = { runs, seed: 104, assumptions: DEFAULT_ASSUMPTIONS, sources: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])), campaigns, acquisition, missileBenchmarks, missileUpgrades, beamGrid, limitations };
const f = n => n.toFixed(2);
const markdown = `# 멀티 해금·빔 밸런스 감사\n\n재현: node tools/balance/weapon-audit.mjs --runs=${runs}\n\n## 캠페인 비교 (${runs}회씩, 동일 시드)\n\n|전략|평균 분|P10–P90 분|카드 수|멀티 발사 수|해금 선택 차수|해금 분|1스테이지 내 해금|\n|---|---:|---:|---:|---:|---:|---:|---:|\n${Object.entries(campaigns).map(([k,v])=>`|${k}|${f(v.minutes)}|${f(v.p10)}–${f(v.p90)}|${f(v.selections)}|${f(v.multiShots)}|${v.unlockSelection === null ? '—' : f(v.unlockSelection)}|${v.unlockMinutes === null ? '—' : f(v.unlockMinutes)}|${f(v.unlockByStageOne*100)}%|`).join('\n')}\n\n## 원하는 무기 우선 선택 (10,000회)\n\n${Object.entries(acquisition).map(([k,v])=>`- ${k}: 3회 내 ${f(v.by3*100)}%, 5회 내 ${f(v.by5*100)}%, 중앙 ${v.medianChoice}회, P90 ${v.p90Choice}회, 14회까지 미획득 ${f(v.missingAt14*100)}%`).join('\n')}\n\n## 미사일 600초 벤치 (82% 명중, 무강화)\n\n|무기|동시 표적|평균 DPS|후반 300초 DPS|\n|---|---:|---:|---:|\n${missileBenchmarks.map(v=>`|${v.mode}|${v.targets}|${f(v.dps)}|${f(v.lateDps)}|`).join('\n')}\n\n## 빔 120초 벤치 (100% 명중, 화력 무강화)\n\n후반 DPS는 후반 60초 평균이며, 일부 조합은 초기 에너지 이득이 남습니다. 재장전 주기의 위치에 따라 평균과 후반 수치가 다를 수 있습니다.\n\n|효율 단계|충전 단계|추가 카드|무한 지속|홀드 평균 DPS|홀드 후반 DPS|탭 후반 DPS|홀드 고갈 초|\n|---:|---:|---:|---|---:|---:|---:|---:|\n${beamGrid.map(v=>`|${v.efficiency}|${v.recharge}|${v.cards}|${v.unlimitedHold?'예':'아니오'}|${f(v.hold.dps)}|${f(v.hold.lateDps)}|${f(v.tap.lateDps)}|${v.hold.depletedAt === null ? '없음' : f(v.hold.depletedAt)}|`).join('\n')}\n\n## 해석 범위\n\n${limitations.map(v=>'- '+v).join('\n')}\n`;
const out = 'balance/reports/weapon-audit';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + '\n');
const findings = `
## 현재 빔 규칙과 결과 해석

- 홀드 굵기는 기본 0.9m, 강화 1/2/3단계에서 1.6/2.3/3.0m입니다. 최대가 이전 기본 굵기입니다. 단발 실린더 탄의 굵기 성장식은 유지됩니다.
- 실시간 충전은 없습니다. 고갈하면 과부하 2초 후 재장전을 시작하고, 기본 5초가 끝날 때 에너지를 100으로 일괄 보충합니다.
- 발사 가능한 단발 한 발보다 적은 잔량은 재장전으로 처리합니다. 완전 고갈하지 않은 잔량 재장전에는 과부하가 붙지 않습니다.
- 효율 카드는 소비량을 줄이고, 재장전 카드는 재장전 시간을 줄입니다. 발사 중 보충이 없어 최대 강화도 무한 홀드가 불가능합니다.
- 본 벤치의 무강화 홀드 평균은 ${f(beamGrid[0].hold.dps)} DPS, 단발 반복 평균은 ${f(beamGrid[0].tap.dps)} DPS입니다. 완전 고갈하는 홀드는 과부하까지, 단발은 잔량 부족 시 재장전을 기다립니다.
- 최대 강화 홀드 평균은 ${f(beamGrid.at(-1).hold.dps)} DPS, 단발 반복 평균은 ${f(beamGrid.at(-1).tap.dps)} DPS입니다. 모두 120초/100% 명중 가정이며 비행시간·조준 유지율·단발 빗나감은 생략합니다.
- 빔 선택 중 기관포는 발사할 수 없습니다. 캠페인 표는 기관포+미사일 운용만 비교하며 빔 포함 캠페인 추정이 아닙니다.
- 초기 멀티 지급 대비 카드 해금의 시간 차이는 ${f((campaigns['multi-card'].minutes-campaigns['multi-at-start'].minutes)*60)}초입니다.
`;
writeFileSync(`${out}/report.md`, markdown + findings);
console.log(markdown);
console.log(findings);
