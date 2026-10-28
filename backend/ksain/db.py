"""ksain.db 연결.

본 DB(`ksa_timetable.db`)와 파일을 나눈 이유는 이 데이터가 **언제든 다시 받을 수 있는
사본**이라서입니다. 분석 프롬프트를 바꿔 다시 돌리거나 통째로 다시 수집할 때 계정·친구·
자료 같은 사용자 데이터와 섞여 있지 않아야 마음 놓고 지울 수 있고, 10분마다 도는 수집이
API 서버의 쓰기 잠금과 겹치지도 않습니다.
"""
import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

KSAIN_DB_URL = os.environ.get("KSAIN_DB_URL", "sqlite:///./backend/ksain.db")

engine = create_engine(KSAIN_DB_URL, connect_args={"check_same_thread": False, "timeout": 30})


@event.listens_for(engine, "connect")
def _pragmas(connection, _record) -> None:
    # 수집(쓰기)과 Agent 검색(읽기)이 동시에 돌아서 WAL 로 둡니다
    cursor = connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# create_all 은 이미 있는 표에 컬럼을 붙이지 않아서, 나중에 생긴 컬럼은 여기 적습니다
COLUMNS = [
    ("ksain_analyses", "applied", "JSON NOT NULL DEFAULT '[]'"),
    ("ksain_analyses", "suppressed", "JSON NOT NULL DEFAULT '[]'"),
]


def init_ksain_schema() -> None:
    from backend.ksain import models  # noqa: F401 — metadata 를 채웁니다

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for table, column, ddl in COLUMNS:
            have = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if column not in have:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
