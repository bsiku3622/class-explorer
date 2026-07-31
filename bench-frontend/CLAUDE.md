# ksa-bench Frontend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md) · class-explorer 쪽은 [`frontend/CLAUDE.md`](../frontend/CLAUDE.md)

**여기는 `bench-frontend/` 입니다.** 전교생에게 열 ksa-bench 이고, 백엔드도
`backend.bench_main:app` 을 봅니다 (`backend.main:app` 이 아닙니다).

⚠️ **지금은 보류 중입니다.** 배포 여부가 안 정해져서 메인은 class-explorer(`frontend/`)로
돌아갔습니다. 새 기능은 그쪽에 먼저 넣고, 둘 다 필요한 것만 백엔드 공용 라우터로 둡니다.

dev 서버는 `https://localhost:5189` 입니다. class-explorer(5188)와 나란히 띄울 수 있습니다.

### class-explorer 와 다른 점

| | class-explorer | 여기 |
| --- | --- | --- |
| 분반 → 학생 명단 | 있음 | 있음 — Trade 가 필요로 합니다 (아래 참고) |
| 사람 검색 | 클라이언트가 통째로 훑음 | 서버에 질의, **한 번에 한 명** |
| 검색 결과 | 여러 명의 시간표가 한 화면에 | 후보 목록 → 하나 고르면 그 사람 시간표 |
| 불린 연산·초성 | 있음 | 없음 |
| `/browse` | 학생·교사·교육과정 | 교사·교육과정 |
| `/admin` | 있음 | 없음 (아래 참고) |
| 친구 | **있음** (동일) | 있음 — 단방향 등록 + 공강 격자 + 지금 공강 |

축은 **훑는 화면을 없애는 것**입니다. 학교 공식 앱(가온누리)에도 전교생 시간표 검색이
있고 학번이 연속이라 순회하면 긁히므로, 완전히 막는 건 의미가 없습니다. 대신 한 번에
여러 명이 나오는 경로를 없앱니다.

⚠️ **분반 명단은 응답에 들어 있습니다.** 처음엔 뺐지만 Trade 가 "이 분반 수강생 중 내
분반을 받을 수 있는 사람"을 찾는 기능이라 성립하지 않아 되돌렸습니다. Trade 를 매칭
방식으로 새로 만들면 그때 다시 뺄 수 있습니다.

### 사람 찾기 흐름

`student:김민` 처럼 치면 `App.tsx` 가 `studentQuery` 를 뽑아 서버에 물어봅니다.

```
student:김민  →  GET /students/search?q=김민   →  후보 목록 (이름·학번만)
                 ↓ 후보를 고르면
                 GET /students/{stuId}          →  그 한 명의 시간표
```

후보가 딱 한 명이면 2단계를 자동으로 건너뜁니다. 화면은 `components/StudentLookup.tsx`.

서버에 **최소 2글자·결과 20명 상한·계정 단위 rate limit** 이 걸려 있습니다.
자세한 값은 [`backend/bench_router.guide.md`](../backend/bench_router.guide.md).

### 아직 없는 것

- **`/admin`** — bench 백엔드에 `/admin/*` 을 등록하지 않았습니다 (`/admin/students` 가
  전교생 명단을 그대로 돌려줍니다). 필요해지면 안전한 것만 골라 새로 만드세요
- **Analysis 의 Timetable Compare** — 친구 화면(`/friends`)이 대신합니다. 거기서는
  과목명 없이 **언제 비는지만** 보여 줍니다

### 고칠 때 주의

- **여러 명을 한 번에 조회하는 길을 다시 만들지 마세요.** 학번이 연속이라 그 순간
  전교생이 한 방에 긁힙니다. 이 앱의 전제가 거기 걸려 있습니다
- **친구 등록은 단방향입니다.** 수락 절차를 붙이지 마세요 — 남의 시간표는 어차피 한
  명씩 볼 수 있어서, 승인은 마찰만 늘고 막아 주는 게 없습니다
