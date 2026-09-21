import { compareStrategies } from './src/balance/simulator.js';

const results = compareStrategies();

const summary = {};
for (const [strategy, result] of Object.entries(results)) {
    summary[strategy] = {
        averageSeconds: result.averageSeconds,
        p10Seconds: result.p10Seconds,
        p90Seconds: result.p90Seconds,
        averageFinalLevel: result.averageFinalLevel,
        averageSelections: result.averageSelections,
        totalDps: result.finalWeapons.totalDps,
        cannonDps: result.finalWeapons.cannon.sustainedDps,
        standardDps: result.finalWeapons.standardMissile.sustainedDps,
        multiDps: result.finalWeapons.multiMissile.sustainedDps,
    };
}

console.log(JSON.stringify(summary, null, 2));
