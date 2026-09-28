import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createSaveStore, sanitizeSave, SAVE_KEY } from '../src/core/local-save.js';

function storage() {
    const items = new Map();
    return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
}

test('options and completed-stage records survive reopening; best score never decreases', () => {
    const backend = storage(), first = createSaveStore(backend);
    first.saveOptions({ ...first.data.options, controlScheme: 'casual', bgmVolume: 0.23, isPointerLockEnabled: false });
    first.selectStage(2);
    first.recordResult(1, 12000, true);
    first.recordResult(1, 300, true);
    first.recordResult(2, 200, false);
    const next = createSaveStore(backend);
    assert.equal(next.data.options.controlScheme, 'casual');
    assert.equal(next.data.options.bgmVolume, 0.23);
    assert.equal(next.data.options.isPointerLockEnabled, false);
    assert.deepEqual(next.data.progress, { selectedStage: 2, clearedStages: [1], bestScore: 12000 });
    assert.equal('cards' in next.data, false, 'run upgrades do not become permanent');
});

test('missing/corrupted saves, invalid fields and blocked storage cannot prevent playing', () => {
    const backend = storage(); backend.setItem(SAVE_KEY, '{broken');
    assert.equal(createSaveStore(backend).data.progress.bestScore, 0);
    const cleaned = sanitizeSave({ version: 1, options: { bgmVolume: 4, sfxVolume: 'bad', controlScheme: 'unknown', retroFilterEnabled: 'false' },
        progress: { selectedStage: -1, bestScore: -1, clearedStages: [1, 1, 999] } });
    assert.equal(cleaned.options.bgmVolume, 1);
    assert.equal(cleaned.options.sfxVolume, 0.8);
    assert.equal(cleaned.options.retroFilterEnabled, true);
    assert.deepEqual(cleaned.progress, { selectedStage: 1, bestScore: 0, clearedStages: [1] });
    const blocked = createSaveStore({ getItem() { throw Error(); }, setItem() { throw Error(); }, removeItem() { throw Error(); } });
    assert.equal(blocked.available, false);
    assert.equal(blocked.recordResult(1, 100, true), false);
    assert.equal(blocked.available, false);
    assert.equal(blocked.reset(), false);
});

test('reset removes only this game save and restores defaults on next load', () => {
    const backend = storage(); backend.setItem('other-app', 'keep');
    const store = createSaveStore(backend); store.recordResult(2, 500, true);
    assert.equal(store.reset(), true);
    assert.equal(backend.getItem(SAVE_KEY), null);
    assert.equal(backend.getItem('other-app'), 'keep');
    assert.deepEqual(createSaveStore(backend).data.progress, { selectedStage: 1, clearedStages: [], bestScore: 0 });
});

test('options reset requires confirmation; cancel and storage failure never reload', () => {
    const source = readFileSync(new URL('../src/ui/menus.js', import.meta.url), 'utf8');
    const start = source.indexOf("    document.getElementById('btn-reset-save')?.addEventListener");
    const end = source.indexOf('\n    });', start) + '\n    });'.length;
    for (const [confirm, succeeds, resets, reloads] of [[false, true, 0, 0], [true, false, 1, 0], [true, true, 1, 1]]) {
        let handler, resetCount = 0, reloadCount = 0;
        const status = {};
        vm.runInNewContext(source.slice(start, end), {
            document: { getElementById: id => id === 'btn-reset-save' ? { addEventListener: (_, fn) => { handler = fn; } } : status },
            window: { confirm: () => confirm, location: { reload: () => { reloadCount++; } } },
            localSave: { reset: () => { resetCount++; return succeeds; } },
        });
        handler();
        assert.equal(resetCount, resets); assert.equal(reloadCount, reloads);
        if (confirm && !succeeds) assert.match(status.textContent, /초기화하지 못/);
    }
});
