import { gameEvents, EVENTS } from '../core/events.js';
import { gameState } from '../core/state.js';
import { playerFlight } from '../player/player.js';
import { updateWeaponHUD } from '../combat/weapons.js';
import { createProgression, grantExperience, calculateStats, applyStats } from './model.js';
import { selectCard } from './cards.js';

export const progression = createProgression();
export function resetProgression() {
    Object.assign(progression, createProgression());
    // New run is reset by missions before calculating its baseline stats.
    applyStats(playerFlight, calculateStats(progression));
    gameEvents.emit(EVENTS.PROGRESSION_CHANGED);
}
export function chooseUpgrade(id, offered) {
    const card = selectCard(progression, id, offered);
    applyStats(playerFlight, calculateStats(progression));
    if (card.id === 'repair') {
        playerFlight.health = Math.min(playerFlight.maxHealth, playerFlight.health + playerFlight.maxHealth * 0.3);
        playerFlight.score += 500;
    }
    updateWeaponHUD();
    gameEvents.emit(EVENTS.PROGRESSION_CHANGED);
}
export function initProgression() {
    gameEvents.on(EVENTS.ENEMY_DESTROYED, ({ enemyType, isBoss }) => {
        if (!gameState.isGameRunning) return;
        grantExperience(progression, isBoss ? 200 : ({ aircraft: 20, tank: 25, turret: 20, ship: 80 }[enemyType] || 20));
        gameEvents.emit(EVENTS.PROGRESSION_CHANGED);
    });
}
