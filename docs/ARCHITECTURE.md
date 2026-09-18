# 개발 구조와 확장 가이드

## 현재 구조

브라우저 ES Modules를 사용합니다. 번들러나 프레임워크 없이 기존 로컬 HTTP 서버로 실행할 수 있습니다. Three.js r128과 FBXLoader는 기존 CDN 버전을 그대로 사용합니다.

| 경로 | 책임 |
| --- | --- |
| `index.html` | 캔버스, HUD/메뉴 마크업, 외부 라이브러리 로딩 |
| `styles/game.css` | 화면 스타일, 애니메이션, 반응형 UI |
| `src/main.js` | 시스템 초기화 순서 및 게임 루프 시작 |
| `src/config/player-stats.js` | 기체 기본 스탯, 미사일 재장전/장탄 수 |
| `src/config/stages.js` | 스테이지 이름, 목표 격추 수, 초기 공중 적 수 |
| `src/core/state.js` | 공유 세션·타깃·옵션 상태 및 런타임 참조 |
| `src/core/events.js` | 격추/플레이어 파괴 이벤트와 구독/해제 |
| `src/core/loop.js` | 프레임 시간, 시스템 업데이트 순서, 렌더링 |
| `src/core/session.js` | 최초 세션 상태 초기화 |
| `src/player/state.js` | 기체 상태 생성, 출격 시 체력/탄약 보충 |
| `src/player/player.js` | 플레이어 메시·카메라 피봇·배기 효과 배치 |
| `src/player/flight.js` | 조작 기반 비행 물리, 지면 충돌, 무장 쿨다운 |
| `src/combat/weapons.js` | 기총/미사일 발사, 무장 상태 표시 |
| `src/combat/projectiles.js` | 발사체 이동, 유도, 충돌/피해, 파티클 갱신 |
| `src/combat/targeting.js` | 타깃 자동 획득/순환 |
| `src/enemies/models.js` | 탱크·전함 메시 제작 |
| `src/enemies/fleet.js` | 적 목록, 생성, 스테이지 편대 구성 |
| `src/enemies/ai.js` | 적 비행/전투 AI, 지형 회피, 선회 |
| `src/enemies/lifecycle.js` | 격추, 리스폰, 전함 침몰 |
| `src/world/environment.js` | 지형, 절차적 텍스처, 환경/시간대, 구름 |
| `src/assets/aircraft.js` | F-104 재질/FBX 로딩, 절차적 대체 모델 |
| `src/effects/` | 배기 파티클, 폭발/연기 생성 |
| `src/rendering/` | Three.js 씬·렌더러 및 레트로 후처리 |
| `src/camera/camera.js` | 추적 카메라, 자유 시점, 타깃 캠 |
| `src/input/` | 입력 상태, 키보드/마우스/터치, 포인터 락 |
| `src/ui/` | HUD·레이더, 옵션/메뉴 이벤트 |
| `src/game/missions.js` | 출격/재출격/다음 스테이지, 승패 화면 |

## 의존성과 초기화 규칙

- `config`, `player/state`, `core/events`는 DOM/Three.js 없이 사용할 수 있습니다. 단위 테스트도 이 경계에서 실행합니다.
- `main.js` 외 모듈은 import 시 DOM/오디오/WebGL 작업을 실행하지 않습니다. 해당 작업은 `init...()`에서 수행합니다.
- 초기화는 **앱 시작 시 한 번**만 합니다. 출격/재출격은 `launchStage()`로 처리합니다. `init...()` 재호출은 이벤트 리스너 중복 등록을 일으킬 수 있습니다.
- 메시·렌더러 같은 초기화가 필요한 값은 모듈의 live export를 사용합니다. 다른 모듈에서 export 바인딩을 재할당하지 않습니다.
- 여러 기능이 변경하는 작은 공유 상태는 `gameState`를 사용합니다. 적 목록은 `fleet`, 발사체 목록은 `weapons`, 기체 데이터는 `player`가 소유합니다. 새로운 데이터를 모두 `gameState`에 넣지 않습니다.
- 기존 AI/무장/기체/카메라의 상호 참조 일부는 남아 있습니다. import만으로 초기화하지 않는 이유입니다. 새 시스템은 가능한 한 순수 데이터와 이벤트에 의존하게 추가합니다.
- 루프 순서는 비행 → AI → 침몰 → 발사체 → 카메라 → HUD → 배기 효과 → 렌더링입니다. 순서 변경은 조준/충돌 결과에 영향을 줄 수 있습니다.

