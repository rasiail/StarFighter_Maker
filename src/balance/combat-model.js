import { BALANCE } from '../data/generated/balance.js';
import { PLAYER_BASE_STATS } from '../config/player-stats.js';
import { createPlayerFlight } from '../player/state.js';
import { consumeMagazine, tickMagazines } from '../combat/magazine.js';
import { formationKind, isEliteSpawn } from '../enemies/formation.js';
import { BOMB_WEAPON } from '../combat/bomb.js';

export function createCombatInventory(stats, build) {
    const inv = createPlayerFlight(null, stats);
    inv.weapons = build?.weapons ? [...build.weapons] : [1];
    return inv;
}

export function resizeCombatInventory(inventory, previous, next, build) {
    for (const mode of ['std', 'multi', 'bomb']) {
        const timers = inventory[`${mode}ReloadTimers`];
        if (timers && timers.length) timers[0] *= next[`${mode}ReloadSeconds`] / previous[`${mode}ReloadSeconds`];
        else if (inventory[`${mode}Bursts`] !== undefined) inventory[`${mode}Bursts`] += (next[`${mode}MaxBursts`] ?? 4) - (previous[`${mode}MaxBursts`] ?? 4);
    }
    if (build?.weapons) inventory.weapons = [...build.weapons];
    Object.assign(inventory, next);
}

export function createWaveTargets(stage, count, random, eliteRatio) {
    const targets = [];
    while (targets.length < count) {
        const kind = formationKind(count - targets.length, stage.environmentTheme === 'OCEAN', random());
        if (kind === 'ship') {
            const ship = targets.length;
            targets.push({id:'ship_hull', health:BALANCE.enemies.ship_hull.health, ship});
            for(let i=0;i<2;i++) targets.push({id:'ship_turret', health:BALANCE.enemies.ship_turret.health, ship});
        } else {
            const elite = eliteRatio == null ? isEliteSpawn(random()) : random() < eliteRatio;
            const id = kind === 'tank' ? 'tank' : elite ? 'elite' : 'stage_aircraft';
            targets.push({id, health: id === 'stage_aircraft' ? stage.aircraftHealth : BALANCE.enemies[id].health});
        }
    }
    // Runtime waves place the first four ordinary aircraft in one fish school.
    // Preserve that relationship so area damage never jumps to unrelated units.
    const school = targets.filter(target => target.id === 'stage_aircraft').slice(0, 4);
    if (school.length === 4) for (const target of school) target.splashGroup = 'fish-school';
    return targets;
}

export function hitsToKill(health, damage) { return Math.ceil(health / damage); }

