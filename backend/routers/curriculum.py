"""교육과정 API — 과목 카탈로그, 선수관계, 졸업 요건"""

import zipfile
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.core.auth import get_current_user
from backend.core.db import get_db
from backend.services.curriculum import (
    GRADE_POINTS,
    GRADUATION,
    REQUIREMENTS,
    TERM_KEYS,
    TERM_SLOTS,
    fetch_progress,
    require_linked,
)
from backend.services.timetable import subject_label
from backend.services.zamong_import import parse_workbook

# 워크북은 원본이 700KB 쯤입니다. 넉넉히 잡되, 아무 파일이나 통째로 메모리에 올리는
# 일은 막습니다
MAX_WORKBOOK_BYTES = 8 * 1024 * 1024

# 본인 것만 다루거나 개인 정보가 없는 엔드포인트 — 두 앱이 같이 씁니다
router = APIRouter(prefix="/curriculum", tags=["curriculum"])

# 학번만 알면 남의 이수 이력을 통째로 볼 수 있는 엔드포인트 — **class-explorer 전용**입니다.
# ksa-bench 는 `routers/bench.py` 의 `GET /me/progress` 로 본인 것만 봅니다.
explorer_router = APIRouter(prefix="/curriculum", tags=["curriculum"])

def _course_summary(course: models.Course, has_ec: bool = False) -> dict:
    """목록용 — 긴 설명 본문(`description_sections`)은 뺍니다."""
    return {
        "name": course.name,
        "english_name": course.name_english,
        "department": course.department.name,
        "category": course.department.category,
        "credits": course.credits,
        "ap_credits": course.ap_credits,
        "is_pf": course.is_pf,
        "recommended_semester": course.recommended_semester,
        "tier": course.tier,
        "required_advanced": course.required_advanced,
        # 영어강의로도 열리는 과목인지. 화면이 EC 선택을 내밀지 정하는 값이라,
        # 개설 이력이 없는 과목에는 아예 묻지 않습니다
        "has_ec": has_ec,
        "description": course.description,
    }


