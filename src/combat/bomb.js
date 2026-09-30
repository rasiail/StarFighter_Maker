// combat/bomb: Area-of-effect heavy bomb weapon and dithered explosion system.
import { scene } from '../rendering/scene.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { missiles } from './weapons.js';
import { enemies } from '../enemies/fleet.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { audio } from '../audio/audio.js';
import { triggerExplosion } from '../effects/particles.js';

export const BOMB_WEAPON = Object.freeze({
    weaponId: 'bomb_weapon',
    displayNameKo: '범위 폭탄',
    owner: 'player',
    weaponType: 'bomb',
    directDamage: 80,
    splashDamage: 150,
    splashRadiusM: 200,
    fireIntervalSec: 1.0,
    readySlots: 4,
    reloadSec: 20,
    lockRangeM: 2500,
    projectileSpeedMps: 280,
    maxSpeedMps: 800,
    accelerationMps2: 320,
    turnRateRadSec: 2.4,
    lifetimeSec: 7,
    engineKey: 'bomb',
});

let bombTemplate = null;

/**
 * Creates the bomb missile mesh.
 * Scaled ~150% larger than the standard missile with a heavy ordnance appearance.
 */
export function createBombMesh() {
    if (typeof THREE === 'undefined') return { scale: { set() {} }, position: { copy() {} }, quaternion: { copy() {}, setFromUnitVectors() {} } };
    if (bombTemplate) {
        const clone = bombTemplate.clone(true);
        clone.scale.set(1.5, 1.5, 1.5);
        return clone;
    }

    const group = new THREE.Group();

    // Heavy bomb main fuselage (slightly thicker cylinder)
    const bodyGeom = new THREE.CylinderGeometry(0.24, 0.24, 3.2, 12);
    bodyGeom.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x3d434a,
        metalness: 0.55,
        roughness: 0.35,
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Heavy ogive warhead with high-explosive orange tip
    const noseGeom = new THREE.ConeGeometry(0.24, 0.7, 12);
    noseGeom.rotateX(-Math.PI / 2);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.z = -1.95;
    group.add(nose);

    // Cruciform heavy tail fins
    const finGeom = new THREE.BoxGeometry(0.85, 0.03, 0.5);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x22262a, metalness: 0.6, roughness: 0.5 });
    const fin1 = new THREE.Mesh(finGeom, finMat);
    fin1.position.z = 1.1;
    group.add(fin1);

    const fin2 = fin1.clone();
    fin2.rotation.z = Math.PI / 2;
    group.add(fin2);

    bombTemplate = group;
    const result = bombTemplate.clone(true);
    result.scale.set(1.5, 1.5, 1.5);
    return result;
}

export const activeDitherExplosions = [];

const ditherVertexShader = `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
`;

const ditherFragmentShader = `
    uniform vec3 uColor;
    uniform vec3 uCoreColor;
    uniform float uProgress;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    // 4x4 Ordered Bayer Matrix for Screen-Door Dithering
    float getBayer4(vec2 coord) {
        vec2 b = floor(mod(coord, 4.0));
        int idx = int(b.x) + int(b.y) * 4;
        if (idx == 0) return 0.0 / 16.0;
        if (idx == 1) return 8.0 / 16.0;
        if (idx == 2) return 2.0 / 16.0;
        if (idx == 3) return 10.0 / 16.0;
        if (idx == 4) return 12.0 / 16.0;
        if (idx == 5) return 4.0 / 16.0;
        if (idx == 6) return 14.0 / 16.0;
        if (idx == 7) return 6.0 / 16.0;
        if (idx == 8) return 3.0 / 16.0;
        if (idx == 9) return 11.0 / 16.0;
        if (idx == 10) return 1.0 / 16.0;
        if (idx == 11) return 9.0 / 16.0;
        if (idx == 12) return 15.0 / 16.0;
        if (idx == 13) return 7.0 / 16.0;
        if (idx == 14) return 13.0 / 16.0;
        return 5.0 / 16.0;
    }

    void main() {
        // Dithering fade out based on progress
        float bayer = getBayer4(gl_FragCoord.xy);
        float fade = clamp((uProgress - 0.12) / 0.88, 0.0, 1.0);
        if (1.0 - fade <= bayer) {
            discard;
        }

        // Spherical 3D shading: radiant orange with hot fiery core
        float ndl = max(0.0, dot(vNormal, vec3(0.0, 0.707, 0.707)));
        vec3 col = mix(uColor, uCoreColor, ndl * 0.75 + (1.0 - uProgress) * 0.25);

        gl_FragColor = vec4(col, 1.0);
    }
`;

let sphereGeom = null;

/**
 * Creates an orange spherical mesh expanding and fading via 4x4 Bayer dithering.
 */
export function createDitherExplosion(position, maxRadius = 160) {
    if (typeof THREE === 'undefined') return null;
    if (!sphereGeom && typeof THREE.SphereGeometry === 'function') {
        sphereGeom = new THREE.SphereGeometry(1, 24, 16);
    }

    const material = typeof THREE.ShaderMaterial === 'function' ? new THREE.ShaderMaterial({
        vertexShader: ditherVertexShader,
        fragmentShader: ditherFragmentShader,
        uniforms: {
            uColor: { value: new THREE.Color(0xff5500) },       // Deep vibrant orange
            uCoreColor: { value: new THREE.Color(0xffaa20) },   // Bright hot amber core
            uProgress: { value: 0.0 }
        },
        side: THREE.DoubleSide,
        depthWrite: false,
        transparent: false,
    }) : (typeof THREE.MeshBasicMaterial === 'function' ? new THREE.MeshBasicMaterial({ color: 0xff6600 }) : { dispose() {} });

    const mesh = typeof THREE.Mesh === 'function' ? new THREE.Mesh(sphereGeom, material) : { position: { copy() {} }, scale: { set() {} } };
    if (mesh.position?.copy) mesh.position.copy(position);
    if (mesh.scale?.set) mesh.scale.set(5, 5, 5);

    const explosion = {
        mesh,
        material,
        maxRadius,
        age: 0,
        duration: 0.85,
        expandDuration: 0.22,
    };

    if (scene?.add) scene.add(mesh);
    activeDitherExplosions.push(explosion);
    return explosion;
}

