import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the production event callbacks without requiring WebGL or a DOM.
const source = readFileSync(new URL('../src/input/controls.js', import.meta.url), 'utf8');
function releaseHandler(event, overrides = {}) {
    const start = source.indexOf(`    window.addEventListener('${event}', (e) => {`);
    assert.ok(start >= 0);
    const end = source.indexOf('\n    });', start) + '\n    });'.length;
    const calls = { missiles: 0, cycles: 0, clears: 0 };
    let handler;
    const context = {
        window: { addEventListener: (_, fn) => { handler = fn; } },
        gameState: { isGameRunning: true, isGamePaused: false, controlScheme: 'casual' },
        keys: { fireCannon: true, targetCam: true },
        cameraConfig: { freelookPitch: 1, freelookYaw: 1, freelookIdleTimer: 1 },
        performance: { now: () => 100 },
        leftClickTime: 0, rightClickTime: 0,
        leftClickTimeout: 1, rightClickTimeout: 2,
        isLeftClickHeld: false, isRightClickHeld: false,
        MOUSE_HOLD_THRESHOLD: 180,
        clearTimeout() {},
        tryFireMissile: () => calls.missiles++,
        cycleTarget: () => calls.cycles++,
        clearCombatInput: () => calls.clears++,
        ...overrides,
    };
    vm.runInNewContext(source.slice(start, end), context);
    return { handler, calls, context };
}

test('short left mouse release reaches missile firing without a keyboard code', () => {
    const { handler, calls, context } = releaseHandler('mouseup');
    assert.doesNotThrow(() => handler({ button: 0 }));
    assert.equal(calls.missiles, 1);
    assert.equal(context.keys.fireCannon, false);
    assert.equal(context.leftClickTimeout, null);
});

test('long left hold stops cannon without firing a tap missile', () => {
    const { handler, calls, context } = releaseHandler('mouseup', {
        isLeftClickHeld: true, performance: { now: () => 300 },
    });
    handler({ button: 0 });
    assert.equal(calls.missiles, 0);
    assert.equal(context.keys.fireCannon, false);
});

test('short right release cycles targets and resets target camera', () => {
    const { handler, calls, context } = releaseHandler('mouseup');
    handler({ button: 2 });
    assert.equal(calls.cycles, 1);
    assert.equal(context.keys.targetCam, false);
    assert.equal(context.cameraConfig.freelookYaw, 0);
});

test('paused mouse release cannot launch missiles', () => {
    const { handler, calls } = releaseHandler('mouseup', {gameState: {isGameRunning: true, isGamePaused: true}});
    handler({ button: 0 });
    assert.equal(calls.missiles, 0);
    assert.equal(calls.clears, 1);
});

test('keyboard keyup still clears physical WASD state and missile hold', () => {
    const { handler, context } = releaseHandler('keyup');
    context.keys.keyW = context.keys.casualThrottleUp = context.keys.fireMissile = true;
    handler({code: 'KeyW'});
    handler({code: 'KeyF'});
    assert.equal(context.keys.keyW, false);
    assert.equal(context.keys.casualThrottleUp, false);
    assert.equal(context.keys.fireMissile, false);
});

test('beam mouse press clears pending cannon input and starts only the beam', () => {
    let timers = 0;
    const { handler, context, calls } = releaseHandler('mousedown', {
        gameState: { isGameRunning: true, isGamePaused: false, missileMode: 3 },
        setTimeout: () => { timers++; },
    });
    handler({ button: 0, target: { closest: () => null } });
    assert.equal(context.keys.fireCannon, false);
    assert.equal(context.keys.beamMouse, true);
    assert.equal(context.leftClickTimeout, null);
    assert.equal(calls.missiles, 1);
    assert.equal(timers, 0);
});

test('switching to beam while a cannon hold timer is pending prevents the shot', () => {
    let timeout, shots = 0;
    const { handler, context } = releaseHandler('mousedown', {
        gameState: { isGameRunning: true, isGamePaused: false, missileMode: 1 },
        setTimeout: fn => { timeout = fn; return 3; },
        fireCannon: () => { shots++; }, playerFlight: {}, playerMesh: {},
    });
    handler({ button: 0, target: { closest: () => null } });
    context.gameState.missileMode = 3;
    timeout();
    assert.equal(context.keys.fireCannon, false);
    assert.equal(shots, 0);
});

test('cannon spawn gate blocks every player input in beam mode but leaves enemies unchanged', () => {
    const weapons = readFileSync(new URL('../src/combat/weapons.js', import.meta.url), 'utf8');
    const start = weapons.indexOf('export function fireCannon(');
    const end = weapons.indexOf('export function fireAntiAirBullet', start);
    const context = { gameState: { missileMode: 3 }, playerMesh: {}, bulletGeom: {}, bulletMat: {},
        THREE: { Mesh: class { constructor() { throw new Error('projectile allocation'); } } } };
    vm.runInNewContext(weapons.slice(start, end).replace('export function', 'function'), context);
    assert.doesNotThrow(() => context.fireCannon(true));
    assert.throws(() => context.fireCannon(false), /projectile allocation/);
    for (const mode of [1, 2]) {
        context.gameState.missileMode = mode;
        assert.throws(() => context.fireCannon(true), /projectile allocation/);
    }
});