// Discrete weapon events; navigation remains an explicit additive approximation.
// Inventory persists across waves, and is replenished at each stage like the runtime.
export function simulateCombat(input, stats, assumptions, random, inventory = createCombatInventory(stats), maxActive = input.length) {
    const enemies = input.map(row => ({...row, pending:0}));
    const result = { cannonShots:0, standardShots:0, multiShots:0, standardReloads:0, multiReloads:0, switches:0, overkill:0, collateralKills:0 };
    if (!enemies.length) return {...result,seconds:0,combatSeconds:0,travelSeconds:0};
    const cannon = BALANCE.weapons.player_cannon;
    const accuracy = {
        cannon:Math.min(1,assumptions.cannonAccuracy * (1 + assumptions.stabilityAccuracyBenefit * (stats.stabilityMultiplier - 1))),
        missile:Math.min(1,assumptions.missileAccuracy * (1 + assumptions.guidanceAccuracyBenefit * (stats.missileTurnMultiplier - 1))),
    };
    const cannonEnabled = assumptions.cannonUptime > 0 && accuracy.cannon > 0;
    const missileEnabled = accuracy.missile > 0 && assumptions.standardMissileShare + assumptions.multiMissileShare > 0;
    if (!cannonEnabled && !missileEnabled) throw new RangeError('No effective weapons enabled');
    const cannonInterval = cannonEnabled ? cannon.fireIntervalSec / assumptions.cannonUptime : Infinity;
    let nextCannon = cannonEnabled ? 0 : Infinity;
    let nextMissile = missileEnabled ? 0 : Infinity;
    let now=0, lastMode=inventory.lastMode ?? 'std', remaining=enemies.length, switching=false;
    const impacts=[];
    const kill = target => {
        if(target.health <= 0) return;
        target.health=0;
        target.pending=0;
        remaining--;
        if(target.id === 'ship_hull') {
            for(const other of enemies) if(other.id==='ship_turret' && other.ship===target.ship && other.health>0) {
                other.health=0; other.pending=0; remaining--; result.collateralKills++;
            }
        }
    };
    const hit = (target,damage) => {
        if(target.health<=0) { result.overkill+=damage; return; }
        result.overkill+=Math.max(0,damage-target.health);
        if(damage>=target.health - 1e-9) kill(target);
        else {
            target.health-=damage;
            if(target.health<=1e-9) kill(target);
        }
    };
    for(let iterations=0;remaining>0;iterations++) {
        if(iterations>=200000) throw new Error('Combat event limit exceeded; check assumptions');
        const nextImpact = impacts.reduce((min,p)=>Math.min(min,p.at),Infinity);
        const next=Math.min(nextCannon,nextMissile,nextImpact);
        if(!Number.isFinite(next)) throw new Error('Combat stalled');
        tickMagazines(inventory,Math.max(0,next-now));
        now=next;
        for(let i=impacts.length-1;i>=0;i--) if(impacts[i].at<=now+1e-8) {
            const p=impacts.splice(i,1)[0];
            p.target.pending=Math.max(0,p.target.pending-p.damage);
            if(p.target.pending<=1e-9 || !impacts.some(imp => imp.target === p.target)) p.target.pending=0;
            if(p.hit) {
                hit(p.target,p.damage);
                if (p.isBomb && p.splashDamage > 0) {
                    const splashTargets = enemies.filter(enemy => {
                        if (enemy === p.target || enemy.health <= 0) return false;
                        if (p.target.ship !== undefined) return enemy.ship === p.target.ship;
                        return p.target.splashGroup && enemy.splashGroup === p.target.splashGroup;
                    });
                    for (const splashTarget of splashTargets) {
                        hit(splashTarget, p.splashDamage * 0.75);
                    }
                }
            }
        }
        const active=enemies.filter(e=>e.health>0).slice(0,maxActive);
        const targets=active.filter(e=>e.health>e.pending);
        if(nextCannon<=now+1e-8) {
            if(targets[0]) { result.cannonShots++; if(random()<accuracy.cannon) hit(targets[0],cannon.damage*stats.damageMultiplier); }
            nextCannon=now+cannonInterval;
        }
        if(nextMissile<=now+1e-8) {
            const owned = inventory.weapons || [1];
            const candidateModes = ['std'];
            if (owned.includes(2)) candidateModes.push('multi');
            if (owned.includes(4)) candidateModes.push('bomb');
            const hasMulti = candidateModes.includes('multi');

            const getShare = mode => {
                if (mode === 'std') return hasMulti ? assumptions.standardMissileShare : 1.0;
                if (mode === 'multi') return assumptions.multiMissileShare;
                if (mode === 'bomb') return assumptions.bombMissileShare ?? 0.35;
                return 0;
            };

            const available = candidateModes.filter(mode =>
                inventory[`${mode}Bursts`] > 0 &&
                !inventory[`${mode}ReloadTimers`]?.length &&
                inventory[`${mode}ShotCooldown`] <= 1e-8 &&
                getShare(mode) > 0
            );
            let chosen = available[0];
            if (switching && available.includes(lastMode)) chosen = lastMode;
            else if (available.length > 1) {
                const totalShare = available.reduce((s, m) => s + getShare(m), 0);
                let roll = random() * totalShare;
                for (const m of available) {
                    roll -= getShare(m);
                    if (roll <= 0) { chosen = m; break; }
                }
            }
            const aim = active.filter(e => e.health > e.pending);
            if (chosen && aim.length) {
                const weapon = chosen === 'bomb' ? BOMB_WEAPON : BALANCE.weapons[chosen === 'std' ? 'standard_missile' : 'multi_missile'];
                if (chosen !== lastMode) {
                    lastMode = chosen;
                    switching = true;
                    result.switches++;
                    nextMissile = now + Math.max(0.01, assumptions.weaponSwitchSeconds);
                    continue;
                }
                switching = false;
                inventory[`${chosen}ShotCooldown`] = 0;
                const maxVolley = chosen === 'multi' ? Math.min(stats.multiLockCount, aim.length) : 1;
                const count = consumeMagazine(inventory, chosen, maxVolley);
                inventory[`${chosen}ShotCooldown`] = weapon.fireIntervalSec;
                if (count && inventory[`${chosen}ReloadTimers`].length) {
                    if (chosen === 'std') result.standardReloads++;
                    else if (chosen === 'multi') {
                        result.multiReloads++;
                        inventory.multiReloadTimers[0] *= assumptions.multiReloadScale;
                    } else if (chosen === 'bomb') {
                        result.bombReloads = (result.bombReloads || 0) + 1;
                    }
                }
                for (let i = 0; i < count; i++) {
                    const dmgMult = stats.damageMultiplier * (chosen === 'bomb' ? (stats.bombDamageMultiplier || 1) : 1);
                    const damage = (chosen === 'bomb' ? weapon.directDamage : weapon.damage) * dmgMult;
                    aim[i].pending += damage;
                    const willHit = random() < accuracy.missile;
                    const splashDamage = chosen === 'bomb' ? weapon.splashDamage * dmgMult : 0;
                    impacts.push({
                        target: aim[i],
                        damage,
                        at: now + Math.max(0.01, assumptions.missileFlightSeconds),
                        hit: willHit,
                        isBomb: chosen === 'bomb',
                        splashDamage,
                    });
                }
                if (chosen === 'std') result.standardShots += count;
                else if (chosen === 'multi') result.multiShots += count;
                else if (chosen === 'bomb') result.bombShots = (result.bombShots || 0) + count;
                nextMissile = now + weapon.fireIntervalSec;
            } else nextMissile = now + 0.1;
        }
    }
    inventory.lastMode=lastMode;
    const movement = 1 + assumptions.mobilityTimeBenefit * (stats.maxPitchRate / PLAYER_BASE_STATS.maxPitchRate - 1) + assumptions.speedTimeBenefit * (stats.cruiseSpeed / PLAYER_BASE_STATS.cruiseSpeed - 1);
    const travelSeconds=enemies.length*assumptions.engagementSecondsPerTarget/Math.max(0.1,movement);
    tickMagazines(inventory,travelSeconds);
    return {...result,combatSeconds:now,travelSeconds,seconds:now+travelSeconds};
}
