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

### `GET /` (`get_all_data`)
전체 데이터를 한 번에 반환하는 유일한 엔드포인트.

**처리 흐름**:
1. `db.query(Class).all()` — 모든 수업 조회 (enrollments, times eager load)
2. subject로 그룹핑 → sections 정렬 (분반 번호순)
3. `db.query(Student.stuId).all()` — 학년별 학생 수 계산
4. 응답 JSON 구성 (stats + student_counts + data)

**응답 구조**: → [api-guide.md](api-guide.md) 참조

## 앱 초기화
```python
models.Base.metadata.create_all(bind=engine)  # DB 테이블 자동 생성
app = FastAPI()
```
