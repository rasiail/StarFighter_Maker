import { updateGamepad } from '../input/gamepad.js';
// core/loop: imports are side-effect free; main.js controls initialization.
import { gameState } from './state.js';
import { updatePlayerFlight } from '../player/flight.js';
import { updateEnemies } from '../enemies/ai.js';
import { updateSinkingShips, updateDyingBosses } from '../enemies/lifecycle.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { updateCamera } from '../camera/camera.js';
import { renderHUD } from '../ui/hud.js';
import { setupStageEnvironment, skyMesh, getSurfaceHeight } from '../world/environment.js';
import { playerMesh, playerFlight } from '../player/player.js';
import { retroPostCamera, retroPostScene, retroRenderTarget } from '../rendering/retro.js';
import { camera, renderer, scene } from '../rendering/scene.js';
import { loadFBXAsset } from '../assets/aircraft.js';
import { audio } from '../audio/audio.js';
import { updateTargeting } from '../combat/targeting.js';
import { updateMission } from '../game/missions.js';
import { updateCombatSchedule } from './scheduler.js';

import { keys } from '../input/state.js';

let clock;

import { triggerExplosion, createSmokePuff } from '../effects/particles.js';

export function stepSimulation(delta) {
    if (!gameState.isGameRunning || gameState.isGamePaused) return;
    gameState.isFiringGun = keys.fireCannon;

    if (gameState.isPlayerDead) {
        gameState.deathTimer -= delta;
        const elapsed = (gameState.deathTotalTime || 5.0) - gameState.deathTimer;
        const surfaceY = getSurfaceHeight(playerMesh.position.x, playerMesh.position.z);

        if (!gameState.playerCrashed) {
            // ─── [공중 추락 단계] ───
            // 1. 수평 전진 감속 및 중력 가속 하강
            playerFlight.speed = Math.max(50, playerFlight.speed - delta * 70);
            const forwardSpeedMps = playerFlight.speed * 0.514444;
            playerMesh.translateZ(-forwardSpeedMps * delta);

            gameState.deathFallSpeed = (gameState.deathFallSpeed || 80) + delta * 150;
            playerMesh.position.y -= gameState.deathFallSpeed * delta;

            // 통제 불능 회전 (기수 급강하 피치 + 스핀 롤 + 요 비틀림)
            playerMesh.rotateX(0.5 * delta);
            playerMesh.rotateZ(3.2 * delta);
            playerMesh.rotateY(0.35 * delta);

            // 2. 지속 연기 트레일 방출 (매 프레임 시끄러운 폭발음 대신 자연스러운 추락 화재/연기)
            gameState.deathSmokeTimer = (gameState.deathSmokeTimer || 0) - delta;
            if (gameState.deathSmokeTimer <= 0) {
                const smokeOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 3,
                    (Math.random() - 0.5) * 2,
                    (Math.random() - 0.5) * 3
                );
                createSmokePuff(playerMesh.position.clone().add(smokeOffset));
                gameState.deathSmokeTimer = 0.04;
            }

            // 3. 중간 단발성 대형 폭발 (Burst Explosion)
            if (elapsed >= gameState.deathNextBurst) {
                const burstOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 4,
                    (Math.random() - 0.5) * 10
                );
                triggerExplosion(playerMesh.position.clone().add(burstOffset), 45, 2.8);
                audio.playExplosion();
                gameState.deathNextBurst += (1.0 + Math.random() * 0.3);
                playerMesh.rotateZ((Math.random() - 0.5) * 0.9);
            }

            // 4. 지면 충돌 판정
            if (playerMesh.position.y <= surfaceY + 2.0 || elapsed >= 2.6) {
                gameState.playerCrashed = true;
                playerMesh.position.y = surfaceY + 1.2;
                gameState.crashPosition = playerMesh.position.clone();

                // 지면 격돌 초대형 폭발 발생
                triggerExplosion(playerMesh.position, 85, 4.2);
                audio.playExplosion();

                playerFlight.speed = 0;
                gameState.deathNextBurst = elapsed + 0.7; // 지면 2차 유폭

                // 카메라를 월드 씬에 직접 부착하여 상공 시점 전환
                if (camera.parent !== scene) {
                    scene.attach(camera);
                }
            }
        } else {
            // ─── [바닥 충돌 후 연출 단계] ───
            if (gameState.crashPosition) {
                playerMesh.position.copy(gameState.crashPosition);
            }

            // 지면 잔해 지속 연기 방출
            gameState.deathSmokeTimer = (gameState.deathSmokeTimer || 0) - delta;
            if (gameState.deathSmokeTimer <= 0) {
                const smokeOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    1 + Math.random() * 3,
                    (Math.random() - 0.5) * 4
                );
                createSmokePuff(gameState.crashPosition.clone().add(smokeOffset));
                gameState.deathSmokeTimer = 0.05;
            }

            // 지면 잔해 단발성 2차 유폭 (1회)
            if (elapsed >= gameState.deathNextBurst) {
                const burstOffset = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    2,
                    (Math.random() - 0.5) * 6
                );
                triggerExplosion(gameState.crashPosition.clone().add(burstOffset), 35, 2.2);
                audio.playExplosion();
                gameState.deathNextBurst = 999;
            }
        }

        if (gameState.deathTimer <= 0) {
            import('../game/missions.js').then(m => m.gameOver(false));
            gameState.isPlayerDead = false;
        }

        updateEnemies(delta);
        updateSinkingShips(delta);
        updateDyingBosses(delta);
        updateProjectiles(delta);
        updateCombatSchedule(delta);
        updateMission(delta);
        updateCamera(delta);
        renderHUD();
        gameState.jetExhaustSystem?.update(delta);
        skyMesh.position.copy(playerMesh.position);
        return;
    }

    updatePlayerFlight(delta);
    if (!gameState.isGameRunning) return;
    updateEnemies(delta);
    updateSinkingShips(delta);
    updateDyingBosses(delta);
    updateTargeting();
    updateProjectiles(delta);
    if (!gameState.isGameRunning) return;
    updateCombatSchedule(delta);
    updateMission(delta);
    if (!gameState.isGameRunning) return;
    updateCamera(delta);
    renderHUD();
    gameState.jetExhaustSystem?.update(delta);
    skyMesh.position.copy(playerMesh.position);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(0.08, clock.getDelta());
    updateGamepad(delta);

    if (gameState.isGameRunning && !gameState.isGamePaused) {
        try {
            stepSimulation(delta);
        } catch (err) {
            console.error("Simulation loop error:", err);
        }
    }

    // 렌더링: 레트로 픽셀 아트 필터 활성화 여부에 따라 포스트프로세싱 분기
    try {
        if (gameState.retroFilterEnabled && retroRenderTarget && retroPostScene && retroPostCamera) {
            renderer.setRenderTarget(retroRenderTarget);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            renderer.render(retroPostScene, retroPostCamera);
        } else {
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
        }
    } catch (err) {
        console.error("Render error:", err);
    }
}

export function initLoop() {
    clock = new THREE.Clock();

    const start = () => {
        setupStageEnvironment(1, 'DAY');
        loadFBXAsset();
        animate();

        // 타이틀 및 미션 선택 BGM (DancingSky.mp3) 재생
        audio.playTitleBGM();
        const startBgmOnGesture = () => {
            if (!gameState.isGameRunning) {
                audio.playTitleBGM();
            }
        };
        window.addEventListener('click', startBgmOnGesture, { once: true });
        window.addEventListener('keydown', startBgmOnGesture, { once: true });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
}
