"""그날 판정 — 학기 중인지, 수업이 있는 날인지, 어느 요일 시간표를 쓰는지.

학기 데이터는 `ClassTime.day` 로 **요일만** 들고 있어서 날짜를 모릅니다. 그냥 조회하면 방학 중
월요일에도 월요일 시간표가 나옵니다. 그래서 학사일정으로 한 번 거릅니다 — 홈(`GET /home`)과
Agent 의 날짜를 받는 도구가 **같은 규칙**을 쓰도록 여기 한 곳에 둡니다.

| 판정 | 근거 |
| --- | --- |
| 방학 | `term` 분류의 `개학`·`종업` 표지 — 마지막 종업이 마지막 개학보다 뒤면 방학 |
| 주말 | 토·일 |
| 휴업일 | `holiday` 분류의 **공용** 일정 (개인 일정이 남의 수업을 지우면 안 됩니다) |
| 대체 시간표 | `TimetableOverride` — 위 셋보다 우선하고, 지정한 요일의 수업을 씁니다 |
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend import models
from backend.services import periods
from backend.services.calendar import visible_to


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


def holiday_on(db: Session, day: datetime.date) -> str | None:
    """그날이 휴업일인지. 맞으면 그 이름("추석"·"개교기념 휴업").

    **학교 공용 일정만 봅니다** (`owner_id IS NULL`) — 개인 일정이 남의 수업까지
    없애면 안 됩니다.
    """
    row = (
        db.query(models.CalendarEvent.title)
        .filter(
            models.CalendarEvent.category == "holiday",
            models.CalendarEvent.owner_id.is_(None),
            models.CalendarEvent.start_date <= day,
            models.CalendarEvent.end_date >= day,
        )
        .order_by(models.CalendarEvent.start_date)
        .first()
    )
    return row[0] if row else None


def events_on(db: Session, day: datetime.date, user: models.User) -> list[models.CalendarEvent]:
    """그날에 걸치는 일정 — 공용 전부 + 내 개인 일정 (`/calendar` 와 같은 공개 범위)."""
    return (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.start_date <= day,
            models.CalendarEvent.end_date >= day,
            visible_to(user),
        )
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id)
        .all()
    )


@dataclass
class DayStatus:
    date: datetime.date
    #: MON~FRI, 주말이면 None
    weekday: str | None
    #: `session_state()` 결과
    session: dict
    #: vacation | weekend | holiday | None — None 이면 수업이 있는 날입니다
    off_reason: str | None
    #: "여름방학" · "주말" · "추석" — 화면에 그대로 씁니다
    off_label: str | None
    override: models.TimetableOverride | None

    @property
    def class_day(self) -> str | None:
        """그날 수업으로 쓸 요일. 수업이 없는 날이면 None."""
        if self.override is not None:
            return self.override.source_day
        return None if self.off_reason else self.weekday


def day_status(db: Session, day: datetime.date) -> DayStatus:
    """그날 수업이 있는지와, 있다면 어느 요일 시간표를 쓰는지."""
    index = day.weekday()
    weekday = periods.DAYS[index] if index < len(periods.DAYS) else None
    session = session_state(db, day)
    if not session["in_session"]:
        off_reason, off_label = "vacation", session["label"]
    elif weekday is None:
        off_reason, off_label = "weekend", "주말"
    elif (holiday := holiday_on(db, day)) is not None:
        off_reason, off_label = "holiday", holiday
    else:
        off_reason, off_label = None, None

    override = db.query(models.TimetableOverride).filter_by(date=day).first()
    if override is not None:
        # 대체수업일은 휴업·주말 판정보다 우선합니다 — 지정한 요일의 수업을 그날 수업으로 씁니다
        off_reason, off_label = None, None
    return DayStatus(day, weekday, session, off_reason, off_label, override)
