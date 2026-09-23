import { scheduleCombat } from '../core/scheduler.js';
// enemies/lifecycle: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { activeSinkingShips, enemies } from './fleet.js';
import { triggerExplosion, createSmokePuff } from '../effects/particles.js';
import { scene } from '../rendering/scene.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { getSurfaceHeight } from '../world/environment.js';
import { BALANCE } from '../data/generated/balance.js';
import { audio } from '../audio/audio.js';

export let activeDyingBosses = [];

export function clearDyingBosses() {
    for (const b of activeDyingBosses) {
        if (b.mesh) scene.remove(b.mesh);
    }
    activeDyingBosses.length = 0;
}


export function updateSinkingShips(delta) {
    for (let i = activeSinkingShips.length - 1; i >= 0; i--) {
        const hullEnemy = activeSinkingShips[i];
        const sm = hullEnemy.shipMesh;
        if (!sm) {
            activeSinkingShips.splice(i, 1);
            continue;
        }

        // 점진적으로 가속되는 침몰 속도
        hullEnemy.sinkSpeed = Math.min(18.0, (hullEnemy.sinkSpeed || 0) + delta * 3.5);
        sm.position.y -= hullEnemy.sinkSpeed * delta;
        sm.rotation.z += delta * 0.08; // 좌/우현으로 서서히 기울어짐 (전복 침몰)
        sm.rotation.x += delta * 0.035; // 선미가 물속으로 가라앉음

        // 침몰 도중 간헐적 선체 유폭 화염 및 연기 방출
        if (Math.random() < 0.28) {
            const burstOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 24,
                6 + Math.random() * 8,
                (Math.random() - 0.5) * 140
            ).applyEuler(sm.rotation);
            triggerExplosion(sm.position.clone().add(burstOffset), 28, 1.4);
        }

        // 해수면 아래로 완전히 가라앉으면 씬에서 제거
        if (sm.position.y < -55) {
            scene.remove(sm);
            activeSinkingShips.splice(i, 1);
        }
    }
}

export function updateDyingBosses(delta) {
    for (let i = activeDyingBosses.length - 1; i >= 0; i--) {
        const b = activeDyingBosses[i];
        b.timer -= delta;
        const elapsed = b.totalTime - b.timer;

        // 관성 감속 및 통제 불능 회전/하강
        b.speed = Math.max(30, (b.speed || 180) - delta * 60);
        b.mesh.translateZ(-b.speed * 0.514444 * delta);
        b.mesh.rotateZ(0.7 * delta);
        b.mesh.rotateX(0.15 * delta);
        b.mesh.position.y -= 25 * delta;

        // 거대 보스(scale 9) 선체 곳곳에서 지속 연기 트레일 방출
        b.smokeTimer -= delta;
        if (b.smokeTimer <= 0) {
            for (let k = 0; k < 2; k++) {
                const offset = new THREE.Vector3(
                    (Math.random() - 0.5) * 30,
                    (Math.random() - 0.5) * 15,
                    (Math.random() - 0.5) * 40
                );
                createSmokePuff(b.mesh.position.clone().add(offset));
            }
            b.smokeTimer = 0.05;
        }

        // 중간 단발성 연쇄 유폭 (약 0.35초 간격으로 선체 각 부위에서 폭발)
        if (elapsed >= b.nextBurst && b.timer > 0.35) {
            const burstOffset = new THREE.Vector3(
                (Math.random() - 0.5) * 35,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 45
            );
            triggerExplosion(b.mesh.position.clone().add(burstOffset), 45, 2.8);
            audio.playExplosion();
            b.nextBurst = elapsed + (0.32 + Math.random() * 0.18);
            b.mesh.rotateZ((Math.random() - 0.5) * 0.3);
        }

        // 3초 종료 시: 초대형 클라이맥스 대폭발 및 씬에서 제거
        if (b.timer <= 0) {
            triggerExplosion(b.mesh.position, 130, 5.5);
            audio.playExplosion();
            scene.remove(b.mesh);
            activeDyingBosses.splice(i, 1);
            gameEvents.emit(EVENTS.BOSS_SEQUENCE_COMPLETE);
        }
    }
}

