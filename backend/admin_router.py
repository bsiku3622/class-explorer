"""관리자 전용 API 엔드포인트"""
import sys
import subprocess
import datetime
import logging
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_admin, get_db, hash_password
from backend.terms import list_terms, resolve_term

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

_USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_.\-]+$')

# ─── 스키마 ──────────────────────────────────────────────────────────────────
class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=5, max_length=128)
    role: Literal["user", "manager", "admin"] = "user"


class SetRoleRequest(BaseModel):
    role: Literal["user", "manager", "admin"]


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
            "role": u.role,
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
        role=body.role,
    )
    db.add(user)
    db.commit()
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/users/{user_id}/role")
def set_role(
    user_id: int,
    body: SetRoleRequest,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_admin),
):
    if user_id == current.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    return {"id": user.id, "username": user.username, "role": user.role}


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
            "device_label": s.device_label,
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
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """교사 목록 + 담당 분반 수 반환 (학기 미지정 시 최신 학기 기준)"""
    from sqlalchemy import func
    target_year, target_semester = resolve_term(db, year, semester)
    rows = (
        db.query(models.Class.teacher, func.count(models.Class.id).label("section_count"))
        .filter(
            models.Class.teacher != None,
            models.Class.teacher != "배정중",
            models.Class.year == target_year,
            models.Class.semester == target_semester,
        )
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


# ─── 과목 ────────────────────────────────────────────────────────────────────
@router.get("/subjects")
def list_subjects(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """
    해당 학기에 열린 과목 목록. 교육과정에 이어지지 않은 과목을 찾는 데 씁니다.

    `course`가 비어 있으면 학점·계열을 알 수 없는 과목입니다 — 외국인 전형 과목이나
    개편 전 이름이 여기 해당합니다.
    """
    from backend import models as m
    target_year, target_semester = resolve_term(db, year, semester)
    rows = (
        db.query(m.Subject.name, m.Subject.is_ec, m.Subject.name_english, m.Course.name)
        .join(m.Class, m.Class.subject_id == m.Subject.id)
        .outerjoin(m.Course, m.Course.id == m.Subject.course_id)
        .filter(m.Class.year == target_year, m.Class.semester == target_semester)
        .distinct()
        .order_by(m.Subject.name, m.Subject.is_ec)
        .all()
    )
    return [
        {
            "subject": f"{name}(EC)" if is_ec else name,
            "is_ec": is_ec,
            "english": english,
            "course": course,
        }
        for name, is_ec, english, course in rows
    ]


# ─── 학기 목록 ───────────────────────────────────────────────────────────────
@router.get("/terms")
def get_terms(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """데이터가 존재하는 학기 목록 (최신순)"""
    return {"terms": list_terms(db)}


# ─── 데이터 동기화 ───────────────────────────────────────────────────────────
class SyncRequest(BaseModel):
    year: int | None = Field(default=None, ge=2000, le=2100)
    semester: int | None = Field(default=None, ge=1, le=2)


@router.post("/sync")
def sync_data(
    body: SyncRequest | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    """
    KEIS API에서 수업 데이터 재수집.
    학기 미지정 시 데이터가 있는 최신 학기 — 화면 기본 조회 학기와 일치시킵니다.
    """
    year = body.year if body else None
    semester = body.semester if body else None
    target_year, target_semester = resolve_term(db, year, semester)

    cmd = [
        sys.executable, "-m", "backend.parser_run",
        "--year", str(target_year),
        "--semester", str(target_semester),
    ]

    try:
        result = subprocess.run(
            cmd,
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
        return {
            "detail": "Sync complete",
            "term": {"year": target_year, "semester": target_semester},
            "stats": stats,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Sync timed out (300s)")
