import { createPadReader, padInput, clearPadInput } from './gamepad-state.js';
import { gameState } from '../core/state.js';
import { playerFlight } from '../player/player.js';
import { cameraConfig } from '../camera/camera.js';
import { tryFireMissile, updateWeaponHUD } from '../combat/weapons.js';
import { cycleTarget } from '../combat/targeting.js';
import { openUpgrades } from '../ui/upgrades.js';
import { toggleOptionsMenu } from '../ui/menus.js';

const reader = createPadReader();
let device = null;
export function resetGamepad() {
    clearPadInput();
    reader.reset();
}
function menuRoot() {
    return ['upgrade-modal', 'options-modal', 'hangar-modal', 'gameover-modal', 'stage-modal', 'start-modal']
        .map(id => document.getElementById(id)).find(el => el && !el.hidden && el.getClientRects().length);
}
function navigateMenu(input) {
    const root = menuRoot();
    if (!root) return;
    const items = [...root.querySelectorAll('button, input, .stage-card')].filter(el => !el.disabled && el.getClientRects().length);
    if (!items.length) return;
    let index = items.indexOf(document.activeElement);
    const direction = input.pressed[12] || input.pressed[14] ? -1 : input.pressed[13] || input.pressed[15] ? 1 : 0;
    const focused = items[index];
    if (focused?.type === 'range' && (input.pressed[14] || input.pressed[15])) {
        focused.value = Math.max(Number(focused.min), Math.min(Number(focused.max), Number(focused.value) + direction * 5));
        focused.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (direction || index < 0) {
        index = index < 0 ? 0 : (index + direction + items.length) % items.length;
        items[index].tabIndex = 0;
        items[index].focus();
    }
    if (input.pressed[0] || input.pressed[1]) items[index]?.click();
}
export function updateGamepad(delta, now = performance.now() / 1000) {
    if (document.hidden) { resetGamepad(); return; }
    let pads;
    try { pads = Array.from(navigator.getGamepads?.() || []); }
    catch { resetGamepad(); return; }
    const pad = pads.find(p => p?.connected && p.mapping === 'standard' && `${p.index}:${p.id}` === device)
        || pads.find(p => p?.connected && p.mapping === 'standard')
        || pads.find(p => p?.connected && `${p.index}:${p.id}` === device)
        || pads.find(p => p?.connected);
    if (!pad) { device = null; resetGamepad(); return; }
    const identity = `${pad.index}:${pad.id}`;
    if (identity !== device) { resetGamepad(); device = identity; }
    const context = `${gameState.phase}:${gameState.activeModal}:${gameState.isGameRunning}:${gameState.isGamePaused}`;
    const input = reader.read(pad, now, context);
    const wasThrottle = padInput.throttleUp || padInput.throttleDown;
    const wasTargetCam = padInput.targetCam;
    clearPadInput();
    if (input.pressed[9]) { toggleOptionsMenu(); resetGamepad(); return; }
    if (gameState.activeModal || !gameState.isGameRunning || gameState.isGamePaused) {
        // Cross opens upgrades in the hangar; use Circle to activate its departure button.
        if (gameState.phase === 'hangar' && !gameState.activeModal && input.pressed[0]) openUpgrades();
        else navigateMenu(input);
        return;
    }
    if (input.pressed[0]) { openUpgrades(); if (gameState.isGamePaused) { resetGamepad(); return; } }
    if (input.pressed[2]) { gameState.missileMode = gameState.missileMode === 1 ? 2 : 1; updateWeaponHUD(); }
    if (input.tap[1]) tryFireMissile();
    if (input.tap[6]) cycleTarget();
    Object.assign(padInput, {
        pitch: input.axes[1], roll: -input.axes[0], yaw: Number(input.down[4]) - Number(input.down[5]),
        throttleUp: input.down[7], throttleDown: input.down[3], fireCannon: input.hold[1], targetCam: input.hold[6],
    });
    if (wasThrottle && !padInput.throttleUp && !padInput.throttleDown) playerFlight.cruiseSpeed = playerFlight.defaultCruiseSpeed;
    if (wasTargetCam && !padInput.targetCam) {
        cameraConfig.freelookYaw = cameraConfig.freelookPitch = cameraConfig.freelookIdleTimer = 0;
    }
    if (!padInput.targetCam && (input.axes[2] || input.axes[3])) {
        cameraConfig.freelookYaw -= input.axes[2] * delta * 2;
        cameraConfig.freelookPitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, cameraConfig.freelookPitch - input.axes[3] * delta * 2));
        cameraConfig.freelookIdleTimer = 1.2;
    }
}
export function initGamepad() {
    window.addEventListener('blur', resetGamepad);
    window.addEventListener('gamepaddisconnected', resetGamepad);
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetGamepad(); });
}
