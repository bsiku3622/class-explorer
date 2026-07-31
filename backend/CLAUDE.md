# Backend Guide

> [← 프로젝트 전체 가이드](../CLAUDE.md)

## 파일 구조
```
backend/
├── app_factory.py   → 두 앱이 공유하는 뼈대 (init_schema + CORS + 보안 헤더)
├── bench_router.py  → ksa-bench 전용 API (사람 1명 조회, 집계)
├── friends_router.py→ 친구(단방향) + 교시 시각표 — **두 앱 공통**
├── home_router.py   → 홈 대시보드 (`GET /home` 한 번에) + 급식(ksain API)
├── periods.py       → 교시별 시각표 **원본** (프론트는 GET /periods 로 받아 씁니다)
├── main.py          → 진입점 (하나) — 두 프론트가 같이 씁니다
├── classes_router.py→ GET / (학기 전체 + 분반 명단) + GET /terms
├── models.py        → SQLAlchemy ORM 모델 (16개 테이블)
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

## 서버는 하나, 프론트가 둘

`backend.main:app` 하나가 `frontend/`(class-explorer)와 `bench-frontend/`(ksa-bench)를
모두 받습니다. CORS 에 두 도메인이 다 들어 있습니다.

한때 앱을 둘로 나눠(`bench_main.py`) ksa-bench 쪽에 명단 라우터를 등록하지 않았습니다.
Trade 가 명단 없이는 성립하지 않아 되돌렸고, 그러자 두 앱의 API 표면이 거의 같아져
프로세스를 둘로 둘 이유가 사라졌습니다.

**그래서 접근 제어는 이제 라우터 등록이 아니라 권한 검사에 있습니다.** `/admin/*` 은
`role=admin` 이고, 개인 데이터(state·grades·개인 일정·친구)는 전부 본인 것만 다룹니다.
새 엔드포인트가 남의 데이터를 돌려줄 수 있으면 **의존성으로 막으세요** — "그 앱에는 안
붙였으니까" 가 더 이상 방패가 아닙니다.

두 프론트의 차이는 **UI 와 캐시**에 있습니다: ksa-bench 에는 전교생을 늘어놓는 화면이
없고, 학기 데이터를 localStorage 에 캐시하지 않습니다.

**bench 에 라우터를 새로 붙일 때는 그 라우터가 남의 데이터를 돌려줄 수 있는지 먼저
확인하세요.** 자세한 배치는 [main.guide.md](main.guide.md) 에 표로 있습니다.

## 학기 모델

수업 데이터는 **학기 단위**로 공존합니다 (`Class.year` / `Class.semester`).

- 조회 기준 학기는 `terms.resolve_term(db, year, semester)`로 결정 — 둘 다 주어졌을 때만 그대로, 아니면 최신 학기
- 수집은 `parser_run.py`가 학기 단위로 원자적 교체 — 다른 학기 데이터는 건드리지 않음
- `Student`는 학기 공통 마스터. 학기별 재적 여부는 `Enrollment → Class` 조인으로 판단
- `Department`/`Course`/`Subject`는 학기 무관 전역 — 학기를 타는 건 `Class`뿐입니다
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

Enrollment           User                        Session
─────────────        ──────────────────────      ──────────────────────
id (PK)              id (PK)                     id (PK)
stuId (FK→Student)   username (unique)           user_id (FK→User)
classId (FK→Class)   hashed_password             session_token (unique)
UniqueConstraint     role (user|manager|admin)   device_type (web|mobile)
(stuId, classId)     email (unique, NULL 허용)     ip_address
                     stu_id (FK→Student,         created_at
                            unique, NULL 허용)     last_used_at
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

CalendarEvent                  EventRequest
─────────────────────────────  ─────────────────────────────
id (PK)                        id (PK)
title                          user_id (FK→User, 제안한 사람)
start_date / end_date          title
time_mode (allday|clock|       start_date / end_date
           period)             time_mode / 시간 칸들
start_minute / end_minute      category / target_grades / note
start_period / end_period      status (pending|approved|rejected)
category / target_grades       reason (거절 사유)
source (pdf|manual)            decided_by_id / decided_at
owner_id (FK→User, NULL=공용)   event_id (FK→CalendarEvent)
series_id (반복 묶음)
note

UserState                      CourseGrade
─────────────────────────────  ─────────────────────────────
id (PK)                        id (PK)
user_id (FK→User)              user_id (FK→User)
key ("plan" | "trade")         course_id (FK→Course)
data (JSON, 서버는 해석 안 함)   grade ("A+"... | None)
updated_at                     UniqueConstraint (user_id, course_id)
UniqueConstraint (user_id,key)
```

### 계정과 학번

`User.stu_id`가 이 계정이 누구인지 정합니다. 본인이 `POST /auth/link-google`에서 학교
구글 계정으로 확인하며, 이메일이 곧 학번이라 손으로 입력받지 않습니다 — 아무 학번이나
골라 남의 이름으로 성적을 기록해 두는 걸 막기 위해서입니다.

**한 학번은 한 계정만** 가질 수 있습니다. 라우터에서 먼저 검사하지만, 두 요청이 동시에
들어오면 검사와 커밋 사이를 파고들 수 있어 `stu_id`에 유니크 인덱스를 걸어 뒀습니다.
제약에 걸리면 `IntegrityError`를 잡아 `409`로 바꿉니다. NULL은 유니크 검사에서 빠지므로
미등록 계정은 얼마든지 있어도 됩니다.

등록 전에는 `stu_id`가 비어 있고, 그동안 이수 기록 API는 `409`를 돌려줍니다.

### 친구

`Friend` 는 **단방향**입니다 — `user_id` 가 `friend_stu_id` 를 추가하면 끝이고 상대의
수락이 없습니다. 두 앱 모두 남의 시간표를 이미 볼 수 있어서(class-explorer 는 벌크
응답으로, ksa-bench 는 한 명씩 조회로) 승인 절차를 붙여도 막아 주는 게 없고 마찰만
늘기 때문입니다. 그래서 이 표는 **북마크**에 가깝습니다.

A가 B를 추가해도 B의 목록에는 A가 없습니다.

`/friends/busy`·`/friends/now` 는 **슬롯(`"MON-3"`)만** 돌려줍니다 — 과목·교실은
보내지 않습니다. 공강을 맞추는 데 필요 없고, 주면 "누가 뭘 듣는지" 훑는 화면이 됩니다.

### 홈 (`home_router.py`)

`GET /home` 하나가 홈 화면에 필요한 걸 다 돌려줍니다 — 지금 교시·오늘 내 시간표·지금
있어야 할 교실·다음 수업·학기/방학. 켜자마자 보이는 자리라 왕복이 늘면 바로 티가 나서
한 요청으로 묶었습니다.

**친구는 여기 없습니다.** 등록·삭제와 "지금 공강" 은 Browse 로 옮겨서 `/friends` 와
`/friends/now` 를 씁니다 — 홈이 안 그리는 걸 계산할 이유가 없습니다.

**방학 판단**은 학사일정의 `개학`·`종업` 표지로 합니다 — "방학" 이라는 일정이 따로 없어서
마지막 종업이 마지막 개학보다 뒤면 방학입니다.

**급식**은 `https://api.ksain.net/v1/meal.php` 에서 받아 `meal_menus` 에 쌓습니다.
환경변수 `KSAIN_API_KEY` 가 필요하고, **없으면 급식 칸만 비고 나머지는 그대로 돕니다** —
홈 전체가 죽으면 안 됩니다.

**DB 를 먼저 보고, 없을 때만 학교 API 를 부릅니다.** 지난 급식은 바뀌지 않으니 한 번
받은 날짜는 다시 묻지 않습니다. 다만 **아직 안 올라온 날은 저장하지 않습니다** — 빈
값으로 적어 두면 영영 빈 채로 굳고, 행이 없어야 다음 요청이 다시 물어봅니다.

원문은 개행이 섞인 한 덩어리라 `_lines()` 가 줄로 쪼개면서 축산물 이력번호
(`찹스테이크(호주산801000310667)`)를 지우고 `&` 로 시작하는 줄을 앞 줄에 붙입니다.

**메뉴는 `GET /home` 에 담지 않습니다.** 학교 API 가 3~5초씩 걸려서 같이 기다리면 홈
전체가 그만큼 늦어집니다 — 켜자마자 보이는 자리입니다. `/home` 은 급식 키가 있는지와
지금 끼니만 알려 주고, 화면이 `GET /meal?date=` 로 따로 받아 급식 칸만 기다립니다.

`/meal` 은 **오늘 기준 ±31일까지만** 엽니다 — 화살표를 계속 누르면 학교 API 를 그만큼
두드리게 되고, 그 밖은 볼 이유도 없습니다. 타임아웃이 15초인 것도 같은 이유입니다:
짧게 잡으면 그날 첫 조회가 통째로 실패해 아무도 급식을 못 봅니다.

### 교시 시각표 (`periods.py`)

출처는 생활관에 붙은 **「생활관 일과 운영」** 표입니다. 50분 수업 + 10분 쉬는시간으로
1~4교시(08:40~12:30) → 점심·학급모임 → 5~9교시(13:40~18:30) → **한 시간 건너뛰고**
10~11교시(19:30~21:20).

⚠️ **9교시 다음이 10교시가 아닙니다.** 5교시부터 50+10 을 그대로 이어붙이면 18:40·19:40
이 나오는데 틀립니다. 짐작하지 말고 표를 보세요.

**여기가 유일한 원본입니다.** 화면도 `GET /periods` 로 받아 쓰므로 상수를 두 벌 두지
않습니다.

⚠️ **"지금" 은 `periods.now()` / `periods.today()` 로 가져오세요.** 배포 서버가 UTC 로
돌고 있어서 `datetime.now()` 를 그대로 쓰면 교시가 9시간 어긋나고 날짜가 하루 밀립니다.
시스템 타임존을 고치지 않고 코드에서 KST 를 박은 이유는, 서버를 옮겨도 학교 시각은
KST 여야 하고 다른 서비스의 타임존까지 건드릴 이유가 없어서입니다. (세션 만료처럼 UTC
로 저장하고 UTC 로 비교하는 값은 그대로 `utcnow()` 를 씁니다 — 섞지 마세요.)

`BREAKS` 중 **저녁(17:30~19:00)과 자습(19:30~21:30)은 교시와 겹칩니다** — 저녁은 9교시와,
자습은 10·11교시를 감쌉니다. 그래서 `current_period()` 와 `current_break()` 를 배타적으로
보면 안 되고, 화면은 "10교시 · 자습" 처럼 둘을 같이 보여 줍니다.

### 학사일정

`CalendarEvent.owner_id` 가 비어 있으면 **학교 공용**(모두에게 보이고 매니저만 수정),
차 있으면 그 계정의 **개인 일정**(본인만 보고 본인만 수정)입니다. 공개 범위 컬럼을
따로 두지 않은 이유는 지금 경우의 수가 이 둘뿐이어서입니다 — 공유가 생기면 그때
붙입니다.

조회는 `GET /calendar` 한 곳뿐이고, 거기서 `owner_id IS NULL OR owner_id = 나` 를
겁니다. 남의 개인 일정을 고치려 하면 **404**를 돌려줍니다 — 403 이면 그런 일정이
있다는 사실이 새어 나갑니다.

`source='pdf'` 는 학사일정 문서에서 온 것이라 `import_calendar` 가 통째로 갈아끼웁니다.
사람이 넣은 일정(`manual`)과 개인 일정은 건드리지 않습니다.

**반복은 규칙이 아니라 실제 행으로 펼쳐 둡니다.** 같은 묶음은 `series_id` 가 같습니다.
규칙으로 두면 조회할 때마다 펼쳐야 하고 "이번 주만 빼기"가 어려워지는데, 행으로 두면
한 회차만 지우는 게 그냥 삭제입니다. 한 번에 최대 200 회차까지 만듭니다.

### 계정별 상태

작업 중인 계획과 이수 기록은 기기가 아니라 **계정**에 붙습니다.

- `UserState` — 화면이 쓰던 JSON을 그대로 맡아 둡니다. 구조가 화면마다 달라 컬럼으로
  펼치지 않았고, 서버는 내용을 해석하지 않습니다. 지금 쓰는 키는 `trade`뿐이고
  `plan`은 Zamong이 옛 값을 한 번 읽어 지우려고만 남겨 뒀습니다
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
모든 엔드포인트는 `role=admin` 유저만 접근 가능. **class-explorer 에만 등록됩니다.**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/admin/users` | 전체 유저 목록 |
| `POST` | `/admin/users` | 유저 생성 |
| `PATCH` | `/admin/users/{id}/role` | 권한 변경 (`user`\|`manager`\|`admin`) |
| `DELETE` | `/admin/users/{id}` | 유저 삭제 |
| `GET` | `/admin/sessions` | 전체 세션 목록 (IP 포함) |
| `DELETE` | `/admin/sessions/{id}` | 세션 강제 종료 |
| `GET` | `/admin/students?q=` | 학생 목록 (학번/이름 필터) |
| `PATCH` | `/admin/students/{stuId}` | 학생 이름 수정 (`{"name": "..."}`) |
| `GET` | `/admin/teachers?year=&semester=` | 교사 목록 + 담당 분반 수 (학기 기본값=최신) |
| `PATCH` | `/admin/teachers/{teacher_name}` | 교사 이름 일괄 변경 (`{"new_name": "..."}`, 전 학기 적용) |
| `GET` | `/admin/subjects?year=&semester=` | 해당 학기 과목 목록 (학기 기본값=최신) |
| `GET` | `/admin/terms` | 데이터가 존재하는 학기 목록 |
| `POST` | `/admin/sync` | 데이터 재수집 (`{"year": 2026, "semester": 2}` 선택, 생략 시 DB 최신 학기) |

## 인증 시스템

로그인은 **아이디·비밀번호** (`POST /auth/login`) 하나뿐입니다. 계정은 관리자가
만들어 줍니다 — 아는 사람만 쓰는 서비스라 스스로 만드는 길을 두지 않았습니다.

### 권한

`User.role` 한 컬럼이고 **위계**입니다 — 위 단계는 아래 단계가 하는 일을 전부 합니다.

| role | 할 수 있는 것 |
|------|---------------|
| `user` | 내 일정 관리 + 공용 일정 **제안** |
| `manager` | 학사일정 직접 수정 + 제안 허용·거절 |
| `admin` | manager 전부 + 계정 관리 (`/admin/*`) |

의존성은 `auth.get_current_manager` / `get_current_admin` 을 씁니다. `role == "admin"`
처럼 직접 비교하면 매니저를 빠뜨리기 쉬우니 `User.has_role(최소등급)`을 거치세요.
불리언을 여러 개 두지 않은 이유는 "둘 다 켜진 계정"의 뜻이 애매해지기 때문입니다.

**구글 계정은 로그인이 아니라 학번 확인에만 씁니다** (`POST /auth/link-google`).
이메일이 곧 학번이라(`25-059@ksa.hs.kr`) 한 번 거치면 신원이 정해집니다. 교사 계정처럼
학번 형식이 아니면 거절합니다.

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
| `GOOGLE_CLIENT_ID` | (없음) | 학번 확인용. 없으면 `/auth/link-google`이 503 |
| `KSAIN_API_KEY` | (없음) | 급식(ksain.net). 없으면 홈의 급식 칸만 비웁니다 |

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
