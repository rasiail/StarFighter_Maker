import { t } from './i18n.js';
import { calculateStats } from '../progression/model.js';
import { cardEffectValue } from '../progression/cards.js';
import { BALANCE } from '../data/generated/balance.js';

// Presentation fallback for source workbooks whose description_ko is blank.
const descriptions = {
    mobility: '기수를 돌리고 기체를 기울이는 속도가 빨라집니다.',
    stability: '조작을 놓거나 반대로 입력했을 때 회전이 더 빠르게 안정됩니다.',
    speed: '순항·최고 속도와 가속·감속 성능이 높아집니다.',
    defense: '최대 체력이 늘어나고, 증가한 만큼 현재 체력도 회복합니다.',
    power: '기관포와 모든 미사일의 한 발당 피해가 증가합니다.',
    control: '미사일을 더 멀리서 락온하고, 유도 중 더 빠르게 선회합니다.',
    standardRack: '표준 미사일의 탄창 용량을 늘립니다. 재장전 중이면 완료 후 적용됩니다.',
    multiRack: '멀티 미사일의 탄창 용량을 늘립니다. 재장전 중이면 완료 후 적용됩니다.',
    reload: '탄창을 모두 쓴 뒤 전체 재장전까지 걸리는 시간을 줄입니다.',
    warhead: '현재 화력 강화에 탄두 보정을 더해 기관포와 미사일 피해를 높입니다.',
    guidance: '미사일의 유도 선회 성능을 높여 움직이는 표적을 더 잘 추적합니다.',
    repair: '최대 체력에 비례해 즉시 수리하고 점수를 얻습니다. 체력 상한은 넘지 않습니다.',
    multiSalvo: '멀티 미사일로 한 번에 락온하고 발사할 수 있는 표적 수를 늘립니다.',
    smartAim: '기관포와 빔의 조준 보조가 작동하는 화면상의 범위를 넓힙니다.',
};
const number = value => Number(value.toFixed(2)).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export function createUpgradePreview(build, card, flight) {
    const next = { ...build, ranks: { ...build.ranks }, cards: { ...build.cards } };
    if (card.id !== 'repair') {
        const ranks = card.stat ? next.ranks : next.cards;
        ranks[card.id] = (ranks[card.id] || 0) + 1;
    }
    const before = calculateStats(build), after = calculateStats(next);
    const health = flight?.health ?? before.maxHealth;
    const score = flight?.score ?? 0;
    const changes = [];
    function add(label, from, to, unit = '') {
        const delta = to - from;
        const suffix = unit ? ` ${unit}` : '';
        changes.push({ label, before: from, after: to,
            value: `${number(from)} → ${number(to)}${suffix}`,
            difference: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${number(Math.abs(delta))}${unit === '%' ? ' %p' : suffix}` });
    }
    const stat = (label, key, unit, scale = 1) => add(label, before[key] * scale, after[key] * scale, unit);
    const damage = () => {
        for (const [key, label] of [['player_cannon', t('기관포 피해')], ['standard_missile', t('표준 미사일 피해')], ['multi_missile', t('멀티 미사일 피해')]]) {
            add(label, BALANCE.weapons[key].damage * before.damageMultiplier, BALANCE.weapons[key].damage * after.damageMultiplier);
        }
    };
    switch (card.id) {
        case 'unlockMulti': case 'unlockBeam': add(t('보유 무기'), build.weapons?.length ?? 1, (build.weapons?.length ?? 1) + 1, t('종')); break;
        case 'beamWidth': stat(t('빔 굵기'), 'beamWidth', 'm'); break;
        case 'beamEfficiency': stat(t('에너지 소모율'), 'beamEfficiency', '%', 100); break;
        case 'beamRecharge': stat(t('빔 재장전 시간'), 'beamReloadSeconds', t('초')); break;
        case 'mobility':
            stat(t('피치 속도'), 'maxPitchRate', t('°/초'), 180 / Math.PI);
            stat(t('롤 속도'), 'maxRollRate', t('°/초'), 180 / Math.PI);
            stat(t('요 속도'), 'maxYawRate', t('°/초'), 180 / Math.PI); break;
        case 'stability': stat(t('회전 안정 응답'), 'stabilityMultiplier', '%', 100); break;
        case 'speed':
            stat(t('순항 속도'), 'cruiseSpeed', 'kts'); stat(t('최고 속도'), 'maxSpeed', 'kts');
            stat(t('가속'), 'acceleration', t('kts/초')); stat(t('감속'), 'deceleration', t('kts/초')); break;
        case 'defense':
            stat(t('최대 체력'), 'maxHealth', 'HP');
            add(t('현재 체력'), health, Math.min(after.maxHealth, health + after.maxHealth - before.maxHealth), 'HP'); break;
        case 'power': case 'warhead': damage(); break;
        case 'control':
            for (const [key, label] of [['standard_missile', t('표준 락온 거리')], ['multi_missile', t('멀티 락온 거리')]]) {
                add(label, BALANCE.weapons[key].lockRangeM * before.lockRangeMultiplier, BALANCE.weapons[key].lockRangeM * after.lockRangeMultiplier, 'm');
            }
            stat(t('유도 선회 성능'), 'missileTurnMultiplier', '%', 100); break;
        case 'standardRack': stat(t('표준 탄창 용량'), 'stdMaxBursts', t('발')); break;
        case 'multiRack': stat(t('멀티 탄창 용량'), 'multiMaxBursts', t('발')); break;
        case 'reload':
            stat(t('표준 재장전'), 'stdReloadSeconds', t('초')); stat(t('멀티 재장전'), 'multiReloadSeconds', t('초')); break;
        case 'guidance': stat(t('유도 선회 성능'), 'missileTurnMultiplier', '%', 100); break;
        case 'multiSalvo': stat(t('동시 락온·발사'), 'multiLockCount', t('표적')); break;
        case 'smartAim': stat(t('조준 보조 범위'), 'smartAssistMultiplier', '%', 100); break;
        case 'repair':
            add(t('현재 체력'), health, Math.min(before.maxHealth, health + before.maxHealth * cardEffectValue('repair', 'health_restore')), 'HP');
            add(t('점수'), score, score + cardEffectValue('repair', 'score'), t('점')); break;
    }
    return { description: t(card.description?.trim() || descriptions[card.id] || '기체 성능을 강화합니다.'), changes };
}
