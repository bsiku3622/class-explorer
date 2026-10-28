"""본인 시험 시간표. 다른 학생의 응시 목록을 조회하는 경로는 없습니다."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend import models
from backend.core.auth import get_current_user
from backend.core.db import get_db
from backend.services.exams import exams_for

router = APIRouter(prefix="/exams", tags=["exams"])


@router.get("/me")
def my_exams(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return exams_for(db, user, year, semester)
