"""홈 화면 — "지금 뭘 해야 하는가" 한 번에.

화면 하나가 여러 번 물어보지 않게 **한 요청으로 다 돌려줍니다.** 홈은 켜자마자 보이는
자리라 왕복이 늘면 바로 티가 납니다.

담는 것: 지금 몇 교시인지 · 오늘 내 시간표 · 지금 있어야 할 교실 · 다음 수업 ·
학기 중인지 방학인지. 급식은 **키가 있는지와 지금 끼니만** 담고 메뉴는 `GET /meal` 이
따로 돌려줍니다 — 학교 API 가 3~5초씩 걸려서 같이 기다리면 홈 전체가 늦어집니다.
"""

import datetime
import os
import re

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload, selectinload

from backend import models, periods
from backend.auth import get_current_user, get_db
from backend.calendar_router import event_out
from backend.terms import resolve_term

router = APIRouter(tags=["home"])

# ─── 급식 ────────────────────────────────────────────────────────────────────
# ksain.net 이 학교 급식을 API 로 열어 둡니다. 키가 없으면 급식 칸만 비고 나머지는
# 그대로 돕니다 — 홈 전체가 죽으면 안 됩니다.
KSAIN_API_KEY = os.environ.get("KSAIN_API_KEY", "")
KSAIN_MEAL_URL = "https://api.ksain.net/v1/meal.php"

SLOTS = ("breakfast", "lunch", "dinner")


def _lines(raw: str | None) -> list[str]:
    """API 가 주는 한 덩어리 문자열을 메뉴 줄로 쪼갭니다.

    앞뒤로 빈 줄이 붙어 오고, 급식이 아직 안 올라온 날은 `"\\n"` 하나만 옵니다 —
    그래서 빈 줄을 걷어낸 결과가 곧 "그날 급식이 있느냐"입니다.

    원문에 섞여 있는 두 가지를 여기서 정리합니다.

    - **축산물 이력번호** — `찹스테이크(호주산801000310667)`. 원산지는 남기고 번호만
      지웁니다. 화면에서 읽을 일이 없는 12자리입니다
    - **`&` 로 시작하는 줄** — `단호박카레라이스` / `&소시지` 처럼 한 메뉴가 급식표
      칸 너비 때문에 두 줄로 갈린 것이라 앞 줄에 붙입니다
    - **괄호가 안 닫힌 줄** — `과일(메론` / `파인애플)` 도 같은 이유로 갈린 것입니다.
      앞 줄에 여는 괄호가 더 많으면 다음 줄은 그 줄의 이어짐입니다
    """
    if not raw:
        return []

    items: list[str] = []
    for line in raw.splitlines():
        text = re.sub(r"\d{8,}", "", line).strip()
        if not text:
            continue
        open_paren = items and items[-1].count("(") > items[-1].count(")")
        if items and (text.startswith("&") or open_paren):
            items[-1] += "" if text.startswith("&") else " "
            items[-1] += text
        else:
            items.append(text)
    return items


async def fetch_meal(db: Session, day: datetime.date) -> dict[str, list[str]] | None:
    """그날의 조·중·석식.

    **DB 를 먼저 봅니다.** 한 번 받은 날짜는 다시 묻지 않습니다 — 지난 급식은 바뀌지
    않고, 학교 API 를 사람 수만큼 두드릴 이유도 없습니다.

    키가 없거나 API 가 실패하면 `None`. 아직 급식이 안 올라온 날도 `None` 이고, 이때는
    **저장하지 않아** 다음 요청이 다시 물어봅니다.
    """
    row = db.get(models.MealMenu, day)
    if row:
        return {slot: _lines(getattr(row, slot)) for slot in SLOTS}

    if not KSAIN_API_KEY:
        return None

    try:
        # 학교 API 가 3~5초씩 걸립니다. 짧게 잡으면 그날 첫 조회가 통째로 실패해서
        # 아무도 급식을 못 봅니다 — 대신 이 호출은 홈이 아니라 급식 칸만 기다립니다
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                KSAIN_MEAL_URL,
                data={"key": KSAIN_API_KEY, "date": day.isoformat()},
            )
        body = res.json()
    except Exception as exc:
        # 급식이 안 나온다고 홈이 죽으면 안 됩니다. 저장하지 않아 다음에 다시 시도합니다.
        # 다만 조용히 삼키면 "왜 급식만 안 나오지" 를 알 길이 없어 로그는 남깁니다
        print(f"[meal] {day} 받아오기 실패: {exc!r}")
        return None

    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, dict):
        return None

    menu = {slot: _lines(data.get(slot)) for slot in SLOTS}
    if not any(menu.values()):
        return None  # 아직 안 올라온 날 — 빈 값으로 굳히지 않습니다

    db.add(
        models.MealMenu(
            date=day,
            **{slot: "\n".join(menu[slot]) for slot in SLOTS},
        )
    )
    try:
        db.commit()
    except Exception:
        # 같은 날짜를 동시에 받아 왔을 뿐입니다. 내용은 같으니 그냥 넘어갑니다
        db.rollback()
    return menu


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
    today = periods.today()
    if abs((date - today).days) > MEAL_RANGE_DAYS:
        raise HTTPException(
            status_code=400, detail=f"{MEAL_RANGE_DAYS}일 안쪽 날짜만 볼 수 있습니다"
        )
    return {"date": date.isoformat(), "menu": await fetch_meal(db, date)}


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

    방학이면 **언제부터 언제까지인지**도 함께 돌려줍니다 (`since` / `resumes_on`).
    화면이 방학을 "남은 날짜" 가 아니라 **막대 위의 한 점**으로 그려서, 시작점이
    없으면 어디쯤 와 있는지 그릴 수 없습니다.
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
        # 방학이 시작된 날 (= 마지막 종업). 진행 막대의 왼쪽 끝입니다
        "since": None if in_session or not ended else ended.isoformat(),
        "resumes_on": resumes.isoformat() if resumes else None,
        "days_left": (resumes - today).days if resumes else None,
    }


