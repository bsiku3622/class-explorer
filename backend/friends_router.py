"""친구 + 교시 시각표. **두 앱이 같이 씁니다** (class-explorer / ksa-bench).

## 친구는 단방향입니다

내가 추가하면 끝이고 상대의 수락이 없습니다. 두 앱 모두 남의 시간표를 이미 볼 수 있어서
(class-explorer 는 벌크 응답으로, ksa-bench 는 `GET /students/{stu_id}` 로 한 명씩),
승인 절차를 붙여도 막아 주는 게 없고 마찰만 늘기 때문입니다. 그래서 이 표는 새로 뭘
열어 주는 게 아니라 **자주 보는 사람을 북마크해 두는 것**입니다.

A가 B를 추가해도 B의 목록에는 A가 없습니다.

## 시간표는 슬롯만 나갑니다

`/friends/busy` 와 `/friends/now` 는 **언제 수업이 있는지**만 돌려줍니다. 과목·교실은
보내지 않습니다 — 공강을 맞추는 데 필요 없고, 주면 "누가 뭘 듣는지" 훑는 화면이 됩니다.
"""

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models, periods
from backend.auth import get_current_user, get_db
from backend.terms import resolve_term
from backend.versioning import at_version

router = APIRouter(tags=["friends"])


class FriendRequest(BaseModel):
    stu_id: str = Field(min_length=1, max_length=16)


def _friend_stu_ids(db: Session, user_id: int) -> list[str]:
    return [
        row[0]
        for row in db.query(models.Friend.friend_stu_id)
        .filter(models.Friend.user_id == user_id)
        .order_by(models.Friend.friend_stu_id)
        .all()
    ]


def _busy_by_student(
    db: Session, stu_ids: list[str], year: int, semester: int
) -> dict[str, set[str]]:
    """학번 → 수업이 있는 슬롯(`"MON-3"`) 집합"""
    busy: dict[str, set[str]] = {stu_id: set() for stu_id in stu_ids}
    if not stu_ids:
        return busy
    rows = (
        db.query(models.Enrollment.stuId, models.ClassTime.day, models.ClassTime.period)
        .join(models.Class, models.Class.id == models.Enrollment.classId)
        .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
        .filter(
            models.Enrollment.stuId.in_(stu_ids),
            models.Class.year == year,
            models.Class.semester == semester,
            at_version(models.Class),
            at_version(models.ClassTime),
            at_version(models.Enrollment),
        )
        .all()
    )
    for stu_id, day, period in rows:
        busy.setdefault(stu_id, set()).add(f"{day}-{period}")
    return busy


def _names(db: Session, stu_ids: list[str]) -> dict[str, str]:
    if not stu_ids:
        return {}
    return {
        s.stuId: s.name
        for s in db.query(models.Student).filter(models.Student.stuId.in_(stu_ids)).all()
    }


def _me_first(db: Session, user: models.User) -> list[str]:
    """친구 목록 앞에 본인을 붙입니다 — 겹쳐 보려면 내 시간표가 있어야 합니다"""
    stu_ids = _friend_stu_ids(db, user.id)
    return ([user.stu_id] if user.stu_id else []) + stu_ids


# ─── 교시 시각표 ─────────────────────────────────────────────────────────────
@router.get("/periods")
async def get_periods(_: models.User = Depends(get_current_user)):
    """교시별 시각. 화면이 따로 상수를 들고 있지 않도록 서버가 원본을 갖습니다."""
    return {"periods": periods.as_table(), "breaks": periods.breaks_table()}


# ─── 친구 ────────────────────────────────────────────────────────────────────
@router.get("/friends")
async def list_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    stu_ids = _friend_stu_ids(db, current_user.id)
    names = _names(db, stu_ids)
    return {
        "friends": [{"stuId": s, "name": names.get(s, s)} for s in stu_ids]
    }


@router.post("/friends", status_code=status.HTTP_201_CREATED)
async def add_friend(
    body: FriendRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.stuId == body.stu_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="학생을 찾을 수 없습니다.")
    if student.stuId == current_user.stu_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본인은 추가할 수 없습니다.")

    exists = (
        db.query(models.Friend)
        .filter(
            models.Friend.user_id == current_user.id,
            models.Friend.friend_stu_id == student.stuId,
        )
        .first()
    )
    if not exists:
        db.add(models.Friend(user_id=current_user.id, friend_stu_id=student.stuId))
        db.commit()
    return {"stuId": student.stuId, "name": student.name}


@router.delete("/friends/{stu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    stu_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Friend).filter(
        models.Friend.user_id == current_user.id,
        models.Friend.friend_stu_id == stu_id,
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/friends/busy")
async def friends_busy_slots(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """주간 공강 격자용. 슬롯(`"MON-3"`)만 나가고 과목명은 나가지 않습니다."""
    target_year, target_semester = resolve_term(db, year, semester)
    stu_ids = _me_first(db, current_user)
    busy = _busy_by_student(db, stu_ids, target_year, target_semester)
    names = _names(db, stu_ids)

    return {
        "term": {"year": target_year, "semester": target_semester},
        "people": [
            {
                "stuId": stu_id,
                "name": names.get(stu_id, stu_id),
                "is_me": stu_id == current_user.stu_id,
                "busy": sorted(busy.get(stu_id, set())),
            }
            for stu_id in stu_ids
        ],
    }


@router.get("/friends/now")
async def friends_now(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """**지금 공강인 친구.**

    "지금"은 **서버 시계**로 정합니다. 클라이언트 시계는 틀어져 있거나 손댈 수 있어서
    "지금 공강" 이 사람마다 다르게 보일 수 있습니다. 서버는 학교와 같은 시간대(KST)에
    있습니다.

    주말이나 수업 시간이 아니면 `period` 가 null 이고, 그때는 `free` 를 판단하지 않고
    전원을 그대로 돌려줍니다 — 화면이 "지금은 수업 시간이 아닙니다" 를 띄우면 됩니다.
    """
    target_year, target_semester = resolve_term(db, year, semester)
    now = periods.now()
    minute = now.hour * 60 + now.minute
    weekday = now.weekday()  # 0=월
    day = periods.DAYS[weekday] if weekday < len(periods.DAYS) else None
    period = periods.current_period(minute) if day else None
    upcoming = periods.next_period(minute) if day else None

    stu_ids = _me_first(db, current_user)
    busy = _busy_by_student(db, stu_ids, target_year, target_semester)
    names = _names(db, stu_ids)

    slot = f"{day}-{period}" if day and period else None
    people = [
        {
            "stuId": stu_id,
            "name": names.get(stu_id, stu_id),
            "is_me": stu_id == current_user.stu_id,
            # 수업 시간이 아니면 판단하지 않습니다
            "free": None if slot is None else slot not in busy.get(stu_id, set()),
        }
        for stu_id in stu_ids
    ]

    return {
        "term": {"year": target_year, "semester": target_semester},
        "now": now.strftime("%H:%M"),
        "day": day,
        "period": period,
        # 저녁·자습은 교시와 겹칩니다 — 화면이 "10교시 · 자습" 처럼 같이 씁니다
        "break_name": periods.current_break(minute) if day else None,
        "next_period": (
            {"period": upcoming[0], "start": periods.hhmm(upcoming[1])}
            if upcoming
            else None
        ),
        "people": people,
    }
