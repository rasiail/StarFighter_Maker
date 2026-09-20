import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, calculateStats } from '../src/progression/model.js';
import { CARDS, eligibleCards, selectCard } from '../src/progression/cards.js';
import { createPlayerFlight } from '../src/player/state.js';
import { consumeMagazine } from '../src/combat/magazine.js';
import { simulateCombat, createWaveTargets } from '../src/balance/combat-model.js';
import { DEFAULT_ASSUMPTIONS } from '../src/balance/simulator.js';
import { enemyExperience } from '../src/progression/rewards.js';
import { BALANCE } from '../src/data/generated/balance.js';

const shotsOnly={...DEFAULT_ASSUMPTIONS,cannonUptime:0,missileAccuracy:1,standardMissileShare:1,multiMissileShare:0,engagementSecondsPerTarget:0,missileFlightSeconds:0.01};
test('멀티 관제 확장은 관제력 2에서 해금되고 4→6→8발을 발사한다',()=>{
 const build=createProgression();
 assert.ok(!eligibleCards(build).some(c=>c.id==='multiSalvo'));
 build.ranks.control=2;build.pending=2;
 assert.equal(calculateStats(build).multiLockCount,4);
 const card=CARDS.find(c=>c.id==='multiSalvo');
 for(const count of [6,8]) {
  selectCard(build,'multiSalvo',[card]);
  const stats=calculateStats(build);
  assert.equal(stats.multiLockCount,count);
  const flight=createPlayerFlight(null,stats);
  assert.equal(consumeMagazine(flight,'multi',20),count);
  flight.multiBursts=3;
  assert.equal(consumeMagazine(flight,'multi',20),3);
 }
 assert.ok(!eligibleCards(build).some(c=>c.id==='multiSalvo'));
});

test('실제 타격 수와 과잉 피해를 계산하고 화력 1단계의 원킬 경계를 반영한다',()=>{
 const build=createProgression();
 const before=simulateCombat([{id:'stage_aircraft',health:100}],calculateStats(build),shotsOnly,()=>0);
 build.ranks.power=1;
 const after=simulateCombat([{id:'stage_aircraft',health:100}],calculateStats(build),shotsOnly,()=>0);
 assert.equal(before.standardShots,2);
 assert.equal(after.standardShots,1);
 assert.equal(before.overkill,70);
 assert.ok(after.seconds<before.seconds);
});

test('21번째 표준 발사는 탄창 전체 재장전 이후에 가능하다',()=>{
 const targets=Array.from({length:21},()=>({id:'stage_aircraft',health:85}));
 const result=simulateCombat(targets,calculateStats(createProgression()),shotsOnly,()=>0);
 assert.equal(result.standardShots,21);
 assert.equal(result.standardReloads,1);
 assert.ok(result.seconds>=15.7 && result.seconds<16.1);
});

test('전함은 3타깃 예산을 소비하고 선체 격파가 함포를 함께 제거한다',()=>{
 const stage=BALANCE.stages[1];
 assert.equal(createWaveTargets(stage,2,()=>0).filter(t=>t.id==='ship_hull').length,0);
 const targets=createWaveTargets(stage,3,()=>0);
 assert.deepEqual(targets.map(t=>t.id),['ship_hull','ship_turret','ship_turret']);
 const stats={...calculateStats(createProgression()),damageMultiplier:10};
 const result=simulateCombat(targets,stats,shotsOnly,()=>0,undefined,1);
 assert.equal(result.collateralKills,2);
 assert.equal(result.standardShots,1);
 assert.equal(enemyExperience('ship_turret',stage),18);
 assert.equal(enemyExperience('stage_aircraft',BALANCE.stages[2]),28);
});
