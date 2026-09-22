// Run against `node tools/serve.js`: node tools/sortie-smoke.cjs
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error' && /Simulation loop error|Render error/.test(message.text())) {
                errors.push(message.text());
            }
        });
        await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
        await page.waitForFunction(() => window.player && document.querySelector('#btn-sortie').style.pointerEvents !== 'none');
        await page.evaluate(() => {
            document.querySelector('#btn-sortie').click();
            document.querySelector('#btn-start-selected-stage').click();
        });
        for (const stageId of [1, 2, 3]) {
            const state = await page.evaluate(async stageId => {
                const mission = await import('/src/game/missions.js');
                const { stepSimulation } = await import('/src/core/loop.js');
                const { gameState } = await import('/src/core/state.js');
                const { camera, hudCanvas, hudCtx } = await import('/src/rendering/scene.js');
                const { enemies } = await import('/src/enemies/fleet.js');
                const { playerMesh } = await import('/src/player/player.js');
                if (stageId !== 1) mission.launchStage(stageId);
                const before = playerMesh.position.z;
                for (let i = 0; i < 120; i++) stepSimulation(1 / 60);
                return {
                    phase: mission.encounter.phase,
                    enemies: enemies.filter(enemy => enemy.alive).length,
                    expected: Math.min(mission.encounter.stage.maxActive, mission.encounter.stage.waves[0]),
                    cameraZ: camera.position.z,
                    hud: [hudCanvas.width, hudCanvas.height],
                    hudPainted: hudCtx.getImageData(0, 0, hudCanvas.width, hudCanvas.height).data.some((v, i) => i % 4 === 3 && v > 0),
                    moved: playerMesh.position.z < before,
                    exhaustUpdated: gameState.jetExhaustSystem.particles.some(p => p.active && p.life > 0),
                };
            }, stageId);
            assert.equal(state.phase, 'waves');
            assert.equal(state.enemies, state.expected);
            assert.ok(Math.abs(state.cameraZ - 9.375) < 0.001);
            assert.deepEqual(state.hud, [1280, 800]);
            assert.ok(state.hudPainted && state.moved && state.exhaustUpdated);
            if (stageId === 1) {
                mkdirSync('test-results', { recursive: true });
                await page.screenshot({ path: 'test-results/sortie-fixed.png' });
            }
            const transition = await page.evaluate(async () => {
                const mission = await import('/src/game/missions.js');
                const { enemies } = await import('/src/enemies/fleet.js');
                const { killEnemy } = await import('/src/enemies/lifecycle.js');
                const dismissCards = () => {
                    for (let i = 0; i < 100 && !document.querySelector('#upgrade-modal').hidden; i++) {
                        document.querySelector('#upgrade-cards button').click();
                    }
                };
                let batches = 0;
                while (mission.encounter.phase === 'waves' && batches++ < 30) {
                    for (const enemy of [...enemies]) if (enemy.alive) killEnemy(enemy);
                    mission.updateMission(2);
                    dismissCards();
                }
                const boss = enemies.find(enemy => enemy.isBoss && enemy.alive);
                const bossReached = mission.encounter.phase === 'boss' && !!boss;
                if (boss) killEnemy(boss);
                mission.updateMission(1 / 60);
                return { bossReached, phase: mission.encounter.phase, hangarVisible: !document.querySelector('#hangar-modal').hidden };
            });
            assert.equal(transition.bossReached, true);
            assert.equal(transition.phase, 'hangar');
            assert.equal(transition.hangarVisible, true);
            console.log(`Stage ${stageId}: sortie, camera, HUD, exhaust, all waves, boss and hangar OK`);
        }
        assert.deepEqual(errors, []);
        console.log('Sortie browser regression passed without simulation/render errors.');
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
