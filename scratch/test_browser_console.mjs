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

server.listen(8099, '127.0.0.1', () => {
    console.log('Test server listening on 8099');
    
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless',
        '--disable-gpu',
        '--enable-logging=stderr',
        '--v=1',
        'http://127.0.0.1:8099/index.html'
    ]);

    edge.stderr.on('data', data => {
        console.log('[BROWSER LOG]:', data.toString());
    });

    setTimeout(() => {
        edge.kill();
        server.close();
        process.exit(0);
    }, 5000);
});
