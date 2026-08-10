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
│   ├── navigation.ts         → 메뉴 순서 (사이드바·하단 바가 같이 씁니다)
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
| 자몽 (학기·평어·EC) | `PUT /curriculum/grades` (본인 것) |
| 자몽 시수와 밑칠 여부 | `PUT /state/zamong` |

`src/lib/userState.ts`의 `loadState`/`saveState`를 씁니다. 예전 기기에 남은 값
(`ksa_plan_state`, `ksa_trade_state`)은 처음 열 때 한 번 서버로 옮기고 지웁니다.

⚠️ **불러오기에 성공한 뒤에만 저장합니다.** 둘 다 저장이 **전체 교체**라, 빈 상태로 한
번만 돌아도 서버 기록이 통째로 사라집니다.

`restored` 플래그가 그걸 막는데, 한동안 **요청이 실패해도 플래그를 켜고 있었습니다** —
네트워크가 한 번 튀면 빈 화면이 그대로 저장돼 자몽이 날아가는 길이었습니다. 지금은
응답을 받은 쪽만 켭니다.

- Zamong: 성적·시수 각각 따로 켜고, 못 받았으면 화면에 "지금 고친 건 저장되지
  않습니다" 를 띄웁니다 — **조용히 안 되는 게 제일 나쁩니다**
- Trade: `loadState` 가 못 받았을 때 `null` 대신 **예외를 던집니다**. `null` 은 "저장된
  게 없다" 와 구별이 안 돼서, 부르는 쪽이 빈 상태를 복원하고 그대로 저장합니다

## 응답 캐싱 (`lib/cache.ts`)

학기 데이터 캐시(아래)와 **다른 물건**입니다. 여러 화면이 같이 부르는 작은 것들을 맡습니다.

| 대상 | TTL | 이유 |
|---|---|---|
| `/curriculum` (`lib/curriculumApi.ts`) | 24h | Zamong·Browse·Trade 가 같은 걸 받습니다. 학기 무관 정의라 자주 받을 이유가 없습니다 |
| `/periods` | 24h | 생활관 일과표에서 온 값이라 학기 중에 안 바뀝니다 |
| `/meal?date=` | 지난 날 7d · 오늘·앞날 20분 | 학교 API 가 3~5초 걸립니다. ⚠️ 앞날을 길게 잡으면 아직 안 올라온 날이 빈 채로 굳습니다 |

**같은 키의 요청은 하나로 묶습니다.** 첫 방문에는 캐시가 비어 있어서, 세 화면이 동시에
열리면 `/curriculum` 이 세 번 나갑니다.

⚠️ `api.get("/curriculum")` 을 직접 부르지 말고 `fetchCurriculum()` 을 쓰세요.

로그아웃하면 `clearCache()` 로 통째로 비웁니다.

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
  조각조각 채워지는 게 보입니다 (급식만 예외 — 아래)
- **1분마다 다시 받습니다.** "지금 몇 교시" 가 화면에 떠 있는 값이라 멈춰 있으면 틀립니다
- **"지금"은 서버 시계 기준**입니다. 클라이언트 시계는 틀어질 수 있습니다

### 배치 — **V2 가 배포본**입니다

`HomePage.tsx` 는 **껍데기**(fetch·시계·스위치)이고 화면은
`components/home/TodayCardV{1,2}.tsx` 가 그립니다. V1 은 되돌아볼 자리로 남겼고
**개발에서만** 보입니다 — 프로덕션 번들에는 안 들어갑니다. 파생값(지금 몇 교시·현재
수업·빈 시간)은 **`lib/homeView.ts` 한 곳에서** 셉니다 — 판본마다 따로 계산하면
비교하다 어긋난 걸 배치 탓으로 오해하게 됩니다.

**V1 — 세로로 긴 카드** (개발 전용, 되돌아볼 자리)

```
[Trade 배너]
[ Today ─────────── | Meal ]   2.3fr : 1fr
   날짜·시계·교시 칩
   가로 자 (DayRuler)          ← 하루 전체
   수업 줄 (TodayTimeline)     ← 처음부터 끝까지
```

하루가 다 보이는 대신 **깁니다** — 수업이 일곱이면 600px 을 넘어갑니다.

**V2 — 홈 전체가 낮은 카드 하나**

```
[Trade 배너]
┌ 지금 (18rem) ─┬ 오늘 수업 (1fr, 스크롤) ─┬ 급식 (17rem) ┐
└───────────────┴─────────────────────────┴──────────────┘
```

**급식도 같은 카드 안의 한 칸입니다** (`MealCard bare fill`). 따로 카드를 두면 한 행이
아니라 "큰 상자 + 작은 상자" 로 읽힙니다.

**왼쪽은 진술, 오른쪽 둘은 흐름입니다.** 가운데와 오른쪽은 생김새가 같은 우물(소제목
+ 스크롤 영역)이라 형제로 읽히고, 왼쪽만 고정된 상태를 말합니다.

