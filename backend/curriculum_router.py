"""교육과정 API — 과목 카탈로그, 선수관계, 졸업 요건"""

import zipfile
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend import models
from backend.auth import get_current_user, get_db
from backend.zamong_import import parse_workbook

# 워크북은 원본이 700KB 쯤입니다. 넉넉히 잡되, 아무 파일이나 통째로 메모리에 올리는
# 일은 막습니다
MAX_WORKBOOK_BYTES = 8 * 1024 * 1024

# 본인 것만 다루거나 개인 정보가 없는 엔드포인트 — 두 앱이 같이 씁니다
router = APIRouter(prefix="/curriculum", tags=["curriculum"])

# 학번만 알면 남의 이수 이력을 통째로 볼 수 있는 엔드포인트 — **class-explorer 전용**입니다.
# ksa-bench 는 `bench_router` 의 `GET /me/progress` 로 본인 것만 봅니다.
explorer_router = APIRouter(prefix="/curriculum", tags=["curriculum"])

# 졸업 요건 — 출처는 Zamong 워크북 상단표입니다.
#
# 학점은 계열별로 채우고, 시수는 비교과(자기계발·협업·세계시민)입니다. 시수는 어디에도
# 데이터가 없어서 본인이 적어 넣습니다 (`/state/zamong`).
#
# ⚠️ 시수 총합 요건(270)이 셋의 최소치 합(180)보다 큽니다 — 셋을 각각 채워도 총합이
# 모자랄 수 있습니다. 워크북도 그렇게 셉니다.
GRADUATION = {
    "credits": {
        "natural": 67.0,
        "humanities": 52.0,
        "convergence": 8.0,
        "total": 127.0,
        "ec": 10.0,
    },
    "hours": {
        "self_dev": 60.0,
        "collab": 60.0,
        "global": 60.0,
        "total": 270.0,
    },
    # 한 학기에 담을 수 있는 학점 — 워크북이 학기마다 "좋아요/맞추세요"를 붙이는 기준
    "term_credits": {"min": 10.0, "max": 30.0},
}

# 계열별 졸업 이수 학점.
#
# ⚠️ **`GRADUATION["credits"]`에서 파생시킵니다.** 같은 숫자를 두 벌 적어 두면 한쪽만
# 고치게 됩니다. `total`을 빼는 이유는 이 표의 소비자가 "계열별"만 기대해서입니다
# (ksa-bench 가 이 모양을 그대로 늘어놓습니다).
REQUIREMENTS = {
    key: value for key, value in GRADUATION["credits"].items() if key != "total"
}

# 자몽이 쓰는 학기 칸.
#
# 실제 학기(`2026-1`)가 아니라 **입학부터 몇 번째 학기인지**로 셉니다 — 워크북이 그렇게
# 세기 때문입니다. 계절학기는 순서가 없어 따로 둡니다.
#
# 졸업까지는 여섯 학기지만 칸은 **여덟**입니다 — 휴학하면 그만큼 밀립니다. 안 쓰는
# 칸은 화면이 조용히 접어 두므로, 있어서 손해 볼 게 없습니다.
TERM_SLOTS = [{"key": str(n), "label": f"{n}학기"} for n in range(1, 9)] + [
    {"key": "S", "label": "계절학기"}
]
TERM_KEYS = {slot["key"] for slot in TERM_SLOTS}

# 평어 → 평점 (4.3 만점)
GRADE_POINTS = {
    "A+": 4.3, "A0": 4.0, "A-": 3.7,
    "B+": 3.3, "B0": 3.0, "B-": 2.7,
    "C+": 2.3, "C0": 2.0, "C-": 1.7,
    "D+": 1.3, "D0": 1.0, "D-": 0.7,
    "F": 0.0,
}


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
        (f"{subject.name}(EC)" if subject.is_ec else subject.name): course_name[subject.course_id]
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


def fetch_progress(db: Session, stu_id: str) -> dict:
    """
    한 학생이 **모든 학기에 걸쳐** 수강한 과목을 카탈로그 이름으로 돌려줍니다.

    프론트가 들고 있는 `allClassesData`는 지금 보고 있는 학기 하나뿐이라, 누적
    이수 현황은 여기서 따로 조회합니다.

    수집 대상이 아닌 학기(2026-1 이전)는 데이터 자체가 없습니다. 그 부분은 프론트에서
    직접 체크한 내역으로 채웁니다.

    **누구를 조회할지는 부르는 쪽이 정합니다.** 그래서 이 함수 자체에는 권한 검사가
    없습니다 — 라우터에서 정해 주세요.
    """
    rows = (
        db.query(
            models.Class.year,
            models.Class.semester,
            models.Subject.name,
            models.Subject.is_ec,
            models.Course.name,
        )
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .join(models.Subject, models.Subject.id == models.Class.subject_id)
        .outerjoin(models.Course, models.Course.id == models.Subject.course_id)
        .filter(models.Enrollment.stuId == stu_id)
        .order_by(models.Class.year, models.Class.semester)
        .all()
    )

    terms: dict[tuple[int, int], list[dict]] = {}
    for year, semester, name, is_ec, course in rows:
        terms.setdefault((year, semester), []).append(
            {
                "subject": f"{name}(EC)" if is_ec else name,
                "course": course,
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
    stu_id = _require_linked(user)
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
    stu_id = _require_linked(user)

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
            {"subject": f"{sname}(EC)" if is_ec else sname, "is_ec": is_ec}
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
