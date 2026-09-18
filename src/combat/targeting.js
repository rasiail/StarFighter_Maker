// combat/targeting: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { enemies } from '../enemies/fleet.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera } from '../rendering/scene.js';


export function acquireNextBestTarget() {
    const aliveList = [];
    enemies.forEach((e, idx) => {
        if (e.alive) {
            const dist = playerMesh.position.distanceTo(e.mesh.position);
            aliveList.push({ enemy: e, idx, dist });
        }
    });

    if (aliveList.length === 0) return null;

    // 거리순 정렬
    aliveList.sort((a, b) => a.dist - b.dist);

    // 카메라 정면 벡터와 가까운 적 우선 탐색
    const camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);
    const inFront = aliveList.find(item => {
        const toEnemy = item.enemy.mesh.position.clone().sub(camera.position).normalize();
        return camFwd.dot(toEnemy) > 0.15;
    });

    const chosen = inFront || aliveList[0];
    gameState.lockedEnemyIndex = chosen.idx;
    return chosen.enemy;
}
export function cycleTarget() {
    const aliveEnemies = enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return;

    // 카메라 위치 및 정면 방향 벡터
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const camFwd = new THREE.Vector3();
    camera.getWorldDirection(camFwd);

    const inViewList = [];
    const outViewList = [];

    enemies.forEach((enemy, idx) => {
        if (!enemy.alive) return;

        const toEnemy = enemy.mesh.position.clone().sub(camPos);
        const distToCam = toEnemy.length();
        const distToPlayer = playerMesh.position.distanceTo(enemy.mesh.position);

        // 카메라 정면 벡터와의 내적 (카메라 앞쪽에 위치하는지 확인)
        const dotCam = (distToCam > 0.1) ? camFwd.dot(toEnemy.clone().normalize()) : -1;

        // Three.js 투영 (NDC 좌표계: 화면 중심 0, 좌우/상하 -1.0 ~ 1.0)
        const proj = enemy.mesh.position.clone().project(camera);
        const isFront = (dotCam > 0.05 && proj.z < 1.0);
        // 화면 뷰포트 내(약간의 마진 포함 ±1.08)에 들어와 있는지 확인
        const isInScreen = isFront && (Math.abs(proj.x) <= 1.08 && Math.abs(proj.y) <= 1.08);

        const item = { idx, dist: distToPlayer, inScreen: isInScreen };
        if (isInScreen) {
            inViewList.push(item);
        } else {
            outViewList.push(item);
        }
    });

    // 거리순 (플레이어와 가까운 순서대로) 오름차순 정렬
    inViewList.sort((a, b) => a.dist - b.dist);
    outViewList.sort((a, b) => a.dist - b.dist);

    // [최우선 순위 개선]: 화면 안에 적이 1기라도 있으면 오직 화면 안의 적들만 거리순으로 순환!
    // 화면 안에 적이 아예 없을 때만 화면 밖의 적들을 거리순으로 순환
    const targetPool = (inViewList.length > 0) ? inViewList : outViewList;
    if (targetPool.length === 0) return;

    const curPos = targetPool.findIndex(item => item.idx === gameState.lockedEnemyIndex);
    if (curPos === -1) {
        // 현재 타깃이 화면 내에 없다면 -> 화면 내 가장 가까운 적(1순위)으로 즉각 포커싱
        gameState.lockedEnemyIndex = targetPool[0].idx;
    } else {
        // 화면 내 타깃들 사이에서 거리순으로 순환
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
        const maxLockRange = ((gameState.missileMode === 1) ? 2000 : 3000) * playerFlight.lockRangeMultiplier;
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
