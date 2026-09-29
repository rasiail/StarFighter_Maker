import { gameState } from '../core/state.js';
import { english } from './translations.js';

export function t(korean, englishText = english[korean]) {
    return gameState.language === 'en' ? (englishText ?? korean) : korean;
}

export function applyLanguage() {
    document.documentElement.lang = gameState.language;
    document.querySelectorAll('[data-ko]').forEach(element => {
        element.textContent = t(element.dataset.ko, element.dataset.en);
    });
}
