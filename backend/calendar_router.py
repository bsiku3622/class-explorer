"""
학사일정 API (`/calendar/*`)

일정은 두 갈래입니다.

- **공용 일정** — `owner_id`가 비어 있고 모두에게 보입니다. 매니저 이상만 고칩니다
- **개인 일정** — 본인만 보고 본인만 고칩니다

일반 계정이 공용 일정을 넣고 싶으면 `/calendar/requests`로 제안하고, 매니저가
허용하면 그때 공용 일정이 됩니다.
"""
from __future__ import annotations

import datetime
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_manager, get_current_user, get_db

router = APIRouter(prefix="/calendar", tags=["calendar"])

TimeMode = Literal["allday", "clock", "period"]
Category = Literal["holiday", "dorm", "exam", "term", "academic", "event"]
Repeat = Literal["none", "daily", "weekly", "monthly"]

# 반복을 펼칠 때의 안전장치. 규칙이 아니라 실제 행으로 저장하므로 상한이 필요합니다
MAX_OCCURRENCES = 200


# ─── 스키마 ──────────────────────────────────────────────────────────────────
class EventBody(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start_date: datetime.date
    end_date: Optional[datetime.date] = None
    time_mode: TimeMode = "allday"
    start_minute: Optional[int] = Field(default=None, ge=0, le=1439)
    end_minute: Optional[int] = Field(default=None, ge=0, le=1439)
    start_period: Optional[int] = Field(default=None, ge=1, le=11)
    end_period: Optional[int] = Field(default=None, ge=1, le=11)
    category: Category = "event"
    target_grades: list[int] = Field(default_factory=list)
    note: Optional[str] = Field(default=None, max_length=2000)
    # 반복은 만들 때만 씁니다. 저장은 회차마다 한 행씩입니다
    repeat: Repeat = "none"
    repeat_until: Optional[datetime.date] = None

    @model_validator(mode="after")
    def _check(self):
        if self.end_date is None:
            self.end_date = self.start_date
        if self.end_date < self.start_date:
            raise ValueError("끝나는 날이 시작일보다 앞섭니다.")
        if self.time_mode == "clock":
            if self.start_minute is None:
                raise ValueError("시각을 고르면 시작 시각이 있어야 합니다.")
            if self.end_minute is not None and self.end_minute < self.start_minute:
                raise ValueError("끝나는 시각이 시작보다 앞섭니다.")
        if self.time_mode == "period":
            if self.start_period is None:
                raise ValueError("교시를 고르면 시작 교시가 있어야 합니다.")
            if self.end_period is not None and self.end_period < self.start_period:
                raise ValueError("끝나는 교시가 시작보다 앞섭니다.")
        if any(g not in (1, 2, 3) for g in self.target_grades):
            raise ValueError("학년은 1·2·3만 됩니다.")
        if self.repeat != "none" and self.repeat_until is None:
            raise ValueError("반복하려면 언제까지인지 정해야 합니다.")
        return self


class DecisionBody(BaseModel):
    approve: bool
    reason: Optional[str] = Field(default=None, max_length=200)


# ─── 직렬화 ──────────────────────────────────────────────────────────────────
def _grades(value: Optional[str]) -> list[int]:
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
        "target_grades": _grades(event.target_grades),
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
        "target_grades": _grades(req.target_grades),
        "note": req.note,
        "status": req.status,
        "reason": req.reason,
        "requested_by": username,
        "created_at": req.created_at.isoformat() if req.created_at else None,
    }


def _fields_from(body: EventBody) -> dict:
    """일정과 제안이 공유하는 값들. 시간 모드에 안 맞는 칸은 비웁니다."""
    clock = body.time_mode == "clock"
    period = body.time_mode == "period"
    return {
        "title": body.title.strip(),
        "time_mode": body.time_mode,
        "start_minute": body.start_minute if clock else None,
        "end_minute": body.end_minute if clock else None,
        "start_period": body.start_period if period else None,
        "end_period": body.end_period if period else None,
        "category": body.category,
        "target_grades": ",".join(str(g) for g in sorted(set(body.target_grades))) or None,
        "note": (body.note or "").strip() or None,
    }


