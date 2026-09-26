import { schoolOffset, RADIAL_DIRECTIONS, stepBomberWeapons } from './special-types.js';
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

        // Surviving school members follow the first living member; leader loss
        // rebases offsets without pulling the formation back to its old slot.
        const leader = enemy.school?.members.find(member => member.alive);
        if (leader && leader !== enemy) {
            const offset = schoolOffset(enemy.schoolSlot, leader.schoolSlot);
            const destination = new THREE.Vector3(offset.x, offset.y, offset.z)
                .applyQuaternion(leader.mesh.quaternion).add(leader.mesh.position);
            const before = enemy.mesh.position.clone();
            if (before.distanceTo(destination) > 1500) enemy.mesh.position.copy(destination);
            else enemy.mesh.position.lerp(destination, 1 - Math.exp(-4 * delta));
            enemy.mesh.position.y = Math.max(enemy.mesh.position.y,
                getSurfaceHeight(enemy.mesh.position.x, enemy.mesh.position.z) + 100);
            enemy.mesh.quaternion.slerp(leader.mesh.quaternion, 1 - Math.exp(-5 * delta));
            enemy.velocity.copy(enemy.mesh.position).sub(before).divideScalar(Math.max(delta, 0.0001));
            enemy.state = leader.state;
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion);
            const aim = playerMesh.position.clone().sub(enemy.mesh.position);
            const range = aim.length();
            const shots = stepAirWeapons(enemy, delta, range, range ? aim.dot(forward) / range : -1,
                attackers.has(enemy) && !gameState.isPlayerDead);
            if (shots.cannon) { enemy.mesh.updateMatrixWorld(true); fireCannon(false, enemy.mesh); }
            return;
        }

        // Reposition distant aircraft once; local -Z is the nose.
        if (dist > 6500) {
            const pFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
            const spawnDist = 1600 + Math.random() * 600;
            const x = playerMesh.position.x + pFwd.x * spawnDist + (Math.random() - 0.5) * 600;
            const z = playerMesh.position.z + pFwd.z * spawnDist + (Math.random() - 0.5) * 600;
            const groundY = getSurfaceHeight(x, z);
            const targetY = playerMesh.position.y + (enemy.altitudeOffset || 0);
            const reY = Math.max(groundY + 280, Math.min(1650, targetY));
            enemy.mesh.position.set(x, reY, z);
            enemy.mesh.lookAt(playerMesh.position);
            enemy.mesh.rotateY(Math.PI);
            enemy.flight = null;
            enemy.fireCooldown = 1.5 + Math.random();
            enemy.missileCooldown = 4 + Math.random() * 3;
            enemy.missileLockTime = 0;
            enemy.burstShots = 0;
        }
        if (!enemy.flight) {
            enemy.flight = createFlightState(
                new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion),
                enemy.altitudeOffset || 0
            );
        }
        const speed = enemy.speed * (enemy.state === 'INTERCEPT' ? 0.65 : 0.58);
        const flight = stepFlight(enemy.flight, enemy.mesh.position, playerMesh.position,
            speed, delta, getSurfaceHeight, enemy.isBoss || enemy.isBomber, enemy.evadeTimer > 0);
        enemy.evadeTimer = Math.max(0, (enemy.evadeTimer || 0) - delta);
        enemy.state = flight.state;
        const visualBank = enemy.flight.bank * 1.35;
        enemy.mesh.rotation.set(enemy.flight.pitch, enemy.flight.heading, visualBank, 'YXZ');
        enemy.velocity.set(flight.forward.x, flight.forward.y, flight.forward.z).multiplyScalar(speed);

        // Assess aim after moving/steering; recovery and extension suppress fire.
        const aim = playerMesh.position.clone().sub(enemy.mesh.position);
        const range = aim.length();
        const alignment = range > 0 ? (aim.x * flight.forward.x + aim.y * flight.forward.y + aim.z * flight.forward.z) / range : -1;
        if (enemy.isBomber) {
            const launch = stepBomberWeapons(enemy, delta, range,
                attackers.has(enemy) && !gameState.isPlayerDead && enemy.state !== 'RECOVER',
                hostileMissiles, missileLaunchCooldown, ATTACK_POLICY.missileLimit);
            const lamp = enemy.mesh.userData.salvoLight;
            if (lamp) {
                lamp.visible = enemy.salvoWarning > 0;
                lamp.scale.setScalar(1 + Math.sin(enemy.salvoWarning * 22) * 0.35);
            }
            if (launch) {
                enemy.mesh.updateMatrixWorld(true);
                for (const axis of RADIAL_DIRECTIONS) {
                    const direction = new THREE.Vector3(axis.x, axis.y, axis.z).applyQuaternion(enemy.mesh.quaternion);
                    fireMissile({ mesh: playerMesh }, false, enemy.mesh, { direction, homingDelay: 0.9 });
                }
                hostileMissiles += RADIAL_DIRECTIONS.length;
                missileLaunchCooldown = ATTACK_POLICY.missileSpacing;
            }
        } else {
            const shots = stepAirWeapons(enemy, delta, range, alignment, attackers.has(enemy) && !gameState.isPlayerDead,
                Math.random, canLaunchMissile(missileLaunchCooldown, hostileMissiles));
            if (shots.cannon || shots.missile) enemy.mesh.updateMatrixWorld(true);
            if (shots.cannon) fireCannon(false, enemy.mesh);
            if (shots.missile) {
                fireMissile({ mesh: playerMesh }, false, enemy.mesh);
                hostileMissiles++;
                missileLaunchCooldown = enemy.isBoss ? ATTACK_POLICY.bossMissileSpacing : ATTACK_POLICY.missileSpacing;
            }
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
