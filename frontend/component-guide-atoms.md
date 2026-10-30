# Component Guide — Atoms

> [← Component Guide](component-guide.md)

`atoms/` 에는 funky-ui 에 이 앱의 데이터를 얹은 조각만 있습니다. 버튼·카드·칩은 [funky-ui](https://funky-ui.bsiku.dev) 를 보세요.

## StudentBadge
```tsx
<StudentBadge
  studentId="25-001"
  studentName="홍길동"
  size="xs" | "sm" | "md"
  fullId={false}
  buzz={false}
  onClick={fn}
/>
```
- 표시 형식: `"25 홍길동"` (`fullId` 면 `"25-001 홍길동"`)
- 색상: `getStudentColor(studentId)` 자동 매핑
- `onClick` 있으면 클릭 가능 (Tooltip 제거 등에 활용)

## SearchInput
```tsx
<SearchInput
  value={searchInput}
  onChange={(v) => setSearchInput(v)}
  placeholder="Search..."
  className=""
  onEnter={() => submit()}   // 선택 — Enter 로 확정하는 검색일 때
/>
```
- funky-ui `SearchField` 위에 최근 검색어(`enableHistory`)를 얹습니다
- `onEnter` — 글자마다 서버에 물을 수 없는 검색(Admin 기억 패널)은 Enter 로 확정합니다.
  **한글 조합 중의 Enter 는 이 안에서 거릅니다**(`isComposing`) — 안 거르면 한 번 누른 Enter 가
  두 번 들어옵니다. 주면 모바일 키보드의 Enter 자리에 "검색" 이 뜹니다(`enterKeyHint`)

## StudentCard
```tsx
<StudentCard
  stuId="25-001"
  name="홍길동"
  subjects={["수학(Math I)(1)", "물리(Physics)(2)"]}
  onClick={fn}
/>
```
- funky-ui `PersonCard` — 좌 패널: 학번 + 이름 (학번 색상 배경), 우 패널: Enrolled Classes 2열
- `onClick` 있으면 누르는 카드가 됩니다
- 주로 Popover 내부 콘텐츠로 사용

## TeacherCard
```tsx
<TeacherCard
  name="홍길동"
  subjects={["수학(Math I)(1분반)", "수학(Math I)(2분반)"]}
  onClick={fn}
/>
```
- funky-ui `PersonCard` — 좌 패널: 교사 이름, 우 패널: Assigned Classes 목록
- `onClick` 있으면 누르는 카드가 됩니다
- 주로 Popover 내부 콘텐츠로 사용
