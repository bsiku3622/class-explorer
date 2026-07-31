"""수업 데이터 조회.

라우터가 둘입니다.

- `terms_router` — 학기 목록. 개인 정보가 없어 두 앱이 같이 씁니다
- `router` — `GET /`. 학기 전체를 **분반 명단까지** 통째로 내려줍니다.
  **class-explorer 에만 등록합니다** (`backend/main.py`)

`GET /` 를 ksa-bench 에 등록하면 안 되는 이유는 화면과 무관합니다. 이 응답이 그대로
브라우저 localStorage 에 남기 때문에, 명단을 UI 에서 가리는 것은 가린 척일 뿐입니다.
ksa-bench 쪽 대응은 `bench_router.py` 에 따로 있습니다.
"""

import re

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session, selectinload, joinedload

from backend import models
from backend.auth import get_current_user, get_db
from backend.terms import list_terms, resolve_term

terms_router = APIRouter(tags=["terms"])
router = APIRouter(tags=["classes"])


def get_section_num(section_str):
    match = re.search(r'(\d+)', section_str)
    return int(match.group(1)) if match else 0


@terms_router.get("/terms")
async def get_terms(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """데이터가 존재하는 학기 목록 (최신순)"""
    return {"terms": list_terms(db)}


@router.get("/")
async def get_all_data(
    response: Response,
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """지정 학기의 수업/학생/별칭 데이터 반환 (인증 필요). 학기 미지정 시 최신 학기."""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    target_year, target_semester = resolve_term(db, year, semester)

    # 1. 수업 및 수강 정보 조회
    all_classes = db.query(models.Class).filter(
        models.Class.year == target_year,
        models.Class.semester == target_semester,
    ).options(
        selectinload(models.Class.enrollments).joinedload(models.Enrollment.student),
        selectinload(models.Class.times),
        joinedload(models.Class.subject).joinedload(models.Subject.course)
        .joinedload(models.Course.department),
    ).all()

    # 과목 단위로 묶습니다. 영어강의와 한국어강의는 이름이 같아도 별개 과목이라
    # subject_id 로 나눠야 합니다 — 이름으로 묶으면 두 과목이 한 덩어리가 됩니다
    grouped: dict[int, list] = {}
    subjects: dict[int, models.Subject] = {}
    total_active_students = set()

    for cls in all_classes:
        students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        subjects.setdefault(cls.subject_id, cls.subject)
        grouped.setdefault(cls.subject_id, [])

        for s in students:
            total_active_students.add(s["stuId"])

        grouped[cls.subject_id].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": sorted(students, key=lambda x: x["stuId"]),
            "student_count": len(students),
            "times": sorted(
                [{"day": t.day, "period": t.period, "room": t.room} for t in cls.times],
                key=lambda x: (["MON", "TUE", "WED", "THU", "FRI"].index(x["day"]), x["period"])
            )
        })

    # 2. 학년별 학생 수 통계 (해당 학기 수강 이력이 있는 학생 기준)
    student_counts = {}
    for s_id in total_active_students:
        yr = s_id.split("-")[0] if "-" in s_id else "Unknown"
        student_counts[yr] = student_counts.get(yr, 0) + 1

    # 3. final_data 구성
    #
    # `subject` 는 화면에 그대로 쓰는 이름입니다. 영어강의는 뒤에 (EC)를 붙여
    # 한국어강의와 구분합니다 — 둘은 별개 과목이라 이름이 같으면 안 됩니다.
    final_data = []
    for subject_id, sections in grouped.items():
        subject = subjects[subject_id]
        course = subject.course
        sections.sort(key=lambda s: get_section_num(s["section"]))
        sub_students = set(stu["stuId"] for s in sections for stu in s["students"])
        display = f"{subject.name}(EC)" if subject.is_ec else subject.name
        final_data.append({
            "subject": display,
            "subject_id": subject_id,
            "subject_english": subject.name_english,
            "is_ec": subject.is_ec,
            "subject_student_count": len(sub_students),
            "section_count": len(sections),
            "sections": sections,
            "credits": course.credits if course else None,
            "is_pf": course.is_pf if course else False,
            "department": course.department.name if course else None,
            "category": course.department.category if course else None,
        })
    final_data.sort(key=lambda item: item["subject"])

    return {
        "term": {"year": target_year, "semester": target_semester},
        "available_terms": list_terms(db),
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students)
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data
    }
