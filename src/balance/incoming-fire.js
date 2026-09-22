import { BALANCE } from '../data/generated/balance.js';
import { createSeededRandom } from './simulator.js';
import { createFlightState, stepFlight, stepAirWeapons } from '../enemies/flight-model.js';
import { ATTACK_POLICY, selectAttackers, canLaunchMissile } from '../enemies/attack-policy.js';
import { advanceHomingMissile } from '../combat/homing.js';
import { isEliteSpawn } from '../enemies/formation.js';

const flat = () => 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const direction = (from, to) => {
    const length = distance(from, to) || 1;
    return { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// A pressure test, not an estimate of full-run completion: no player kills,
// healing or upgrades. Flat terrain isolates incoming weapons from crashes.
export function simulateIncomingFire({ balance = BALANCE, policy = ATTACK_POLICY, seed = 104,
    stageId = 1, motion = 'weave', seconds = 60, dt = 1 / 60, boss = false, legacyAllAircraftMissiles = false } = {}) {
    const random = createSeededRandom(seed);
    const stage = balance.stages.find(s => s.stageId === stageId);
    if (!stage || !['straight', 'weave', 'evade'].includes(motion) || !(seconds > 0 && dt > 0)) throw new RangeError('Invalid incoming-fire scenario');
    const player = { x: 0, y: 800, z: 0 };
    let heading = 0, launchCooldown = 0, deathTime = null, totalDamage = 0;
    const missiles = [], bullets = [], enemies = [];
    const hits = { cannon: 0, missile: 0, antiAir: 0 }, fired = { cannon: 0, missile: 0, antiAir: 0 };
    let maxMissiles = 0;
    function spawn(ground = false, isBoss = false, elite) {
        const angle = random() * Math.PI * 2, range = 1500 + random() * 2000;
        const position = { x: player.x + Math.sin(angle) * range, y: ground ? 12 : 750 + random() * 700, z: player.z + Math.cos(angle) * range };
        return { position, flight: createFlightState(direction(position, player)), state: 'INTERCEPT', alive: true,
            isGround: ground, isBoss, isElite: !ground && !isBoss && (elite ?? (legacyAllAircraftMissiles || isEliteSpawn(random()))), speed: isBoss ? 240 : 340, fireCooldown: 1.5 + random() * 2,
            missileCooldown: 3 + random() * 5 };
    }
    if (boss) enemies.push(spawn(false, true));
    else {
        // Ocean hulls do not fire. Each ship consumes three slots, two are guns.
        while (enemies.length < stage.maxActive) {
            const remaining = stage.maxActive - enemies.length;
            const ground = random() < balance.spawnRules.ground_or_ship_probability.value;
            if (ground && stage.environmentTheme === 'OCEAN' && remaining >= 3) {
                const gun = spawn(true);
                enemies.push({ ...gun, position: { ...gun.position }, shipPart: 'HULL' }, gun, { ...gun, position: { ...gun.position }, fireCooldown: 2.2 + random() * 2 });
            } else enemies.push(spawn(ground && stage.environmentTheme !== 'OCEAN'));
        }
    }
    function shoot(e, forward, id, kind) {
        const w = balance.weapons[id]; fired[kind]++;
        const p = { ...e.position };
        if (kind === 'missile') missiles.push({ position: p, direction: { ...forward }, speed: w.projectileSpeedMps,
            maxSpeed: w.maxSpeedMps, acceleration: w.accelerationMps2, turnRate: w.turnRateRadSec, life: w.lifetimeSec, damage: w.damage });
        else bullets.push({ position: p, velocity: { x: forward.x * w.projectileSpeedMps, y: forward.y * w.projectileSpeedMps, z: forward.z * w.projectileSpeedMps }, life: w.lifetimeSec, damage: w.damage, kind });
    }
    for (let tick = 0; tick < Math.ceil(seconds / dt); tick++) {
        const t = tick * dt;
        const yaw = motion === 'straight' ? 0 : motion === 'weave' ? 0.16 * Math.sin(t / 5) : 0.48 * Math.sin(t / 3);
        heading += yaw * dt;
        player.x -= Math.sin(heading) * 550 * 0.514444 * dt;
        player.z -= Math.cos(heading) * 550 * 0.514444 * dt;
        launchCooldown = Math.max(0, launchCooldown - dt);
        const attackers = selectAttackers(enemies, player, stage.attackBudget, policy);
        for (const e of enemies) {
            if (e.shipPart === 'HULL') continue;
            if (distance(e.position, player) > 6500) Object.assign(e, spawn(e.isGround, e.isBoss, e.isElite));
            if (e.isGround) {
                e.fireCooldown -= dt;
                if (attackers.has(e) && distance(e.position, player) < (stage.environmentTheme === 'OCEAN' ? 3800 : 3200) && e.fireCooldown <= 0) {
                    const aim = { x: player.x + (random() - 0.5) * 45, y: player.y + (random() - 0.5) * 25, z: player.z + (random() - 0.5) * 45 };
                    shoot(e, direction(e.position, aim), 'anti_air', 'antiAir');
                    e.fireCooldown = stage.environmentTheme === 'OCEAN' ? 2 + random() * 1.8 : 1.8 + random() * 1.5;
                }
                continue;
            }
            const result = stepFlight(e.flight, e.position, player, e.speed * (e.state === 'INTERCEPT' ? 0.65 : 0.58), dt, flat, e.isBoss);
            e.state = result.state;
            const shots = stepAirWeapons(e, dt, distance(e.position, player), dot(result.forward, direction(e.position, player)), attackers.has(e), random,
                canLaunchMissile(launchCooldown, missiles.length, policy));
            if (shots.cannon) shoot(e, result.forward, 'enemy_cannon', 'cannon');
            if (shots.missile) {
                shoot(e, result.forward, e.isBoss ? 'boss_missile' : 'enemy_missile', 'missile');
                launchCooldown = e.isBoss ? (policy.bossMissileSpacing ?? policy.missileSpacing) : policy.missileSpacing;
            }
        }
        maxMissiles = Math.max(maxMissiles, missiles.length);
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i]; b.life -= dt;
            b.position.x += b.velocity.x * dt; b.position.y += b.velocity.y * dt; b.position.z += b.velocity.z * dt;
            if (distance(b.position, player) < 6) { hits[b.kind]++; totalDamage += b.damage; b.life = -1; }
            if (b.life <= 0) bullets.splice(i, 1);
        }
        for (let i = missiles.length - 1; i >= 0; i--) {
            const m = missiles[i]; advanceHomingMissile(m, player, dt);
            if (distance(m.position, player) < 10) { hits.missile++; totalDamage += m.damage; m.life = -1; }
            if (m.life <= 0) missiles.splice(i, 1);
        }
        if (totalDamage >= 100 && deathTime === null) deathTime = (tick + 1) * dt;
    }
    return { totalDamage, deathTime, hits, fired, maxMissiles };
}

export function summarizeIncoming(options, runs = 40) {
    const samples = Array.from({ length: runs }, (_, i) => simulateIncomingFire({ ...options, seed: (options.seed ?? 104) + i * 7919 }));
    const damages = samples.map(s => s.totalDamage).sort((a, b) => a - b);
    return { runs, meanDamage: damages.reduce((a, b) => a + b, 0) / runs,
        p90Damage: damages[Math.min(runs - 1, Math.floor(runs * 0.9))],
        survivalPercent: samples.filter(s => s.deathTime === null).length / runs * 100,
        meanMissilesFired: samples.reduce((s, r) => s + r.fired.missile, 0) / runs,
        meanMissileHits: samples.reduce((s, r) => s + r.hits.missile, 0) / runs,
        maxMissiles: Math.max(...samples.map(s => s.maxMissiles)) };
}
