# pages/AnalysisPage.tsx Guide

> [← Frontend Guide](../../CLAUDE.md)

## 역할
학사 데이터 통계 대시보드. 시간표 비교, 학생/교사/강의실 통계를 시각화합니다.

## Props
| prop | 타입 | 설명 |
|------|------|------|
| `allClassesData` | `SubjectData[]` | 전체 수업 데이터 |
| `studentCounts` | `Record<string, number>` | 학년별 학생 수 (필터용) |
| `lastUpdated` | `number \| null` | 마지막 fetch 타임스탬프 |
| `fetchInitialData` | `(force?: boolean) => void` | 데이터 새로고침 |
| `loading?` | `boolean` | 로딩 상태 (기본값 `false`) |
| `handleSearch` | `(value, isTeacher?, isRoom?) => void` | 검색 페이지로 이동 |

## 섹션 구조
```
PageHeader (Visual Analysis)
  ↓
FilterSection (학년 선택)
  ↓
상단 통계 4개 (Total Hrs, Active Rms, Subjects, Avg Size)
  ↓
AccordionSection: Timetable Compare          → 학생 스케줄 비교 + 충돌 감지
AccordionSection: Subjects by Enrollment     → 과목별 학생 수 바 차트
AccordionSection: Weekly Periods Distribution → 주당 교시 수 분포 바 차트
AccordionSection: Subject Count Distribution  → 수강 과목 수 분포 바 차트
AccordionSection: Teaching Load              → 교사별 교시 수 바 차트       ┐ 2열 그리드
AccordionSection: Classroom Utilization      → 강의실 사용률 바 차트        ┘
AccordionSection: Teacher Load Distribution  → 교사 교시 수 분포 바 차트
```

## 데이터 처리 (useMemo)

| 파생값 | 설명 |
|--------|------|
| `studentInfoMap` | 학번 → `{ name, schedule: {"MON-2": "수학", ...} }` |
| `studentSuggestions` | compareSearch 기반 학생 자동완성 (최대 5개) |
| `commonFreePeriods` | 선택된 학생들의 공통 빈 교시 `"MON-2"` 배열 |
| `conflictCount` | 선택된 학생들이 같은 시간대에 다른 수업을 듣는 시간대 수 |
| `allSubjectStats` | 과목별 학생 수 내림차순 (학년 필터 적용) |
| `allTeacherStats` | 교사별 `{ sections, periods }` 교시 수 내림차순 |
| `allRoomStats` | 강의실별 `{ sectionCount, periods }` 사용 교시 내림차순 |
| `weeklyPeriodsStats` | 주당 교시 수 → 해당 학생 수 분포 |
| `subjectCountStats` | 수강 과목 수 → 해당 학생 수 분포 |
| `teacherLoadDistribution` | 교사 교시 수 → 해당 교사 수 분포 |
| `subjectYearStats` | 과목별 학년별 학생 수 (YearBreakdown용) |
| `periodsYearStats` | 교시 수별 학년별 학생 수 분포 |
| `subjectCountYearStats` | 과목 수별 학년별 학생 수 분포 |

## Timetable Compare 기능
1. 학생 검색 입력 (이름/학번, 2글자 이상)
2. 자동완성에서 선택 → `selectedStudentIds` 추가
3. 5×11 그리드에 각 학생 스케줄 시각화
4. 셀 클릭 → Tooltip으로 학생별 수업/빈 시간 표시
5. `commonFreePeriods`: `bg-retro-green/20` (공통 빈 교시)
6. 공통 수업: `bg-retro-primary/20`
7. **충돌 감지**: 모두 수업 중이지만 다른 과목 → `bg-orange-100` (주황)
8. 충돌 배지: "X Conflict(s)" — Common Empty Slots 옆 표시

## ShowMoreButton 내부 컴포넌트
- `totalCount <= 15`이면 렌더링 안 함
- 펼침 상태 (`expandLists`) 별도 관리
- `RetroButton` (sm size, Plus/Minus 아이콘)

## 키보드 처리
- `ArrowUp/Down`: 자동완성 포커스 이동
- `Enter`: 포커스 학생 추가
- `Escape`: 활성 셀 닫기
- `e.nativeEvent.isComposing` 체크로 한글 IME 방지
