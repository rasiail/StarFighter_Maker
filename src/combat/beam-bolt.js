import { scene } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { triggerExplosion } from '../effects/particles.js';

export const BEAM_BOLT = Object.freeze({ length: 18, diameter: 0.6, speed: 1800, range: 1800 });
export const beamBolts = [];
let geometry, coreMaterial, glowMaterial;

// Distance to the first sphere intersection along a swept bolt; avoids tunneling.
export function beamBoltIntersection(origin, direction, center, radius, distance) {
    const x = center.x - origin.x, y = center.y - origin.y, z = center.z - origin.z;
    const along = x * direction.x + y * direction.y + z * direction.z;
    const perpendicularSq = Math.max(0, x * x + y * y + z * z - along * along);
    if (perpendicularSq > radius * radius) return null;
    const halfChord = Math.sqrt(radius * radius - perpendicularSq);
    if (along + halfChord < 0) return null;
    const entry = Math.max(0, along - halfChord);
    return entry <= distance ? entry : null;
}

export function spawnBeamBolt(source, damage, width = 3) {
    if (!geometry) {
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
        geometry.rotateX(Math.PI / 2);
        coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffeffa, toneMapped: false });
        glowMaterial = new THREE.MeshBasicMaterial({ color: 0xff61b6, transparent: true,
            opacity: 0.38, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    }
    const diameter = BEAM_BOLT.diameter * width / 3;
    const mesh = new THREE.Group();
    const core = new THREE.Mesh(geometry, coreMaterial);
    core.scale.set(diameter, diameter, BEAM_BOLT.length);
    const glow = new THREE.Mesh(geometry, glowMaterial);
    glow.scale.set(diameter * 1.65, diameter * 1.65, BEAM_BOLT.length * 1.03);
    mesh.add(core, glow);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(source.quaternion);
    const tail = source.position.clone().addScaledVector(direction, 5);
    mesh.position.copy(tail).addScaledVector(direction, BEAM_BOLT.length / 2);
    mesh.quaternion.copy(source.quaternion);
    scene.add(mesh);
    beamBolts.push({ mesh, tail, direction, damage, radius: diameter / 2, traveled: 0 });
}

export function updateBeamBolts(delta) {
    for (let i = beamBolts.length - 1; i >= 0; i--) {
        const bolt = beamBolts[i];
        const distance = Math.min(BEAM_BOLT.speed * delta, BEAM_BOLT.range - BEAM_BOLT.length - bolt.traveled);
        let target = null, nearest = Infinity;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            const radius = (enemy.hitRadius || (enemy.isGround ? 20 : 15)) + bolt.radius;
            const entry = beamBoltIntersection(bolt.tail, bolt.direction, enemy.mesh.position, radius, distance + BEAM_BOLT.length);
            if (entry !== null && entry < nearest) { target = enemy; nearest = entry; }
        }
        if (target) {
            const impact = bolt.tail.clone().addScaledVector(bolt.direction, nearest);
            target.health -= bolt.damage;
            triggerExplosion(impact, 4, 0.2);
            if (target.health <= 0) killEnemy(target);
        }
        bolt.traveled += distance;
        if (target || bolt.traveled >= BEAM_BOLT.range - BEAM_BOLT.length) {
            scene.remove(bolt.mesh);
            beamBolts.splice(i, 1);
        } else {
            bolt.tail.addScaledVector(bolt.direction, distance);
            bolt.mesh.position.copy(bolt.tail).addScaledVector(bolt.direction, BEAM_BOLT.length / 2);
        }
    }
}

export function clearBeamBolts() {
    for (const bolt of beamBolts) scene.remove(bolt.mesh);
    beamBolts.length = 0;
}
