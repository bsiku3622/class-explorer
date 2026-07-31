# CLAUDE.md

## Project

KSA 학생/교사/강의실 기반 수업 탐색 웹 앱.  
**Stack**: React 19 + TypeScript + Vite + Tailwind v4 + HeroUI / FastAPI + SQLAlchemy (SQLite)

### 프론트가 둘입니다

| 디렉토리 | 앱 | 성격 |
| --- | --- | --- |
| `frontend/` | **class-explorer** | 지금 쓰는 비공식 검색기. 초대제, 명단까지 다 보입니다. **건드리지 않습니다** |
| `bench-frontend/` | **ksa-bench** | 전교생 공개용. `frontend/` 복사본에서 출발해 갈아엎는 중입니다 |

백엔드는 **한 벌**입니다. 파서가 두 벌이 되면 KEIS 응답이 바뀔 때마다 같은 수정을 두 번
하게 되고, 곧 서로 달라집니다. 대신 **ASGI 진입점을 둘로** 두어 ksa-bench 쪽 프로세스에는
명단이 나갈 수 있는 라우터를 아예 등록하지 않습니다 — 권한 검사 한 줄을 빠뜨려도 명단이
새지 않게 하려는 것입니다. 배치는 [`backend/main.guide.md`](backend/main.guide.md) 참고.

**ksa-bench 에서 없어진 것**: 다중 검색·불린 연산·초성, `/browse` 학생 목록,
남의 누적 이수 이력, `/admin/*`. 학생 검색은 **한 번에 한 명**만 됩니다
(후보 목록 → 하나 선택).

**분반 명단은 남아 있습니다.** 처음에는 응답에서 뺐지만 Trade 가 명단 없이는 성립하지
않아 되돌렸습니다. 그래서 현재 상태는 "데이터가 안 내려간다"가 아니라
**"훑는 화면이 없다"** 입니다. 대신 친구는 **단방향 등록**이고, 친구 화면은 과목명 없이
언제 비는지만 보여 줍니다.

목표는 차단이 아니라 **비용**입니다. 학교 공식 앱(가온누리)에도 전교생 시간표 검색이
있고 학번이 연속이라 순회하면 긁힙니다. 그러니 완전히 막는 건 의미가 없고, 명단을 얻는
비용을 거기와 같게 — 한 명씩 물어봐야 하게 — 맞춥니다.

---

## Commands

```bash
# Frontend — class-explorer (frontend/)
npm run dev       # Vite dev server (https://localhost:5188) — /api → localhost:8000 프록시
npm run build     # TypeScript check + Vite build
npm run lint      # ESLint

# Frontend — ksa-bench (bench-frontend/)
npm run dev       # https://localhost:5189 — 같은 백엔드로 프록시. 둘을 나란히 띄울 수 있습니다

# Backend (repo root) — 앱이 둘입니다. 코드·DB 는 한 벌, 라우터만 다릅니다
uvicorn backend.main:app --reload                    # class-explorer (8000)
uvicorn backend.bench_main:app --reload --port 8001  # ksa-bench (8001)
python -m backend.parser_run                       # KEIS API → SQLite 동기화 (오늘 기준 학기)
python -m backend.parser_run -y 2026 -s 2          # 학기 지정
python -m backend.parse_calendar_pdf <학사일정.pdf>  # 연간 학사일정 PDF → calendar_seed.json
python -m backend.import_calendar                  # seed → DB (source='pdf' 만 교체)
```

테스트 미구현. 검증은 `npm run build` + `npm run lint` 통과로 대체. **테스트 파일 생성 금지.**

---

## Architecture

```
KEIS API → parser_run.py (학기 단위) → ksa_timetable.db
                                  ↓
              FastAPI (GET /?year=&semester=, /terms, /auth/*, /admin/*)
                                  ↓
              App.tsx — 학기별 localStorage 캐시 (1h TTL)
                                  ↓
                 searchInClient() — 완전 클라이언트 사이드
```

**과목 4층**: `Department → Course → Subject → Class`.
`Course`는 언어·표기를 벗겨낸 과목 정체성(학점·선수관계가 붙는 곳),
`Subject`는 KEIS 개설명(영어강의 `(EC)`와 한국어강의가 별개 행)입니다.

**학기 모델**: 수업 데이터는 `Class.year`/`Class.semester`로 학기별 공존.
학기 미지정 요청은 최신 학기로 응답하고, 프론트는 `ksa_selected_term`에 선택 학기를 보존합니다.

