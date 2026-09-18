// enemies/fleet: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { createBattleshipMesh, createTankMesh } from './models.js';
import { scene } from '../rendering/scene.js';
import { getSurfaceHeight } from '../world/environment.js';
import { createDroneMesh } from './drone.js';
import { playerMesh } from '../player/player.js';

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
        health: 300,
        maxHealth: 300,
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
        hitRadius: 38.0 // 거대 선체 피격 판정 반경
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
        health: 100,
        maxHealth: 100,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: true,
        shipPart: 'TURRET',
        alive: true,
        fireCooldown: 1.5 + Math.random() * 2.0,
        callsign: `${callsign} [GUN-A]`,
        hitRadius: 18.0
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
        health: 100,
        maxHealth: 100,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: true,
        shipPart: 'TURRET',
        alive: true,
        fireCooldown: 2.2 + Math.random() * 2.0,
        callsign: `${callsign} [GUN-B]`,
        hitRadius: 18.0
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
        health: 120,
        maxHealth: 120,
        speed: 0,
        velocity: new THREE.Vector3(0, 0, 0),
        state: 'DEFEND',
        isGround: true,
        isShip: false,
        type: 'TANK',
        fireCooldown: 1.5 + Math.random() * 2.0,
        alive: true,
        callsign: callsign || `TANK-0${enemies.filter(e => e.isGround && !e.isShip).length + 1} [GND]`,
        turret: tankMesh.turret
    };
    enemies.push(enemy);
    return enemy;
}
export function spawnEnemy(pos, { health = 80, boss = false } = {}) {
    const groundY = getSurfaceHeight(pos.x, pos.z);
    pos.y = Math.max(pos.y, Math.max(750, groundY + 400));

    const enemyMesh = createDroneMesh(boss);
    enemyMesh.userData.isBoss = boss;
    // 적기 크기: 원거리 및 도그파이트 시인성을 위해 2.5배로 크게 확대 설정
    enemyMesh.scale.setScalar(boss ? 9 : 2.5);
    enemyMesh.position.copy(pos);
    scene.add(enemyMesh);

    const enemy = {
        mesh: enemyMesh,
        health,
        maxHealth: health,
        isBoss: boss,
        hitRadius: boss ? 65 : 20,
        speed: boss ? 240 : 340,
        velocity: new THREE.Vector3(0, 0, -1),
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
        callsign: `BANDIT-0${enemies.filter(e => !e.isGround).length + 1}`
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
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
    const base = Math.atan2(forward.x, forward.z);
    for (let i = 0; i < count; i++) {
        // Squadrons of six spread across the forward sector, in depth.
        const group = Math.floor(i / 6);
        const angle = base + ((group % 5) - 2) * 0.20 + (i % 6 - 2.5) * 0.055;
        const range = 1400 + group * 130 + (i % 2) * 80;
        const pos = new THREE.Vector3(playerMesh.position.x + Math.sin(angle) * range, playerMesh.position.y + 180 + group * 35, playerMesh.position.z + Math.cos(angle) * range);
        const enemy = spawnEnemy(pos, options);
        enemy.mesh.lookAt(playerMesh.position);
        enemy.mesh.rotateY(Math.PI); // Aircraft nose points along local -Z.
        enemy.state = 'INTERCEPT';
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
