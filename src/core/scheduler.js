// Combat time only: pauses with simulation and clears between runs/stages.
let jobs = [];
export function scheduleCombat(seconds, callback) { jobs.push({ remaining: seconds, callback }); }
export function clearCombatSchedule() { jobs = []; }
export function updateCombatSchedule(delta) {
    const ready = [];
    jobs = jobs.filter(job => { job.remaining -= delta; if (job.remaining <= 0) { ready.push(job); return false; } return true; });
    ready.forEach(job => job.callback());
}
