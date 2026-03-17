"""관리자 전용 API 엔드포인트"""
import sys
import subprocess
import datetime
import logging
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_admin, get_db, hash_password

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

_USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_.\-]+$')

# ─── 스키마 ──────────────────────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=5, max_length=128)
    is_admin: bool = False


class SetAdminRequest(BaseModel):
    is_admin: bool


# ─── 사용자 관리 ──────────────────────────────────────────────────────────────
@router.get("/users")
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    users = db.query(models.User).order_by(models.User.id).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "is_admin": u.is_admin,
            "session_count": len(u.sessions),
        }
        for u in users
    ]


@router.post("/users", status_code=201)
def create_user(
    body: CreateUserRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    if not _USERNAME_PATTERN.match(body.username):
        raise HTTPException(status_code=422, detail="Username must contain only letters, numbers, _, ., or -")
    if db.query(models.User).filter(models.User.username == body.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = models.User(
        username=body.username,
        hashed_password=hash_password(body.password),
        is_admin=body.is_admin,
    )
    db.add(user)
    db.commit()
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}


@router.patch("/users/{user_id}/admin")
def set_admin(
    user_id: int,
    body: SetAdminRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_admin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = body.is_admin
    db.commit()
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_admin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"detail": "Deleted"}


# ─── 세션 관리 ───────────────────────────────────────────────────────────────
@router.get("/sessions")
def list_all_sessions(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    sessions = (
        db.query(models.Session)
        .order_by(models.Session.last_used_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "username": s.user.username,
            "device_type": s.device_type,
            "ip_address": s.ip_address,
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
    _: models.User = Depends(get_current_admin),
):
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(session)
    db.commit()
    return {"detail": "Revoked"}


# ─── 학생 관리 ───────────────────────────────────────────────────────────────
class UpdateStudentRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)


@router.get("/students")
def list_students(
    q: str = Query(default="", max_length=100),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """학생 목록 반환 (학번/이름 필터 가능)"""
    query = db.query(models.Student)
    if q:
        query = query.filter(
            models.Student.stuId.contains(q) | models.Student.name.contains(q)
        )
    students = query.order_by(models.Student.stuId).all()
    return [{"stuId": s.stuId, "name": s.name} for s in students]


@router.patch("/students/{stu_id}")
def update_student(
    stu_id: str,
    body: UpdateStudentRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    student = db.query(models.Student).filter(models.Student.stuId == stu_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.name = body.name.strip()
    db.commit()
    return {"stuId": student.stuId, "name": student.name}


# ─── 교사 관리 ───────────────────────────────────────────────────────────────
class RenameTeacherRequest(BaseModel):
    new_name: str = Field(min_length=1, max_length=64)


@router.get("/teachers")
def list_teachers(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """교사 목록 + 담당 분반 수 반환"""
    from sqlalchemy import func
    rows = (
        db.query(models.Class.teacher, func.count(models.Class.id).label("section_count"))
        .filter(models.Class.teacher != None, models.Class.teacher != "배정중")
        .group_by(models.Class.teacher)
        .order_by(models.Class.teacher)
        .all()
    )
    return [{"name": r.teacher, "section_count": r.section_count} for r in rows]


@router.patch("/teachers/{teacher_name}")
def rename_teacher(
    teacher_name: str,
    body: RenameTeacherRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """교사 이름을 전체 수업에 걸쳐 일괄 변경"""
    new_name = body.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="New name cannot be empty")
    updated = (
        db.query(models.Class)
        .filter(models.Class.teacher == teacher_name)
        .update({"teacher": new_name})
    )
    if updated == 0:
        raise HTTPException(status_code=404, detail="Teacher not found")
    db.commit()
    return {"old_name": teacher_name, "new_name": new_name, "updated_sections": updated}


# ─── 과목 별칭 관리 ──────────────────────────────────────────────────────────
class SetAliasesRequest(BaseModel):
    aliases: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(max_length=30)


@router.get("/subjects")
def list_subjects(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """DB에 존재하는 모든 과목 + 각 과목의 별칭 목록 반환"""
    from backend import models as m
    subjects = [row[0] for row in db.query(m.Class.subject).distinct().order_by(m.Class.subject).all()]
    all_aliases = db.query(m.SubjectAlias).all()
    alias_map: dict[str, list[str]] = {}
    for a in all_aliases:
        alias_map.setdefault(a.subject, []).append(a.alias)
    return [
        {"subject": s, "aliases": sorted(alias_map.get(s, []))}
        for s in subjects
    ]


@router.put("/subjects/{subject}/aliases", status_code=200)
def set_subject_aliases(
    subject: str,
    body: SetAliasesRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """특정 과목의 별칭을 전체 교체 (빈 리스트로 전달 시 모두 삭제)"""
    from backend import models as m
    db.query(m.SubjectAlias).filter(m.SubjectAlias.subject == subject).delete()
    seen = set()
    for alias in body.aliases:
        alias = alias.strip()
        if alias and alias not in seen:
            seen.add(alias)
            db.add(m.SubjectAlias(subject=subject, alias=alias))
    db.commit()
    return {"subject": subject, "aliases": sorted(seen)}


# ─── 데이터 동기화 ───────────────────────────────────────────────────────────
@router.post("/sync")
def sync_data(_: models.User = Depends(get_current_admin)):
    """KSAIN API에서 수업 데이터 재수집"""
    try:
        result = subprocess.run(
            [sys.executable, "-m", "backend.parser_run"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            # 내부 에러 상세정보는 서버 로그에만 기록, 클라이언트에 노출 금지
            logger.error("Sync failed (exit %d): %s", result.returncode, result.stderr)
            raise HTTPException(status_code=500, detail="Sync failed. Check server logs.")
        # SYNC_RESULT 줄 파싱
        stats = {"synced": 0, "skipped": 0, "errors": 0, "elapsed": ""}
        for line in result.stdout.splitlines():
            if line.startswith("SYNC_RESULT"):
                for token in line.split():
                    if "=" in token:
                        k, v = token.split("=", 1)
                        if k in stats:
                            stats[k] = v if k == "elapsed" else int(v)
        return {"detail": "Sync complete", "stats": stats}
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Sync timed out (300s)")
