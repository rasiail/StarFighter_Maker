// combat/targeting: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { enemies } from '../enemies/fleet.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera } from '../rendering/scene.js';
import { BALANCE } from '../data/generated/balance.js';


export function evaluateTargetCandidates(options = {}) {
    const pMesh = options.playerMesh || playerMesh;
    const cam = options.camera || camera;
    const enemyList = options.enemies || enemies;

    if (!pMesh?.position || !cam) return { tier1: [], tier2: [], tier3: [] };

    if (typeof cam.updateMatrixWorld === 'function') {
        cam.updateMatrixWorld();
    }

    const camPos = new THREE.Vector3();
    if (typeof cam.getWorldPosition === 'function') cam.getWorldPosition(camPos);
    else if (cam.position) camPos.copy(cam.position);

    const camFwd = new THREE.Vector3();
    if (typeof cam.getWorldDirection === 'function') cam.getWorldDirection(camFwd);
    else camFwd.set(0, 0, -1);

    const playerFwd = new THREE.Vector3(0, 0, -1);
    if (pMesh.quaternion) playerFwd.applyQuaternion(pMesh.quaternion);

    const tier1 = []; // 화면 내 적 (isInScreen = true)
    const tier2 = []; // 화면 밖 전방 적 (isInScreen = false, dotPlayer > 0)
    const tier3 = []; // 플레이어 후방 적 (isInScreen = false, dotPlayer <= 0)

    enemyList.forEach((enemy, idx) => {
        if (!enemy?.alive || !enemy?.mesh?.position) return;

        const enemyPos = enemy.mesh.position;
        const distToPlayer = pMesh.position.distanceTo(enemyPos);

        // 플레이어 기수 기준 방향 벡터 및 내적 (전방: dotPlayer > 0, 후방: dotPlayer <= 0)
        const toEnemyFromPlayer = enemyPos.clone().sub(pMesh.position);
        const distP = toEnemyFromPlayer.length();
        const dotPlayer = distP > 0.1 ? playerFwd.dot(toEnemyFromPlayer.clone().normalize()) : 1;

        // 카메라 기준 로컬 Z 거리 확인 (Three.js 카메라는 -Z가 전방이므로 camSpacePos.z < -0.5)
        let isCameraFront = false;
        if (cam.matrixWorldInverse) {
            const camSpacePos = enemyPos.clone().applyMatrix4(cam.matrixWorldInverse);
            isCameraFront = camSpacePos.z < -0.5;
        } else {
            const toEnemyCam = enemyPos.clone().sub(camPos);
            isCameraFront = camFwd.dot(toEnemyCam.normalize()) > 0.1;
        }

        // 화면 뷰포트(NDC: -1.0 ~ 1.0) 투영 검사 (카메라 전방에 위치할 때만 유효)
        let isInScreen = false;
        if (isCameraFront && typeof enemyPos.clone().project === 'function') {
            const proj = enemyPos.clone().project(cam);
            isInScreen = (
                Math.abs(proj.x) <= 1.05 &&
                Math.abs(proj.y) <= 1.05 &&
                proj.z >= -1.0 &&
                proj.z <= 1.0
            );
        }

        const candidate = { enemy, idx, dist: distToPlayer, isInScreen, dotPlayer };

        if (isInScreen) {
            tier1.push(candidate);
        } else if (dotPlayer > 0) {
            tier2.push(candidate);
        } else {
            tier3.push(candidate);
        }
    });

    // 모든 티어는 플레이어와의 거리 기준 오름차순(가까운 적 우선) 정렬
    tier1.sort((a, b) => a.dist - b.dist);
    tier2.sort((a, b) => a.dist - b.dist);
    tier3.sort((a, b) => a.dist - b.dist);

    return { tier1, tier2, tier3 };
}

export function acquireNextBestTarget() {
    const { tier1, tier2, tier3 } = evaluateTargetCandidates();

    // 1순위: 화면에 보이는 적들 중 가장 가까운 대상
    // 2순위: 화면에 안 보이지만 플레이어 전방에 있는 적들 중 가장 가까운 대상
    // 3순위: 전방에도 적이 없을 때 후방의 적들 중 가장 가까운 대상
    const targetPool = tier1.length > 0 ? tier1 : (tier2.length > 0 ? tier2 : tier3);
    if (targetPool.length === 0) return null;

    const chosen = targetPool[0];
    gameState.lockedEnemyIndex = chosen.idx;
    return chosen.enemy;
}

