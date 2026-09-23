import { gameEvents, EVENTS } from '../core/events.js';
import { gameState } from '../core/state.js';
import { clearCombatSchedule } from '../core/scheduler.js';
import { STAGES, getStage } from '../config/stages.js';
import { createEncounter, recordEncounterKill, advanceEncounter, reinforcementCount } from './encounter.js';
import { createPlayerFlight, replenishPlayerForSortie } from '../player/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { resetProgression, progression } from '../progression/runtime.js';
import { refreshProgressionUI, openUpgrades } from '../ui/upgrades.js';
import { releaseGamePointerLock, requestGamePointerLock } from '../input/pointer-lock.js';
import { clearCombatInput } from '../input/controls.js';
import { audio } from '../audio/audio.js';
import { currentEnvironment, setupStageEnvironment, getSurfaceHeight } from '../world/environment.js';
import { clearProjectiles, updateWeaponHUD } from '../combat/weapons.js';
import { clearParticles, triggerExplosion } from '../effects/particles.js';
import { container } from '../rendering/scene.js';
import { clearFleet, spawnFormation, spawnBoss, enemies } from '../enemies/fleet.js';
import { clearDyingBosses, activeDyingBosses } from '../enemies/lifecycle.js';
import { cameraConfig, resetCamera } from '../camera/camera.js';
import { updateTargeting } from '../combat/targeting.js';
import { renderHUD } from '../ui/hud.js';
import { BALANCE } from '../data/generated/balance.js';

export let encounter = null;
let selectedStageId = 1;
let runStartStage = 1;
let boss = null;
let reinforcementTimer = 0;

function hideScreens() {
    for (const id of ['start-modal', 'stage-modal', 'gameover-modal', 'options-modal']) document.getElementById(id).style.display = 'none';
    for (const id of ['hangar-modal', 'upgrade-modal']) document.getElementById(id).hidden = true;
    gameState.activeModal = null;
}
function clearBattle() {
    clearCombatSchedule();
    clearProjectiles();
    clearParticles();
    gameState.jetExhaustSystem?.clear();
    clearFleet();
    clearDyingBosses();
    gameState.bossDyingSequence = false;
    boss = null;
}
function fillWave() {
    const aliveCount = enemies.filter(enemy => enemy.alive).length;
    const count = reinforcementCount(encounter, aliveCount);
    if (count <= 0) return;

    const eliteRatio = encounter.stage.eliteRatios[encounter.wave] || 0;
    const totalWaveEnemies = encounter.stage.waves[encounter.wave];
    const targetEliteForWave = Math.round(totalWaveEnemies * eliteRatio);
    
    let eliteToSpawn = 0;
    if (encounter.spawnedElites < targetEliteForWave) {
        const expectedElites = Math.round(targetEliteForWave * (encounter.spawned + count) / totalWaveEnemies);
        eliteToSpawn = Math.min(count, Math.max(0, expectedElites - encounter.spawnedElites));
    } else if (eliteRatio > 0) {
        for (let i = 0; i < count; i++) {
            if (Math.random() < eliteRatio) eliteToSpawn++;
        }
    }

    spawnFormation(count, { health: encounter.stage.enemyHealth, eliteCount: eliteToSpawn });
    encounter.spawned += count;
    encounter.spawnedElites += eliteToSpawn;
}
function beginWave() {
    clearBattle();
    gameState.phase = 'combat';
    gameState.currentKills = 0;
    gameState.TARGET_KILLS = encounter.stage.waves[encounter.wave];
    reinforcementTimer = 0;
    fillWave();
    updateMissionUI();
}
function updateMissionUI() {
    const status = document.getElementById('wave-status');
    status.hidden = !gameState.isGameRunning;
    status.textContent = encounter?.phase === 'boss' ? 'BOSS ENGAGEMENT' : `WAVE ${(encounter?.wave || 0) + 1} / ${encounter?.stage.waves.length || 0}`;
    document.getElementById('target-count').textContent = encounter?.phase === 'boss' ? 'BOSS' : Math.max(0, gameState.TARGET_KILLS - (encounter?.kills || 0));
    const bar = document.getElementById('boss-status');
    const isBossDying = boss && (!boss.alive || boss.isDying) && activeDyingBosses.length > 0;
    bar.hidden = (!boss?.alive && !isBossDying) || !gameState.isGameRunning;
    if (boss?.alive) {
        document.getElementById('boss-name').textContent = `${boss.callsign} · ${Math.max(0, Math.ceil(boss.health))} HP`;
        document.getElementById('boss-hp-fill').style.width = `${Math.max(0, boss.health / boss.maxHealth * 100)}%`;
        document.getElementById('boss-hp-fill').style.backgroundColor = '';
    } else if (isBossDying) {
        document.getElementById('boss-name').textContent = `${boss.callsign} · DESTROYED`;
        document.getElementById('boss-hp-fill').style.width = '0%';
        document.getElementById('boss-hp-fill').style.backgroundColor = '#ff3344';
    }
}

