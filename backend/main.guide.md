# 진입점 Guide — main.py / app_factory.py

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

두 프론트의 차이는 **UI 와 캐시**입니다. ksa-bench 에는 전교생을 늘어놓는 화면이 없고,
학기 데이터를 localStorage 에 캐시하지 않습니다(명단이 브라우저에 파일로 남지 않도록).

## app_factory.create_app()

`init_schema()` → CORS → 보안 헤더까지 얹은 **빈 앱**을 돌려줍니다. 라우터는 부르는
쪽이 붙입니다. 허용 origin 은 로컬(`LOCAL_ORIGINS`) + 앱별 배포 도메인입니다.

`SecurityHeadersMiddleware` 도 여기 있습니다 — `/docs`·`/redoc` 만 CSP 를 풀고
나머지는 `default-src 'none'` 입니다.

## classes_router.py

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

### `get_section_num(section_str) -> int`
분반 문자열에서 정렬용 숫자 추출. `"제1분반"` → `1`, `"제10분반"` → `10`

## get_db()

`auth.py` 에 있습니다. SQLAlchemy 세션 의존성 — 요청 처리 후 자동으로 닫습니다.
