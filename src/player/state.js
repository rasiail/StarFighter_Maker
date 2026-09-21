import { PLAYER_BASE_STATS } from '../config/player-stats.js';

// Vector3는 호출자가 전달하여 상태 생성과 테스트가 Three.js/DOM에 의존하지 않게 합니다.
export function createPlayerFlight(velocity, stats = PLAYER_BASE_STATS) {
    const effectiveStats = { ...PLAYER_BASE_STATS, ...stats };
    return {
        ...effectiveStats,
        velocity,
        speed: effectiveStats.cruiseSpeed,
        targetSpeed: effectiveStats.cruiseSpeed,
        pitchRate: 0,
        rollRate: 0,
        yawRate: 0,
        throttlePercent: 50,
        isAfterburner: false,
        isAirbrake: false,
        health: effectiveStats.maxHealth,
        score: 0,
        cannonCooldown: 0,
        stdBursts: effectiveStats.stdMaxBursts,
        stdShotCooldown: 0,
        stdReloadTimers: [],
        stdReloadDebt: 0,
        multiBursts: effectiveStats.multiMaxBursts,
        multiShotCooldown: 0,
        multiReloadTimers: [],
        multiReloadDebt: 0,
    };
}

// 기존 출격 시 보충 정책을 유지합니다. 점수와 기체 유효 스탯은 출격 간 유지됩니다.
export function replenishPlayerForSortie(flight) {
    flight.speed = flight.cruiseSpeed;
    flight.throttlePercent = 50;
    flight.health = flight.maxHealth;
    flight.stdBursts = flight.stdMaxBursts;
    flight.stdReloadTimers = [];
    flight.stdReloadDebt = 0;
    flight.multiBursts = flight.multiMaxBursts;
    flight.multiReloadTimers = [];
    flight.multiReloadDebt = 0;
    flight.targetSpeed = flight.cruiseSpeed;
    flight.pitchRate = flight.rollRate = flight.yawRate = 0;
    flight.cannonCooldown = flight.stdShotCooldown = flight.multiShotCooldown = 0;
    flight.isAfterburner = flight.isAirbrake = false;
}
