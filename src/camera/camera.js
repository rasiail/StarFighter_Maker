// camera/camera: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { keys } from '../input/state.js';
import { padInput } from '../input/gamepad-state.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { cameraFollowOffset } from './follow.js';

export let cameraConfig;

export function updateCamera(delta) {
    // 속도에 따른 동적 FOV 조정
    const speedRatio = (playerFlight.speed - playerFlight.minSpeed) / (playerFlight.maxSpeed - playerFlight.minSpeed);
    cameraConfig.targetFov = 62 + speedRatio * 16;
    camera.fov += (cameraConfig.targetFov - camera.fov) * (delta * 6);
    camera.updateProjectionMatrix();

    if (!gameState.cameraPivot) return;

    // 속도에 따른 카메라-전투기 거리 제어
    // - 일반 속도(순항 속도 50% 이하): 기존 거리(12.5)의 75%인 9.375m
    // - 속도 80% 이상: 현재 기본 거리인 12.5m
    // - 50% ~ 80% 구간: 속도가 빨라짐에 따라 거리가 점진적으로 멀어짐
    // - 전투기 뒤쪽에 카메라가 위치할 때만 적용 (타깃 캠/프리룩으로 측면·전방 회전 시 기본 거리 12.5m 유지)
    const { y: targetY, z: targetZ } = cameraFollowOffset(
        speedRatio, gameState.cameraPivot.rotation.y, gameState.cameraPivot.rotation.x);

    const posLerp = 1.0 - Math.exp(-10.0 * delta);
    camera.position.x = 0;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, posLerp);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, posLerp);
    camera.rotation.set(-0.13, 0, 0);

    let targetEnemy = enemies[gameState.lockedEnemyIndex] && enemies[gameState.lockedEnemyIndex].alive ? enemies[gameState.lockedEnemyIndex] : null;

    if (gameState.isPlayerDead) {
        cameraConfig.freelookIdleTimer = 10.0;
        cameraConfig.freelookYaw = Math.PI * 0.75; // 대각선 앞 옆 각도 (135도)
        cameraConfig.freelookPitch = 0.1;
    }

    // 타깃 캠(우클릭 홀드) 중인데 기존 타깃이 격추/무효화된 경우, 즉시 다른 생존 적기를 자동 획득
    if (!gameState.isPlayerDead && (keys.targetCam || padInput.targetCam) && !targetEnemy) {
        targetEnemy = acquireNextBestTarget();
    }

    // 1. 타깃 캠 모드 (우클릭 홀드 또는 T키 시 적기 방향으로 카메라 피봇 회전)
    if (!gameState.isPlayerDead && (keys.targetCam || padInput.targetCam) && targetEnemy) {
        cameraConfig.freelookIdleTimer = 0;

        // 적기의 월드 좌표를 플레이어 로컬 공간으로 변환
        playerMesh.updateMatrixWorld(true);
        const localEnemyPos = targetEnemy.mesh.position.clone();
        playerMesh.worldToLocal(localEnemyPos);
        localEnemyPos.y -= 0.4; // 피봇(0, 0.4, 0) 높이 기준 상대 오프셋

        // 로컬 방향 각도 산출 (전방 -Z, 우측 +X, 상단 +Y)
        const distXZ = Math.hypot(localEnemyPos.x, localEnemyPos.z);
        // Pitch: 적기가 상단에 있으면 양수 회전 (수직 뒤집힘 방지 위해 ±83도 한계)
        const rawPitch = Math.atan2(localEnemyPos.y, Math.max(1.0, distXZ)) + 0.08;
        const targetPitch = THREE.MathUtils.clamp(rawPitch, -Math.PI * 0.46, Math.PI * 0.46);

        // Yaw: 적기 방위각 360도 전방위 추적 (-Z 기준 시계/반시계)
        const targetYaw = -Math.atan2(localEnemyPos.x, -localEnemyPos.z);

        // Yaw 각도 최단 경로 보간 (±180도 경계선 넘을 때 360도 급회전 방지)
        let diffYaw = targetYaw - gameState.cameraPivot.rotation.y;
        while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
        while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

        const camLerpFactor = 1.0 - Math.exp(-14.0 * delta);
        gameState.cameraPivot.rotation.y += diffYaw * camLerpFactor;
        gameState.cameraPivot.rotation.x = THREE.MathUtils.lerp(gameState.cameraPivot.rotation.x, targetPitch, camLerpFactor);
        gameState.cameraPivot.rotation.z = 0;

        // Yaw 회전각 정규화 (-PI ~ PI 유지로 누적 방지)
        gameState.cameraPivot.rotation.y = THREE.MathUtils.euclideanModulo(gameState.cameraPivot.rotation.y + Math.PI, Math.PI * 2) - Math.PI;

    } else {
        // 2. 프리룩 및 디폴트 시점 복귀 모드
        if (cameraConfig.freelookIdleTimer > 0) {
            cameraConfig.freelookIdleTimer -= delta;

            // 마우스 이동으로 쌓인 freelook 회전 각도로 카메라 피봇을 부드럽게 보간
            const camLerpFactor = 1.0 - Math.exp(-15.0 * delta);
            let diffYaw = cameraConfig.freelookYaw - gameState.cameraPivot.rotation.y;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

            gameState.cameraPivot.rotation.y += diffYaw * camLerpFactor;
            gameState.cameraPivot.rotation.x = THREE.MathUtils.lerp(gameState.cameraPivot.rotation.x, cameraConfig.freelookPitch, camLerpFactor);
            gameState.cameraPivot.rotation.z = 0;

            gameState.cameraPivot.rotation.y = THREE.MathUtils.euclideanModulo(gameState.cameraPivot.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
        } else {
            // 3. 타이머 종료 시: 전투기 후방 정면 뷰로 자동 복귀
            cameraConfig.freelookYaw = 0;
            cameraConfig.freelookPitch = 0;

            let currentYaw = THREE.MathUtils.euclideanModulo(gameState.cameraPivot.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
            gameState.cameraPivot.rotation.y = currentYaw;

            let diffYaw = -currentYaw;
            while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
            while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;

            // 신속하고 매끄럽게 정면 복귀
            const returnLerpFactor = 1.0 - Math.exp(-22.0 * delta);
            gameState.cameraPivot.rotation.y += diffYaw * returnLerpFactor;
            gameState.cameraPivot.rotation.x = THREE.MathUtils.lerp(gameState.cameraPivot.rotation.x, 0, returnLerpFactor);
            gameState.cameraPivot.rotation.z = 0;

            // 정면에 충분히 가까워지면 즉각 0으로 완전 고정
            if (Math.abs(diffYaw) < 0.001) gameState.cameraPivot.rotation.y = 0;
            if (Math.abs(gameState.cameraPivot.rotation.x) < 0.001) gameState.cameraPivot.rotation.x = 0;
        }
    }
}

export function initCamera() {
    cameraConfig = {
        idealOffset: new THREE.Vector3(0, 4.2, 17.5),
        idealLook: new THREE.Vector3(0, 1.2, -30),
        currentPos: new THREE.Vector3(0, 604, 1218),
        currentLook: new THREE.Vector3(0, 600, 1100),
        targetFov: 65,
        isTargetCamActive: false,
        freelookYaw: 0,
        freelookPitch: 0,
        freelookIdleTimer: 0
    };
}
