"""수업 데이터 조회.

`GET /` 하나가 학기 전체를 분반 명단까지 통째로 내려줍니다. **두 프론트가 같이 씁니다** —
한때 ksa-bench 용으로 명단 없는 판을 따로 뒀지만, Trade 가 명단 없이는 성립하지 않아
되돌리면서 둘이 같아졌습니다. 같은 응답을 두 벌 유지할 이유가 없어 합쳤습니다.

`year_counts`(분반별)·`subject_year_counts`(과목별, 중복 제외)는 학번 분포입니다.
"""

import re

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload

from backend import models
from backend.auth import get_current_user, get_db
from backend.terms import list_terms, resolve_term
from backend.versioning import at_version, current_version

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
    version: int | None = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    지정 학기의 수업/학생/별칭 데이터 반환 (인증 필요). 학기 미지정 시 최신 학기.

    `version` 을 주면 그 회차 시점으로 답합니다. 안 주면 지금 상태입니다.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    target_year, target_semester = resolve_term(db, year, semester)

    latest = current_version(db, target_year, target_semester)
    if version is not None and version > latest:
        raise HTTPException(status_code=404, detail=f"No such version (latest is {latest})")

    # 1. 수업 및 수강 정보 조회
    all_classes = db.query(models.Class).filter(
        models.Class.year == target_year,
        models.Class.semester == target_semester,
        at_version(models.Class, version),
    ).options(
        joinedload(models.Class.subject).joinedload(models.Subject.course)
        .joinedload(models.Course.department),
    ).all()

    # 명단과 시간은 관계로 읽지 않고 직접 물어봅니다.
    #
    # `cls.enrollments` · `cls.times` 는 **지금 열려 있는 행만** 보도록 막혀 있어서
    # (`models.py`) 과거 회차를 물어도 현재 값이 나옵니다. 회차를 지정할 수 있는 자리는
    # 여기뿐이라, 이 두 줄만 관계를 안 씁니다.
    class_ids = [cls.id for cls in all_classes]
    roster: dict[int, list[dict]] = {}
    slots: dict[int, list[dict]] = {}
    if class_ids:
        for stu_id, name, cid in (
            db.query(models.Student.stuId, models.Student.name, models.Enrollment.classId)
            .join(models.Enrollment, models.Enrollment.stuId == models.Student.stuId)
            .filter(models.Enrollment.classId.in_(class_ids))
            .filter(at_version(models.Enrollment, version))
            .all()
        ):
            roster.setdefault(cid, []).append({"stuId": stu_id, "name": name})

        for cid, day, period, room in (
            db.query(
                models.ClassTime.class_id, models.ClassTime.day,
                models.ClassTime.period, models.ClassTime.room,
            )
            .filter(models.ClassTime.class_id.in_(class_ids))
            .filter(at_version(models.ClassTime, version))
            .all()
        ):
            slots.setdefault(cid, []).append({"day": day, "period": period, "room": room})

    # 과목 단위로 묶습니다. 영어강의와 한국어강의는 이름이 같아도 별개 과목이라
    # subject_id 로 나눠야 합니다 — 이름으로 묶으면 두 과목이 한 덩어리가 됩니다
    grouped: dict[int, list] = {}
    subjects: dict[int, models.Subject] = {}
    subject_students: dict[int, set[str]] = {}
    total_active_students = set()

    def year_of(stu_id: str) -> str:
        return stu_id.split("-")[0] if "-" in stu_id else "Unknown"

    for cls in all_classes:
        students = roster.get(cls.id, [])
        subjects.setdefault(cls.subject_id, cls.subject)
        grouped.setdefault(cls.subject_id, [])

        stu_ids = {s["stuId"] for s in students}
        total_active_students.update(stu_ids)
        subject_students.setdefault(cls.subject_id, set()).update(stu_ids)

        year_counts: dict[str, int] = {}
        for stu_id in stu_ids:
            yr = year_of(stu_id)
            year_counts[yr] = year_counts.get(yr, 0) + 1

        grouped[cls.subject_id].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": sorted(students, key=lambda x: x["stuId"]),
            "student_count": len(students),
            "year_counts": dict(sorted(year_counts.items())),
            "times": sorted(
                slots.get(cls.id, []),
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
        sub_students = subject_students.get(subject_id, set())
        display = f"{subject.name}(EC)" if subject.is_ec else subject.name

        # 과목 단위 분포는 분반 합이 아니라 **중복을 뺀** 값입니다 — 한 학생이 두 분반에
        # 걸쳐 있으면 두 번 세이면 안 됩니다
        subject_year_counts: dict[str, int] = {}
        for stu_id in sub_students:
            yr = year_of(stu_id)
            subject_year_counts[yr] = subject_year_counts.get(yr, 0) + 1

        final_data.append({
            "subject": display,
            "subject_id": subject_id,
            "subject_english": subject.name_english,
            "is_ec": subject.is_ec,
            "subject_student_count": len(sub_students),
            "subject_year_counts": dict(sorted(subject_year_counts.items())),
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
        "version": version if version is not None else latest,
        "latest_version": latest,
        "available_terms": list_terms(db),
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students)
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data
    }
