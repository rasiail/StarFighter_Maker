import { resolveFlightKeys, targetFollowActive } from '../input/flight-keys.js';
import { moveAimDirection, mouseAimRates } from './mouse-aim.js';
import { camera } from '../rendering/scene.js';
import { consumeMouseMotion } from '../input/mouse-flight.js';
// player/flight: imports are side-effect free; main.js controls initialization.
import { tickMagazines } from '../combat/magazine.js';
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh, playerVisual } from './player.js';
import { keys as heldKeys, mouseFlight } from '../input/state.js';
import { levelingRates, focusRates } from './casual.js';
import { enemies } from '../enemies/fleet.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { padInput } from '../input/gamepad-state.js';
import { fbxModelTemplate, isFBXReady } from '../assets/aircraft.js';
import { audio } from '../audio/audio.js';
import { getSurfaceHeight } from '../world/environment.js';
import { triggerExplosion } from '../effects/particles.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { fireCannon, tryFireMissile, updateWeaponHUD, updateBeam } from '../combat/weapons.js';


export function updatePlayerFlight(delta) {
    consumeMouseMotion(mouseFlight, delta);
    const keys = resolveFlightKeys(heldKeys, gameState.controlScheme, heldKeys.targetCam || padInput.targetCam);
    // ─── 속도 제어 (에이스 컴뱃식 크루즈 자동 복귀 시스템) ─────────────
    // Shift 홀드: 최대 속도(950kts, THR 100%)까지 점진적 가속
    // Ctrl 홀드:  최소 속도(150kts, THR 0%)까지 점진적 감속
    // 키 해제 시:  평균 순항 속도(cruiseSpeed = 550kts, THR 50%)로 부드럽게 자동 복귀
    const cruiseSpd = playerFlight.cruiseSpeed; // 550 kts (THR 50% 기준 속도)
    const minSpd    = playerFlight.minSpeed;    // 150 kts (THR 0% 최저 실속 한계)
    const maxSpd    = playerFlight.maxSpeed;    // 950 kts (THR 100% 최대 애프터버너)
    const accel     = playerFlight.acceleration;
    const decel     = playerFlight.deceleration || accel;

    if (keys.throttleUp || keys.casualThrottleUp || padInput.throttleUp) {
        // 가속: 최대 속도까지 신속한 가속
        playerFlight.speed = Math.min(maxSpd, playerFlight.speed + delta * accel);
    } else if (keys.throttleDown || keys.casualThrottleDown || padInput.throttleDown) {
        // 감속: 에어브레이크를 통한 신속한 감속
        playerFlight.speed = Math.max(minSpd, playerFlight.speed - delta * decel);
    } else {
        // 키를 떼면 평균 순항 속도(550kts, 50% THR)로 부드럽게 복귀
        const diff = cruiseSpd - playerFlight.speed;
        if (Math.abs(diff) < 1.0) {
            playerFlight.speed = cruiseSpd;
        } else {
            playerFlight.speed += diff * (delta * 1.25);
        }
    }

    // throttlePercent: HUD 게이지 표시 및 엔진 파티클 세기용 (실제 속도에서 역산)
    const speedRatio = (playerFlight.speed - minSpd) / (maxSpd - minSpd);
    playerFlight.throttlePercent = Math.round(speedRatio * 100);

    playerFlight.isAfterburner = playerFlight.speed > 800; // 800kts (약 THR 81%) 이상에서 애프터버너 점화
    playerFlight.isAirbrake    = (keys.throttleDown || keys.casualThrottleDown || padInput.throttleDown) && playerFlight.speed < 320; // 320kts 이하 감속 중 에어브레이크

    // Thruster visual update: 내부 노즐 코어 발광 및 로우폴리곤 덩어리 파티클 방출
    const glows = playerVisual.baseGlows || (playerVisual.baseGlow ? [playerVisual.baseGlow] : []);
    glows.forEach(glow => {
        const glowScale = (playerFlight.isAfterburner ? 1.4 : 1.0) * (0.85 + Math.random() * 0.25);
        glow.scale.set(glowScale, glowScale, glowScale);
        glow.material.color.setHex(playerFlight.isAfterburner ? 0x66ddff : 0xffaa22);
    });

    // 로우폴리곤 덩어리 쓰러스터 파티클 방출 (기체 로컬 좌표계로 전달하여 항상 노즐에 밀착)
    if (gameState.jetExhaustSystem && playerFlight.throttlePercent > 5) {
        const localNozzle = (isFBXReady && fbxModelTemplate)
            ? new THREE.Vector3(0, -0.38, 4.55)
            : new THREE.Vector3(0, 0, 5.3);

        const spawnCount = playerFlight.isAfterburner ? 3 : (playerFlight.throttlePercent > 45 ? 2 : 1);
        for (let k = 0; k < spawnCount; k++) {
            gameState.jetExhaustSystem.spawn(
                playerVisual,
                localNozzle,
                playerFlight.isAfterburner,
                playerFlight.throttlePercent / 100,
                false
            );
        }
    }

    // Audio throttle update
    audio.setEngineThrottle(playerFlight.throttlePercent / 100, playerFlight.isAfterburner);

    // Rotational Inputs (6-DOF with inertia lerp)
    const maxPitchRate = playerFlight.maxPitchRate;
    const maxRollRate = playerFlight.maxRollRate;
    const maxYawRate = playerFlight.maxYawRate;

    // W: Pitch Down (기수 하강 / Dive), S: Pitch Up (기수 상승 / Climb)
    const casual = gameState.controlScheme === 'casual';
    let targetPitch = padInput.pitch * maxPitchRate;
    if (keys.pitchDown) targetPitch -= maxPitchRate; // W: 기수 하강 (음수 회전 = Dive)
    if (keys.pitchUp) targetPitch += maxPitchRate;   // S: 기수 상승 (양수 회전 = Climb)

    let targetRoll = padInput.roll * maxRollRate;
    if (keys.rollLeft) targetRoll += maxRollRate;    // A: 롤 좌측
    if (keys.rollRight) targetRoll -= maxRollRate;   // D: 롤 우측

    let targetYaw = padInput.yaw * maxYawRate;
    if (keys.yawLeft) targetYaw += maxYawRate;       // Q: 요 좌측
    if (keys.yawRight) targetYaw -= maxYawRate;      // E: 요 우측

    let focus = null;
    let aim = null;
    // Target-follow is shared by both schemes; physical WASD always wins.
    if (targetFollowActive(gameState.targetFollowEnabled, keys, padInput)) {
        const locked = enemies[gameState.lockedEnemyIndex];
        const target = locked?.alive ? locked : acquireNextBestTarget();
        if (target?.mesh) {
            const direction = target.mesh.position.clone().sub(playerMesh.position);
            focus = focusRates(direction.clone().applyQuaternion(playerMesh.quaternion.clone().invert()), maxPitchRate, maxYawRate);
            if (casual && direction.lengthSq() >= 1) mouseFlight.aimDirection = direction.normalize();
        }
    }
    if (!casual && focus) {
        targetPitch = focus.pitch;
        targetYaw = focus.yaw;
        if (targetRoll === 0) {
            const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerMesh.quaternion.clone().invert());
            targetRoll = levelingRates(localUp, maxPitchRate, maxRollRate).roll;
        }
    }
    if (casual) {
        if (!mouseFlight.aimDirection) mouseFlight.aimDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
        const view = camera.getWorldQuaternion(new THREE.Quaternion());
        const moved = moveAimDirection(mouseFlight.aimDirection, mouseFlight.frameX, mouseFlight.frameY,
            new THREE.Vector3(1, 0, 0).applyQuaternion(view), new THREE.Vector3(0, 1, 0).applyQuaternion(view));
        mouseFlight.aimDirection.set(moved.x, moved.y, moved.z);
        const inverseAttitude = playerMesh.quaternion.clone().invert();
        const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(inverseAttitude);
        const manualRoll = keys.rollLeft || keys.rollRight || padInput.roll !== 0;
        playerFlight.casualRollIdle = manualRoll ? 0 : (playerFlight.casualRollIdle ?? 1) + delta;
        // Local goal coordinates naturally blend horizontal input into pitch when banked.
        aim = mouseAimRates(mouseFlight.aimDirection.clone().applyQuaternion(inverseAttitude), maxPitchRate, maxYawRate);
        if (!padInput.pitch && !keys.pitchUp && !keys.pitchDown) targetPitch = aim.pitch;
        if (!padInput.yaw && !keys.yawLeft && !keys.yawRight) targetYaw = aim.yaw;
        if (!manualRoll && playerFlight.casualRollIdle >= 0.75) {
            const bank = Math.atan2(localUp.x, localUp.y);
            const desiredBank = Math.max(-0.9, Math.min(0.9, aim.yaw * 1.2));
            const error = Math.atan2(Math.sin(desiredBank - bank), Math.cos(desiredBank - bank));
            targetRoll = Math.hypot(localUp.x, localUp.y) < 0.05 ? 0 : error * 2;
        }
    }

    targetPitch = Math.max(-maxPitchRate, Math.min(maxPitchRate, targetPitch));
    targetRoll = Math.max(-maxRollRate, Math.min(maxRollRate, targetRoll));
    const yawLimit = casual ? Math.max(maxYawRate, Math.min(maxPitchRate * 0.55, maxYawRate * 2))
        : focus ? Math.max(maxPitchRate, maxYawRate * 3) : maxYawRate;
    targetYaw = Math.max(-yawLimit, Math.min(yawLimit, targetYaw));

    playerFlight.pitchRate += (targetPitch - playerFlight.pitchRate) * Math.min(1, delta * 7.0 * ((targetPitch === 0 || Math.sign(targetPitch) !== Math.sign(playerFlight.pitchRate)) ? playerFlight.stabilityMultiplier : 1));
    playerFlight.rollRate += (targetRoll - playerFlight.rollRate) * Math.min(1, delta * 9.0 * ((targetRoll === 0 || Math.sign(targetRoll) !== Math.sign(playerFlight.rollRate)) ? playerFlight.stabilityMultiplier : 1));
    playerFlight.yawRate += (targetYaw - playerFlight.yawRate) * Math.min(1, delta * 6.0 * ((targetYaw === 0 || Math.sign(targetYaw) !== Math.sign(playerFlight.yawRate)) ? playerFlight.stabilityMultiplier : 1));

    // Apply rotations locally (순수 입력 기반 회전만 적용 - 항공역학 보정 없음)
    playerMesh.rotateX(playerFlight.pitchRate * delta);
    playerMesh.rotateZ(playerFlight.rollRate * delta);
    playerMesh.rotateY(playerFlight.yawRate * delta);

    playerFlight.casualYawRate = 0;
    playerVisual.rotation.set(0, 0, 0);

    // Move forward in local Z-axis
    const forwardSpeedMps = playerFlight.speed * 0.514444; // 1 knot ~ 0.514 m/s
    playerMesh.translateZ(-forwardSpeedMps * delta);

    // Terrain Collision check (지형 표면 고도 기반 충돌 판정)
    const playerGroundY = getSurfaceHeight(playerMesh.position.x, playerMesh.position.z);
    const playerSafeAlt = playerGroundY + 18;
    if (playerMesh.position.y < playerSafeAlt) {
        playerMesh.position.y = playerSafeAlt;
        playerFlight.health -= delta * 60;
        triggerExplosion(playerMesh.position, 6, 0.8);
        if (playerFlight.health <= 0) {
            gameEvents.emit(EVENTS.PLAYER_DESTROYED);
        }
    }

    // Weapon cooldown & reload ticks
    playerFlight.cannonCooldown -= delta;

    if (tickMagazines(playerFlight, delta)) updateWeaponHUD();

    if (gameState.missileMode !== 3 && (keys.fireCannon || padInput.fireCannon) && playerFlight.cannonCooldown <= 0) {
        fireCannon(true, playerMesh);
        playerFlight.cannonCooldown = 0.05; // 20 rounds per sec
    }

    // ─── 미사일 연속 발사 제어 (표준 1발씩 20발, 멀티 최대 4발씩 16발) ─────────────────────
    updateBeam(delta, keys.fireMissile || keys.beamMouse || padInput.beamHeld);
    if (keys.fireMissile && gameState.missileMode !== 3) {
        tryFireMissile();
    }
}
