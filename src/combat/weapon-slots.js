export const STANDARD_WEAPON_MODE = 1;
export const MAX_WEAPON_SLOTS = 4;

export function weaponModesBySlot(ownedWeapons) {
    const acquired = Array.isArray(ownedWeapons) ? ownedWeapons : [];
    const extraWeapons = acquired.filter(mode => mode !== STANDARD_WEAPON_MODE);
    return [STANDARD_WEAPON_MODE, ...new Set(extraWeapons)].slice(0, MAX_WEAPON_SLOTS);
}

export function weaponModeForSlot(ownedWeapons, slotIndex) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_WEAPON_SLOTS) return null;
    return weaponModesBySlot(ownedWeapons)[slotIndex] ?? null;
}
