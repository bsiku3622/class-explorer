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
│   ├── api.ts                → axios 인스턴스 (VITE_API_BASE_URL 기반 baseURL)
│   ├── utils.ts              → 공통 상수 + 유틸 함수
│   └── searchEngine.ts       → 클라이언트 검색 엔진 (논리 연산)
├── constants/
│   └── motion.ts             → Framer Motion 설정값
├── hooks/
│   └── useModifierKey.ts     → Cmd/Ctrl 키 감지 훅
├── pages/
│   ├── LoginPage.tsx         → 로그인 폼 (미인증 시 전체 화면 대체)
│   ├── AdminPage.tsx         → 관리자 대시보드 (사용자/세션/데이터 관리, admin 전용)
│   ├── SearchPage.tsx        → 통합 검색 (Feature: Search Engine)
│   ├── RoomsPage.tsx         → 빈 강의실 탐색 (Feature: Room Finder)
│   ├── AnalysisPage.tsx      → 학사 통계 (Feature: Data Analysis)
│   ├── StudentsPage.tsx      → 학생 목록 + StudentCard 검색
│   └── TeachersPage.tsx      → 교사 목록 + TeacherCard 검색
└── components/
    ├── atoms/                → 재사용 원자 컴포넌트 9종
    ├── molecules/            → 복합 컴포넌트 3종
    └── (root)                → 오거니즘 컴포넌트 9종
```

## 상태 관리 (App.tsx)
모든 전역 상태는 `App.tsx`에서 관리되고 각 페이지에 props로 전달됩니다.

| 상태 | 타입 | 역할 |
|------|------|------|
| `sessionToken` | `string \| null` | 인증 토큰 (localStorage 동기화) |
| `currentUser` | `{ id, username, is_admin } \| null` | 로그인한 사용자 정보 (`/auth/me`) |
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
| `handleLogin(token)` | token을 localStorage + state에 저장 |
| `handleLogout()` | 서버 logout 호출 → localStorage 클리어 → sessionToken null |
| `fetchInitialData()` | API fetch + localStorage 캐싱 (1h TTL), 401 시 자동 logout |
| `handleSearch()` | searchInClient 호출 → 상태 업데이트 |
| `buildSearchValue()` | prefix(student:/teacher:/room:) 조립 |
| `handleSearchToggle()` | 동일 값이면 검색어 초기화, 다르면 설정 |
| `handleSearchSelect()` | 항상 해당 값으로 검색어 설정 |

## API 호출
- **항상 `src/lib/api.ts`의 인스턴스 사용** — `axios` 직접 import 금지
- `baseURL`: `VITE_API_BASE_URL` 환경변수 값, 없으면 `"/api"` (Vite 프록시)
- 경로는 `/api` prefix 없이 작성: `api.get("/")`, `api.post("/auth/login")`

## 환경변수
| 변수 | 설명 |
|------|------|
| `VITE_API_BASE_URL` | 백엔드 서버 주소. 비워두면 Vite 프록시 사용 (로컬 개발) |

배포 시 Netlify 대시보드 → Environment variables에서 설정.

## 인증 흐름
- `sessionToken === null` → `<LoginPage onLogin={handleLogin} />` 렌더 (전체 앱 대체)
- `sessionToken` 존재 → 정상 라우팅
- `fetchInitialData` 401 응답 → `handleLogout()` 자동 호출 → LoginPage로
- localStorage 키: `ksa_session_token`
- 로그아웃 시 캐시(`ksa_class_finder_cache`)도 함께 삭제

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
