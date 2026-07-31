# 진입점 Guide — main.py / bench_main.py / app_factory.py

> [← Backend Guide](CLAUDE.md)

## 앱이 둘입니다

| 진입점 | 앱 | 프론트 | 성격 |
| --- | --- | --- | --- |
| `backend.main:app` | class-explorer | `frontend/` | 초대제. 분반 명단까지 전부 |
| `backend.bench_main:app` | ksa-bench | `bench-frontend/` | 전교생 공개. 명단 라우터가 **등록되지 않음** |

```bash
uvicorn backend.main:app --reload                  # 8000
uvicorn backend.bench_main:app --reload --port 8001
```

DB·모델·파서는 **한 벌**을 같이 씁니다. 두 벌이 되면 KEIS 응답이 바뀔 때마다 같은
수정을 두 번 하게 되고, 곧 서로 달라집니다.

## 왜 권한이 아니라 진입점으로 가르나

`role` 검사로도 막을 수는 있습니다. 하지만 한 앱에 "명단을 통째로 주는 엔드포인트"와
"전교생이 쓰는 서비스"가 같이 살면, **나중에 기능을 붙이다 의존성 하나를 빠뜨리는 것이
곧 사고**가 됩니다. 라우터가 아예 등록되지 않으면 그 실수가 성립하지 않습니다.

값은 systemd 유닛 하나와 nginx 블록 하나입니다.

## 어느 라우터가 어디에

| 라우터 | explorer | bench | |
| --- | :-: | :-: | --- |
| `auth_router` | ● | ● | |
| `curriculum_router` | ● | ● | 카탈로그·본인 평어 |
| `state_router` | ● | ● | 본인 화면 상태 |
| `calendar_router` | ● | ● | 공용 일정 + 본인 개인 일정 |
| `classes_router.terms_router` | ● | ● | 학기 목록 — 개인 정보 없음 |
| `classes_router.router` | ● | ○ | **`GET /`** — 학기 전체 + 분반 명단 |
| `curriculum_router.explorer_router` | ● | ○ | 아무 학생의 누적 이수 이력 |
| `admin_router` | ● | ○ | `/admin/students` 가 전교생 명단을 그대로 돌려줍니다 |
| `bench_router` | ○ | ● | 명단 없는 카탈로그 + 학생 1명 조회 |

bench 에 관리 화면이 필요해지면 `admin_router` 를 붙이지 말고 **안전한 것만 골라
새로 만드세요.** 통째로 붙이는 순간 위 표가 거짓말이 됩니다.

## app_factory.create_app()

`init_schema()` → CORS → 보안 헤더까지 얹은 **빈 앱**을 돌려줍니다. 라우터는 부르는
쪽이 붙입니다. 허용 origin 은 로컬(`LOCAL_ORIGINS`) + 앱별 배포 도메인입니다.

`SecurityHeadersMiddleware` 도 여기 있습니다 — `/docs`·`/redoc` 만 CSP 를 풀고
나머지는 `default-src 'none'` 입니다.

## classes_router.py

### `GET /terms` (`get_terms`) — 두 앱 공통
데이터가 존재하는 학기 목록을 최신순으로 반환합니다 (`terms.list_terms`).

### `GET /` (`get_all_data`) — **class-explorer 전용**
지정 학기의 전체 데이터를 한 번에 반환합니다.

**Query**: `year`, `semester` (둘 다 주어졌을 때만 적용, 아니면 최신 학기)

**처리 흐름**:
1. `resolve_term(db, year, semester)` — 조회 대상 학기 확정
2. `db.query(Class).filter(year, semester)` — 해당 학기 수업 조회 (enrollments, times eager load)
3. subject로 그룹핑 → sections 정렬 (분반 번호순)
4. 해당 학기 수강생 기준으로 학년별 학생 수 계산
5. 응답 JSON 구성 (term + available_terms + stats + student_counts + data)

**응답 구조**: → [api-guide.md](api-guide.md) 참조

**이 응답에는 분반별 `students` 배열이 들어 있습니다.** 그래서 화면에서 명단을 가리는
것만으로는 아무 의미가 없습니다 — 응답이 그대로 브라우저 localStorage 에 남습니다.
ksa-bench 쪽 대안은 [bench_router.guide.md](bench_router.guide.md) 를 보세요.

### `get_section_num(section_str) -> int`
분반 문자열에서 정렬용 숫자 추출. `"제1분반"` → `1`, `"제10분반"` → `10`

## get_db()

`auth.py` 에 있습니다. SQLAlchemy 세션 의존성 — 요청 처리 후 자동으로 닫습니다.
