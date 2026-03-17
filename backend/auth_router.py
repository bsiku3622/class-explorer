"""인증 관련 API 엔드포인트"""
import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend import models
from backend.auth import (
    verify_password,
    generate_session_token,
    get_db,
    get_current_user,
    clear_user_sessions,
    SESSION_EXPIRE_DAYS,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── 스키마 ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str
    device_type: str = "web"  # "web" | "mobile"


class SessionResponse(BaseModel):
    session_token: str
    token_type: str = "bearer"


# ─── 엔드포인트 ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=SessionResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == body.username).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # 기존 세션 모두 삭제 (1계정 1세션)
    clear_user_sessions(db, user)

    token = generate_session_token()
    session = models.Session(
        user_id=user.id,
        session_token=token,
        device_type=body.device_type,
        ip_address=request.client.host if request.client else None,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=SESSION_EXPIRE_DAYS),
    )
    db.add(session)
    db.commit()

    return SessionResponse(session_token=token)


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    clear_user_sessions(db, current_user)
    db.commit()
    return {"detail": "Logged out"}


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username, "is_admin": current_user.is_admin}


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == current_user.id)
        .order_by(models.Session.last_used_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "device_type": s.device_type,
            "created_at": s.created_at.isoformat(),
            "last_used_at": s.last_used_at.isoformat(),
            "expires_at": s.expires_at.isoformat(),
        }
        for s in sessions
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = (
        db.query(models.Session)
        .filter(
            models.Session.id == session_id,
            models.Session.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"detail": "Session revoked"}
