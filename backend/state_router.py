"""
계정별 화면 상태 저장 — 작업 중인 계획이 기기가 아니라 계정에 붙습니다.

서버는 `data` 내용을 해석하지 않습니다. 화면마다 구조가 다르고 자주 바뀌기 때문에,
컬럼으로 펼치는 대신 JSON을 그대로 맡아 둡니다. 성적처럼 서버가 알아야 하는 값은
`/curriculum/grades`로 따로 다룹니다.
"""

import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user, get_db

router = APIRouter(prefix="/state", tags=["state"])

# 화면 이름 — 오타로 엉뚱한 키가 쌓이지 않게 미리 정해 둡니다.
# `zamong` 은 손으로 적는 비교과 시수(자기계발·협업·세계시민)입니다 — 어디서도
# 자동으로 알 수 없는 값이라 사람이 넣고, 서버가 검증할 것도 없습니다
ALLOWED_KEYS = {"plan", "trade", "zamong"}

# JSON 한 덩어리의 상한. 계획 데이터는 수 KB 수준이라 넉넉합니다
MAX_BYTES = 256 * 1024


class StateRequest(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


def _check_key(key: str) -> None:
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=404, detail="Unknown state key")


@router.get("/{key}")
def get_state(
    key: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _check_key(key)
    row = (
        db.query(models.UserState)
        .filter(models.UserState.user_id == user.id, models.UserState.key == key)
        .first()
    )
    return {
        "key": key,
        "data": row.data if row else None,
        "updated_at": row.updated_at.isoformat() if row else None,
    }


@router.put("/{key}")
def put_state(
    key: str,
    payload: StateRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _check_key(key)

    if len(json.dumps(payload.data).encode()) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="State too large")

    row = (
        db.query(models.UserState)
        .filter(models.UserState.user_id == user.id, models.UserState.key == key)
        .first()
    )
    if row:
        row.data = payload.data
    else:
        db.add(models.UserState(user_id=user.id, key=key, data=payload.data))
    db.commit()
    return {"key": key, "saved": True}


@router.delete("/{key}")
def delete_state(
    key: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    _check_key(key)
    db.query(models.UserState).filter(
        models.UserState.user_id == user.id, models.UserState.key == key
    ).delete()
    db.commit()
    return {"key": key, "deleted": True}
