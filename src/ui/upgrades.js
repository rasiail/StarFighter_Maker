import { gameState } from '../core/state.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { progression, chooseUpgrade } from '../progression/runtime.js';
import { drawCards, cardRank } from '../progression/cards.js';
import { STAT_NAMES, xpToNextLevel } from '../progression/model.js';
import { releaseGamePointerLock, requestGamePointerLock } from '../input/pointer-lock.js';
import { clearCombatInput } from '../input/controls.js';
import { audio } from '../audio/audio.js';
import { playerFlight } from '../player/player.js';
import { createUpgradePreview } from './upgrade-preview.js';

let offered = [];
export function refreshProgressionUI() {
    const status = document.getElementById('progression-status');
    status.textContent = `LV ${progression.level} · EXP ${progression.xp}/${xpToNextLevel(progression.level)}`;
    document.getElementById('xp-fill').style.width = `${100 * progression.xp / xpToNextLevel(progression.level)}%`;
    const prompt = document.getElementById('upgrade-prompt');
    prompt.hidden = !gameState.isGameRunning || progression.pending === 0 || gameState.isGamePaused || gameState.bossDyingSequence;
    prompt.textContent = `[X] 스킬 업그레이드 가능 · ${progression.pending}회`;
    const hangar = document.getElementById('hangar-upgrade');
    hangar.textContent = `스킬 업그레이드 · ${progression.pending}회 [X]`;
    hangar.disabled = progression.pending === 0;
    document.getElementById('hangar-build').textContent = `LV ${progression.level} · ` + Object.entries(STAT_NAMES).map(([key, name]) => `${name} ${progression.ranks[key]}/5`).join(' / ');
}
function renderChoices() {
    offered = drawCards(progression);
    document.getElementById('upgrade-remaining').textContent = `남은 선택 ${progression.pending}회 · 모두 선택하면 복귀합니다`;
    const list = document.getElementById('upgrade-cards');
    list.replaceChildren();
    for (const card of offered) {
        const button = document.createElement('button');
        button.className = card.weapon ? 'upgrade-card weapon-card' : 'upgrade-card';
        button.dataset.card = card.id;
        const label = document.createElement('strong');
        label.className = 'upgrade-title';
        label.textContent = card.name;
        const rank = document.createElement('span');
        rank.className = 'upgrade-rank';
        rank.textContent = card.weapon ? `무기 획득 · ${progression.weapons.length + 1}번 슬롯` : card.id === 'repair' ? '즉시 적용' : `Lv.${cardRank(progression, card)} → Lv.${cardRank(progression, card) + 1} / ${card.maxRank}`;
        const description = document.createElement('p');
        const preview = createUpgradePreview(progression, card, playerFlight);
        description.className = 'upgrade-description';
        description.textContent = preview.description;
        button.append(label, rank, description);
        const changes = document.createElement('span');
        changes.className = 'upgrade-changes';
        for (const change of preview.changes) {
            const row = document.createElement('span');
            row.className = 'upgrade-change';
            const name = document.createElement('span');
            name.className = 'upgrade-change-label';
            name.textContent = change.label;
            const value = document.createElement('span');
            value.className = 'upgrade-change-value';
            value.textContent = change.value;
            const difference = document.createElement('small');
            difference.className = 'upgrade-change-difference';
            difference.textContent = `(${change.difference})`;
            row.append(name, value, difference);
            changes.append(row);
        }
        button.append(changes);
        button.addEventListener('click', event => {
            event.stopPropagation();
            if (gameState.activeModal !== 'cards' || !button.isConnected) return;
            audio.playCardSelect();
            chooseUpgrade(card.id, offered);
            if (progression.pending > 0) renderChoices();
            else {
                document.getElementById('upgrade-modal').hidden = true;
                gameState.activeModal = null;
                gameState.isGamePaused = gameState.phase === 'hangar';
                clearCombatInput();
                refreshProgressionUI();
                if (gameState.isGameRunning) requestGamePointerLock();
                else document.getElementById('hangar-depart').focus();
            }
        });
        list.append(button);
    }
    list.firstElementChild?.focus();
}
export function openUpgrades() {
    if (gameState.bossDyingSequence) return;
    if (!progression.pending || gameState.activeModal || (gameState.isGamePaused && gameState.phase !== 'hangar')) return;
    if (!gameState.isGameRunning && gameState.phase !== 'hangar') return;
    gameState.activeModal = 'cards';
    gameState.isGamePaused = true;
    clearCombatInput();
    releaseGamePointerLock();
    document.getElementById('upgrade-modal').hidden = false;
    refreshProgressionUI();
    renderChoices();
}
export function initUpgrades() {
    gameEvents.on(EVENTS.PROGRESSION_CHANGED, refreshProgressionUI);
    document.getElementById('upgrade-prompt').addEventListener('click', event => { event.stopPropagation(); openUpgrades(); });
    document.getElementById('hangar-upgrade').addEventListener('click', openUpgrades);
    // Trap keyboard focus inside the mandatory chooser; no background buttons are reachable.
    document.getElementById('upgrade-modal').addEventListener('keydown', event => {
        if (event.repeat && ['Enter', ' '].includes(event.key)) { event.preventDefault(); return; }
        if (event.key !== 'Tab') return;
        const buttons = [...document.querySelectorAll('#upgrade-cards button')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    });
    refreshProgressionUI();
}
