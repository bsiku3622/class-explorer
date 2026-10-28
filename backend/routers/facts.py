"""기억 관리 (`/facts/*`) — Admin 의 기억 패널. **매니저 이상**만 씁니다.

기억은 ksain 글에서 분석기가 뽑은 사실입니다(`knowledge/facts.py`). 여기서는 사람이 **고치거나
숨기기만** 합니다 — 손으로 새 사실을 지어 넣는 길은 두지 않습니다. 기억은 글에 묶인 요약 DB 라서,
글 없는 사실은 출처를 댈 수 없습니다.

| 경로 | 하는 일 |
| --- | --- |
| `GET /facts?q=&status=&page=` | 글 단위로 묶은 사실 목록 (새 글부터) + 글 요약 |
| `PATCH /facts/{id}` | 문장·주제·유효 기간 고치기(`edited`), 숨기기·되살리기(`status`) |

고친 사실과 숨긴 사실은 글을 다시 분석해도 그대로 둡니다.
"""
from __future__ import annotations

import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from backend import models
from backend.core.auth import get_current_manager
from backend.core.db import KsainSession, db_session, get_db
from backend.knowledge import facts as memory

router = APIRouter(prefix="/facts", tags=["facts"])


class FactPatch(BaseModel):
    statement: str | None = Field(default=None, min_length=5, max_length=300)
    topic: str | None = Field(default=None, max_length=60)
    # 빈 문자열이면 "계속 유효"(기한 없음), 칸이 없으면 그대로 둡니다
    valid_until: datetime.date | Literal[""] | None = None
    status: Literal["active", "hidden"] | None = None


def _summaries(post_ids: list[int]) -> dict[int, str | None]:
    """글 요약(ksain.db) — 패널이 사실 옆에 글이 무슨 내용이었는지 보입니다. 못 읽으면 비웁니다."""
    if not post_ids:
        return {}
    from backend.ksain.models import Analysis

    try:
        with db_session(KsainSession) as kdb:
            rows = kdb.query(Analysis.post_id, Analysis.summary).filter(Analysis.post_id.in_(post_ids)).all()
    except OperationalError:
        return {}
    return dict(rows)


@router.get("")
def list_facts(
    q: str | None = Query(default=None, max_length=100),
    status: Literal["active", "hidden", "edited"] | None = None,
    page: int = Query(default=1, ge=1, le=1000),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_manager),
):
    out = memory.listing(db, q=q, status=status, page=page)
    summaries = _summaries([post["post_id"] for post in out["posts"]])
    for post in out["posts"]:
        post["summary"] = summaries.get(post["post_id"])
    return out


@router.patch("/{fact_id}")
def update_fact(
    fact_id: int,
    body: FactPatch,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_manager),
):
    fact = db.get(models.Fact, fact_id)
    if fact is None:
        raise HTTPException(status_code=404, detail="사실을 찾지 못했습니다")
    fields = body.model_fields_set
    valid_until = "keep"
    if "valid_until" in fields:
        valid_until = body.valid_until or None
    memory.edit(db, fact, user, statement=body.statement, topic=body.topic, valid_until=valid_until,
                status=body.status)
    return memory.fact_out(fact)
