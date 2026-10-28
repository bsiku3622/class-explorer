"""학사일정 — 직렬화와 공개 범위. 화면(`routers/calendar.py`)·홈·Agent 가 같이 씁니다.

**공개 범위는 `visible_to()` 하나로 겁니다** — 공용 일정(`owner_id IS NULL`) 전부 + 내 개인 일정.
남의 개인 일정은 어떤 경우에도 나가지 않습니다. 이 조건을 손으로 다시 적지 마세요 — 한때
`/calendar`·홈·Agent 에 세 벌이 따로 있었습니다.
"""
from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.sql.elements import ColumnElement

from backend import models
from backend.services import majors


def visible_to(user: models.User) -> ColumnElement[bool]:
    """이 사람이 볼 수 있는 일정 — 공용 전부 + 본인 개인 일정."""
    return or_(models.CalendarEvent.owner_id.is_(None), models.CalendarEvent.owner_id == user.id)


def grades(value: str | None) -> list[int]:
    """`"1,2"` → `[1, 2]`. 비어 있으면 전학년입니다."""
    return [int(g) for g in value.split(",") if g.strip().isdigit()] if value else []


def event_out(event: models.CalendarEvent) -> dict:
    return {
        "id": event.id,
        "title": event.title,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat(),
        "time_mode": event.time_mode,
        "start_minute": event.start_minute,
        "end_minute": event.end_minute,
        "start_period": event.start_period,
        "end_period": event.end_period,
        "category": event.category,
        "target_grades": grades(event.target_grades),
        "target_majors": majors.split(event.target_majors),
        "source": event.source,
        "is_personal": event.owner_id is not None,
        "series_id": event.series_id,
        "note": event.note,
    }


def request_out(req: models.EventRequest, username: str) -> dict:
    return {
        "id": req.id,
        "title": req.title,
        "start_date": req.start_date.isoformat(),
        "end_date": req.end_date.isoformat(),
        "time_mode": req.time_mode,
        "start_minute": req.start_minute,
        "end_minute": req.end_minute,
        "start_period": req.start_period,
        "end_period": req.end_period,
        "category": req.category,
        "target_grades": grades(req.target_grades),
        "target_majors": majors.split(req.target_majors),
        "note": req.note,
        "status": req.status,
        "reason": req.reason,
        "requested_by": username,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }
