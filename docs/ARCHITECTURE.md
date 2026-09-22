# 개발 구조와 확장 가이드

확인 기준: 2026-09-22, 현재 작업 트리. 현재 런타임은 Three.js r128 기반 브라우저 ES Modules이며 번들러·프레임워크 없이 HTTP로 실행합니다. Unity 이전과 기체 외형 진화는 후속 기획입니다.

## 모듈과 상태 소유

| 경로 | 책임 / 소유 데이터 |
| --- | --- |
| `index.html`, `styles/game.css` | HUD·메뉴·카드·정비창 마크업, 외부 라이브러리, 스타일 |
| `src/main.js` | 시스템 초기화와 이벤트 구독 순서, 루프 시작 |
| `src/config/player-stats.js` | 동결된 `PLAYER_BASE_STATS` |
| `src/config/stages.js` | 웨이브 목표·eliteRatios, 동시 존재·공격 후보 설정, 일반 적·보스 체력 |
| `balance/*.xlsx` | 사람이 수정하는 레벨·무기·웨이브/적·카드 원본 |
| `tools/balance/build.py` | XLSX 검증, CSV·엔진 중립 JSON·웹 JS 생성 |
| `src/data/generated/` | 생성된 공통 데이터와 웹 런타임 어댑터 입력 |
| `src/core/state.js` | `gameState`: 세션 phase, 실행·일시정지, 모달·타깃·옵션, 런타임 참조 |
| `src/core/events.js` | 동기 이벤트 버스와 구독 해제 |
| `src/core/scheduler.js` | 시뮬레이션 시간으로 진행하는 전투 예약 작업 |
| `src/core/session.js`, `src/core/loop.js` | 최초 세션 초기화, 프레임 진행·렌더링 |
| `src/player/state.js` | 기체 상태 생성과 출격 보충 순수 함수 |
| `src/player/player.js`, `flight.js` | `playerFlight`·플레이어 메시, 비행·충돌·재장전 |
| `src/progression/model.js` | 경험치·레벨·유효 스탯 계산과 적용 |
| `src/progression/cards.js` | 카드 정의, 해금·최대 단계, 추첨과 선택 검증 |
| `src/progression/runtime.js` | 런 성장 상태 `progression`, 처치 보상, 카드 효과 적용 |
| `src/game/encounter.js` | 순수 웨이브 상태·처치 기록·전환·증원 계산 |
| `src/game/missions.js` | `encounter`, 새 런·출격·웨이브·보스·정비창·승패 |
| `src/combat/` | `weapons`의 탄환·미사일 목록, 조준·피해 판정 |
| `src/enemies/fleet.js` | 적·침몰 목록, 편대·보스 생성과 정리 |
| `src/enemies/models.js`, `drone.js` | 탱크·전함 메시와 공중 적 모델 선택 |
| `src/enemies/ai.js`, `flight-model.js`, `attack-policy.js`, `lifecycle.js` | 적 기동·지형 회피·공격 슬롯·격추·침몰 |
| `src/camera/follow.js` | 초기화와 매 프레임 추적에 공유하는 순수 카메라 거리 계산 |
| `src/ui/upgrade-preview.js` | 카드 선택 전후 유효 스탯 변화 표시 |
| `src/ui/` | HUD·레이더·옵션·강화 선택창 |
| `src/input/`, `src/camera/` | 입력·포인터 락, 추적·자유 시점·타깃 캠 |
| `src/rendering/`, `src/world/` | 씬·레트로 후처리, 지형·환경·시간대 |
| `src/assets/`, `src/effects/`, `src/audio/` | F104·MigFish·Su307·MechaFish 로딩, 배기·파티클, 음향 |

## 초기화와 루프

