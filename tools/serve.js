import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const port = Number(process.env.PORT || 8000);
const openBrowser = process.argv.includes('--open');
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
        console.log('404:', req.url); res.writeHead(404).end('Not found');
    }
});
server.on('error', error => {
    if (openBrowser && error.code === 'EADDRINUSE') {
        // A server on this port may belong to a different checkout.
        server.listen(0, '127.0.0.1');
        return;
    }
    console.error(`Unable to start StarFighter: ${error.message}`);
    process.exitCode = 1;
});
server.on('listening', () => {
    const url = `http://127.0.0.1:${server.address().port}/index.html`;
    console.log(`StarFighter: ${url}`);
    console.log(`Project: ${root}`);
    if (openBrowser) {
        // Open only after the server is ready, using its actual bound port.
        const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
        const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
        child.on('error', error => console.error(`Open ${url} manually: ${error.message}`));
        child.unref();
    }
});
server.listen(port, '127.0.0.1');
