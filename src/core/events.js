// 동기 이벤트: 전투 시스템은 메뉴/성장 시스템을 직접 호출하지 않습니다.
export function createEventBus() {
    const listeners = new Map();
    return {
        on(type, listener) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(listener);
            return () => {
                const handlers = listeners.get(type);
                handlers?.delete(listener);
                if (handlers?.size === 0) listeners.delete(type);
            };
        },
        emit(type, payload) {
            for (const listener of [...(listeners.get(type) || [])]) listener(payload);
        },
    };
}

export const gameEvents = createEventBus();
export const EVENTS = Object.freeze({
    // payload: { enemyType: 'aircraft'|'tank'|'ship'|'turret', killCount: number, score: number }
    ENEMY_DESTROYED: 'enemy:destroyed',
    PLAYER_DESTROYED: 'player:destroyed',
    PROGRESSION_CHANGED: 'progression:changed',
});