## 스탯 → 레벨 → 카드 개발 순서

### 1. 스탯

`PLAYER_BASE_STATS`는 동결된 기본 정의입니다. `createPlayerFlight()`가 개별 기체의 유효 스탯을 복사합니다. 비행 가속/회전과 미사일 재장전은 이 유효 스탯을 실제로 사용합니다. 체력, 속도, 장탄 수를 수정할 때 기본 정의를 직접 변경하지 않습니다.

현재는 기존 데이터 형태를 유지하기 위해 유효 스탯과 순간 상태가 `playerFlight` 안에 함께 있습니다. 본격적인 버프/카드 중첩을 구현할 때 `baseStats + modifiers → effectiveStats` 계산기를 순수 함수로 추가하고, 체력·현재 속도·잔탄/타이머와 분리하는 것이 다음 단계입니다. 아직 모든 무기 사거리·피해량까지 설정화한 상태는 아닙니다.

### 2. 경험치와 레벨

추가할 `progression` 모듈에서 `gameEvents.on(EVENTS.ENEMY_DESTROYED, ...)`를 구독합니다. 이벤트에는 적 종류(`aircraft`, `tank`, `ship`, `turret`), 현재 격추 수, 누적 점수가 전달됩니다. 경험치 보상값은 별도 설정으로 정의합니다. 전투 코드는 성장 UI를 import할 필요가 없습니다.

이벤트는 동기적으로 전달됩니다. 현재 미션 시스템도 이 이벤트로 승리를 판단합니다. `PLAYER_DESTROYED`는 지면/탄환/미사일 피해에서 발생하고 미션 시스템이 패배를 처리합니다. 구독 함수는 해제 함수를 반환하므로, 출격별 구독을 추가할 경우 종료 시 해제합니다. 상태 보존 범위(출격/런/영구)는 레벨 시스템을 구현할 때 명시적으로 정해야 합니다.

### 3. 스킬 카드

이후 카드 정의(식별자·희귀도·최대 레벨·효과 데이터), 후보 추첨/선택, 효과 계산, 선택 UI를 각각 분리합니다. 카드 선택은 modifier 데이터에 반영하고 기존 비행/무장 시스템이 계산된 스탯을 소비하도록 연결합니다. 카드 선택 화면의 일시정지/재개는 미션 생명주기와 함께 설계합니다.

경험치, 레벨, 카드 추첨/선택 기능 자체는 아직 구현하지 않았습니다.

## 검증

```sh
npm run check
npm test
```

`check`는 문법과 모듈 연결(named imports/exports), import 시 브라우저 부작용이 없는지 검사합니다. 단위 테스트는 상태 격리, 유효 스탯 보존, 이벤트 구독/해제를 검사합니다.

선택적으로 Playwright를 설치하고 서버를 켠 상태에서 브라우저 회귀 검증을 실행할 수 있습니다.

```sh
npm install --no-save playwright
npx playwright install chromium
npm start
# 다른 터미널
npm run test:smoke
```

이미 설치된 Edge를 사용하려면 PowerShell에서 `$env:BROWSER_CHANNEL='msedge'`를 지정하면 Chromium 다운로드를 생략할 수 있습니다. 테스트는 세 스테이지의 출격, 비행, 기총/미사일, 재장전, 옵션, 지면 충돌에 의한 패배, 재출격, 격추에 의한 승리, 다음 스테이지/메인 메뉴를 검증합니다. 실제 포인터 락과 모바일 터치 감각은 수동 플레이로 확인해야 합니다.

이번 분리 과정에서는 원본과 같은 난수/입력으로 스테이지별 120프레임을 실행해 기체 위치·회전, AI 위치/상태, 체력, 탄약과 미사일 타이머의 일치를 별도로 확인했습니다.

기존 FBX 내부 텍스처 참조의 `Image_0.jpg`, `Image_2.jpg`, `texture_0_roughness.png`, `undefined` 요청 404가 원본/분리본 모두에서 확인됩니다. 실제 PBR 재질은 기존 F104 데이터를 사용하며 이 에셋 정리 문제는 이번 구조 변경에 포함하지 않았습니다.
