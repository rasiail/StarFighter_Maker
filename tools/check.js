import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = resolve(dir, entry.name);
        return entry.isDirectory() ? files(file) : file.endsWith('.js') ? [file] : [];
    });
}
const modules = files('src');
for (const file of [...modules, ...files('tools'), ...files('tests')]) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
}
// Linking every module also validates named imports and exports. Imports must not
// touch the DOM, WebGL or audio until main.js explicitly initializes the game.
for (const file of modules.filter(file => !file.endsWith('main.js'))) {
    await import(pathToFileURL(file));
}
const html = readFileSync('index.html', 'utf8');
if (/<script\s*>/.test(html) || /<style>/.test(html)) throw new Error('Inline game code returned to index.html');
console.log(`Syntax, module linking and side-effect-free imports OK (${modules.length} modules).`);