**너비는 내용이 정합니다** — 왼쪽 18rem 은 과목명 한 줄이 안 접히는 폭, 오른쪽 17rem 은
급식 메뉴 한 줄이 안 접히는 폭. 남는 건 전부 시간표가 가져갑니다.

⚠️ **시간표가 없는 날은 그 칸을 아예 없앱니다.** 방학에 `1fr` 을 빈 채로 두면 화면
한가운데에 600px 짜리 빈 상자가 남습니다 — 2열로 줄이고 남는 폭은 `VacationBar` 가
씁니다(가로로 재는 물건이라 원래 폭이 필요했습니다).

**카드 높이는 "지금" 칸과 "급식" 칸 중 큰 쪽이 정합니다.** 급식은 스크롤하지 않고
그냥 늘어나고(열 줄짜리 목록을 좁은 창으로 들여다보게 하는 것보다 낫습니다), 시간표
칸만 그 안에서 흐릅니다.

⚠️ **시간표 칸은 `absolute inset-0` 으로 띄웁니다.** 열한 줄이라 높이 계산에 끼면
카드가 700px 이 됩니다 — 높이 계산에서 빼고 남는 자리를 채우게 둡니다. 좁은 화면에선
세로로 쌓여 `flex-1` 이 0 이 되므로 그때만 `h-64` 를 직접 줍니다.

⚠️ **스크롤 영역까지 flex 사슬이 이어져야 합니다.** 중간에 그냥 `div` 를 끼우면 높이
제약이 안 내려가서 `overflow-y-auto` 가 무시되고 목록이 **카드 밖으로 흘러넘칩니다.**
칸마다 `min-h-0` + `overflow-hidden`, 안쪽 목록에 `min-h-0 flex-1 overflow-y-auto`.

- **목록은 지금을 가운데 두고 엽니다.** 위에서부터 열면 아침 수업이 보이는데, 이
  화면을 켜는 이유는 대개 "다음이 뭐였지" 입니다. 공강이면 다음 수업을 가운데 둡니다.
  스크롤은 `scrollIntoView` 가 아니라 `box.scrollTop` 으로 옮깁니다 — `scrollIntoView`
  는 페이지까지 끌고 내려갑니다. `useLayoutEffect` + `requestAnimationFrame` 인 이유는
  **높이가 잡히기 전에 재면 0 이 나와서**입니다 (목록이 맨 위에 그대로 남습니다)
- **공강도 한 교시씩 줄로 그립니다** (`TodayTimeline showFree`). 묶어서 "3–4교시 비어
  있음" 한 줄로 두면 줄 높이가 제각각이라 스크롤할 때 리듬이 끊깁니다
- **시계를 두지 않습니다.** 지금이 몇 교시인지가 이 화면의 단위이고, 시각은 목록의
  줄마다 이미 붙어 있습니다

⚠️ **V1 을 그리는 분기 앞에 `import.meta.env.DEV &&` 가 붙어 있습니다.** 이게 없으면
rollup 이 `layout` 이 절대 `"v1"` 이 안 된다는 걸 증명할 수 없어 두 판본을 다 실어
보냅니다. V1 을 완전히 버릴 때 그 분기와 파일을 같이 지우면 됩니다.

**시간표가 넓고 급식이 좁습니다.** 하루가 이 화면의 본문이고, 급식 메뉴는 늘 예닐곱
줄짜리 짧은 목록이라 넓혀 봐야 글자 오른쪽이 빕니다.

⚠️ 급식 카드에 `h-full` 을 걸면 안 됩니다 — grid item 이라 100% 가 **행 높이**로 풀려서
`items-start` 가 무의미해집니다.

**히어로 카드는 없습니다.** 한때 위에 "지금 무슨 수업" 을 큰 글씨로 외치는 카드를
뒀는데, **바로 아래 핑크 줄이 글자까지 똑같은 말**을 하고 있었습니다. 큰 글씨가 새로
주는 게 없으면 자리만 차지합니다 — 다시 세우고 싶으면 목록이 못 하는 말(남은 시간·
이동 여부 같은)을 시키세요.

**모든 시각은 하나의 시계에서 나옵니다.** 서버가 준 `now.minute` 에 그 뒤로 흐른 시간을
더해 씁니다(`state.at` 를 같이 들고 있습니다).

### 수업이 없는 날

**카드는 그대로**이고 자와 목록 자리에 한마디가 들어갑니다. 카드를 통째로 바꾸면
방학 안내가 홈의 주인공이 되어 버립니다.

`today` 를 비우는 건 **서버가 합니다** — 학기 데이터는 요일 단위라 방학에도 "월요일
시간표" 가 그대로 나옵니다. 화면은 `session.has_class` 와 `off_reason`
(`vacation`·`weekend`·`holiday`)만 보면 됩니다.

방학이면 `VacationBar` 가 붙어 **재는 대상을 바꿉니다** — 종업~개학을 한 줄로 놓고
오늘을 캐럿으로 찍습니다. 주말·휴업은 한마디로 끝냅니다.

한마디(`OFF_LINES`)는 날짜로 골라서 **하루 안에는 안 바뀝니다** — 1분마다 다시 받는
화면이라 무작위로 뽑으면 읽는 중에 문장이 갈아치워집니다.

