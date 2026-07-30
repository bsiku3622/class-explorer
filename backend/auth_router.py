"""인증 관련 API 엔드포인트"""
import datetime
import os
import re
import threading
import time
from collections import defaultdict
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
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

# ─── 학교 구글 계정 ───────────────────────────────────────────────────────────
# 학번이 곧 이메일 아이디입니다: 25-059@ksa.hs.kr
SCHOOL_DOMAIN = "ksa.hs.kr"
_STUDENT_ID_PATTERN = re.compile(r"\d{2}-\d{3}")

# 없으면 구글 로그인이 꺼진 상태로 동작합니다 (503)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")


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


def _student_id_from_email(email: str) -> str | None:
    """
    `25-059@ksa.hs.kr` → `25-059`

    학교 계정은 학번이 그대로 아이디라 이메일만으로 누구인지 알 수 있습니다.
    교사 계정처럼 학번 형식이 아니면 None을 돌려주고, 호출하는 쪽이 거절합니다.
    """
    local, _, domain = email.partition("@")
    if domain.lower() != SCHOOL_DOMAIN:
        return None
    return local if _STUDENT_ID_PATTERN.fullmatch(local) else None


async def _verify_google_credential(credential: str) -> dict:
    """
    구글이 발급한 ID 토큰을 구글에게 되물어 확인합니다.

    서명을 직접 검증하려면 라이브러리가 하나 더 필요한데, 학번 확인은 계정마다 한 번뿐이라
    왕복 한 번이 더 낫다고 봤습니다. 대신 `aud`(우리 앱인지)와 이메일 인증 여부는 여기서
    반드시 확인합니다 — 확인을 빠뜨리면 남의 앱 토큰으로 남의 학번을 가져갈 수 있습니다.
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="학번 확인이 설정되지 않았습니다.",
        )

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential},
                timeout=10,
            )
    except (httpx.TimeoutException, httpx.TransportError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="구글에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
        )

    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인 정보를 확인하지 못했습니다."
        )

    claims = res.json()
    if claims.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인 정보를 확인하지 못했습니다."
        )
    if str(claims.get("email_verified", "")).lower() not in ("true", "1"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="확인되지 않은 계정입니다."
        )
    return claims


class LinkGoogleRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)


@router.post("/link-google")
async def link_google(
    body: LinkGoogleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    계정에 학교 구글 계정을 붙여 **학번을 확정합니다.**

    로그인은 아이디·비밀번호로만 하고, 구글은 여기서만 씁니다 — 아이디만으로는 이 계정이
    누구 것인지 알 방법이 없어서입니다. 학교 계정 이메일이 곧 학번이라(`25-059@ksa.hs.kr`)
    한 번 거치면 신원이 정해지고, 그때부터 이수 기록을 남길 수 있습니다.

    이미 학번이 정해진 계정이라면 구글 계정의 학번과 같아야 합니다 — 다르면 남의
    계정에 붙이려는 것이므로 막습니다.
    """
    claims = await _verify_google_credential(body.credential)
    email = (claims.get("email") or "").lower()
    stu_id = _student_id_from_email(email)
    if stu_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{SCHOOL_DOMAIN} 학생 계정으로만 연동할 수 있습니다.",
        )

    student = db.query(models.Student).filter(models.Student.stuId == stu_id).first()
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"명단에서 {stu_id} 학번을 찾지 못했습니다.",
        )

    taken = (
        db.query(models.User)
        .filter(models.User.email == email, models.User.id != current_user.id)
        .first()
    )
    if taken is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 다른 계정이 쓰고 있는 구글 계정입니다.",
        )

    if current_user.stu_id and current_user.stu_id != stu_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"이 계정은 {current_user.stu_id} 학번으로 등록되어 있습니다.",
        )

    current_user.email = email
    current_user.stu_id = stu_id
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="이미 쓰이고 있는 학번입니다."
        )

    return {"email": email, "stu_id": stu_id, "student_name": student.name}


@router.post("/logout")
def logout(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    clear_user_sessions(db, current_user)
    db.commit()
    return {"detail": "Logged out"}


@router.get("/me")
def me(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = (
        db.query(models.Student).filter(models.Student.stuId == current_user.stu_id).first()
        if current_user.stu_id
        else None
    )
    return {
        "id": current_user.id,
        "username": current_user.username,
        "is_admin": current_user.is_admin,
        "stu_id": current_user.stu_id,
        "student_name": student.name if student else None,
        "email": current_user.email,
    }


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
