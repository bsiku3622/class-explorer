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
    get_current_session,
    get_current_user,
    clear_user_sessions,
    prune_user_sessions,
    MAX_SESSIONS_PER_USER,
    SESSION_EXPIRE_DAYS,
)
from backend.versioning import version_map

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


# ─── 기기 이름 ────────────────────────────────────────────────────────────────
#
# ⚠️ **순서가 곧 규칙입니다.** User-Agent 는 서로를 베껴 쓰기 때문에 앞에서부터 끊어야
# 맞습니다 — Edge 는 `Chrome/` 을 달고 다니고, Chrome 은 `Safari/` 를 달고 다니며,
# 안드로이드는 `Linux` 를 달고 다닙니다. 뒤에서부터 찾으면 전부 Safari · Linux 가 됩니다.
_BROWSERS = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Whale/", "Whale"),
    ("SamsungBrowser/", "Samsung Internet"),
    ("Chrome/", "Chrome"),
    ("Firefox/", "Firefox"),
    ("Safari/", "Safari"),
]
_PLATFORMS = [
    ("Android", "Android"),
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Macintosh", "Mac"),
    ("Windows", "Windows"),
    ("Linux", "Linux"),
]


def _device_label(user_agent: str | None) -> str | None:
    """
    `"Chrome · Android"` 처럼 **사람이 자기 기기를 알아볼 만큼만** 만듭니다.

    세션 목록에 이게 없으면 `mobile` 세 줄이 나란히 뜨고, 어느 게 잃어버린 폰인지
    구별할 수 없어 폐기 버튼이 무용지물이 됩니다.

    ⚠️ **클라이언트가 보낸 이름을 그대로 쓰지 않습니다.** 본인에게만 보이는 값이라
    위험이 크진 않지만, 굳이 남이 정한 문자열을 화면에 그릴 이유가 없습니다. 폰 앱은
    자기 User-Agent 를 알아보게 붙이면 여기 그대로 잡힙니다.
    """
    if not user_agent:
        return None
    browser = next((name for token, name in _BROWSERS if token in user_agent), None)
    platform = next((name for token, name in _PLATFORMS if token in user_agent), None)
    label = " · ".join(part for part in (browser, platform) if part)
    return label or None


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

    # 상한을 지키되 **밀어내는** 방식입니다 — 새로 들어올 자리 하나를 비웁니다.
    # 예전에는 여기서 기존 세션을 통째로 지웠고(1계정 1세션), 그래서 폰에서 로그인하면
    # 노트북이 튕겼습니다
    prune_user_sessions(db, user, keep=MAX_SESSIONS_PER_USER - 1)

    token = generate_session_token()
    session = models.Session(
        user_id=user.id,
        session_token=token,
        device_type=body.device_type,
        device_label=_device_label(request.headers.get("User-Agent")),
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


async def _verify_google_credential(credential: str, nonce: str | None = None) -> dict:
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
    # 리다이렉트 방식으로 오면 화면이 넘어가기 전에 심어 둔 값이 토큰 안에 들어 있습니다.
    # 이 흐름에서 방금 발급된 토큰인지 보는 것이라, **주면 반드시 확인합니다.**
    #
    # 없어도 통과시키는 이유는 배포가 프론트·백엔드 따로여서입니다 — 옛 화면을 띄워 둔
    # 브라우저는 `nonce` 를 못 보냅니다. 두 쪽 다 새 판이 되면 필수로 올리세요.
    if nonce and claims.get("nonce") != nonce:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="만료된 요청입니다."
        )
    return claims


class LinkGoogleRequest(BaseModel):
    credential: str = Field(min_length=1, max_length=4096)
    # 화면이 구글로 넘어가기 전에 심어 둔 일회용 값. 옛 화면은 안 보냅니다
    nonce: str | None = Field(default=None, max_length=128)


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
    claims = await _verify_google_credential(body.credential, body.nonce)
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
    session: models.Session = Depends(get_current_session),
):
    """
    **이 기기만** 로그아웃합니다.

    한동안 계정의 세션을 전부 지웠습니다(1계정 1세션의 잔재). 폰에서 로그아웃했을 뿐인데
    책상 위 노트북까지 같이 튕기는 건 아무도 기대하지 않는 동작입니다 — 전부 끊고
    싶으면 아래 `/logout-all` 입니다.
    """
    db.delete(session)
    db.commit()
    return {"detail": "Logged out"}


@router.post("/logout-all")
def logout_all(
    db: Session = Depends(get_db),
    session: models.Session = Depends(get_current_session),
):
    """
    **다른 기기를 전부** 로그아웃합니다 — 지금 이 기기는 남깁니다.

    비밀번호가 샜다고 느낄 때 쓰는 버튼이라, 누른 사람까지 튕겨 내면 곧바로 다시
    로그인해야 해서 오히려 불안합니다.
    """
    removed = clear_user_sessions(db, session.user, keep_token=session.session_token)
    db.commit()
    return {"detail": "Logged out", "revoked": removed}


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
        "role": current_user.role,
        "stu_id": current_user.stu_id,
        "student_name": student.name if student else None,
        "email": current_user.email,
        # 학기별 데이터 회차. 프론트가 자기 캐시와 대 봐서 다르면 버립니다.
        #
        # 여기 얹은 이유는 이 응답이 **앱을 열 때마다 캐시 없이 한 번은 나가는 유일한
        # 요청**이기 때문입니다. 학기 데이터가 캐시에 맞으면 서버로 아무것도 안 나가서,
        # 따로 물어볼 자리를 만들면 요청이 하나 더 늘어납니다.
        "data_versions": version_map(db),
    }


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    session: models.Session = Depends(get_current_session),
):
    """
    로그인해 둔 기기 목록.

    ⚠️ **`current` 가 없으면 목록이 위험해집니다** — 어느 줄이 지금 보고 있는 기기인지
    모르면 자기 자신을 폐기하고 화면 밖으로 나가떨어집니다. `ip_address` 는 일부러
    빼 뒀습니다(본인 것이라도 굳이 화면에 뿌릴 값이 아니고, 관리자 화면에는 있습니다).
    """
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == session.user_id)
        .order_by(models.Session.last_used_at.desc())
        .all()
    )
    return {
        "max": MAX_SESSIONS_PER_USER,
        "sessions": [
            {
                "id": s.id,
                "device_type": s.device_type,
                "device_label": s.device_label,
                "current": s.id == session.id,
                "created_at": s.created_at.isoformat(),
                "last_used_at": s.last_used_at.isoformat(),
                "expires_at": s.expires_at.isoformat(),
            }
            for s in sessions
        ],
    }


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
