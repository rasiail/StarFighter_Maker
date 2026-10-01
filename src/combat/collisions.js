import { createContactTracker } from './contact.js';
import { enemies } from '../enemies/fleet.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { playerMesh, playerFlight } from '../player/player.js';
import { gameState } from '../core/state.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { triggerExplosion } from '../effects/particles.js';
import { audio } from '../audio/audio.js';

const contacts = createContactTracker();
export function resetPlayerContacts() { contacts.reset(); }
export function capturePlayerContacts() { contacts.capture(playerMesh.position, enemies); }
export function updatePlayerContacts(delta) {
    if (gameState.isPlayerDead || !gameState.isGameRunning || gameState.isGamePaused) return;
    contacts.update(delta, playerMesh.position, playerFlight, enemies, (enemy, damage) => {
        gameEvents.emit(EVENTS.PLAYER_HIT, { damage });
        triggerExplosion(playerMesh.position, 15, 0.9);
        audio?.playExplosion();
        if (playerFlight.health <= 0) gameEvents.emit(EVENTS.PLAYER_DESTROYED);
    }, killEnemy);
}
