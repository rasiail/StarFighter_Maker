// camera/camera: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera, scene } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { activeDyingBosses } from '../enemies/lifecycle.js';
import { keys, mouseFlight } from '../input/state.js';
import { padInput } from '../input/gamepad-state.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { cameraFollowOffset, CAMERA_FOLLOW_PITCH, stepCameraRollLag, stepCameraRotationLag } from './follow.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { createHitShake, addHitShake, stepHitShake } from './hit-shake.js';

export let cameraConfig;
let hitShake = createHitShake();
let unsubscribeHit;

export function updateCamera(delta) {
    // Strip last frame's chase offsets before processing free-look and return
    // controls, so they never mistake camera inertia for user look input.
    if (gameState.cameraPivot && cameraConfig.chaseLagApplied) {
        gameState.cameraPivot.rotation.x -= cameraConfig.pitchLag || 0;
        gameState.cameraPivot.rotation.y -= cameraConfig.yawLag || 0;
    }
    cameraConfig.chaseLagApplied = false;
    cameraConfig.hitShake = stepHitShake(hitShake, delta);
    if (gameState.isPlayerDead || hitShake.strength === 0) cameraConfig.hitShake = null;
    const casualView = gameState.controlScheme === 'casual' && !gameState.isPlayerDead
        && !cameraConfig.padFreelook
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

    const dyingBoss = activeDyingBosses?.[0];
    if (!gameState.isPlayerDead && dyingBoss?.mesh) {
        if (cameraConfig.bossShot?.mesh !== dyingBoss.mesh) {
            // Capture the entry angle once so the camera follows translation without tumbling.
            cameraConfig.bossShot = {
                mesh: dyingBoss.mesh,
                offset: new THREE.Vector3(65, 38, 85).applyQuaternion(dyingBoss.mesh.quaternion),
            };
        }
        if (camera.parent !== scene) scene.attach(camera);
        camera.position.copy(dyingBoss.mesh.position).add(cameraConfig.bossShot.offset);
        camera.lookAt(dyingBoss.mesh.position);
        cameraConfig.targetFov = 58;
        camera.fov += (58 - camera.fov) * (1 - Math.exp(-4 * delta));
        camera.updateProjectionMatrix();
        return;
    }
    if (cameraConfig.bossShot) {
        cameraConfig.bossShot = null;
        resetCamera();
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
    camera.rotation.set(CAMERA_FOLLOW_PITCH, 0, 0);

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
        const desired = direction ? new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(new THREE.Vector3(), direction, new THREE.Vector3(0, 1, 0)))
            .multiply(camera.quaternion.clone().invert()) : playerMesh.quaternion;
        // Fixed view speed independent of aircraft performance, without a deadzone.
        const viewSpeed = cameraConfig.padFreelookReturning ? 0.8 : 1.8;
        cameraConfig.casualWorldQuaternion.rotateTowards(desired, viewSpeed * delta);
        if (cameraConfig.padFreelookReturning && cameraConfig.casualWorldQuaternion.angleTo(desired) < 0.01) {
            cameraConfig.padFreelookReturning = false;
        }
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(cameraConfig.casualWorldQuaternion);
        cameraConfig.casualWorldQuaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(
            new THREE.Vector3(), forward, new THREE.Vector3(0, 1, 0)));
        gameState.cameraPivot.quaternion.copy(playerMesh.quaternion).invert()
            .multiply(cameraConfig.casualWorldQuaternion);
    } else {
        // 2. 프리룩 및 디폴트 시점 복귀 모드
        if (cameraConfig.padFreelook || cameraConfig.freelookIdleTimer > 0) {
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

            // Ease back more slowly after releasing the controller's look stick.
            const returnSpeed = cameraConfig.padFreelookReturning ? 4.0 : 22.0;
            const returnLerpFactor = 1.0 - Math.exp(-returnSpeed * delta);
            gameState.cameraPivot.rotation.y += diffYaw * returnLerpFactor;
            gameState.cameraPivot.rotation.x = THREE.MathUtils.lerp(gameState.cameraPivot.rotation.x, 0, returnLerpFactor);
            gameState.cameraPivot.rotation.z = 0;

            // 정면에 충분히 가까워지면 즉각 0으로 완전 고정
            if (Math.abs(diffYaw) < 0.001) gameState.cameraPivot.rotation.y = 0;
            if (Math.abs(gameState.cameraPivot.rotation.x) < 0.001) gameState.cameraPivot.rotation.x = 0;
            if (gameState.cameraPivot.rotation.y === 0 && gameState.cameraPivot.rotation.x === 0) {
                cameraConfig.padFreelookReturning = false;
            }
        }
    }

    // Apply rotation lag only to the normal aircraft-relative chase view. Casual
    // flight keeps its existing world-level horizon; orbit/cinematic views keep
    // their own orientation.
    const chaseView = !casualView && !gameState.isPlayerDead
        && !(keys.targetCam || padInput.targetCam)
        && !cameraConfig.padFreelook && cameraConfig.freelookIdleTimer <= 0
        && Math.abs(gameState.cameraPivot.rotation.y) < 0.01
        && Math.abs(gameState.cameraPivot.rotation.x) < 0.01;
    cameraConfig.rollLag = chaseView
        ? stepCameraRollLag(cameraConfig.rollLag ?? 0, playerFlight.rollRate, delta) : 0;
    cameraConfig.pitchLag = chaseView
        ? stepCameraRotationLag(cameraConfig.pitchLag ?? 0, playerFlight.pitchRate, delta) : 0;
    cameraConfig.yawLag = chaseView
        ? stepCameraRotationLag(cameraConfig.yawLag ?? 0, playerFlight.yawRate, delta) : 0;
    if (chaseView) {
        gameState.cameraPivot.rotation.x += cameraConfig.pitchLag;
        gameState.cameraPivot.rotation.y += cameraConfig.yawLag;
        gameState.cameraPivot.rotation.z = cameraConfig.rollLag;
        cameraConfig.chaseLagApplied = true;
    }
}

