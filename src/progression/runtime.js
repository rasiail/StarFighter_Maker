import { gameEvents, EVENTS } from '../core/events.js';
import { gameState } from '../core/state.js';
import { playerFlight } from '../player/player.js';
import { updateWeaponHUD } from '../combat/weapons.js';
import { createProgression, grantExperience, calculateStats, applyStats } from './model.js';
import { selectCard } from './cards.js';
import { BALANCE } from '../data/generated/balance.js';
import { enemyExperience } from './rewards.js';

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
        const restore = card.effects?.find(effect => effect.effectKey === 'health_restore')?.value ?? 0.3;
        const score = card.effects?.find(effect => effect.effectKey === 'score')?.value ?? 500;
        playerFlight.health = Math.min(playerFlight.maxHealth, playerFlight.health + playerFlight.maxHealth * restore);
        playerFlight.score += score;
    }
    updateWeaponHUD();
    gameEvents.emit(EVENTS.PROGRESSION_CHANGED);
}
export function initProgression() {
    gameEvents.on(EVENTS.ENEMY_DESTROYED, ({ enemyType, isBoss }) => {
        if (!gameState.isGameRunning) return;
        const id = isBoss ? 'boss' : ({ aircraft: 'stage_aircraft', tank: 'tank', turret: 'ship_turret', ship: 'ship_hull', elite: 'elite' }[enemyType] || 'stage_aircraft');
        const stage = BALANCE.stages.find(row => row.stageId === gameState.currentStageInfo?.stage);
        grantExperience(progression, enemyExperience(id, stage));
        gameEvents.emit(EVENTS.PROGRESSION_CHANGED);
    });
}
