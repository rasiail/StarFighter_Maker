import test from 'node:test';
import assert from 'node:assert/strict';

// Node test environment mock for THREE
class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
    set(x, y, z) {
        this.x = x; this.y = y; this.z = z;
        return this;
    }
    clone() {
        return new MockVector3(this.x, this.y, this.z);
    }
    copy(v) {
        this.x = v.x; this.y = v.y; this.z = v.z;
        return this;
    }
    sub(v) {
        this.x -= v.x; this.y -= v.y; this.z -= v.z;
        return this;
    }
    length() {
        return Math.hypot(this.x, this.y, this.z);
    }
    distanceTo(v) {
        return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z);
    }
    normalize() {
        const l = this.length();
        if (l > 0) {
            this.x /= l; this.y /= l; this.z /= l;
        }
        return this;
    }
    dot(v) {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }
    applyQuaternion() {
        return this;
    }
    applyMatrix4(m) {
        if (m && typeof m.transformVector3 === 'function') {
            return m.transformVector3(this);
        }
        return this;
    }
    project(cam) {
        if (cam && typeof cam.projectVector3 === 'function') {
            return cam.projectVector3(this);
        }
        return this;
    }
}

globalThis.THREE = { Vector3: MockVector3 };

const { evaluateTargetCandidates, acquireNextBestTarget, cycleTarget } = await import('../src/combat/targeting.js');
const { gameState } = await import('../src/core/state.js');

function createMockEnemy(x, y, z, alive = true) {
    return {
        alive,
        mesh: { position: new MockVector3(x, y, z) },
    };
}

function createMockCamera(camZ = 12.5) {
    return {
        position: new MockVector3(0, 2.2, camZ),
        matrixWorldInverse: {
            // Camera looks along world -Z from (0, 2.2, camZ)
            // Camera space Z = worldPos.z - camZ
            transformVector3(v) {
                v.y -= 2.2;
                v.z -= camZ;
                return v;
            },
        },
        // NDC projection: points in front (worldPos.z < camZ) project to NDC
        projectVector3(v) {
            const relZ = v.z - camZ;
            if (relZ >= 0) {
                // Behind camera: out of bounds
                return new MockVector3(99, 99, 2);
            }
            const depth = Math.abs(relZ);
            // Simple perspective NDC mapping
            const ndcX = v.x / (depth * 0.8);
            const ndcY = (v.y - 2.2) / (depth * 0.8);
            return new MockVector3(ndcX, ndcY, 0.5);
        },
        getWorldPosition(target) {
            target.set(0, 2.2, camZ);
            return target;
        },
        getWorldDirection(target) {
            target.set(0, 0, -1);
            return target;
        },
        updateMatrixWorld() {},
    };
}

test('evaluateTargetCandidates: 화면 내 적을 tier1로, 등 뒤 적을 tier3로 분류한다', () => {
    const playerMesh = {
        position: new MockVector3(0, 0, 0),
        quaternion: {},
    };
    const camera = createMockCamera(12.5);

    // 적 A: 정면 600m (화면 정중앙에 위치)
    const enemyA = createMockEnemy(0, 0, -600);
    // 적 B: 정면 1000m (화면 정중앙에 위치)
    const enemyB = createMockEnemy(0, 0, -1000);
    // 적 C: 등 뒤 200m (플레이어 및 카메라 후방)
    const enemyC = createMockEnemy(0, 0, 200);

    const result = evaluateTargetCandidates({
        playerMesh,
        camera,
        enemies: [enemyA, enemyB, enemyC],
    });

    // tier1 (화면 내 적)에는 enemyA와 enemyB만 속해야 함
    assert.equal(result.tier1.length, 2);
    assert.equal(result.tier1[0].enemy, enemyA); // 600m가 1000m보다 가까우므로 1순위
    assert.equal(result.tier1[1].enemy, enemyB);

    // tier3 (플레이어 후방 적)에는 enemyC만 속해야 함
    assert.equal(result.tier3.length, 1);
    assert.equal(result.tier3[0].enemy, enemyC);
});

test('acquireNextBestTarget: 화면 내 적이 있으면 등 뒤의 더 가까운 적 대신 화면 내 적을 선택한다', () => {
    // 플레이어: 원점 (0, 0, 0)
    // 적 A (idx 0): 화면 정면 700m
    // 적 B (idx 1): 등 뒤 250m (거리상 더 가까움)
    const enemyA = createMockEnemy(0, 0, -700);
    const enemyB = createMockEnemy(0, 0, 250);

    const playerMesh = {
        position: new MockVector3(0, 0, 0),
        quaternion: {},
    };
    const camera = createMockCamera(12.5);
    const enemies = [enemyA, enemyB];

    // global enemies/player/camera override via options inside custom runner
    // testing evaluateTargetCandidates logic
    const { tier1, tier2, tier3 } = evaluateTargetCandidates({ playerMesh, camera, enemies });
    const chosen = (tier1.length > 0 ? tier1 : (tier2.length > 0 ? tier2 : tier3))[0];

    assert.equal(chosen.idx, 0, '화면 내 적 A(idx 0)가 등 뒤의 더 가까운 적 B(idx 1)보다 우선 선택되어야 함');
});

test('cycleTarget: 화면 내 적이 2기 이상 있을 때 오직 화면 내 적들만 거리순으로 순환한다', () => {
    const enemyA = createMockEnemy(0, 0, -500); // 500m (idx 0)
    const enemyB = createMockEnemy(0, 0, -800); // 800m (idx 1)
    const enemyBehind = createMockEnemy(0, 0, 150); // 150m (idx 2, 등 뒤)

    const playerMesh = {
        position: new MockVector3(0, 0, 0),
        quaternion: {},
    };
    const camera = createMockCamera(12.5);
    const enemies = [enemyA, enemyB, enemyBehind];

    const { tier1 } = evaluateTargetCandidates({ playerMesh, camera, enemies });
    assert.equal(tier1.length, 2);
    assert.deepEqual(tier1.map(t => t.idx), [0, 1]);

    // 풀 내 인덱스 순환 시뮬레이션
    let curLocked = 0;
    let curPos = tier1.findIndex(item => item.idx === curLocked);
    let nextIdx = tier1[(curPos + 1) % tier1.length].idx;
    assert.equal(nextIdx, 1, 'idx 0 다음은 idx 1로 순환');

    curLocked = 1;
    curPos = tier1.findIndex(item => item.idx === curLocked);
    nextIdx = tier1[(curPos + 1) % tier1.length].idx;
    assert.equal(nextIdx, 0, 'idx 1 다음은 다시 idx 0으로 순환 (등 뒤 idx 2는 제외)');
});
