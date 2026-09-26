import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { scene } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { spawnBeamBolt } from './beam-bolt.js';
import { spendBeamPulse, advanceBeamEnergy, BEAM_PULSE_DAMAGE, BEAM_HOLD_DPS, BEAM_HOLD_DELAY } from './beam-energy.js';
let mesh;
let visibleTime = 0;
let heldTime = 0;
const energy = { energy: 100, cooldown: 0 };
export function clearBeam() {
    if (mesh) mesh.visible = false;
    visibleTime = 0;
    heldTime = 0;
    energy.primed = false;
}
function loadEnergy() {
    energy.energy = playerFlight.beamEnergy ?? 100;
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
function castBeam(damage) {
    if (!mesh) {
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
        geometry.rotateX(Math.PI / 2);
        mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x74efff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        scene.add(mesh);
    }
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
    const origin = playerMesh.position.clone().addScaledVector(direction, 5);
    const width = playerFlight.beamWidth ?? 0.9;
    let length = 1800, target = null;
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
    mesh.quaternion.copy(playerMesh.quaternion);
    mesh.scale.set(width, width, Math.max(0.01, length));
    mesh.visible = true;
    visibleTime = 0.1;
    if (target) {
        target.health -= damage * playerFlight.damageMultiplier;
        if (target.health <= 0) killEnemy(target);
    }
}
export function pulseBeam() {
    loadEnergy();
    energy.primed = false;
    const fired = spendBeamPulse(energy, playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5);
    saveEnergy();
    if (!fired) return;
    heldTime = 0;
    saveEnergy();
    spawnBeamBolt(playerMesh, BEAM_PULSE_DAMAGE * playerFlight.damageMultiplier, playerFlight.beamBoltWidth ?? 3);
}
export function updateBeam(delta, held) {
    loadEnergy();
    held = held && gameState.missileMode === 3 && gameState.ownedWeapons?.includes(3);
    if (!held) energy.primed = false;
    const warmup = held ? Math.min(delta, Math.max(0, BEAM_HOLD_DELAY - heldTime)) : delta;
    heldTime = held ? heldTime + delta : 0;
    advanceBeamEnergy(energy, warmup, false,
        playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5);
    const duration = advanceBeamEnergy(energy, delta - warmup, held,
        playerFlight.beamEfficiency ?? 1, playerFlight.beamReloadSeconds ?? 5);
    saveEnergy();
    if (gameState.missileMode === 3) {
        const hud = document.getElementById('missile-stat');
        if (hud) {
            hud.textContent = energy.overload > 0 ? `BEAM OVERLOAD · ${energy.overload.toFixed(1)}s`
                : energy.reload > 0 ? `BEAM RELOAD · ${energy.reload.toFixed(1)}s`
                : `BEAM · ${Math.round(energy.energy)} / 100`;
            hud.style.color = energy.overload > 0 ? '#ff6b6b' : energy.reload > 0 ? '#ffcc00' : '#78eaff';
        }
    }
    visibleTime -= delta;
    if (duration > 0) castBeam(BEAM_HOLD_DPS * duration);
    else if (mesh && visibleTime <= 0) mesh.visible = false;
}