def events_today(
    db: Session, today: datetime.date, user: models.User
) -> list[models.CalendarEvent]:
    """오늘에 걸치는 일정. **공용 전부 + 내 개인 일정**입니다.

    남의 개인 일정은 어떤 경우에도 나가지 않습니다 — `/calendar` 와 같은 조건입니다.
    """
    return (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.start_date <= today,
            models.CalendarEvent.end_date >= today,
            or_(
                models.CalendarEvent.owner_id.is_(None),
                models.CalendarEvent.owner_id == user.id,
            ),
        )
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id)
        .all()
    )


def holiday_today(db: Session, today: datetime.date) -> str | None:
    """오늘이 휴업일인지. 맞으면 그 이름("추석"·"개교기념 휴업").

    **학교 공용 일정만 봅니다** (`owner_id IS NULL`) — 개인 일정이 남의 수업까지
    없애면 안 됩니다.
    """
    row = (
        db.query(models.CalendarEvent.title)
        .filter(
            models.CalendarEvent.category == "holiday",
            models.CalendarEvent.owner_id.is_(None),
            models.CalendarEvent.start_date <= today,
            models.CalendarEvent.end_date >= today,
        )
        .order_by(models.CalendarEvent.start_date)
        .first()
    )
    return row[0] if row else None


# ─── 홈 ──────────────────────────────────────────────────────────────────────
@router.get("/home")
async def get_home(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    target_year, target_semester = resolve_term(db, year, semester)

    now = periods.now()
    today = now.date()
    minute = now.hour * 60 + now.minute
    weekday = now.weekday()
    day = periods.DAYS[weekday] if weekday < len(periods.DAYS) else None
    period = periods.current_period(minute) if day else None
    upcoming = periods.next_period(minute) if day else None

    # ── 오늘 수업이 있는 날인가
    # 학기 데이터는 요일 단위라 **날짜를 모릅니다** — 방학이든 추석이든 "월요일"이면
    # 월요일 시간표를 그대로 돌려줍니다. 그래서 학사일정으로 한 번 걸러야 합니다.
    session = session_state(db, today)
    if not session["in_session"]:
        off_reason, off_label = "vacation", session["label"]
    elif day is None:
        off_reason, off_label = "weekend", "주말"
    elif (holiday := holiday_today(db, today)) is not None:
        off_reason, off_label = "holiday", holiday
    else:
        off_reason, off_label = None, None

    # ── 오늘 내 시간표
    my_classes: list[dict] = []
    if current_user.stu_id and off_reason is None:
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
            .options(
                joinedload(models.Class.subject)
                .joinedload(models.Subject.course)
                .joinedload(models.Course.department)
            )
            .all()
        )
        for cls, time in rows:
            subject = cls.subject
            course = subject.course
            my_classes.append({
                "period": time.period,
                "subject": f"{subject.name}(EC)" if subject.is_ec else subject.name,
                "section": cls.section,
                "teacher": cls.teacher,
                "room": time.room or cls.room,
                # 화면이 과목마다 색을 주는 근거. 교육과정에 없는 과목(외국인 전형 등)은
                # `course` 가 비어 있어 null 로 나갑니다 — 그때는 무채색으로 그립니다
                "department": (
                    course.department.name if course and course.department else None
                ),
            })
        my_classes.sort(key=lambda c: c["period"])

    by_period = {c["period"]: c for c in my_classes}
    current = by_period.get(period) if period else None
    following = next((c for c in my_classes if c["period"] > (period or 0)), None)

    return {
        "term": {"year": target_year, "semester": target_semester},
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
        },
        # 교시 시각표. 화면이 상수를 따로 들면 한쪽만 고쳤을 때 어긋나고, 홈은 어차피
        # 한 요청으로 다 받는 자리라 여기 실어 보냅니다 (11줄뿐입니다)
        "periods": periods.as_table(),
        # 교시 사이의 큰 구멍이 무엇인지 (점심·저녁). 이름이 없으면 자 위의 빈 자리가
        # 그냥 설명 없는 공백으로 남습니다
        "breaks": periods.breaks_table(),
        # 오늘 학사일정 + 내 개인 일정. 홈에 "오늘 뭐 있더라" 를 답하려면 필요하고,
        # 하루치라 몇 줄 안 됩니다 — 화면이 `/calendar` 를 또 부르지 않게 같이 보냅니다
        "events": [event_out(e) for e in events_today(db, today, current_user)],
        "today": my_classes,
        # 지금 있어야 할 수업. null 이면 공강입니다
        "current": current,
        "next": following,
        # **메뉴는 여기 담지 않습니다.** 학교 API 가 3~5초씩 걸려서, 같이 기다리면 홈
        # 전체가 그만큼 늦어집니다 — 켜자마자 보이는 자리입니다. 화면이 `GET /meal` 로
        # 따로 받아 급식 칸만 기다립니다.
        # 키가 없으면 통째로 null 이라 화면이 급식 칸을 아예 그리지 않습니다
        "meal": (
            {"date": today.isoformat(), "slot": current_meal_slot(minute)}
            if KSAIN_API_KEY
            else None
        ),
    }
