import { updateTargeting } from './targeting.js';
// combat/weapons: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { scene } from '../rendering/scene.js';
import { audio } from '../audio/audio.js';
import { enemies } from '../enemies/fleet.js';

export let bullets;
export let missiles;
let bulletGeom;
let bulletMat;
let aaBulletMat;
let missileTemplate;

export function updateWeaponHUD() {
    const statEl = document.getElementById('missile-stat');
    if (!statEl) return;
    if (gameState.missileMode === 1) {
        const burstPips = 'I'.repeat(playerFlight.stdBursts) + '.'.repeat(playerFlight.stdMaxBursts - playerFlight.stdBursts);
        if (playerFlight.stdReloadTimers.length > 0) {
            const minT = Math.min(...playerFlight.stdReloadTimers);
            statEl.textContent = `STD RELOAD (${minT.toFixed(1)}s) [${burstPips}]`;
            statEl.style.color = '#ffcc00';
        } else {
            statEl.textContent = `STD READY [${burstPips}]`;
            statEl.style.color = '#4df58a';
        }
    } else {
        const burstPips = 'I'.repeat(playerFlight.multiBursts) + '.'.repeat(playerFlight.multiMaxBursts - playerFlight.multiBursts);
        if (playerFlight.multiReloadTimers.length > 0) {
            const minT = Math.min(...playerFlight.multiReloadTimers);
            statEl.textContent = `MULTI RELOAD (${minT.toFixed(1)}s) [${burstPips}]`;
            statEl.style.color = '#ffcc00';
        } else {
            statEl.textContent = `MULTI READY [${burstPips}]`;
            statEl.style.color = '#4df58a';
        }
    }
}
export function fireCannon(isPlayer = true, sourceMesh = playerMesh) {
    const bullet = new THREE.Mesh(bulletGeom, bulletMat);
    // Spawn from nose cannon position
    const noseZ = isPlayer ? -4.8 : -8.5;
    const spawnPos = new THREE.Vector3(0, -0.2, noseZ).applyMatrix4(sourceMesh.matrixWorld);
    bullet.position.copy(spawnPos);
    bullet.quaternion.copy(sourceMesh.quaternion);

    // Forward speed vector
    let forward = new THREE.Vector3(0, 0, -1).applyQuaternion(sourceMesh.quaternion);
    const muzzleSpeed = 1600;

    // 에이스컴뱃 스타일 기총 유효 에임(Gun Lead Pipper) 정렬 시 탄도 수렴 보정
    if (isPlayer && gameState.isGunAimOnTarget && gameState.currentGunLeadPredictedPos) {
        const toLead = gameState.currentGunLeadPredictedPos.clone().sub(spawnPos).normalize();
        forward.lerp(toLead, 0.42).normalize();
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward);
    }

    bullet.velocity = forward.multiplyScalar(muzzleSpeed);
    bullet.life = 1.4; // Seconds
    bullet.isPlayer = isPlayer;
    bullet.damage = isPlayer ? 18 * playerFlight.damageMultiplier : 8;

    scene.add(bullet);
    bullets.push(bullet);

    if (isPlayer) {
        audio.playGunfire();
    }
}
export function fireAntiAirBullet(enemy) {
    const bullet = new THREE.Mesh(bulletGeom, aaBulletMat);
    // 탱크 포탑 상단 주포/대공포 위치에서 발사
    const spawnPos = enemy.mesh.position.clone().add(new THREE.Vector3(0, 10.0, 0));
    bullet.position.copy(spawnPos);

    // 상공의 플레이어를 향해 약간의 조준 분산(스프레드)을 주고 발사
    const aimError = new THREE.Vector3(
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 25,
        (Math.random() - 0.5) * 45
    );
    const targetPos = playerMesh.position.clone().add(aimError);
    const dir = targetPos.sub(spawnPos).normalize();
    bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

    const muzzleSpeed = 1100; // 대공포 탄속
    bullet.velocity = dir.multiplyScalar(muzzleSpeed);
    bullet.life = 2.8; // 지상에서 상공까지 지속
    bullet.isPlayer = false;
    bullet.damage = 8;

    scene.add(bullet);
    bullets.push(bullet);
}
function createMissileMesh() {
    if (missileTemplate) return missileTemplate.clone(true);
    const group = new THREE.Group();
    const bodyGeom = new THREE.CylinderGeometry(0.18, 0.18, 3.2, 10);
    bodyGeom.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdedede, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    const noseGeom = new THREE.ConeGeometry(0.18, 0.6, 10);
    noseGeom.rotateX(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeom, new THREE.MeshBasicMaterial({ color: 0x222222 }));
    nose.position.z = -1.9;
    group.add(nose);

    const finGeom = new THREE.BoxGeometry(0.7, 0.02, 0.4);
    const fin = new THREE.Mesh(finGeom, bodyMat);
    fin.position.z = 1.2;
    group.add(fin);
    const fin2 = fin.clone();
    fin2.rotation.z = Math.PI / 2;
    group.add(fin2);

    missileTemplate = group;
    return missileTemplate.clone(true);
}
export function clearProjectiles() {
    bullets.forEach(b => scene.remove(b));
    missiles.forEach(m => scene.remove(m.mesh));
    bullets.length = missiles.length = 0;
}
export function fireMissile(target, isPlayer = true, sourceMesh = playerMesh) {


    // 락온 완료 조건 엄격화: 플레이어 발사 시 오직 isLocked가 true인 대상만 호밍(유도) 대상으로 지정
    // 락온이 안 된 상태이거나 미완료된 상태면 유도 없이 직선 비행(무유도 로켓)
    const validTarget = (isPlayer ? (target && target.isLocked && target.alive ? target : null) : target);

    const mslMesh = createMissileMesh();
    // Wingtip or underwing spawn alternating
    const spawnOffset = new THREE.Vector3(isPlayer ? (Math.random() > 0.5 ? 2.5 : -2.5) : 0, -0.6, -1);
    spawnOffset.applyMatrix4(sourceMesh.matrixWorld);
    mslMesh.position.copy(spawnOffset);
    mslMesh.quaternion.copy(sourceMesh.quaternion);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(sourceMesh.quaternion);
    const missileData = {
        mesh: mslMesh,
        target: validTarget,
        velocity: forward.clone().multiplyScalar(400),
        speed: 450,
        maxSpeed: 1400,
        acceleration: 650,
        turnRate: 3.2 * (isPlayer ? playerFlight.missileTurnMultiplier : 1), // Proportional Navigation tracking limit
        life: 6.0,
        damage: isPlayer ? 85 * playerFlight.damageMultiplier : (sourceMesh.userData.isBoss ? 20 : 35),
        isPlayer: isPlayer
    };

    scene.add(mslMesh);
    missiles.push(missileData);

    if (isPlayer) audio.playMissileLaunch();
}
export function tryFireMissile() {
    if (!gameState.isGameRunning || gameState.isGamePaused) return;
    updateTargeting();
    // 현재 타겟이 살아있고 락온이 완료된 상태인지 확인
    const currentEnemy = enemies[gameState.lockedEnemyIndex];
    const lockedTarget = (currentEnemy && currentEnemy.alive && currentEnemy.isLocked) ? currentEnemy : null;

    if (gameState.missileMode === 2) {
        // [모드 2] 멀티 미사일: 최대 4발 연속/동시 발사 가능
        if (playerFlight.multiShotCooldown > 0) return;

        // 락온 완료된 적기들 추출
        const lockedTargets = enemies.filter(e => e.alive && e.isLocked);
        let fired = 0;
        const canFire = playerFlight.multiBursts;

        if (lockedTargets.length > 0) {
            // 락온 완료된 타깃들을 향해 각각 호밍 미사일 발사
            for (let i = 0; i < lockedTargets.length && fired < canFire; i++) {
                fireMissile(lockedTargets[i], true, playerMesh);
                fired++;
            }
        } else if (canFire > 0) {
            // 락온 완료된 적이 없으면 무유도(null)로 전방 직선 발사 (호밍 방지)
            fireMissile(null, true, playerMesh);
            fired = 1;
        }

        if (fired > 0) {
            playerFlight.multiBursts -= fired;
            playerFlight.multiShotCooldown = 0.35;
            for (let i = 0; i < fired; i++) {
                playerFlight.multiReloadTimers.push(playerFlight.multiReloadSeconds); // 한 발당 3초 개별 장전
            }
            updateWeaponHUD();
        }
    } else {
        // [모드 1] 표준 미사일: 최대 2발 연속 발사 가능
        if (playerFlight.stdShotCooldown > 0) return;

        if (playerFlight.stdBursts > 0) {
            // 락온 완료된 적이 있으면 유도 미사일, 락온이 안 되어 있으면 무유도(null) 발사 (호밍 방지)
            fireMissile(lockedTarget, true, playerMesh);
            playerFlight.stdBursts--;
            playerFlight.stdShotCooldown = 0.30;
            playerFlight.stdReloadTimers.push(playerFlight.stdReloadSeconds); // 한 발당 2.2초 개별 장전
            updateWeaponHUD();
        }
    }
}

export function initWeapons() {
    gameState.missileMode = 1;

    bullets = [];

    missiles = [];

    bulletGeom = new THREE.CylinderGeometry(0.2, 0.2, 12, 6);

    bulletGeom.rotateX(Math.PI / 2);

    bulletMat = new THREE.MeshBasicMaterial({ color: 0xffee88 });

    gameState.isGunAimOnTarget = false;

    gameState.currentGunLeadPredictedPos = null;

    aaBulletMat = new THREE.MeshBasicMaterial({ color: 0xff3b1f });
}