- `main.js` 외 모듈은 import 시 DOM·오디오·WebGL 초기화를 하지 않습니다. 초기화 함수는 앱 시작 시 한 번 호출합니다. 출격 때 재호출하면 리스너가 중복될 수 있습니다.
- 초기화가 필요한 메시·렌더러는 live export로 공유합니다. 데이터는 각 기능이 소유하고 공유 플래그만 `gameState`에 둡니다. 현재 일부 모듈 간 순환 참조가 있으므로 import 중 실행을 추가하지 않습니다.
- `initProgression()`을 `initMissions()`보다 먼저 호출합니다. 처치 이벤트의 경험치 보상을 미션 전환보다 먼저 반영하기 위한 순서입니다.
- 시뮬레이션은 실행 중이고 일시정지가 아닐 때만 진행합니다. 순서는 **비행 → 적 AI → 침몰 → 타기팅 → 발사체 → 전투 예약 → 미션 전환 → 카메라 → HUD → 배기·하늘 위치**입니다. 정비창 등 실행 종료 전환 시 중간에 종료합니다. 사망 중에는 별도 분기에서 8초간 관성 이동·회전·연쇄 폭발과 적·발사체·카메라·HUD 갱신을 수행합니다.
- 프레임 delta는 최대 0.08초입니다. 렌더링은 시뮬레이션과 분리되어 정지 중에도 계속됩니다.
- 전투 지연 효과는 `scheduleCombat()`으로 예약합니다. `clearBattle()`은 예약 작업·발사체·파티클·배기·적을 정리하며 웨이브/보스/출격/정비창 전환에 사용합니다.
- `ENEMY_DESTROYED` payload는 `{ enemyType, isBoss, killCount, score }`입니다. `PLAYER_DESTROYED`는 패배, `PROGRESSION_CHANGED`는 성장 UI 갱신에 사용합니다. 이벤트는 동기 전달되며 구독은 해제 함수를 반환합니다.

## 밸런스 데이터 파이프라인

조절 가능한 핵심 수치는 코드가 아니라 `balance/`의 네 워크북을 원본으로 사용합니다. 각 워크북은 `Guide`와 입력 시트를 가지며 일부는 사람이 결과를 확인하는 분석 시트를 포함합니다.

```text
balance/*.xlsx
    → tools/balance/build.py
    → balance/generated/*.csv
    → src/data/generated/balance.json
    → src/data/generated/balance.js
```

CSV는 Git diff에서 행 단위 변경을 검토하기 위한 산출물입니다. `balance.json`은 엔진 중립 스키마이며 Unity DTO/ScriptableObject importer나 Godot Resource importer의 입력으로 사용할 수 있습니다. 현재 웹 게임은 동일 JSON 구조를 ES Module로 감싼 `balance.js`를 사용합니다. 엔진별 exporter는 XLSX를 다시 해석하지 않고 이 JSON을 입력으로 추가합니다.

```sh
python tools/balance/build.py
# 또는 npm이 정상 연결된 환경
npm run balance:build
```

생성 파일은 직접 편집하지 않습니다. 변환기는 레벨 연속성, ID 중복, 카드 참조, 스테이지/웨이브 참조, 양수 수치, 스폰 확률·거리 범위를 확인합니다. 새 데이터 종류를 추가할 때는 워크북 시트, 변환 스키마, 엔진 어댑터, 테스트를 함께 갱신합니다.

현재 연결 범위는 레벨 경험치 곡선, 무기 피해·간격·장전·사거리·발사체 성능, 스테이지/웨이브 목표, 적 체력·경험치·점수·피격 반경, 스폰 규칙, 카드 정의·조건·효과입니다. 기체의 기본 비행 성능과 적 AI 행동 임계값은 아직 코드에 남아 있습니다.

### 밸런스 시뮬레이터

