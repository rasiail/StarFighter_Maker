import { BEAM_RANGE } from './beam-energy.js';
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { camera, hudCanvas } from '../rendering/scene.js';
import { enemies } from '../enemies/fleet.js';

export function selectBeamAssistTarget({ enemyList, lockedTarget, origin, forward, project, width, height, radius }) {
    const center = project({ x: origin.x + forward.x * 200,
        y: origin.y + forward.y * 200, z: origin.z + forward.z * 200 });
    if (center.z < -1 || center.z >= 1) return null;
    let best = null, bestDistance = Infinity;
    for (const enemy of enemyList) {
        if (!enemy?.alive || !enemy.mesh?.position) continue;
        const pos = enemy.mesh.position;
        const dx = pos.x - origin.x, dy = pos.y - origin.y, dz = pos.z - origin.z;
        if (dx * dx + dy * dy + dz * dz > BEAM_RANGE * BEAM_RANGE
            || dx * forward.x + dy * forward.y + dz * forward.z <= 0) continue;
        const point = project(pos);
        if (point.z < -1 || point.z >= 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) continue;
        const distance = Math.hypot((point.x - center.x) * width / 2, (point.y - center.y) * height / 2);
        if (distance > radius) continue;
        if (enemy === lockedTarget) return enemy;
        if (distance < bestDistance) { best = enemy; bestDistance = distance; }
    }
    return best;
}

export function getBeamAssistTarget() {
    if (!gameState.isSmartGunEnabled) return null;
    camera.updateWorldMatrix(true, false);
    return selectBeamAssistTarget({
        enemyList: enemies, lockedTarget: enemies[gameState.lockedEnemyIndex],
        origin: playerMesh.position,
        forward: new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion),
        project: point => new THREE.Vector3(point.x, point.y, point.z).project(camera),
        width: hudCanvas.width, height: hudCanvas.height,
        radius: 140 * (playerFlight.smartAssistMultiplier || 1),
    });
}
