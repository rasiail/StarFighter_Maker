import { gameState } from '../core/state.js';
import { saveLocalOptions } from '../core/local-save.js';
import { applyLanguage, t } from './i18n.js';
import { refreshProgressionUI } from './upgrades.js';
import { refreshSavedStages } from '../game/missions.js';

export function refreshLanguage() {
    applyLanguage();
    refreshProgressionUI();
    refreshSavedStages();
    document.getElementById('opt-language').value = gameState.language;
    document.getElementById('flight-help').textContent = gameState.controlScheme === 'casual'
        ? t('마우스: 피치 / 뱅크 턴 · W/S: 속도 · A/D: 롤 · Q/E: 요', 'Mouse: pitch / bank turns · W/S: speed · A/D: roll · Q/E: yaw')
        : t('W/S: 피치 · A/D: 롤 · Q/E: 요 · 마우스: 시점', 'W/S: pitch · A/D: roll · Q/E: yaw · Mouse: camera');
}

export function initSetup() {
    const modal = document.getElementById('setup-modal');
    document.querySelectorAll('[data-language]').forEach(button => {
        button.addEventListener('click', () => {
            gameState.language = button.dataset.language;
            refreshLanguage();
            sync();
        });
    });
    document.querySelectorAll('[data-controls]').forEach(button => {
        button.addEventListener('click', () => {
            gameState.controlScheme = button.dataset.controls;
            document.getElementById('opt-casual-controls').checked = gameState.controlScheme === 'casual';
            refreshLanguage();
            sync();
        });
    });
    function sync() {
        modal.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', button.dataset.language === gameState.language));
        modal.querySelectorAll('[data-controls]').forEach(button => button.setAttribute('aria-pressed', button.dataset.controls === gameState.controlScheme));
    }
    document.getElementById('setup-confirm').addEventListener('click', () => {
        gameState.setupComplete = true;
        saveLocalOptions();
        modal.hidden = true;
        gameState.activeModal = null;
        document.getElementById('start-modal').inert = false;
        document.getElementById('btn-sortie').focus();
    });
    modal.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const buttons = [...modal.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    });
    refreshLanguage();
    sync();
    if (!gameState.setupComplete) {
        modal.hidden = false;
        gameState.activeModal = 'setup';
        document.getElementById('start-modal').inert = true;
        modal.querySelector('[data-language][aria-pressed="true"]').focus();
    }
}
