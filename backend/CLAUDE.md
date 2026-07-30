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
├── state_router.py  → 계정별 화면 상태 (/state/*)
├── create_user.py   → 관리자 계정 생성 CLI 스크립트
├── subject_names.py → 과목명 분해·정규화 (한글명/영문명/EC 태그)
├── build_curriculum_seed.py → Zamong 워크북 → curriculum_seed.json (로컬 전용)
├── import_curriculum.py → curriculum_seed.json → Department/Course/CoursePrereq 적재
│                          + Subject.course_id 재연결
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

## 과목 4층 구조

과목은 네 층으로 나뉩니다. 층마다 출처와 바뀌는 속도가 다릅니다.

```
Department  학과            수학 · 물리학 · 융합 …          (거의 안 바뀜)
    ↑
Course      교육과정 과목    "미적분학2" + 학점·선수관계      (교육과정 개편 때)
    ↑
Subject     KEIS 개설명      "미적분학2" / "미적분학2(EC)"    (표기가 바뀜)
    ↑
Class       실제 분반        3분반 · 김효진 · 2026-2         (학기마다)
```

**`Course`가 따로 있는 이유**는 언어와 표기를 벗겨낸 과목 정체성이 필요해서입니다.
영어강의(EC)와 한국어강의는 별개로 개설되지만 — 실제로 19쌍이 함께 열립니다 —
학점·선수관계·졸업 요건은 하나여야 합니다. `Subject` 사이에 선수관계를 걸면 언어
조합마다 중복돼 117개가 186개로 불어납니다.

`Subject.course_id`가 비어 있으면 교육과정에 없는 과목입니다 (외국인 전형 과목,
개편 전 이름). 지금 26개가 여기 해당합니다.

**(EC)는 English Class입니다.** 표기 없는 쪽이 한국어강의(KC)이고 둘은 다른 과목입니다.
`물리학및실험Ⅰ`처럼 로마숫자를 쓴 과목도 외국인 전형 과목이라 `물리학및실험1`과
합치면 안 됩니다 — 수강생이 100% 외국인 학번입니다.

## DB 스키마 (models.py)

```
Student              Class                  ClassTime
─────────────        ──────────────────     ─────────────
stuId (PK)           id (PK)                id (PK)
name                 subject_id (FK→Subject) day (MON~FRI)
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

Department                     Subject
─────────────────────────────  ─────────────────────────────
id (PK)                        id (PK)
name (수학, 물리학 …)            course_id (FK→Course, NULL 허용)
category (natural|humanities|  name          "미적분학2"
          convergence)         name_english  "Calculus2"
display_order                  name_raw      KEIS 원문
                               is_ec         영어강의 여부
                               UniqueConstraint (name, is_ec)

Course                         CoursePrereq
─────────────────────────────  ─────────────────────────────
id (PK)                        id (PK)
department_id (FK→Department)  before_id (FK→Course)
name (unique, 언어 태그 없음)    after_id  (FK→Course)
name_english                   alternative (bool, 택일 여부)
credits / ap_credits / is_pf   UniqueConstraint (before_id, after_id)
recommended_semester
description / description_sections
description_source / description_page

UserState                      CourseGrade
─────────────────────────────  ─────────────────────────────
id (PK)                        id (PK)
user_id (FK→User)              user_id (FK→User)
key ("plan" | "trade")         course (FK→Course.name)
data (JSON, 서버는 해석 안 함)   grade ("A+"... | None)
updated_at                     UniqueConstraint (user_id, course)
UniqueConstraint (user_id,key)
```

### 계정과 학번

`User.stu_id`가 이 계정이 누구인지 정합니다. 본인이 `POST /auth/link-student`에서
**학번과 이름을 함께** 대조해 등록하며, 둘 중 하나만 맞아도 반려합니다 — 아무 학번이나
골라 남의 이름으로 성적을 기록해 두는 걸 막기 위해서입니다.

**한 학번은 한 계정만** 가질 수 있습니다. 라우터에서 먼저 검사하지만, 두 요청이 동시에
들어오면 검사와 커밋 사이를 파고들 수 있어 `stu_id`에 유니크 인덱스를 걸어 뒀습니다.
제약에 걸리면 `IntegrityError`를 잡아 `409`로 바꿉니다. NULL은 유니크 검사에서 빠지므로
미등록 계정은 얼마든지 있어도 됩니다.

등록 전에는 `stu_id`가 비어 있고, 그동안 이수 기록 API는 `409`를 돌려줍니다.

### 계정별 상태

작업 중인 계획과 이수 기록은 기기가 아니라 **계정**에 붙습니다.

- `UserState` — 화면이 쓰던 JSON을 그대로 맡아 둡니다. 구조가 화면마다 달라 컬럼으로
  펼치지 않았고, 서버는 내용을 해석하지 않습니다
- `CourseGrade` — 평어는 서버가 검증해야 해서(교육과정에 있는 과목인지, 아는 평어인지)
  구조화했습니다. 행이 있으면 이수한 것으로 보고 `grade`는 선택입니다. 누구의 기록인지는
  `User.stu_id`가 정하므로 학번 컬럼을 두지 않습니다

### 스키마 초기화

앱과 CLI 스크립트 모두 `database.init_schema()`를 씁니다. `create_all`은 없는
**테이블**만 만들고 이미 있는 테이블에 **컬럼**을 붙이지 않아서, 마이그레이션과 항상
같이 돌려야 합니다. 서버에서 계정 생성이나 데이터 수집을 먼저 실행하는 일이 흔한데
그때 스키마가 뒤처져 있으면 엉뚱한 곳에서 터집니다.

### 수업과 교육과정의 연결

전부 외래키로 이어집니다. 예전에는 과목명 문자열이 다리 역할을 해서 표기가 조금만
바뀌어도 조용히 끊겼습니다.

```
Class.subject_id ─→ Subject.course_id ─→ Course.department_id ─→ Department
                                     └─→ CoursePrereq
```

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
