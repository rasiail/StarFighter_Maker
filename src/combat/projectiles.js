// combat/projectiles: imports are side-effect free; main.js controls initialization.
import { bullets, missiles } from './weapons.js';
import { enemies } from '../enemies/fleet.js';
import { createSmokePuff, particles, triggerExplosion, removeParticle } from '../effects/particles.js';
import { killEnemy } from '../enemies/lifecycle.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { gameEvents, EVENTS } from '../core/events.js';
import { scene } from '../rendering/scene.js';


export function updateProjectiles(delta) {
    // 1. Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.position.addScaledVector(b.velocity, delta);
        b.life -= delta;

        // Hit detection against enemies or player
        if (b.isPlayer) {
            for (let j = 0; j < enemies.length; j++) {
                const enemy = enemies[j];
                const hitRadius = enemy.hitRadius || (enemy.isGround ? 20.0 : 15.0);
                if (enemy.alive && b.position.distanceTo(enemy.mesh.position) < hitRadius) {
                    enemy.health -= b.damage;
                    triggerExplosion(b.position, 6, 0.4);
                    b.life = -1;
                    if (enemy.health <= 0) {
                        killEnemy(enemy);
                    }
                    break;
                }
            }
        } else {
            if (b.position.distanceTo(playerMesh.position) < 6.0) {
                playerFlight.health -= b.damage;
                triggerExplosion(b.position, 5, 0.4);
                b.life = -1;
                if (playerFlight.health <= 0) gameEvents.emit(EVENTS.PLAYER_DESTROYED);
            }
        }

        if (b.life <= 0) {
            scene.remove(b);
            bullets.splice(i, 1);
        }
    }

    // 2. Guided Missiles
    for (let i = missiles.length - 1; i >= 0; i--) {
        const m = missiles[i];
        m.life -= delta;
        m.speed = Math.min(m.maxSpeed, m.speed + m.acceleration * delta);

        // Proportional Navigation Guidance
        if (m.isPlayer) {
            // 플레이어가 쏜 미사일: 적기/탱크/전함 추적
            if (m.target && m.target.alive) {
                const toTgt = m.target.mesh.position.clone().sub(m.mesh.position).normalize();
                const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toTgt);
                m.mesh.quaternion.rotateTowards(targetQuat, m.turnRate * delta);
            }
        } else {
            // 적이 쏜 미사일: 플레이어 추적
            if (m.target && m.target.mesh) {
                const toTgt = m.target.mesh.position.clone().sub(m.mesh.position).normalize();
                const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toTgt);
                m.mesh.quaternion.rotateTowards(targetQuat, m.turnRate * delta);
            }
        }

        // Advance
        m.mesh.translateZ(-m.speed * delta);

        // Spawn smoke puffs along path
        createSmokePuff(m.mesh.position);

        // Hit Check
        if (m.isPlayer) {
            // 플레이어 미사일 → 적기/지상 탱크/전함 충돌 판정
            if (m.target && m.target.alive) {
                const hitDist = m.mesh.position.distanceTo(m.target.mesh.position);
                const mslHitRadius = m.target.hitRadius ? (m.target.hitRadius * 1.1) : (m.target.isGround ? 26.0 : 22.0);
                if (hitDist < mslHitRadius) {
                    m.target.health -= m.damage;
                    triggerExplosion(m.mesh.position, 34, 1.8);
                    m.life = -1;
                    if (m.target.health <= 0) {
                        killEnemy(m.target);
                    }
                }
            } else if (!m.target) {
                // 락온 없이 발사된 무유도 미사일도 직진 경로상의 적과 충돌 판정
                for (let j = 0; j < enemies.length; j++) {
                    const enemy = enemies[j];
                    if (!enemy.alive) continue;
                    const mslHitRadius = enemy.hitRadius ? (enemy.hitRadius * 1.1) : (enemy.isGround ? 26.0 : 22.0);
                    if (m.mesh.position.distanceTo(enemy.mesh.position) < mslHitRadius) {
                        enemy.health -= m.damage;
                        triggerExplosion(m.mesh.position, 34, 1.8);
                        m.life = -1;
                        if (enemy.health <= 0) {
                            killEnemy(enemy);
                        }
                        break;
                    }
                }
            }
        } else {
            // 적 미사일 → 플레이어 충돌
            if (m.target && m.target.mesh) {
                const hitDist = m.mesh.position.distanceTo(m.target.mesh.position);
                if (hitDist < 10.0) {
                    playerFlight.health -= m.damage;
                    triggerExplosion(m.mesh.position, 20, 1.2);
                    m.life = -1;
                    if (playerFlight.health <= 0) gameEvents.emit(EVENTS.PLAYER_DESTROYED);
                }
            }
        }

        if (m.life <= 0) {
            scene.remove(m.mesh);
            missiles.splice(i, 1);
        }
    }

    // 3. Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.addScaledVector(p.velocity, delta);
        p.life -= delta;

        const lifeRatio = p.life / p.maxLife;
        p.mesh.scale.multiplyScalar(1 + delta * (p.isFire ? 1.2 : 2.2));
        p.mesh.material.opacity = Math.max(0, lifeRatio);

        if (p.life <= 0) {
            removeParticle(p);
            particles.splice(i, 1);
        }
    }
}