// Transitions happen after entity updates, never inside a projectile iteration.
export function updateMission(delta) {
    if (!encounter || !gameState.isGameRunning || gameState.isGamePaused) return;
    if (gameState.bossDyingSequence) {
        updateMissionUI();
        return;
    }
    if (advanceEncounter(encounter)) {
        if (encounter.phase === 'waves') beginWave();
        else if (encounter.phase === 'boss') {
            clearBattle();
            gameState.phase = 'boss';
            boss = spawnBoss(encounter.stage);
        } else if (encounter.phase === 'hangar') enterHangar();
        
        // 웨이브/페이즈 클리어 시 선택 안 한 스킬 카드가 있으면 창을 자동으로 띄움
        if (progression.pending > 0 && gameState.phase !== 'hangar') {
            openUpgrades();
        }
    }
    if (encounter.phase === 'waves') {
        reinforcementTimer -= delta;
        if (reinforcementTimer <= 0) { fillWave(); reinforcementTimer = BALANCE.spawnRules.reinforcement_interval.value; }
    }
    updateMissionUI();
}
function enterHangar() {
    gameState.phase = 'hangar';
    gameState.isGameRunning = false;
    gameState.isGamePaused = true;
    clearCombatInput();
    releaseGamePointerLock();
    clearBattle();
    audio.stopFlightAudio();
    audio.playTitleBGM();
    replenishPlayerForSortie(playerFlight);
    document.getElementById('hangar-modal').hidden = false;
    document.getElementById('hangar-depart').textContent = selectedStageId < STAGES.length ? `${getStage(selectedStageId + 1).title} 출격` : '런 완료';
    refreshProgressionUI();
    updateWeaponHUD();
    renderHUD();
    document.getElementById('hangar-upgrade').focus();
}
export function gameOver(victory = false) {
    if (gameState.activeModal === 'cards') return;
    gameState.phase = victory ? 'complete' : 'defeat';
    gameState.isGameRunning = false;
    gameState.isGamePaused = false;
    clearCombatInput();
    releaseGamePointerLock();
    clearCombatSchedule();
    audio.stopFlightAudio();
    hideScreens();
    document.getElementById('gameover-modal').style.display = 'flex';
    document.getElementById('gameover-title').textContent = victory ? 'RUN COMPLETE' : 'SHOT DOWN / KIA';
    document.getElementById('gameover-title').style.color = victory ? '#79ffb2' : '#ff3344';
    document.getElementById('gameover-sub').textContent = victory ? 'ALL SECTORS LIBERATED' : '새 런에서 다시 도전하세요';
    document.getElementById('final-score').textContent = playerFlight.score;
    document.getElementById('btn-next-stage').style.display = 'none';
    document.getElementById('btn-restart').textContent = 'NEW RUN';
    refreshProgressionUI();
    updateMissionUI();
}

