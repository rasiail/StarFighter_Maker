import test from 'node:test';
import assert from 'node:assert/strict';
import { FISH_SCHOOL, schoolOffset, RADIAL_DIRECTIONS, BOMBER, stepBomberWeapons, stepBomberCannons } from '../src/enemies/special-types.js';
import { advanceHomingMissile } from '../src/combat/homing.js';
import { formationKind } from '../src/enemies/formation.js';
test('four fish occupy distinct slots and retain relative formation after leader loss', () => {
    assert.equal(FISH_SCHOOL.size, 4);
    assert.equal(FISH_SCHOOL.scale, 3.25);
    assert.equal(FISH_SCHOOL.spacing, 60);
    assert.equal(new Set([0,1,2,3].map(i => JSON.stringify(schoolOffset(i)))).size, 4);
    assert.ok(Math.max(...[0,1,2,3].map(i => Math.hypot(schoolOffset(i).x, schoolOffset(i).z))) <= 150);
    for (let leader = 0; leader < 4; leader++) {
        assert.deepEqual(schoolOffset(leader, leader), {x:0,y:0,z:0});
        for (let slot = leader; slot < 4; slot++) {
            const old = schoolOffset(slot), origin = schoolOffset(leader), next = schoolOffset(slot, leader);
            assert.equal(next.x + origin.x, old.x); assert.equal(next.z + origin.z, old.z);
        }
    }
});
test('bomber warns then fires four cardinal missiles and waits for reload', () => {
    const enemy = {missileCooldown:0};
    for (let i=0;i<11;i++) assert.equal(stepBomberWeapons(enemy,0.1,1500,true,0,0,4),false);
    assert.equal(stepBomberWeapons(enemy,0.11,1500,true,0,0,4),true);
    assert.equal(enemy.missileCooldown,BOMBER.reload);
    assert.equal(stepBomberWeapons(enemy,0.1,1500,true,0,0,4),false);
    assert.equal(RADIAL_DIRECTIONS.length,4);
    assert.deepEqual(RADIAL_DIRECTIONS.reduce((s,d)=>({x:s.x+d.x,y:s.y+d.y,z:s.z+d.z}),{x:0,y:0,z:0}),{x:0,y:0,z:0});
});
test('blocked, out-of-range or denied bombers cannot bypass missile budget or retain a warning', () => {
    for (const [range,allowed,count,cooldown] of [[1500,true,1,0],[1500,true,0,1],[4000,true,0,0],[1500,false,0,0]]) {
        const enemy={missileCooldown:0,salvoWarning:1.19};
        assert.equal(stepBomberWeapons(enemy,0.1,range,allowed,count,cooldown,4),false);
        assert.equal(enemy.salvoWarning,0);
    }
});
test('radial missiles travel outward before beginning homing', () => {
    const m={life:10,speed:100,maxSpeed:100,acceleration:0,turnRate:1,homingDelay:0.9,
        direction:{x:1,y:0,z:0},position:{x:0,y:0,z:0}};
    const target={x:0,y:0,z:-1000};
    advanceHomingMissile(m,target,0.5);
    assert.deepEqual(m.direction,{x:1,y:0,z:0}); assert.equal(m.position.x,50);
    advanceHomingMissile(m,target,0.5);
    assert.ok(m.direction.z<0); assert.equal(m.homingDelay,0);
});
test('reinforcement formations can exclude fixed ground and naval targets', () => {
    assert.equal(formationKind(10, false, 0, false), 'aircraft');
    assert.equal(formationKind(10, true, 0, false), 'aircraft');
    assert.equal(formationKind(10, false, 0, true), 'tank');
    assert.equal(formationKind(10, true, 0, true), 'ship');
});

test('bomber fires alternating left and right wing cannons when player is in engagement arc and range', () => {
    const enemy = { cannonCooldown: 0, burstCooldown: 0 };
    const shots = [];
    // Initiate and step through the 6-round burst
    for (let i = 0; i < 20; i++) {
        const shot = stepBomberCannons(enemy, 0.12, 1200, 0.95, true, () => 0);
        if (shot?.fire) shots.push(shot.side);
    }
    assert.equal(shots.length, 6);
    assert.deepEqual(shots, ['left', 'right', 'left', 'right', 'left', 'right']);
    assert.ok(enemy.cannonCooldown > 0);
    // While on cooldown, no shots fired
    assert.equal(stepBomberCannons(enemy, 0.1, 1200, 0.95, true), null);
});

test('bomber suppresses cannon when out of range, out of arc, disallowed, or during missile warning', () => {
    // Out of range (too far: 3000, too close: 100)
    assert.equal(stepBomberCannons({ cannonCooldown: 0 }, 0.1, 3000, 0.9, true), null);
    assert.equal(stepBomberCannons({ cannonCooldown: 0 }, 0.1, 100, 0.9, true), null);
    // Out of forward arc (behind: alignment -0.5, side: 0.1)
    assert.equal(stepBomberCannons({ cannonCooldown: 0 }, 0.1, 1200, 0.1, true), null);
    // Disallowed
    assert.equal(stepBomberCannons({ cannonCooldown: 0 }, 0.1, 1200, 0.9, false), null);
    // Suppressed during missile warning
    assert.equal(stepBomberCannons({ cannonCooldown: 0, salvoWarning: 0.5 }, 0.1, 1200, 0.9, true), null);
});

