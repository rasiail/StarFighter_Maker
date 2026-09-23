import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg' };

const server = createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root + sep)) {
            res.writeHead(403).end();
            return;
        }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
    } catch {
        res.writeHead(404).end('Not found');
    }
});

server.listen(8101, '127.0.0.1', async () => {
    console.log('Server running on http://127.0.0.1:8101');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--disable-gpu',
        '--remote-debugging-port=9223',
        'http://127.0.0.1:8101/index.html'
    ]);

    // Wait for Chrome remote debugging endpoint
    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9223/json');
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');
        if (!page || !page.webSocketDebuggerUrl) {
            console.error('No debugger page found:', list);
            process.exit(1);
        }

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        let idCounter = 1;
        const send = (method, params = {}) => new Promise((res, rej) => {
            const id = idCounter++;
            const handler = (evt) => {
                const msg = JSON.parse(evt.data);
                if (msg.id === id) {
                    ws.removeEventListener('message', handler);
                    if (msg.error) rej(msg.error);
                    else res(msg.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });

        await new Promise(r => ws.onopen = r);
        console.log('Connected to CDP WebSocket');

        await send('Runtime.enable');

        // Evaluate script in browser
        const result = await send('Runtime.evaluate', {
            expression: `(async () => {
                const { gameState } = await import('./src/core/state.js');
                const { scene, camera } = await import('./src/rendering/scene.js');
                const { activeDyingBosses, killEnemy, updateDyingBosses } = await import('./src/enemies/lifecycle.js');
                const { spawnBoss } = await import('./src/enemies/fleet.js');
                const { getStage } = await import('./src/config/stages.js');
                const { updateCamera, resetCamera } = await import('./src/camera/camera.js');
                const { openUpgrades } = await import('./src/ui/upgrades.js');
                const { progression } = await import('./src/progression/runtime.js');
                const missions = await import('./src/game/missions.js');

                // Launch stage 1 directly
                missions.launchStage(1);

                // Force encounter to boss phase
                missions.encounter.phase = 'boss';
                const boss = spawnBoss(missions.encounter.stage);

                const hangarModal = document.getElementById('hangar-modal');
                const upgradeModal = document.getElementById('upgrade-modal');
                if (!hangarModal.hidden) return { error: 'hangar modal should be hidden during boss fight' };

                // Kill the boss
                killEnemy(boss);

                if (!gameState.bossDyingSequence) return { error: 'bossDyingSequence should be true after killing boss' };
                if (activeDyingBosses.length !== 1) return { error: 'activeDyingBosses should have 1 entry' };

                // During 5s dying sequence:
                // Run mission update and camera update for 3 seconds
                for (let t = 0; t < 3.0; t += 0.1) {
                    updateDyingBosses(0.1);
                    missions.updateMission(0.1);
                    updateCamera(0.1);
                }

                // Verify that halfway through, neither hangar nor upgrade modal has appeared
                if (!hangarModal.hidden) return { error: 'hangar modal appeared prematurely during 5s boss explosion sequence!' };
                if (!upgradeModal.hidden) return { error: 'upgrade modal appeared prematurely during 5s boss explosion sequence!' };
                if (camera.parent !== scene) return { error: 'camera should remain attached to scene during boss explosion' };

                // Finish remaining 2.2 seconds of sequence
                for (let t = 0; t < 2.2; t += 0.1) {
                    updateDyingBosses(0.1);
                    missions.updateMission(0.1);
                    updateCamera(0.1);
                }

                // Now the 5s sequence is complete!
                if (gameState.bossDyingSequence) return { error: 'bossDyingSequence should be false after 5s' };
                if (activeDyingBosses.length !== 0) return { error: 'activeDyingBosses should be empty after 5s' };

                // Advance mission frame to enter hangar
                missions.updateMission(0.016);

                if (gameState.phase !== 'hangar') return { error: 'gameState.phase should be hangar after sequence, got: ' + gameState.phase };
                if (hangarModal.hidden) return { error: 'hangar modal should now be visible after 5s sequence completes' };

                return {
                    success: true,
                    phase: gameState.phase,
                    hangarVisible: !hangarModal.hidden
                };
            })()`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log('Evaluation Result:', JSON.stringify(result, null, 2));

        ws.close();
    } catch (err) {
        console.error('CDP test error:', err);
    } finally {
        edge.kill();
        server.close();
        process.exit(0);
    }
});
