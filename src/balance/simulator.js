import { BALANCE } from '../data/generated/balance.js';
import { calculateStats, createProgression, grantExperience } from '../progression/model.js';
import { drawCards, selectCard } from '../progression/cards.js';
import { enemyExperience } from '../progression/rewards.js';
import { simulateCombat, createCombatInventory, resizeCombatInventory, createWaveTargets } from './combat-model.js';

export const STRATEGIES = Object.freeze(['balanced', 'offense', 'survival', 'random']);
export const DEFAULT_ASSUMPTIONS = Object.freeze({
    runs: 300,
    seed: 104,
    cannonAccuracy: 0.32,
    missileAccuracy: 0.82,
    cannonUptime: 0.28,
    standardMissileShare: 0.35,
    multiMissileShare: 0.65,
    engagementSecondsPerTarget: 1.15,
    waveTransitionSeconds: 5,
    hangarSeconds: 25,
    enemyCountScale: 1,
    multiReloadScale: 1,
    xpRequirementScale: 1,
    combatModel: 'events',
    weaponSwitchSeconds: 0.25,
    missileFlightSeconds: 1,
    // Uncalibrated response coefficients; zero disables each estimated movement/aim benefit.
    mobilityTimeBenefit: 0.5,
    speedTimeBenefit: 0.25,
    stabilityAccuracyBenefit: 0.1,
    guidanceAccuracyBenefit: 0.1,
});

const strategyScores = {
    balanced: { power: 9, multiSalvo: 9, reload: 8, defense: 8, mobility: 7, control: 7, speed: 6, stability: 6, warhead: 6, guidance: 6, standardRack: 5, multiRack: 5, repair: 0 },
    offense: { power: 14, warhead: 13, multiSalvo: 13, reload: 12, multiRack: 10, standardRack: 9, control: 8, guidance: 8, mobility: 4, speed: 3, defense: 2, stability: 2, repair: 0 },
    survival: { defense: 14, stability: 12, mobility: 11, speed: 9, control: 5, guidance: 4, power: 3, reload: 3, standardRack: 2, multiRack: 2, warhead: 1, repair: 0 },
};

