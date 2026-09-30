import { t } from '../ui/i18n.js';
import { createPadReader, padInput, clearPadInput, selectActivePad } from './gamepad-state.js';
import { gameState } from '../core/state.js';
import { playerFlight } from '../player/player.js';
import { cameraConfig } from '../camera/camera.js';
import { tryFireMissile, updateWeaponHUD, selectWeaponSlot } from '../combat/weapons.js';
import { cycleTarget } from '../combat/targeting.js';
import { openUpgrades } from '../ui/upgrades.js';
import { toggleOptionsMenu } from '../ui/menus.js';

const reader = createPadReader();
let device = null;
function showPadStatus(message) {
    const status = document.getElementById('gamepad-status');
    if (status && status.textContent !== message) status.textContent = message;
}
export function resetGamepad() {
    if (cameraConfig) cameraConfig.padFreelookReturning = false;
    if (cameraConfig?.padFreelook) {
        cameraConfig.padFreelook = false;
        cameraConfig.freelookIdleTimer = 0;
    }
    clearPadInput();
    reader.reset();
}
function menuRoot() {
    return ['setup-modal', 'upgrade-modal', 'options-modal', 'stage-summary-modal', 'gameover-modal', 'sector-modal', 'start-modal']
        .map(id => document.getElementById(id)).find(el => el && !el.hidden && el.getClientRects().length);
}
function navigateMenu(input) {
    const root = menuRoot();
    if (!root) return;
    const items = [...root.querySelectorAll('button, input, select, .sector-card')].filter(el => !el.disabled && el.getClientRects().length);
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
    if (input.pressed[0] || input.pressed[1]) {
        const item = items[index];
        if (item?.tagName === 'SELECT') {
            item.selectedIndex = (item.selectedIndex + 1) % item.options.length;
            item.dispatchEvent(new Event('change', { bubbles: true }));
        } else item?.click();
    }
}
export function updateGamepad(delta, now = performance.now() / 1000) {
    if (document.hidden) { resetGamepad(); return; }
    if (typeof navigator.getGamepads !== 'function') {
        showPadStatus(t('게임패드 API를 사용할 수 없습니다. HTTPS 또는 localhost에서 실행해 주세요.'));
        resetGamepad(); return;
    }
    let pads;
    try { pads = Array.from(navigator.getGamepads?.() || []); }
    catch {
        showPadStatus(t('브라우저가 게임패드 접근을 차단했습니다. 게임을 별도 탭에서 열어 주세요.'));
        resetGamepad(); return;
    }
    const pad = selectActivePad(pads, device);
    if (!pad) {
        showPadStatus(t('패드 감지 대기 · 게임 화면을 클릭한 뒤 패드 버튼을 눌렀다 떼어 주세요.'));
        device = null; resetGamepad(); return;
    }
    const buttons = pad.buttons.flatMap((button, index) => button.pressed || button.value > 0.5 ? [index + 1] : []);
    const stick = pad.axes.slice(0, 4).some(axis => Math.abs(axis) > 0.18);
    showPadStatus(`${t('연결됨', 'Connected')} · ${pad.id} · ${pad.mapping === 'standard' ? t('표준 버튼 배치') : t('비표준 버튼 배치 (조작이 다를 수 있음)')} · ${buttons.length ? `${t('버튼', 'Buttons')} ${buttons.join(', ')}` : stick ? t('스틱 입력 중') : t('입력 대기')}`);
    const identity = `${pad.index}:${pad.id}`;
    if (identity !== device) { resetGamepad(); device = identity; }
    const context = `${gameState.phase}:${gameState.activeModal}:${gameState.isGameRunning}:${gameState.isGamePaused}`;
    const input = reader.read(pad, now, context);
    const wasThrottle = padInput.throttleUp || padInput.throttleDown;
    const wasTargetCam = padInput.targetCam;
    clearPadInput();
    if (input.pressed[9]) { toggleOptionsMenu(); resetGamepad(); return; }
    if (gameState.activeModal || !gameState.isGameRunning || gameState.isGamePaused) {
        // Cross opens upgrades between stages; use Circle to activate the next-stage button.
        if (gameState.phase === 'intermission' && !gameState.activeModal && input.pressed[0]) openUpgrades();
        else navigateMenu(input);
        return;
    }
    if (input.pressed[0]) { openUpgrades(); if (gameState.isGamePaused) { resetGamepad(); return; } }
    if (input.pressed[2]) { const owned = gameState.ownedWeapons || [1]; selectWeaponSlot((owned.indexOf(gameState.missileMode) + 1) % owned.length); }
    if (gameState.missileMode === 3 ? input.pressed[1] : input.tap[1]) tryFireMissile();
    if (input.tap[6]) cycleTarget();
    Object.assign(padInput, {
        pitch: input.axes[1], roll: -input.axes[0], yaw: Number(input.down[4]) - Number(input.down[5]),
        throttleUp: input.down[7], throttleDown: input.down[3], fireCannon: gameState.missileMode !== 3 && input.hold[1], beamHeld: gameState.missileMode === 3 && input.down[1], targetCam: input.hold[6],
    });
    if (wasThrottle && !padInput.throttleUp && !padInput.throttleDown) playerFlight.cruiseSpeed = playerFlight.defaultCruiseSpeed;
    if (wasTargetCam && !padInput.targetCam) {
        cameraConfig.freelookYaw = cameraConfig.freelookPitch = cameraConfig.freelookIdleTimer = 0;
    }
    const stickLook = !padInput.targetCam && !!(input.axes[2] || input.axes[3]);
    if (cameraConfig?.padFreelook && !stickLook) {
        cameraConfig.padFreelook = false;
        cameraConfig.padFreelookReturning = !padInput.targetCam;
        cameraConfig.freelookIdleTimer = 0;
    }
    if (stickLook) {
        cameraConfig.padFreelook = true;
        cameraConfig.padFreelookReturning = false;
        cameraConfig.freelookYaw -= input.axes[2] * delta * 2;
        cameraConfig.freelookPitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, cameraConfig.freelookPitch - input.axes[3] * delta * 2));
        cameraConfig.freelookIdleTimer = 0;
    }
}
export function initGamepad() {
    window.addEventListener('blur', resetGamepad);
    window.addEventListener('gamepaddisconnected', resetGamepad);
    document.addEventListener('visibilitychange', () => { if (document.hidden) resetGamepad(); });
}
