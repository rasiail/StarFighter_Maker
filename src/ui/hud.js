import { gameState } from '../core/state.js';
import { BALANCE } from '../data/generated/balance.js';
import { camera, hudCanvas, hudCtx } from '../rendering/scene.js';
import { playerFlight, playerMesh } from '../player/player.js';
import { enemies } from '../enemies/fleet.js';
import { audio } from '../audio/audio.js';
import { HUD_LAYOUT } from './hud_layout.js';



export function renderHUD() {
    hudCanvas.width = window.innerWidth;
    hudCanvas.height = window.innerHeight;
    const w = hudCanvas.width;
    const h = hudCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    hudCtx.clearRect(0, 0, w, h);
    hudCtx.strokeStyle = '#4df58a';
    hudCtx.fillStyle = '#4df58a';
    hudCtx.lineWidth = 1.5;
    hudCtx.font = '13px "Share Tech Mono", monospace';

    // 플레이어 기체 체력(HULL HP) 게이지 및 수치 실시간 갱신
    const hpEl = document.getElementById('player-hp-val');
    const hpBar = document.getElementById('player-hp-bar');
    if (hpEl && hpBar) {
        const hpPct = Math.max(0, Math.min(100, Math.round((playerFlight.health / (playerFlight.maxHealth || 100)) * 100)));
        hpEl.textContent = `${hpPct}%`;
        hpBar.style.width = `${hpPct}%`;
        if (hpPct > 50) {
            hpBar.style.backgroundColor = '#4df58a';
            hpEl.style.color = '#4df58a';
        } else if (hpPct > 25) {
            hpBar.style.backgroundColor = '#ffbb33';
            hpEl.style.color = '#ffbb33';
        } else {
            hpBar.style.backgroundColor = '#ff3344';
            hpEl.style.color = '#ff3344';
        }
    }

    // 카메라가 기체 전방(정면)을 바라보고 있는지 확인 (피봇 회전각 기준 시야 오차 산출)
    const lookAngle = gameState.cameraPivot ? Math.hypot(gameState.cameraPivot.rotation.y, gameState.cameraPivot.rotation.x) : 0;
    // 정면 뷰(오차 약 10도 이내)에서는 100% 선명, 시점을 옆이나 뒤로 돌리면(약 25도 이상) 자연스럽게 페이드아웃
    const forwardViewAlpha = THREE.MathUtils.clamp(1.0 - (lookAngle - 0.18) / 0.27, 0.0, 1.0);

    if (forwardViewAlpha > 0.01) {
        hudCtx.save();
        hudCtx.globalAlpha = forwardViewAlpha;

        // 1. Center Aircraft Gunsight Reticle
        hudCtx.beginPath();
        hudCtx.arc(cx, cy, 14, 0, Math.PI * 2);
        hudCtx.stroke();
        hudCtx.beginPath();
        hudCtx.moveTo(cx - 24, cy); hudCtx.lineTo(cx - 14, cy);
        hudCtx.moveTo(cx + 14, cy); hudCtx.lineTo(cx + 24, cy);
        hudCtx.moveTo(cx, cy - 24); hudCtx.lineTo(cx, cy - 14);
        hudCtx.stroke();

        // 2. Pitch Ladder (Horizons & Pitch Bars)
        hudCtx.save();
        hudCtx.translate(cx, cy);

        // 실제 비행기의 방향 벡터를 추출하여 완벽하게 정렬된 피치/롤 각도 계산
        const vForward = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
        const vUp = new THREE.Vector3(0, 1, 0).applyQuaternion(playerMesh.quaternion);
        const vRight = new THREE.Vector3(1, 0, 0).applyQuaternion(playerMesh.quaternion);

        const truePitch = Math.asin(vForward.y); // 양수 = 상승(Climb), 음수 = 하강(Dive)
        const roll = Math.atan2(vRight.y, vUp.y); // 비행기의 정확한 롤(Roll)

        // 기체가 롤링할 때 실제 지평선과 동일하게 유지하도록 캔버스 회전
        hudCtx.rotate(roll);

        const pitchPxPerRad = 450;
        // 기수가 하늘을 향하면(truePitch>0) 수평선이 스크린상 아래(Canvas +Y)로 내려감
        const pitchOffset = truePitch * pitchPxPerRad;
        const horizonY = pitchOffset;

        for (let deg = -40; deg <= 40; deg += 10) {
            const degInRad = deg * (Math.PI / 180);
            const y = horizonY - (degInRad * pitchPxPerRad);

            if (deg === 0) {
                // Horizon Line (가장 길고 두꺼운 수평선)
                hudCtx.lineWidth = 2.0;
                hudCtx.beginPath();
                hudCtx.moveTo(-180, y); hudCtx.lineTo(-40, y);
                hudCtx.moveTo(40, y); hudCtx.lineTo(180, y);
                hudCtx.stroke();
                hudCtx.lineWidth = 1.5;
            } else {
                if (Math.abs(y) < 220) {
                    hudCtx.beginPath();
                    if (deg > 0) {
                        // Climb ladder (solid lines, 상승)
                        hudCtx.moveTo(-50, y); hudCtx.lineTo(-20, y); hudCtx.lineTo(-20, y + 6);
                        hudCtx.moveTo(20, y + 6); hudCtx.lineTo(20, y); hudCtx.lineTo(50, y);
                    } else {
                        // Dive ladder (dashed lines, 하강)
                        hudCtx.setLineDash([4, 4]);
                        hudCtx.moveTo(-50, y); hudCtx.lineTo(-20, y); hudCtx.lineTo(-20, y - 6);
                        hudCtx.moveTo(20, y - 6); hudCtx.lineTo(20, y); hudCtx.lineTo(50, y);
                        hudCtx.setLineDash([]);
                    }
                    hudCtx.stroke();
                    hudCtx.fillText(Math.abs(deg).toString(), 56, y + 4);
                    hudCtx.fillText(Math.abs(deg).toString(), -74, y + 4);
                }
            }
        }
        hudCtx.restore();
        hudCtx.restore();
    }

    // 3. Flight Instrument Tapes
    const speedKts = Math.round(playerFlight.speed);
    const altFt = Math.round(playerMesh.position.y * 3.28);
    const throttlePct = Math.round(playerFlight.throttlePercent);

    // Left: Airspeed Indicator Box
    const speed = HUD_LAYOUT.speedBox;
    hudCtx.strokeRect(cx + speed.cxOffset, cy + speed.cyOffset, speed.w, speed.h);
    hudCtx.fillText("SPD KTS", cx + speed.cxOffset + 5, cy + speed.cyOffset + 17);
    hudCtx.font = '20px "Share Tech Mono", monospace';
    hudCtx.fillText(speedKts.toString().padStart(3, '0'), cx + speed.cxOffset + 15, cy + speed.cyOffset + 53);

    // Right: Altitude Indicator Box
    const alt = HUD_LAYOUT.altBox;
    hudCtx.font = '13px "Share Tech Mono", monospace';
    hudCtx.strokeRect(cx + alt.cxOffset, cy + alt.cyOffset, alt.w, alt.h);
    hudCtx.fillText("ALT FT", cx + alt.cxOffset + 10, cy + alt.cyOffset + 17);
    hudCtx.font = '20px "Share Tech Mono", monospace';
    hudCtx.fillText(altFt.toString().padStart(4, '0'), cx + alt.cxOffset + 7, cy + alt.cyOffset + 53);

    // Throttle indicator bottom bar
    const thr = HUD_LAYOUT.throttle;
    hudCtx.font = '13px "Share Tech Mono", monospace';
    hudCtx.strokeRect(cx + thr.cxOffset, cy + thr.cyOffset, thr.w, thr.h);
    const fillWidth = Math.max(0, Math.min(thr.w, (throttlePct / 100) * thr.w));
    hudCtx.fillStyle = playerFlight.isAfterburner ? '#ff7733' : '#4df58a';
    hudCtx.fillRect(cx + thr.cxOffset, cy + thr.cyOffset, fillWidth, thr.h);
    hudCtx.fillStyle = '#4df58a';
    hudCtx.fillText(`THR: ${throttlePct}% ${playerFlight.isAfterburner ? '[AB ON]' : ''} ${playerFlight.isAirbrake ? '[BRAKE]' : ''}`, cx + thr.cxOffset + 10, cy + thr.cyOffset + thr.h + 16);

    const currentLockedEnemy = enemies[gameState.lockedEnemyIndex]?.alive ? enemies[gameState.lockedEnemyIndex] : null;
    const targetInLockCone = !!currentLockedEnemy?.isLocked;
    let isCurrentTargetOnScreenCenter = false;

    // 사운드 비프음 처리 (락온된 적기가 하나라도 있으면 락온음 재생)
    const anyLocked = enemies.some(e => e.alive && e.isLocked);
    if (anyLocked) {
        audio.playLockBeep(true);
    } else if (currentLockedEnemy && currentLockedEnemy.dotForward > 0.65) {
        audio.playLockBeep(false);
    }

    // 3단계: 화면 투영 및 HUD 레티클 렌더링
    enemies.forEach((enemy, idx) => {
        if (!enemy.alive) return;

        const isCurrentTarget = (idx === gameState.lockedEnemyIndex);
        const enemyPos = enemy.mesh.position.clone();
        const distToPlayer = enemy.distToPlayer;
        const screenPos = enemyPos.clone().project(camera);

        // Is enemy in front of the camera
        if (screenPos.z < 1.0) {
            const sx = (screenPos.x * 0.5 + 0.5) * w;
            const sy = (-(screenPos.y * 0.5) + 0.5) * h;
            const distFromCenter = Math.hypot(sx - cx, sy - cy);

            if (isCurrentTarget && distFromCenter < 110) {
                isCurrentTargetOnScreenCenter = true;
            }

            if (enemy.isLocked) {
                // 락온 박스 (펄싱 효과 & 굵은 라인)
                const pulse = Math.sin(performance.now() * 0.02) * 4;
                if (isCurrentTarget) {
                    hudCtx.strokeStyle = '#ff3344';
                    hudCtx.fillStyle = '#ff3344';
                    hudCtx.lineWidth = 3.8; // 굵고 강렬한 락온 사각형
                    hudCtx.strokeRect(sx - 26 - pulse, sy - 26 - pulse, 52 + pulse * 2, 52 + pulse * 2);
                    hudCtx.font = 'bold 14px "Share Tech Mono", monospace';
                    hudCtx.fillText("LOCK", sx - 16, sy - 34);
                } else {
                    // 멀티 락온 서브 타깃
                    hudCtx.strokeStyle = '#ff7733';
                    hudCtx.fillStyle = '#ff7733';
                    hudCtx.lineWidth = 3.0; // 멀티 락온 사각형 굵기 상향
                    hudCtx.strokeRect(sx - 22 - pulse, sy - 22 - pulse, 44 + pulse * 2, 44 + pulse * 2);
                    hudCtx.font = 'bold 12px "Share Tech Mono", monospace';
                    hudCtx.fillText("MULTI", sx - 18, sy - 28);
                }

                // Target Info Tags & Health Bar
                hudCtx.font = 'bold 13px "Share Tech Mono", monospace';
                hudCtx.fillText(`${enemy.callsign} [${distToPlayer}m]`, sx + 32, sy - 6);
                hudCtx.lineWidth = 1.8;
                hudCtx.strokeRect(sx + 32, sy + 2, 60, 6);
                hudCtx.fillRect(sx + 32, sy + 2, Math.max(0, (enemy.health / (enemy.maxHealth || 100)) * 60), 6);

            } else if (isCurrentTarget) {
                // 현재 타깃이지만 전투기 전방 콘 밖이라 미락온 상태 (굵고 선명한 초록 다이아몬드)
                hudCtx.strokeStyle = '#4df58a';
                hudCtx.fillStyle = '#4df58a';
                hudCtx.lineWidth = 3.5; // 다이아몬드 선 굵기 대폭 상향

                hudCtx.beginPath();
                hudCtx.moveTo(sx, sy - 24);
                hudCtx.lineTo(sx + 24, sy);
                hudCtx.lineTo(sx, sy + 24);
                hudCtx.lineTo(sx - 24, sy);
                hudCtx.closePath();
                hudCtx.stroke();

                hudCtx.font = 'bold 13px "Share Tech Mono", monospace';
                hudCtx.fillText(`${enemy.callsign} [${distToPlayer}m]`, sx + 32, sy - 6);
                hudCtx.lineWidth = 1.8;
                hudCtx.strokeRect(sx + 32, sy + 2, 60, 6);
                hudCtx.fillRect(sx + 32, sy + 2, Math.max(0, (enemy.health / (enemy.maxHealth || 100)) * 60), 6);

            } else {
                // Unfocused Enemy Marker (선명한 코너 브래킷)
                hudCtx.strokeStyle = enemy.isGround ? 'rgba(255, 175, 60, 0.75)' : 'rgba(77, 245, 138, 0.65)';
                hudCtx.lineWidth = 2.4; // 일반 적기 마커 선 두께 상향
                hudCtx.strokeRect(sx - 14, sy - 14, 28, 28);
            }
        }
    });

    // 4.4 Gun Boresight Reticle System
    // ─── 구조 ─────────────────────────────────────────────────────────────────
    // [보어사이트 원] = 기수가 향하는 방향을 원형 레티클로 표시
    //   내부 아크 게이지 = 적까지 잔여 거리 비율
    //   SHOOT 조건 = 보어사이트 원이 탄착 예측점(predictedInterceptPos)과
    //                일정 픽셀 이내로 정렬될 때 (판정 넉넉)
    // ──────────────────────────────────────────────────────────────────────────
    gameState.isGunAimOnTarget = false;
    gameState.currentGunLeadPredictedPos = null;

    const GUN_RANGE = BALANCE.weapons.player_cannon.lockRangeM;

    if (currentLockedEnemy && currentLockedEnemy.alive) {
        const pPos = playerMesh.position;
        const ePos = currentLockedEnemy.mesh.position;
        const gunTargetDist = pPos.distanceTo(ePos);

        // 기총 사거리 이내일 때만 UI 표시
        if (gunTargetDist <= GUN_RANGE) {
            const muzzleVel = 1600; // 20mm M61A2 탄속 m/s
            const flightTime = gunTargetDist / muzzleVel;

            // 적기 실제 이동 속도 벡터
            const eFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(currentLockedEnemy.mesh.quaternion);
            const speedMultiplier = (currentLockedEnemy.state === 'INTERCEPT') ? 0.65 : 0.50;
            const eSpeedMs = (currentLockedEnemy.speed || 340) * speedMultiplier;
            const eVel = eFwd.clone().multiplyScalar(eSpeedMs);

            // 탄착 미래 예측 지점
            const predictedInterceptPos = ePos.clone().addScaledVector(eVel, flightTime);
            gameState.currentGunLeadPredictedPos = predictedInterceptPos;

            // 예측 지점 화면 투영 (SHOOT 판정 기준점)
            const pipperProj = predictedInterceptPos.clone().project(camera);
            const ppX = (pipperProj.x * 0.5 + 0.5) * hudCanvas.width;
            const ppY = (-(pipperProj.y * 0.5) + 0.5) * hudCanvas.height;

            // ── 보어사이트: 기수 전방 200m 고정 투영 ─────────────────────────
            const playerFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(playerMesh.quaternion);
            const boresightWorld = pPos.clone().addScaledVector(playerFwd, 200);
            const boresightProj = boresightWorld.clone().project(camera);

            if (boresightProj.z < 1.0) {
                const bsX = (boresightProj.x * 0.5 + 0.5) * hudCanvas.width;
                const bsY = (-(boresightProj.y * 0.5) + 0.5) * hudCanvas.height;

                // ── SHOOT 판정: 보어사이트 원이 예측 탄착점 근처에 있는지 ──────
                // aimDistPx < shootThreshold 이면 맞는 각도 — 판정을 충분히 넉넉하게
                const aimDistPx = Math.hypot(bsX - ppX, bsY - ppY);
                const shootThreshold = 55; // 넉넉한 판정 반경 (px)
                const isAimAligned = (aimDistPx < shootThreshold && pipperProj.z < 1.0);
                gameState.isGunAimOnTarget = isAimAligned;

                hudCtx.save();

                // ── 보어사이트 원형 레티클 렌더링 ────────────────────────────
                const pipperRadius = 22;
                const mainColor = isAimAligned ? '#ff3344' : '#4df58a';
                hudCtx.strokeStyle = mainColor;
                hudCtx.fillStyle = mainColor;
                hudCtx.shadowBlur = isAimAligned ? 18 : 5;
                hudCtx.shadowColor = mainColor;

                // 외부 원형 링
                hudCtx.lineWidth = isAimAligned ? 3.2 : 2.0;
                hudCtx.beginPath();
                hudCtx.arc(bsX, bsY, pipperRadius, 0, Math.PI * 2);
                hudCtx.stroke();

                // 중앙 도트
                hudCtx.beginPath();
                hudCtx.arc(bsX, bsY, isAimAligned ? 3.5 : 2.5, 0, Math.PI * 2);
                hudCtx.fill();

                // 4방향 외곽 틱 마크
                const tickInner = pipperRadius + 3;
                const tickOuter = pipperRadius + 9;
                hudCtx.lineWidth = isAimAligned ? 2.5 : 1.8;
                hudCtx.beginPath();
                hudCtx.moveTo(bsX, bsY - tickInner); hudCtx.lineTo(bsX, bsY - tickOuter);
                hudCtx.moveTo(bsX, bsY + tickInner); hudCtx.lineTo(bsX, bsY + tickOuter);
                hudCtx.moveTo(bsX - tickInner, bsY); hudCtx.lineTo(bsX - tickOuter, bsY);
                hudCtx.moveTo(bsX + tickInner, bsY); hudCtx.lineTo(bsX + tickOuter, bsY);
                hudCtx.stroke();

                // 잔여 거리 아크 게이지 (GUN_RANGE 기준, 가까울수록 아크 채워짐)
                const rangeRatio = Math.max(0, Math.min(1, gunTargetDist / GUN_RANGE));
                hudCtx.lineWidth = 3.0;
                hudCtx.strokeStyle = isAimAligned ? 'rgba(255, 51, 68, 0.9)' : 'rgba(77, 245, 138, 0.75)';
                hudCtx.beginPath();
                hudCtx.arc(bsX, bsY, pipperRadius - 5,
                    -Math.PI * 0.5,
                    -Math.PI * 0.5 + Math.PI * 2 * (1 - rangeRatio));
                hudCtx.stroke();

                // ── SHOOT 경고 & 거리 텍스트 ─────────────────────────────────
                hudCtx.textAlign = 'center';
                if (isAimAligned) {
                    const blink = Math.floor(Date.now() / 140) % 2 === 0;
                    if (blink) {
                        hudCtx.fillStyle = '#ff2233';
                        hudCtx.font = 'bold 15px "Share Tech Mono", monospace';
                        hudCtx.shadowBlur = 20;
                        hudCtx.shadowColor = '#ff2233';
                        hudCtx.fillText('SHOOT', bsX, bsY - pipperRadius - 12);
                    }
                    hudCtx.shadowBlur = 0;
                    hudCtx.fillStyle = '#ff6677';
                    hudCtx.font = 'bold 11px "Share Tech Mono", monospace';
                    hudCtx.fillText(`GUN [${Math.round(gunTargetDist)}m]`, bsX, bsY + pipperRadius + 17);
                } else {
                    hudCtx.shadowBlur = 0;
                    hudCtx.fillStyle = '#4df58a';
                    hudCtx.font = 'bold 11px "Share Tech Mono", monospace';
                    hudCtx.fillText(`GUN ${Math.round(gunTargetDist)}m`, bsX, bsY + pipperRadius + 17);
                }

                hudCtx.restore();
            }
        }
    }

    // 4.5 Target Direction Locator Arrow (에이스컴뱃 스타일 타깃 방향 지시 화살표)
    if (currentLockedEnemy && !isCurrentTargetOnScreenCenter) {
        const localPos = currentLockedEnemy.mesh.position.clone();
        camera.worldToLocal(localPos); // 카메라 로컬 좌표계로 변환하여 상대적 위치 계산

        const dx = localPos.x;
        const dy = -localPos.y; // 캔버스 좌표계는 Y축이 아래를 향하므로 반전
        const angle = Math.atan2(dy, dx);

        const pointerRadius = 160; // 중앙 레티클 외곽 반경 설정

        hudCtx.save();
        hudCtx.translate(cx, cy);
        hudCtx.rotate(angle);

        // 락온 여부에 따른 화살표 색상 변경 (락온 시 붉은색, 아닐 시 녹색)
        hudCtx.fillStyle = targetInLockCone ? 'rgba(255, 51, 68, 0.95)' : 'rgba(77, 245, 138, 0.95)';
        hudCtx.shadowBlur = 10;
        hudCtx.shadowColor = hudCtx.fillStyle;

        // 갈매기(Chevron) 형태의 화살표 폴리곤 렌더링
        hudCtx.beginPath();
        hudCtx.moveTo(pointerRadius, 0);          // 끝점
        hudCtx.lineTo(pointerRadius - 18, -12);   // 상단 뒤
        hudCtx.lineTo(pointerRadius - 13, 0);     // 안쪽 오목한 부분
        hudCtx.lineTo(pointerRadius - 18, 12);    // 하단 뒤
        hudCtx.closePath();
        hudCtx.fill();

        hudCtx.restore();
    }

    // 5. Tactical Radar Minimap
    drawRadar(w, h, gameState.lockedEnemyIndex);
}
function drawRadar(w, h, lockedIdx) {
    const radar = HUD_LAYOUT.radar;
    const rx = radar.x;
    const ry = h - radar.yOffsetFromBottom;
    const radarSize = radar.r;

    hudCtx.save();

    // Radar background (Tactical circular sweep)
    hudCtx.beginPath();
    hudCtx.arc(rx, ry, radarSize, 0, Math.PI * 2);
    hudCtx.fillStyle = 'rgba(10, 25, 20, 0.65)';
    hudCtx.fill();
    hudCtx.strokeStyle = 'rgba(77, 245, 138, 0.45)';
    hudCtx.lineWidth = 1.2;
    hudCtx.stroke();

    // Range rings
    hudCtx.beginPath();
    hudCtx.arc(rx, ry, radarSize * 0.5, 0, Math.PI * 2);
    hudCtx.strokeStyle = 'rgba(77, 245, 138, 0.2)';
    hudCtx.stroke();

    // Compass labels (N, E, S, W)
    hudCtx.fillStyle = 'rgba(77, 245, 138, 0.9)';
    hudCtx.font = 'bold 11px "Share Tech Mono", monospace';
    hudCtx.textAlign = 'center';
    hudCtx.textBaseline = 'middle';
    const playerYaw = playerMesh.rotation.y;
    const dirs = [
        { t: 'N', x: 0, z: -1 },
        { t: 'E', x: 1, z: 0 },
        { t: 'S', x: 0, z: 1 },
        { t: 'W', x: -1, z: 0 }
    ];
    dirs.forEach(d => {
        const rotX = d.x * Math.cos(playerYaw) - d.z * Math.sin(playerYaw);
        const rotZ = d.x * Math.sin(playerYaw) + d.z * Math.cos(playerYaw);
        const mapX = rx + rotX * (radarSize - 9);
        const mapY = ry + rotZ * (radarSize - 9);
        hudCtx.fillText(d.t, mapX, mapY);
    });

    // Radar sweep line (회전하는 녹색 탐색선)
    const sweepAngle = (performance.now() * 0.002) % (Math.PI * 2);
    hudCtx.beginPath();
    hudCtx.moveTo(rx, ry);
    hudCtx.lineTo(rx + Math.cos(sweepAngle) * radarSize, ry + Math.sin(sweepAngle) * radarSize);
    hudCtx.strokeStyle = 'rgba(77, 245, 138, 0.35)';
    hudCtx.stroke();

    // Center ownship crosshair (내 전투기)
    hudCtx.fillStyle = '#4df58a';
    hudCtx.fillRect(rx - 1.5, ry - 5, 3, 10);
    hudCtx.fillRect(rx - 5, ry - 1.5, 10, 3);

    // Forward FOV cone (전투기 기수 전방 락온 콘 가이드 표시)
    hudCtx.beginPath();
    hudCtx.moveTo(rx, ry);
    hudCtx.lineTo(rx - 25, ry - radarSize);
    hudCtx.lineTo(rx + 25, ry - radarSize);
    hudCtx.closePath();
    hudCtx.fillStyle = 'rgba(77, 245, 138, 0.06)';
    hudCtx.fill();

    // Rotate relative to player heading
    const radarRange = 6000;
    const now = performance.now();

    enemies.forEach((enemy, idx) => {
        if (!enemy.alive) return;
        const relX = enemy.mesh.position.x - playerMesh.position.x;
        const relZ = enemy.mesh.position.z - playerMesh.position.z;

        // Rotate coordinates by player yaw
        const rotX = relX * Math.cos(playerYaw) - relZ * Math.sin(playerYaw);
        const rotZ = relX * Math.sin(playerYaw) + relZ * Math.cos(playerYaw);

        const mapX = rx + (rotX / radarRange) * radarSize;
        const mapY = ry + (rotZ / radarRange) * radarSize;

        // Clip to circle
        if (Math.hypot(mapX - rx, mapY - ry) < radarSize) {
            const isTarget = (idx === lockedIdx);
            const isGround = enemy.isGround;
            const isShip = enemy.isShip;

            if (isTarget) {
                // 타깃 적: 깜빡이는 외곽 링 + 마커
                const blink = (Math.sin(now * 0.008) + 1) * 0.5; // 0~1 깜빡임
                hudCtx.strokeStyle = `rgba(255, 255, 100, ${0.4 + blink * 0.6})`;
                hudCtx.lineWidth = 1.5;
                hudCtx.fillStyle = isGround ? (isShip ? '#ff9933' : '#ffaa33') : `rgba(255, ${Math.floor(blink * 80)}, ${Math.floor(blink * 40)}, 1)`;

                if (isShip && enemy.shipPart === 'HULL') {
                    // 전함 본체 타깃: 길쭉한 전함 심볼
                    hudCtx.save();
                    hudCtx.translate(mapX, mapY);
                    hudCtx.strokeRect(-9, -5, 18, 10);
                    hudCtx.fillRect(-7, -3, 14, 6);
                    hudCtx.restore();
                } else if (isGround) {
                    // 지상 적 / 함포 타깃: 사각 다이아몬드 (◇)
                    hudCtx.save();
                    hudCtx.translate(mapX, mapY);
                    hudCtx.rotate(Math.PI / 4);
                    hudCtx.strokeRect(-6, -6, 12, 12);
                    hudCtx.fillRect(-3.5, -3.5, 7, 7);
                    hudCtx.restore();
                } else {
                    // 공중 적기 타깃: 원형 링 + 원 (●)
                    hudCtx.beginPath();
                    hudCtx.arc(mapX, mapY, 7, 0, Math.PI * 2);
                    hudCtx.stroke();
                    hudCtx.beginPath();
                    hudCtx.arc(mapX, mapY, 4.5, 0, Math.PI * 2);
                    hudCtx.fill();
                }

                // TGT 레이블
                hudCtx.fillStyle = `rgba(255, 255, 100, ${0.6 + blink * 0.4})`;
                hudCtx.font = 'bold 8px monospace';
                hudCtx.textAlign = 'center';
                let tgtLabel = 'TGT';
                if (isShip) {
                    tgtLabel = (enemy.shipPart === 'HULL') ? 'TGT[SHIP]' : 'TGT[GUN]';
                } else if (isGround) {
                    tgtLabel = 'TGT[TANK]';
                }
                hudCtx.fillText(tgtLabel, mapX, mapY - 10);
            } else {
                // 일반 적
                if (isShip && enemy.shipPart === 'HULL') {
                    // 일반 전함 본체: 주황/청록 선체 마커
                    hudCtx.fillStyle = '#ff8822';
                    hudCtx.fillRect(mapX - 6, mapY - 3, 12, 6);
                } else if (isGround) {
                    // 일반 함포 또는 지상 탱크
                    hudCtx.fillStyle = isShip ? '#ffaa44' : '#ff8822';
                    hudCtx.save();
                    hudCtx.translate(mapX, mapY);
                    hudCtx.rotate(Math.PI / 4);
                    hudCtx.fillRect(-2.5, -2.5, 5, 5);
                    hudCtx.restore();
                } else {
                    // 일반 공중 적기: 빨간 점
                    hudCtx.fillStyle = '#ff3344';
                    hudCtx.beginPath();
                    hudCtx.arc(mapX, mapY, 3, 0, Math.PI * 2);
                    hudCtx.fill();
                }
            }
        }
    });

    hudCtx.restore();
}