`src/balance/simulator.js`는 DOM이나 Three.js에 의존하지 않는 시드 기반 Monte Carlo 계산 엔진입니다. `balance.html`과 `tools/balance/simulate.mjs`가 같은 모듈을 사용합니다. `balance/combat-model.js`는 적별 개별 발사·명중·과잉 피해, 탄창·전체 재장전, 무기 전환, 탄착 지연, 멀티 동시 발사와 전함 연쇄 격파를 이벤트 순서로 계산합니다. 획득 경험치와 카드 후보 추첨·선택은 게임이 사용하는 성장 순수 함수에 전달합니다.

기본 제공 전략은 균형, 공격, 생존, 무작위입니다. 전략은 카드 후보 가운데 우선순위가 높은 카드를 고르는 휴리스틱이며 실제 플레이 AI는 아닙니다. 결과에는 평균과 10·90 백분위 시간, 성장 타임라인, 적·카드 평균 구성, 최종 무기별 DPS가 포함됩니다. 모델 가정에는 명중률, 사격 비중, 무기 사용 비중, 표적 전환, 웨이브 전환, 정비창 시간이 있습니다.

기동·속도·안정성·유도 성능의 시간·명중률 보정은 아직 실측되지 않은 추정 계수입니다. 플레이어의 실제 3차원 이동 경로와 피격·사망, 적 공격 예산은 계산하지 않습니다. 따라서 절대 시간 예측보다는 데이터 변경 전후의 상대 비교, 성장 급변 구간, 무기와 전략 간 격차를 찾는 용도입니다.

## 성장과 카드

`createProgression()`은 레벨 1, 경험치 0, 선택권 0, 6종 투자 단계 0으로 시작합니다. 경험치는 공식으로 재생성하지 않고 `BALANCE.levels[level - 1].xpToNext`를 조회합니다. 60개 행이 있으며 첫 5개 요구량은 60 / 150 / 300 / 500 / 750입니다. 정의 범위를 넘으면 `RangeError`가 발생하므로 레벨 상한 처리는 추가 검토 대상입니다. 보상 원본은 `waves_enemies.xlsx`입니다.

`calculateStats(build)`는 항상 기본값에서 재계산합니다. `playerFlight`에는 유효 스탯과 현재 체력·속도·장전 상태가 함께 있습니다. `applyStats()`는 최대 체력 증가분만큼 회복하고, 새 장전 슬롯을 준비 상태로 추가하며, 진행 중 재장전 타이머를 새 재장전 시간 비율에 맞춰 조절합니다.

| 투자 축 | 단계당 효과 (최대 5단계) |
| --- | --- |
| 기동력 | 기본 피치/롤/요 최대 회전속도의 +8% |
| 안정성 | 회전 정리 응답 배율 +0.15 |
| 속도 | 순항 +20kts, 최고 +40kts, 가속·감속 +8kts/s |
| 방어력 | 최대 체력 +20 |
| 화력 | 피해 배율 +0.1 |
| 관제력 | 락온 거리 배율 +0.1, 유도 배율 +0.08 |

| 추가 카드 | 최대 단계 | 효과 / 조건 |
| --- | --- | --- |
| `standardRack` / `multiRack` | 각각 3 | 표준 탄창 +4발 / 멀티 탄창 +2발 |
| `reload` | 5 | 두 미사일 기본 재장전 시간 단계당 -10% |
| `warhead` | 3 | 화력 3 필요. 화력 보정 후 피해에 `(1 + 단계 × 0.1)` 곱하기 |
| `guidance` | 3 | 관제력 3 필요. 유도 배율에 단계당 +0.15 더하기 |
| `multiSalvo` | 2 | 관제력 2 필요. 멀티 동시 락온·발사를 단계당 +2, 최대 8발 |
| `smartAim` | 3 | 스마트 조준 보조 반경 배율 단계당 +0.2 |
| `repair` | 무제한 | 최대 체력의 30% 회복·점수 +500 |

후보는 해금 조건과 최대 단계를 만족하는 풀에서 중복 없이 최대 3개를 뽑습니다. 일반 후보가 3개 미만이면 긴급 정비 카드 1개를 추가하므로 후보 수가 항상 3개인 것은 아닙니다. 선택마다 후보를 새로 생성합니다.

