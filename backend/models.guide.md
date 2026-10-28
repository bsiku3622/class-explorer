# backend/models.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
SQLAlchemy ORM 모델 정의. 시간표·계정·개인 기록·과목 자료·기억을 **본 DB** 한 곳에 보관합니다.
`Base` 는 `core/db.py` 에서 가져옵니다. ksain 글·첨부·분석은 다른 파일(ksain.db)이라 여기가 아니라
`ksain/models.py`(`KsainBase`)에 있습니다 — 나눈 이유는 [core/db.guide.md](core/db.guide.md).

## 모델

### `Student`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `stuId` | String PK | 학번 (예: `"25-001"`) |
| `name` | String | 학생 이름 |
| `enrollments` | relationship | Enrollment 목록 |

### `Class`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | Integer PK | 자동 증가 |
| `subject` | String | 과목명 |
| `section` | String | 분반명 (예: `"1분반"`) |
| `teacher` | String | 담당 교사 |
| `room` | String | 대표 강의실 |
| `year` | Integer | 학년도 (예: `2026`) — index |
| `semester` | Integer | 학기 (`1` \| `2`) — index |
| `enrollments` | relationship | 수강 목록 |
| `times` | relationship | 시간 목록 (cascade delete) |

UniqueConstraint: `(subject, section, teacher, year, semester)`

> 학기별 데이터가 한 DB에 공존합니다. 수업 조회 시 **항상 `year`/`semester`로 필터**하세요.
> 조회 기준 학기 결정은 `backend/services/terms.py`의 `resolve_term()`을 사용합니다.

### `ClassTime`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | Integer PK | |
| `day` | String | 요일 (`MON`~`FRI`) |
| `period` | Integer | 교시 (`1`~`11`) |
| `room` | String | 해당 시간 강의실 |
| `class_id` | FK→Class | |

### `Enrollment`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | Integer PK | |
| `stuId` | FK→Student | |
| `classId` | FK→Class | |

UniqueConstraint: `(stuId, classId)` — 중복 수강 방지

학기 정보는 `Class`가 가지므로 별도 컬럼이 없습니다. 학기별 수강은 `Class` 조인으로 필터합니다.

## 관계 다이어그램
```
Student ──< Enrollment >── Class ──< ClassTime
```

### `Material` · `MaterialFile`

`Material`은 학기와 `Subject`에 필수로 연결된 자료 묶음입니다. `pending →
approved/rejected` 검수 상태, 제출자, 거절 사유, Primary syllabus 여부를
담습니다. `MaterialFile`은 묶음 안의 원본 경로·저장명·preview·MIME·크기를
담습니다. 실제 바이너리는 DB가 아닌 `materials/` 디렉터리에 있으며,
`storage_key`로 같은 묶음을 찾습니다.

```text
User ──< Material >── Subject
              └──< MaterialFile
```


## 버전 구간 (`Class` · `ClassTime` · `Enrollment`)

| 컬럼 | 뜻 |
|------|-----|
| `version_from` | 이 행이 유효해진 회차 (포함) |
| `version_to` | 유효하지 않게 된 회차 (**미포함**). `NULL` 이면 지금까지 유효 |

수집은 이제 행을 **지우지 않습니다.** 폐강된 분반도, 뺀 수강도 `version_to` 를 찍어 닫을
뿐입니다. 그래서 지난 회차를 그대로 다시 열어 볼 수 있고, Trade 계획이 가리키는 분반
id 가 폐강 이후까지 살아남습니다.

⚠️ **읽을 때는 반드시 `versioning.at_version()` 을 거치세요.** 조건을 손으로 적으면
언젠가 한 자리를 빠뜨리고, 그러면 폐강된 분반이 조회에 섞여 나옵니다. 화면에서 티가 안
나는 종류의 사고입니다.

UNIQUE 제약에 `version_from` 이 들어갑니다. 한 학생이 수업을 뺐다가 다시 듣는 일이
실제로 있는데, 옛 제약이면 그 이력을 두 행으로 남길 수 없어 뭉개집니다.

### 관계는 살아 있는 행만 봅니다

`Student.enrollments` · `Subject.classes` · `Class.enrollments` · `Class.times` 는
`primaryjoin` 에 `version_to IS NULL` 이 박혀 있고 `viewonly` 입니다. 읽는 쪽이 조건을
기억하지 않아도 되게 하려는 것입니다. **과거 회차를 읽을 때는 이 관계를 쓸 수 없습니다**
— `at_version()` 으로 직접 물어야 합니다 (`routers/classes.py` 의 `roster`/`slots` 참고).

## `TermVersion`

한 학기 데이터가 바뀐 회차. `(year, semester)` 안에서 1부터 오르고, **바뀐 게 있을 때만**
늘어납니다. `summary` 는 직전 회차와의 차이, `source` 는 `sync` | `edit` | `seed` 입니다.

수집이 아닌 변경(학생·교사 이름 수정)도 회차를 올립니다 — 화면에 나가는 내용이 달라지면
브라우저 캐시가 갈려야 하기 때문입니다. 다만 `students`·`subjects` 에는 버전 구간이 없어
**과거 회차를 열어도 이름은 현재 값으로 보입니다.**