@router.get("")
def get_curriculum(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """
    카탈로그 전체와 선수관계 그래프를 한 번에 돌려줍니다. 학기와 무관한 데이터라
    프론트에서 오래 캐시해도 됩니다.

    `subject_map`은 화면에 보이는 개설 과목명을 교육과정 과목으로 옮기는 표입니다.
    이게 있어야 프론트가 이미 들고 있는 수강 데이터를 교육과정에 붙일 수 있습니다.
    영어강의는 이름 뒤에 (EC)가 붙어 한국어강의와 구분됩니다.
    """
    courses = (
        db.query(models.Course)
        .join(models.Department)
        .order_by(models.Department.display_order, models.Course.name)
        .all()
    )
    prerequisites = db.query(models.CoursePrereq).all()
    departments = (
        db.query(models.Department).order_by(models.Department.display_order).all()
    )

    course_name = {course.id: course.name for course in courses}
    openings = db.query(models.Subject).filter(models.Subject.course_id.isnot(None)).all()
    subject_map = {
        (subject_label(subject.name, subject.is_ec)): course_name[subject.course_id]
        for subject in openings
        if subject.course_id in course_name
    }
    ec_courses = {subject.course_id for subject in openings if subject.is_ec}

    return {
        "departments": [
            {
                "name": d.name,
                "category": d.category,
                "track": d.track,
                "notes": d.notes or [],
            }
            for d in departments
        ],
        "courses": [
            _course_summary(course, has_ec=course.id in ec_courses) for course in courses
        ],
        "prerequisites": [
            {
                "before": course_name[edge.before_id],
                "after": course_name[edge.after_id],
                "alternative": edge.alternative,
            }
            for edge in prerequisites
            if edge.before_id in course_name and edge.after_id in course_name
        ],
        "subject_map": subject_map,
        "requirements": REQUIREMENTS,
        "graduation": GRADUATION,
        "terms": TERM_SLOTS,
        "grade_points": GRADE_POINTS,
    }


@explorer_router.get("/progress/{stu_id}")
def get_progress(
    stu_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """아무 학생의 누적 이수 현황. **class-explorer 전용**입니다."""
    return fetch_progress(db, stu_id)


class GradeEntry(BaseModel):
    course: str = Field(min_length=1, max_length=160)
    grade: str | None = Field(default=None, max_length=4)
    term: str | None = Field(default=None, max_length=2)
    is_ec: bool = False


class GradesRequest(BaseModel):
    entries: list[GradeEntry] = Field(default_factory=list, max_length=400)


@router.get("/grades")
def get_grades(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """로그인한 계정 본인의 이수·성적"""
    stu_id = require_linked(user)
    rows = (
        db.query(
            models.Course.name,
            models.CourseGrade.grade,
            models.CourseGrade.term,
            models.CourseGrade.is_ec,
        )
        .join(models.CourseGrade, models.CourseGrade.course_id == models.Course.id)
        .filter(models.CourseGrade.user_id == user.id)
        .order_by(models.Course.name)
        .all()
    )
    return {
        "stu_id": stu_id,
        "entries": [
            {"course": name, "grade": grade, "term": term, "is_ec": bool(is_ec)}
            for name, grade, term, is_ec in rows
        ],
    }


@router.put("/grades")
def put_grades(
    payload: GradesRequest,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    본인 기록을 통째로 바꿉니다.

    항목이 145개를 넘지 않아 부분 갱신보다 전체 교체가 단순하고, 여러 기기에서
    편집해도 마지막 저장이 이깁니다.
    """
    stu_id = require_linked(user)
    known = {name: cid for name, cid in db.query(models.Course.name, models.Course.id).all()}
    unknown = sorted({entry.course for entry in payload.entries} - set(known))
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"교육과정에 없는 과목: {', '.join(unknown[:5])}",
        )

    bad_grades = sorted(
        {entry.grade for entry in payload.entries if entry.grade}
        - set(GRADE_POINTS)
    )
    if bad_grades:
        raise HTTPException(
            status_code=400, detail=f"알 수 없는 평어: {', '.join(bad_grades[:5])}"
        )

    bad_terms = sorted({entry.term for entry in payload.entries if entry.term} - TERM_KEYS)
    if bad_terms:
        raise HTTPException(
            status_code=400, detail=f"알 수 없는 학기: {', '.join(bad_terms[:5])}"
        )

    db.query(models.CourseGrade).filter(models.CourseGrade.user_id == user.id).delete()

    # 같은 과목이 두 번 오면 뒤엣것을 씁니다 — UNIQUE 위반을 막습니다
    deduped = {entry.course: entry for entry in payload.entries}
    for course, entry in deduped.items():
        db.add(
            models.CourseGrade(
                user_id=user.id,
                course_id=known[course],
                grade=entry.grade,
                term=entry.term,
                is_ec=entry.is_ec,
            )
        )
    db.commit()
    return {"stu_id": stu_id, "saved": len(deduped)}


@router.post("/import-workbook")
async def import_workbook(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    사람이 채운 Zamong 워크북(xlsx)을 읽어 **본인 기록을 통째로 갈아끼웁니다.**

    합치지 않고 교체하는 이유는, 워크북이 그 사람의 자몽 전체이기 때문입니다 — 일부만
    덮으면 앱에서 지운 과목이 되살아나고 어느 쪽이 최신인지 알 수 없게 됩니다.

    학기가 없는 카드는 안 들은 것으로 봅니다 (`zamong_import` 참고).
    """
    stu_id = require_linked(user)

    raw = await file.read()
    if len(raw) > MAX_WORKBOOK_BYTES:
        raise HTTPException(status_code=413, detail="파일이 너무 큽니다 (최대 8MB)")

    known = {name: cid for name, cid in db.query(models.Course.name, models.Course.id).all()}
    try:
        result = parse_workbook(raw, set(known), TERM_KEYS, set(GRADE_POINTS))
    except (zipfile.BadZipFile, KeyError, ET.ParseError):
        # xlsx 가 아니거나 우리가 아는 구조가 아닙니다. 스택트레이스를 그대로 내보내면
        # 서버 내부가 새어 나가므로 한 줄로 바꿉니다
        raise HTTPException(
            status_code=400,
            detail="엑셀 파일을 읽지 못했습니다. 학교에서 받은 Zamong 워크북(.xlsx)이 맞는지 확인해주세요.",
        )

    if not result.entries:
        raise HTTPException(
            status_code=400,
            detail="워크북에서 채워진 과목을 찾지 못했습니다. 학기 칸을 채운 파일인지 확인해주세요.",
        )

    db.query(models.CourseGrade).filter(models.CourseGrade.user_id == user.id).delete()
    for entry in result.entries:
        db.add(
            models.CourseGrade(
                user_id=user.id,
                course_id=known[entry.course],
                grade=entry.grade,
                term=entry.term,
                is_ec=entry.is_ec,
            )
        )
    db.commit()

    return {
        "stu_id": stu_id,
        "imported": len(result.entries),
        "graded": sum(1 for entry in result.entries if entry.grade),
        "ec": sum(1 for entry in result.entries if entry.is_ec),
        "sheets": result.sheets_read,
        # 화면이 "이건 못 옮겼습니다" 로 보여 줄 것들
        "unknown_courses": result.unknown_courses[:20],
        "unknown_terms": result.unknown_terms[:10],
        "unknown_grades": result.unknown_grades[:10],
    }


@router.get("/courses/{name}")
def get_course(
    name: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """과목 하나의 상세 — 책자에서 가져온 설명 본문까지 포함합니다."""
    course = db.query(models.Course).filter(models.Course.name == name).first()
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    edges = (
        db.query(models.CoursePrereq)
        .filter(
            (models.CoursePrereq.after_id == course.id)
            | (models.CoursePrereq.before_id == course.id)
        )
        .all()
    )
    course_name = {cid: cname for cid, cname in db.query(models.Course.id, models.Course.name).all()}

    # 이 과목이 영어강의로도 열리는지 — 개설 이력을 함께 보여줍니다
    openings = (
        db.query(models.Subject.name, models.Subject.is_ec)
        .filter(models.Subject.course_id == course.id)
        .order_by(models.Subject.is_ec)
        .all()
    )

    return {
        **_course_summary(course, has_ec=any(is_ec for _, is_ec in openings)),
        "description_sections": course.description_sections or {},
        "description_source": course.description_source,
        "description_page": course.description_page,
        "openings": [
            {"subject": subject_label(sname, is_ec), "is_ec": is_ec}
            for sname, is_ec in openings
        ],
        "prerequisites": [
            {"name": course_name[edge.before_id], "alternative": edge.alternative}
            for edge in edges
            if edge.after_id == course.id and edge.before_id in course_name
        ],
        "unlocks": [
            course_name[edge.after_id]
            for edge in edges
            if edge.before_id == course.id and edge.after_id in course_name
        ],
    }
