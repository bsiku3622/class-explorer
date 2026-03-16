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
| `section` | String | 분반명 (예: `"제1분반"`) |
| `teacher` | String | 담당 교사 |
| `room` | String | 대표 강의실 |
| `enrollments` | relationship | 수강 목록 |
| `times` | relationship | 시간 목록 (cascade delete) |

UniqueConstraint: `(subject, section, teacher)`

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

## 관계 다이어그램
```
Student ──< Enrollment >── Class ──< ClassTime
```
