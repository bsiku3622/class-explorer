# 진입점 Guide — main.py / core/app.py

> [← Backend Guide](CLAUDE.md)

## 서버는 하나입니다

```bash
uvicorn backend.main:app --reload   # 8000
```

`frontend/`(class-explorer)와 `bench-frontend/`(ksa-bench)가 **같은 서버**를 봅니다.
CORS 에 두 도메인이 다 들어 있습니다.

### 한때 둘이었습니다

ksa-bench 쪽에 명단 라우터를 등록하지 않는 별도 진입점(`bench_main.py`)을 뒀었습니다.
Trade(수강 변경 탐색)가 "이 분반 수강생 중 내 분반을 받을 수 있는 사람"을 찾는 기능이라
명단 없이는 성립하지 않아 되돌렸고, 그러자 두 앱의 API 표면이 거의 같아졌습니다.
같은 걸 두 프로세스로 띄울 이유가 없어 합쳤습니다.

**그래서 접근 제어가 라우터 등록에서 권한 검사로 옮겨졌습니다.** 새 엔드포인트가 남의
데이터를 돌려줄 수 있으면 의존성으로 막으세요 — "그 앱에는 안 붙였으니까" 가 더 이상
방패가 아닙니다.

`materials.router`는 로그인 사용자의 자료 목록·업로드·preview·download를,
`materials.admin_router`는 admin 전용 검수·삭제를 등록합니다.

`exams.router`는 인증한 계정 본인의 시험 목록(`GET /exams/me`)을 등록합니다.

두 프론트의 차이는 **UI 와 캐시**입니다. ksa-bench 에는 전교생을 늘어놓는 화면이 없고,
학기 데이터를 localStorage 에 캐시하지 않습니다(명단이 브라우저에 파일로 남지 않도록).

## 라우터 (`routers/`)

`main.py` 가 붙이는 순서대로입니다. **순서가 곧 경로 매칭 순서**라, 바꿀 때는 겹치는 경로가
없는지 보세요.

| 라우터 | 경로 |
| --- | --- |
| `auth.router` | `/auth/*` — 로그인·세션·학번 확인 |
| `admin.router` | `/admin/*` — 계정·데이터 관리 (admin) |
| `curriculum.router` · `curriculum.explorer_router` | `/curriculum/*` — 교육과정·자몽. `explorer_router` 는 남의 누적 이수(`GET /curriculum/progress/{stu_id}`) |
| `state.router` | `/state/*` — 계정별 화면 상태 |
| `calendar.router` | `/calendar/*` — 학사일정·개인 일정·제안 |
| `friends.router` | `/friends/*` · `GET /periods` |
| `home.router` | `GET /home` · `GET /meal` |
| `exams.router` | `GET /exams/me` |
| `classes.terms_router` · `classes.router` | `GET /terms` · `GET /` |
| `bench.router` | `/students/*` · `/me/progress` · `/stats/enrollment` — [routers/bench.guide.md](routers/bench.guide.md) |
| `materials.router` · `materials.admin_router` | `/materials/*` · `/admin/materials/*` |
| `agent.router` | `/agent/*` — Ask (질문창) |
| `facts.router` | `/facts/*` — Ask 의 기억 고치기·숨기기 (manager 이상) |

**라우터는 서로 import 하지 않습니다.** 두 화면이 같은 계산을 쓰면 `services/` 로 내립니다 — 한때
홈이 학사일정 라우터를, ksa-bench 가 교육과정·수업 라우터를, Agent 가 홈·시험 라우터를 가져다 써서
한쪽을 고치면 엉뚱한 화면이 깨졌습니다.

**`await` 할 게 없는 핸들러는 `def` 로 둡니다** (`GET /`·`/terms`·`/home`, 친구, bench). FastAPI 는
`def` 를 스레드 풀에서 돌리지만 `async def` 는 이벤트 루프 위에서 돌려서, 그 안의 동기 DB 조회가
끝날 때까지 다른 요청이 전부 — 흐르고 있는 Ask 의 SSE 까지 — 멈춥니다.

## core/app.py — create_app()

`init_schema()` → CORS → 보안 헤더까지 얹은 **빈 앱**을 돌려줍니다. 라우터는 부르는
쪽이 붙입니다. 허용 origin 은 로컬(`LOCAL_ORIGINS`) + 앱별 배포 도메인입니다.

`SecurityHeadersMiddleware` 도 여기 있습니다 — `/docs`·`/redoc` 만 CSP 를 풀고
나머지는 `default-src 'none'` 입니다.

## routers/classes.py

### `GET /terms` (`get_terms`)
데이터가 존재하는 학기 목록을 최신순으로 반환합니다 (`terms.list_terms`).

### `GET /` (`get_all_data`)
지정 학기의 전체 데이터를 한 번에 반환합니다. 분반 명단과 학번 분포가 들어 있습니다.

**Query**: `year`, `semester` (둘 다 주어졌을 때만 적용, 아니면 최신 학기)

**처리 흐름**:
1. `resolve_term(db, year, semester)` — 조회 대상 학기 확정
2. `db.query(Class).filter(year, semester)` — 해당 학기 수업 조회 (enrollments, times eager load)
3. subject로 그룹핑 → sections 정렬 (분반 번호순)
4. 해당 학기 수강생 기준으로 학년별 학생 수 계산
5. 응답 JSON 구성 (term + available_terms + stats + student_counts + data)

**응답 구조**: → [api-guide.md](api-guide.md) 참조

**이 응답에는 분반별 `students` 배열이 들어 있습니다.** 그래서 ksa-bench 프론트는
이걸 localStorage 에 캐시하지 않습니다 — 캐시하면 전교생 명단이 브라우저에 파일로
남습니다. class-explorer 는 아는 사람끼리 쓰는 앱이라 그대로 캐시합니다.

### `section_num(section) -> int` (`services/timetable.py`)
분반 문자열에서 정렬용 숫자 추출. `"제1분반"` → `1`, `"제10분반"` → `10`, 숫자가 없으면 `0`

## get_db()

`core/db.py` 에 있습니다. 요청 하나에 본 DB 세션 하나 — 요청 처리 후 자동으로 닫습니다.
CLI·SSE 안에서는 `db_session()` 을 씁니다 ([core/db.guide.md](core/db.guide.md)).
