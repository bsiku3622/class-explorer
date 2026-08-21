# App.tsx Guide

> [← Frontend Guide](../CLAUDE.md)

## 역할
라우터 + 전역 상태 허브. 모든 페이지 공통 상태를 관리하고 props로 전달합니다.
모든 페이지는 `React.lazy()` + `Suspense`로 동적 로드됩니다.

## 상태 목록
| 상태 | 초기값 | 설명 |
|------|--------|------|
| `sessionToken` | localStorage | 인증 토큰. null이면 LoginPage 렌더 |
| `currentUser` | `null` | `{ id, username, is_admin }` — `/auth/me` 응답 |
| `allClassesData` | `[]` | API 원본 전체 데이터 (캐시 포함) |
| `displayData` | `[]` | 현재 필터/검색 적용된 표시 데이터 |
| `stats` | `null` | 검색 없을 때 전체 통계 (있으면 null) |
| `studentCounts` | `{}` | 학년별 학생 수 (필터 UI용) |
| `selectedYears` | `[]` | 체크된 학년 목록 |
| `searchInput` | URL `?q=` | 입력 필드 값 |
| `searchTerm` | URL `?q=` | 실제 검색어 (300ms debounce) |
| `searchResult` | `null` | 검색 결과 메타 정보 |
| `searchMode` | `'general'` | 현재 검색 모드 |
| `hoveredEntityId` | `null` | 호버된 엔티티 ID (EntityCard 연동) |
| `expandedSubjects` | `[]` | 펼쳐진 과목 이름 목록 |
| `lastUpdated` | `null` | 마지막 데이터 fetch 타임스탬프 |
| `loading` | `true` | 데이터 로딩 상태 |
| `term` | localStorage | 현재 조회 학기 `{ year, semester }`. null이면 서버가 최신 학기 선택 |
| `availableTerms` | `[]` | 데이터가 존재하는 학기 목록 (API `available_terms`) |

## useMemo 파생 상태
| 값 | 의존 | 설명 |
|----|------|------|
| `isLogicalSearch` | searchTerm | `+`, `&`, `/`, `(` 포함 여부 |
| `isConsolidatedView` | searchMode, isLogicalSearch | 통합 뷰 여부 |
| `studentSubjectMap` | allClassesData | 학번 → 과목 목록 매핑 |
| `teacherSubjectMap` | allClassesData | 교사 → 과목→분반 목록 매핑 |
| `hasStudentInSearch` | searchResult | 검색 결과에 학생 엔티티 있음 여부 |

## 인증 흐름
```
sessionToken === null → <LoginPage onLogin={handleLogin} /> (전체 앱 대체)
handleLogin(token) → localStorage.setItem + setSessionToken → 메인 앱 렌더
handleLogout() → POST /api/auth/logout → localStorage 클리어 → setSessionToken(null)
fetchInitialData() 401 → handleLogout() 자동 호출
```
- localStorage 키: `ksa_session_token` (세션), `ksa_class_finder_cache_{year}_{semester}` (학기별 데이터 캐시), `ksa_selected_term` (선택 학기)
- 로그아웃 시 `ksa_class_finder_cache` prefix 키를 모두 삭제 (`clearDataCache()`)
- 세션 토큰 있으면 앱 마운트 시 `/auth/me` 호출 → `currentUser` 설정

## 핵심 로직

### 학기 전환
```
term(null) → GET /            → 서버가 최신 학기 응답 → term 확정 + 캐시 저장
term(있음) → GET /?year=&semester=

handleTermChange(next)
  → setTerm + localStorage 저장
  → fetchInitialData(false, next)   // 캐시 유효하면 즉시 복원
```
캐시 키가 학기별로 갈리므로 학기를 오가도 재요청 없이 복원됩니다.
`fetchInitialData(force, targetTerm)`의 `targetTerm`은 state 반영 전 즉시 조회할 때 사용합니다.

### 검색 debounce (300ms)
```ts
searchInput → (300ms) → searchTerm → handleSearch() → displayData
```

### URL 동기화
- `?q=` 파라미터와 `searchTerm` 양방향 동기화 (300ms debounce)
- 초기 로드 시 URL `?q=`를 `initialSearch`로 사용

### buildSearchValue / handleSearchToggle / handleSearchSelect
```ts
buildSearchValue(value, isTeacher, isRoom)
  → isRoom    → "room:value"
  → isTeacher → "teacher:value"
  → "-" 포함  → "student:value"
  → 기타      → "value"

handleSearchToggle: 동일 값이면 검색어 초기화, 다르면 설정
handleSearchSelect: 항상 해당 값으로 설정
```

## 라우팅
```tsx
sessionToken=null → LoginPage (라우터 밖, 전체 화면 대체)
/                 → SearchPage (전역 상태 대부분 props 전달)
/emptyroomfinder  → RoomsPage (allClassesData, onRoomSearch)
/analysis         → AnalysisPage (allClassesData, studentCounts, lastUpdated, fetchInitialData, handleSearch=handleSearchToggle)
/browse           → BrowsePage (allClassesData, studentCounts, lastUpdated, fetchInitialData, handleSearch=handleSearchSelect)
/about            → SettingsPage (props 없음)
/admin            → AdminPage (is_admin=true일 때만 라우트 등록)
/*                → currentUser 가 있으면 Navigate to /, 없으면 로딩 화면
```

**`/*` 가 곧장 홈으로 보내면 안 됩니다.** `/admin` 과 `/trade` 는 역할·학기에 따라
**나중에** 등록되는 라우트라, `/auth/me` 가 도착하기 전 첫 렌더에서는 존재하지
않습니다. 그 순간 `/*` 이 걸려 `replace` 로 홈에 덮어쓰면 주소창으로 들어오거나
그 페이지에서 새로고침한 사람이 홈으로 튕기고 뒤로 가기도 막힙니다. 그래서
`currentUser` 가 정해질 때까지 판단을 미룹니다 — 권한이 없는 사람은 역할이
확인된 뒤 그대로 홈으로 갑니다.

## 레이아웃 구조
```
Navigation (fixed top) — TermSwitcher 포함
  ↓
Sidebar (fixed left, md+)
  ↓
main content (flex-1, pt-20, md:ml-64)
  ↓
BottomNav (fixed bottom, 모바일 전용)
```
