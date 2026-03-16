# TimetableGrid Guide

> [← Component Guide](../../../../frontend/component-guide.md)

## 역할
요일(MON~FRI) × 교시(1~11) 시간표 그리드. 검색된 엔티티의 스케줄 시각화.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `times` | `SectionTime[]` | 표시할 시간 슬롯 목록 |
| `mode` | `"student" \| "teacher" \| "room"` | 표시 모드 |
| `handleSearchToggle` | 함수 | 셀 클릭 시 검색 |
| `isModifierPressed` | `boolean` | Tooltip 활성화 조건 |
| `hoveredSubject` | `string \| null` | 호버된 과목 (색상 연동) |

## 모드별 셀 표시
| mode | 표시 내용 |
|------|-----------|
| `student` | 과목명 (한글) |
| `teacher` | 강의실명 |
| `room` | 과목명 + 교사 |

## 셀 상태
```
기본 (점유):   bg-black/[0.07]  과목/교사/강의실 텍스트
비어있음:      bg-transparent (회색 빈 셀)
호버:          bg-retro-primary/20 (해당 과목 전체 하이라이트)
```

## 인터랙션
- 셀 클릭 → `handleSearchToggle(subject)` → SearchPage로 이동
- 셀 호버 → 같은 과목 모든 셀 함께 하이라이트
- Tooltip (Cmd/Ctrl 시): 셀의 과목/교사/강의실 상세 정보

## 사용처
`SearchResultDisplay`의 통합 뷰에서 EntityCard 아래에 배치.