### 문구

홈에 나오는 사람이 읽는 문구는 **사용자가 직접 씁니다.** 고칠 일이 생기면 통째로
JSON 으로 뽑아 넘기고(`id`/`where`/`max`/`value`), 돌려받은 값을 코드에 반영합니다 —
개발자가 문장을 지어내는 것보다 낫고, `max` 를 같이 적어 두면 화면이 깨지지 않습니다.

### 상태 미리보기 (개발 전용)

DEV 바에 줄이 둘 있습니다 — **상태**(실제/수업중/공강/…)와 **배치**(V1/V2).

홈은 대부분이 "오늘이 무슨 날인가" 에 달려 있어서, **방학에 붙잡혀 있으면 수업 중
화면을 볼 방법이 없습니다.** 개학까지 기다리는 게 유일한 방법이면 그동안 그 화면은
아무도 안 본 채로 배포됩니다.

그래서 `import.meta.env.DEV` 에서만 홈 맨 위에 전환 줄이 뜹니다 — 실제 / 수업중 /
공강 / 수업 전 / 수업 끝 / 주말 / 휴업. `src/lib/homeDemo.ts` 가 **실제 응답 위에
상황만 덧씌웁니다** — 교시 시각표·급식·학기는 서버가 준 진짜 값 그대로입니다. 화면이
진짜 데이터로 도는지 보려는 것이지 목업을 보려는 게 아닙니다.

값과 함수뿐인 모듈이라 프로덕션 번들에는 남지 않습니다 (빌드 후 `dist/assets` 에서
확인했습니다).

### 급식 (`MealCard`)

- **메뉴는 카드가 직접 받습니다** (`GET /meal`) — 학교 API 가 3~5초씩 걸려서 홈 응답에
  묶으면 그동안 홈 전체가 비어 있습니다. 따로 받으면 급식 칸만 기다립니다
- **세 끼를 한꺼번에 늘어놓지 않습니다.** 한 끼가 예닐곱 줄이라 셋을 펼치면 카드 혼자
  화면을 차지합니다 — 지금 시간대의 끼니를 골라 두고 나머지는 버튼입니다
- 날짜는 화살표로 앞뒤 31일. **홈이 1분마다 다시 받아도 보고 있던 날짜는 그대로 둡니다**
  — 어제 급식을 읽는 중에 화면이 오늘로 튀면 안 됩니다
- 받는 동안은 **스피너**, 그날/그 끼니가 비면 `No Data Found` — 3~5초를 빈 칸으로 두면
  고장난 것처럼 보입니다
- `KSAIN_API_KEY` 가 없으면 `meal` 이 `null` 로 와서 카드를 아예 안 그립니다

### 이 화면에서 색 하나는 뜻 하나입니다

| 색 | 뜻 |
|---|---|
| `retro-primary` (핑크) | **지금** — 진행 중인 수업 줄, 카드 머리의 교시 칩 (자에서는 검은 캐럿이 짚습니다) |
| `retro-accent1` (시안) | 지금만 열려 있는 **한시 기능** — Trade 배너 |
| 끼니색 (`MealCard`) | 아침 노랑 · 점심 주황 · 저녁 보라. **고른 것만** 채웁니다 |

같은 색이 두 뜻을 갖지 않게 하세요. 배너를 노랑으로 뒀을 때 급식의 "지금 끼니" 강조와
겹쳐서 옮긴 적이 있고, "지금" 이 시안에서 핑크로 옮겨 가면서 배너가 시안을 받았습니다.

⚠️ **칠하는 면은 화면당 하나입니다.** 과목마다 학과색을 입혀 봤더니(면 → 띠 → 점까지
줄여 가며) 하루가 색표처럼 보이고 정작 "지금" 이 묻혔습니다. **지금만 채우고 나머지는
흰색.** `today` 응답의 `department` 는 남아 있지만 색으로 쓰지 않습니다.

### 친구는 Browse 에 있습니다

등록·삭제와 "지금 공강" 은 `/browse` 의 **Friends 탭**(`FriendsManager`)입니다. 홈에
모달로 뒀더니 홈에서 할 일은 등록뿐인데 창을 열어야 했고, 사람을 찾는 일은 어차피
Browse 가 하는 일입니다. 그래서 `GET /home` 도 친구를 돌려주지 않습니다.

**검색창은 하나입니다.** 먼저 등록한 사람을 걸러 보여 주고, 거기 없으면 그때 전교생에서
찾아 추가하라고 내밉니다 (두 글자부터·8명까지). 등록은 **단방향**이라 상대의 수락이
없습니다 — 이 앱은 어차피 학기 전체 데이터를 들고 있어서 승인 절차를 붙여도 막아 주는
게 없습니다.

## 한시 기능 (features.ts)
`TRADE_FEATURE.enabled`를 `false`로 내리면 `/trade` 라우트와 메뉴가 통째로 사라집니다.
학기 조건(`year`/`semester`)도 함께 검사하므로 다른 학기를 보고 있으면 노출되지 않습니다.
