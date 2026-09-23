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

server.listen(8105, '127.0.0.1', async () => {
    console.log('Server running on http://127.0.0.1:8105');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--disable-gpu',
        '--remote-debugging-port=9227',
        'http://127.0.0.1:8105/index.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9227/json');
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

        await new Promise(r => ws.addEventListener('open', r, { once: true }));
        await send('Runtime.enable');
        await send('Page.enable');

        const evalExpr = async (expression) => {
            const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
            if (res.exceptionDetails) {
                console.error('Eval Exception:', res.exceptionDetails);
                throw new Error(res.exceptionDetails.text);
            }
            return res.result?.value;
        };

        // Wait for player ready
        console.log('Waiting for game ready...');
        for (let i = 0; i < 30; i++) {
            const ready = await evalExpr(`Boolean(window.player && document.querySelector('#btn-sortie')?.style.pointerEvents !== 'none')`);
            if (ready) break;
            await new Promise(r => setTimeout(r, 200));
        }

        // Click sortie and start stage
        console.log('Launching stage 1...');
        await evalExpr(`
            document.querySelector('#btn-sortie').click();
            document.querySelector('#btn-start-selected-stage').click();
        `);

        await new Promise(r => setTimeout(r, 1000));

        // Inspect spawned aircraft altitudes and behavior
        const initialStatus = await evalExpr(`(() => {
            const { enemies } = window.__test_fleet || {};
            // Let's import fleet directly
            return import('./src/enemies/fleet.js').then(fleet => {
                const airEnemies = fleet.enemies.filter(e => !e.isGround && e.alive);
                return {
                    count: airEnemies.length,
                    altitudes: airEnemies.map(e => Math.round(e.mesh.position.y)),
                    offsets: airEnemies.map(e => Math.round(e.altitudeOffset || 0)),
                    minAlt: Math.min(...airEnemies.map(e => e.mesh.position.y)),
                    maxAlt: Math.max(...airEnemies.map(e => e.mesh.position.y)),
                };
            });
        })()`);

        console.log('Initial Aircraft Status:', initialStatus);

        // Step simulation for 300 frames (~5 seconds of flight)
        console.log('Stepping simulation for 300 frames (5 seconds)...');
        const flightResult = await evalExpr(`(async () => {
            const { stepSimulation } = await import('./src/core/loop.js');
            const { enemies } = await import('./src/enemies/fleet.js');
            const { playerMesh } = await import('./src/player/player.js');

            for (let f = 0; f < 300; f++) {
                stepSimulation(1 / 60);
            }

            const airEnemies = enemies.filter(e => !e.isGround && e.alive);
            return {
                playerY: Math.round(playerMesh.position.y),
                airCount: airEnemies.length,
                altitudes: airEnemies.map(e => Math.round(e.mesh.position.y)),
                minAlt: Math.min(...airEnemies.map(e => e.mesh.position.y)),
                maxAlt: Math.max(...airEnemies.map(e => e.mesh.position.y)),
                states: airEnemies.map(e => e.state),
                allBelowCeiling: airEnemies.every(e => e.mesh.position.y <= 1650),
            };
        })()`);

        console.log('Flight Result after 5s:', flightResult);

        ws.close();
        edge.kill();
        server.close();

        if (initialStatus.maxAlt <= 1650 && flightResult.allBelowCeiling && (flightResult.maxAlt - flightResult.minAlt > 300)) {
            console.log('TEST PASSED! Air enemies have diverse altitudes within the 1650m ceiling.');
            process.exit(0);
        } else {
            console.error('TEST FAILED: Conditions not met.', { initialStatus, flightResult });
            process.exit(1);
        }
    } catch (err) {
        console.error('Error during test:', err);
        edge.kill();
        server.close();
        process.exit(1);
    }
});