export function killEnemy(enemy) {
    if (!enemy.alive || !gameState.isGameRunning || gameState.isGamePaused) return;
    enemy.alive = false;

    if (enemy.isBoss) {
        enemy.isDying = true;
        // 보스는 즉시 scene.remove 하지 않고 activeDyingBosses에 등록하여 3초 연출
        activeDyingBosses.push({
            mesh: enemy.mesh,
            timer: 3.0,
            totalTime: 3.0,
            nextBurst: 0.25,
            smokeTimer: 0,
            speed: enemy.speed || 180,
        });
        triggerExplosion(enemy.mesh.position, 70, 3.5);
        audio.playExplosion();
        playerFlight.score += BALANCE.enemies.boss.scoreReward;
    } else if (enemy.isShip) {
        triggerExplosion(enemy.mesh.position, 60, 2.5);
        if (enemy.shipPart === 'HULL') {
            // [전함 본체 파괴] 전함 침몰 시작 및 연결된 모든 함포 연쇄 유폭!
            enemy.isSinking = true;
            activeSinkingShips.push(enemy);

            // 본체에 부속된 함포들도 연쇄 폭발하며 완전 무력화 (타깃에서 즉시 제거)
            if (enemy.turretEnemies) {
                enemy.turretEnemies.forEach(turretEnemy => {
                    if (turretEnemy.alive) {
                        killEnemy(turretEnemy); // Award target progress and XP for collateral turret kills too.
                    }
                });
            }

            // 전함 전체 6회 연쇄 대폭발 시퀀스 연출
            for (let k = 1; k <= 6; k++) {
                scheduleCombat(k * 0.22, () => {
                    if (enemy.shipMesh) {
                        const expPos = enemy.shipMesh.position.clone().add(new THREE.Vector3(
                            (Math.random() - 0.5) * 25,
                            8 + Math.random() * 12,
                            (Math.random() - 0.5) * 140
                        ));
                        triggerExplosion(expPos, 52, 2.2);
                    }
                });
            }

            playerFlight.score += BALANCE.enemies.ship_hull.scoreReward;
        } else if (enemy.shipPart === 'TURRET') {
            // [함포 단독 파괴] 해당 포탑만 검게 그을리고 포신이 힘없이 처짐 (사격 정지)
            if (enemy.turretMesh) {
                enemy.turretMesh.traverse(child => {
                    if (child.isMesh && child.material) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x161616,
                            roughness: 0.95,
                            metalness: 0.05
                        });
                    }
                });
                enemy.turretMesh.rotation.x = 0.22; // 포신이 힘없이 처짐
            }
            playerFlight.score += BALANCE.enemies.ship_turret.scoreReward;
        }
    } else {
        triggerExplosion(enemy.mesh.position, 60, 2.5);
        scene.remove(enemy.mesh); // 공중 적기나 탱크는 일반 제거
        playerFlight.score += (enemy.isGround ? BALANCE.enemies.tank : (enemy.isElite ? BALANCE.enemies.elite : BALANCE.enemies.stage_aircraft)).scoreReward;
    }

    document.getElementById('score-val').textContent = playerFlight.score.toString().padStart(4, '0');

    // 목표 격추 수 카운트 다운
    gameState.currentKills++;
    const remain = Math.max(0, gameState.TARGET_KILLS - gameState.currentKills);
    document.getElementById('target-count').textContent = remain;

    gameEvents.emit(EVENTS.ENEMY_DESTROYED, {
        enemyType: enemy.isShip ? (enemy.shipPart === 'TURRET' ? 'turret' : 'ship') : (enemy.isGround ? 'tank' : (enemy.isElite ? 'elite' : 'aircraft')),
        killCount: gameState.currentKills,
        score: playerFlight.score,
        isBoss: !!enemy.isBoss,
    });

    // 현재 락온된 적기가 격추되었거나 무효화된 경우, 즉시 가장 가까운 생존 적기로 자동 락온
    if (enemy === enemies[gameState.lockedEnemyIndex] || !enemies[gameState.lockedEnemyIndex] || !enemies[gameState.lockedEnemyIndex].alive) {
        acquireNextBestTarget();
    }
}
