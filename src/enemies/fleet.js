import { createBomberMesh } from './bomber.js';
import { FISH_SCHOOL, BOMBER, schoolOffset } from './special-types.js';
// enemies/fleet: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { createBattleshipMesh, createTankMesh } from './models.js';
import { scene } from '../rendering/scene.js';
import { getSurfaceHeight, currentEnvironment } from '../world/environment.js';
import { createDroneMesh } from './drone.js';
import { createEliteMesh } from '../assets/aircraft.js';
import { playerMesh } from '../player/player.js';
import { BALANCE } from '../data/generated/balance.js';
import { formationKind, isEliteSpawn } from './formation.js';

const enemyData = BALANCE.enemies;
const spawnRules = Object.fromEntries(Object.entries(BALANCE.spawnRules).map(([key, rule]) => [key, rule.value]));

export let enemies;
export let activeSinkingShips;

function spawnBattleship(pos, headingAngle = 0, callsign = 'BATTLESHIP') {
    const shipMesh = createBattleshipMesh();
    shipMesh.position.set(pos.x, 0, pos.z);
    shipMesh.rotation.y = headingAngle;
    scene.add(shipMesh);

    // 전함의 전방 및 수평 벡터 산출
    const shipFwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), headingAngle);

    // 1. 전함 본체 타깃 (HULL)
    const hullTargetMesh = new THREE.Group();
    hullTargetMesh.position.set(pos.x, 12, pos.z);
    scene.add(hullTargetMesh);

    const hullEnemy = {
        mesh: hullTargetMesh,
        shipMesh: shipMesh,
        health: enemyData.ship_hull.health,
        maxHealth: enemyData.ship_hull.health,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: true,
        shipPart: 'HULL',
        alive: true,
        isSinking: false,
        sinkSpeed: 0,
        turretEnemies: [],
        callsign: `${callsign} [HULL]`,
        hitRadius: enemyData.ship_hull.hitRadiusM
    };

    // 2. 전방 함포 타깃 (GUN-A)
    const fwdPos = pos.clone().add(shipFwd.clone().multiplyScalar(50)).add(new THREE.Vector3(0, 15, 0));
    const fwdTargetMesh = new THREE.Group();
    fwdTargetMesh.position.copy(fwdPos);
    scene.add(fwdTargetMesh);

    const fwdGunEnemy = {
        mesh: fwdTargetMesh,
        turretMesh: shipMesh.fwdTurret,
        shipMesh: shipMesh,
        parentHullEnemy: hullEnemy,
        health: enemyData.ship_turret.health,
        maxHealth: enemyData.ship_turret.health,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: true,
        shipPart: 'TURRET',
        alive: true,
        fireCooldown: 1.5 + Math.random() * 2.0,
        callsign: `${callsign} [GUN-A]`,
        hitRadius: enemyData.ship_turret.hitRadiusM
    };

    // 3. 후방 함포 타깃 (GUN-B)
    const aftPos = pos.clone().add(shipFwd.clone().multiplyScalar(-50)).add(new THREE.Vector3(0, 15, 0));
    const aftTargetMesh = new THREE.Group();
    aftTargetMesh.position.copy(aftPos);
    scene.add(aftTargetMesh);

    const aftGunEnemy = {
        mesh: aftTargetMesh,
        turretMesh: shipMesh.aftTurret,
        shipMesh: shipMesh,
        parentHullEnemy: hullEnemy,
        health: enemyData.ship_turret.health,
        maxHealth: enemyData.ship_turret.health,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: true,
        shipPart: 'TURRET',
        alive: true,
        fireCooldown: 2.2 + Math.random() * 2.0,
        callsign: `${callsign} [GUN-B]`,
        hitRadius: enemyData.ship_turret.hitRadiusM
    };

    hullEnemy.turretEnemies = [fwdGunEnemy, aftGunEnemy];

    enemies.push(hullEnemy, fwdGunEnemy, aftGunEnemy);
    return hullEnemy;
}
function spawnGroundTank(pos, callsign) {
    const tankMesh = createTankMesh();
    const groundY = getSurfaceHeight(pos.x, pos.z);
    tankMesh.position.set(pos.x, groundY + 1.5, pos.z);
    scene.add(tankMesh);

    const enemy = {
        mesh: tankMesh,
        health: enemyData.tank.health,
        maxHealth: enemyData.tank.health,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: false,
        type: 'TANK',
        fireCooldown: 1.5 + Math.random() * 2.0,
        alive: true,
        callsign: callsign || `TANK-0${enemies.filter(e => e.isGround && !e.isShip).length + 1} [GND]`,
        turret: tankMesh.turret,
        hitRadius: enemyData.tank.hitRadiusM
    };
    enemies.push(enemy);
    return enemy;
}
export function spawnEnemy(pos, { health = 60, boss = false, elite = false, fish = false, bomber = false, altitudeOffset = 0 } = {}) {
    bomber = !boss && bomber;
    fish = !boss && !bomber && fish;
    elite = !boss && !fish && (elite || bomber);
    if (elite) health = enemyData.elite.health * (bomber ? BOMBER.healthMultiplier : 1);
    const groundY = getSurfaceHeight(pos.x, pos.z);
    pos.y = Math.max(groundY + 280, Math.min(1650, pos.y));

    const enemyMesh = bomber ? createBomberMesh() : elite ? createEliteMesh() : createDroneMesh(boss || fish);
    enemyMesh.userData.isBoss = boss;
    // 적기 크기: 원거리 및 도그파이트 시인성을 위해 2.5배로 크게 확대 설정
    enemyMesh.scale.setScalar(boss ? 9 : fish ? FISH_SCHOOL.scale : bomber ? BOMBER.scale : 2.5);
    enemyMesh.position.copy(pos);
    scene.add(enemyMesh);

    const enemy = {
        mesh: enemyMesh,
        health,
        maxHealth: health,
        isBoss: boss,
        isElite: elite,
        isFishSchool: fish,
        isBomber: bomber,
        hitRadius: bomber ? 28 : fish ? enemyData.boss.hitRadiusM * 0.5 : boss ? enemyData.boss.hitRadiusM : elite ? enemyData.elite.hitRadiusM : enemyData.stage_aircraft.hitRadiusM,
        speed: bomber ? BOMBER.speed : fish ? 280 : boss ? 240 : 340,
        velocity: new THREE.Vector3(0, 0, -1),
        altitudeOffset: boss ? 0 : altitudeOffset,
        state: 'PATROL', // PATROL, INTERCEPT, ENGAGE, EVADE
        patrolTimer: Math.random() * 5,
        patrolTarget: new THREE.Vector3(pos.x + 3000, pos.y, pos.z - 4000),
        fireCooldown: 1.5 + Math.random() * 2,
        missileCooldown: 3 + Math.random() * 5, // 적기 미사일 쿨다운
        evadeTimer: 0,     // 회피 잔여 시간
        evadeDir: null,    // 회피 목표 방향
        alive: true,
        isGround: false,
        isShip: false,
        type: 'AIR',
        callsign: `${bomber ? 'BOMBER' : fish ? 'FISH' : elite ? 'ELITE' : 'BANDIT'}-0${enemies.filter(e => !e.isGround).length + 1}`
    };
    enemies.push(enemy);
    return enemy;
}
export function clearFleet() {
    const objects = new Set();
    for (const enemy of [...enemies, ...activeSinkingShips]) {
        enemy.alive = false;
        if (enemy.mesh) objects.add(enemy.mesh);
        if (enemy.shipMesh) objects.add(enemy.shipMesh);
    }
    objects.forEach(object => scene.remove(object));
    enemies.length = activeSinkingShips.length = 0;
    gameState.lockedEnemyIndex = 0;
}

