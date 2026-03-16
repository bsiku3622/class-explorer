# Backend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

## 파일 구조
```
backend/
├── main.py          → FastAPI 앱 + API 엔드포인트
├── models.py        → SQLAlchemy ORM 모델 (4개 테이블)
├── database.py      → DB 연결 설정 (SQLite)
├── parser.py        → KSAIN API 응답 파싱 로직
├── parser_run.py    → 데이터 동기화 실행 스크립트
├── students.txt     → 학생 목록 (학번 + 이름)
└── ksa_timetable.db → SQLite 데이터베이스
```

## DB 스키마 (models.py)

```
Student              Class                  ClassTime
─────────────        ──────────────────     ─────────────
stuId (PK)           id (PK)                id (PK)
name                 subject                day (MON~FRI)
                     section                period (1-11)
                     teacher                room
                     room                   class_id (FK→Class)

Enrollment
─────────────
id (PK)
stuId (FK→Student)
classId (FK→Class)
UniqueConstraint(stuId, classId)
```

## 데이터 수집 흐름 (parser_run.py)
```
students.txt (학번 목록)
      ↓
asyncio + httpx (동시 요청 최대 20개)
      ↓
KSAIN API: https://api.ksain.net/ksain/timetable.php
      ↓
parse_ksain_data() → [{subject, section, teacher, room, times}]
      ↓
SQLite UPSERT (Student, Class, ClassTime, Enrollment)
```

## 실행 방법

### 서버 시작
```bash
uvicorn backend.main:app --reload
```

### 데이터 동기화
```bash
python -m backend.parser_run
```

## 의존성
```
fastapi
uvicorn
sqlalchemy
httpx
```

## 관련 가이드
- [api-guide.md](api-guide.md) — API 엔드포인트 명세
- [../frontend/CLAUDE.md](../frontend/CLAUDE.md) — 프론트엔드 연동 방식
