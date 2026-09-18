// enemies/ai: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { enemies } from './fleet.js';
import { playerMesh } from '../player/player.js';
import { fireAntiAirBullet, fireCannon, fireMissile } from '../combat/weapons.js';
import { getSurfaceHeight } from '../world/environment.js';
import { getStage } from '../config/stages.js';

let _steerLookMat;
let _steerTargetQuat;
let _steerUp;

export function updateEnemies(delta) {
    let activeCount = 0;
    const budget = getStage(gameState.currentStageInfo.stage).attackBudget;
    const attackers = new Set(enemies.filter(e => e.alive).sort((a, b) => Number(b.isBoss) - Number(a.isBoss) || a.mesh.position.distanceToSquared(playerMesh.position) - b.mesh.position.distanceToSquared(playerMesh.position)).slice(0, budget));

    enemies.forEach((enemy, idx) => {
        if (!enemy.alive) return;
        activeCount++;

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

                    // 전함 대공 3연장 포격 (플레이어가 3800m 이내 접근 시)
                    enemy.fireCooldown -= delta;
                    if (dist < 3800 && enemy.fireCooldown <= 0) {
                        fireAntiAirBullet(enemy);
                        enemy.fireCooldown = 2.0 + Math.random() * 1.8;
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
            if (dist < 3200 && enemy.fireCooldown <= 0) {
                fireAntiAirBullet(enemy);
                enemy.fireCooldown = 1.8 + Math.random() * 1.5;
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

        // =============================================
        // [공중 적기 AI] FSM Logic & 고고도 도그파이트 유지
        // =============================================
        const enemyFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.mesh.quaternion);

        // 플레이어와의 거리가 2600m 이상이면 무조건 요격(INTERCEPT) 모드로 플레이어를 추격
        if (dist > 2600 && enemy.state !== 'EVADE') {
            enemy.state = 'INTERCEPT';
        }

        switch (enemy.state) {
            case 'PATROL':
            case 'INTERCEPT':
                steerTowards(enemy.mesh, playerMesh.position, 2.4 * delta);
                if (dist < 2200) {
                    enemy.state = 'ENGAGE';
                }
                break;

            case 'ENGAGE':
                if (dist < 500) {
                    // 근접 선회 회피 기동
                    const sideOffset = enemy.mesh.position.clone()
                        .add(new THREE.Vector3(enemyFwd.z, 0, -enemyFwd.x).multiplyScalar(600))
                        .add(new THREE.Vector3(0, 150, 0));
                    steerTowards(enemy.mesh, sideOffset, 2.2 * delta);
                } else {
                    steerTowards(enemy.mesh, playerMesh.position, 1.8 * delta);
                }

                // 기관포 발사
                enemy.fireCooldown -= delta;
                const angleToPlayer = enemyFwd.angleTo(toPlayer.clone().normalize());

                if (attackers.has(enemy) && dist < 1800 && angleToPlayer < 0.30 && enemy.fireCooldown <= 0) {
                    fireCannon(false, enemy.mesh);
                    enemy.fireCooldown = enemy.isBoss ? 0.25 : 0.65;
                }

                // 미사일 발사
                if (!enemy.missileCooldown) enemy.missileCooldown = 3 + Math.random() * 3;
                enemy.missileCooldown -= delta;
                if (attackers.has(enemy) && dist < 2400 && angleToPlayer < 0.45 && enemy.missileCooldown <= 0) {
                    fireMissile({ mesh: playerMesh }, false, enemy.mesh);
                    if (enemy.isBoss) {
                        enemy.mesh.rotateY(0.18);
                        fireMissile({ mesh: playerMesh }, false, enemy.mesh);
                        enemy.mesh.rotateY(-0.18);
                    }
                    enemy.missileCooldown = enemy.isBoss ? 3.5 : 8 + Math.random() * 4;
                }

                if (dist > 3200) {
                    enemy.state = 'INTERCEPT';
                }
                if (enemy.evadeTimer && enemy.evadeTimer > 0) {
                    enemy.state = 'EVADE';
                }
                break;

            case 'EVADE':
                if (!enemy.evadeDir) {
                    const side = Math.random() < 0.5 ? 1 : -1;
                    enemy.evadeDir = enemy.mesh.position.clone()
                        .add(new THREE.Vector3(enemyFwd.z * side * 800, 200, -enemyFwd.x * side * 800));
                }
                steerTowards(enemy.mesh, enemy.evadeDir, 2.5 * delta);

                if (!enemy.evadeTimer) enemy.evadeTimer = 1.2 + Math.random() * 0.8;
                enemy.evadeTimer -= delta;
                if (enemy.evadeTimer <= 0) {
                    enemy.evadeTimer = 0;
                    enemy.evadeDir = null;
                    enemy.state = 'INTERCEPT';
                }
                break;
        }

        // 이탈 방지 리징 (Leashing)
        if (dist > 4500) {
            steerTowards(enemy.mesh, playerMesh.position, 3.8 * delta);
        }
        if (dist > 6500) {
            const pFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
            const spawnDist = 1600 + Math.random() * 600;
            const reX = playerMesh.position.x + pFwd.x * spawnDist + (Math.random() - 0.5) * 600;
            const reZ = playerMesh.position.z + pFwd.z * spawnDist + (Math.random() - 0.5) * 600;
            const gY = getSurfaceHeight(reX, reZ);
            const reY = Math.max(750, Math.max(playerMesh.position.y + (Math.random() - 0.5) * 150, gY + 400));
            enemy.mesh.position.set(reX, reY, reZ);
            enemy.mesh.lookAt(playerMesh.position);
            enemy.state = 'INTERCEPT';
        }

        // 전진 이동
        const speedMultiplier = (enemy.state === 'INTERCEPT') ? 0.65 : 0.50;
        enemy.mesh.translateZ(-enemy.speed * speedMultiplier * delta);

        // =============================================
        // 적기 지형 충돌 방지 제어 (자연스러운 전투기 비행 유지)
        // =============================================
        const groundY = getSurfaceHeight(enemy.mesh.position.x, enemy.mesh.position.z);
        const minSafeAlt = groundY + 150; // 절대 고도 하한선(650m)을 없애고 지형 위 150m 유지로 변경

        if (enemy.mesh.position.y < minSafeAlt) {
            // 저고도 지면 회피: 급격한 상승이 아닌 멀리 앞을 보며 완만한 기수 상승 유도
            const skyTarget = enemy.mesh.position.clone();
            skyTarget.y = minSafeAlt + 300;
            skyTarget.add(enemyFwd.clone().multiplyScalar(600));
            steerTowards(enemy.mesh, skyTarget, 2.0 * delta); // 4.5 -> 2.0으로 부드럽게 깎음

            // 물리적 최소 하한선 보정 (뚝뚝 끊기는 강제 텔레포트 대신 선형 보간으로 부드럽게 밀어올림)
            if (enemy.mesh.position.y < groundY + 50) {
                enemy.mesh.position.y += (groundY + 50 - enemy.mesh.position.y) * 8.0 * delta;
            }
        } else if (enemy.mesh.position.y > 2500) {
            // 지나치게 우주로 가는 것만 방지
            const altTarget = enemy.mesh.position.clone();
            altTarget.y = 2000;
            altTarget.add(enemyFwd.clone().multiplyScalar(600));
            steerTowards(enemy.mesh, altTarget, 1.5 * delta);
        }

        // 롤이 너무 극단적으로 기울지 않도록 제한
        enemy.mesh.rotation.z = THREE.MathUtils.clamp(
            enemy.mesh.rotation.z, -1.2, 1.2
        );

        // 적기 엔진 불꽃 업데이트 (로우폴리 파티클)
        if (enemy.mesh.baseGlow) {
            enemy.mesh.baseGlow.scale.set(1 + Math.random() * 0.15, 1 + Math.random() * 0.15, 1);
        }
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
function steerTowards(mesh, targetPos, maxTurn) {
    const dir = targetPos.clone().sub(mesh.position);
    if (dir.lengthSq() < 1) return;
    dir.normalize();

    // 목표 지점을 향해 바라보는 회전 행렬 산출 (Up 벡터 = 0, 1, 0으로 고정하여 롤 스핀 원천 차단)
    _steerLookMat.lookAt(targetPos, mesh.position, _steerUp);
    _steerTargetQuat.setFromRotationMatrix(_steerLookMat);

    // 선회 방향에 따른 자연스러운 뱅크(Bank) 각도 (최대 ±35도로 제한)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mesh.quaternion);
    const cross = new THREE.Vector3().crossVectors(forward, dir);
    const bankAngle = THREE.MathUtils.clamp(-cross.y * 1.2, -0.6, 0.6);
    const bankQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), bankAngle);
    _steerTargetQuat.multiply(bankQuat);

    // 쿼터니언 보간 회전
    mesh.quaternion.rotateTowards(_steerTargetQuat, maxTurn);
}

export function initEnemyAI() {
    _steerLookMat = new THREE.Matrix4();

    _steerTargetQuat = new THREE.Quaternion();

    _steerUp = new THREE.Vector3(0, 1, 0);
}
