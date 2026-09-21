import { scheduleCombat } from '../core/scheduler.js';
// enemies/lifecycle: imports are side-effect free; main.js controls initialization.
import { gameState } from '../core/state.js';
import { activeSinkingShips, enemies } from './fleet.js';
import { triggerExplosion } from '../effects/particles.js';
import { scene } from '../rendering/scene.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { acquireNextBestTarget } from '../combat/targeting.js';
import { getSurfaceHeight } from '../world/environment.js';
import { BALANCE } from '../data/generated/balance.js';


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
export function killEnemy(enemy) {
    if (!enemy.alive || !gameState.isGameRunning || gameState.isGamePaused) return;
    enemy.alive = false;
    triggerExplosion(enemy.mesh.position, 60, 2.5);

    if (enemy.isShip) {
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
        scene.remove(enemy.mesh); // 공중 적기나 탱크는 일반 제거
        playerFlight.score += (enemy.isBoss ? BALANCE.enemies.boss : (enemy.isGround ? BALANCE.enemies.tank : (enemy.isElite ? BALANCE.enemies.elite : BALANCE.enemies.stage_aircraft))).scoreReward;
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
