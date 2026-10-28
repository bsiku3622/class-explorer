"""시간표 조회에 반복되는 조각 — 과목 표기, 분반 번호, 학생·학기 단위 수업 행.

수업·시간·수강은 회차(`at_version`)를 거쳐 읽습니다. 손으로 조건을 적으면 폐강된 분반이
섞입니다(`services/versioning.py`).
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session, joinedload

from backend import models
from backend.services import periods
from backend.services.versioning import at_version


def subject_label(name: str, is_ec: bool) -> str:
    """화면에 쓰는 과목 이름 — 영어강의(EC)는 뒤에 `(EC)` 를 붙여 한국어강의와 가립니다."""
    return f"{name}(EC)" if is_ec else name


def section_num(section: str | None) -> int:
    """"3분반" → 3. 숫자가 없으면 0 — 분반 순으로 늘어놓을 때 씁니다."""
    match = re.search(r"(\d+)", section or "")
    return int(match.group(1)) if match else 0


def day_index(day: str) -> int:
    """MON~FRI 순서. 모르는 요일은 맨 뒤로 보냅니다."""
    return periods.DAYS.index(day) if day in periods.DAYS else len(periods.DAYS)


def term_slots(db: Session, year: int, semester: int, *filters) -> list[tuple[models.Class, models.ClassTime]]:
    """학기의 (분반, 시간) 행 — 강의실·교사 단위로 거를 때 `filters` 를 넘깁니다."""
    return (
        db.query(models.Class, models.ClassTime)
        .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
        .filter(models.Class.year == year, models.Class.semester == semester,
                at_version(models.Class), at_version(models.ClassTime), *filters)
        .options(joinedload(models.Class.subject))
        .all()
    )


def student_slots(db: Session, stu_id: str, year: int, semester: int) -> list[tuple[models.Class, models.ClassTime]]:
    """한 학생의 그 학기 (분반, 시간) 행. 과목 → 교육과정 → 학과까지 같이 싣습니다(홈이 색을 고릅니다)."""
    return (
        db.query(models.Class, models.ClassTime)
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
        .filter(
            models.Enrollment.stuId == stu_id,
            models.Class.year == year,
            models.Class.semester == semester,
            at_version(models.Class),
            at_version(models.ClassTime),
            at_version(models.Enrollment),
        )
        .options(
            joinedload(models.Class.subject)
            .joinedload(models.Subject.course)
            .joinedload(models.Course.department)
        )
        .all()
    )
