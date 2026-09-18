// input/pointer-lock: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { updateVirtualCursorPos, virtualCursorEl, virtualMouse } from './controls.js';
import { openOptionsMenu } from '../ui/menus.js';


export function requestGamePointerLock() {
    if (!gameState.isPointerLockEnabled) return;
    if (!gameState.isGameRunning || gameState.isGamePaused) return;
    const optModal = document.getElementById('options-modal');
    if (optModal && optModal.style.display === 'flex') return;

    const target = document.body;
    if (document.pointerLockElement !== target && target.requestPointerLock) {
        try {
            const promise = target.requestPointerLock();
            if (promise && promise.catch) {
                promise.catch(() => {});
            }
        } catch (e) {}
    }
}
export function releaseGamePointerLock() {
    gameState.wasPointerLocked = false;
    try {
        if (document.pointerLockElement && document.exitPointerLock) {
            document.exitPointerLock();
        }
    } catch (e) {}
    virtualMouse.visible = false;
    if (virtualCursorEl) virtualCursorEl.style.display = 'none';
    document.body.style.cursor = 'default';
}

export function initPointerLock() {
    document.addEventListener('pointerlockchange', () => {
        const isLocked = (document.pointerLockElement === document.body);
        if (isLocked) {
            gameState.wasPointerLocked = true;
            virtualMouse.visible = true;
            if (virtualCursorEl) virtualCursorEl.style.display = 'block';
            updateVirtualCursorPos();
        } else {
            const hadLock = gameState.wasPointerLocked;
            gameState.wasPointerLocked = false;
            virtualMouse.visible = false;
            if (virtualCursorEl) virtualCursorEl.style.display = 'none';
            document.body.style.cursor = 'default';

            // 인게임 비행 중 실제로 포인터 락이 걸려있던 상태에서 ESC 등으로 락이 풀렸을 때만 옵션(일시정지) 메뉴 열기
            if (hadLock && gameState.isGameRunning && !gameState.isGamePaused) {
                const optModal = document.getElementById('options-modal');
                const gameoverModal = document.getElementById('gameover-modal');
                const stageModal = document.getElementById('stage-modal');
                const startModal = document.getElementById('start-modal');
                const isAnyModalOpen = (optModal && optModal.style.display === 'flex') ||
                                       (gameoverModal && gameoverModal.style.display === 'flex') ||
                                       (stageModal && stageModal.style.display === 'flex') ||
                                       (startModal && startModal.style.display !== 'none');
                if (!isAnyModalOpen) {
                    openOptionsMenu();
                }
            }
        }
    });

    window.addEventListener('click', (e) => {
        if (!gameState.isPointerLockEnabled) return;
        const optModal = document.getElementById('options-modal');
        const isOptOpen = (optModal && optModal.style.display === 'flex');
        const startModal = document.getElementById('start-modal');
        const isStartOpen = (startModal && startModal.style.display !== 'none');
        const stageModal = document.getElementById('stage-modal');
        const isStageOpen = (stageModal && stageModal.style.display === 'flex');

        // 시작/스테이지 모달이나 옵션 메뉴가 열려있을 때는 포인터 락을 걸지 않음
        if (gameState.isGameRunning && !gameState.isGamePaused && !isOptOpen && !isStartOpen && !isStageOpen) {
            requestGamePointerLock();
        }
    });
}
