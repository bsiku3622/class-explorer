"""강의계획서 — 로그인한 사람에게만 줍니다 (`services/syllabi.py`).

| 경로 | 하는 일 |
| --- | --- |
| `GET /syllabi` | 파일 목록 `[{id, path, format}]` — 화면이 경로로 과목을 짝짓습니다 |
| `GET /syllabi/{id}` | 파일 하나. 목록에 있는 id 만 내줍니다 |

둘 다 `Cache-Control: private, no-store` 입니다. 교사 연락처가 든 파일이고, 목록의 파일 이름에도 교사 이름이
들어 있습니다.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import FileResponse

from backend import models
from backend.core.auth import get_current_user
from backend.services import syllabi

router = APIRouter(prefix="/syllabi", tags=["syllabi"])

NO_STORE = "private, no-store"


@router.get("")
def list_syllabi(
    response: Response,
    _: models.User = Depends(get_current_user),
):
    response.headers["Cache-Control"] = NO_STORE
    return syllabi.listing()


@router.get("/{file_id}")
def get_syllabus(
    file_id: str,
    _: models.User = Depends(get_current_user),
):
    path = syllabi.find(file_id)
    if path is None or not path.is_file():
        raise HTTPException(status_code=404, detail="강의계획서가 없습니다")
    return FileResponse(path, media_type=syllabi.MEDIA_TYPES[path.suffix.lower()],
                        headers={"Cache-Control": NO_STORE})
