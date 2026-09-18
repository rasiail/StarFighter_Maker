// input/state: imports are side-effect free; main.js controls initialization.

export let keys;


export function initInputState() {
    keys = {
        pitchUp: false,    // S
        pitchDown: false,  // W
        rollLeft: false,   // A
        rollRight: false,  // D
        yawLeft: false,    // Q
        yawRight: false,   // E
        throttleUp: false, // Shift
        throttleDown: false,// Ctrl
        fireCannon: false, // Space / Mouse Left Hold
        fireMissile: false,// F
        targetCam: false,  // Mouse Right Hold
        targetCycle: false,// Mouse Right Click / C
        spaceKey: false,   // Space (기관포 마우스 안전장치 구분용)
        targetCamKey: false// T key (타깃캠 마우스 안전장치 구분용)
    };
}
