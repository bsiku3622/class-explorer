# Backend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

## 파일 구조
```
backend/
├── main.py          → FastAPI 앱 + API 엔드포인트 (인증 포함)
├── models.py        → SQLAlchemy ORM 모델 (6개 테이블)
├── database.py      → DB 연결 설정 (SQLite)
├── auth.py          → 패스워드 해싱, 세션 토큰 생성, get_current_user 의존성
├── auth_router.py   → 인증 엔드포인트 (/auth/*)
├── admin_router.py  → 관리자 전용 엔드포인트 (/admin/*)
├── create_user.py   → 관리자 계정 생성 CLI 스크립트
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

Enrollment           User                   Session
─────────────        ─────────────          ──────────────────────
id (PK)              id (PK)                id (PK)
stuId (FK→Student)   username (unique)      user_id (FK→User)
classId (FK→Class)   hashed_password        session_token (unique)
UniqueConstraint     is_admin (bool)        device_type (web|mobile)
(stuId, classId)                            ip_address
                                            created_at
                                            last_used_at
                                            expires_at

SubjectAlias
─────────────────────────────
id (PK)
subject  (Class.subject 과 일치, index)
alias    (검색 키워드)
UniqueConstraint (subject, alias)
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

### 계정 생성 (관리자 CLI)
```bash
python -m backend.create_user <username> <password>
```

## Admin 엔드포인트 (`/admin/*`)
모든 엔드포인트는 `is_admin=True` 유저만 접근 가능.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/admin/users` | 전체 유저 목록 |
| `POST` | `/admin/users` | 유저 생성 |
| `PATCH` | `/admin/users/{id}/admin` | admin 권한 토글 |
| `DELETE` | `/admin/users/{id}` | 유저 삭제 |
| `GET` | `/admin/sessions` | 전체 세션 목록 (IP 포함) |
| `DELETE` | `/admin/sessions/{id}` | 세션 강제 종료 |
| `GET` | `/admin/students?q=` | 학생 목록 (학번/이름 필터) |
| `PATCH` | `/admin/students/{stuId}` | 학생 이름 수정 (`{"name": "..."}`) |
| `GET` | `/admin/teachers` | 교사 목록 + 담당 분반 수 |
| `PATCH` | `/admin/teachers/{teacher_name}` | 교사 이름 일괄 변경 (`{"new_name": "..."}`) |
| `GET` | `/admin/subjects` | 전체 과목 + 별칭 목록 |
| `PUT` | `/admin/subjects/{subject}/aliases` | 과목 별칭 전체 교체 (`{"aliases": [...]}`) |
| `POST` | `/admin/sync` | 데이터 재수집 (parser_run) |

## 인증 시스템
- **방식**: Session Token (랜덤 48바이트, DB 저장) — 매 요청마다 DB 조회
- **최대 세션**: 계정당 1개 (로그인 시 기존 세션 즉시 전부 삭제)
- **만료**: 30일 (`expires_at` 컬럼, 만료 시 자동 삭제)
- **GET /**: 인증 필요 (`Authorization: Bearer <session_token>`)
- JWT 미사용 — `python-jose` 의존성 제거 가능

## 환경변수
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CORS_ORIGINS` | `http://localhost:5173` | 허용 도메인 (콤마 구분) |

배포 시 예시: `CORS_ORIGINS=https://your-app.netlify.app`

## 의존성
```
fastapi
uvicorn
sqlalchemy
httpx
python-jose[cryptography]
passlib[bcrypt]
python-multipart
```
→ `requirements.txt` (repo root) 참조

## 관련 가이드
- [api-guide.md](api-guide.md) — API 엔드포인트 명세
- [../frontend/CLAUDE.md](../frontend/CLAUDE.md) — 프론트엔드 연동 방식
