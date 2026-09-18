// core/session: imports are side-effect free; main.js controls initialization.
import { gameState } from './state.js';



export function initSession() {
    gameState.isGameRunning = false;

    gameState.isGamePaused = false;

    gameState.isPointerLockEnabled = true;

    gameState.wasPointerLocked = false;
}