레벨업은 선택권만 적립합니다. X/강화 버튼으로 선택을 시작하며 웨이브 전환 후에도 미사용 선택권이 있으면 자동으로 열립니다. `activeModal === 'cards'` 동안 일시정지·입력 초기화·포인터 락 해제가 적용되고 ESC 취소를 막습니다. 모든 선택권을 소비하면 전투 또는 정비창으로 돌아갑니다.

새 카드를 추가할 때는 `balance/cards.xlsx`의 정의·조건·효과 및 변환 결과, `cards.js`의 해석, `model.js`의 유효 스탯 계산, 필요한 경우 `runtime.js`의 즉시 효과를 함께 수정하고 관련 순수 함수 테스트를 보완합니다. 무기 피해·거리 등의 일부 기본값은 여전히 전투 코드에 있습니다.

## 패드 입력

`input/gamepad-state.js`는 표준 매핑의 버튼 전이·탭/홀드 구분(○ 버튼 0.18초, L2 버튼 0.28초)·스틱 데드존을 계산합니다. `padInput`은 키보드/마우스의 `keys`와 별도로 유지하고 비행·카메라에서 함께 소비합니다. 회전 입력 합계는 기체 최대 회전속도 안으로 제한합니다.

`input/gamepad.js`는 매 렌더 프레임 `navigator.getGamepads()`에서 최신 상태를 읽습니다. 일시정지 중에도 카드/메뉴를 조작할 수 있도록 `stepSimulation()` 바깥에서 호출합니다. 표준 매핑의 첫 연결 장치를 선택하고 연결되어 있는 동안 유지합니다. 프레임 delta 대신 실제 타임스탬프로 탭/홀드 시간을 구분합니다.

