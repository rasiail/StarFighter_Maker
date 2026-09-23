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

server.listen(8102, '127.0.0.1', async () => {
    console.log('Server running on http://127.0.0.1:8102');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--disable-gpu',
        '--remote-debugging-port=9224',
        'http://127.0.0.1:8102/index.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9224/json');
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

        const result = await send('Runtime.evaluate', {
            expression: `(async () => {
                const missions = await import('./src/game/missions.js');
                const { enemies } = await import('./src/enemies/fleet.js');
                const { killEnemy } = await import('./src/enemies/lifecycle.js');

                // Launch stage 1
                missions.launchStage(1);

                const requiredWave1 = missions.encounter.stage.waves[0]; // 10
                const initialEnemies = enemies.filter(e => e.alive).length;
                console.log('Wave 1 required kills:', requiredWave1, 'Initial field enemies:', initialEnemies);

                // Initial enemies should be ceil(10 * 1.5) = 15 (or slightly more if ship multi-target)
                if (initialEnemies < 15) {
                    return { error: 'Expected at least 15 initial enemies for 10 required kills, got ' + initialEnemies };
                }

                // Kill 5 enemies
                const toKill5 = enemies.filter(e => e.alive).slice(0, 5);
                for (const e of toKill5) {
                    killEnemy(e);
                }

                // Check kills and remaining
                const killsAfter5 = missions.encounter.kills;
                const remainingAfter5 = requiredWave1 - killsAfter5; // 5
                const activeAfter5 = enemies.filter(e => e.alive).length;
                console.log('After 5 kills, remaining needed:', remainingAfter5, 'Active enemies:', activeAfter5);

                // Target active should be ceil(5 * 1.5) = 8
                if (activeAfter5 < 8) {
                    return { error: 'Expected at least 8 active enemies after 5 kills, got ' + activeAfter5 };
                }

                // Kill until 1 kill remaining
                while (missions.encounter.kills < requiredWave1 - 1) {
                    const target = enemies.find(e => e.alive);
                    if (!target) break;
                    killEnemy(target);
                }

                const remainingAt1 = requiredWave1 - missions.encounter.kills;
                const activeAt1 = enemies.filter(e => e.alive).length;
                console.log('With 1 kill remaining, active enemies:', activeAt1);

                // With 1 kill remaining, active enemies should be ceil(1 * 1.5) = 2 (or more)
                if (activeAt1 < 2) {
                    return { error: 'Expected at least 2 enemies with 1 kill remaining, got ' + activeAt1 };
                }

                // Now kill the last required enemy to finish wave 1
                const finalTarget = enemies.find(e => e.alive);
                killEnemy(finalTarget);
                missions.updateMission(0.016);

                console.log('After completing wave 1, encounter wave is now:', missions.encounter.wave);

                if (missions.encounter.wave !== 1) {
                    return { error: 'Encounter should have advanced to wave 1 (index 1), got ' + missions.encounter.wave };
                }

                const wave2Active = enemies.filter(e => e.alive).length;
                const requiredWave2 = missions.encounter.stage.waves[1]; // 16
                console.log('Wave 2 required kills:', requiredWave2, 'Wave 2 active enemies:', wave2Active);

                if (wave2Active < Math.ceil(requiredWave2 * 1.5)) {
                    return { error: 'Expected wave 2 enemies to be at least ' + Math.ceil(requiredWave2 * 1.5) + ', got ' + wave2Active };
                }

                return {
                    success: true,
                    initialEnemies,
                    activeAfter5,
                    activeAt1,
                    wave2Active
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
