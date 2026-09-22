// enemies/ai: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { enemies } from './fleet.js';
import { playerMesh } from '../player/player.js';
import { fireAntiAirBullet, fireCannon, fireMissile, missiles } from '../combat/weapons.js';
import { getSurfaceHeight } from '../world/environment.js';
import { getStage } from '../config/stages.js';

import { createFlightState, stepFlight, stepAirWeapons } from './flight-model.js';
import { ATTACK_POLICY, selectAttackers, canLaunchMissile } from './attack-policy.js';

let missileLaunchCooldown = 0;

export function updateEnemies(delta) {
    const budget = getStage(gameState.currentStageInfo.stage).attackBudget;
    const attackers = selectAttackers(enemies, playerMesh.position, budget);
    missileLaunchCooldown = Math.max(0, missileLaunchCooldown - delta);
    let hostileMissiles = missiles.filter(m => !m.isPlayer && m.life > 0).length;

    enemies.forEach(enemy => {
        if (!enemy.alive) return;

        const toPlayer = playerMesh.position.clone().sub(enemy.mesh.position);
        const dist = toPlayer.length();

        // =============================================
        // [지상 / 해상 목표물 AI] 탱크 및 전함
        // =============================================
        if (enemy.isGround) {
            if (enemy.isShip) {
                // 전함 본체(HULL)인 경우
                if (enemy.shipPart === 'HULL') {
                    // 레이더 안테나 회전
                    if (enemy.shipMesh && enemy.shipMesh.radarAnt) {
                        enemy.shipMesh.radarAnt.rotation.y += 1.8 * delta;
                    }
                    return;
                }

                // 전함 함포(TURRET)인 경우
                if (enemy.shipPart === 'TURRET') {
                    const turret = enemy.turretMesh;
                    if (turret) {
                        const toPlayerLocal = playerMesh.position.clone().sub(enemy.mesh.position);
                        const targetAngle = Math.atan2(toPlayerLocal.x, -toPlayerLocal.z);
                        const shipHeading = (enemy.shipMesh) ? enemy.shipMesh.rotation.y : 0;
                        const relAngle = targetAngle - shipHeading;
                        turret.rotation.y = THREE.MathUtils.lerp(turret.rotation.y, relAngle, 2.5 * delta);
                    }

                    // Ground batteries share a limited number of firing slots.
                    enemy.fireCooldown -= delta;
                    if (!gameState.isPlayerDead && attackers.has(enemy) && dist < 3800 && enemy.fireCooldown <= 0) {
                        fireAntiAirBullet(enemy);
                        enemy.fireCooldown = 1.0 + Math.random() * 0.9;
                    }
                    return;
                }
            }

            // 일반 지상 장갑 전차 (Tank)
            if (enemy.turret) {
                const toPlayerLocal = playerMesh.position.clone().sub(enemy.mesh.position);
                const targetAngle = Math.atan2(toPlayerLocal.x, -toPlayerLocal.z);
                enemy.turret.rotation.y = THREE.MathUtils.lerp(enemy.turret.rotation.y, targetAngle, 2.5 * delta);
            }

            enemy.fireCooldown -= delta;
            if (!gameState.isPlayerDead && attackers.has(enemy) && dist < 3200 && enemy.fireCooldown <= 0) {
                fireAntiAirBullet(enemy);
                enemy.fireCooldown = 0.9 + Math.random() * 0.8;
            }

            // 탱크 리징
            if (dist > 6500) {
                const pFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
                const spawnDist = 1800 + Math.random() * 800;
                const reX = playerMesh.position.x + pFwd.x * spawnDist + (Math.random() - 0.5) * 800;
                const reZ = playerMesh.position.z + pFwd.z * spawnDist + (Math.random() - 0.5) * 800;
                const reY = getSurfaceHeight(reX, reZ);
                enemy.mesh.position.set(reX, reY + 1.5, reZ);
            }
            return; // 지상/해상 적은 공중 기동 스킵
        }

        // Reposition distant aircraft once; local -Z is the nose.
        if (dist > 6500) {
            const pFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
            const spawnDist = 1600 + Math.random() * 600;
            const x = playerMesh.position.x + pFwd.x * spawnDist + (Math.random() - 0.5) * 600;
            const z = playerMesh.position.z + pFwd.z * spawnDist + (Math.random() - 0.5) * 600;
            enemy.mesh.position.set(x, Math.max(750, playerMesh.position.y, getSurfaceHeight(x, z) + 400), z);
            enemy.mesh.lookAt(playerMesh.position);
            enemy.mesh.rotateY(Math.PI);
            enemy.flight = null;
            enemy.fireCooldown = 1.5 + Math.random();
            enemy.missileCooldown = 4 + Math.random() * 3;
            enemy.missileLockTime = 0;
            enemy.burstShots = 0;
        }
        if (!enemy.flight) {
            enemy.flight = createFlightState(new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion));
        }
        const speed = enemy.speed * (enemy.state === 'INTERCEPT' ? 0.65 : 0.58);
        const flight = stepFlight(enemy.flight, enemy.mesh.position, playerMesh.position,
            speed, delta, getSurfaceHeight, enemy.isBoss, enemy.evadeTimer > 0);
        enemy.evadeTimer = Math.max(0, (enemy.evadeTimer || 0) - delta);
        enemy.state = flight.state;
        enemy.mesh.rotation.set(enemy.flight.pitch, enemy.flight.heading, enemy.flight.bank, 'YXZ');
        enemy.velocity.set(flight.forward.x, flight.forward.y, flight.forward.z).multiplyScalar(speed);

        // Assess aim after moving/steering; recovery and extension suppress fire.
        const aim = playerMesh.position.clone().sub(enemy.mesh.position);
        const range = aim.length();
        const alignment = range > 0 ? (aim.x * flight.forward.x + aim.y * flight.forward.y + aim.z * flight.forward.z) / range : -1;
        const shots = stepAirWeapons(enemy, delta, range, alignment, attackers.has(enemy) && !gameState.isPlayerDead,
            Math.random, canLaunchMissile(missileLaunchCooldown, hostileMissiles));
        if (shots.cannon || shots.missile) enemy.mesh.updateMatrixWorld(true);
        if (shots.cannon) fireCannon(false, enemy.mesh);
        if (shots.missile) {
            fireMissile({ mesh: playerMesh }, false, enemy.mesh);
            hostileMissiles++;
            missileLaunchCooldown = enemy.isBoss ? ATTACK_POLICY.bossMissileSpacing : ATTACK_POLICY.missileSpacing;
        }

        // 적기 엔진 불꽃 업데이트 (로우폴리 파티클)
        const glows = enemy.mesh.baseGlows || (enemy.mesh.baseGlow ? [enemy.mesh.baseGlow] : []);
        glows.forEach(glow => {
            glow.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.15, 1);
        });
        if (gameState.jetExhaustSystem && Math.random() < 0.6) {
            const localNozzle = new THREE.Vector3(0, 0, 5.3);
            gameState.jetExhaustSystem.spawn(
                enemy.mesh,
                localNozzle,
                false,
                0.8,
                true
            );
        }
    });
}

export function initEnemyAI() {
    missileLaunchCooldown = 0;
}
