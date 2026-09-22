import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { BALANCE } from '../../src/data/generated/balance.js';
import { summarizeIncoming } from '../../src/balance/incoming-fire.js';
import { ATTACK_POLICY } from '../../src/enemies/attack-policy.js';

const args = Object.fromEntries(process.argv.slice(2).map(s => s.replace(/^--/, '').split('=')));
const runs = Number(args.runs ?? 40);
if (!Number.isInteger(runs) || runs < 1 || runs > 1000) throw new RangeError('runs must be 1..1000');
const baseline = JSON.parse(readFileSync(args.baseline ?? 'balance/reports/enemy-pressure/baseline.json', 'utf8'));
const mild = structuredClone(baseline), moderate = structuredClone(baseline);
Object.assign(mild.weapons.enemy_cannon, { damage: 5 });
Object.assign(mild.weapons.enemy_missile, { damage: 22, maxSpeedMps: 850, accelerationMps2: 300, turnRateRadSec: 1.6 });
Object.assign(mild.weapons.boss_missile, { maxSpeedMps: 1000, accelerationMps2: 400, turnRateRadSec: 1.8 });
Object.assign(mild.weapons.anti_air, { damage: 5 });
Object.assign(moderate.weapons.enemy_cannon, { damage: 4 });
Object.assign(moderate.weapons.enemy_missile, { damage: 14, maxSpeedMps: 700, accelerationMps2: 220, turnRateRadSec: 0.65 });
Object.assign(moderate.weapons.boss_missile, { damage: 20, maxSpeedMps: 850, accelerationMps2: 300, turnRateRadSec: 0.9 });
Object.assign(moderate.weapons.anti_air, { damage: 4 });
const versions = args.applied ? [['before', baseline, { groundAttackers: Infinity, missileLimit: Infinity, missileSpacing: 0 }], ['applied', BALANCE, ATTACK_POLICY]] :
    [['before', baseline, { groundAttackers: Infinity, missileLimit: Infinity, missileSpacing: 0 }], ['mild', mild, ATTACK_POLICY], ['moderate', moderate, ATTACK_POLICY]];
const rows = [];
const bossRows = [];
for (const [version, balance, policy] of versions) {
    for (const stageId of [1, 2, 3]) {
        for (const motion of ['straight', 'weave', 'evade']) {
            const row = { version, stageId, motion, ...summarizeIncoming({ balance, policy, stageId, motion, legacyAllAircraftMissiles: version === 'before' }, runs) };
            rows.push(row); console.log(JSON.stringify(row));
        }
    }
    for (const motion of ['straight', 'weave', 'evade']) {
        bossRows.push({ version, motion, ...summarizeIncoming({ balance, policy, stageId: 3, motion, boss: true }, runs) });
    }
}
const report = { runs, seconds: 60, dt: 1 / 60, seed: 104,
    baselineSha256: createHash('sha256').update(JSON.stringify(baseline)).digest('hex'),
    currentSha256: createHash('sha256').update(JSON.stringify(BALANCE)).digest('hex'),
    policy: ATTACK_POLICY,
    weaponCandidates: Object.fromEntries(versions.map(([name, data]) => [name, Object.fromEntries(Object.entries(data.weapons).filter(([, w]) => w.owner === 'enemy'))])),
    rows, bossRows,
    limitations: ['60초 무격추·무회복·무강화 압박 시험, 완주율 예측이 아님', '고도 800m 평지, 550kts. yaw: 직진 0, 완만한 회피 0.16*sin(t/5), 적극적 회피 0.48*sin(t/3) rad/s',
        '실제 비행·발사 조건·적 미사일 유도 함수를 공유. 스폰 위치와 지상 배치는 근사이며 실제 지형·피치·발사구 위치는 생략',
        '60Hz 점 충돌 판정은 현재 게임과 동일한 반경을 사용. 브라우저 프레임률 및 조작 패턴에 따라 실전 명중률은 달라질 수 있음',
        '피격 피해는 격추 후에도 누적하여 압박을 비교. 생존율은 최초 누적 피해 100 기준. 동일 시드 사용, 발사 변화에 따른 난수 소비 차이는 존재'] };
const out = args.out ?? 'balance/reports/enemy-pressure';
mkdirSync(out, { recursive: true });
writeFileSync(`${out}/review.json`, JSON.stringify(report, null, 2) + '\n');
writeFileSync(`${out}/review.md`, `# 적 공격 밸런스 시뮬레이션\n\n각 조건 ${runs}회, 60초, 초기 체력 100.\n\n| 버전 | 스테이지 | 기동 | 평균 누적 피해 | 상위 10% 경계 피해 | 생존율 | 발사 미사일 | 명중 미사일 | 동시 미사일 최대 |\n|---|---|---|---:|---:|---:|---:|---:|---:|\n${rows.map(r => `| ${r.version} | ${r.stageId} | ${r.motion} | ${r.meanDamage.toFixed(1)} | ${r.p90Damage} | ${r.survivalPercent.toFixed(1)}% | ${r.meanMissilesFired.toFixed(1)} | ${r.meanMissileHits.toFixed(1)} | ${r.maxMissiles} |`).join('\n')}\n\n## 해석 범위\n\n${report.limitations.map(s => `- ${s}`).join('\n')}\n`);
writeFileSync(`${out}/review.md`, `\n## 단독 보스 압박\n\n| 버전 | 기동 | 평균 누적 피해 | 생존율 | 명중 미사일 |\n|---|---|---:|---:|---:|\n${bossRows.map(r => `| ${r.version} | ${r.motion} | ${r.meanDamage.toFixed(1)} | ${r.survivalPercent.toFixed(1)}% | ${r.meanMissileHits.toFixed(1)} |`).join('\n')}\n`, { flag: 'a' });