| 파일                      | 역할                                                                            |
| ------------------------- | ------------------------------------------------------------------------------- |
| `App.tsx`                 | 전역 상태 + 라우터 + fetch + 학기 전환 + 검색 오케스트레이터 (context/store 없음) |
| `src/lib/searchEngine.ts` | 검색 전체 로직 (prefix 파싱, 불린 연산, 초성 매칭)                              |
| `src/lib/utils.ts`        | `DAY_MAP`, `DAYS_ORDER`, `PERIODS`, `extractSearchTerms()`, `getStudentColor()` |
| `src/lib/api.ts`          | axios 인스턴스 (`VITE_API_BASE_URL` 기반 baseURL)                               |
| `src/lib/curriculum.ts`   | 졸업 요건 진척도 + 선수관계 그래프 배치                                          |

**View Mode**: `isConsolidatedView = (searchMode !== 'general') || isLogicalSearch`

- **Consolidated**: prefix·논리 검색 → `EntityCard` + `TimetableGrid` + 과목 목록
- **Grid**: 일반 키워드 복수 엔티티 → `EntityCard` 격자

---

## Conventions

- 비즈니스 로직은 `lib/` 또는 커스텀 훅으로 분리. 컴포넌트 내 직접 작성 금지
- `DAY_MAP`, `DAYS_ORDER`, `PERIODS` — `src/lib/utils.ts`에서 import, 로컬 재정의 금지
- 하이라이트 키워드 추출: `extractSearchTerms()` 단일 사용
- `searchTerm` ↔ URL `?q=` 동기화는 `App.tsx`에서만 관리
- 한글 IME Enter 중복 방지: `e.nativeEvent.isComposing` 체크 필수
- Tooltip: `isDisabled={!isModifierPressed}` (Cmd/Ctrl 시에만 노출)

---

## Design Rules

- `border-2 border-black` — 모든 카드/버튼
- Hard shadow: `shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]` → hover 시 `translate-x-1 translate-y-1`로 숨김
- 선택된 버튼: `scale-105` + hover 시 shadow만 숨김 (translate 없음)
- `transition-all duration-100`
- atom 컴포넌트 인라인 재구현 금지: `RetroButton`, `RetroCard`, `RetroSubTitle`, `StudentBadge` 사용
- `RetroSubTitle` 스타일 고정: `text-sm font-bold text-black/40 uppercase tracking-widest`
- 학생 색상: 반드시 `getStudentColor()` 사용 (23=Purple, 24=Orange, 25=Green, 26=Cyan)
- HeroUI 전역 `border-radius: 0` 오버라이드 (`index.css`) — 건드리지 말 것
- Tailwind v4 `@theme` / `@custom-variant` LSP 경고는 정상 — 수정 시도 금지

---

## Rules — 작업 절차

### 시작 전

1. 작업을 `/tasks.md`에 추가: `- [ ] <작업 내용>`
2. 수정할 파일의 가이드 문서 먼저 읽기

### 완료 후

3. 수정한 파일의 가이드 문서 업데이트
4. `/tasks.md` 체크: `- [x] <작업 내용>`
5. `/logs.md`에 요약 추가:

```
   ## YYYY-MM-DD — <작업 제목>
   - 변경 파일: `파일명`
   - 요약: <한두 줄>
```

`/logs.md` 날짜 역순 | `/tasks.md` 최신 항목 아래에 추가

**ksa-bench 작업에는 `[bench]` 를 앞에 붙입니다** (`- [ ] [bench] …`). 두 앱 기록이 한
파일에 섞이므로, 이게 없으면 나중에 어느 앱 얘기인지 못 가립니다.

---

## Pages

| 경로                | 페이지          | 설명                              |
| ------------------- | --------------- | --------------------------------- |
| `/`                 | SearchPage      | 통합 검색                         |
| `/emptyroomfinder`  | RoomsPage       | 빈 강의실 탐색                    |
| `/analysis`         | AnalysisPage    | 학사 통계 대시보드                |
| `/browse`           | BrowsePage      | 학생·교사 목록 + 교육과정 그래프  |
| `/trade`            | TradePage       | 수강 변경 탐색 (2026-2 한정, 플래그) |
| `/zamong`           | ZamongPage      | 교육과정 이수 현황 + 평점 (학번 등록 필요) |
| `/calendar`         | CalendarPage    | 학사일정 달력 + 개인 일정 + 일정 제안 |
| `/about`            | SettingsPage    | 기능 가이드북 + About             |
| `/admin`            | AdminPage       | 계정 관리 (role=admin만)          |

---

## 참고 문서

| 작업 유형     | 문서                          |
| ------------- | ----------------------------- |
| 디자인 변경   | `frontend/design-guide.md`    |
| 컴포넌트 추가 | `frontend/component-guide.md` |
| API 수정      | `backend/api-guide.md`        |
| ksa-bench 작업 | `bench-frontend/CLAUDE.md` (가이드 사본이 그 안에 따로 있습니다) |

**어느 프론트를 고치는지 먼저 확인하세요.** 두 디렉토리에 같은 이름의 가이드가 각각
있어서, `frontend/design-guide.md`를 고치고 ksa-bench 를 손봤다고 생각하기 쉽습니다.
