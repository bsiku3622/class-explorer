# backend/core/db.py Guide

> [← Backend Guide](../CLAUDE.md)

DB 를 여는 곳은 이 파일 하나입니다. 본 DB 와 ksain.db 를 같은 방식으로 열고, 세션 의존성과 스키마
초기화도 여기서 드립니다. 경로와 환경변수는 `core/config.py` 가 읽습니다.

## DB 는 두 파일입니다

| | 본 DB | ksain.db |
| --- | --- | --- |
| 파일 | `backend/ksa_timetable.db` (서버에서는 `../data/` 를 가리키는 symlink) | `backend/ksain.db` |
| 담는 것 | 계정·시간표·학사일정·자료실·**기억(`facts`)** — 사람이 보고 고치는 것 | ksain 글·첨부·분석·검색 색인 — 다시 받고 다시 만들 수 있는 것 |
| 엔진 · 세션 · Base | `engine` · `SessionLocal` · `Base` | `ksain_engine` · `KsainSession` · `KsainBase` |
| 저널 | 기본(rollback) | WAL |
| 쓰는 프로세스 (서버) | API(`ksaclass`) + 수집 타이머·CLI(`baeks`) | 수집 타이머·CLI(`baeks`)만 — API 는 읽기만 |
| 백업 | 스냅샷 (`services/backup.py`, 자동 삭제 없음) | 안 함 |

**합치지 않습니다.** 한때 합치는 쪽으로 기울었다가 두 가지 때문에 접었습니다.

- **백업 속 개인정보.** 본 DB 스냅샷은 자동으로 지우지 않습니다. 합치면 ksain 에서 지워진 글(시험 명단이
  든 첨부 등)이 스냅샷 안에 계속 남습니다 — 개인정보처리방침 4항이 지운다고 약속한 것입니다. 백업할 때
  ksain 표를 빼는 방법도 있지만, 그러면 "본 DB 를 복사하는 모든 길이 그 표를 빼야 한다" 는 규칙이 생기고
  배포 가이드의 손 `cp` 부터 그 규칙을 어깁니다
- **서버 계정이 둘입니다.** 한 파일을 두 계정이 WAL 로 같이 쓰려면 `-wal`·`-shm` 파일의 주인·그룹 문제로
  데이터 폴더 권한부터 다시 짜야 합니다(아래)

경계는 "사람의 것인가, 다시 만들 수 있는가" 입니다. 그래서 ksain 글에서 나왔어도 **사람이 고치는
결과물**(학사일정의 자동 일정, 기억)은 본 DB 에 있습니다 — 서버에서 API 가 쓸 수 있는 DB 가 본 DB
뿐이기도 합니다.

## 연결 설정

두 엔진 모두 `timeout=30`(바쁠 때 기다리는 초)과 `check_same_thread=False` 로 엽니다. pysqlite 기본
5초로는 학기 데이터를 통째로 갈아끼우는 수집(`cli/parser_run.py`)과 겹친 요청이 `database is locked` 로
바로 실패합니다.

ksain.db 만 연결마다 `PRAGMA journal_mode=WAL` · `foreign_keys=ON` 을 겁니다. 수집(쓰기)과 Agent
검색(읽기)이 동시에 돌기 때문입니다.

⚠️ **본 DB 를 WAL 로 바꾸지 마세요.** WAL 의 `-wal`·`-shm` 파일은 연결이 열려 있는 동안 남는데, 서버에서
그 파일의 주인은 먼저 연 프로세스가 되고 그룹은 그 계정의 기본 그룹이 됩니다. API(`ksaclass`)가 만들면
수집 타이머(`baeks`)가 못 열고, 반대도 마찬가지입니다. 꼭 바꿔야 한다면 `data/` 에 setgid 를 걸고
`baeks` 를 `ksaclass` 그룹에 넣는 것부터 해야 합니다.

## 세션 쓰는 법

| 자리 | 쓰는 것 |
| --- | --- |
| 라우터 | `Depends(get_db)` — 요청 하나에 본 DB 세션 하나 |
| CLI·백그라운드 작업 | `with db_session() as db:` — 열고 반드시 닫습니다. 커밋은 직접 합니다 |
| ksain.db | `with db_session(KsainSession) as kdb:` |
| SSE 스트리밍 응답 | `db_session()` — ⚠️ `Depends(get_db)` 세션은 응답이 흐르기 전에 닫힐 수 있습니다 |

`main_db_file()` 은 본 DB 의 **진짜** 위치(symlink 를 따라간 경로)입니다. 백업(`backups/`)과 자료
원본(`materials/`)이 그 옆에 생깁니다.

## 스키마 초기화

```python
init_schema()        # 본 DB — create_all + core/migrations.run_migrations
init_ksain_schema()  # ksain.db — create_all + run_ksain_migrations
```

`create_all` 은 없는 **표**만 만들고 이미 있는 표에 **컬럼**을 붙이지 않아서, 마이그레이션과 항상 같이
돌려야 합니다. 앱(`core/app.py`)은 시작할 때 `init_schema()` 를, ksain 작업(수집·분석·색인 CLI)은
`init_ksain_schema()` 를 부릅니다.

⚠️ **API 는 `init_ksain_schema()` 를 부르지 않습니다.** 서버에서 ksain.db 는 `baeks` 의 파일이고 API 는
`ProtectSystem=strict` 로 `data/` 밖에 못 씁니다. 그래서 ksain 쪽에 표·컬럼을 새로 붙이면, API 는 수집
타이머가 한 번 돌기 전까지 그것이 없는 DB 를 봅니다. 새 컬럼은 `deferred` 로(`Analysis.facts`), 새 표는
없을 때 비켜 가게(`knowledge/search.py` 의 LIKE 대체) 만드세요.

## 사용처

- `models.py` · `ksain/models.py` — `Base` · `KsainBase` 를 상속합니다
- `core/app.py` — 앱이 뜰 때 `init_schema()`
- `core/auth.py` · 모든 라우터 — `get_db`
- `cli/*` · `ksain/*` · `knowledge/index.py` — `SessionLocal` · `KsainSession` 을 직접 엽니다
