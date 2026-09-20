const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
    const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [], missing = new Set();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && /Simulation loop error|Render error/.test(m.text())) errors.push(m.text()); });
    page.on('requestfailed', r => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
    page.on('response', r => { if (r.status() >= 400) missing.add(new URL(r.url()).pathname); });
    try {
        await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8000', { waitUntil: 'load' });
        await page.waitForFunction(() => window.player && !document.querySelector('#btn-sortie').disabled);
        await page.evaluate(async () => {
            // Test-only module handles. Production code does not expose a debug API.
            window.testGame = {};
            for (const path of ['core/state','core/loop','core/scheduler','core/events','player/player','player/flight','input/state','combat/weapons','combat/targeting','combat/projectiles','enemies/fleet','enemies/lifecycle','game/missions','progression/runtime','progression/cards','progression/model','ui/menus']) { const module = await import(`/src/${path}.js`); for (const key of Object.keys(module)) Object.defineProperty(window.testGame, key, { configurable: true, get: () => module[key] }); }
        });
        await page.locator('#btn-open-options-start').click();
        await page.locator('label:has(#opt-pointer-lock)').click();
        await page.locator('#btn-close-options').click();
        await page.locator('#btn-sortie').click();
        await page.locator('#btn-start-selected-stage').click();
        await page.waitForFunction(() => window.player.position.z < 1200);
        assert.equal(await page.evaluate(() => testGame.enemies.filter(e => e.alive).length), 30);
        fs.mkdirSync('test-results', { recursive: true });
        await page.screenshot({ path: 'test-results/swarm.png' });

        // Standard missiles consume a 20-round magazine, then reload the whole magazine.
        const ammo = await page.evaluate(() => {
            const t = testGame, p = t.playerFlight;
            t.clearProjectiles();
            t.gameState.missileMode = 1;
            p.stdBursts = p.stdMaxBursts; p.stdReloadTimers = []; p.stdShotCooldown = 0;
            for (let shot = 0; shot < 20; shot++) { t.tryFireMissile(); p.stdShotCooldown = 0; }
            t.tryFireMissile();
            const result = { fired: t.missiles.length, ready: p.stdBursts, timers: p.stdReloadTimers.length };
            t.clearProjectiles();
            let shots = 0;
            for (let cycle = 0; cycle < 6; cycle++) {
                p.stdBursts = p.stdMaxBursts; p.stdReloadTimers = []; p.stdShotCooldown = 0;
                for (let shot = 0; shot < p.stdMaxBursts; shot++) { t.tryFireMissile(); p.stdShotCooldown = 0; }
                shots += t.missiles.length; t.clearProjectiles();
            }
            for (let i = 0; i < 200; i++) t.updatePlayerFlight(0.05);
            result.shots = shots; result.reloaded = p.stdBursts;
            return result;
        });
        assert.deepEqual(ammo, { fired: 20, ready: 0, timers: 1, shots: 120, reloaded: 20 });

        const awarded = await page.evaluate(() => {
            const t = testGame;
            const victims = t.enemies.filter(e => e.alive).slice(0, 10);
            victims[0].isLocked = true;
            t.fireMissile(victims[0]);
            const missile = t.missiles[t.missiles.length - 1];
            missile.mesh.position.copy(victims[0].mesh.position);
            t.updateProjectiles(0); // Actual missile impact awards the first kill's XP.
            victims.slice(1).forEach(t.killEnemy);
            const before = t.progression.xp;
            t.killEnemy(victims[0]);
            return { pending: t.progression.pending, level: t.progression.level, noDuplicate: before === t.progression.xp, paused: t.gameState.isGamePaused };
        });
        assert.equal(awarded.pending, 3); assert.equal(awarded.level, 4);
        assert.equal(awarded.noDuplicate, true); assert.equal(awarded.paused, false);
        await page.keyboard.press('x');
        assert.equal(await page.locator('#upgrade-modal').isVisible(), true);
        await page.screenshot({ path: 'test-results/cards.png' });
        const frozen = await page.evaluate(() => {
            const t = testGame;
            const snapshot = () => JSON.stringify({ pos: t.playerMesh.position.toArray(), enemy: t.enemies.find(e => e.alive).mesh.position.toArray(), reload: t.playerFlight.stdReloadTimers, ammo: t.playerFlight.stdBursts, missiles: t.missiles.length, health: t.playerFlight.health, wave: t.encounter.wave });
            let timerFired = false;
            t.scheduleCombat(0.1, () => { timerFired = true; });
            const before = snapshot();
            for (let i = 0; i < 60; i++) t.stepSimulation(1 / 60);
            t.tryFireMissile(); t.openOptionsMenu();
            return { same: before === snapshot(), timerFired, modal: t.gameState.activeModal };
        });
        assert.deepEqual(frozen, { same: true, timerFired: false, modal: 'cards' });
        await page.keyboard.press('Escape'); await page.keyboard.press('f'); await page.keyboard.press('x');
        assert.equal(await page.locator('#upgrade-modal').isVisible(), true);
        assert.equal(await page.locator('#options-modal').isVisible(), false);
        await page.locator('#upgrade-cards button').first().click();
        assert.equal(await page.evaluate(() => testGame.progression.pending), 2);
        assert.equal(await page.locator('#upgrade-modal').isVisible(), true);
        for (let i = 0; i < 2; i++) await page.locator('#upgrade-cards button').first().click();
        assert.equal(await page.locator('#upgrade-modal').isVisible(), false);
        assert.equal(await page.evaluate(() => testGame.gameState.isGamePaused), false);
        console.log('20-round whole-magazine reload, ammo >100, XP banking, mandatory multi-card selection, pause/input guards OK');

        // Defeat every actual spawned enemy across all configured waves in a synchronous test step.
        for (const stage of [1, 2, 3]) {
            const waveResult = await page.evaluate(() => {
                const t = testGame;
                let safety = 0;
                while (t.encounter.phase === 'waves' && safety++ < 20) {
                    for (const enemy of [...t.enemies]) if (enemy.alive) t.killEnemy(enemy);
                    t.updateMission(1.1);
                }
                return { phase: t.encounter.phase, wave: t.encounter.wave, boss: t.enemies.find(e => e.isBoss)?.health };
            });
            assert.equal(waveResult.phase, 'boss'); assert.equal(waveResult.wave, stage + 2); assert.ok(waveResult.boss >= 2200);
            await page.evaluate(() => {
                const t = testGame;
                t.killEnemy(t.enemies.find(e => e.isBoss));
                t.updateMission(0.016);
            });
            assert.equal(await page.locator('#hangar-modal').isVisible(), true);
            const build = await page.evaluate(() => ({ level: testGame.progression.level, pending: testGame.progression.pending, cards: { ...testGame.progression.cards }, ranks: { ...testGame.progression.ranks } }));
            assert.ok(build.pending > 0);
            if (stage === 1) {
                await page.screenshot({ path: 'test-results/hangar.png' });
                // Force maxed ranks to exercise the guaranteed fallback in the real UI.
                await page.evaluate(() => {
                    const t = testGame;
                    for (const card of t.CARDS) (card.stat ? t.progression.ranks : t.progression.cards)[card.id] = card.maxRank;
                    t.applyStats(t.playerFlight, t.calculateStats(t.progression));
                });
                await page.locator('#hangar-upgrade').click();
                await page.keyboard.press('Escape');
                assert.equal(await page.locator('#upgrade-modal').isVisible(), true);
                for (let i = 0; i < build.pending; i++) await page.locator('#upgrade-cards button').first().click();
                assert.equal(await page.locator('#hangar-modal').isVisible(), true);
                assert.equal(await page.evaluate(() => testGame.gameState.isGamePaused), true);
            }
            const beforeDepart = await page.evaluate(() => JSON.stringify(testGame.progression));
            await page.locator('#hangar-depart').click();
            if (stage < 3) {
                assert.equal(await page.evaluate(() => testGame.gameState.currentStageInfo.stage), stage + 1);
                assert.equal(await page.evaluate(() => JSON.stringify(testGame.progression)), beforeDepart);
                assert.equal(await page.evaluate(() => testGame.encounter.wave), 0);
            } else assert.match(await page.locator('#gameover-title').textContent(), /RUN COMPLETE/);
            console.log(`Stage ${stage}: ${stage + 2} waves, boss, hangar, build preservation/completion OK`);
        }
        await page.locator('#btn-restart').click();
        const reset = await page.evaluate(() => ({ level: testGame.progression.level, pending: testGame.progression.pending, maxHealth: testGame.playerFlight.maxHealth, std: testGame.playerFlight.stdMaxBursts, wave: testGame.encounter.wave }));
        assert.deepEqual(reset, { level: 1, pending: 0, maxHealth: 100, std: 20, wave: 0 });
        await page.evaluate(() => { testGame.playerFlight.health = 1; testGame.playerMesh.position.y = -100; testGame.stepSimulation(0.05); });
        assert.match(await page.locator('#gameover-title').textContent(), /SHOT DOWN/);
        await page.locator('#btn-main-menu').click();
        assert.equal(await page.locator('#start-modal').isVisible(), true);
        assert.deepEqual(errors, []);
        console.log('New run reset, defeat, menu OK');
        console.log('Missing assets (legacy FBX references):', [...missing]);
        console.log('Browser smoke test passed.');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
