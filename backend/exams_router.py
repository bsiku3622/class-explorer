"""본인 시험 시간표. 다른 학생의 응시 목록을 조회하는 경로는 없습니다."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_
from sqlalchemy.orm import Session
from backend import models, periods
from backend.auth import get_current_user, get_db
from backend.exams import period_summary
from backend.terms import resolve_term
from backend.versioning import at_version

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/me")
def my_exams(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
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
