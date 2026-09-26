// Run via special-enemies.browser.html; isolated game instance, no production hooks.
import { launchStage } from '../src/game/missions.js';
import { enemies, clearFleet, spawnEnemy, spawnFormation } from '../src/enemies/fleet.js';
import { gameState } from '../src/core/state.js';
import { playerMesh } from '../src/player/player.js';
import { clearProjectiles, missiles } from '../src/combat/weapons.js';
import { updateEnemies, initEnemyAI } from '../src/enemies/ai.js';
import { scene, camera, renderer } from '../src/rendering/scene.js';
import { mechaFishModelTemplate } from '../src/assets/aircraft.js';
const output=parent.document.getElementById('result');
const check=(condition,message)=>{ if(!condition) throw new Error(message); };
const deadline=Date.now()+30000;
const ready=setInterval(()=>{
 if(!playerMesh || !mechaFishModelTemplate) {
  if(Date.now()>deadline) { clearInterval(ready);output.textContent='FAIL: asset initialization timed out'; }
  return;
 }
 clearInterval(ready);
 try {
  gameState.isPointerLockEnabled=false;
  launchStage(1); gameState.isGamePaused=true;
  gameState.jetExhaustSystem=null;
  output.textContent="Checking wave spawns…";
  check(enemies.filter(e=>e.isFishSchool).length===4,'first wave should include four fish');
  const initialCount=enemies.length; spawnFormation(8,{health:60,eliteCount:2});
  check(enemies.length===initialCount+8,'formation target budget');
  check(enemies.some(e=>e.isBomber),'elite wave should include a bomber');
  check(enemies.filter(e=>e.isFishSchool).every(e=>e.mesh.scale.x===4.5&&!e.isBoss),'fish size and ordinary role');
  const school=enemies.find(e=>e.isFishSchool).school;
  for(let i=0;i<120;i++) updateEnemies(1/60);
  check(school.members.every(e=>e.mesh.position.distanceTo(school.members[0].mesh.position)<500),'school spread');
  school.members[0].alive=false; scene.remove(school.members[0].mesh);
  for(let i=0;i<90;i++) updateEnemies(1/60);
  check(school.members.slice(1).every(e=>e.mesh.position.distanceTo(school.members[1].mesh.position)<500),'leader succession');
  clearFleet();clearProjectiles();initEnemyAI();
  const bomber=spawnEnemy(playerMesh.position.clone().add(new THREE.Vector3(0,0,-1500)),{bomber:true});
  bomber.missileCooldown=0;
  for(let i=0;i<100&&!missiles.length;i++) updateEnemies(1/60);
  check(missiles.length===4,'bomber should launch four missiles');
  const directions=missiles.map(m=>new THREE.Vector3(0,0,-1).applyQuaternion(m.mesh.quaternion));
  check(Math.abs(directions[0].dot(directions[1]))<0.001&&directions[0].dot(directions[2]) < -0.999,'cardinal launch directions');
  check(missiles.every(m=>m.homingDelay===0.9),'outward launch grace');
  // Present the actual models at close range for visual review.
  clearFleet();clearProjectiles();
  spawnFormation(4,{health:60});
  const fish=enemies.filter(e=>e.isFishSchool);
  fish.forEach((e,i)=>{e.mesh.position.set((i%2)*80-120,800,Math.floor(i/2)*90);e.mesh.rotation.set(0,0,0);});
  const model=spawnEnemy(new THREE.Vector3(100,800,0),{bomber:true});model.mesh.rotation.set(0,0,0);
  scene.attach(camera);camera.position.set(250,1080,370);camera.lookAt(0,800,40);
  document.getElementById('ui-overlay').style.display='none';
  document.getElementById('progression-hud').style.display='none';
  document.getElementById('hud-canvas').style.display='none';
  gameState.retroFilterEnabled=false; renderer.render(scene,camera);
  gameState.isGameRunning=false;
  output.textContent=`PASS · first-wave spawns · half-size fish · four-member formation · leader succession · four-direction bomber salvo
실제 모델: 왼쪽 물고기 4기 편대 / 오른쪽 중장갑 폭격기`;
 } catch(error) {gameState.isGameRunning=false;output.textContent='FAIL: '+error.stack;}
},200);
