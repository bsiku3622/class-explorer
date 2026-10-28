"""교육과정 — 졸업 요건 상수, 누적 이수 이력, 본인 확인.

`routers/curriculum.py`(class-explorer)와 `routers/bench.py`(ksa-bench)가 같이 씁니다. 한때
bench 가 curriculum 라우터에서 직접 가져다 써서 라우터끼리 얽혀 있었습니다.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend import models
from backend.services.timetable import subject_label
from backend.services.versioning import at_version

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
        .filter(
            models.Enrollment.stuId == stu_id,
            at_version(models.Class),
            at_version(models.Enrollment),
        )
        .order_by(models.Class.year, models.Class.semester)
        .all()
    )

    terms: dict[tuple[int, int], list[dict]] = {}
    for year, semester, name, is_ec, course in rows:
        terms.setdefault((year, semester), []).append(
            {
                "subject": subject_label(name, is_ec),
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


def require_linked(user: models.User) -> str:
    """이수 기록은 본인 것만 다루므로 학번이 등록돼 있어야 합니다."""
    stu_id = user.effective_stu_id
    if not stu_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="계정에 학번이 등록되어 있지 않습니다.",
        )
    return stu_id