export function updateDitherExplosions(delta) {
    for (let i = activeDitherExplosions.length - 1; i >= 0; i--) {
        const exp = activeDitherExplosions[i];
        exp.age += delta;
        const progress = Math.min(1.0, exp.age / exp.duration);

        if (exp.material?.uniforms?.uProgress) {
            exp.material.uniforms.uProgress.value = progress;
        }

        // Fast cubic ease-out expansion
        const expandT = Math.min(1.0, exp.age / exp.expandDuration);
        const scale = exp.maxRadius * (1.0 - Math.pow(1.0 - expandT, 3));
        const currentScale = Math.max(2, scale);
        if (exp.mesh?.scale?.set) {
            exp.mesh.scale.set(currentScale, currentScale, currentScale);
        }

        if (exp.age >= exp.duration) {
            if (scene?.remove) scene.remove(exp.mesh);
            exp.material?.dispose?.();
            activeDitherExplosions.splice(i, 1);
        }
    }
}

export function clearDitherExplosions() {
    for (const exp of activeDitherExplosions) {
        if (scene?.remove) scene.remove(exp.mesh);
        exp.material?.dispose?.();
    }
    activeDitherExplosions.length = 0;
}

/**
 * Detonates the bomb: deals direct hit damage, splash damage in radius,
 * and creates the dithered orange explosion effect.
 */
export function detonateBomb(pos, hitEnemy, directDamage, splashDamage, splashRadius) {
    // 1. Direct hit damage
    if (hitEnemy && hitEnemy.alive) {
        hitEnemy.health -= directDamage;
        if (hitEnemy.health <= 0) {
            killEnemy(hitEnemy);
        }
    }

    // 2. Area splash damage to surrounding enemies
    if (Array.isArray(enemies)) {
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy.alive || enemy === hitEnemy) continue;
            const dist = enemy.mesh.position.distanceTo(pos);
            const effectiveRadius = (enemy.hitRadius || (enemy.isGround ? 20 : 15)) + splashRadius;
            if (dist <= effectiveRadius) {
                const falloff = Math.max(0.5, 1.0 - (dist / Math.max(1, effectiveRadius)) * 0.5);
                enemy.health -= splashDamage * falloff;
                if (enemy.health <= 0) {
                    killEnemy(enemy);
                }
            }
        }
    }

    // 3. Dithered orange spherical explosion
    createDitherExplosion(pos, splashRadius);

    // 4. Secondary particle explosion & sound
    if (typeof triggerExplosion === 'function') {
        try {
            triggerExplosion(pos, 50, 3.2);
        } catch (_) {}
    }
    audio?.playExplosion?.();
}

/**
 * Fires a 150% scaled heavy bomb missile towards a locked target or straight forward.
 */
export function fireBomb(target, isPlayer = true, sourceMesh = playerMesh) {
    const validTarget = (isPlayer ? (target && target.isLocked && target.alive ? target : null) : target);
    const bombMesh = createBombMesh();

    const spawnOffset = new THREE.Vector3(0, -0.9, -1.2);
    if (sourceMesh?.matrixWorld) {
        spawnOffset.applyMatrix4(sourceMesh.matrixWorld);
    }
    if (bombMesh.position?.copy) {
        bombMesh.position.copy(spawnOffset);
    }
    if (bombMesh.quaternion?.copy && sourceMesh?.quaternion) {
        bombMesh.quaternion.copy(sourceMesh.quaternion);
    }

    const forward = new THREE.Vector3(0, 0, -1);
    if (sourceMesh?.quaternion) {
        forward.applyQuaternion(sourceMesh.quaternion);
    }

    const dmgMult = playerFlight?.damageMultiplier || 1;
    const bombDmgMult = playerFlight?.bombDamageMultiplier || 1;
    const radiusMult = playerFlight?.bombRadiusMultiplier || 1;
    const directDmg = BOMB_WEAPON.directDamage * dmgMult * bombDmgMult;
    const splashDmg = BOMB_WEAPON.splashDamage * dmgMult * bombDmgMult;
    const splashRad = BOMB_WEAPON.splashRadiusM * radiusMult;

    const missileData = {
        mesh: bombMesh,
        homingDelay: 0.15,
        target: validTarget,
        velocity: forward.clone().multiplyScalar(Math.min(280, BOMB_WEAPON.projectileSpeedMps)),
        speed: BOMB_WEAPON.projectileSpeedMps,
        maxSpeed: BOMB_WEAPON.maxSpeedMps,
        acceleration: BOMB_WEAPON.accelerationMps2,
        turnRate: BOMB_WEAPON.turnRateRadSec * (isPlayer ? (playerFlight?.missileTurnMultiplier || 1) : 1),
        life: BOMB_WEAPON.lifetimeSec,
        damage: directDmg,
        splashDamage: splashDmg,
        splashRadius: splashRad,
        isPlayer: isPlayer,
        isBomb: true,
    };

    if (scene?.add) scene.add(bombMesh);
    if (Array.isArray(missiles)) missiles.push(missileData);

    if (isPlayer) audio?.playMissileLaunch?.();
    return missileData;
}
