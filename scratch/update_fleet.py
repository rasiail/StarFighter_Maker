import os
import re

with open('src/enemies/fleet.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Add import
if 'import { createEliteMesh }' not in js:
    js = js.replace('import { createDroneMesh } from \'./drone.js\';', 'import { createDroneMesh } from \'./drone.js\';\nimport { createEliteMesh } from \'../assets/aircraft.js\';')

# Update spawnEnemy signature and logic
spawnEnemy_orig = '''export function spawnEnemy(pos, { health = 80, boss = false } = {}) {
    const groundY = getSurfaceHeight(pos.x, pos.z);
    pos.y = Math.max(pos.y, Math.max(750, groundY + 400));

    const enemyMesh = createDroneMesh(boss);
    enemyMesh.userData.isBoss = boss;
    // 기체 크기: 시각적 업그레이드 확인을 위해 2.5배로 크게 뷰 설정
    enemyMesh.scale.setScalar(boss ? 9 : 2.5);
    enemyMesh.position.copy(pos);
    scene.add(enemyMesh);'''

spawnEnemy_new = '''export function spawnEnemy(pos, { health = 80, boss = false, elite = false } = {}) {
    const groundY = getSurfaceHeight(pos.x, pos.z);
    pos.y = Math.max(pos.y, Math.max(750, groundY + 400));

    let enemyMesh;
    if (elite) {
        enemyMesh = createEliteMesh();
        enemyMesh.userData.isBoss = false;
        enemyMesh.userData.isElite = true;
    } else {
        enemyMesh = createDroneMesh(boss);
        enemyMesh.userData.isBoss = boss;
        // 기체 크기: 시각적 업그레이드 확인을 위해 2.5배로 크게 뷰 설정
        enemyMesh.scale.setScalar(boss ? 9 : 2.5);
    }
    enemyMesh.position.copy(pos);
    scene.add(enemyMesh);'''

js = js.replace(spawnEnemy_orig, spawnEnemy_new)

# Fix health assignment in spawnEnemy
health_orig = '''    const enemy = {
        mesh: enemyMesh,
        health,
        maxHealth: health,
        isBoss: boss,
        speed: boss ? 320 : 250,'''

health_new = '''    const enemy = {
        mesh: enemyMesh,
        health,
        maxHealth: health,
        isBoss: boss,
        isElite: elite,
        speed: boss ? 320 : (elite ? 380 : 250),'''

js = js.replace(health_orig, health_new)

# Fix hitRadius
hit_orig = '''        hitRadius: boss ? enemyData.boss.hitRadiusM : enemyData.stage_aircraft.hitRadiusM,
        type: boss ? 'BOSS' : 'FIGHTER','''

hit_new = '''        hitRadius: boss ? enemyData.boss.hitRadiusM : (elite ? enemyData.elite.hitRadiusM : enemyData.stage_aircraft.hitRadiusM),
        type: boss ? 'BOSS' : (elite ? 'ELITE' : 'FIGHTER'),'''

js = js.replace(hit_orig, hit_new)

# Update spawnFormation to spawn elites
# find the else block for kind === 'aircraft'
form_orig = '''        if (kind !== 'aircraft') {
            const isOcean = (currentEnvironment && currentEnvironment.theme === 'OCEAN');
            if (kind === 'ship') {
                // 해상 테마에서만 함선 스폰
                spawnBattleship(new THREE.Vector3(px, 0, pz), Math.random() * Math.PI * 2);
                i += 2; // The hull and its two turrets consume three target slots.
            } else {
                spawnGroundTank(new THREE.Vector3(px, 0, pz), 'TANK-' + Math.floor(Math.random() * 9999));
            }
        } else {
            spawnEnemy(new THREE.Vector3(px, 0, pz), {
                health: options.health || enemyData.stage_aircraft.health,
                boss: options.boss
            });
        }'''

form_new = '''        if (kind !== 'aircraft') {
            const isOcean = (currentEnvironment && currentEnvironment.theme === 'OCEAN');
            if (kind === 'ship') {
                // 해상 테마에서만 함선 스폰
                spawnBattleship(new THREE.Vector3(px, 0, pz), Math.random() * Math.PI * 2);
                i += 2; // The hull and its two turrets consume three target slots.
            } else {
                spawnGroundTank(new THREE.Vector3(px, 0, pz), 'TANK-' + Math.floor(Math.random() * 9999));
            }
        } else {
            const isElite = !options.boss && Math.random() < 0.20; // 20% chance for Elite
            spawnEnemy(new THREE.Vector3(px, 0, pz), {
                health: options.boss ? options.health : (isElite ? enemyData.elite.health : (options.health || enemyData.stage_aircraft.health)),
                boss: options.boss,
                elite: isElite
            });
        }'''

if 'const isElite = !options.boss' not in js:
    js = js.replace(form_orig, form_new)

with open('src/enemies/fleet.js', 'w', encoding='utf-8') as f:
    f.write(js)
print('fleet.js patched')
