# Component Guide — Atoms

> [← Component Guide](component-guide.md)

## RetroButton
```tsx
<RetroButton
  variant="primary" | "secondary" | "white" | "black"
  size="sm" | "md" | "lg"
  isSelected={boolean}
  icon={<ReactNode>}
  onClick={fn}
>
  텍스트
</RetroButton>
```
- `isSelected=true` → 검정 배경 + scale-105, 호버 시 translate 없음
- 물리 피드백: 호버 시 쉐도우 숨김 + translate(1,1)
- `icon` prop으로 왼쪽 아이콘 삽입

## RetroCard
```tsx
<RetroCard shadow="sm" | "md" | "lg" className="bg-white p-4">
  내용
</RetroCard>
```
- `border-2 border-black` 기본 적용
- 배경색은 `className`으로 별도 지정 (기본값 없음)
- `shadow`: sm=4px, md=6px, lg=8px 하드 쉐도우

## RetroFeatureTag
```tsx
<RetroFeatureTag feature="Search Engine" />
```
- 부모에 `relative` 필요 (absolute 위치)
- 우상단 고정: `top-0 right-0`
- 검정 배경 + 흰색 `text-[10px] font-black uppercase`

## RetroStatItem
```tsx
<RetroStatItem
  label="SUBJECTS"
  value={42}
  unit="개"
  size="sm" | "lg"
/>
```
- `lg`: `text-5xl font-black` 숫자
- `sm`: `text-4xl font-black` 숫자
- label: `text-xs font-bold text-black/40 uppercase`

## RetroSubTitle
```tsx
<RetroSubTitle title="섹션 제목" icon={SomeIcon} />
```
- 스타일 고정: `text-sm font-bold text-black/40 uppercase tracking-widest`
- 아이콘: `size={18} className="text-black/40"` 자동 적용
- 섹션 소제목은 반드시 이 컴포넌트 사용 (직접 스타일링 금지)

## StudentBadge
```tsx
<StudentBadge
  studentId="25-001"
  studentName="홍길동"
  size="xs" | "sm" | "md"
  onClick={fn}
/>
```
- 표시 형식: `"25 홍길동"`
- 색상: `getStudentColor(studentId)` 자동 매핑
- 스타일: `border-2 border-[color] bg-[color]/15 text-[color]`
- `onClick` 있으면 클릭 가능 (Tooltip 제거 등에 활용)

## SearchInput
```tsx
<SearchInput
  value={searchInput}
  onChange={(v) => setSearchInput(v)}
  placeholder="Search..."
  className=""
/>
```
- HeroUI `Input` 래퍼 (border-radius 0 오버라이드 적용됨)
- 높이 `h-16`, 좌측 Search 아이콘, 값 있을 때 X 버튼 (절대위치 우측)
- 스타일 고정: `border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,0.1)]`

## StudentCard
```tsx
<StudentCard
  stuId="25-001"
  name="홍길동"
  subjects={["수학(Math I)(1)", "물리(Physics)(2)"]}
  onClick={fn}
/>
```
- 좌 패널: stuId + 이름 (학번 색상 배경), 우 패널: Enrolled Classes 2열 그리드
- `onClick` 있으면 버튼 형태 (물리 피드백 shadow/translate 적용)
- 주로 Tooltip 내부 콘텐츠로 사용

## TeacherCard
```tsx
<TeacherCard
  name="홍길동"
  subjects={["수학(Math I)(1분반)", "수학(Math I)(2분반)"]}
  onClick={fn}
/>
```
- 좌 패널: 교사 이름 (`bg-retro-secondary/10`), 우 패널: Assigned Classes 목록
- `onClick` 있으면 버튼 형태 (물리 피드백 shadow/translate 적용)
- 주로 Tooltip 내부 콘텐츠로 사용