## `TimetableOverride`

`date` 하나에 유일한 공용 이벤트입니다. `source_day`(`MON`~`FRI`)의 수업을 그 날짜의
홈 `today` 목록에 적용하고, `title`은 Admin 목록과 API 응답에 표시합니다. 주간 격자는
요일별 학기 기본 시간표를 계속 나타냅니다.

## `ExamPeriod` · `Exam` · `ExamRegistration`

시험 회차 → 개별 시험 → 학생별 응시 대상으로 이어집니다. 회차의 `key`는 유일하고,
시험은 `(period_id, source_key)`, 응시 행은 `(exam_id, stu_id)`로 중복을 막습니다.
응시 행의 `class_id`는 시험실을 해석한 수강 분반의 선택적 연결이며, `room`은
평소 수업 강의실이 아닌 공지의 시험실입니다. 자세한 적재·조회 절차는
[exams.guide.md](exams.guide.md)를 따릅니다.

## `Fact` — Ask 의 기억

ksain 글에서 분석(`ksain.analyze`)이 뽑은 사실 한 줄입니다. Ask 가 질문에 맞는 것을 골라 시스템
프롬프트에 싣습니다(`knowledge/facts.py`). 사실마다 출처 글이 있고, 손으로 지어 넣는 사실은 없습니다.

| 컬럼 | 뜻 |
|------|-----|
| `post_id` | ksain 글 번호. **외래키가 없습니다** — 글은 다른 파일(ksain.db)에 있습니다 |
| `post_title` · `posted_on` | 출처 표시용 사본 — 화면과 Agent 가 ksain.db 를 따로 열지 않아도 됩니다 |
| `board` | 출처 게시판과 말머리(`"공지사항 · 교무연구부"`) — 학교 공지인지 홍보 글인지 모델이 가려 읽게 기억 줄에 싣습니다 |
| `seq` | 그 글에서 몇 번째 사실인지 |
| `statement` | 글을 안 읽은 사람도 뜻이 통하는 한 문장. **날짜가 없습니다** — 날짜는 학사일정이 맡습니다([ksain.guide.md](ksain.guide.md)) |
| `topic` | 같은 주제를 묶는 짧은 이름 — 해마다 오는 공지는 새 글의 사실이 앞섭니다 |
| `target_grades` | `"1,2"`. 비어 있으면 전학년 (학사일정과 같은 꼴) |
| `target_majors` | `"화학,생물학"`. 비어 있으면 전공 무관 — 아래 「전공 칸」 |
| `valid_until` | 지나면 기억에서 뺍니다. 비어 있으면 계속 유효한 사실(규칙·방법) |
| `confidence` | 분석기가 매긴 확신 — 0.6 미만은 옮겨 적지 않습니다 |
| `status` | `active` \| `hidden` |
| `edited` · `edited_by_id` · `edited_at` | 사람이 고쳤는지, 누가 언제 |

**본 DB 에 있는 이유**는 매니저가 고치고 숨기는 결과물이라서입니다(학사일정의 자동 일정과 같습니다) —
서버에서 API 가 쓸 수 있는 DB 는 본 DB 뿐입니다. 숨긴 사실과 고친 사실은 글을 다시 분석해도 그대로
두고, 글이 ksain 에서 지워지면 고친 것까지 지웁니다(개인정보처리방침 4항). ⚠️ 그래서 **백업에는 넣지
않습니다** — 본 DB 백업은 1년을 두어서, 넣으면 지운 글의 사실이 백업 속에 그만큼 남습니다
([core/db.guide.md](core/db.guide.md)).

검색은 FTS5 표 `facts_fts`(rowid = `facts.id`, 바이그램 토큰)로 합니다. 모델이 아니라서
`core/migrations.py` 가 만듭니다. ⚠️ **`facts` 는 `knowledge/facts.py` 를 거쳐서만 고치세요** — 거기서
`facts_fts` 를 같이 맞춥니다. 다른 곳에서 행을 직접 고치면 검색이 옛 문장으로 걸립니다.

## 전공 칸 (`User.major` · `target_majors`)

전공은 학교가 부르는 이름으로 **심화필수 전공 트랙**입니다(수학·정보과학·물리학·지구과학·화학·생물학 —
`services/majors.py`).

| 모델 | 컬럼 | 뜻 |
|------|------|-----|
| `User` | `major` | 본인이 고른 트랙 이름(`"정보과학"`). 비어 있으면 아직 안 골랐거나 미정 |
| `User` | `major_answered_at` | 전공 팝업에 답한 때. "아직 정하지 않았어요" 도 답이라 `major` 가 비어도 찹니다 |
| `CalendarEvent` · `EventRequest` · `Fact` | `target_majors` | `"물리학,지구과학"`. 비어 있으면 전공 무관 (`target_grades` 와 같은 꼴) |

⚠️ **학과 id 가 아니라 이름을 적습니다.** `cli/import_curriculum.py` 가 학과 행을 지우고 다시 만들어서
id 가 바뀝니다 — id 로 묶으면 교육과정을 다시 적재하는 날 모든 사람의 전공이 끊깁니다.