def _occurrences(body: EventBody) -> list[tuple[datetime.date, datetime.date]]:
    """
    반복을 실제 날짜로 펼칩니다. 규칙으로 두지 않는 이유는 models 쪽에 적어 뒀습니다.

    기간이 있는 일정이면 회차마다 같은 길이를 유지합니다 — 2박 3일 행사를 매주
    반복하면 매주 2박 3일입니다.
    """
    span = body.end_date - body.start_date
    if body.repeat == "none":
        return [(body.start_date, body.end_date)]

    out: list[tuple[datetime.date, datetime.date]] = []
    cursor = body.start_date
    while cursor <= body.repeat_until and len(out) < MAX_OCCURRENCES:
        out.append((cursor, cursor + span))
        if body.repeat == "daily":
            cursor += datetime.timedelta(days=1)
        elif body.repeat == "weekly":
            cursor += datetime.timedelta(weeks=1)
        else:  # monthly — 같은 날짜로. 31일처럼 없는 달은 건너뜁니다
            year, month = cursor.year, cursor.month + 1
            if month > 12:
                year, month = year + 1, 1
            try:
                cursor = cursor.replace(year=year, month=month)
            except ValueError:
                cursor = cursor.replace(year=year, month=month, day=1) + datetime.timedelta(days=31)
                cursor = cursor.replace(day=body.start_date.day) if cursor.day != body.start_date.day else cursor
    return out


