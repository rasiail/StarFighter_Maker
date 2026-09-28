import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    copy(v) { Object.assign(this, { x: v.x, y: v.y, z: v.z }); return this; }
    clone() { return new Vector().copy(this); }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    applyQuaternion() { return this; }
}

test('boss cinematic follows translation on every frame before normal player camera writes', () => {
    const boss = { position: new Vector(1000, 600, -2000), quaternion: {} };
    const scene = { attach(camera) { camera.parent = this; } };
    const camera = { position: new Vector(), fov: 65, updateProjectionMatrix() {},
        lookAt(position) { this.aim = position.clone(); } };
    const context = vm.createContext({ THREE: { Vector3: Vector }, camera, scene,
        gameState: {}, activeDyingBosses: [{ mesh: boss }], keys: {}, padInput: {},
        createHitShake: () => ({ strength: 0 }), stepHitShake: () => null });
    vm.runInContext(readFileSync(new URL('../src/camera/camera.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + '\ncameraConfig = {};', context);
    context.updateCamera(1 / 60);
    const first = camera.position.clone();
    boss.position.add(new Vector(20, -8, -40));
    context.updateCamera(1 / 60);
    assert.deepEqual(camera.position, first.add(new Vector(20, -8, -40)));
    assert.deepEqual(camera.aim, boss.position);
    assert.equal(camera.parent, scene);
});

test('boss disappears at the finale and sequence still completes', () => {
    const mesh = { visible: true, position: new Vector(), rotation: {}, translateZ() {}, rotateZ() {}, rotateX() {} };
    const boss = { mesh, timer: 0.81, totalTime: 5, smokeTimer: 100, nextBurst: 100 };
    let completed = false, removed = false;
    const context = vm.createContext({ THREE: { Vector3: Vector }, activeDyingBosses: [boss],
        gameState: {}, triggerExplosion() {}, scheduleCombat() {}, audio: { playExplosion() {} },
        scene: { remove() { removed = true; } }, EVENTS: { BOSS_SEQUENCE_COMPLETE: 'complete' },
        gameEvents: { emit() { completed = true; } } });
    const source = readFileSync(new URL('../src/enemies/lifecycle.js', import.meta.url), 'utf8');
    vm.runInContext(source.slice(source.indexOf('export function updateDyingBosses'), source.indexOf('export function killEnemy')).replace('export ', ''), context);
    context.updateDyingBosses(0.02);
    assert.equal(mesh.visible, false);
    assert.equal(completed, false);
    context.updateDyingBosses(0.8);
    assert.equal(removed, true);
    assert.equal(completed, true);
});
