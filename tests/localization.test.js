import test from 'node:test';
import assert from 'node:assert/strict';
import { gameState } from '../src/core/state.js';
import { t } from '../src/ui/i18n.js';
import { createSaveStore, sanitizeSave } from '../src/core/local-save.js';
import { CARDS, REPAIR_CARD } from '../src/progression/cards.js';
import { createProgression } from '../src/progression/model.js';
import { createUpgradePreview } from '../src/ui/upgrade-preview.js';

test('English covers every upgrade name, description, and statistic; switching back restores Korean', () => {
    const build = createProgression();
    try {
        gameState.language = 'en';
        for (const card of [...CARDS, REPAIR_CARD]) {
            assert.doesNotMatch(t(card.name), /[가-힣]/);
            assert.doesNotMatch(JSON.stringify(createUpgradePreview(build, card)), /[가-힣]/);
        }
        gameState.language = 'ko';
        assert.equal(t('기동력'), '기동력');
        assert.match(createUpgradePreview(build, CARDS[0]).description, /[가-힣]/);
    } finally { gameState.language = 'ko'; }
});

test('first-run choices persist and old or invalid saves require setup without losing progress', () => {
    let value = null;
    const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
    const store = createSaveStore(storage);
    assert.equal(store.data.options.setupComplete, false);
    store.saveOptions({ ...store.data.options, language: 'en', controlScheme: 'casual', setupComplete: true });
    assert.deepEqual(createSaveStore(storage).data.options, store.data.options);
    const old = sanitizeSave({ version: 1, options: { language: 'invalid' }, progress: { bestScore: 100 } });
    assert.equal(old.options.language, 'ko');
    assert.equal(old.options.setupComplete, false);
    assert.equal(old.progress.bestScore, 100);
});
