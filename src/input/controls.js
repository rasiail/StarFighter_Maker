import { resetGamepad } from './gamepad.js';
// input/controls: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { keys } from './state.js';
import { fireCannon, tryFireMissile, updateWeaponHUD } from '../combat/weapons.js';
import { cycleTarget } from '../combat/targeting.js';
import { audio } from '../audio/audio.js';
import { toggleOptionsMenu } from '../ui/menus.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { cameraConfig } from '../camera/camera.js';
import { camera, renderer } from '../rendering/scene.js';
import { retroMaterial, retroRenderTarget } from '../rendering/retro.js';
import { openUpgrades } from '../ui/upgrades.js';

let leftClickTime;
let leftClickTimeout;
let isLeftClickHeld;
let rightClickTime;
let rightClickTimeout;
let isRightClickHeld;
let MOUSE_HOLD_THRESHOLD;
export let virtualMouse;
export let virtualCursorEl;
let stickPad;
let stickKnob;
let stickActive;
let stickOrigin;
let resetStick;
let touchGun;
let touchMsl;
let touchThr;
let touchThrToggle;

export function updateVirtualCursorPos() {
    if (virtualCursorEl && virtualMouse.visible) {
        virtualCursorEl.style.transform = `translate3d(${virtualMouse.x}px, ${virtualMouse.y}px, 0)`;
    }
}

export function clearCombatInput() {
    resetGamepad();
    Object.keys(keys).forEach(key => { keys[key] = false; });
    clearTimeout(leftClickTimeout);
    clearTimeout(rightClickTimeout);
    leftClickTimeout = rightClickTimeout = null;
    isLeftClickHeld = isRightClickHeld = touchThrToggle = false;
    leftClickTime = rightClickTime = -Infinity;
    if (resetStick) resetStick();
}

