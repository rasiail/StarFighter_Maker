import { compareStrategies, DEFAULT_ASSUMPTIONS } from '../../src/balance/simulator.js';

const args = Object.fromEntries(process.argv.slice(2).map(value => {
    const [key, raw = 'true'] = value.replace(/^--/, '').split('=');
    const number = Number(raw);
    return [key, Number.isFinite(number) && raw !== '' ? number : raw];
}));
const results = compareStrategies({ ...DEFAULT_ASSUMPTIONS, ...args });
const rows = Object.values(results).map(result => ({
    strategy: result.strategy,
    runs: result.runs,
    minutes: (result.averageSeconds / 60).toFixed(1),
    p10_minutes: (result.p10Seconds / 60).toFixed(1),
    p90_minutes: (result.p90Seconds / 60).toFixed(1),
    final_level: result.averageFinalLevel.toFixed(1),
    cards: result.averageSelections.toFixed(1),
    final_dps: result.finalWeapons.totalDps.toFixed(1),
}));
if (args.json) console.log(JSON.stringify(results, null, 2));
else console.table(rows);