export function initCamera() {
    unsubscribeHit?.();
    hitShake = createHitShake();
    unsubscribeHit = gameEvents.on(EVENTS.PLAYER_HIT, ({ damage }) => addHitShake(hitShake, damage));
    cameraConfig = {
        idealOffset: new THREE.Vector3(0, 4.2, 17.5),
        idealLook: new THREE.Vector3(0, 1.2, -30),
        currentPos: new THREE.Vector3(0, 604, 1218),
        currentLook: new THREE.Vector3(0, 600, 1100),
        targetFov: 65,
        isTargetCamActive: false,
        casualWorldQuaternion: null,
        padFreelookReturning: false,
        rollLag: 0,
        pitchLag: 0,
        yawLag: 0,
        chaseLagApplied: false,
        hitShake: null,
        freelookYaw: 0,
        freelookPitch: 0,
        freelookIdleTimer: 0
    };
}

export function resetCamera() {
    if (gameState.cameraPivot && cameraConfig?.chaseLagApplied) {
        gameState.cameraPivot.rotation.x -= cameraConfig.pitchLag || 0;
        gameState.cameraPivot.rotation.y -= cameraConfig.yawLag || 0;
    }
    if (cameraConfig) cameraConfig.pitchLag = cameraConfig.yawLag = 0;
    if (cameraConfig) cameraConfig.chaseLagApplied = false;
    if (cameraConfig) cameraConfig.rollLag = 0;
    if (gameState.cameraPivot) gameState.cameraPivot.rotation.z = 0;
    if (cameraConfig) cameraConfig.padFreelookReturning = false;
    if (cameraConfig) cameraConfig.padFreelook = false;
    if (cameraConfig) cameraConfig.bossShot = null;
    hitShake = createHitShake();
    if (cameraConfig) cameraConfig.hitShake = null;
    if (cameraConfig) cameraConfig.casualWorldQuaternion = null;
    if (!gameState.cameraPivot) return;
    if (camera.parent !== gameState.cameraPivot) {
        gameState.cameraPivot.add(camera);
    }
    const cameraOffset = cameraFollowOffset();
    camera.position.set(0, cameraOffset.y, cameraOffset.z);
    camera.rotation.set(CAMERA_FOLLOW_PITCH, 0, 0);
    if (cameraConfig) {
        cameraConfig.freelookYaw = 0;
        cameraConfig.freelookPitch = 0;
        cameraConfig.freelookIdleTimer = 0;
        cameraConfig.targetFov = 65;
    }
}
