# Component Guide — Molecules & Organisms

> [← Component Guide](component-guide.md)

## Molecules

### PageHeader
```tsx
<PageHeader
  tag="Feature: Search Engine"
  title="Class Explorer"
  subtitle="Find classes, teachers, rooms"
  icon={SearchIcon}
  action={<RetroButton>...</RetroButton>}
>
  {/* 추가 내용 */}
</PageHeader>
```
- `RetroCard` 기반, `RetroFeatureTag` 내장
- `action`: 우측 버튼 영역

### AccordionSection
```tsx
<AccordionSection
  title="Teaching Load"
  icon={Clock}
  isOpen={openSections.teachers}
  onToggle={() => toggleSection("teachers")}
>
  {/* 내용 */}
</AccordionSection>
```
- 헤더 클릭으로 `onToggle` 호출 (상태는 외부에서 관리)
- 펼침 시 fade-in 애니메이션

### BarChartRow
```tsx
<BarChartRow
  label="수학"
  value={42}
  maxValue={100}
  caption="42 Students"
  layout="horizontal" | "vertical"
  captionClassName="text-retro-primary"
  onLabelClick={() => handleSearch("수학")}
/>
```
- 바 색상: `bg-retro-primary`, 호버: `bg-[#ff7e7e]`
- `onLabelClick`: 라벨 클릭 시 검색 트리거

---

## Organisms

### Navigation
- 상단 고정 (`fixed top-0`), `z-50`
- "Class Explorer" 로고 — 클릭 시 검색 초기화 + `/` 이동
- `bg-retro-secondary` (다크)

### Sidebar
- 좌측 고정 (`fixed left-0`), 모바일 숨김 (`hidden md:flex`)
- 메뉴: Home(`/`), Rooms(`/emptyroomfinder`), Analysis(`/analysis`)
- 활성 페이지: scale + shadow 강조
- 하단: 시스템 상태 패널

### FilterSection
- 학년별 학생 수 표시 + 체크박스 색상 (학번 색상)
- 새로고침 버튼: `fetchInitialData(true)` 호출
- 전체 선택/해제 토글

### SearchResultDisplay
- `isConsolidatedView=true`: 단일 엔티티 / 논리 검색 → 통합 뷰
- `isConsolidatedView=false`: 복수 엔티티 → 그리드 뷰
- `EntityCard` 목록 + `SubjectAccordionItem` 목록 포함

### SectionCard
- 분반 정보: 분반명, 교사, 강의실, 학생 배지, 시간
- 교사/강의실 클릭 → `handleSearchToggle`
- 학생 배지 호버 → Cmd/Ctrl 시 전체 시간표 Tooltip 노출

### SubjectAccordionItem
- 과목 헤더: 분반 수, 학생 수, 교사 요약 바
- 토글 시 `SectionCard` 목록 렌더

### StatsCards
- 3열 그리드: 전체 과목 수, 전체 분반 수, 재학생 수
- `RetroCard + bg-white` 스타일

### TimetableGrid
- 요일(MON~FRI) × 교시(1~11) 격자
- `mode`: `student` | `teacher` | `room`에 따라 표시 내용 변경
- 셀 호버: 색상 오버레이
- 셀 클릭: 과목으로 검색

### EntityCard
- 검색된 학생/교사/강의실 카드
- 좌: 프로필(유형, 이름, ID), 우: 담당 과목 목록
- 클릭 → `handleSearchSelect`
