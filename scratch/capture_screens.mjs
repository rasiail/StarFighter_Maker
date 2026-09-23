import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
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
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--window-size=1280,720',
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

        if (page && page.webSocketDebuggerUrl) {
            const ws = new WebSocket(page.webSocketDebuggerUrl);
            ws.onopen = () => {
                ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
                
                // Screenshot 1: initial screen after 1.5s
                setTimeout(() => {
                    ws.send(JSON.stringify({ id: 100, method: 'Page.captureScreenshot' }));
                }, 1500);

                // Click Sortie & Engage mission
                setTimeout(() => {
                    ws.send(JSON.stringify({ id: 10, method: 'Runtime.evaluate', params: { expression: 'document.getElementById("btn-sortie").click()' } }));
                }, 2000);
                setTimeout(() => {
                    ws.send(JSON.stringify({ id: 11, method: 'Runtime.evaluate', params: { expression: 'document.getElementById("btn-start-selected-stage").click()' } }));
                }, 2500);

                // Screenshot 2: gameplay screen after 3.5s
                setTimeout(() => {
                    ws.send(JSON.stringify({ id: 200, method: 'Page.captureScreenshot' }));
                }, 3500);
            };
            ws.onmessage = async (event) => {
                const msg = JSON.parse(event.data);
                if (msg.id === 100 && msg.result?.data) {
                    await writeFile(resolve(root, 'scratch/screen1_initial.png'), Buffer.from(msg.result.data, 'base64'));
                    console.log('Saved screen1_initial.png');
                }
                if (msg.id === 200 && msg.result?.data) {
                    await writeFile(resolve(root, 'scratch/screen2_gameplay.png'), Buffer.from(msg.result.data, 'base64'));
                    console.log('Saved screen2_gameplay.png');
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
    }, 5500);
});
