"""홈 화면 — "지금 뭘 해야 하는가" 한 번에.

화면 하나가 여러 번 물어보지 않게 **한 요청으로 다 돌려줍니다.** 홈은 켜자마자 보이는
자리라 왕복이 늘면 바로 티가 납니다.

담는 것: 지금 몇 교시인지 · 오늘 내 시간표 · **한 주 내 시간표** · 지금 있어야 할 교실 ·
다음 수업 · 학기 중인지 방학인지. 급식은 **키가 있는지와 지금 끼니만** 담고 메뉴는
`GET /meal` 이 따로 돌려줍니다 — 학교 API 가 3~5초씩 걸려서 같이 기다리면 홈 전체가
늦어집니다.
"""

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend import models
from backend.core import clock
from backend.core.auth import get_current_user
from backend.core.db import get_db
from backend.services import meals, periods
from backend.services.calendar import event_out
from backend.services.exams import active_period
from backend.services.schoolday import day_status, events_on
from backend.services.terms import resolve_term
from backend.services.timetable import student_slots, subject_label

router = APIRouter(tags=["home"])

# ─── 급식 ────────────────────────────────────────────────────────────────────
# 날짜를 얼마나 멀리까지 볼 수 있는지. 화살표를 계속 누르면 학교 API 를 그만큼
# 두드리게 되니 앞뒤로 한 달만 엽니다 — 그 밖은 볼 이유도 없습니다
MEAL_RANGE_DAYS = 31


@router.get("/meal")
async def get_meal(
    date: datetime.date,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """하루치 급식. 홈에서 날짜를 앞뒤로 넘길 때 씁니다."""
    today = clock.today()
    if abs((date - today).days) > MEAL_RANGE_DAYS:
        raise HTTPException(
            status_code=400, detail=f"{MEAL_RANGE_DAYS}일 안쪽 날짜만 볼 수 있습니다"
        )
    return {"date": date.isoformat(), "menu": await meals.fetch_meal(db, date)}


# ─── 홈 ──────────────────────────────────────────────────────────────────────
@router.get("/home")
def get_home(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_year, target_semester = resolve_term(db, year, semester)

    now = clock.now()
    today = now.date()
    minute = now.hour * 60 + now.minute
    weekday = now.weekday()
    day = periods.DAYS[weekday] if weekday < len(periods.DAYS) else None
    period = periods.current_period(minute) if day else None
    upcoming = periods.next_period(minute) if day else None

    # ── 오늘 수업이 있는 날인가
    # 학기 데이터는 요일 단위라 **날짜를 모릅니다** — 방학이든 추석이든 "월요일"이면
    # 월요일 시간표를 그대로 돌려줍니다. 그래서 학사일정으로 한 번 걸러야 합니다.
    status = day_status(db, today)
    session = status.session
    off_reason, off_label = status.off_reason, status.off_label
    timetable_override = status.override
    if timetable_override:
        # 대체수업일은 주말에도 수업일로 다룹니다 — 교시 판정을 요일과 상관없이 다시 합니다
        period = periods.current_period(minute)
        upcoming = periods.next_period(minute)

    # ── 내 시간표 — **한 주를 한 번에** 받아 옵니다
    #
    # 예전엔 오늘 것만 물어봤는데, 홈에 주간 격자가 생기면서 요일 조건만 뺐습니다.
    # 한 사람의 한 학기는 30줄 남짓이라 오늘치를 따로 물어볼 이유가 없습니다.
    week: dict[str, list[dict]] = {d: [] for d in periods.DAYS}
    if current_user.effective_stu_id:
        rows = student_slots(db, current_user.effective_stu_id, target_year, target_semester)
        for cls, time in rows:
            if time.day not in week:
                continue  # 주말에 걸린 수업은 없지만, 있어도 격자에 놓을 자리가 없습니다
            subject = cls.subject
            course = subject.course
            week[time.day].append({
                "period": time.period,
                "subject": subject_label(subject.name, subject.is_ec),
                "section": cls.section,
                "teacher": cls.teacher,
                "room": time.room or cls.room,
                # 화면이 과목마다 색을 주는 근거. 교육과정에 없는 과목(외국인 전형 등)은
                # `course` 가 비어 있어 null 로 나갑니다 — 그때는 무채색으로 그립니다
                "department": (
                    course.department.name if course and course.department else None
                ),
            })
        for day_classes in week.values():
            day_classes.sort(key=lambda c: c["period"])

    # ⚠️ **`today` 만 학사일정으로 거릅니다.** 학기 데이터는 요일 단위라 방학 중
    # 월요일에도 "월요일 시간표" 가 그대로 나오는데, `week` 는 오늘이 아니라 **이 학기**
    # 를 말하는 값이라 방학에도 그대로 둡니다 — 비우면 방학에 시간표를 볼 길이 없습니다.
    my_classes = week[status.class_day] if status.class_day else []

    by_period = {c["period"]: c for c in my_classes}
    current = by_period.get(period) if period else None
    following = next((c for c in my_classes if c["period"] > (period or 0)), None)

    return {
        "term": {"year": target_year, "semester": target_semester},
        "exam_period": active_period(db, target_year, target_semester),
        "now": {
            "time": now.strftime("%H:%M"),
            # 자정 기준 분. 화면이 하루를 시간 축으로 그려서 캐럿을 여기에 세웁니다
            "minute": minute,
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
        "session": {
            **session,
            # 오늘 수업이 있는 날인가. False 면 `today` 는 항상 비어 있습니다
            "has_class": off_reason is None,
            # vacation | weekend | holiday | null
            "off_reason": off_reason,
            # "여름방학" · "주말" · "추석" — 화면에 그대로 씁니다
            "off_label": off_label,
            "timetable_override": (
                {"title": timetable_override.title, "source_day": timetable_override.source_day}
                if timetable_override else None
            ),
        },
        # 교시 시각표. 화면이 상수를 따로 들면 한쪽만 고쳤을 때 어긋나고, 홈은 어차피
        # 한 요청으로 다 받는 자리라 여기 실어 보냅니다 (11줄뿐입니다)
        "periods": periods.as_table(),
        # 교시 사이의 큰 구멍이 무엇인지 (점심·저녁). 이름이 없으면 자 위의 빈 자리가
        # 그냥 설명 없는 공백으로 남습니다
        "breaks": periods.breaks_table(),
        # 오늘 학사일정 + 내 개인 일정. 홈에 "오늘 뭐 있더라" 를 답하려면 필요하고,
        # 하루치라 몇 줄 안 됩니다 — 화면이 `/calendar` 를 또 부르지 않게 같이 보냅니다
        "events": [event_out(e) for e in events_on(db, today, current_user)],
        "today": my_classes,
        # 요일별 내 수업 — 홈의 주간 격자가 씁니다. **`today` 와 달리 방학·휴업에도
        # 그대로 옵니다**: 오늘이 아니라 이 학기를 말하는 값이라서입니다
        "week": week,
        # 지금 있어야 할 수업. null 이면 공강입니다
        "current": current,
        "next": following,
        # **메뉴는 여기 담지 않습니다.** 학교 API 가 3~5초씩 걸려서, 같이 기다리면 홈
        # 전체가 그만큼 늦어집니다 — 켜자마자 보이는 자리입니다. 화면이 `GET /meal` 로
        # 따로 받아 급식 칸만 기다립니다.
        # 키가 없으면 통째로 null 이라 화면이 급식 칸을 아예 그리지 않습니다
        "meal": (
            {"date": today.isoformat(), "slot": meals.current_slot(minute)}
            if meals.enabled()
            else None
        ),
    }
