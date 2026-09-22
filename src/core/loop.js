import { updateGamepad } from '../input/gamepad.js';
// core/loop: imports are side-effect free; main.js controls initialization.
import { gameState } from './state.js';
import { updatePlayerFlight } from '../player/flight.js';
import { updateEnemies } from '../enemies/ai.js';
import { updateSinkingShips } from '../enemies/lifecycle.js';
import { updateProjectiles } from '../combat/projectiles.js';
import { updateCamera } from '../camera/camera.js';
import { renderHUD } from '../ui/hud.js';
import { setupStageEnvironment, skyMesh } from '../world/environment.js';
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

import { triggerExplosion } from '../effects/particles.js';

export function stepSimulation(delta) {
    if (!gameState.isGameRunning || gameState.isGamePaused) return;
    gameState.isFiringGun = keys.fireCannon;

    if (gameState.isPlayerDead) {
        gameState.deathTimer -= delta;
        
        // 연쇄 폭발 효과
        if (Math.random() < 0.3) {
            triggerExplosion(playerMesh.position.clone().add(new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10)), 12, 1.5);
            audio.playExplosion();
        }

        if (gameState.deathTimer <= 0) {
            import('../game/missions.js').then(m => m.gameOver(false));
            gameState.isPlayerDead = false;
        }

        // 관성으로 계속 전진 및 롤 회전 (추락 연출)
        const forwardSpeedMps = playerFlight.speed * 0.514444;
        playerMesh.translateZ(-forwardSpeedMps * delta);
        playerMesh.rotateZ(3.0 * delta);

        updateEnemies(delta);
        updateSinkingShips(delta);
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
