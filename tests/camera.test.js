import test from 'node:test';
import assert from 'node:assert/strict';
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
