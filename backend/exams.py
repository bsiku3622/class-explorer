"""시험 회차 조회와 공용 배너 정보. 날짜 판정은 서버의 KST를 사용합니다."""
from sqlalchemy.orm import Session
from backend import models, periods


def period_summary(row: models.ExamPeriod) -> dict:
    today = periods.today()
    return {
        "id": row.id, "key": row.key, "year": row.year, "semester": row.semester,
        "kind": row.kind, "title": row.title,
        "start_date": row.start_date.isoformat(), "end_date": row.end_date.isoformat(),
        "open": row.visible_from <= today <= row.visible_until,
    }


def active_period(db: Session, year: int, semester: int) -> dict | None:
    today = periods.today()
    row = db.query(models.ExamPeriod).filter(
        models.ExamPeriod.year == year, models.ExamPeriod.semester == semester,
        models.ExamPeriod.visible_from <= today, models.ExamPeriod.visible_until >= today,
    ).order_by(models.ExamPeriod.start_date.desc()).first()
    return period_summary(row) if row else None