// Normal progression preserves the build; menu/retry starts a fresh run.
export function launchStage(stageId, { newRun = true } = {}) {
    if (gameState.activeModal === 'cards') return;
    const stage = getStage(stageId);
    hideScreens();
    clearCombatInput();
    clearBattle();
    selectedStageId = stageId;
    if (newRun) {
        runStartStage = stageId;
        Object.assign(playerFlight, createPlayerFlight(new THREE.Vector3(0, 0, -1)));
        resetProgression();
    }
    encounter = createEncounter(stage);
    setupStageEnvironment(stageId);
    gameState.currentStageInfo = { stage: stageId, name: `${stage.name} [${currentEnvironment.theme} | ${currentEnvironment.timeOfDay}]` };
    document.getElementById('mission-name').textContent = gameState.currentStageInfo.name;
    document.getElementById('score-val').textContent = playerFlight.score.toString().padStart(4, '0');
    playerMesh.position.set(0, 800, 1200);
    playerMesh.quaternion.set(0, 0, 0, 1);
    replenishPlayerForSortie(playerFlight);
    gameState.missileMode = 1;
    resetCamera();
    gameState.playerCrashed = false;
    gameState.crashPosition = null;
    gameState.deathFallSpeed = 0;
    gameState.cameraPivot?.rotation.set(0, 0, 0);
    gameState.isGameRunning = true;
    gameState.isGamePaused = false;
    gameState.isPlayerDead = false;
    playerMesh.visible = true;
    beginWave();
    playerMesh.updateMatrixWorld(true);
    updateTargeting();
    audio.init();
    audio.stopTitleBGM();
    audio.startFlightAudio();
    updateWeaponHUD();
    refreshProgressionUI();
    renderHUD();
    container.focus();
    requestGamePointerLock();
}
export function departHangar() {
    if (gameState.phase !== 'hangar' || gameState.activeModal) return;
    if (selectedStageId < STAGES.length) launchStage(selectedStageId + 1, { newRun: false });
    else gameOver(true);
}
export function initMissions() {
    gameEvents.on(EVENTS.PLAYER_DESTROYED, () => {
        if (gameState.isGameRunning && !gameState.isPlayerDead) {
            gameState.isPlayerDead = true;
            gameState.deathTimer = 5.0;
            gameState.deathTotalTime = 5.0;
            gameState.playerCrashed = false;
            gameState.crashPosition = null;
            gameState.deathNextBurst = 0.9;
            gameState.deathSmokeTimer = 0;

            const groundY = getSurfaceHeight(playerMesh.position.x, playerMesh.position.z);
            const currentAlt = Math.max(10, playerMesh.position.y - groundY);
            gameState.deathFallSpeed = Math.max(90, currentAlt / 2.6);

            triggerExplosion(playerMesh.position, 45, 2.5);
            audio.playExplosion();
            audio.setEngineThrottle(0, false);
        }
    });
    gameEvents.on(EVENTS.ENEMY_DESTROYED, ({ isBoss }) => {
        if (encounter && gameState.isGameRunning && !isBoss) {
            recordEncounterKill(encounter, isBoss);
            if (encounter.phase === 'waves' && !encounter.transition) {
                fillWave();
            }
        }
    });
    gameEvents.on(EVENTS.BOSS_SEQUENCE_COMPLETE, () => {
        if (encounter && gameState.isGameRunning) {
            resetCamera();
            recordEncounterKill(encounter, true);
        }
    });
    const cards = document.querySelectorAll('.stage-card');
    cards[0]?.classList.add('selected');
    cards.forEach(card => card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedStageId = Number(card.dataset.stage);
    }));
    cards.forEach(card => {
        const stage = getStage(Number(card.dataset.stage));
        card.querySelector('.stage-objective').textContent = `${stage.waves.length} WAVES · ${stage.waves.reduce((a, b) => a + b, 0)}기 + BOSS`;
    });
    document.getElementById('btn-start-selected-stage').addEventListener('click', () => launchStage(selectedStageId));
    document.getElementById('hangar-depart').addEventListener('click', departHangar);
    document.getElementById('btn-restart').addEventListener('click', () => launchStage(runStartStage));
    document.getElementById('btn-main-menu').addEventListener('click', () => {
        if (gameState.activeModal === 'cards') return;
        resetCamera();
        gameState.isGameRunning = false;
        gameState.isGamePaused = false;
        gameState.phase = 'menu';
        clearCombatInput();
        releaseGamePointerLock();
        clearBattle();
        hideScreens();
        document.getElementById('start-modal').style.display = 'flex';
        audio.stopFlightAudio();
        audio.playTitleBGM();
        refreshProgressionUI();
        updateMissionUI();
    });
}
