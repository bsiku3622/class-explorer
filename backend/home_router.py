"""홈 화면 — "지금 뭘 해야 하는가" 한 번에.

화면 하나가 여러 번 물어보지 않게 **한 요청으로 다 돌려줍니다.** 홈은 켜자마자 보이는
자리라 왕복이 늘면 바로 티가 납니다.

담는 것: 지금 몇 교시인지 · 오늘 내 시간표 · 지금 있어야 할 교실 · 다음 수업 ·
지금 공강인 친구 · 급식 · 학기 중인지 방학인지.
"""

import datetime
import os

import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload

from backend import models, periods
from backend.auth import get_current_user, get_db
from backend.friends_router import _busy_by_student, _friend_stu_ids, _names
from backend.terms import resolve_term

router = APIRouter(tags=["home"])

# ─── 급식 ────────────────────────────────────────────────────────────────────
# ksain.net 이 학교 급식을 API 로 열어 둡니다. 키가 없으면 급식 칸만 비고 나머지는
# 그대로 돕니다 — 홈 전체가 죽으면 안 됩니다.
KSAIN_API_KEY = os.environ.get("KSAIN_API_KEY", "")
KSAIN_MEAL_URL = "https://api.ksain.net/v1/meal.php"

# 날짜별로 한 번만 받아 둡니다. 급식은 하루 안에 안 바뀝니다.
_meal_cache: dict[str, dict | None] = {}


async def fetch_meal(day: datetime.date) -> dict | None:
    """그날의 조·중·석식. 키가 없거나 실패하면 None."""
    if not KSAIN_API_KEY:
        return None
    key = day.isoformat()
    if key in _meal_cache:
        return _meal_cache[key]
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            res = await client.post(
                KSAIN_MEAL_URL,
                data={"key": KSAIN_API_KEY, "date": key},
            )
        body = res.json()
        meal = body.get("data") if isinstance(body, dict) else None
        if meal:
            meal = {
                "breakfast": meal.get("breakfast"),
                "lunch": meal.get("lunch"),
                "dinner": meal.get("dinner"),
            }
    except Exception:
        # 급식이 안 나온다고 홈이 죽으면 안 됩니다. 캐시에 넣지 않아 다음에 다시 시도합니다
        return None
    _meal_cache[key] = meal
    return meal


def current_meal_slot(minute: int) -> str | None:
    """지금 시간대에 해당하는 끼니. 식사 시간이 아니면 다음 끼니를 가리킵니다."""
    if minute < periods._m(8, 30):
        return "breakfast"
    if minute < periods._m(13, 10):
        return "lunch"
    if minute < periods._m(19, 0):
        return "dinner"
    return None


# ─── 학기 / 방학 ─────────────────────────────────────────────────────────────
def _season(resumes: datetime.date) -> str:
    return {6: "여름방학", 7: "여름방학", 8: "여름방학", 9: "여름방학"}.get(
        resumes.month, "겨울방학"
    )


def session_state(db: Session, today: datetime.date) -> dict:
    """학기 중인지 방학인지.

    학사일정의 `개학`·`종업` 표지로 판단합니다 — "방학" 이라는 일정이 따로 없어서,
    마지막 종업이 마지막 개학보다 뒤면 지금은 방학입니다.
    """
    def last(keyword: str) -> datetime.date | None:
        row = (
            db.query(models.CalendarEvent.start_date)
            .filter(
                models.CalendarEvent.category == "term",
                models.CalendarEvent.title.like(f"%{keyword}%"),
                models.CalendarEvent.start_date <= today,
            )
            .order_by(models.CalendarEvent.start_date.desc())
            .first()
        )
        return row[0] if row else None

    started, ended = last("개학"), last("종업")
    in_session = started is not None and (ended is None or ended <= started)

    resumes = None
    if not in_session:
        row = (
            db.query(models.CalendarEvent.start_date)
            .filter(
                models.CalendarEvent.category == "term",
                models.CalendarEvent.title.like("%개학%"),
                models.CalendarEvent.start_date > today,
            )
            .order_by(models.CalendarEvent.start_date)
            .first()
        )
        resumes = row[0] if row else None

    return {
        "in_session": in_session,
        "label": None if in_session else (_season(resumes) if resumes else "방학"),
        "resumes_on": resumes.isoformat() if resumes else None,
        "days_left": (resumes - today).days if resumes else None,
    }


# ─── 홈 ──────────────────────────────────────────────────────────────────────
@router.get("/home")
async def get_home(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_year, target_semester = resolve_term(db, year, semester)

    now = datetime.datetime.now()
    today = now.date()
    minute = now.hour * 60 + now.minute
    weekday = now.weekday()
    day = periods.DAYS[weekday] if weekday < len(periods.DAYS) else None
    period = periods.current_period(minute) if day else None
    upcoming = periods.next_period(minute) if day else None

    # ── 오늘 내 시간표
    my_classes: list[dict] = []
    if current_user.stu_id and day:
        rows = (
            db.query(models.Class, models.ClassTime)
            .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
            .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
            .filter(
                models.Enrollment.stuId == current_user.stu_id,
                models.Class.year == target_year,
                models.Class.semester == target_semester,
                models.ClassTime.day == day,
            )
            .options(joinedload(models.Class.subject))
            .all()
        )
        for cls, time in rows:
            subject = cls.subject
            my_classes.append({
                "period": time.period,
                "subject": f"{subject.name}(EC)" if subject.is_ec else subject.name,
                "section": cls.section,
                "teacher": cls.teacher,
                "room": time.room or cls.room,
            })
        my_classes.sort(key=lambda c: c["period"])

    by_period = {c["period"]: c for c in my_classes}
    current = by_period.get(period) if period else None
    following = next((c for c in my_classes if c["period"] > (period or 0)), None)

    # ── 지금 공강인 친구
    friend_ids = _friend_stu_ids(db, current_user.id)
    free_friends: list[dict] = []
    if friend_ids:
        busy = _busy_by_student(db, friend_ids, target_year, target_semester)
        names = _names(db, friend_ids)
        slot = f"{day}-{period}" if day and period else None
        for stu_id in friend_ids:
            if slot is None or slot not in busy.get(stu_id, set()):
                free_friends.append({"stuId": stu_id, "name": names.get(stu_id, stu_id)})

    return {
        "term": {"year": target_year, "semester": target_semester},
        "now": {
            "time": now.strftime("%H:%M"),
            "date": today.isoformat(),
            "day": day,
            "period": period,
            "break_name": periods.current_break(minute) if day else None,
            "next_period": (
                {"period": upcoming[0], "start": periods.hhmm(upcoming[1])}
                if upcoming
                else None
            ),
        },
        "session": session_state(db, today),
        "today": my_classes,
        # 지금 있어야 할 수업. null 이면 공강입니다
        "current": current,
        "next": following,
        "friends": {
            "free": free_friends,
            "total": len(friend_ids),
            # 수업 시간이 아니면 "공강" 을 따질 게 없습니다
            "counted": period is not None,
        },
        "meal": {
            "slot": current_meal_slot(minute),
            "menu": await fetch_meal(today),
        },
    }
