// player/flight: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from './player.js';
import { keys } from '../input/state.js';
import { fbxModelTemplate, isFBXReady } from '../assets/aircraft.js';
import { audio } from '../audio/audio.js';
import { getSurfaceHeight } from '../world/environment.js';
import { triggerExplosion } from '../effects/particles.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { fireCannon, tryFireMissile, updateWeaponHUD } from '../combat/weapons.js';


export function updatePlayerFlight(delta) {
    // ─── 속도 제어 (에이스 컴뱃식 크루즈 자동 복귀 시스템) ─────────────
    // Shift 홀드: 최대 속도(950kts, THR 100%)까지 점진적 가속
    // Ctrl 홀드:  최소 속도(150kts, THR 0%)까지 점진적 감속
    // 키 해제 시:  평균 순항 속도(cruiseSpeed = 550kts, THR 50%)로 부드럽게 자동 복귀
    const cruiseSpd = playerFlight.cruiseSpeed; // 550 kts (THR 50% 기준 속도)
    const minSpd    = playerFlight.minSpeed;    // 150 kts (THR 0% 최저 실속 한계)
    const maxSpd    = playerFlight.maxSpeed;    // 950 kts (THR 100% 최대 애프터버너)

    if (keys.throttleUp) {
        // 가속: 점진적이고 적절한 증가 (초당 약 +85kts)
        playerFlight.speed = Math.min(maxSpd, playerFlight.speed + delta * playerFlight.acceleration);
    } else if (keys.throttleDown) {
        // 감속: 점진적이고 적절한 감소 (초당 약 -85kts)
        playerFlight.speed = Math.max(minSpd, playerFlight.speed - delta * playerFlight.acceleration);
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
    playerFlight.isAirbrake    = keys.throttleDown && playerFlight.speed < 320; // 320kts 이하 감속 중 에어브레이크

    // Thruster visual update: 내부 노즐 코어 발광 및 로우폴리곤 덩어리 파티클 방출
    if (playerMesh.baseGlow) {
        const glowScale = (playerFlight.isAfterburner ? 1.4 : 1.0) * (0.85 + Math.random() * 0.25);
        playerMesh.baseGlow.scale.set(glowScale, glowScale, glowScale);
        playerMesh.baseGlow.material.color.setHex(playerFlight.isAfterburner ? 0x66ddff : 0xffaa22);
    }

    // 로우폴리곤 덩어리 쓰러스터 파티클 방출 (기체 로컬 좌표계로 전달하여 항상 노즐에 밀착)
    if (gameState.jetExhaustSystem && playerFlight.throttlePercent > 5) {
        const localNozzle = (isFBXReady && fbxModelTemplate)
            ? new THREE.Vector3(0, -0.38, 4.55)
            : new THREE.Vector3(0, 0, 5.3);

        const spawnCount = playerFlight.isAfterburner ? 3 : (playerFlight.throttlePercent > 45 ? 2 : 1);
        for (let k = 0; k < spawnCount; k++) {
            gameState.jetExhaustSystem.spawn(
                playerMesh,
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
    let targetPitch = 0;
    if (keys.pitchDown) targetPitch -= maxPitchRate; // W: 기수 하강 (음수 회전 = Dive)
    if (keys.pitchUp) targetPitch += maxPitchRate;   // S: 기수 상승 (양수 회전 = Climb)

    let targetRoll = 0;
    if (keys.rollLeft) targetRoll += maxRollRate;    // A: 롤 좌측
    if (keys.rollRight) targetRoll -= maxRollRate;   // D: 롤 우측

    let targetYaw = 0;
    if (keys.yawLeft) targetYaw += maxYawRate;       // Q: 요 좌측
    if (keys.yawRight) targetYaw -= maxYawRate;      // E: 요 우측

    playerFlight.pitchRate += (targetPitch - playerFlight.pitchRate) * Math.min(1, delta * 7.0 * ((targetPitch === 0 || Math.sign(targetPitch) !== Math.sign(playerFlight.pitchRate)) ? playerFlight.stabilityMultiplier : 1));
    playerFlight.rollRate += (targetRoll - playerFlight.rollRate) * Math.min(1, delta * 9.0 * ((targetRoll === 0 || Math.sign(targetRoll) !== Math.sign(playerFlight.rollRate)) ? playerFlight.stabilityMultiplier : 1));
    playerFlight.yawRate += (targetYaw - playerFlight.yawRate) * Math.min(1, delta * 6.0 * ((targetYaw === 0 || Math.sign(targetYaw) !== Math.sign(playerFlight.yawRate)) ? playerFlight.stabilityMultiplier : 1));

    // Apply rotations locally (순수 입력 기반 회전만 적용 - 항공역학 보정 없음)
    playerMesh.rotateX(playerFlight.pitchRate * delta);
    playerMesh.rotateZ(playerFlight.rollRate * delta);
    playerMesh.rotateY(playerFlight.yawRate * delta);

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

    // 1. 표준 미사일 쿨다운 및 개별 재장전 타이머 관리
    if (playerFlight.stdShotCooldown > 0) playerFlight.stdShotCooldown -= delta;
    if (playerFlight.stdReloadTimers.length > 0) {
        let reloaded = false;
        for (let i = playerFlight.stdReloadTimers.length - 1; i >= 0; i--) {
            playerFlight.stdReloadTimers[i] -= delta;
            if (playerFlight.stdReloadTimers[i] <= 0) {
                playerFlight.stdReloadTimers.splice(i, 1);
                if (playerFlight.stdBursts < playerFlight.stdMaxBursts) {
                    playerFlight.stdBursts++;
                    reloaded = true;
                }
            }
        }
        // 타이머 숫자가 변할 때마다(소수점 첫째자리 기준) HUD 갱신
        if (reloaded || (playerFlight.stdReloadTimers.length > 0 && Math.floor((playerFlight.stdReloadTimers[0] + delta) * 10) !== Math.floor(playerFlight.stdReloadTimers[0] * 10))) {
            updateWeaponHUD();
        }
    }

    // 2. 멀티 미사일 쿨다운 및 개별 재장전 타이머 관리
    if (playerFlight.multiShotCooldown > 0) playerFlight.multiShotCooldown -= delta;
    if (playerFlight.multiReloadTimers.length > 0) {
        let reloaded = false;
        for (let i = playerFlight.multiReloadTimers.length - 1; i >= 0; i--) {
            playerFlight.multiReloadTimers[i] -= delta;
            if (playerFlight.multiReloadTimers[i] <= 0) {
                playerFlight.multiReloadTimers.splice(i, 1);
                if (playerFlight.multiBursts < playerFlight.multiMaxBursts) {
                    playerFlight.multiBursts++;
                    reloaded = true;
                }
            }
        }
        if (reloaded || (playerFlight.multiReloadTimers.length > 0 && Math.floor((playerFlight.multiReloadTimers[0] + delta) * 10) !== Math.floor(playerFlight.multiReloadTimers[0] * 10))) {
            updateWeaponHUD();
        }
    }

    if (keys.fireCannon && playerFlight.cannonCooldown <= 0) {
        fireCannon(true, playerMesh);
        playerFlight.cannonCooldown = 0.05; // 20 rounds per sec
    }

    // ─── 미사일 연속 발사 제어 (표준 최대 2발, 멀티 최대 4발) ─────────────────────
    if (keys.fireMissile) {
        tryFireMissile();
    }
}
