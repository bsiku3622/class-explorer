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
│   ├── searchEngine.ts       → 클라이언트 검색 엔진 (논리 연산 + 유사도 매칭)
│   ├── tradeEngine.ts        → 수강 변경 조합 탐색 (슬롯 충돌 기반)
│   ├── curriculum.ts         → 졸업 요건 진척도 + 평점 + 선수관계 그래프 배치
│   ├── userState.ts          → 계정별 화면 상태 저장/복원 (localStorage 이관 포함)
│   └── features.ts           → 한시 기능 노출 플래그 (TRADE_FEATURE)
├── constants/
│   └── motion.ts             → Framer Motion 설정값
├── hooks/
│   └── useModifierKey.ts     → Cmd/Ctrl 키 감지 훅
├── pages/
│   ├── LoginPage.tsx         → 로그인 폼 (미인증 시 전체 화면 대체)
│   ├── AdminPage.tsx         → 관리자 대시보드 (사용자/세션/데이터 관리, admin 전용)
│   ├── SearchPage.tsx        → 통합 검색
│   ├── RoomsPage.tsx         → 빈 강의실 탐색
│   ├── AnalysisPage.tsx      → 학사 통계 대시보드
│   ├── BrowsePage.tsx        → 학생·교사 목록 + 교육과정 그래프
│   ├── TradePage.tsx         → 수강 변경 탐색 (2026-2 한정, features 플래그)
│   ├── ZamongPage.tsx        → 교육과정 이수 현황 + 평점 (학번 등록 필요)
│   └── SettingsPage.tsx      → 기능 가이드북 + About
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
| `term` | `Term \| null` | 현재 조회 중인 학기 (localStorage 동기화) |
| `availableTerms` | `Term[]` | 데이터가 존재하는 학기 목록 (API 응답 기반) |

## 핵심 함수 (App.tsx)
| 함수 | 역할 |
|------|------|
| `handleLogin(token)` | token을 localStorage + state에 저장 |
| `handleLogout()` | 서버 logout 호출 → localStorage 클리어 → sessionToken null |
| `fetchInitialData(force?, targetTerm?)` | 지정 학기 API fetch + 학기별 localStorage 캐싱 (1h TTL), 401 시 자동 logout |
| `handleTermChange(term)` | 학기 전환 → localStorage 저장 후 해당 학기 재조회 |
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
| `VITE_GOOGLE_CLIENT_ID` | 학교 구글 계정 로그인용. 없으면 버튼을 아예 그리지 않습니다 |

**dev 서버는 `https://localhost:5188`입니다.** 구글 OAuth 허용 origin 에 이 주소가
등록돼 있어서, 포트를 바꾸면 구글 로그인이 막힙니다.

배포 시 Netlify 대시보드 → Environment variables에서 설정.

## 코드 스플리팅
모든 페이지는 `React.lazy()` + `Suspense`로 동적 로드됩니다.
- 로딩 중: "Loading..." 풀스크린 폴백
- 빌드 청크: `heroui` (HeroUI), `vendor` (React/router), 페이지별 개별 청크

## 인증 흐름
- `sessionToken === null` → `<LoginPage onLogin={handleLogin} />` 렌더 (전체 앱 대체)
- `sessionToken` 존재 → 정상 라우팅
- `fetchInitialData` 401 응답 → `handleLogout()` 자동 호출 → LoginPage로
- localStorage 키: `ksa_session_token`
- 로그아웃 시 캐시(`ksa_class_finder_cache`)도 함께 삭제

## 로그인

로그인 화면은 탭 두 개입니다 — **학교 계정**(구글)과 **아이디**(옛 계정).

구글로 들어오면 이메일이 곧 학번이라(`25-059@ksa.hs.kr`) `stu_id`가 자동으로 정해집니다.
아이디로 들어온 계정은 `email`이 비어 있고, `App.tsx`가 `<GoogleLinkModal />`을 띄워
연결하기 전까지 앱 화면을 아예 렌더링하지 않습니다.

그래서 앱 안에서는 **`stu_id`가 항상 있다고 봐도 됩니다.**

## 계정과 학번

`currentUser.stu_id`가 이 계정이 누구인지 정합니다. 없으면 Plan 화면이
`<LinkStudentModal />`을 띄워 본인 학번·이름을 받습니다 (서버가 둘을 대조).

| 화면 | 대상 학생 |
|------|-----------|
| Zamong | **본인 고정** — 성적은 본인 것만 기록합니다 |
| Trade | 본인이 기본값, 다른 학생도 선택 가능 (친구 계획을 봐주는 쓰임) |
| Search·Browse | 제한 없음 — 탐색 도구입니다. 교육과정 그래프도 학번 없이 봅니다 |

## 계정별 화면 상태

작업 중인 계획(Plan·Trade)은 **계정**에 저장됩니다. 기기를 옮겨도 이어서 쓸 수 있게
하려는 것이라, localStorage에 담지 않습니다.

| 대상 | 저장 위치 |
|------|-----------|
| 트레이드 계획 | `PUT /state/trade` |
| 이수 체크와 평어 | `PUT /curriculum/grades` (본인 것) |

`src/lib/userState.ts`의 `loadState`/`saveState`를 씁니다. 예전 기기에 남은 값
(`ksa_plan_state`, `ksa_trade_state`)은 처음 열 때 한 번 서버로 옮기고 지웁니다.

**불러오기 전에는 저장하지 않습니다.** 마운트 직후 빈 상태로 저장이 돌면 서버 값을
덮어써 날려버립니다 — 두 페이지 모두 `restored` 플래그로 막고 있습니다.

## 데이터 캐싱
- 키: `ksa_class_finder_cache_{year}_{semester}` — **학기별로 분리**
- 만료: 1시간 (3,600,000ms)
- 저장 내용: `{ v, timestamp, student_counts, data, available_terms }`
- `v`는 스키마 버전(`CACHE_VERSION`, 현재 **3**). **API 응답에 필드를 추가하면 반드시
  올리세요** — 안 올리면 예전 응답을 든 브라우저가 최대 1시간 동안 새 필드를 못 받습니다
- 강제 갱신: `fetchInitialData(true)` 호출
- 로그아웃 시 `ksa_class_finder_cache` prefix가 붙은 키를 모두 삭제

## 학기 전환
- 선택 학기: `ksa_selected_term`에 `{ year, semester }` 저장 → 새로고침 시 유지
- 저장된 학기가 없으면 학기 파라미터 없이 요청 → 서버가 최신 학기를 응답 (`term` 필드)
- UI: `<TermSwitcher />` (Navigation 우측). 학기가 1개뿐이면 렌더링하지 않음

## 관련 가이드
| 파일 | 내용 |
|------|------|
| [design-guide.md](design-guide.md) | 디자인 규칙 |
| [component-guide.md](component-guide.md) | 컴포넌트 사전 |
| [src/App.guide.md](src/App.guide.md) | App.tsx 상세 |
| [src/lib/searchEngine.guide.md](src/lib/searchEngine.guide.md) | 검색 엔진 상세 |
| [src/lib/tradeEngine.guide.md](src/lib/tradeEngine.guide.md) | 수강 변경 탐색 엔진 상세 |
| [src/lib/curriculum.guide.md](src/lib/curriculum.guide.md) | 교육과정 진척도·그래프 상세 |

## 한시 기능 (features.ts)
`TRADE_FEATURE.enabled`를 `false`로 내리면 `/trade` 라우트와 메뉴가 통째로 사라집니다.
학기 조건(`year`/`semester`)도 함께 검사하므로 다른 학기를 보고 있으면 노출되지 않습니다.
