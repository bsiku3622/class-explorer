"""전공(심화필수 전공 트랙) — 본인 것만 묻고 본인 것만 고칩니다.

| 경로 | 하는 일 |
| --- | --- |
| `GET /majors` | 고를 수 있는 트랙(학부별·심화필수 조건) + 내 전공 + 수강 이력으로 짐작한 트랙 |
| `PUT /majors/me` | 내 전공 적기. `major: null` 은 "아직 정하지 않았어요" — 그래도 답한 것으로 칩니다 |
| `GET /majors/stats` | 조사 현황 — 트랙별 **인원 수**와 응답률 (admin) |

전공은 Ask 의 개인화("내 일정")와 학사일정의 "내 학년·전공" 거르기에 쓰입니다. 남의 전공을 보는
경로는 두지 않습니다 — 관리자도 인원 수만 봅니다. 조사가 얼마나 됐는지 알려면 그거면 충분합니다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.core import clock
from backend.core.auth import get_current_admin, get_current_user
from backend.core.db import get_db
from backend.services import majors

router = APIRouter(prefix="/majors", tags=["majors"])


class MajorBody(BaseModel):
    # 트랙 이름(`수학` … `생물학`). null 이면 아직 정하지 않음
    major: str | None = Field(default=None, max_length=20)


@router.get("")
def list_majors(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return {
        "options": majors.options(db),
        "me": majors.me(user),
        # 아직 안 골랐을 때만 짐작합니다 — 고른 사람에게 다른 걸 권하면 헷갈립니다
        "suggestion": None if user.major else majors.suggest(db, user.effective_stu_id),
    }


@router.put("/me")
def set_major(
    body: MajorBody,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if body.major is not None and body.major not in majors.MAJORS:
        raise HTTPException(status_code=422, detail="모르는 전공 트랙입니다")
    user.major = body.major
    user.major_answered_at = clock.utcnow()
    db.commit()
    return majors.me(user)


@router.get("/stats")
def survey_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    # 학번을 확인한 계정만 셉니다 — 교사·관리자 계정과 시연 계정(빌린 학번)은 조사 대상이 아닙니다
    rows = (db.query(models.User.major, models.User.major_answered_at)
            .filter(models.User.stu_id.isnot(None)).all())
    counts = {major: 0 for major in majors.MAJORS}
    undecided = unanswered = 0
    for major, answered_at in rows:
        if major in counts:
            counts[major] += 1
        elif answered_at is not None:
            undecided += 1
        else:
            unanswered += 1
    return {
        "students": len(rows),
        "unanswered": unanswered,
        "undecided": undecided,
        "divisions": [
            {"division": division, "majors": [{"name": major, "count": counts[major]} for major in names]}
            for division, names in majors.DIVISIONS.items()
        ],
    }
