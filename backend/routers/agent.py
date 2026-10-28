"""Ask (질문창) — "오늘 형3404 빈 교시 뭐 있어?" 를 도구를 부르는 LLM Agent 가 답합니다.

| 경로 | 하는 일 |
| --- | --- |
| `POST /agent/chat` | 질문 하나 → 기억·도구를 거쳐 답. **SSE** 로 단계(`tool`)와 답(`answer`)을 흘립니다 |
| `GET /agent/models` | 고를 수 있는 모델 + 기본값 + 데스크탑 게이트웨이 상태 |
| `POST /agent/warmup` | 로컬 모델을 미리 깨웁니다. 질문창에 포커스가 가면 화면이 부릅니다 |
| `GET /agent/status` | 수집·분석·색인·기억이 돌고 있는지 (admin) |

질문을 답으로 바꾸는 일은 `agent/chat.py` 가 합니다. 모델은 SQL 을 만들지 않고 `agent/tools.py`
의 읽기 전용 도구만 부릅니다 — 도구는 화면에서 볼 수 있는 범위만 돌려주므로 모델이 무엇을
시도해도 그 밖으로 나가지 않습니다. ksain 글은 아무 학생이나 쓸 수 있는 텍스트라 시스템
프롬프트에서 **자료로만** 다루게 합니다.
"""
from __future__ import annotations

import asyncio
import re

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.exc import OperationalError

from backend import models
from backend.agent import chat as agent_chat
from backend.agent import llm
from backend.agent.tools import profile_of
from backend.core.auth import get_current_admin, get_current_user
from backend.core.db import KsainSession, SessionLocal, db_session
from backend.services import syllabi

router = APIRouter(prefix="/agent", tags=["agent"])


class Turn(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(max_length=4000)


MAX_IMAGE_CHARS = 4_000_000  # data URL 한 장 — 화면이 1600px JPEG 로 줄여 보내서 보통 수백 KB 입니다


class ChatBody(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[Turn] = Field(default_factory=list, max_length=12)
    model: str | None = Field(default=None, max_length=100)
    # 첨부 이미지 (data URL). 서버에 저장하지 않고 이 질문의 모델 호출에만 실어 보냅니다
    images: list[str] = Field(default_factory=list, max_length=3)

    @field_validator("images")
    @classmethod
    def _images(cls, value: list[str]) -> list[str]:
        for image in value:
            if not re.match(r"^data:image/(png|jpeg|webp|gif);base64,", image) or len(image) > MAX_IMAGE_CHARS:
                raise ValueError("이미지는 png·jpeg·webp·gif data URL 로, 한 장에 4MB 이하여야 합니다")
        return value


class WarmupBody(BaseModel):
    model: str | None = Field(default=None, max_length=100)


@router.post("/chat")
async def chat(body: ChatBody, user: models.User = Depends(get_current_user)):
    model = llm.resolve(body.model, "agent")
    agent_chat.check_limit(user, model)
    history = [{"role": t.role, "content": t.content} for t in body.history]
    return StreamingResponse(
        agent_chat.run(user.id, body.message, history, body.images, model), media_type="text/event-stream",
        # nginx 가 SSE 를 모아 두지 않게 합니다
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/models")
async def list_models(user: models.User = Depends(get_current_user)):
    default = llm.resolve(None, "agent")
    with db_session() as db:
        # 화면 인사("재원님, …")에 쓰는 이름 — Agent 가 답할 때 쓰는 것과 같은 계산입니다
        me = profile_of(db, user.effective_stu_id, user.major)
    return {
        "models": [{"id": m.id, "name": m.name, "label": m.label, "provider": m.provider} for m in llm.available()],
        "default": default.id,
        "gateway": await llm.gateway_status(),
        "me": me,
    }


@router.get("/status")
async def status(_: models.User = Depends(get_current_admin)):
    """수집·분석이 돌고 있는지 한눈에 — 마지막 수집, 글·분석 수, 검색 색인, 자동 일정·기억 수, 게이트웨이."""
    from backend.ksain.models import Analysis, Post, State

    with db_session(KsainSession) as kdb, db_session(SessionLocal) as db:
        try:
            sync = kdb.get(State, "sync")
            index = kdb.get(State, "search_index")
            posts = kdb.query(func.count(Post.id)).scalar()
            analyzed = (kdb.query(func.count(Analysis.post_id)).join(Post)
                        .filter(Analysis.content_hash == Post.content_hash).scalar())
        except OperationalError:
            # 수집 타이머가 아직 한 번도 안 돈 서버 — ksain.db 가 비었거나 표가 없습니다
            sync = index = None
            posts = analyzed = 0
        events = db.query(func.count(models.CalendarEvent.id)).filter(models.CalendarEvent.source == "ksain").scalar()
        facts = dict(db.query(models.Fact.status, func.count(models.Fact.id)).group_by(models.Fact.status).all())
    return {"sync": sync.value if sync else None, "index": index.value if index else None,
            "posts": posts, "analyzed": analyzed, "auto_events": events,
            "facts": {"active": facts.get("active", 0), "hidden": facts.get("hidden", 0)},
            "gateway": await llm.gateway_status()}


@router.post("/warmup", status_code=202)
async def warmup(body: WarmupBody, _: models.User = Depends(get_current_user)):
    model = llm.resolve(body.model, "agent")
    asyncio.create_task(llm.warmup(model))
    # 강의계획서 목록도 미리 만듭니다 — 처음엔 PDF 첫 쪽을 다 읽어 몇 초 걸립니다(services/syllabi.py)
    asyncio.create_task(asyncio.to_thread(syllabi.catalog))
    return {"model": model.id}
