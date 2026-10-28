"""DB 연결 — 본 DB 와 ksain.db 를 **같은 방식으로** 엽니다.

| | 본 DB (`engine`·`SessionLocal`·`Base`) | ksain.db (`ksain_engine`·`KsainSession`·`KsainBase`) |
| --- | --- | --- |
| 담는 것 | 계정·시간표·학사일정·기억(`facts`) | ksain 글·첨부·분석·검색 색인 |
| 저널 | 기본(rollback) | WAL |
| 쓰는 프로세스 (서버) | API(`ksaclass`) + 수집 타이머·CLI(`baeks`) | 수집 타이머·CLI(`baeks`)만 — API 는 읽기만 |

두 파일로 나눈 이유는 `config.py` 머리말에 있습니다.

⚠️ **본 DB 를 WAL 로 바꾸지 마세요.** WAL 은 `-wal`·`-shm` 파일이 연결이 열려 있는 동안 남는데,
서버에서 그 파일의 주인은 먼저 연 프로세스가 되고 그룹은 그 계정의 기본 그룹이 됩니다. API
(`ksaclass`)가 만들면 수집 타이머(`baeks`)가 못 열고, 반대도 마찬가지입니다. ksain.db 는
`baeks` 혼자 써서 WAL 이 괜찮습니다.

**스키마는 프로세스가 직접 맞춥니다.** 앱은 시작할 때 `init_schema()` 를, ksain 작업은
`init_ksain_schema()` 를 부릅니다. ⚠️ **API 는 `init_ksain_schema()` 를 부르지 않습니다** —
서버에서 ksain.db 는 `baeks` 의 파일이고 API 는 `ProtectSystem=strict` 로 `data/` 밖에 못 씁니다.
그래서 ksain 쪽에 컬럼·표를 새로 붙이면 API 는 수집 타이머가 한 번 돌기 전까지 그 표가 없는 DB 를
볼 수 있습니다 — 새 컬럼은 `deferred` 로, 새 표는 없을 때 비켜 가게 만드세요.
"""
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from backend.core import config

#: 다른 프로세스가 쓰는 중일 때 기다리는 초. pysqlite 기본 5초로는 학기 데이터를 통째로 갈아끼우는
#: 수집(`cli/parser_run.py`)과 겹친 요청이 `database is locked` 로 바로 실패합니다
BUSY_TIMEOUT = 30


def _engine(url: str, *, wal: bool) -> Engine:
    # check_same_thread=False — FastAPI 가 요청마다 다른 스레드에서 세션을 씁니다
    engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": BUSY_TIMEOUT})
    if wal:
        @event.listens_for(engine, "connect")
        def _pragmas(connection, _record) -> None:
            # 수집(쓰기)과 Agent 검색(읽기)이 동시에 돌아서 WAL 로 둡니다
            cursor = connection.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return engine


engine = _engine(config.DATABASE_URL, wal=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

ksain_engine = _engine(config.KSAIN_DB_URL, wal=True)
KsainSession = sessionmaker(autocommit=False, autoflush=False, bind=ksain_engine)
KsainBase = declarative_base()


def main_db_file() -> Path:
    """본 DB 의 **진짜** 파일 위치 (symlink 를 따라갑니다).

    백업(`backups/`)과 자료 원본(`materials/`)이 이 옆에 생깁니다 — 서버에서는 `data/` 입니다.
    """
    return Path(engine.url.database or config.BACKEND_DIR / "ksa_timetable.db").resolve()


def get_db() -> Iterator[Session]:
    """FastAPI 의존성 — 요청 하나에 본 DB 세션 하나."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session(factory: sessionmaker = SessionLocal) -> Iterator[Session]:
    """CLI·백그라운드 작업용. 열고 반드시 닫습니다 — 커밋은 부르는 쪽이 합니다.

    ⚠️ 스트리밍 응답(SSE) 안에서는 `Depends(get_db)` 대신 이걸 씁니다. 응답이 흐르기 전에
    의존성 세션이 닫힐 수 있습니다.
    """
    db = factory()
    try:
        yield db
    finally:
        db.close()


def init_schema() -> None:
    """본 DB 의 표를 만들고 마이그레이션까지 돌립니다.

    `create_all` 은 없는 **표**만 만들고 이미 있는 표에 **컬럼**을 붙이지 않아서, 둘을 항상 같이
    불러야 합니다 — 앱뿐 아니라 CLI 도 마찬가지입니다. 서버에서 계정 생성이나 데이터 수집을 먼저
    돌리는 일이 흔한데, 그때 스키마가 뒤처져 있으면 엉뚱한 곳에서 터집니다.
    """
    from backend import models  # noqa: F401 — 모델을 불러와야 metadata 가 채워집니다
    from backend.core.migrations import run_migrations

    Base.metadata.create_all(bind=engine)
    run_migrations(engine)


def init_ksain_schema() -> None:
    """ksain.db 의 표 — ksain 작업(수집·분석·CLI)만 부릅니다. API 는 부르지 않습니다(머리말)."""
    from backend.core.migrations import run_ksain_migrations
    from backend.ksain import models  # noqa: F401 — metadata 를 채웁니다

    KsainBase.metadata.create_all(bind=ksain_engine)
    run_ksain_migrations(ksain_engine)
