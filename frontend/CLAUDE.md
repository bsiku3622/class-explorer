# Frontend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

## 디렉토리 구조
```
src/
├── App.tsx                   → 라우터 + 전역 상태 관리 (prop drilling 허브)
├── main.tsx                  → React 앱 진입점 (HeroUIProvider + BrowserRouter)
├── index.css                 → Tailwind v4 테마 + 전역 스타일
├── types/
│   └── index.ts              → 공통 TypeScript 인터페이스
├── lib/
│   ├── utils.ts              → 공통 상수 + 유틸 함수
│   └── searchEngine.ts       → 클라이언트 검색 엔진 (논리 연산)
├── constants/
│   └── motion.ts             → Framer Motion 설정값
├── hooks/
│   └── useModifierKey.ts     → Cmd/Ctrl 키 감지 훅
├── pages/
│   ├── SearchPage.tsx        → 통합 검색 (Feature: Search Engine)
│   ├── RoomsPage.tsx         → 빈 강의실 탐색 (Feature: Room Finder)
│   └── AnalysisPage.tsx      → 학사 통계 (Feature: Data Analysis)
└── components/
    ├── atoms/                → 재사용 원자 컴포넌트 6종
    ├── molecules/            → 복합 컴포넌트 3종
    └── (root)                → 오거니즘 컴포넌트 9종
```

## 상태 관리 (App.tsx)
모든 전역 상태는 `App.tsx`에서 관리되고 각 페이지에 props로 전달됩니다.

| 상태 | 타입 | 역할 |
|------|------|------|
| `allClassesData` | `SubjectData[]` | API 원본 전체 데이터 |
| `displayData` | `SubjectData[]` | 검색/필터 적용된 표시 데이터 |
| `searchInput` | `string` | 입력 필드 값 (300ms debounce) |
| `searchTerm` | `string` | 실제 검색 실행 값 |
| `selectedYears` | `string[]` | 선택된 학년 필터 |
| `searchResult` | `SearchResultStats \| null` | 검색 결과 메타 정보 |
| `searchMode` | `'general' \| 'student' \| 'teacher' \| 'room'` | 현재 검색 모드 |

## 핵심 함수 (App.tsx)
| 함수 | 역할 |
|------|------|
| `fetchInitialData()` | API fetch + localStorage 캐싱 (1h TTL) |
| `handleSearch()` | searchInClient 호출 → 상태 업데이트 |
| `buildSearchValue()` | prefix(student:/teacher:/room:) 조립 |
| `handleSearchToggle()` | 동일 값이면 검색어 초기화, 다르면 설정 |
| `handleSearchSelect()` | 항상 해당 값으로 검색어 설정 |

## 데이터 캐싱
- 키: `ksa_class_finder_cache`
- 만료: 1시간 (3,600,000ms)
- 저장 내용: `{ timestamp, student_counts, data }`
- 강제 갱신: `fetchInitialData(true)` 호출

## 관련 가이드
| 파일 | 내용 |
|------|------|
| [design-guide.md](design-guide.md) | 디자인 규칙 |
| [component-guide.md](component-guide.md) | 컴포넌트 사전 |
| [src/App.guide.md](src/App.guide.md) | App.tsx 상세 |
| [src/lib/searchEngine.guide.md](src/lib/searchEngine.guide.md) | 검색 엔진 상세 |