- 학번 분포(`year_counts`)는 **의도적으로 남긴 것**입니다. 선은 "이름이 안 나간다" 이지
  "아무 숫자도 안 나간다" 가 아닙니다 — 분포만으로는 누구인지 좁혀지지 않습니다

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
│   ├── benchApi.ts           → 사람 관련 서버 질의 (검색·시간표·통계·본인 이수)
│   ├── searchEngine.ts       → 과목·교사·강의실 검색 (논리 연산·초성 없음)
│   ├── curriculum.ts         → 졸업 요건 진척도 + 평점 + 선수관계 그래프 배치
│   └── userState.ts          → 계정별 화면 상태 저장/복원 (localStorage 이관 포함)
├── constants/
│   └── motion.ts             → Framer Motion 설정값
├── hooks/
│   └── useModifierKey.ts     → Cmd/Ctrl 키 감지 훅
├── pages/
│   ├── LoginPage.tsx         → 로그인 폼 (미인증 시 전체 화면 대체)
│   ├── SearchPage.tsx        → 과목 검색 + 사람 찾기(student:)
│   ├── RoomsPage.tsx         → 빈 강의실 탐색
│   ├── AnalysisPage.tsx      → 학사 통계 대시보드
│   ├── BrowsePage.tsx        → 교사 목록 + 교육과정 그래프 (학생 목록 없음)
│   ├── FriendsPage.tsx       → 친구 등록(단방향) + 공강 격자
│   ├── TradePage.tsx         → 수강 변경 탐색 (분반 명단 사용)
│   ├── ZamongPage.tsx        → 교육과정 이수 현황 + 평점 (본인 것만)
│   ├── CalendarPage.tsx      → 학사일정 달력 + 개인 일정 + 일정 제안
│   └── SettingsPage.tsx      → 기능 가이드북 + About
└── components/
    ├── atoms/                → 재사용 원자 컴포넌트 9종
    ├── molecules/            → 복합 컴포넌트 3종
    └── (root)                → 오거니즘 컴포넌트 15종
```

## 상태 관리 (App.tsx)
모든 전역 상태는 `App.tsx`에서 관리되고 각 페이지에 props로 전달됩니다.

| 상태 | 타입 | 역할 |
|------|------|------|
| `sessionToken` | `string \| null` | 인증 토큰 (localStorage 동기화) |
| `currentUser` | `{ id, username, role, stu_id, … } \| null` | 로그인한 사용자 정보 (`/auth/me`) |
| `allClassesData` | `SubjectData[]` | API 원본 전체 데이터 |
| `displayData` | `SubjectData[]` | 검색/필터 적용된 표시 데이터 |
| `searchInput` | `string` | 입력 필드 값 (300ms debounce) |
| `searchTerm` | `string` | 실제 검색 실행 값 |
| `searchResult` | `SearchResultStats \| null` | 검색 결과 메타 정보 |
| `searchMode` | `'general' \| 'teacher' \| 'room'` | 현재 검색 모드 (학생은 별도 흐름) |
| `studentQuery` | `string \| null` | `student:` 질의. null 이 아니면 사람 찾기 화면 |
| `studentSearch` | `StudentSearchResponse \| null` | 후보 목록 (이름·학번만) |
| `studentTimetable` | `StudentTimetable \| null` | 고른 **한 명**의 시간표 |
| `termStats` | `Stats \| null` | 서버가 세어 준 학기 집계 (명단이 없어 직접 못 셈) |
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
- **사람 관련 조회는 `src/lib/benchApi.ts` 를 거칩니다** — 서버 질의를 한곳에 모아
  두어야 "여러 명을 한 번에 받는 길"이 슬쩍 생기는 걸 막을 수 있습니다
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

로그인은 **아이디·비밀번호 하나뿐**입니다. 계정은 관리자가 만들어 줍니다 — 아는 사람만
쓰는 서비스라 스스로 만드는 길을 두지 않았습니다.

**구글 계정은 로그인이 아니라 학번 확인에만 씁니다.** `email`이 비어 있는 계정에는
`App.tsx`가 `<GoogleLinkModal />`을 띄우고, 확인하기 전까지 앱 화면을 아예 렌더링하지
않습니다. 학교 계정 이메일이 곧 학번이라(`25-059@ksa.hs.kr`) `stu_id`가 함께 정해집니다.

그래서 앱 안에서는 **`stu_id`가 항상 있다고 봐도 됩니다.**

## 권한

`currentUser.role` 은 `user < manager < admin` **위계**입니다. 검사는 `hasRole(role, 최소등급)`
(`lib/utils.ts`)로만 하세요 — `role === "admin"` 처럼 직접 비교하면 매니저를 빠뜨립니다.

| role | 화면에서 |
|------|----------|
| `user` | 내 일정 추가 + 공용 일정 "제안" 버튼 |
| `manager` | "학사일정 추가" 버튼 + 제안 서랍에 허용·거절 |
| `admin` | 위 전부 + 사이드바 Admin 메뉴 |

## 계정과 학번

`currentUser.stu_id`가 이 계정이 누구인지 정합니다. 구글 계정을 확인할 때 이메일에서
함께 정해지므로(`25-059@ksa.hs.kr` → `25-059`) 손으로 받는 화면은 없습니다.

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
- `v`는 스키마 버전(`CACHE_VERSION`, 현재 **4** — 분반 명단이 빠진 응답). **API 응답에 필드를 추가하면 반드시
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
| [../backend/bench_router.guide.md](../backend/bench_router.guide.md) | bench 전용 API 상세 |
| [src/lib/curriculum.guide.md](src/lib/curriculum.guide.md) | 교육과정 진척도·그래프 상세 |

