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

server.listen(8099, '127.0.0.1', async () => {
    console.log('Server started on 8099');
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-sandbox',
        'http://127.0.0.1:8099/index.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const res = await fetch('http://127.0.0.1:9222/json');
        const list = await res.json();
        const page = list.find(item => item.url.includes('8099'));
        console.log('Page target:', page ? page.title : 'None');

        if (page && page.webSocketDebuggerUrl) {
            const ws = new WebSocket(page.webSocketDebuggerUrl);
            ws.onopen = () => {
                ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
                ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
                
                // Click Sortie button after 1 sec
                setTimeout(() => {
                    console.log('Clicking SORTIE...');
                    ws.send(JSON.stringify({
                        id: 10,
                        method: 'Runtime.evaluate',
                        params: { expression: 'document.getElementById("btn-sortie").click()' }
                    }));
                }, 1000);

                // Click ENGAGE MISSION after 1.5 sec
                setTimeout(() => {
                    console.log('Clicking ENGAGE MISSION...');
                    ws.send(JSON.stringify({
                        id: 11,
                        method: 'Runtime.evaluate',
                        params: { expression: 'document.getElementById("btn-start-selected-stage").click()' }
                    }));
                }, 1500);

                // Check game running state after 2.5 sec
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        id: 12,
                        method: 'Runtime.evaluate',
                        params: { expression: 'JSON.stringify({ running: window.player ? true : false, pos: window.player ? window.player.position : null })' }
                    }));
                }, 2500);
            };
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                if (msg.method === 'Runtime.exceptionThrown') {
                    console.error('[PAGE EXCEPTION]:', JSON.stringify(msg.params.exceptionDetails, null, 2));
                } else if (msg.method === 'Runtime.consoleAPICalled') {
                    console.log('[PAGE CONSOLE]:', msg.params.type, msg.params.args.map(a => a.value || a.description));
                } else if (msg.id === 12) {
                    console.log('[GAME STATE RESULT]:', msg.result);
                }
            };
        }
    } catch (e) {
        console.error('CDP connect error:', e.message);
    }

    setTimeout(() => {
        edge.kill();
        server.close();
        process.exit(0);
    }, 6000);
});
