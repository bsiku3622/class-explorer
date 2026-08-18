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

#: 한 계정이 동시에 들고 있을 수 있는 기기 수.
#:
#: 한동안 **1** 이었습니다 — 새로 로그인하면 기존 세션을 통째로 지웠습니다. 계정을
#: 관리자가 발급하는 서비스라 **계정 공유를 막으려는** 장치였는데, 폰과 노트북을 같이
#: 쓰는 게 정상인 이상 본인이 계속 튕겨 나가는 쪽이 훨씬 잦았습니다.
#:
#: 상한을 두면 공유는 여전히 막힙니다 — 반 전체가 한 계정을 쓰면 서로를 밀어내서
#: 아무도 못 씁니다. 폰 + 노트북 + 학교 PC + 태블릿에 여유 하나를 더한 값입니다.
MAX_SESSIONS_PER_USER = 5

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
def get_current_session(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.Session:
    """
    이번 요청이 타고 들어온 **세션 행**.

    대부분의 화면은 `get_current_user` 로 충분하지만, **로그아웃은 어느 기기인지를
    알아야 합니다** — 예전엔 그걸 몰라서 계정의 세션을 전부 지웠고, 폰에서 로그아웃하면
    책상 위 노트북까지 같이 튕겼습니다.
    """
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session = (
        db.query(models.Session)
        .filter(models.Session.session_token == credentials.credentials)
        .first()
    )
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")

    now = datetime.datetime.utcnow()
    if now > session.expires_at:
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    session.last_used_at = now

    # ── 슬라이딩 만료 ────────────────────────────────────────────────────────
    #
    # 쓰고 있으면 창을 다시 채웁니다. 고정 30일이면 **매달 한 번씩 전원이 영문 모르고
    # 로그아웃**되는데, 특히 폰 위젯처럼 배경에서 도는 물건은 어느 날 조용히 빈 채로
    # 남고 사용자는 이유를 알 수 없습니다.
    #
    # 절반이 지났을 때만 손대는 이유는 쓰기를 줄이려는 것입니다 — 매 요청마다 값을
    # 바꾸면 SQLite 에 의미 없는 쓰기가 계속 쌓입니다.
    #
    # ⚠️ 뒤집어 말하면 **탈취당한 토큰도 계속 살아 있습니다.** 그 대가로 세션 목록과
    # 폐기 버튼(`GET`/`DELETE /auth/sessions`)을 화면에 내놨습니다.
    window = datetime.timedelta(days=SESSION_EXPIRE_DAYS)
    if session.expires_at - now < window / 2:
        session.expires_at = now + window

    db.commit()
    return session


def get_current_user(
    session: models.Session = Depends(get_current_session),
) -> models.User:
    return session.user


# ─── 권한 의존성 ─────────────────────────────────────────────────────────────
#
# 위계라서 admin 은 manager 검사도 통과합니다 (models.User.has_role).
def get_current_admin(current_user: models.User = Depends(get_current_user)) -> models.User:
    if not current_user.has_role("admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


def get_current_manager(current_user: models.User = Depends(get_current_user)) -> models.User:
    """학사일정을 직접 고칠 수 있는 사람 — 매니저와 관리자."""
    if not current_user.has_role("manager"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager access required")
    return current_user


# ─── 세션 관리 ───────────────────────────────────────────────────────────────
def clear_user_sessions(db: Session, user: models.User, keep_token: Optional[str] = None) -> int:
    """
    해당 유저의 세션을 지웁니다. `keep_token` 을 주면 **그 하나만 남깁니다.**

    이제 로그인·로그아웃이 부르지 않습니다 — 쓰이는 곳은 "다른 기기 모두
    로그아웃"(`keep_token` 있음)과 관리자의 강제 로그아웃(없음)뿐입니다.
    """
    query = db.query(models.Session).filter(models.Session.user_id == user.id)
    if keep_token is not None:
        query = query.filter(models.Session.session_token != keep_token)
    removed = query.delete(synchronize_session=False)
    db.flush()
    return removed


def prune_user_sessions(db: Session, user: models.User, keep: int) -> int:
    """
    기기 상한을 지킵니다 — **가장 오래 안 쓴 세션부터 밀어냅니다.**

    ⚠️ **새 로그인을 거절하지 않습니다.** 거절하는 쪽이 상한을 지키는 더 곧은 방법
    같지만, 그러면 폰을 잃어버렸거나 브라우저를 갈아엎은 사람이 **영영 못 들어옵니다**
    — 자기 세션을 지우려면 로그인부터 해야 하니까요. 밀어내면 최소한 지금 손에 있는
    기기로는 들어오고, 밀려난 기기는 다시 로그인하면 됩니다.
    """
    doomed = (
        db.query(models.Session)
        .filter(models.Session.user_id == user.id)
        .order_by(models.Session.last_used_at.desc())
        .offset(keep)
        .all()
    )
    for session in doomed:
        db.delete(session)
    db.flush()
    return len(doomed)