export function createSeededRandom(seed = 1) {
    let state = Math.max(1, Math.floor(seed)) >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function enemyHealth(id, stage) {
    if (id === 'stage_aircraft') return stage.aircraftHealth;
    if (id === 'boss') return stage.bossHealth;
    return BALANCE.enemies[id].health;
}

function enemyMix(stage) {
    const groundChance = BALANCE.spawnRules.ground_or_ship_probability.value;
    if (stage.environmentTheme === 'OCEAN') {
        // A ship request creates one hull and two independently targetable turrets.
        const totalTargets = (1 - groundChance) + groundChance * 3;
        return [
            ['stage_aircraft', (1 - groundChance) / totalTargets],
            ['ship_hull', groundChance / totalTargets],
            ['ship_turret', groundChance * 2 / totalTargets],
        ];
    }
    return [['stage_aircraft', 1 - groundChance], ['tank', groundChance]];
}

function sampleEnemyCounts(stage, count, random) {
    const mix = enemyMix(stage);
    const counts = Object.fromEntries(mix.map(([id]) => [id, 0]));
    for (let i = 0; i < count; i++) {
        let roll = random();
        let selected = mix.at(-1)[0];
        for (const [id, probability] of mix) {
            roll -= probability;
            if (roll <= 0) { selected = id; break; }
        }
        counts[selected]++;
    }
    return counts;
}

export function weaponPerformance(stats, assumptions = DEFAULT_ASSUMPTIONS) {
    const cannon = BALANCE.weapons.player_cannon;
    const standard = BALANCE.weapons.standard_missile;
    const multi = BALANCE.weapons.multi_missile;
    const missileDps = (weapon, slots, reload, share, volley = 1) => {
        const shotsPerSecond = slots / (Math.max(reload, weapon.fireIntervalSec) + (Math.ceil(slots / volley) - 1) * weapon.fireIntervalSec);
        return weapon.damage * stats.damageMultiplier * shotsPerSecond * assumptions.missileAccuracy * share;
    };
    const cannonDps = cannon.damage * stats.damageMultiplier / cannon.fireIntervalSec * assumptions.cannonAccuracy * assumptions.cannonUptime;
    const standardDps = missileDps(standard, stats.stdMaxBursts, stats.stdReloadSeconds, assumptions.standardMissileShare);
    const multiDps = missileDps(multi, stats.multiMaxBursts, stats.multiReloadSeconds * (assumptions.multiReloadScale ?? 1), assumptions.multiMissileShare, Math.min(stats.multiLockCount, stats.multiMaxBursts, assumptions.availableTargets ?? Infinity));
    return {
        cannon: { burstDamage: cannon.damage * stats.damageMultiplier, sustainedDps: cannonDps },
        standardMissile: { burstDamage: standard.damage * stats.damageMultiplier, magazineDamage: standard.damage * stats.damageMultiplier * stats.stdMaxBursts, sustainedDps: standardDps },
        multiMissile: { burstDamage: multi.damage * stats.damageMultiplier * Math.min(stats.multiLockCount, stats.multiMaxBursts, assumptions.availableTargets ?? Infinity), magazineDamage: multi.damage * stats.damageMultiplier * stats.multiMaxBursts, sustainedDps: multiDps },
        totalDps: cannonDps + standardDps + multiDps,
    };
}

function chooseCard(build, offered, strategy, random) {
    if (strategy === 'random') return offered[Math.floor(random() * offered.length)];
    const scores = strategyScores[strategy] || strategyScores.balanced;
    return [...offered].sort((a, b) => {
        const aRank = a.stat ? build.ranks[a.id] : (build.cards[a.id] || 0);
        const bRank = b.stat ? build.ranks[b.id] : (build.cards[b.id] || 0);
        const aScore = (scores[a.id] || 0) - aRank * 0.35;
        const bScore = (scores[b.id] || 0) - bRank * 0.35;
        return bScore - aScore || b.weight - a.weight || a.id.localeCompare(b.id);
    })[0];
}

function spendChoices(build, strategy, random, selectedCards) {
    while (build.pending > 0) {
        const offered = drawCards(build, random);
        const selected = chooseCard(build, offered, strategy, random);
        selectCard(build, selected.id, offered);
        selectedCards[selected.id] = (selectedCards[selected.id] || 0) + 1;
    }
}

function rewardForCounts(counts, stage) {
    return Object.entries(counts).reduce((total, [id, count]) => total + enemyExperience(id, stage) * count, 0);
}

export function simulateRun(options = {}) {
    const assumptions = { ...DEFAULT_ASSUMPTIONS, ...options };
    const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : 'balanced';
    const random = createSeededRandom(assumptions.seed);
    const combatRandom = createSeededRandom(assumptions.seed + 17041);
    const build = createProgression();
    const selectedCards = {};
    const enemyCounts = {};
    const timeline = [{ point: 'START', stage: 0, wave: 0, elapsedSeconds: 0, level: 1, selections: 0, cumulativeTargets: 0, dps: weaponPerformance(calculateStats(build), assumptions).totalDps }];
    let elapsedSeconds = 0;
    let cumulativeTargets = 0;
    let totalXp = 0;
    const combatTotals = { cannonShots: 0, standardShots: 0, multiShots: 0, standardReloads: 0, multiReloads: 0, switches: 0, overkill: 0, collateralKills: 0, combatSeconds: 0, travelSeconds: 0 };
    const recordCombat = result => { for (const key of Object.keys(combatTotals)) combatTotals[key] += result[key] || 0; };

    for (const stage of BALANCE.stages) {
        const inventory = createCombatInventory(calculateStats(build));
        for (let waveIndex = 0; waveIndex < stage.waves.length; waveIndex++) {
            const targetCount = Math.max(1, Math.round(stage.waves[waveIndex] * assumptions.enemyCountScale));
            const targets = createWaveTargets(stage, targetCount, random);
            const counts = targets.reduce((out, target) => { out[target.id] = (out[target.id] || 0) + 1; return out; }, {});
            for (const [id, count] of Object.entries(counts)) enemyCounts[id] = (enemyCounts[id] || 0) + count;
            const totalHealth = Object.entries(counts).reduce((sum, [id, count]) => sum + enemyHealth(id, stage) * count, 0);
            const performance = weaponPerformance(calculateStats(build), assumptions);
            if (assumptions.combatModel === 'events') {
                const battle = simulateCombat(targets, calculateStats(build), assumptions, combatRandom, inventory, stage.maxActive);
                elapsedSeconds += battle.seconds + assumptions.waveTransitionSeconds;
                recordCombat(battle);
            } else elapsedSeconds += totalHealth / Math.max(1, performance.totalDps) + targetCount * assumptions.engagementSecondsPerTarget + assumptions.waveTransitionSeconds;
            const xp = rewardForCounts(counts, stage);
            totalXp += xp;
            grantExperience(build, xp / assumptions.xpRequirementScale);
            const previousStats = calculateStats(build);
            spendChoices(build, strategy, random, selectedCards);
            resizeCombatInventory(inventory, previousStats, calculateStats(build));
            cumulativeTargets += targetCount;
            timeline.push({
                point: `S${stage.stageId}-W${waveIndex + 1}`, stage: stage.stageId, wave: waveIndex + 1,
                elapsedSeconds, level: build.level, selections: Object.values(selectedCards).reduce((a, b) => a + b, 0),
                cumulativeTargets, dps: weaponPerformance(calculateStats(build), assumptions).totalDps,
            });
        }
        const bossPerformance = weaponPerformance(calculateStats(build), { ...assumptions, availableTargets: 1 });
        if (assumptions.combatModel === 'events') {
            const battle = simulateCombat([{ id: 'boss', health: stage.bossHealth }], calculateStats(build), assumptions, combatRandom, inventory, 1);
            elapsedSeconds += battle.seconds;
            recordCombat(battle);
        } else elapsedSeconds += stage.bossHealth / Math.max(1, bossPerformance.totalDps) + assumptions.engagementSecondsPerTarget;
        totalXp += enemyExperience('boss', stage);
        grantExperience(build, enemyExperience('boss', stage) / assumptions.xpRequirementScale);
        spendChoices(build, strategy, random, selectedCards);
        enemyCounts.boss = (enemyCounts.boss || 0) + 1;
        cumulativeTargets++;
        timeline.push({
            point: `S${stage.stageId}-BOSS`, stage: stage.stageId, wave: stage.waves.length + 1, elapsedSeconds, level: build.level,
            selections: Object.values(selectedCards).reduce((a, b) => a + b, 0), cumulativeTargets,
            dps: weaponPerformance(calculateStats(build), assumptions).totalDps,
        });
        elapsedSeconds += assumptions.hangarSeconds;
    }
    const finalStats = calculateStats(build);
    return { strategy, assumptions, elapsedSeconds, totalXp, finalLevel: build.level, selections: Object.values(selectedCards).reduce((a, b) => a + b, 0), selectedCards, enemyCounts, timeline, finalStats, combatTotals, finalWeapons: weaponPerformance(finalStats, assumptions) };
}

function averageObject(items) {
    const keys = new Set(items.flatMap(item => Object.keys(item)));
    return Object.fromEntries([...keys].map(key => [key, items.reduce((sum, item) => sum + (item[key] || 0), 0) / items.length]));
}

export function simulateMany(options = {}) {
    const assumptions = { ...DEFAULT_ASSUMPTIONS, ...options };
    for (const key of ['runs', 'enemyCountScale', 'multiReloadScale', 'xpRequirementScale']) {
        if (!Number.isFinite(assumptions[key]) || assumptions[key] <= 0) throw new RangeError(`${key} must be positive and finite`);
    }
    const runs = Math.max(1, Math.min(5000, Math.floor(assumptions.runs)));
    const results = Array.from({ length: runs }, (_, index) => simulateRun({ ...assumptions, seed: assumptions.seed + index * 9973 }));
    const baseTimeline = results[0].timeline;
    const timeline = baseTimeline.map((point, index) => ({
        point: point.point,
        stage: point.stage,
        wave: point.wave,
        elapsedSeconds: results.reduce((sum, run) => sum + run.timeline[index].elapsedSeconds, 0) / runs,
        level: results.reduce((sum, run) => sum + run.timeline[index].level, 0) / runs,
        selections: results.reduce((sum, run) => sum + run.timeline[index].selections, 0) / runs,
        cumulativeTargets: point.cumulativeTargets,
        dps: results.reduce((sum, run) => sum + run.timeline[index].dps, 0) / runs,
    }));
    const durations = results.map(result => result.elapsedSeconds).sort((a, b) => a - b);
    return {
        strategy: results[0].strategy,
        runs,
        assumptions,
        averageSeconds: durations.reduce((a, b) => a + b, 0) / runs,
        p10Seconds: durations[Math.floor((runs - 1) * 0.1)],
        p90Seconds: durations[Math.floor((runs - 1) * 0.9)],
        averageFinalLevel: results.reduce((sum, result) => sum + result.finalLevel, 0) / runs,
        averageSelections: results.reduce((sum, result) => sum + result.selections, 0) / runs,
        averageEnemyCounts: averageObject(results.map(result => result.enemyCounts)),
        averageCardCounts: averageObject(results.map(result => result.selectedCards)),
        averageCombat: averageObject(results.map(result => result.combatTotals)),
        timeline,
        finalWeapons: {
            cannon: averageObject(results.map(result => result.finalWeapons.cannon)),
            standardMissile: averageObject(results.map(result => result.finalWeapons.standardMissile)),
            multiMissile: averageObject(results.map(result => result.finalWeapons.multiMissile)),
            totalDps: results.reduce((sum, result) => sum + result.finalWeapons.totalDps, 0) / runs,
        },
    };
}

export function compareStrategies(options = {}) {
    return Object.fromEntries(STRATEGIES.map((strategy, index) => [strategy, simulateMany({ ...options, strategy, seed: (options.seed ?? DEFAULT_ASSUMPTIONS.seed) + index * 1000003 })]));
}
