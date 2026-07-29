from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./backend/ksa_timetable.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_schema() -> None:
    """
    테이블을 만들고 마이그레이션까지 돌립니다.

    `create_all`은 없는 **테이블**만 만들 뿐, 이미 있는 테이블에 **컬럼**을 붙이지는
    않습니다. 그래서 둘을 항상 같이 불러야 합니다 — 앱뿐 아니라 CLI 스크립트도
    마찬가지입니다. 서버에서 계정 생성이나 데이터 수집을 먼저 돌리는 일이 흔한데,
    그때 스키마가 뒤처져 있으면 엉뚱한 곳에서 터집니다.
    """
    from backend import models  # 모델을 불러와야 metadata가 채워집니다
    from backend.migrations import run_migrations

    models.Base.metadata.create_all(bind=engine)
    run_migrations(engine)
