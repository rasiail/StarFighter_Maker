// Pure encounter state; mesh spawning and UI live in missions.js.
export function createEncounter(stage) {
    return { stage, wave: 0, kills: 0, spawned: 0, phase: 'waves', transition: false };
}
export function recordEncounterKill(encounter, isBoss) {
    if (encounter.transition) return;
    if (encounter.phase === 'waves' && !isBoss) {
        encounter.kills++;
        if (encounter.kills >= encounter.stage.waves[encounter.wave]) encounter.transition = true;
    } else if (encounter.phase === 'boss' && isBoss) encounter.transition = true;
}
export function advanceEncounter(encounter) {
    if (!encounter.transition) return false;
    encounter.transition = false;
    if (encounter.phase === 'waves') {
        encounter.wave++;
        encounter.kills = encounter.spawned = 0;
        if (encounter.wave === encounter.stage.waves.length) encounter.phase = 'boss';
    } else if (encounter.phase === 'boss') encounter.phase = 'hangar';
    return true;
}
export function reinforcementCount(encounter, alive) {
    if (encounter.phase !== 'waves' || encounter.transition) return 0;
    return Math.max(0, Math.min(encounter.stage.maxActive - alive, encounter.stage.waves[encounter.wave] - encounter.spawned));
}
