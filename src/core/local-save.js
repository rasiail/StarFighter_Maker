import { gameState } from './state.js';
import { audio } from '../audio/audio.js';
import { SECTORS, findSectorByStage } from '../config/sectors.js';

export const SAVE_KEY = 'starfighter.vertical-slice.save.v1';
const DEFAULT_OPTIONS = Object.freeze({ retroFilterEnabled: true, isPointerLockEnabled: true,
    language: 'ko', setupComplete: false, controlScheme: 'standard', targetFollowEnabled: true, isSmartGunEnabled: true, bgmVolume: 0.6, sfxVolume: 0.8 });
const defaults = () => ({ version: 1, options: { ...DEFAULT_OPTIONS }, progress: { selectedSector: 1, clearedSectors: [], bestScore: 0 } });
const validSector = id => SECTORS.some(sector => sector.id === id);
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
    if (validSector(raw.progress?.selectedSector)) result.progress.selectedSector = raw.progress.selectedSector;
    else {
        const legacySector = findSectorByStage(raw.progress?.selectedStage);
        if (legacySector) result.progress.selectedSector = legacySector.id;
    }
    if (Array.isArray(raw.progress?.clearedSectors)) {
        result.progress.clearedSectors = [...new Set(raw.progress.clearedSectors.filter(validSector))].sort((a, b) => a - b);
    } else if (Array.isArray(raw.progress?.clearedStages)) {
        result.progress.clearedSectors = SECTORS
            .filter(sector => sector.stageIds.every(stageId => raw.progress.clearedStages.includes(stageId)))
            .map(sector => sector.id);
    }
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
        selectSector(sector) { if (validSector(sector)) data.progress.selectedSector = sector; return write(); },
        recordResult(sector, score, cleared = false) {
            if (cleared && validSector(sector) && !data.progress.clearedSectors.includes(sector)) data.progress.clearedSectors.push(sector);
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
