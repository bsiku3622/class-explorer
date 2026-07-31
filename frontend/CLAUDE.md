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
│   ├── features.ts           → 한시 기능 노출 플래그 (TRADE_FEATURE)
│   └── friendsApi.ts         → 홈·친구·교시 시각표 질의 (백엔드는 두 앱 공용)
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
│   ├── HomePage.tsx          → 홈 — 지금 교시·가야 할 교실·오늘 시간표·급식·공강 친구
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

배포 시 Vercel 프로젝트 → Settings → Environment Variables 에서 설정.

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

## 홈 (`/`)

**검색이 `/` 에서 `/search` 로 옮겨졌습니다.** 예전에 공유된 `/?q=…` 링크는 `App.tsx` 가
`/search` 로 넘겨 줍니다 — 그 리다이렉트를 지우면 옛 링크가 죽습니다.

- **`GET /home` 한 번에 다 받습니다.** 켜자마자 보이는 자리라 여러 번 물어보면 화면이
  조각조각 채워지는 게 보입니다
- **1분마다 다시 받습니다.** "지금 몇 교시" 가 화면에 떠 있는 값이라 멈춰 있으면 틀립니다
- **"지금"은 서버 시계 기준**입니다. 클라이언트 시계는 틀어질 수 있습니다
- 급식은 `KSAIN_API_KEY` 가 있어야 옵니다. 없으면 그 칸만 안 그립니다

**방학·주말도 레이아웃이 같습니다.** 카드를 통째로 바꾸면 방학 안내가 홈의 주인공이
되어 버립니다 — 자리는 그대로 두고 Now 에 "여름방학입니다", Today 에 연한 한 줄로만
알립니다. 방학 한마디는 날짜로 골라서 하루 안에는 안 바뀝니다.

**급식 강조는 방학·주말에도 켭니다** — 학기가 아니어도 밥은 나옵니다.

### 이 화면에서 색 하나는 뜻 하나입니다

| 색 | 뜻 |
|---|---|
| `retro-accent1` (시안) | **지금** — 현재 수업 카드, 지금 시간대의 끼니 |
| `retro-accent2` (노랑) | 지금만 열려 있는 **한시 기능** — Trade 배너 |
| `retro-accent3` (핑크) | **지금 공강인 친구** |

Trade 배너는 `isTradeAvailable(term)` 일 때만 그립니다. 급식 강조를 노랑으로 두면
배너와 같은 색이 두 뜻을 갖게 됩니다.

친구 배지도 `friends.counted` 일 때만 그립니다 — 수업 시간이 아니면 "공강" 이라고 할
게 없는데 핑크가 떠 있으면 거짓말이 됩니다.

### 친구

**탭이 없습니다.** 시간표를 겹쳐 보는 일은 Trade 의 Timetable Compare 가 하고 있어서,
홈의 "지금 공강인 친구" 를 누르면 뜨는 모달(`FriendsModal`)에 목록·추가·삭제만 뒀습니다.

**검색창은 하나입니다.** 먼저 등록한 사람을 걸러 보여 주고, 거기 없으면 그때 전교생에서
찾아 추가하라고 내밉니다 — 찾기와 추가를 따로 두면 "이미 등록했나?" 를 확인하러 두 곳을
봐야 합니다. 전교생 조회는 두 글자부터, 8명까지입니다.

등록은 **단방향**입니다 — 추가하면 끝이고 상대의 수락이 없습니다. 이 앱은 어차피 학기
전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는 게 없습니다. 사람 찾기는
`allClassesData` 에서 로컬로 합니다

## 한시 기능 (features.ts)
`TRADE_FEATURE.enabled`를 `false`로 내리면 `/trade` 라우트와 메뉴가 통째로 사라집니다.
학기 조건(`year`/`semester`)도 함께 검사하므로 다른 학기를 보고 있으면 노출되지 않습니다.
