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
| `move` | 같은 과목의 전체 분반 (현재 분반 포함) |
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
| `applyPlan(schedule, plan)` | 조합을 적용한 최종 시간표 (미리보기용) |
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

## 주의
정원 정보가 없어 **자리 여유는 판정하지 않습니다**. 시간 충돌만 봅니다.
`studentCount`를 참고값으로 노출하고 있습니다.