export function initControls() {
    window.addEventListener('keydown', (e) => {
        const code = e.code;
        if (gameState.activeModal === 'cards') {
            if (['Escape', 'KeyX', 'Space'].includes(code)) e.preventDefault();
            return;
        }
        if (code === 'KeyX') { e.preventDefault(); if (!e.repeat) openUpgrades(); return; }
        if (code === 'Escape') { e.preventDefault(); toggleOptionsMenu(); return; }
        if (!gameState.isGameRunning || gameState.isGamePaused) return;

        // 1. 브라우저 기본 단축키 원천 차단 (F12 개발자 도구 제외)
        // Ctrl 키나 Meta(Cmd) 키가 눌려있을 때 발생하는 모든 브라우저 단축키(Ctrl+W 탭 닫기, Ctrl+S 저장, Ctrl+D 북마크, Ctrl+F 검색 등) 차단
        if (e.ctrlKey || e.metaKey) {
            if (code !== 'F12') {
                e.preventDefault();
            }
        }

        // 2. Space 키 브라우저 기본 스크롤 동작 차단 (Shift+Space 포함)
        if (code === 'Space') {
            e.preventDefault();
        }

        // 3. Shift 키 조합 시 발생하는 브라우저 특수 기능 차단 (F12 제외)
        if (e.shiftKey && code.startsWith('F') && code !== 'KeyF' && code !== 'F12') {
            e.preventDefault();
        }

        // 비행 조작 키 매핑
        if (code === 'KeyW') keys.pitchDown = true;
        if (code === 'KeyS') keys.pitchUp = true;
        if (code === 'KeyA') keys.rollLeft = true;
        if (code === 'KeyD') keys.rollRight = true;
        if (code === 'KeyQ') keys.yawLeft = true;
        if (code === 'KeyE') keys.yawRight = true;
        if (code === 'ShiftLeft' || code === 'ShiftRight') keys.throttleUp = true;
        // 감속 키를 Ctrl에서 Alt로 변경하고, Alt 키의 브라우저 메뉴 진입(기본 동작)을 막음
        if (code === 'AltLeft' || code === 'AltRight') {
            e.preventDefault();
            keys.throttleDown = true;
        }
        if (code === 'Space') {
            keys.fireCannon = true;
            keys.spaceKey = true;
        }
        if (code === 'KeyF') {
            keys.fireMissile = true;
            tryFireMissile();
        }
        if (code === 'KeyC') cycleTarget();
        if (code === 'KeyT') {
            keys.targetCam = true;
            keys.targetCamKey = true;
        }
        // 1번 키: 표준 미사일(단발), 2번 키: 멀티 미사일(전방 콘 다중 락온)
        if (code === 'Digit1' || code === 'Numpad1' || e.key === '1') {
            gameState.missileMode = 1;
            updateWeaponHUD();
            audio.playLockBeep(false);
            console.log('[WEAPON] MODE 1: Standard Missile');
        }
        if (code === 'Digit2' || code === 'Numpad2' || e.key === '2') {
            gameState.missileMode = 2;
            updateWeaponHUD();
            audio.playLockBeep(false);
            console.log('[WEAPON] MODE 2: Multi Missile');
        }
        // ESC 키: 옵션 메뉴 열기/닫기 및 게임 일시정지 (포인터 락 해제)
        if (code === 'Escape') {
            toggleOptionsMenu();
        }
    });

    window.addEventListener('keyup', (e) => {
        const code = e.code;
        if (!gameState.isGameRunning || gameState.isGamePaused) { clearCombatInput(); return; }
        if (code === 'KeyW') keys.pitchDown = false;
        if (code === 'KeyS') keys.pitchUp = false;
        if (code === 'KeyA') keys.rollLeft = false;
        if (code === 'KeyD') keys.rollRight = false;
        if (code === 'KeyQ') keys.yawLeft = false;
        if (code === 'KeyE') keys.yawRight = false;
        if (code === 'ShiftLeft' || code === 'ShiftRight') {
            keys.throttleUp = false;
            playerFlight.cruiseSpeed = playerFlight.defaultCruiseSpeed || 550;
        }
        if (code === 'AltLeft' || code === 'AltRight') {
            e.preventDefault();
            keys.throttleDown = false;
            playerFlight.cruiseSpeed = playerFlight.defaultCruiseSpeed || 550;
        }
        if (code === 'Space') {
            keys.fireCannon = false;
            keys.spaceKey = false;
        }
        if (code === 'KeyF') keys.fireMissile = false;
        if (code === 'KeyT') {
            keys.targetCam = false;
            keys.targetCamKey = false;
        }
    });

    window.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('wheel', (e) => {
        if (!gameState.isGameRunning || gameState.isGamePaused) return;

        // 휠 스크롤 한 칸당 80kts 증감 (기존 대비 2배 빠르게 조절)
        const scrollStep = 80;

        // e.deltaY < 0 이면 휠을 위로 올림 (가속)
        // e.deltaY > 0 이면 휠을 아래로 내림 (감속)
        if (e.deltaY < 0) {
            playerFlight.cruiseSpeed = Math.min(playerFlight.maxSpeed, playerFlight.cruiseSpeed + scrollStep);
        } else if (e.deltaY > 0) {
            playerFlight.cruiseSpeed = Math.max(playerFlight.minSpeed, playerFlight.cruiseSpeed - scrollStep);
        }
    }, { passive: true });

    window.addEventListener('blur', () => {
        if (leftClickTimeout) {
            clearTimeout(leftClickTimeout);
            leftClickTimeout = null;
        }
        if (rightClickTimeout) {
            clearTimeout(rightClickTimeout);
            rightClickTimeout = null;
        }
        keys.fireCannon = false;
        keys.fireMissile = false;
        keys.targetCam = false;
        cameraConfig.freelookPitch = 0;
        cameraConfig.freelookYaw = 0;
        cameraConfig.freelookIdleTimer = 0;
        isLeftClickHeld = false;
        isRightClickHeld = false;
    });

    leftClickTime = 0;

    leftClickTimeout = null;

    isLeftClickHeld = false;

    rightClickTime = 0;

    rightClickTimeout = null;

    isRightClickHeld = false;

    MOUSE_HOLD_THRESHOLD = 180;

    window.addEventListener('mousedown', (e) => {
        if (!gameState.isGameRunning || gameState.isGamePaused || e.target.closest('button, .run-modal')) return;
        if (e.button === 0) { // Left click: 짧은 탭은 미사일, 길게 누르면 기관총
            leftClickTime = performance.now();
            isLeftClickHeld = false;

            if (leftClickTimeout) clearTimeout(leftClickTimeout);
            // 0.18초 이상 홀딩 시 즉각 기관총 연속 사격 모드 진입
            leftClickTimeout = setTimeout(() => {
                isLeftClickHeld = true;
                keys.fireCannon = true; // 홀드 시 기관포 발사 시작
                if (gameState.isGameRunning && !gameState.isGamePaused) {
                    fireCannon(true, playerMesh);
                    playerFlight.cannonCooldown = 0.05;
                }
            }, MOUSE_HOLD_THRESHOLD);

        } else if (e.button === 2) { // Right click: 짧은 탭은 타깃 전환, 길게 누르면 타깃 캠
            rightClickTime = performance.now();
            isRightClickHeld = false;
            keys.targetCam = false;
            if (rightClickTimeout) clearTimeout(rightClickTimeout);
            // 0.18초 이상 홀드 시 타깃 캠 활성화
            rightClickTimeout = setTimeout(() => {
                isRightClickHeld = true;
                keys.targetCam = true;
            }, MOUSE_HOLD_THRESHOLD);
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (!gameState.isGameRunning || gameState.isGamePaused) { clearCombatInput(); return; }
        if (e.button === 0) { // Left click
            // 타이머 취소 및 기관포 발사 중지
            if (leftClickTimeout) {
                clearTimeout(leftClickTimeout);
                leftClickTimeout = null;
            }
            keys.fireCannon = false; // 마우스 떼면 기관포 발사 중지

            const clickDuration = performance.now() - leftClickTime;
            // 단발 클릭(0.18초 미만으로 짧게 탭)했을 경우에만 미사일 발사 (기관포는 발사되지 않음)
            if (!isLeftClickHeld && clickDuration < MOUSE_HOLD_THRESHOLD) {
                tryFireMissile();
            }
            isLeftClickHeld = false;

        } else if (e.button === 2) { // Right click
            // 타이머 취소 및 타깃 캠 해제
            if (rightClickTimeout) {
                clearTimeout(rightClickTimeout);
                rightClickTimeout = null;
            }
            keys.targetCam = false;
            cameraConfig.freelookPitch = 0;
            cameraConfig.freelookYaw = 0;
            cameraConfig.freelookIdleTimer = 0;

            const clickDuration = performance.now() - rightClickTime;
            // 0.18초 미만의 짧은 탭 클릭 시에만 타깃 순환
            if (!isRightClickHeld && clickDuration < MOUSE_HOLD_THRESHOLD) {
                cycleTarget();
            }
            isRightClickHeld = false;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (e.button === 0) {
            if (leftClickTimeout) {
                clearTimeout(leftClickTimeout);
                leftClickTimeout = null;
            }
            keys.fireCannon = false;
            isLeftClickHeld = false;
        } else if (e.button === 2) {
            if (rightClickTimeout) {
                clearTimeout(rightClickTimeout);
                rightClickTimeout = null;
            }
            keys.targetCam = false;
            isRightClickHeld = false;
        }
    });

    virtualMouse = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        visible: false
    };

    virtualCursorEl = document.getElementById('virtual-cursor');

    window.addEventListener('mousemove', (e) => {
        const isLocked = (document.pointerLockElement === document.body);
        if (isLocked) {
            // 게임 창 밖으로 나가지 못하도록 화면 경계(안쪽 16px 마진) 내에서 마우스 위치 제한
            virtualMouse.x = Math.max(16, Math.min(window.innerWidth - 16, virtualMouse.x + e.movementX));
            virtualMouse.y = Math.max(16, Math.min(window.innerHeight - 16, virtualMouse.y + e.movementY));
            updateVirtualCursorPos();

            // 마우스 이동을 통한 자유 시점(Freelook) 카메라 회전 적용
            if (!keys.targetCam) {
                cameraConfig.freelookYaw -= e.movementX * 0.0035;
                cameraConfig.freelookPitch -= e.movementY * 0.0035;
                // 상하 시야 한계 제한 (±80도)
                cameraConfig.freelookPitch = THREE.MathUtils.clamp(cameraConfig.freelookPitch, -Math.PI * 0.45, Math.PI * 0.45);
                // 마우스를 움직이면 타이머를 리셋하여 복귀를 지연시킴
                cameraConfig.freelookIdleTimer = 1.2;
            }
        } else {
            virtualMouse.x = e.clientX;
            virtualMouse.y = e.clientY;
        }

        // 안전장치: 마우스 버튼을 뗐는데도 플래그가 유지되고 있다면 강제 해제
        if (keys.fireCannon && !keys.spaceKey && (e.buttons & 1) === 0) {
            keys.fireCannon = false;
            isLeftClickHeld = false;
            if (leftClickTimeout) {
                clearTimeout(leftClickTimeout);
                leftClickTimeout = null;
            }
        }
        if (keys.targetCam && !keys.targetCamKey && (e.buttons & 2) === 0) {
            keys.targetCam = false;
            isRightClickHeld = false;
            if (rightClickTimeout) {
                clearTimeout(rightClickTimeout);
                rightClickTimeout = null;
            }
        }
    });

    stickPad = document.getElementById('virtual-stick');

    stickKnob = document.getElementById('stick-knob');

    stickActive = false;

    stickOrigin = { x: 0, y: 0 };

    stickPad.addEventListener('pointerdown', (e) => {
        if (!gameState.isGameRunning || gameState.isGamePaused) return;
        stickActive = true;
        const rect = stickPad.getBoundingClientRect();
        stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        stickPad.setPointerCapture(e.pointerId);
    });

    stickPad.addEventListener('pointermove', (e) => {
        if (!stickActive) return;
        const dx = e.clientX - stickOrigin.x;
        const dy = e.clientY - stickOrigin.y;
        const maxR = 45;
        const dist = Math.min(maxR, Math.hypot(dx, dy));
        const angle = Math.atan2(dy, dx);

        const kx = Math.cos(angle) * dist;
        const ky = Math.sin(angle) * dist;
        stickKnob.style.transform = `translate(${kx}px, ${ky}px)`;

        // Map stick to Roll & Pitch
        keys.rollLeft = kx < -15;
        keys.rollRight = kx > 15;
        keys.pitchDown = ky < -15;
        keys.pitchUp = ky > 15;
    });

    resetStick = () => {
        stickActive = false;
        stickKnob.style.transform = 'translate(0px, 0px)';
        keys.rollLeft = false;
        keys.rollRight = false;
        keys.pitchDown = false;
        keys.pitchUp = false;
    };

    stickPad.addEventListener('pointerup', resetStick);

    stickPad.addEventListener('pointercancel', resetStick);

    touchGun = document.getElementById('touch-fire-gun');

    touchGun.addEventListener('pointerdown', () => { if (gameState.isGameRunning && !gameState.isGamePaused) keys.fireCannon = true; });

    touchGun.addEventListener('pointerup', () => { keys.fireCannon = false; });

    touchMsl = document.getElementById('touch-fire-msl');

    touchMsl.addEventListener('pointerdown', () => { if (gameState.isGameRunning && !gameState.isGamePaused) { keys.fireMissile = true; tryFireMissile(); } });

    touchMsl.addEventListener('pointerup', () => { keys.fireMissile = false; });

    touchThr = document.getElementById('touch-throttle');

    touchThrToggle = false;

    touchThr.addEventListener('pointerdown', () => {
        if (!gameState.isGameRunning || gameState.isGamePaused) return;
        touchThrToggle = !touchThrToggle;
        keys.throttleUp = touchThrToggle;
        keys.throttleDown = !touchThrToggle;
    });

    window.addEventListener('beforeunload', (e) => {
        if (gameState.isGameRunning) {
            e.preventDefault();
            e.returnValue = ''; // 브라우저 표준 경고창(탭 닫기 확인) 트리거
            // 탭 닫기 직전 마우스 커서 이탈 버그를 막기 위해 포인터 락 강제 해제
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // 키 입력 및 마우스 버튼 상태 초기화 (계속 눌려있는 현상 방지)
            keys.throttleUp = false;
            keys.throttleDown = false;
            keys.fireCannon = false;
            keys.targetCam = false;
            // 포인터 락 안전 해제
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    });

    window.addEventListener('resize', () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (retroRenderTarget) {
            retroRenderTarget.setSize(w, h);
            if (retroMaterial) {
                retroMaterial.uniforms.uResolution.value.set(w, h);
            }
        }
    });
}