export function cycleTarget() {
    const { tier1, tier2, tier3 } = evaluateTargetCandidates();

    // 1순위: 화면에 보이는 적이 1기라도 있으면 오직 화면 내 적들만 순환
    // 2순위: 화면에 적이 없을 때 전방 적들 순환
    // 3순위: 전방에도 적이 없을 때만 후방 적들 순환
    const targetPool = tier1.length > 0 ? tier1 : (tier2.length > 0 ? tier2 : tier3);
    if (targetPool.length === 0) return;

    const curPos = targetPool.findIndex(item => item.idx === gameState.lockedEnemyIndex);
    if (curPos === -1) {
        // 현재 잡고 있던 타깃이 해당 풀에 없다면 1순위(화면 내 가장 가까운 적)로 즉시 전환
        gameState.lockedEnemyIndex = targetPool[0].idx;
    } else {
        // 동일 풀 내에서 거리순으로 다음 타깃 순환
        gameState.lockedEnemyIndex = targetPool[(curPos + 1) % targetPool.length].idx;
    }
}

export function initTargeting() {
    gameState.lockedEnemyIndex = 0;
}

export function updateTargeting() {
    // 4. Target Acquisition & Missile Lock-on Reticle (전투기 기수 전방 콘 기준)
    const playerFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);

    // 1단계: 모든 적기에 대해 플레이어 전투기 기수 전방 각도 및 거리 계산
    enemies.forEach((enemy) => {
        if (!enemy.alive) {
            enemy.isLocked = false;
            enemy.isMultiLock = false;
            enemy.inCone = false;
            return;
        }
        const toEnemy = enemy.mesh.position.clone().sub(playerMesh.position);
        const dist = toEnemy.length();
        const dir = toEnemy.clone().normalize();
        const dot = playerFwd.dot(dir);

        enemy.distToPlayer = Math.round(dist);
        enemy.dotForward = dot;

        // 미사일 종류에 따른 사거리(락온 거리) 분리: 표준 2000m, 멀티 3000m
        const weapon = gameState.missileMode === 1 ? BALANCE.weapons.standard_missile : BALANCE.weapons.multi_missile;
        const maxLockRange = weapon.lockRangeM * playerFlight.lockRangeMultiplier;
        // 전투기 기수 전방 약 36도 이내(dot > 0.80) & 유효 사거리 이내
        enemy.inCone = (dot > 0.80 && dist <= maxLockRange);

        enemy.isLocked = false;
        enemy.isMultiLock = false;
    });

    // 2단계: 무기 모드(1번 표준 vs 2번 멀티)에 따른 락온 대상 확정
    let currentLockedEnemy = enemies[gameState.lockedEnemyIndex] && enemies[gameState.lockedEnemyIndex].alive ? enemies[gameState.lockedEnemyIndex] : null;
    if (!currentLockedEnemy) {
        currentLockedEnemy = acquireNextBestTarget();
    }

    if (gameState.missileMode === 1) {
        // [모드 1] 표준 미사일: 오직 현재 지정된 타깃만 기수 전방 콘 내에 있을 때 락온!
        if (currentLockedEnemy && currentLockedEnemy.inCone) {
            currentLockedEnemy.isLocked = true;
        }
    } else {
        // [모드 2] 멀티 미사일: 현재 타깃을 최우선으로 하되, 전방 콘 내 다른 적들도 함께 멀티 락온 (최대 4기)
        let lockedCount = 0;
        if (currentLockedEnemy && currentLockedEnemy.inCone) {
            currentLockedEnemy.isLocked = true;
            lockedCount++;
        }

        // 타깃 외에 전방 콘 내에 있는 다른 적기들 각도 순 정렬 후 추가 락온
        const otherCandidates = enemies
            .filter((e, idx) => e.alive && idx !== gameState.lockedEnemyIndex && e.inCone)
            .sort((a, b) => b.dotForward - a.dotForward);

        for (const other of otherCandidates) {
            if (lockedCount >= playerFlight.multiLockCount) break;
            other.isLocked = true;
            other.isMultiLock = true;
            lockedCount++;
        }
    }

}