export function spawnFormation(count, options = {}) {
    let elitesRemaining = options.eliteCount || 0;
    let bomberSpawned = false;
    let schoolSpawned = false;
    for (let i = 0; i < count; i++) {
        // 플레이어 주변 사방 1500m ~ 3500m 반경에서 랜덤하게 스폰 (각도 및 거리 무작위)
        const angle = Math.random() * Math.PI * 2;
        const range = spawnRules.spawn_range_min + Math.random() * (spawnRules.spawn_range_max - spawnRules.spawn_range_min);
        const px = playerMesh.position.x + Math.sin(angle) * range;
        const pz = playerMesh.position.z + Math.cos(angle) * range;

        // 보스가 아니고 약 25% 확률로 지상(또는 해상) 병력 스폰
        const schoolReady = !options.boss && !schoolSpawned && count - i - elitesRemaining >= FISH_SCHOOL.size;
        let kind = options.boss || schoolReady || elitesRemaining >= count - i ? 'aircraft' : formationKind(count - i, currentEnvironment?.theme === 'OCEAN', Math.random());
        if (kind === 'ship' && count - i - elitesRemaining < 3) kind = 'aircraft';
        if (kind !== 'aircraft') {
            const isOcean = (currentEnvironment && currentEnvironment.theme === 'OCEAN');
            if (kind === 'ship') {
                // 해상 테마에서는 전함 스폰
                spawnBattleship(new THREE.Vector3(px, 0, pz), Math.random() * Math.PI * 2);
                i += 2; // The hull and its two turrets consume three target slots.
            } else {
                // 그 외 테마에서는 탱크 스폰
                spawnGroundTank(new THREE.Vector3(px, 0, pz));
            }
        } else {
            // 공중 병력 스폰: 에이스 컴뱃 스타일 고저차(Low/Mid/High) 분배 및 고도 상한 1650m 제한
            const groundY = getSurfaceHeight(px, pz);
            let py;
            let altOffset;
            if (options.boss) {
                py = Math.max(groundY + 450, 1150);
                altOffset = 0;
            } else {
                const roll = Math.random();
                if (roll < 0.3) {
                    // Low 레이어 (약 30%): 저고도 지형 활용 (지형 위 320m ~ 580m)
                    py = groundY + 320 + Math.random() * 260;
                    altOffset = -220 - Math.random() * 180;
                } else if (roll < 0.7) {
                    // Mid 레이어 (약 40%): 중고도 일반 순항 (850m ~ 1150m)
                    py = Math.max(groundY + 380, 850 + Math.random() * 300);
                    altOffset = (Math.random() - 0.5) * 200;
                } else {
                    // High 레이어 (약 30%): 고고도 요격 (1250m ~ 1600m)
                    py = Math.max(groundY + 480, 1250 + Math.random() * 350);
                    altOffset = 220 + Math.random() * 200;
                }
            }
            py = Math.max(groundY + 280, Math.min(1650, py));

            const pos = new THREE.Vector3(px, py, pz);
            if (schoolReady) {
                const school = { members: [] };
                for (let slot = 0; slot < FISH_SCHOOL.size; slot++) {
                    const fish = spawnEnemy(pos.clone(), { health: options.health, fish: true, altitudeOffset: altOffset });
                    fish.mesh.lookAt(playerMesh.position); fish.mesh.rotateY(Math.PI);
                    const offset = schoolOffset(slot);
                    fish.mesh.position.add(new THREE.Vector3(offset.x, offset.y, offset.z).applyQuaternion(fish.mesh.quaternion));
                    fish.school = school; fish.schoolSlot = slot;
                    fish.state = 'INTERCEPT'; school.members.push(fish);
                }
                schoolSpawned = true; i += FISH_SCHOOL.size - 1;
                continue;
            }
            let isElite = false;
            if (!options.boss && elitesRemaining > 0) {
                isElite = true;
                elitesRemaining--;
            }
            const bomber = isElite && !bomberSpawned;
            if (bomber) bomberSpawned = true;
            const enemy = spawnEnemy(pos, { ...options, elite: isElite, bomber, altitudeOffset: altOffset });
            enemy.mesh.lookAt(playerMesh.position);
            enemy.mesh.rotateY(Math.PI); // Aircraft nose points along local -Z.
            enemy.state = 'INTERCEPT';
        }
    }
}

export function spawnBoss(stage) {
    spawnFormation(1, { health: stage.bossHealth, boss: true });
    const boss = enemies[enemies.length - 1];
    boss.callsign = stage.bossName;
    return boss;
}

export function initEnemies() {
    enemies = [];
    activeSinkingShips = [];
}
