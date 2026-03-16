# backend/database.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
SQLAlchemy DB 연결 설정. 엔진, 세션, Base 제공.

## 설정
```python
DATABASE_URL = "sqlite:///./backend/ksa_timetable.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # FastAPI 멀티스레드 대응
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()  # models.py에서 상속
```

## `check_same_thread=False`
SQLite 기본 설정은 한 스레드에서만 사용 가능합니다.
FastAPI의 비동기 처리에서 여러 스레드가 접근할 수 있으므로 이 제약을 해제합니다.

## 사용처
- `models.py`: `Base` 임포트 → ORM 모델 기반 클래스
- `main.py`: `engine`, `SessionLocal` 임포트 → DB 초기화 + 세션 의존성
- `parser_run.py`: `SessionLocal` 임포트 → 데이터 동기화 시 직접 세션 사용
