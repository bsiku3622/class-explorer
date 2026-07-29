# Backend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

## 파일 구조
```
backend/
├── main.py          → FastAPI 앱 + API 엔드포인트 (인증 포함)
├── models.py        → SQLAlchemy ORM 모델 (6개 테이블)
├── migrations.py    → 앱 시작 시 실행되는 SQLite 스키마 마이그레이션 (멱등)
├── terms.py         → 학년도/학기 해석 유틸 (current_term, list_terms, resolve_term)
├── database.py      → DB 연결 설정 (SQLite)
├── auth.py          → 패스워드 해싱, 세션 토큰 생성, get_current_user 의존성
├── auth_router.py   → 인증 엔드포인트 (/auth/*)
├── admin_router.py  → 관리자 전용 엔드포인트 (/admin/*)
├── curriculum_router.py → 교육과정 엔드포인트 (/curriculum/*)
├── create_user.py   → 관리자 계정 생성 CLI 스크립트
├── import_credits.py→ SweetZamong 교육과정 DB → 과목 학점 임포트
├── build_curriculum_seed.py → Zamong 워크북 → curriculum_seed.json (로컬 전용)
├── import_curriculum.py → curriculum_seed.json → Course/CoursePrereq 적재
├── curriculum_seed.json → 교육과정 카탈로그 145과목 + 선수관계 117개
├── parser.py        → KEIS API 응답 파싱 로직
├── parser_run.py    → 학기별 데이터 동기화 실행 스크립트
├── students.txt     → 학생 목록 (학번 + 이름)
└── ksa_timetable.db → SQLite 데이터베이스
```

## 학기 모델

수업 데이터는 **학기 단위**로 공존합니다 (`Class.year` / `Class.semester`).

- 조회 기준 학기는 `terms.resolve_term(db, year, semester)`로 결정 — 둘 다 주어졌을 때만 그대로, 아니면 최신 학기
- 수집은 `parser_run.py`가 학기 단위로 원자적 교체 — 다른 학기 데이터는 건드리지 않음
- `Student`는 학기 공통 마스터. 학기별 재적 여부는 `Enrollment → Class` 조인으로 판단
- `SubjectAlias`는 학기 무관 전역 (과목명이 같으면 재사용)
- 스키마 변경은 `migrations.py`에서 처리 — `main.py` import 시 자동 실행

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

SubjectAlias                  SubjectCredit
─────────────────────────────  ─────────────────────────────
id (PK)                        subject (PK, Class.subject와 일치)
subject  (Class.subject 과 일치) credits (float)
alias    (검색 키워드)           ap_credits / is_ec / is_pf
UniqueConstraint (subject,alias) matched_name (→ Course.name)

Course                         CoursePrereq
─────────────────────────────  ─────────────────────────────
name (PK)                      id (PK)
english_name                   before (FK→Course.name)
department / category          after  (FK→Course.name)
credits / ap_credits           alternative (bool, 택일 여부)
is_ec / is_pf                  UniqueConstraint (before, after)
recommended_semester
description / description_sections
description_source / description_page
```

### 수업과 교육과정의 연결

`Class`는 특정 학기에 열린 분반이고, `Course`는 학교가 개설할 수 있는 과목의 정의입니다.
둘은 `SubjectCredit`을 다리 삼아 이어집니다.

```
Class.subject ─→ SubjectCredit.subject
                 SubjectCredit.matched_name ─→ Course.name ─→ CoursePrereq
```

이 체인 덕분에 "이 학생이 듣는 분반"에서 "계열·학점·선수관계"까지 바로 갑니다.

## 데이터 수집 흐름 (parser_run.py)
```
students.txt (학번 목록)
      ↓
asyncio + httpx (동시 요청 최대 20개, 실패 시 2회 재시도)
      ↓
KEIS API: https://keis.ksa.hs.kr/restapi/v1/schedule/{stuId}/{year}/{semester}
      ↓
parse_schedule() → [{subject, section, teacher, room, times}]
      ↓
[전원 수집 후] 해당 학기 Class/ClassTime/Enrollment 전량 교체
```
수집 도중 실패해도 DB는 변경되지 않습니다. 요청 실패가 과반을 넘으면 중단합니다.

## 실행 방법

### 서버 시작
```bash
uvicorn backend.main:app --reload
```

### 데이터 동기화
```bash
python -m backend.parser_run                       # 오늘 날짜 기준 학기
python -m backend.parser_run --year 2026 --semester 2
```

### 과목 학점 임포트
```bash
python -m backend.import_credits --dry-run   # 매칭 결과만 확인
python -m backend.import_credits             # 저장
```
KEIS에는 학점 정보가 없어 SweetZamong `courses` 테이블을 정본으로 씁니다.
과목명 표기가 달라(`미적분학2(EC)(Calculus2(EC))` vs `미적분학2(EC)`) 뒤쪽 영문 괄호를
균형 맞춰 떼고 EC 태그를 붙였다 뗐다 하며 매칭합니다.

### 교육과정 적재
```bash
python -m backend.import_curriculum --dry-run   # 결과만 확인
python -m backend.import_curriculum             # 저장
```
`curriculum_seed.json`만 있으면 되므로 서버에서 그대로 돌아갑니다.

seed를 다시 만들려면 (로컬에서만 — Zamong 워크북과 SweetZamong DB가 필요):
```bash
python -m backend.build_curriculum_seed
```
선수관계는 워크북 학과 시트에 **셀 배경색으로 그린 그림**이라 따로 읽습니다. 자세한
원리는 `build_curriculum_seed.py` 상단 주석에 적어 뒀습니다.

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
| `GET` | `/admin/teachers?year=&semester=` | 교사 목록 + 담당 분반 수 (학기 기본값=최신) |
| `PATCH` | `/admin/teachers/{teacher_name}` | 교사 이름 일괄 변경 (`{"new_name": "..."}`, 전 학기 적용) |
| `GET` | `/admin/subjects?year=&semester=` | 해당 학기 과목 + 별칭 목록 (학기 기본값=최신) |
| `PUT` | `/admin/subjects/{subject}/aliases` | 과목 별칭 전체 교체 (`{"aliases": [...]}`, 학기 무관) |
| `GET` | `/admin/terms` | 데이터가 존재하는 학기 목록 |
| `POST` | `/admin/sync` | 데이터 재수집 (`{"year": 2026, "semester": 2}` 선택, 생략 시 DB 최신 학기) |

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
| `FORCE_HTTPS` | (없음) | 설정 시 HSTS 헤더 활성화 |

배포 시 예시: `CORS_ORIGINS=https://your-app.com FORCE_HTTPS=1`

## 보안
- **Security Headers**: `SecurityHeadersMiddleware` — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy
- **Rate Limiting**: `/auth/login` IP당 60초 10회 제한 (초과 시 429, 성공 시 초기화)
- **입력값 검증**: 모든 Pydantic 스키마에 `max_length`, `pattern`, `Literal` 검증 적용
- **에러 노출 차단**: subprocess stderr는 server log에만 기록, 클라이언트엔 generic 메시지

## 의존성
```
fastapi>=0.115.0
uvicorn>=0.32.0
sqlalchemy>=2.0.0
httpx>=0.27.0
bcrypt>=4.0.0
python-multipart>=0.0.12
```
→ `requirements.txt` (repo root) 참조

## 관련 가이드
- [api-guide.md](api-guide.md) — API 엔드포인트 명세
- [../frontend/CLAUDE.md](../frontend/CLAUDE.md) — 프론트엔드 연동 방식
