# src/lib/tradeEngine.ts Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
수강 변경(분반 이동 · 드랍 · 추가신청) 가능성을 시간 충돌 기준으로 탐색합니다.
백엔드 호출 없이 `allClassesData`만으로 계산합니다.

## 핵심 개념

**슬롯(SlotKey)** — `"MON-3"` 형태의 요일·교시 키. 모든 충돌 판정은 슬롯 집합의 교집합 여부입니다.

**세 가지 처리 방식이 하나의 탐색으로 통합됩니다.** 과목마다 "가능한 최종 상태" 후보를 만들고,
슬롯이 겹치지 않는 조합을 백트래킹으로 찾습니다.

| 액션 | 후보 집합 |
|------|-----------|
| `keep` | 변수가 아님 — 현재 분반의 슬롯이 고정 제약이 됨 |
| `move` | 같은 과목의 전체 분반 (현재 분반 포함). `moveTargets`로 특정 분반 고정 가능 |
| `drop` | `[null]` — 시간표에서 빠짐 |
| 추가 과목 | 그 과목의 전체 분반 (반드시 편성) |

## 주요 함수

| 함수 | 역할 |
|------|------|
| `buildSubjectIndex(allClassesData)` | 과목명 → 전체 분반 맵. 한 번 만들어 재사용 |
| `getStudentSchedule(allClassesData, stuId)` | 특정 학생이 듣는 분반 목록 |
| `findPlans(request, limit)` | 조건을 만족하는 조합 탐색. 변화 없는 조합은 제외 |
| `findBlockers(schedule, candidate)` | 어떤 분반을 넣을 때 부딪히는 기존 과목들 |
| `evaluateAddCandidates(schedule, index, subject)` | 과목의 각 분반별 추가 가능 여부 + 블로커 |
| `findAddableAfterDrop(schedule, index, dropSubjects)` | 드랍 후 새로 들어갈 수 있는 분반 |
| `buildStudentIndex(allClassesData)` | 학번 → 시간표 맵. 여러 학생을 훑는 탐색용 |
| `findTradePartners(studentIndex, myStuId, from, to)` | 분반을 맞바꿀 수 있는 학생 |
| `compactTimes(times)` | 구인 글용 짧은 시간 표기 (`월67 목9`). 10교시 이상은 콤마로 구분 |
| `buildTradePost(subject, from, to)` | 교환 상대 구하는 글 생성 (복사용) |
| `applyPlan(schedule, plan)` | 조합을 적용한 최종 시간표 (미리보기용) |
| `buildPlannedSchedule(schedule, index, state, plan)` | **계획을 적용한 시간표 + 표식**(들어옴·이동·충돌). 조합을 넘기면 그 결과를, 안 넘기면 지금까지 지정한 드랍·추가·이동을 바로 반영 |
| `hasAutoChoice(schedule, state)` | 분반을 안 고르고 "자동"으로 둔 항목이 있는지 |
| `sameSections(a, b)` | 두 시간표가 같은 분반 묶음인지 (계획이 아무것도 안 바꾸는지 판정) |
| `scheduleToTimes(sections)` | `TimetableGrid`에 넘길 `SectionTime[]`로 변환 |

## 교환 상대 (`findTradePartners`)
교환이 성립하려면 양쪽 모두 옮길 수 있어야 합니다.

| 조건 | 검사 위치 |
|------|-----------|
| 상대가 `to`를 듣고 있고, `from`으로 와도 충돌 없음 | `findTradePartners` |
| **내가 `to`로 갈 수 있음** | **호출하는 쪽** |

두 번째 조건은 이 함수가 보지 않습니다. 조합 탐색 결과(`PlanResult.choices`)나
`findBlockers`가 빈 분반에 대해서만 호출해야 합니다. 그냥 부르면 한쪽만 성립하는
경우까지 상대로 잡혀 실제보다 많이 나옵니다.

## 탐색 성능
- 후보가 적은 변수부터 배치해 불가능한 가지를 일찍 잘라냅니다
- 결과 상한 `MAX_PLAN_RESULTS = 200`. 초과 시 `truncated: true`
- 정렬: 변경 건수(이동+드랍) 오름차순

## 결과 해석
`PlanResult.choices`에는 **변화가 있는 항목만** 담깁니다. 유지된 과목은 빠집니다.
`from`이 null이면 신규 추가, `to`가 null이면 드랍입니다.

## 계획은 두 화면이 나눠 씁니다

`/trade` 가 계정에 저장하는 값(`userState` 의 `trade` 키, 타입 `SavedTradePlan`)을
**홈도 읽습니다** — 수강 정정 기간의 `[기존 시간표 | 트레이드 계획]` 전환입니다
(`hooks/useTradePlan.ts` → `lib/plannedHome.ts`).

| 저장 항목 | 쓰임 |
|---|---|
| `stuId` | **홈은 내 학번일 때만 그립니다.** 트레이드는 남의 시간표도 열 수 있어서, 이게 없으면 남의 계획이 "내 시간표" 자리에 앉습니다 |
| `actions` · `addSelections` · `moveTargets` | 무엇을 어떻게 바꾸는가 (`PlanState`) |
| `previewKey` | 목록에서 **고른 조합**. 없으면 자동(첫 조합) |

⚠️ **`previewKey` 를 저장에서 빼지 마세요.** 두 화면이 각자 첫 조합을 고르게 되어,
같은 계획인데 홈과 트레이드의 시간표가 갈라집니다.

⚠️ **계획 시간표는 `buildPlannedSchedule` 하나로만 계산합니다.** 홈이 따로 세면
같은 이유로 갈라집니다.

## 주의
정원 정보가 없어 **자리 여유는 판정하지 않습니다**. 시간 충돌만 봅니다.
`studentCount`를 참고값으로 노출하고 있습니다.
