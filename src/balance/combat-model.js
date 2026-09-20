import { BALANCE } from '../data/generated/balance.js';
import { PLAYER_BASE_STATS } from '../config/player-stats.js';
import { createPlayerFlight } from '../player/state.js';
import { consumeMagazine, tickMagazines } from '../combat/magazine.js';
import { formationKind } from '../enemies/formation.js';

export function createCombatInventory(stats) { return createPlayerFlight(null, stats); }

export function resizeCombatInventory(inventory, previous, next) {
    for (const mode of ['std', 'multi']) {
        const timers = inventory[`${mode}ReloadTimers`];
        if (timers.length) timers[0] *= next[`${mode}ReloadSeconds`] / previous[`${mode}ReloadSeconds`];
        else inventory[`${mode}Bursts`] += next[`${mode}MaxBursts`] - previous[`${mode}MaxBursts`];
    }
    Object.assign(inventory, next);
}

export function createWaveTargets(stage, count, random) {
    const targets = [];
    while (targets.length < count) {
        const kind = formationKind(count - targets.length, stage.environmentTheme === 'OCEAN', random());
        if (kind === 'ship') {
            const ship = targets.length;
            targets.push({id:'ship_hull', health:BALANCE.enemies.ship_hull.health, ship});
            for(let i=0;i<2;i++) targets.push({id:'ship_turret', health:BALANCE.enemies.ship_turret.health, ship});
        } else {
            const id = kind === 'tank' ? 'tank' : 'stage_aircraft';
            targets.push({id, health:kind === 'tank' ? BALANCE.enemies.tank.health : stage.aircraftHealth});
        }
    }
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
        remaining--;
        if(target.id === 'ship_hull') {
            for(const other of enemies) if(other.id==='ship_turret' && other.ship===target.ship && other.health>0) {
                other.health=0; remaining--; result.collateralKills++;
            }
        }
    };
    const hit = (target,damage) => {
        if(target.health<=0) { result.overkill+=damage; return; }
        result.overkill+=Math.max(0,damage-target.health);
        if(damage>=target.health) kill(target);
        else target.health-=damage;
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
            if(p.hit) hit(p.target,p.damage);
        }
        const active=enemies.filter(e=>e.health>0).slice(0,maxActive);
        const targets=active.filter(e=>e.health>e.pending);
        if(nextCannon<=now+1e-8) {
            if(targets[0]) { result.cannonShots++; if(random()<accuracy.cannon) hit(targets[0],cannon.damage*stats.damageMultiplier); }
            nextCannon=now+cannonInterval;
        }
        if(nextMissile<=now+1e-8) {
            const available=['std','multi'].filter(mode => inventory[`${mode}Bursts`]>0 && !inventory[`${mode}ReloadTimers`].length && inventory[`${mode}ShotCooldown`]<=1e-8 && (mode==='std'?assumptions.standardMissileShare:assumptions.multiMissileShare)>0);
            let chosen=available[0];
            if(switching && available.includes(lastMode)) chosen=lastMode;
            else if(available.length===2) chosen=random()<assumptions.multiMissileShare/(assumptions.multiMissileShare+assumptions.standardMissileShare)?'multi':'std';
            const aim=active.filter(e=>e.health>e.pending);
            if(chosen && aim.length) {
                const weapon=BALANCE.weapons[chosen==='std'?'standard_missile':'multi_missile'];
                // Fire only after the switch delay; a reload can finish during this interval.
                if(chosen!==lastMode) { lastMode=chosen; switching=true; result.switches++; nextMissile=now+Math.max(0.01,assumptions.weaponSwitchSeconds); continue; }
                switching=false;
                inventory[`${chosen}ShotCooldown`]=0;
                const count=consumeMagazine(inventory,chosen,aim.length);
                inventory[`${chosen}ShotCooldown`]=weapon.fireIntervalSec;
                if(count && inventory[`${chosen}ReloadTimers`].length) {
                    result[chosen==='std'?'standardReloads':'multiReloads']++;
                    if(chosen==='multi') inventory.multiReloadTimers[0]*=assumptions.multiReloadScale;
                }
                for(let i=0;i<count;i++) {
                    const damage=weapon.damage*stats.damageMultiplier;
                    aim[i].pending+=damage;
                    impacts.push({target:aim[i],damage,at:now+Math.max(0.01,assumptions.missileFlightSeconds),hit:random()<accuracy.missile});
                }
                result[chosen==='std'?'standardShots':'multiShots']+=count;
                nextMissile=now+weapon.fireIntervalSec;
            } else nextMissile=now+0.1;
        }
    }
    inventory.lastMode=lastMode;
    const movement = 1 + assumptions.mobilityTimeBenefit * (stats.maxPitchRate / PLAYER_BASE_STATS.maxPitchRate - 1) + assumptions.speedTimeBenefit * (stats.cruiseSpeed / PLAYER_BASE_STATS.cruiseSpeed - 1);
    const travelSeconds=enemies.length*assumptions.engagementSecondsPerTarget/Math.max(0.1,movement);
    tickMagazines(inventory,travelSeconds);
    return {...result,combatSeconds:now,travelSeconds,seconds:now+travelSeconds};
}
