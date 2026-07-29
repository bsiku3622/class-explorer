# backend/main.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
FastAPI 앱 정의 + 유일한 API 엔드포인트.

## 함수

### `get_db()`
SQLAlchemy 세션 의존성 주입 함수. 요청 처리 후 자동으로 세션을 닫습니다.
```python
def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()
```

### `get_section_num(section_str) -> int`
분반 문자열에서 정렬용 숫자 추출.
```python
get_section_num("제1분반")  # → 1
get_section_num("제10분반") # → 10
```

### `GET /terms` (`get_terms`)
데이터가 존재하는 학기 목록을 최신순으로 반환합니다 (`terms.list_terms`).

### `GET /` (`get_all_data`)
지정 학기의 전체 데이터를 한 번에 반환하는 주 엔드포인트.

**Query**: `year`, `semester` (둘 다 주어졌을 때만 적용, 아니면 최신 학기)

**처리 흐름**:
1. `resolve_term(db, year, semester)` — 조회 대상 학기 확정
2. `db.query(Class).filter(year, semester)` — 해당 학기 수업 조회 (enrollments, times eager load)
3. subject로 그룹핑 → sections 정렬 (분반 번호순)
4. 해당 학기 수강생 기준으로 학년별 학생 수 계산
5. 응답 JSON 구성 (term + available_terms + stats + student_counts + data)

**응답 구조**: → [api-guide.md](api-guide.md) 참조

## 앱 초기화
```python
models.Base.metadata.create_all(bind=engine)  # DB 테이블 자동 생성
run_migrations(engine)                        # 스키마 마이그레이션 (멱등)
app = FastAPI()
```
