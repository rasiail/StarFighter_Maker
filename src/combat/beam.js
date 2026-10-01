import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { scene } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { spawnBeamBolt } from './beam-bolt.js';
import { spendBeamPulse, advanceBeamEnergy, BEAM_CAPACITY, BEAM_PULSE_DAMAGE, BEAM_HOLD_DELAY, BEAM_RANGE, beamHoldDamage, BEAM_HOLD_RAMP_PER_SECOND, BEAM_HOLD_MAX_MULTIPLIER } from './beam-energy.js';
import { audio } from '../audio/audio.js';
import { getBeamAssistTarget } from './beam-assist.js';
let mesh;
let heldTime = 0;
const contact = { target: null, seconds: 0 };
const energy = { energy: BEAM_CAPACITY, cooldown: 0 };
export function clearBeam() {
    beamHoldDamage(contact, null, 0);
    audio?.stopBeamHold();
    if (mesh) mesh.visible = false;
    heldTime = 0;
    energy.primed = false;
}
function loadEnergy() {
    energy.energy = playerFlight.beamEnergy ?? BEAM_CAPACITY;
    energy.cooldown = playerFlight.beamCooldown ?? 0;
    energy.overload = playerFlight.beamOverload ?? 0;
    energy.reload = playerFlight.beamReloadRemaining ?? 0;
}
function saveEnergy() {
    playerFlight.beamEnergy = energy.energy;
    playerFlight.beamCooldown = energy.cooldown;
    playerFlight.beamOverload = energy.overload;
    playerFlight.beamReloadRemaining = energy.reload;
}
function beamAimDirection(origin) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
    const target = gameState.isSmartGunEnabled ? getBeamAssistTarget() : enemies[gameState.lockedEnemyIndex];
    if ((gameState.isSmartGunEnabled || gameState.isGunAimOnTarget) && target?.alive
        && target.mesh.position.clone().sub(origin).lengthSq() <= BEAM_RANGE * BEAM_RANGE) {
        const toTarget = target.mesh.position.clone().sub(origin).normalize();
        direction.lerp(toTarget, gameState.isSmartGunEnabled ? 1.0 : 0.42).normalize();
    }
    return direction;
}
function castBeam(duration) {
    if (!mesh) {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
        geometry.rotateX(Math.PI / 2);
        mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x74efff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        scene.add(mesh);
    }
    // Rebuild the attached beam from the aircraft origin each frame; it never travels.
    const origin = playerMesh.position.clone();
    const direction = beamAimDirection(origin);
    const width = playerFlight.beamWidth ?? 0.9;
    let length = BEAM_RANGE, target = null;
    for (const enemy of enemies) {
        if (!enemy.alive) continue;
        const relative = enemy.mesh.position.clone().sub(origin);
        const along = relative.dot(direction);
        const radius = (enemy.hitRadius || (enemy.isGround ? 20 : 15)) + width / 2;
        const perpendicularSq = relative.lengthSq() - along * along;
        if (perpendicularSq > radius * radius) continue;
        const entry = Math.max(0, along - Math.sqrt(radius * radius - perpendicularSq));
        if (along + radius < 0 || entry > length) continue;
        length = entry;
        target = enemy;
    }
    mesh.position.copy(origin).addScaledVector(direction, length / 2);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), direction);
    mesh.scale.set(width, width, Math.max(0.01, length));
    mesh.visible = true;
    const damage = beamHoldDamage(contact, target, duration);
    if (target) {
        target.health -= damage * playerFlight.damageMultiplier;
        if (target.health <= 0) killEnemy(target);
    }
}
export function pulseBeam() {
    beamHoldDamage(contact, null, 0);
    audio?.stopBeamHold();
    loadEnergy();
    energy.primed = false;
    const fired = spendBeamPulse(energy, playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5, playerFlight.beamRechargePerSecond ?? 0);
    saveEnergy();
    if (!fired) return;
    audio?.playBeamPulse();
    heldTime = 0;
    saveEnergy();
    spawnBeamBolt(playerMesh, BEAM_PULSE_DAMAGE * playerFlight.damageMultiplier,
        playerFlight.beamBoltWidth ?? 3, beamAimDirection(playerMesh.position));
}
export function updateBeam(delta, held) {
    loadEnergy();
    held = held && gameState.missileMode === 3 && gameState.ownedWeapons?.includes(3);
    if (!held) energy.primed = false;
    const warmup = held ? Math.min(delta, Math.max(0, BEAM_HOLD_DELAY - heldTime)) : delta;
    heldTime = held ? heldTime + delta : 0;
    advanceBeamEnergy(energy, warmup, false,
        playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5, playerFlight.beamRechargePerSecond ?? 0);
    const duration = advanceBeamEnergy(energy, delta - warmup, held,
        playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5, playerFlight.beamRechargePerSecond ?? 0);
    saveEnergy();
    if (gameState.missileMode === 3) {
        const hud = document.getElementById('missile-stat');
        if (hud) {
            hud.textContent = energy.overload > 0 ? `BEAM OVERLOAD · ${energy.overload.toFixed(1)}s`
                : energy.reload > 0 ? `BEAM RELOAD · ${energy.reload.toFixed(1)}s`
                : `BEAM · ${Math.round(energy.energy)} / ${BEAM_CAPACITY}`;
            hud.style.color = energy.overload > 0 ? '#ff6b6b' : energy.reload > 0 ? '#ffcc00' : '#78eaff';
        }
    }
    if (duration > 0) castBeam(duration);
    if (duration > 0 && energy.primed) {
        const multiplier = Math.min(BEAM_HOLD_MAX_MULTIPLIER, 1 + contact.seconds * BEAM_HOLD_RAMP_PER_SECOND);
        audio?.setBeamHold(multiplier);
    } else {
        beamHoldDamage(contact, null, 0);
        audio?.stopBeamHold();
    }
    // Do not leave a world-space afterimage behind a moving aircraft.
    if (mesh && (duration <= 0 || !energy.primed)) mesh.visible = false;
}
