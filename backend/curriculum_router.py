"""교육과정 API — 과목 카탈로그, 선수관계, 졸업 요건"""

from fastapi import APIRouter, Depends, HTTPException
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
