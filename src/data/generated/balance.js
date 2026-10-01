// AUTO-GENERATED from balance/*.xlsx. Do not edit directly.
export const BALANCE = deepFreeze({
  "schemaVersion": 1,
  "levels": [
    {
      "currentLevel": 1,
      "xpToNext": 45
    },
    {
      "currentLevel": 2,
      "xpToNext": 113
    },
    {
      "currentLevel": 3,
      "xpToNext": 225
    },
    {
      "currentLevel": 4,
      "xpToNext": 375
    },
    {
      "currentLevel": 5,
      "xpToNext": 563
    },
    {
      "currentLevel": 6,
      "xpToNext": 647
    },
    {
      "currentLevel": 7,
      "xpToNext": 731
    },
    {
      "currentLevel": 8,
      "xpToNext": 816
    },
    {
      "currentLevel": 9,
      "xpToNext": 900
    },
    {
      "currentLevel": 10,
      "xpToNext": 985
    },
    {
      "currentLevel": 11,
      "xpToNext": 1069
    },
    {
      "currentLevel": 12,
      "xpToNext": 1154
    },
    {
      "currentLevel": 13,
      "xpToNext": 1238
    },
    {
      "currentLevel": 14,
      "xpToNext": 1322
    },
    {
      "currentLevel": 15,
      "xpToNext": 1406
    },
    {
      "currentLevel": 16,
      "xpToNext": 1491
    },
    {
      "currentLevel": 17,
      "xpToNext": 1575
    },
    {
      "currentLevel": 18,
      "xpToNext": 1660
    },
    {
      "currentLevel": 19,
      "xpToNext": 1744
    },
    {
      "currentLevel": 20,
      "xpToNext": 1829
    },
    {
      "currentLevel": 21,
      "xpToNext": 1913
    },
    {
      "currentLevel": 22,
      "xpToNext": 1997
    },
    {
      "currentLevel": 23,
      "xpToNext": 2081
    },
    {
      "currentLevel": 24,
      "xpToNext": 2166
    },
    {
      "currentLevel": 25,
      "xpToNext": 2250
    },
    {
      "currentLevel": 26,
      "xpToNext": 2335
    },
    {
      "currentLevel": 27,
      "xpToNext": 2419
    },
    {
      "currentLevel": 28,
      "xpToNext": 2504
    },
    {
      "currentLevel": 29,
      "xpToNext": 2588
    },
    {
      "currentLevel": 30,
      "xpToNext": 2672
    },
    {
      "currentLevel": 31,
      "xpToNext": 2756
    },
    {
      "currentLevel": 32,
      "xpToNext": 2841
    },
    {
      "currentLevel": 33,
      "xpToNext": 2925
    },
    {
      "currentLevel": 34,
      "xpToNext": 3010
    },
    {
      "currentLevel": 35,
      "xpToNext": 3094
    },
    {
      "currentLevel": 36,
      "xpToNext": 3179
    },
    {
      "currentLevel": 37,
      "xpToNext": 3263
    },
    {
      "currentLevel": 38,
      "xpToNext": 3347
    },
    {
      "currentLevel": 39,
      "xpToNext": 3431
    },
    {
      "currentLevel": 40,
      "xpToNext": 3516
    },
    {
      "currentLevel": 41,
      "xpToNext": 3600
    },
    {
      "currentLevel": 42,
      "xpToNext": 3685
    },
    {
      "currentLevel": 43,
      "xpToNext": 3769
    },
    {
      "currentLevel": 44,
      "xpToNext": 3854
    },
    {
      "currentLevel": 45,
      "xpToNext": 3938
    },
    {
      "currentLevel": 46,
      "xpToNext": 4022
    },
    {
      "currentLevel": 47,
      "xpToNext": 4106
    },
    {
      "currentLevel": 48,
      "xpToNext": 4191
    },
    {
      "currentLevel": 49,
      "xpToNext": 4275
    },
    {
      "currentLevel": 50,
      "xpToNext": 4360
    },
    {
      "currentLevel": 51,
      "xpToNext": 4444
    },
    {
      "currentLevel": 52,
      "xpToNext": 4529
    },
    {
      "currentLevel": 53,
      "xpToNext": 4613
    },
    {
      "currentLevel": 54,
      "xpToNext": 4697
    },
    {
      "currentLevel": 55,
      "xpToNext": 4781
    },
    {
      "currentLevel": 56,
      "xpToNext": 4866
    },
    {
      "currentLevel": 57,
      "xpToNext": 4950
    },
    {
      "currentLevel": 58,
      "xpToNext": 5035
    },
    {
      "currentLevel": 59,
      "xpToNext": 5119
    },
    {
      "currentLevel": 60,
      "xpToNext": 5204
    }
  ],
  "weapons": {
    "player_cannon": {
      "weaponId": "player_cannon",
      "displayNameKo": "20mm 기관포",
      "owner": "player",
      "weaponType": "cannon",
      "damage": 18,
      "fireIntervalSec": 0.05,
      "lockRangeM": 1000,
      "projectileSpeedMps": 1600,
      "lifetimeSec": 1.4,
      "engineKey": "cannon",
      "notes": "HUD 조준 보조 거리"
    },
    "standard_missile": {
      "weaponId": "standard_missile",
      "displayNameKo": "표준 미사일",
      "owner": "player",
      "weaponType": "missile",
      "damage": 55,
      "fireIntervalSec": 0.3,
      "readySlots": 20,
      "reloadSec": 15,
      "lockRangeM": 2000,
      "projectileSpeedMps": 350,
      "maxSpeedMps": 1000,
      "accelerationMps2": 450,
      "turnRateRadSec": 3.2,
      "lifetimeSec": 6,
      "engineKey": "std",
      "notes": "1발씩 발사, 탄창 소진 후 전체 재장전"
    },
    "multi_missile": {
      "weaponId": "multi_missile",
      "displayNameKo": "멀티 미사일",
      "owner": "player",
      "weaponType": "missile",
      "damage": 85,
      "fireIntervalSec": 0.5,
      "readySlots": 16,
      "reloadSec": 30,
      "lockRangeM": 3000,
      "projectileSpeedMps": 450,
      "maxSpeedMps": 1400,
      "accelerationMps2": 650,
      "turnRateRadSec": 4.5,
      "lifetimeSec": 6,
      "engineKey": "multi",
      "notes": "기본 4발, 멀티 관제 확장으로 최대 8발 동시 발사. 탄창 소진 후 전체 재장전"
    },
    "enemy_cannon": {
      "weaponId": "enemy_cannon",
      "displayNameKo": "적 기관포",
      "owner": "enemy",
      "weaponType": "cannon",
      "damage": 4,
      "projectileSpeedMps": 1600,
      "lifetimeSec": 1.4,
      "engineKey": "enemyCannon"
    },
    "enemy_missile": {
      "weaponId": "enemy_missile",
      "displayNameKo": "적 미사일",
      "owner": "enemy",
      "weaponType": "missile",
      "damage": 14,
      "projectileSpeedMps": 350,
      "maxSpeedMps": 700,
      "accelerationMps2": 220,
      "turnRateRadSec": 0.65,
      "lifetimeSec": 6,
      "engineKey": "enemyMissile",
      "notes": "일반 적"
    },
    "boss_missile": {
      "weaponId": "boss_missile",
      "displayNameKo": "보스 미사일",
      "owner": "enemy",
      "weaponType": "missile",
      "damage": 20,
      "projectileSpeedMps": 400,
      "maxSpeedMps": 850,
      "accelerationMps2": 300,
      "turnRateRadSec": 0.9,
      "lifetimeSec": 6,
      "engineKey": "bossMissile"
    },
    "anti_air": {
      "weaponId": "anti_air",
      "displayNameKo": "대공포",
      "owner": "enemy",
      "weaponType": "cannon",
      "damage": 4,
      "projectileSpeedMps": 1100,
      "lifetimeSec": 2.8,
      "engineKey": "antiAir",
      "notes": "탱크·함포"
    }
  },
  "stages": [
    {
      "stageId": 1,
      "operationName": "OP: CANYON SCOUT",
      "title": "STAGE 01: CANYON SCOUT",
      "environmentTheme": "DESERT",
      "maxActive": 45,
      "attackBudget": 4,
      "aircraftHealth": 60,
      "bossHealth": 2200,
      "bossName": "CANYON LEVIATHAN",
      "xpRewardMultiplier": 0.85,
      "waves": [
        19,
        29
      ],
      "eliteRatios": [
        0,
        0.1
      ]
    },
    {
      "stageId": 2,
      "operationName": "OP: OCEAN TRIDENT",
      "title": "STAGE 02: OCEAN TRIDENT",
      "environmentTheme": "OCEAN",
      "maxActive": 54,
      "attackBudget": 5,
      "aircraftHealth": 100,
      "bossHealth": 3400,
      "bossName": "OCEAN DREADNOUGHT",
      "xpRewardMultiplier": 0.9,
      "waves": [
        35,
        44,
        53
      ],
      "eliteRatios": [
        0,
        0.1,
        0.15
      ]
    },
    {
      "stageId": 3,
      "operationName": "OP: METROPOLIS SHIELD",
      "title": "STAGE 03: METROPOLIS SHIELD",
      "environmentTheme": "CITY",
      "maxActive": 63,
      "attackBudget": 6,
      "aircraftHealth": 120,
      "bossHealth": 4800,
      "bossName": "METROPOLIS OVERLORD",
      "xpRewardMultiplier": 1.4,
      "waves": [
        48,
        56,
        65,
        73
      ],
      "eliteRatios": [
        0,
        0.1,
        0.15,
        0.2
      ]
    }
  ],
  "enemies": {
    "stage_aircraft": {
      "enemyId": "stage_aircraft",
      "displayNameKo": "공중 적기",
      "xpReward": 20,
      "scoreReward": 1500,
      "hitRadiusM": 20,
      "countsAsTarget": true,
      "notes": "체력은 Stages.aircraft_health"
    },
    "tank": {
      "enemyId": "tank",
      "displayNameKo": "전차",
      "health": 100,
      "xpReward": 25,
      "scoreReward": 1500,
      "hitRadiusM": 18,
      "countsAsTarget": true
    },
    "ship_hull": {
      "enemyId": "ship_hull",
      "displayNameKo": "전함 선체",
      "health": 300,
      "xpReward": 80,
      "scoreReward": 3500,
      "hitRadiusM": 38,
      "countsAsTarget": true,
      "notes": "파괴 시 연결 함포 무력화"
    },
    "ship_turret": {
      "enemyId": "ship_turret",
      "displayNameKo": "전함 함포",
      "health": 100,
      "xpReward": 20,
      "scoreReward": 1000,
      "hitRadiusM": 18,
      "countsAsTarget": true
    },
    "boss": {
      "enemyId": "boss",
      "displayNameKo": "보스",
      "xpReward": 200,
      "scoreReward": 1500,
      "hitRadiusM": 65,
      "countsAsTarget": true,
      "notes": "체력은 Stages.boss_health"
    },
    "elite": {
      "enemyId": "elite",
      "displayNameKo": "엘리트",
      "health": 250,
      "xpReward": 100,
      "scoreReward": 3000,
      "hitRadiusM": 24,
      "countsAsTarget": true,
      "notes": "정예 전투기"
    }
  },
  "spawnRules": {
    "ground_or_ship_probability": {
      "value": 0.25,
      "unit": "ratio"
    },
    "spawn_range_min": {
      "value": 1500,
      "unit": "m"
    },
    "spawn_range_max": {
      "value": 3500,
      "unit": "m"
    },
    "reinforcement_interval": {
      "value": 1,
      "unit": "sec"
    }
  },
  "cards": [
    {
      "cardId": "mobility",
      "displayNameKo": "기동력",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "max_pitch_rate_multiplier",
          "operation": "add_per_rank",
          "value": 0.08,
          "unitOrRule": "ratio"
        },
        {
          "effectKey": "max_roll_rate_multiplier",
          "operation": "add_per_rank",
          "value": 0.08,
          "unitOrRule": "ratio"
        },
        {
          "effectKey": "max_yaw_rate_multiplier",
          "operation": "add_per_rank",
          "value": 0.08,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "stability",
      "displayNameKo": "안정성",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "stability_multiplier",
          "operation": "add_per_rank",
          "value": 0.15,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "speed",
      "displayNameKo": "속도",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "cruise_speed",
          "operation": "add_per_rank",
          "value": 20,
          "unitOrRule": "kts"
        },
        {
          "effectKey": "max_speed",
          "operation": "add_per_rank",
          "value": 40,
          "unitOrRule": "kts"
        },
        {
          "effectKey": "acceleration",
          "operation": "add_per_rank",
          "value": 8,
          "unitOrRule": "kts_per_sec"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "defense",
      "displayNameKo": "방어력",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "max_health",
          "operation": "add_per_rank",
          "value": 20,
          "unitOrRule": "hp"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "power",
      "displayNameKo": "화력",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "damage_multiplier",
          "operation": "add_per_rank",
          "value": 0.1,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "control",
      "displayNameKo": "관제력",
      "category": "stat",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": true,
      "effects": [
        {
          "effectKey": "lock_range_multiplier",
          "operation": "add_per_rank",
          "value": 0.1,
          "unitOrRule": "ratio"
        },
        {
          "effectKey": "missile_turn_multiplier",
          "operation": "add_per_rank",
          "value": 0.08,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "standardRack",
      "displayNameKo": "표준 미사일 랙 확장",
      "category": "equipment",
      "maxRank": 3,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "standard_ready_slots",
          "operation": "add_per_rank",
          "value": 4,
          "unitOrRule": "count"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "multiRack",
      "displayNameKo": "멀티 미사일 랙 확장",
      "category": "equipment",
      "maxRank": 3,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "multi_ready_slots",
          "operation": "add_per_rank",
          "value": 2,
          "unitOrRule": "count"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "reload",
      "displayNameKo": "신속 재장전",
      "category": "equipment",
      "maxRank": 5,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "missile_reload_multiplier",
          "operation": "subtract_per_rank",
          "value": 0.1,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "warhead",
      "displayNameKo": "고출력 탄두",
      "category": "equipment",
      "maxRank": 3,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "damage_multiplier",
          "operation": "multiply_add_per_rank",
          "value": 0.1,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": [
        {
          "cardId": "warhead",
          "requiredKey": "power",
          "operator": ">=",
          "value": 3
        }
      ]
    },
    {
      "cardId": "guidance",
      "displayNameKo": "능동 유도 제어",
      "category": "equipment",
      "maxRank": 3,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "missile_turn_multiplier",
          "operation": "add_per_rank",
          "value": 0.15,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": [
        {
          "cardId": "guidance",
          "requiredKey": "control",
          "operator": ">=",
          "value": 3
        }
      ]
    },
    {
      "cardId": "repair",
      "displayNameKo": "긴급 정비",
      "category": "fallback",
      "drawWeight": 0,
      "isStat": false,
      "effects": [
        {
          "effectKey": "health_restore",
          "operation": "instant_ratio",
          "value": 0.3,
          "unitOrRule": "max_health"
        },
        {
          "effectKey": "score",
          "operation": "instant_add",
          "value": 500,
          "unitOrRule": "points"
        }
      ],
      "conditions": []
    },
    {
      "cardId": "multiSalvo",
      "displayNameKo": "멀티 관제 확장",
      "category": "equipment",
      "maxRank": 2,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "multi_lock_count",
          "operation": "add_per_rank",
          "value": 2,
          "unitOrRule": "count; max=8"
        }
      ],
      "conditions": [
        {
          "cardId": "multiSalvo",
          "requiredKey": "control",
          "operator": ">=",
          "value": 2
        }
      ]
    },
    {
      "cardId": "smartAim",
      "displayNameKo": "스마트 에임 확장",
      "category": "equipment",
      "maxRank": 3,
      "drawWeight": 100,
      "isStat": false,
      "effects": [
        {
          "effectKey": "smart_assist_multiplier",
          "operation": "add_per_rank",
          "value": 0.2,
          "unitOrRule": "ratio"
        }
      ],
      "conditions": []
    }
  ]
});

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}
