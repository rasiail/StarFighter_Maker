import { cameraSyncBlend } from '../input/mouse-flight.js';
// camera/camera: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera, scene } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { activeDyingBosses } from '../enemies/lifecycle.js';
import { keys, mouseFlight } from '../input/state.js';
import { padInput } from '../input/gamepad-state.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { aimOutsideDeadzone } from '../player/mouse-aim.js';
import { cameraFollowOffset } from './follow.js';

export let cameraConfig;

export function updateCamera(delta) {
    const casualView = gameState.controlScheme === 'casual' && !gameState.isPlayerDead
        && !(keys.targetCam || padInput.targetCam) && !activeDyingBosses?.length;
    if (!casualView) cameraConfig.casualWorldQuaternion = null;
    if (gameState.isPlayerDead && gameState.playerCrashed && gameState.crashPosition) {
        if (camera.parent !== scene) {
            scene.attach(camera);
        }
        cameraConfig.targetFov = 58;
        camera.fov += (cameraConfig.targetFov - camera.fov) * (delta * 4);
        camera.updateProjectionMatrix();

        // 추락 지점 상공에서 내려다보는 앵글 (Overhead High-Angle View)
        const overheadOffset = new THREE.Vector3(25, 80, 35);
        const targetCamPos = gameState.crashPosition.clone().add(overheadOffset);
        const camLerp = 1.0 - Math.exp(-3.5 * delta);
        camera.position.lerp(targetCamPos, camLerp);
        camera.lookAt(gameState.crashPosition);
        return;
    }

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

    // 보스 격추 파괴 시네마틱 킬캠: 카메라가 월드 씬으로 분리되어 파괴 중인 거대 보스를 중심(Boss-Centered)으로 포커싱
    const dyingBoss = activeDyingBosses && activeDyingBosses[0];
    if (!gameState.isPlayerDead && dyingBoss && dyingBoss.mesh) {
        cameraConfig.targetFov = 58;
        camera.fov += (cameraConfig.targetFov - camera.fov) * (delta * 4);
        camera.updateProjectionMatrix();

        // 보스 선체 기준 전측방 상공 오프셋 (거리 약 110m, 높이 약 40m)
        const bossCamOffset = new THREE.Vector3(65, 38, 85);
        const targetCamPos = dyingBoss.mesh.position.clone().add(bossCamOffset);

        if (camera.parent !== scene) {
            scene.attach(camera);
            // 시네마틱 컷 전환: 보스 주변 시네마틱 앵글로 즉각 배치
            camera.position.copy(targetCamPos);
        } else {
            const camLerp = 1.0 - Math.exp(-5.0 * delta);
            camera.position.lerp(targetCamPos, camLerp);
        }
        camera.lookAt(dyingBoss.mesh.position);
        return;
    }

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

    } else if (casualView) {
        // Cancel inherited flight-root rotation. Translation still follows the
        // aircraft, while the persistent aim goal drives the independent view.
        if (!cameraConfig.casualWorldQuaternion) {
            cameraConfig.casualWorldQuaternion = playerMesh.quaternion.clone()
                .multiply(gameState.cameraPivot.quaternion);
        }
        const direction = mouseFlight.aimDirection;
        const viewAttitude = cameraConfig.casualWorldQuaternion.clone().multiply(camera.quaternion);
        const localAim = direction?.clone().applyQuaternion(viewAttitude.invert());
        const desired = direction ? new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(new THREE.Vector3(), direction, new THREE.Vector3(0, 1, 0)))
            .multiply(camera.quaternion.clone().invert()) : playerMesh.quaternion;
        const maxStep = Math.max(playerFlight.maxPitchRate, playerFlight.maxYawRate * 3) * delta;
        if (localAim && aimOutsideDeadzone(localAim, camera.fov, camera.aspect, gameState.casualDeadzonePercent)) {
            // Camera follows the persistent goal outside the zone, not mouse velocity.
            cameraConfig.casualWorldQuaternion.rotateTowards(desired, maxStep);
        } else {
            // Recenter only after mouse motion stops. Compensating the camera's
            // local tilt above brings AIM to screen center, not above it.
            const damped = cameraConfig.casualWorldQuaternion.clone().slerp(desired,
                cameraSyncBlend(mouseFlight.idle, delta));
            cameraConfig.casualWorldQuaternion.rotateTowards(damped, maxStep);
        }
        gameState.cameraPivot.quaternion.copy(playerMesh.quaternion).invert()
            .multiply(cameraConfig.casualWorldQuaternion);
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
        casualWorldQuaternion: null,
        freelookYaw: 0,
        freelookPitch: 0,
        freelookIdleTimer: 0
    };
}

export function resetCamera() {
    if (cameraConfig) cameraConfig.casualWorldQuaternion = null;
    if (!gameState.cameraPivot) return;
    if (camera.parent !== gameState.cameraPivot) {
        gameState.cameraPivot.add(camera);
    }
    const cameraOffset = cameraFollowOffset();
    camera.position.set(0, cameraOffset.y, cameraOffset.z);
    camera.rotation.set(-0.13, 0, 0);
    if (cameraConfig) {
        cameraConfig.freelookYaw = 0;
        cameraConfig.freelookPitch = 0;
        cameraConfig.freelookIdleTimer = 0;
        cameraConfig.targetFov = 65;
    }
}
