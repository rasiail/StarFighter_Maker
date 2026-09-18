// effects/exhaust: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';


export class JetExhaustSystem {
    clear() {
        for (const particle of this.particles) {
            particle.mesh.parent?.remove(particle.mesh);
            particle.mesh.visible = false;
            particle.active = false;
            particle.life = 0;
        }
    }
    constructor() {
        this.particles = [];
        this.maxParticles = 120;

        // 로우폴리곤 덩어리 지오메트리 (상주하는 코어 구형 0.38과 동일한 기준 규격)
        this.geom = new THREE.IcosahedronGeometry(0.38, 0);

        // 파티클 풀 미리 생성 (풀링 방식)
        for (let i = 0; i < this.maxParticles; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0.92,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(this.geom, mat);
            mesh.visible = false;

            this.particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(),   // 로컬 스페이스 속도 (+Z = 기체 후방)
                rotAxis: new THREE.Vector3(Math.random()-0.5, Math.random()-0.5, Math.random()-0.5).normalize(),
                rotSpeed: 8 + Math.random() * 12,
                life: 0,
                maxLife: 0.15,
                startScale: 0.80, // 상주 구형의 80% 기준 크기
                isAfterburner: false,
                isEnemy: false,
                active: false
            });
        }
    }

    // parentMesh: 전투기 3D 그룹 (playerMesh 또는 enemy.mesh)
    // localPos: 노즐의 로컬 좌표 Vector3
    spawn(parentMesh, localPos, isAfterburner, throttleRatio = 1.0, isEnemy = false) {
        if (throttleRatio < 0.05 || !parentMesh) return;

        const p = this.particles.find(item => !item.active);
        if (!p) return;

        // 기체 자식으로 안전하게 연결 (로컬 좌표계 종속)
        if (p.mesh.parent !== parentMesh) {
            parentMesh.add(p.mesh);
        }

        p.active = true;
        p.mesh.visible = true;
        p.isAfterburner = isAfterburner;
        p.isEnemy = isEnemy;
        p.life = 0;

        // 적절한 라이프타임 (0.16 ~ 0.24초): 뒤로 뻗어나가는 시원한 제트 화염
        p.maxLife = isAfterburner ? 0.22 + Math.random() * 0.04 : 0.16 + Math.random() * 0.03;

        // 상주하는 노즐 구형(반경 0.38)의 정확히 80% 크기로 시작
        p.startScale = 0.80 * (isAfterburner ? 1.25 : 1.0) * (0.95 + Math.random() * 0.1);

        // 노즐 로컬 위치에서 생성 (+ 미세 랜덤 지터)
        p.mesh.position.copy(localPos).add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.04,
            (Math.random() - 0.5) * 0.04,
            (Math.random() - 0.5) * 0.04
        ));

        // ─── 로컬 좌표계 원뿔(Cone) 사출 속도 ──────────────────────────
        // F-104 기준 로컬 +Z가 기체 후방 방향입니다.
        const ejectSpeed = isAfterburner ? (26.0 + Math.random() * 4.0) : (16.0 + Math.random() * 3.0);
        const spread = (isAfterburner ? 0.9 : 0.55) * (0.6 + throttleRatio * 0.4);

        p.velocity.set(
            (Math.random() - 0.5) * spread,
            (Math.random() - 0.5) * spread,
            ejectSpeed
        );

        p.mesh.scale.setScalar(p.startScale);
        p.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    }

    update(delta) {
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.life += delta;
            const progress = p.life / p.maxLife;

            if (progress >= 1.0) {
                p.active = false;
                p.mesh.visible = false;
                continue;
            }

            // 로컬 위치 이동 (+Z 후방으로 시원하게 분출)
            p.mesh.position.addScaledVector(p.velocity, delta);
            // 로우폴리면 자전
            p.mesh.rotateOnAxis(p.rotAxis, p.rotSpeed * delta);

            // 스케일: 라이프타임에 따라 100%에서 0%로 자연스럽게 가늘어지며 소멸
            const s = p.startScale * Math.max(0.0, 1.0 - progress);
            p.mesh.scale.setScalar(Math.max(0.01, s));

            // 색상 및 투명도 진화
            if (p.isEnemy) {
                p.mesh.material.color.setHex(progress < 0.35 ? 0xff7700 : 0xdd3300);
                p.mesh.material.opacity = (1.0 - progress) * 0.9;
            } else if (p.isAfterburner) {
                // 애프터버너: 초백색 → 시안 → 소멸
                if (progress < 0.2) {
                    p.mesh.material.color.setHex(0xffffff);
                } else if (progress < 0.55) {
                    p.mesh.material.color.setHex(0x44ddff);
                } else {
                    p.mesh.material.color.setHex(0x5522ff);
                }
                p.mesh.material.opacity = (1.0 - progress) * 0.98;
            } else {
                // 일반: 밝은 노랑 → 주황 → 소멸
                if (progress < 0.25) {
                    p.mesh.material.color.setHex(0xffee44);
                } else if (progress < 0.65) {
                    p.mesh.material.color.setHex(0xff6600);
                } else {
                    p.mesh.material.color.setHex(0xcc3300);
                }
                p.mesh.material.opacity = (1.0 - progress) * 0.88;
            }
        }
    }
}
export function createEngineEffects(targetZ = 4.5, nozzleY = -0.38) {
    const effectGroup = new THREE.Group();
    effectGroup.position.set(0, nozzleY, targetZ);

    // 노즐 내부 로우폴리 코어 발광체 (원통 대신 12면체 컴팩트 코어)
    const coreGeom = new THREE.DodecahedronGeometry(0.38, 0);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffaa22,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
    });
    const baseGlow = new THREE.Mesh(coreGeom, coreMat);
    effectGroup.add(baseGlow);

    return { group: effectGroup, baseGlow, flame: null };
}

export function initExhaust() {
    gameState.jetExhaustSystem = null;
}
