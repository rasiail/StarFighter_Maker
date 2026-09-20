# 밸런스 데이터 작업 방법

`balance/*.xlsx` 네 파일이 밸런스 데이터의 원본입니다. `balance/generated/*.csv`와 `src/data/generated/*`는 변환 결과이므로 직접 수정하지 않습니다.

| 변경하려는 항목 | 원본 파일 |
| --- | --- |
| 레벨별 필요 경험치 | `levels.xlsx` |
| 기관포·미사일 피해, 장전, 사거리, 탄속 | `weapons.xlsx` |
| 스테이지, 웨이브 목표, 적 체력·보상, 생성 규칙 | `waves_enemies.xlsx` |
| 카드 목록, 효과, 등장 조건 | `cards.xlsx` |

각 파일의 `Guide` 시트에서 열의 의미를 확인할 수 있습니다. 노란색 데이터 셀만 수정하고 영문 ID는 참조 관계를 이해한 경우에만 변경합니다. 수식과 분석 시트는 게임 데이터로 내보내지지 않습니다.

## 변환

```sh
python tools/balance/build.py
# 또는
npm run balance:build
```

변환기는 외부 Python 패키지를 사용하지 않습니다. XLSX의 데이터 시트를 읽어 다음 결과를 만듭니다.

```text
balance/generated/              사람이 Git diff로 검토하는 CSV
src/data/generated/balance.json 엔진 중립 데이터
src/data/generated/balance.js   현재 웹 게임용 ES Module
```

변환 과정에서 ID 중복, 누락된 참조, 음수·0 수치, 레벨 연속성, 스폰 확률과 거리 범위를 검사합니다. 검증에 실패하면 생성 파일을 갱신하지 않습니다.

`npm start`, `npm run check`, `Play_Game.bat`도 실행 전에 변환기를 호출합니다. 문서를 저장한 뒤 평소처럼 게임을 시작하면 최신 값이 반영됩니다.

`balance.json`은 특정 엔진의 클래스나 필드명을 요구하지 않습니다. Unity는 JSON DTO 또는 ScriptableObject importer, Godot은 JSON/Resource importer를 추가해 같은 데이터를 사용할 수 있습니다. 엔진별 이름과 저장 형식 변환은 원본 XLSX가 아니라 `balance.json`을 입력으로 구현합니다.

## 수치 시뮬레이션

현재 경험치 곡선은 최초 곡선의 7.5배(정수 반올림)입니다. 요구량 3배만으로는 카드 선택이 약 24회까지밖에 줄지 않아 시뮬레이션 결과를 기준으로 조정했습니다. 현재 스테이지 경험치 배율은 초반 0.85, 중반 0.9, 후반 1.4이며 선택 기회를 후반에 재배분합니다. 이벤트 모델로 전략별 1,000회 검증한 균형 전략은 카드 선택 14.0회, 종료 레벨 15.0, 평균 19.31분입니다. 최신 상세 결과는 `reports/latest/`에 있습니다. `xpRequirementScale`은 현재 원본 요구량에 추가로 적용하는 시험 배율이며 기본값은 1입니다.

주 사용 흐름은 **AI에게 목표 제시 → 후보 조합 자동 실행 → JSON 분석 → Markdown 리뷰**입니다. 웹 화면은 보조 확인용입니다. 예를 들어 "멀티 미사일을 약화하면서 평균 20분에 맞춰줘"라고 요청하면 아래 도구로 후보를 탐색합니다.

```sh
npm run balance:review -- --target-minutes=20 --runs=100
# npm 없이 실행할 때는 원본 변환 후 실행
python tools/balance/build.py
node tools/balance/review.mjs --target-minutes=20 --runs=100
```

`balance/reports/latest/review.json`은 AI가 읽을 전체 후보·가정·데이터 해시·성장 타임라인이고, `review.md`는 사람이 읽을 리포트입니다. 기본 56개 조합에서 멀티 장전 배율과 웨이브 적 수 배율을 탐색합니다. 후보는 기본 100회씩 빠르게 탐색하고 선택안과 전략 비교는 `--runs` 횟수로 검증합니다. `--search-runs=200`, `--reload-scales=1,1.5,2`, `--enemy-scales=0.8,0.9,1`, `--multi-ratio-limit=1.2`, `--seed=104`, `--out=balance/reports/experiment`로 조건과 출력 위치를 지정할 수 있습니다.

추천은 균형 카드 전략 기준 목표 시간에 가장 가까운 탐색 후보입니다. 멀티/표준 비율 제한은 사용 비중을 같게 맞춘 초기 무강화 지속 DPS에 적용하는 임시 설계 조건입니다. 후보별 총 적 수와 성장량, 전략별 시간과 탐색 시간 민감도도 보고합니다. 도구는 원본 XLSX를 수정하지 않습니다. AI는 리포트를 검토한 뒤 사용자의 적용 요청에 따라 원본을 갱신합니다.

게임 서버를 실행한 뒤 `http://localhost:8000/balance.html`에서 **Balance Lab**을 엽니다. 반복 횟수, 기관포·미사일 명중률, 기관포 사격 비중, 멀티 미사일 사용 비중, 표적당 탐색·기동 시간을 바꿔 다음 결과를 비교할 수 있습니다.

- 예상 런 시간과 10~90% 범위
- 시간에 따른 레벨·전투 DPS·누적 표적 수
- 공격·생존·균형·무작위 카드 선택 전략
- 무기별 일제 피해와 지속 DPS 기여도
- 적 구성과 레벨별 요구·누적 경험치

명령줄에서는 같은 계산 엔진을 사용합니다.

```sh
npm run balance:simulate
# 반복 횟수와 시드 지정
node tools/balance/simulate.mjs --runs=1000 --seed=104
# 상세 JSON 출력
node tools/balance/simulate.mjs --runs=100 --json
```

기본 `events` 모델은 기관포와 미사일의 개별 발사·명중, 과잉 피해, 탄창 소모, 전체 재장전, 무기 전환, 미사일 탄착 시간과 전함 선체·함포 연쇄 격파를 시간 순서로 계산합니다. 기동력·속도는 표적 접근 시간, 안정성·유도 성능은 명중률에 작은 추정 보정을 줍니다. 이 계수들은 실측 전 가정이며, 플레이어 피격·사망과 적 공격 예산은 아직 포함하지 않습니다. 절대 플레이 시간을 확정하기보다 데이터 변경 전후의 상대 변화와 비정상적인 성장 구간을 찾는 용도입니다.
