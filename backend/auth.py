"""패스워드 해싱, 세션 토큰, 현재 사용자 의존성"""
import datetime
import secrets
from typing import Optional

import bcrypt as _bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from backend.database import SessionLocal
from backend import models

# ─── 설정 ───────────────────────────────────────────────────────────────────
SESSION_EXPIRE_DAYS = 30
MAX_SESSIONS_PER_USER = 1

bearer_scheme = HTTPBearer(auto_error=False)


# ─── 패스워드 ────────────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── 세션 토큰 ───────────────────────────────────────────────────────────────
def generate_session_token() -> str:
    return secrets.token_urlsafe(48)


# ─── DB 세션 의존성 ──────────────────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── 현재 사용자 의존성 ───────────────────────────────────────────────────────
def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session = (
        db.query(models.Session)
        .filter(models.Session.session_token == credentials.credentials)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")

    if datetime.datetime.utcnow() > session.expires_at:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    session.last_used_at = datetime.datetime.utcnow()
    db.commit()

    return session.user


# ─── 관리자 의존성 ───────────────────────────────────────────────────────────
def get_current_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ─── 세션 관리 ───────────────────────────────────────────────────────────────
def clear_user_sessions(db: Session, user: models.User):
    """해당 유저의 모든 세션 삭제 (1계정 1세션 강제)"""
    db.query(models.Session).filter(models.Session.user_id == user.id).delete()
    db.flush()
