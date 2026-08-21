# backend/models.py Guide

> [← Backend Guide](CLAUDE.md)

## 역할
SQLAlchemy ORM 모델 정의. 4개 테이블.

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
> 조회 기준 학기 결정은 `backend/terms.py`의 `resolve_term()`을 사용합니다.

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
— `at_version()` 으로 직접 물어야 합니다 (`classes_router` 의 `roster`/`slots` 참고).

## `TermVersion`

한 학기 데이터가 바뀐 회차. `(year, semester)` 안에서 1부터 오르고, **바뀐 게 있을 때만**
늘어납니다. `summary` 는 직전 회차와의 차이, `source` 는 `sync` | `edit` | `seed` 입니다.

수집이 아닌 변경(학생·교사 이름 수정)도 회차를 올립니다 — 화면에 나가는 내용이 달라지면
브라우저 캐시가 갈려야 하기 때문입니다. 다만 `students`·`subjects` 에는 버전 구간이 없어
**과거 회차를 열어도 이름은 현재 값으로 보입니다.**