# ─── 조회 ────────────────────────────────────────────────────────────────────
@router.get("")
def list_events(
    start: datetime.date = Query(..., description="이 날짜부터"),
    end: datetime.date = Query(..., description="이 날짜까지"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    기간에 걸치는 일정을 모두 돌려줍니다.

    공용 일정 전부 + **내** 개인 일정입니다. 남의 개인 일정은 어떤 경우에도 나가지
    않습니다 — 조회는 여기 한 곳뿐이라 이 조건만 지키면 됩니다.
    """
    if end < start:
        raise HTTPException(status_code=422, detail="끝 날짜가 시작보다 앞섭니다.")

    events = (
        db.query(models.CalendarEvent)
        .filter(
            models.CalendarEvent.start_date <= end,
            models.CalendarEvent.end_date >= start,
            or_(
                models.CalendarEvent.owner_id.is_(None),
                models.CalendarEvent.owner_id == current_user.id,
            ),
        )
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id)
        .all()
    )
    return {"events": [event_out(e) for e in events]}


# ─── 개인 일정 ───────────────────────────────────────────────────────────────
@router.post("/personal", status_code=201)
def create_personal(
    body: EventBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """내 일정. 아무나 자유롭게 넣습니다 — 나만 보이니까요."""
    series = str(uuid.uuid4()) if body.repeat != "none" else None
    fields = _fields_from(body)
    created = [
        models.CalendarEvent(
            **fields,
            start_date=start,
            end_date=end,
            source="manual",
            owner_id=current_user.id,
            series_id=series,
        )
        for start, end in _occurrences(body)
    ]
    db.add_all(created)
    db.commit()
    return {"created": len(created), "events": [event_out(e) for e in created]}


# ─── 공용 일정 (매니저) ───────────────────────────────────────────────────────
@router.post("/events", status_code=201)
def create_shared(
    body: EventBody,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_manager),
):
    series = str(uuid.uuid4()) if body.repeat != "none" else None
    fields = _fields_from(body)
    created = [
        models.CalendarEvent(
            **fields,
            start_date=start,
            end_date=end,
            source="manual",
            owner_id=None,
            series_id=series,
        )
        for start, end in _occurrences(body)
    ]
    db.add_all(created)
    db.commit()
    return {"created": len(created), "events": [event_out(e) for e in created]}


def _editable(
    event_id: int, db: Session, user: models.User
) -> models.CalendarEvent:
    """
    고칠 수 있는 일정인지 확인합니다.

    남의 개인 일정은 **없는 것처럼** 404 를 돌려줍니다 — 403 이면 "그 일정이 있긴
    하다"는 사실이 새어 나갑니다.
    """
    event = db.query(models.CalendarEvent).filter(models.CalendarEvent.id == event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="없는 일정입니다.")
    if event.owner_id is None:
        if not user.has_role("manager"):
            raise HTTPException(status_code=403, detail="학사일정은 매니저만 고칠 수 있습니다.")
    elif event.owner_id != user.id:
        raise HTTPException(status_code=404, detail="없는 일정입니다.")
    return event


@router.put("/events/{event_id}")
def update_event(
    event_id: int,
    body: EventBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """한 회차만 고칩니다. 반복 묶음 전체를 바꾸려면 지우고 다시 만드세요."""
    event = _editable(event_id, db, current_user)
    for key, value in _fields_from(body).items():
        setattr(event, key, value)
    event.start_date = body.start_date
    event.end_date = body.end_date
    db.commit()
    return event_out(event)


@router.delete("/events/{event_id}")
def delete_event(
    event_id: int,
    series: bool = Query(False, description="같은 반복 묶음을 통째로"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    event = _editable(event_id, db, current_user)
    if series and event.series_id:
        removed = (
            db.query(models.CalendarEvent)
            .filter(
                models.CalendarEvent.series_id == event.series_id,
                models.CalendarEvent.owner_id.is_(event.owner_id)
                if event.owner_id is None
                else models.CalendarEvent.owner_id == event.owner_id,
            )
            .delete(synchronize_session=False)
        )
    else:
        db.delete(event)
        removed = 1
    db.commit()
    return {"deleted": removed}


# ─── 제안 ────────────────────────────────────────────────────────────────────
@router.post("/requests", status_code=201)
def create_request(
    body: EventBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """공용 일정으로 넣어 달라고 제안합니다. 반복은 매니저가 정하도록 받지 않습니다."""
    fields = _fields_from(body)
    fields.pop("note", None)
    req = models.EventRequest(
        user_id=current_user.id,
        start_date=body.start_date,
        end_date=body.end_date,
        note=(body.note or "").strip() or None,
        **fields,
    )
    db.add(req)
    db.commit()
    return request_out(req, current_user.username)


@router.get("/requests")
def list_requests(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    매니저는 아직 처리 안 된 제안 전부를, 일반 계정은 자기가 낸 것만 봅니다.
    """
    query = db.query(models.EventRequest, models.User.username).join(
        models.User, models.EventRequest.user_id == models.User.id
    )
    if current_user.has_role("manager"):
        query = query.filter(models.EventRequest.status == "pending")
    else:
        query = query.filter(models.EventRequest.user_id == current_user.id)
    rows = query.order_by(models.EventRequest.created_at.desc()).all()
    return {"requests": [request_out(req, username) for req, username in rows]}


@router.post("/requests/{request_id}/decide")
def decide_request(
    request_id: int,
    body: DecisionBody,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_manager),
):
    """허용하면 그 자리에서 공용 일정이 만들어집니다."""
    req = db.query(models.EventRequest).filter(models.EventRequest.id == request_id).first()
    if req is None:
        raise HTTPException(status_code=404, detail="없는 제안입니다.")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="이미 처리된 제안입니다.")

    if body.approve:
        event = models.CalendarEvent(
            title=req.title,
            start_date=req.start_date,
            end_date=req.end_date,
            time_mode=req.time_mode,
            start_minute=req.start_minute,
            end_minute=req.end_minute,
            start_period=req.start_period,
            end_period=req.end_period,
            category=req.category,
            target_grades=req.target_grades,
            note=req.note,
            source="manual",
            owner_id=None,
        )
        db.add(event)
        db.flush()
        req.event_id = event.id

    req.status = "approved" if body.approve else "rejected"
    req.reason = (body.reason or "").strip() or None
    req.decided_by_id = current_user.id
    req.decided_at = datetime.datetime.utcnow()
    db.commit()
    return request_out(req, current_user.username)


@router.get("/requests/pending-count")
def pending_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """사이드바에 빨간 표시를 띄울지 정하는 값. 매니저가 아니면 항상 0입니다."""
    if not current_user.has_role("manager"):
        return {"count": 0}
    count = (
        db.query(models.EventRequest)
        .filter(models.EventRequest.status == "pending")
        .count()
    )
    return {"count": count}
