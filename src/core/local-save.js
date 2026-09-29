import { gameState } from './state.js';
import { audio } from '../audio/audio.js';
import { STAGES } from '../config/stages.js';

export const SAVE_KEY = 'starfighter.vertical-slice.save.v1';
const DEFAULT_OPTIONS = Object.freeze({ retroFilterEnabled: true, isPointerLockEnabled: true,
    language: 'ko', setupComplete: false, controlScheme: 'standard', targetFollowEnabled: true, isSmartGunEnabled: true, bgmVolume: 0.6, sfxVolume: 0.8 });
const defaults = () => ({ version: 1, options: { ...DEFAULT_OPTIONS }, progress: { selectedStage: 1, clearedStages: [], bestScore: 0 } });
const validStage = id => STAGES.some(stage => stage.id === id);
export function sanitizeSave(raw) {
    const result = defaults();
    if (!raw || raw.version !== 1) return result;
    for (const [key, fallback] of Object.entries(DEFAULT_OPTIONS)) {
        const value = raw.options?.[key];
        if (key === 'language') {
            if (value === 'ko' || value === 'en') result.options[key] = value;
        } else if (key === 'controlScheme') {
            if (value === 'standard' || value === 'casual') result.options[key] = value;
        } else if (typeof fallback === 'boolean') {
            if (typeof value === 'boolean') result.options[key] = value;
        } else if (Number.isFinite(value)) result.options[key] = Math.max(0, Math.min(1, value));
    }
    if (validStage(raw.progress?.selectedStage)) result.progress.selectedStage = raw.progress.selectedStage;
    if (Array.isArray(raw.progress?.clearedStages)) result.progress.clearedStages = [...new Set(raw.progress.clearedStages.filter(validStage))].sort((a, b) => a - b);
    if (Number.isSafeInteger(raw.progress?.bestScore) && raw.progress.bestScore >= 0) result.progress.bestScore = raw.progress.bestScore;
    return result;
}

export function createSaveStore(storage) {
    let data = defaults(), available = !!storage;
    let serialized = null;
    try { serialized = storage?.getItem(SAVE_KEY); }
    catch { available = false; }
    try { data = sanitizeSave(JSON.parse(serialized ?? 'null')); }
    catch { /* Damaged data must not prevent play. */ }
    const write = () => {
        try {
            if (!storage) return available = false;
            storage.setItem(SAVE_KEY, JSON.stringify(data));
            return available = true;
        } catch { return available = false; }
    };
    return {
        get data() { return structuredClone(data); },
        get available() { return available; },
        saveOptions(options) { data = sanitizeSave({ ...data, options }); return write(); },
        selectStage(stage) { if (validStage(stage)) data.progress.selectedStage = stage; return write(); },
        recordResult(stage, score, cleared = false) {
            if (cleared && validStage(stage) && !data.progress.clearedStages.includes(stage)) data.progress.clearedStages.push(stage);
            if (Number.isSafeInteger(score) && score >= 0) data.progress.bestScore = Math.max(data.progress.bestScore, score);
            return write();
        },
        reset() {
            try {
                if (!storage) return false;
                storage.removeItem(SAVE_KEY);
                data = defaults();
                return true;
            } catch { return false; }
        },
    };
}

export let localSave = createSaveStore(null);
export function initLocalSave() {
    let storage = null;
    try { storage = window.localStorage; } catch { /* Storage may be disabled. */ }
    localSave = createSaveStore(storage);
    const { bgmVolume, sfxVolume, ...options } = localSave.data.options;
    Object.assign(gameState, options);
    audio.setBGMVolume(bgmVolume);
    audio.setSFXVolume(sfxVolume);
}
export function saveLocalOptions() {
    const options = Object.fromEntries(Object.keys(DEFAULT_OPTIONS).map(key => [key, key.endsWith('Volume') ? audio[key] : gameState[key]]));
    return localSave.saveOptions(options);
}
