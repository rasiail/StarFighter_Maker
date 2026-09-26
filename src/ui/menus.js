// ui/menus: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { audio } from '../audio/audio.js';
import { releaseGamePointerLock, requestGamePointerLock } from '../input/pointer-lock.js';
import { clearCombatInput } from '../input/controls.js';
import { refreshProgressionUI } from './upgrades.js';

let btnOptStart;
let btnOptStage;
let btnCloseOpt;
let btnCloseOptX;
let optRetroFilter;
let optBgmSlider;
let optBgmVal;
let optSfxSlider;
let optSfxVal;
let optPointerLock;

export function toggleOptionsMenu() {
    if (gameState.activeModal === 'cards' || gameState.phase === 'hangar') return;
    const optModal = document.getElementById('options-modal');
    if (optModal.style.display === 'flex') {
        closeOptionsMenu();
    } else {
        openOptionsMenu();
    }
}
export function openOptionsMenu() {
    if (gameState.activeModal === 'cards' || gameState.phase === 'hangar') return;
    gameState.activeModal = 'options';
    clearCombatInput();
    audio.init();
    const optModal = document.getElementById('options-modal');
    optModal.style.display = 'flex';
    if (gameState.isGameRunning) {
        gameState.isGamePaused = true;
    }
    releaseGamePointerLock(); // 옵션 메뉴 활성화 시 마우스 커서 표시
    refreshProgressionUI();
}
function closeOptionsMenu() {
    if (gameState.activeModal === 'cards') return;
    gameState.activeModal = null;
    const optModal = document.getElementById('options-modal');
    optModal.style.display = 'none';
    if (gameState.isGameRunning) {
        gameState.isGamePaused = false;
        requestGamePointerLock(); // 게임 복귀 시 마우스 커서 다시 잠금
    }
    clearCombatInput();
    refreshProgressionUI();
}

export function initMenus() {
    btnOptStart = document.getElementById('btn-open-options-start');

    if (btnOptStart) btnOptStart.addEventListener('click', openOptionsMenu);

    btnOptStage = document.getElementById('btn-open-options-stage');

    if (btnOptStage) btnOptStage.addEventListener('click', openOptionsMenu);

    btnCloseOpt = document.getElementById('btn-close-options');

    if (btnCloseOpt) btnCloseOpt.addEventListener('click', closeOptionsMenu);

    btnCloseOptX = document.getElementById('btn-close-options-x');

    if (btnCloseOptX) btnCloseOptX.addEventListener('click', closeOptionsMenu);

    optRetroFilter = document.getElementById('opt-retro-filter');

    if (optRetroFilter) {
        optRetroFilter.checked = gameState.retroFilterEnabled;
        optRetroFilter.addEventListener('change', (e) => {
            gameState.retroFilterEnabled = e.target.checked;
        });
    }

    optBgmSlider = document.getElementById('opt-bgm-slider');

    optBgmVal = document.getElementById('opt-bgm-val');

    if (optBgmSlider && optBgmVal) {
        optBgmSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            optBgmVal.textContent = val + '%';
            audio.setBGMVolume(val / 100);
        });
    }

    optSfxSlider = document.getElementById('opt-sfx-slider');

    optSfxVal = document.getElementById('opt-sfx-val');

    if (optSfxSlider && optSfxVal) {
        optSfxSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            optSfxVal.textContent = val + '%';
            audio.setSFXVolume(val / 100);
        });
    }

    optPointerLock = document.getElementById('opt-pointer-lock');

    if (optPointerLock) {
        optPointerLock.checked = gameState.isPointerLockEnabled;
        optPointerLock.addEventListener('change', (e) => {
            gameState.isPointerLockEnabled = e.target.checked;
            if (gameState.isPointerLockEnabled) {
                requestGamePointerLock();
            } else {
                releaseGamePointerLock();
            }
        });
    }
    const optCasualControls = document.getElementById('opt-casual-controls');
    if (optCasualControls) {
        optCasualControls.checked = (gameState.controlScheme === 'casual');
        optCasualControls.addEventListener('change', (e) => {
            gameState.controlScheme = e.target.checked ? 'casual' : 'standard';
            clearCombatInput();
        });
    }

    const optTargetFollow = document.getElementById('opt-target-follow');
    if (optTargetFollow) {
        optTargetFollow.checked = gameState.targetFollowEnabled;
        optTargetFollow.addEventListener('change', (e) => {
            gameState.targetFollowEnabled = e.target.checked;
            clearCombatInput();
        });
    }

    const optSmartGun = document.getElementById('opt-smart-gun');
    if (optSmartGun) {
        optSmartGun.checked = gameState.isSmartGunEnabled;
        optSmartGun.addEventListener('change', (e) => {
            gameState.isSmartGunEnabled = e.target.checked;
        });
    }


    document.getElementById('btn-sortie').addEventListener('click', () => {
        audio.init();
        audio.playTitleBGM();
        document.getElementById('start-modal').style.display = 'none';
        document.getElementById('stage-modal').style.display = 'flex';
    });

    document.getElementById('btn-stage-back').addEventListener('click', () => {
        document.getElementById('stage-modal').style.display = 'none';
        document.getElementById('start-modal').style.display = 'flex';
    });
}
