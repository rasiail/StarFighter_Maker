import test from 'node:test';
import assert from 'node:assert/strict';
import { aimOutsideDeadzone } from '../src/player/mouse-aim.js';
import { cameraFollowOffset } from '../src/camera/follow.js';

test('initial and cruise rear camera use the same 9.375m distance', () => {
    assert.deepEqual(cameraFollowOffset(), cameraFollowOffset(0.5));
    for (const speed of [-0.1, 0, 0.5]) {
        const offset = cameraFollowOffset(speed);
        assert.equal(offset.z, 9.375);
        assert.ok(Math.abs(offset.y - 1.8) < 1e-9);
    }
});

test('rear camera smoothly reaches 12.5m at 80% speed', () => {
    assert.equal(cameraFollowOffset(0.65).z, 10.9375);
    for (const speed of [0.8, 1, 1.2]) {
        assert.deepEqual(cameraFollowOffset(speed), { y: 2.2, z: 12.5 });
    }
});

test('side and front views preserve the full orbit distance', () => {
    for (const yaw of [Math.PI / 2, -Math.PI / 2, Math.PI]) {
        assert.equal(cameraFollowOffset(0.5, yaw).z, 12.5);
    }
    assert.equal(cameraFollowOffset(0.5, 0, Math.PI / 2).z, 12.5);
});


test('camera deadzone is square on landscape and portrait viewports', () => {
    const fov = 90, aspect = 2;
    assert.equal(aimOutsideDeadzone({ x: 0.24, y: 0.24, z: -1 }, fov, aspect, 25), false);
    assert.equal(aimOutsideDeadzone({ x: 0.26, y: 0, z: -1 }, fov, aspect, 25), true);
    assert.equal(aimOutsideDeadzone({ x: 0, y: -0.26, z: -1 }, fov, aspect, 25), true);
    assert.equal(aimOutsideDeadzone({ x: 0.26, y: 0, z: -1 }, fov, 3, 25), true);
});

test('0% has no zone; 100% is a square spanning the shorter screen dimension', () => {
    assert.equal(aimOutsideDeadzone({ x: 0.01, y: 0, z: -1 }, 70, 2, 0), true);
    assert.equal(aimOutsideDeadzone({ x: 0, y: 0, z: -1 }, 70, 2, 0), false);
    assert.equal(aimOutsideDeadzone({ x: 0, y: 0, z: 1 }, 70, 2, 25), true);
    assert.equal(aimOutsideDeadzone({ x: 0.5, y: 0.5, z: -1 }, 90, 2, 100), false);
    assert.equal(aimOutsideDeadzone({ x: 1.1, y: 0, z: -1 }, 90, 2, 100), true);
    assert.equal(aimOutsideDeadzone({ x: 0.12, y: 0.12, z: -1 }, 90, 0.5, 25), false);
    assert.equal(aimOutsideDeadzone({ x: 0, y: 0.13, z: -1 }, 90, 0.5, 25), true);
});
