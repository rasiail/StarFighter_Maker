// effects/particles: imports are side-effect free; main.js controls initialization.
import { audio } from '../audio/audio.js';
import { scene } from '../rendering/scene.js';

export let particles;
export function removeParticle(particle) {
    scene.remove(particle.mesh);
    particle.mesh.geometry.dispose();
    particle.mesh.material.dispose();
}
export function clearParticles() {
    particles.forEach(removeParticle);
    particles.length = 0;
}
let particleGeom;
let pCount;
let pPositions;
let pColors;

export function triggerExplosion(pos, count = 40, size = 1.0) {
    audio.playExplosion();
    // 파티클 상한선 체크: 너무 많은 폭발이 동시에 발생하면 성능 보호를 위해 일부 제한
    const available = Math.max(0, 500 - particles.length);
    const spawnCount = Math.min(count, available);
    for (let i = 0; i < spawnCount; i++) {
        const pMesh = new THREE.Mesh(
            new THREE.SphereGeometry(size * (0.8 + Math.random() * 1.8), 6, 6),
            new THREE.MeshBasicMaterial({
                color: Math.random() > 0.3 ? 0xff6600 : 0xffdd22,
                transparent: true,
                opacity: 1.0
            })
        );
        pMesh.position.copy(pos);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 180,
            (Math.random() - 0.5) * 180,
            (Math.random() - 0.5) * 180
        );
        particles.push({
            mesh: pMesh,
            velocity: vel,
            life: 0.8 + Math.random() * 0.7,
            maxLife: 1.5,
            isFire: true
        });
        scene.add(pMesh);
    }
}
export function createSmokePuff(pos) {
    if (particles.length > 280) return; // Particle ceiling limit
    const pMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + Math.random() * 0.8, 5, 5),
        new THREE.MeshBasicMaterial({
            color: 0x5f666e, // 짙은 어두운 색에서 약간 더 밝아진 자연스러운 미사일 연기 그레이
            transparent: true,
            opacity: 0.62
        })
    );
    pMesh.position.copy(pos);
    particles.push({
        mesh: pMesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5),
        life: 0.65,
        maxLife: 0.65,
        isFire: false
    });
    scene.add(pMesh);
}

export function initParticles() {
    particles = [];

    particleGeom = new THREE.BufferGeometry();

    pCount = 800;

    pPositions = new Float32Array(pCount * 3);

    pColors = new Float32Array(pCount * 3);

    particleGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));

    particleGeom.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
}
