# App.tsx Guide

> [← Frontend Guide](../CLAUDE.md)

## 역할
라우터 + 전역 상태 허브. 모든 페이지 공통 상태를 관리하고 props로 전달합니다.

## 상태 목록
| 상태 | 초기값 | 설명 |
|------|--------|------|
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

## useMemo 파생 상태
| 값 | 의존 | 설명 |
|----|------|------|
| `isLogicalSearch` | searchTerm | `+`, `&`, `/`, `(` 포함 여부 |
| `isConsolidatedView` | searchMode, isLogicalSearch | 통합 뷰 여부 |
| `studentSubjectMap` | allClassesData | 학번 → 과목 목록 매핑 |
| `teacherSubjectMap` | allClassesData | 교사 → 과목→분반 목록 매핑 |
| `hasStudentInSearch` | searchResult | 검색 결과에 학생 엔티티 있음 여부 |

## 핵심 로직

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
  → isRoom  → "room:value"
  → isTeacher → "teacher:value"
  → "-" 포함 → "student:value"
  → 기타 → "value"

handleSearchToggle: 동일 값이면 검색어 초기화, 다르면 설정
handleSearchSelect: 항상 해당 값으로 설정
```

## 라우팅
```tsx
/ → SearchPage (대부분의 props 전달)
/emptyroomfinder → RoomsPage (allClassesData만 전달)
/analysis → AnalysisPage (allClassesData + handleSearchToggle)
/* → Navigate to /
```
