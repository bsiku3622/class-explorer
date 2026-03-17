"""인증 관련 API 엔드포인트"""
import datetime
import threading
import time
from collections import defaultdict
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import (
    hash_password,
    verify_password,
    generate_session_token,
    get_db,
    get_current_user,
    clear_user_sessions,
    SESSION_EXPIRE_DAYS,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# ─── 타이밍 공격 방지: 서버 시작 시 더미 해시 1회 생성 ─────────────────────────
# username이 없을 때도 bcrypt를 동일하게 실행해 응답 시간을 균등화
_DUMMY_HASH: str = hash_password("__dummy_constant_value_xK9mP2__")

# ─── Rate Limiter (로그인 브루트포스 방어) ────────────────────────────────────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_LOGIN_LIMIT = 10        # 최대 시도 횟수
_LOGIN_WINDOW = 60       # 초 단위 윈도우
_CLEANUP_INTERVAL = 300  # 5분마다 만료 IP 정리
_cleanup_lock = threading.Lock()
_last_cleanup: float = time.time()

def _maybe_cleanup() -> None:
    """만료된 IP 항목을 주기적으로 정리해 메모리 누수를 방지합니다."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    with _cleanup_lock:
        if now - _last_cleanup < _CLEANUP_INTERVAL:
            return
        cutoff = now - _LOGIN_WINDOW
        expired = [ip for ip, attempts in _login_attempts.items()
                   if not any(t > cutoff for t in attempts)]
        for ip in expired:
            del _login_attempts[ip]
        _last_cleanup = now

def _get_client_ip(request: Request) -> str:
    """리버스 프록시(nginx) 환경에서 실제 클라이언트 IP 추출.
    nginx에서 proxy_set_header X-Forwarded-For $remote_addr; 설정 필요."""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"

def _check_login_rate_limit(ip: str) -> None:
    _maybe_cleanup()
    now = time.time()
    cutoff = now - _LOGIN_WINDOW
    attempts = [t for t in _login_attempts[ip] if t > cutoff]
    _login_attempts[ip] = attempts
    if len(attempts) >= _LOGIN_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Please wait {_LOGIN_WINDOW} seconds.",
            headers={"Retry-After": str(_LOGIN_WINDOW)},
        )
    _login_attempts[ip].append(now)

def _reset_login_rate_limit(ip: str) -> None:
    _login_attempts.pop(ip, None)


# ─── 스키마 ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    device_type: Literal["web", "mobile"] = "web"


class SessionResponse(BaseModel):
    session_token: str
    token_type: str = "bearer"


# ─── 엔드포인트 ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=SessionResponse)
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    client_ip = _get_client_ip(request)
    _check_login_rate_limit(client_ip)

    user = db.query(models.User).filter(models.User.username == body.username).first()

    # 타이밍 공격 방지: username 존재 여부와 무관하게 항상 bcrypt 실행
    if user:
        password_valid = verify_password(body.password, user.hashed_password)
    else:
        verify_password(body.password, _DUMMY_HASH)  # 응답 시간 균등화
        password_valid = False

    if not password_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # 로그인 성공 시 rate limit 카운터 초기화
    _reset_login_rate_limit(client_ip)

    # 기존 세션 모두 삭제 (1계정 1세션)
    clear_user_sessions(db, user)

    token = generate_session_token()
    session = models.Session(
        user_id=user.id,
        session_token=token,
        device_type=body.device_type,
        ip_address=client_ip,
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
