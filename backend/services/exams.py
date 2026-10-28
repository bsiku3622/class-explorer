"""시험 회차 조회와 공용 배너 정보. 날짜 판정은 서버의 KST를 사용합니다."""
from sqlalchemy import and_
from sqlalchemy.orm import Session

from backend import models
from backend.core import clock
from backend.services import periods
from backend.services.terms import resolve_term
from backend.services.versioning import at_version


def period_summary(row: models.ExamPeriod) -> dict:
    today = clock.today()
    return {
        "id": row.id, "key": row.key, "year": row.year, "semester": row.semester,
        "kind": row.kind, "title": row.title,
        "start_date": row.start_date.isoformat(), "end_date": row.end_date.isoformat(),
        "open": row.visible_from <= today <= row.visible_until,
    }


def active_period(db: Session, year: int, semester: int) -> dict | None:
    today = clock.today()
    row = db.query(models.ExamPeriod).filter(
        models.ExamPeriod.year == year, models.ExamPeriod.semester == semester,
        models.ExamPeriod.visible_from <= today, models.ExamPeriod.visible_until >= today,
    ).order_by(models.ExamPeriod.start_date.desc()).first()
    return period_summary(row) if row else None


def exams_for(db: Session, user: models.User, year: int | None = None, semester: int | None = None) -> dict:
    """본인 시험 시간표 — `GET /exams/me` 와 Agent 의 `my_exams` 도구가 같이 씁니다.

    응시 목록은 **본인 것만** 나갑니다. 다른 학생 것을 묻는 경로는 두지 않습니다.
    """
    year, semester = resolve_term(db, year, semester)
    period = db.query(models.ExamPeriod).filter_by(year=year, semester=semester).order_by(
        models.ExamPeriod.start_date.desc()
    ).first()
    if not period:
        return {"period": None, "exams": []}
    rows = db.query(models.Exam, models.ExamRegistration, models.Class).join(
        models.ExamRegistration, models.ExamRegistration.exam_id == models.Exam.id
    ).outerjoin(models.Class, and_(models.ExamRegistration.class_id == models.Class.id, at_version(models.Class))).filter(
        models.Exam.period_id == period.id,
        models.ExamRegistration.stu_id == (user.effective_stu_id or ""),
    ).order_by(models.Exam.date, models.Exam.start_minute, models.Exam.subject).all()
    return {
        "period": {**period_summary(period), "source_name": period.source_name},
        "exams": [{
            "id": exam.id, "subject": exam.subject, "subject_english": exam.subject_english,
            "date": exam.date.isoformat() if exam.date else None,
            "start": periods.hhmm(exam.start_minute) if exam.start_minute is not None else None,
            "end": periods.hhmm(exam.end_minute) if exam.end_minute is not None else None,
            "duration": exam.end_minute - exam.start_minute if exam.start_minute is not None else None,
            "room": registration.room,
            "room_instruction": exam.source_rooms if not registration.room else None,
            "section": cls.section if cls else None, "teacher": cls.teacher if cls else None,
            "note": exam.note,
        } for exam, registration, cls in rows],
    }
