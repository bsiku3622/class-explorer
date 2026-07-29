"""교육과정 API — 과목 카탈로그, 선수관계, 졸업 요건"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user, get_db

router = APIRouter(prefix="/curriculum", tags=["curriculum"])

# 계열별 졸업 이수 학점
REQUIREMENTS = {
    "natural": 67.0,
    "humanities": 52.0,
    "convergence": 8.0,
    "ec": 10.0,
}

# 평어 → 평점 (4.3 만점)
GRADE_POINTS = {
    "A+": 4.3, "A0": 4.0, "A-": 3.7,
    "B+": 3.3, "B0": 3.0, "B-": 2.7,
    "C+": 2.3, "C0": 2.0, "C-": 1.7,
    "D+": 1.3, "D0": 1.0, "D-": 0.7,
    "F": 0.0,
}


def _course_summary(course: models.Course) -> dict:
    """목록용 — 긴 설명 본문(`description_sections`)은 뺍니다."""
    return {
        "name": course.name,
        "english_name": course.english_name,
        "department": course.department,
        "category": course.category,
        "credits": course.credits,
        "ap_credits": course.ap_credits,
        "is_ec": course.is_ec,
        "is_pf": course.is_pf,
        "recommended_semester": course.recommended_semester,
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

    `subject_map`은 KEIS 과목명(`Class.subject`)을 카탈로그 이름으로 옮기는 표입니다.
    이게 있어야 프론트가 이미 들고 있는 수강 데이터를 교육과정에 붙일 수 있습니다.
    """
    courses = db.query(models.Course).order_by(models.Course.department, models.Course.name).all()
    prerequisites = db.query(models.CoursePrereq).all()

    known = {course.name for course in courses}
    subject_map = {
        credit.subject: credit.matched_name
        for credit in db.query(models.SubjectCredit).all()
        if credit.matched_name in known
    }

    return {
        "courses": [_course_summary(course) for course in courses],
        "prerequisites": [
            {"before": edge.before, "after": edge.after, "alternative": edge.alternative}
            for edge in prerequisites
        ],
        "subject_map": subject_map,
        "requirements": REQUIREMENTS,
        "grade_points": GRADE_POINTS,
    }


@router.get("/progress/{stu_id}")
def get_progress(
    stu_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    """
    한 학생이 **모든 학기에 걸쳐** 수강한 과목을 카탈로그 이름으로 돌려줍니다.

    프론트가 들고 있는 `allClassesData`는 지금 보고 있는 학기 하나뿐이라, 누적
    이수 현황은 여기서 따로 조회합니다.

    수집 대상이 아닌 학기(2026-1 이전)는 데이터 자체가 없습니다. 그 부분은 프론트에서
    직접 체크한 내역으로 채웁니다.
    """
    rows = (
        db.query(
            models.Class.year,
            models.Class.semester,
            models.Class.subject,
            models.SubjectCredit.matched_name,
        )
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .outerjoin(models.SubjectCredit, models.SubjectCredit.subject == models.Class.subject)
        .filter(models.Enrollment.stuId == stu_id)
        .order_by(models.Class.year, models.Class.semester)
        .all()
    )

    known = {name for (name,) in db.query(models.Course.name).all()}
    terms: dict[tuple[int, int], list[dict]] = {}
    for year, semester, subject, matched in rows:
        terms.setdefault((year, semester), []).append(
            {
                "subject": subject,
                "course": matched if matched in known else None,
            }
        )

    return {
        "stu_id": stu_id,
        "terms": [
            {
                "year": year,
                "semester": semester,
                "courses": sorted(items, key=lambda item: item["subject"]),
            }
            for (year, semester), items in sorted(terms.items())
        ],
    }


class GradeEntry(BaseModel):
    course: str = Field(min_length=1, max_length=160)
    grade: str | None = Field(default=None, max_length=4)


class GradesRequest(BaseModel):
    entries: list[GradeEntry] = Field(default_factory=list, max_length=400)


def _require_linked(user: models.User) -> str:
    """이수 기록은 본인 것만 다루므로 학번이 등록돼 있어야 합니다."""
    if not user.stu_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="계정에 학번이 등록되어 있지 않습니다.",
        )
    return user.stu_id


@router.get("/grades")
def get_grades(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """로그인한 계정 본인의 이수·성적"""
    stu_id = _require_linked(user)
    rows = (
        db.query(models.CourseGrade)
        .filter(models.CourseGrade.user_id == user.id)
        .order_by(models.CourseGrade.course)
        .all()
    )
    return {
        "stu_id": stu_id,
        "entries": [{"course": row.course, "grade": row.grade} for row in rows],
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
    stu_id = _require_linked(user)
    known = {name for (name,) in db.query(models.Course.name).all()}
    unknown = sorted({entry.course for entry in payload.entries} - known)
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

    db.query(models.CourseGrade).filter(models.CourseGrade.user_id == user.id).delete()

    # 같은 과목이 두 번 오면 뒤엣것을 씁니다 — UNIQUE 위반을 막습니다
    deduped = {entry.course: entry.grade for entry in payload.entries}
    for course, grade in deduped.items():
        db.add(models.CourseGrade(user_id=user.id, course=course, grade=grade))
    db.commit()
    return {"stu_id": stu_id, "saved": len(deduped)}


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
        .filter((models.CoursePrereq.after == name) | (models.CoursePrereq.before == name))
        .all()
    )
    return {
        **_course_summary(course),
        "description_sections": course.description_sections or {},
        "description_source": course.description_source,
        "description_page": course.description_page,
        "prerequisites": [
            {"name": edge.before, "alternative": edge.alternative}
            for edge in edges
            if edge.after == name
        ],
        "unlocks": [edge.after for edge in edges if edge.before == name],
    }