메뉴/런 전환의 `clearCombatInput()`은 패드도 초기화합니다. 새 연결·컨텍스트 변경·포커스 복귀 때 이미 눌린 버튼은 해제될 때까지 차단해 메뉴 확인이 발사로 이어지지 않게 합니다. 방향키로 메뉴 항목을 이동하고 ×/○로 활성화하며, 정비창의 ×는 강화 전용입니다. 카드 선택은 기존 필수 연속 선택 규칙을 그대로 따릅니다. 버튼 배치는 [README](../README.md#ps-패드)를 참고하세요.

## 런과 미션 생명주기

`gameState.phase`는 `menu`, `combat`, `boss`, `hangar`, `complete`, `defeat`를 사용합니다. `encounter.phase`는 `waves`, `boss`, `hangar`이며 웨이브 인덱스는 0부터 시작합니다.

처치 이벤트는 전환 플래그만 설정합니다. 실제 웨이브/보스/정비창 전환은 발사체 처리 이후 `updateMission()`에서 수행해 반복 중 적 목록 교체를 피합니다. 증원은 약 1초 간격으로 동시 생존 수와 남은 생성 수를 계산합니다.

`launchStage(id)`는 기본적으로 새 런입니다. `launchStage(id, { newRun: false })`는 정비창에서 다음 스테이지로 이동할 때 사용하며 레벨·경험치·카드·선택권·점수를 유지합니다. 정비창 입장과 출격 때 체력/장전을 보충합니다. 마지막 정비창의 출격은 런 완료를 표시하고, NEW RUN은 해당 런의 시작 스테이지로 돌아가 성장을 초기화합니다. 저장/영구 성장은 없습니다.

스테이지별 수치와 조작법은 [README](../README.md#스테이지)를 참고하세요.

## 미사일 재장전

원본 무기 수치는 [README](../README.md#전투와-성장)에 정리합니다. `combat/magazine.js`는 표준/멀티 모두 전체 탄창 재장전이며 다음 계산을 실제 게임과 전투 시뮬레이터가 공유합니다.

- `baseReload = reloadSeconds × 0.333`
- 발사한 한 발당 부채 증가: `(reloadSeconds - baseReload) / maxBursts`
- 재장전 중이 아닐 때 `debt = max(0, debt - delta)`
- 탄창 소진 시 타이머를 `baseReload + debt`로 설정하고 부채를 0으로 초기화
- 타이머 종료 시 현재 최대 탄창까지 보충

초기 표준은 20발·기준 15초, 멀티는 8발·기준 30초입니다. 따라서 항상 10초/20초를 기다린다는 과거 설명은 현재 코드와 다릅니다. 랙 업그레이드는 장전 중이 아닐 때 증가분을 보충하고, 장전 중에는 잔탄 0을 유지합니다. 재장전 시간 변경 시 진행 중 타이머를 비례 조정합니다. 이미 쌓인 부채는 `applyStats()`에서 같은 비율로 재조정하지 않는 점이 남아 있습니다.

## 실행과 화면 오류 진단

`Play_Game.bat`는 `%~dp0`로 이동 → Python 밸런스 변환 → `node tools/serve.js --open` 순서입니다. Node 서버는 프로젝트 루트를 자신의 파일 경로로 결정하고 `127.0.0.1`에만 바인딩합니다. `--open`에서는 지정 포트가 사용 중이면 OS가 할당한 빈 포트로 재시도하고 준비가 끝난 뒤 실제 URL을 엽니다. 기본 포트는 8000이며 `PORT`로 바꿀 수 있습니다. 일반 `node tools/serve.js` 실행에는 자동 브라우저 열기·포트 재선택이 없습니다.

모든 성공 응답에 `Cache-Control: no-store`를 설정합니다. 게임 실행 주소와 Balance Lab 주소는 같은 서버 포트를 사용해야 합니다. 기존에 열린 탭의 실행 중 모듈은 파일 저장만으로 바뀌지 않으므로 다시 로드해야 합니다.

2026-09-22에는 `config/stages.js`에서 `eliteRatios`를 전달하지 않아 `missions.fillWave()`가 예외를 던지는 오류를 수정했습니다. 해당 배열은 생성 데이터에서 런타임까지 `waves`와 함께 전달되어야 합니다. 시뮬레이션의 `try/catch`는 오류를 로그로 남기고 다음 프레임을 계속 예약하므로, 미션 갱신에서 반복 실패하면 비행·렌더링은 일부 움직이지만 뒤쪽 카메라·HUD·배기는 갱신되지 않을 수 있습니다. 빈 레이더·중앙 HUD 문제는 브라우저의 첫 `Simulation loop error`부터 확인합니다.

카메라는 `follow.js`를 초기화와 갱신에서 공유합니다. 속도 비율 50% 이하 후방 거리는 9.375m, 50~80% 구간은 보간, 80% 이상은 12.5m이며 측면·전방은 전체 궤도 거리를 유지합니다.

## 현재 구현의 제한과 검증 공백

- 공중 공격 슬롯은 보스·2200m 이내 엘리트·거리 순으로 선택합니다. 지상/함포는 별도 2곳이며 선체·사망한 적은 제외합니다. 미사일 상한은 4발, 공통 발사 간격은 엘리트 2.5초·보스 1.5초입니다.
- 실제 게임은 `stage.eliteRatios[wave]`로 웨이브 전체 목표 대비 엘리트 목표 수를 계산합니다. `fleet.spawnFormation()`의 지상/전함 무작위 분기로 실제 생성 엘리트 수가 요청보다 적어도 `spawnedElites`에는 요청 수가 더해져 목표 비율이 보장되지는 않습니다.
- `balance/combat-model.js`와 `balance/incoming-fire.js`는 `formation.isEliteSpawn()`의 공중 적 20% 추첨을 사용합니다. 실제 게임의 웨이브별 비율과 다르므로 시뮬레이터가 현재 편대 구성을 그대로 재현한다고 볼 수 없습니다.
- 일반 공중 적 MigFish, 엘리트 Su307, 보스 MechaFish 모델이 연결되어 있습니다. 외형 진화·6소켓 교체는 미구현입니다. FBX 내부 텍스처 404(`Image_0.jpg`, `Image_2.jpg`, `texture_0_roughness.png`, `undefined`)는 9월 22일에도 관찰됐습니다. 코드에서 별도 PBR 재질을 적용하지만 내장 참조 정리는 남아 있습니다.
- 폭발은 공유 배열 500개 한도로 생성량을 제한하고, 연기는 같은 배열 길이가 280보다 클 때 생성을 건너뜁니다. 독립된 280개 연기 풀이 아닙니다.
- 단위 테스트 실패와 기존 Playwright smoke의 오래된 기대값이 남아 있습니다. 단위 테스트 전부 통과 또는 모든 전투 밸런스 검증 완료 상태가 아닙니다.

## 검증

2026-09-22 코드 대조 및 재실행 결과:

| 검사 | 결과 / 범위 |
| --- | --- |
| `node tools/check.js` | 54개 모듈 문법·연결·초기화 부작용 검사 통과 |
| `node --test "tests/*.test.js"` | 60개 중 49개 통과, 11개 실패 |
| `node tools/sortie-smoke.cjs` | 같은 날짜에 세 스테이지의 출격·HUD·카메라·배기·전체 웨이브·보스·정비창 통과 |
| 실제 배치 실행 | 프로젝트 밖 실행·포트 충돌 후 빈 포트 실행 및 실제 주소 열기 확인; 레이더·중앙 HUD·적 표식 표시, 해당 탭 런타임 오류 없음 |
| `node tools/smoke.cjs` | 이번 전체 실행 미실시; 초기 적 30기, 고정 장전, 자동 카드창 이전 흐름 등의 기대값 갱신 필요 |

실패 11개는 시뮬레이션 시간·멀티 일제 발사·피해 경계·표준 재발사·점사 간격·엘리트 비율·미사일 상한·압박 시험·표준/멀티 탄창·화력 배율 검사입니다. 일부는 변경된 정책과 오래된 기대값의 불일치이며, 전부 테스트만 바꾸면 해결된다고 확정하지 않습니다.

```sh
npm run check
# 밸런스 재생성이 필요 없으면
node tools/check.js
node --test "tests/*.test.js"
# 서버 실행 후 별도 터미널
node tools/sortie-smoke.cjs
```

`npm test`는 현재 `node --test`로 `scratch/test.cjs`까지 탐색할 수 있어 독립 단위 검사에는 위 경로 지정 명령을 사용합니다. `check`의 문법 순회는 `.js`만 포함하므로 `.cjs`는 `node --check tools/sortie-smoke.cjs`처럼 별도 검사합니다.

출격 회귀 스크립트에는 Puppeteer와 실행 가능한 Chrome/Chromium이 필요합니다(미설치 환경: `npm install --no-save puppeteer`). 기본 주소는 `http://127.0.0.1:8000`이며 PowerShell에서 `$env:GAME_URL='http://127.0.0.1:실제포트'`로 바꿉니다. 결과 이미지는 `test-results/sortie-fixed.png`입니다. 이 스크립트는 테스트를 위해 적을 직접 격파하므로 실제 조준·사격에 의한 완주율을 검증하지 않습니다.

기존 `npm run test:smoke`는 Playwright를 사용합니다. `PLAYWRIGHT_MODULE`, `BROWSER_CHANNEL`, `GAME_URL`을 지원하지만 현재 데이터에 맞춘 기대값 정리가 선행되어야 합니다. 실제 PS 패드·터치·포인터 락·장시간 플레이·시각/음향 품질은 별도 검증 대상입니다.
