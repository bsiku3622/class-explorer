"""학년도/학기 해석 유틸 — 데이터가 학기 단위로 쌓이므로 조회 기준을 한 곳에서 정합니다."""

import datetime

from sqlalchemy.orm import Session

from backend import models, periods


def current_term(today: datetime.date | None = None) -> tuple[int, int]:
    """
    오늘 날짜로 학년도/학기를 판별합니다.
    3~8월 = 1학기 · 9~12월 = 2학기 · 1~2월 = 직전 학년도 2학기
    """
    today = today or periods.today()
    if today.month <= 2:
        return today.year - 1, 2
    if today.month <= 8:
        return today.year, 1
    return today.year, 2


def list_terms(db: Session) -> list[dict[str, int]]:
    """DB에 데이터가 존재하는 학기 목록 (최신순)."""
    rows = (
        db.query(models.Class.year, models.Class.semester)
        .distinct()
        .order_by(models.Class.year.desc(), models.Class.semester.desc())
        .all()
    )
    return [{"year": y, "semester": s} for y, s in rows]


def latest_term(db: Session) -> tuple[int, int]:
    """데이터가 있는 가장 최근 학기. 없으면 오늘 기준 학기."""
    row = (
        db.query(models.Class.year, models.Class.semester)
        .order_by(models.Class.year.desc(), models.Class.semester.desc())
        .first()
    )
    return (row[0], row[1]) if row else current_term()


def resolve_term(db: Session, year: int | None, semester: int | None) -> tuple[int, int]:
    """요청 파라미터로 조회 대상 학기를 확정합니다. 둘 다 주어졌을 때만 그대로 사용."""
    if year is not None and semester is not None:
        return year, semester
    return latest_term(db)
