import test from 'node:test';
import assert from 'node:assert/strict';

// Node test environment mock for THREE
class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x; this.y = y; this.z = z;
    }
    set(x, y, z) {
        this.x = x; this.y = y; this.z = z;
        return this;
    }
    clone() { return new MockVector3(this.x, this.y, this.z); }
    sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    length() { return Math.hypot(this.x, this.y, this.z); }
    normalize() {
        const l = this.length();
        if (l > 0) { this.x /= l; this.y /= l; this.z /= l; }
        return this;
    }
    dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
}

const MockMathUtils = {
    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },
    lerp(a, b, t) { return a + (b - a) * t; },
};

globalThis.THREE = {
    Vector3: MockVector3,
    MathUtils: MockMathUtils,
};

// Pure calculation logic test for speed-based camera distance
function calculateEffectiveCameraDistance(speed, minSpeed, maxSpeed, pivotRotationY = 0, pivotRotationX = 0) {
    const speedRatio = MockMathUtils.clamp((speed - minSpeed) / (maxSpeed - minSpeed), 0.0, 1.0);
    const speedT = MockMathUtils.clamp((speedRatio - 0.5) / 0.3, 0.0, 1.0);
    const speedDistanceFactor = MockMathUtils.lerp(0.5, 1.0, speedT);

    const cosYaw = Math.cos(pivotRotationY);
    const cosPitch = Math.cos(pivotRotationX);
    const rearAlignment = Math.max(0.0, cosYaw * cosPitch);

    const effectiveFactor = MockMathUtils.lerp(1.0, speedDistanceFactor, rearAlignment);
    const targetZ = 12.5 * effectiveFactor;
    const targetY = MockMathUtils.lerp(1.4, 2.2, (effectiveFactor - 0.5) / 0.5);

    return { speedRatio, speedDistanceFactor, rearAlignment, effectiveFactor, targetY, targetZ };
}

test('일반 속도(50% 이하)이고 카메라가 후방에 위치할 때 거리가 기존(12.5m)의 절반인 6.25m가 된다', () => {
    const minSpeed = 150;
    const maxSpeed = 950;
    const cruiseSpeed = 550; // speedRatio = (550 - 150) / 800 = 0.5 (일반 속도)

    const result = calculateEffectiveCameraDistance(cruiseSpeed, minSpeed, maxSpeed, 0, 0);

    assert.equal(result.speedRatio, 0.5);
    assert.equal(result.speedDistanceFactor, 0.5);
    assert.equal(result.rearAlignment, 1.0);
    assert.equal(result.effectiveFactor, 0.5);
    assert.equal(result.targetZ, 6.25, '일반 속도에서 Z거리는 정확히 12.5m의 절반인 6.25m여야 함');
    assert.equal(result.targetY, 1.4);
});

test('속도가 80% 이상일 때 거리가 지금 상태인 12.5m가 된다', () => {
    const minSpeed = 150;
    const maxSpeed = 950;
    // 80% 속도: 150 + 800 * 0.8 = 790 kts
    const speed80 = 790;

    const result80 = calculateEffectiveCameraDistance(speed80, minSpeed, maxSpeed, 0, 0);
    assert.equal(result80.speedRatio, 0.8);
    assert.equal(result80.effectiveFactor, 1.0);
    assert.equal(result80.targetZ, 12.5, '80% 속도에서 Z거리는 12.5m여야 함');
    assert.equal(result80.targetY, 2.2);

    // 100% 최대 속도(950 kts)에서도 12.5m 유지
    const result100 = calculateEffectiveCameraDistance(950, minSpeed, maxSpeed, 0, 0);
    assert.equal(result100.effectiveFactor, 1.0);
    assert.equal(result100.targetZ, 12.5);
});

test('카메라가 전투기 뒤에 위치하지 않을 때(측면/전방 회전 시) 거리 축소가 적용되지 않고 12.5m를 유지한다', () => {
    const minSpeed = 150;
    const maxSpeed = 950;
    const cruiseSpeed = 550; // 일반 속도

    // 1. 측면(90도 = PI/2) 회전 시
    const resultSide = calculateEffectiveCameraDistance(cruiseSpeed, minSpeed, maxSpeed, Math.PI / 2, 0);
    assert.ok(Math.abs(resultSide.rearAlignment) < 1e-6);
    assert.equal(resultSide.effectiveFactor, 1.0);
    assert.equal(resultSide.targetZ, 12.5, '측면 회전 시 거리는 기본 12.5m여야 함');

    // 2. 정면(180도 = PI) 회전 시
    const resultFront = calculateEffectiveCameraDistance(cruiseSpeed, minSpeed, maxSpeed, Math.PI, 0);
    assert.equal(resultFront.rearAlignment, 0.0);
    assert.equal(resultFront.effectiveFactor, 1.0);
    assert.equal(resultFront.targetZ, 12.5, '전방 회전 시 거리는 기본 12.5m여야 함');
});
