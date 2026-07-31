"""ksa-bench 전용 데이터 API.

class-explorer 의 `GET /` 은 학기 전체를 **분반 명단까지** 한 번에 내려줍니다. 화면에서
명단을 안 그리는 것만으로는 아무 의미가 없습니다 — 응답이 그대로 브라우저 localStorage 에
남으니까요. 그래서 여기서는 응답 자체를 다르게 만듭니다.

| | class-explorer | ksa-bench |
| --- | --- | --- |
| 분반 → 명단 | 있음 | **없음** (인원수만) |
| 사람 → 시간표 | 벌크 응답 안에 전부 | `GET /students/{stu_id}` — **한 번에 한 명** |
| 사람 찾기 | 클라이언트에서 통째로 | `GET /students/search` — 이름만, 상한 있음 |

목표는 명단을 못 얻게 하는 것이 아니라 **얻는 비용을 학교 공식 앱(가온누리)과 같게**
만드는 것입니다. 가온누리도 학번이 연속이라 순회하면 긁히지만, 한 명씩 물어봐야 합니다.
여기서도 그렇게 만듭니다 — 그래서 완전 차단이 아니라 상한과 rate limit 입니다.
"""

import threading
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session, joinedload, selectinload

from backend import models
from backend.auth import get_current_user, get_db
from backend.classes_router import get_section_num
from backend.curriculum_router import fetch_progress
from backend.terms import list_terms, resolve_term

router = APIRouter(tags=["bench"])


# ─── 사람 조회 rate limit ────────────────────────────────────────────────────
#
# IP 가 아니라 **계정** 단위입니다. 로그인이 필수인 앱이라 계정이 더 정확하고,
# 같은 학교 네트워크에서 여러 명이 쓰는 경우를 IP 로 묶으면 애먼 사람이 막힙니다.
#
# 값은 "사람이 손으로 하는 조회"는 안 걸리고 "훑기"는 걸리는 선입니다. 전교생이
# 700명 남짓이니, 상세 조회 30회/분이면 전원을 훑는 데 20분이 넘게 걸립니다.
_hits: dict[tuple[str, int], list[float]] = defaultdict(list)
_WINDOW = 60
_SEARCH_LIMIT = 40   # 이름 검색 — 타이핑 중에도 불리므로 조금 넉넉하게
_DETAIL_LIMIT = 30   # 시간표 조회 — 실제로 데이터가 나가는 쪽
_CLEANUP_INTERVAL = 300
_cleanup_lock = threading.Lock()
_last_cleanup = time.time()


def _maybe_cleanup() -> None:
    """만료된 항목을 주기적으로 정리해 메모리 누수를 막습니다."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    with _cleanup_lock:
        if now - _last_cleanup < _CLEANUP_INTERVAL:
            return
        cutoff = now - _WINDOW
        for key in [k for k, v in _hits.items() if not any(t > cutoff for t in v)]:
            del _hits[key]
        _last_cleanup = now


def _check_limit(bucket: str, user_id: int, limit: int) -> None:
    _maybe_cleanup()
    now = time.time()
    cutoff = now - _WINDOW
    key = (bucket, user_id)
    recent = [t for t in _hits[key] if t > cutoff]
    _hits[key] = recent
    if len(recent) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"조회가 너무 잦습니다. {_WINDOW}초 뒤에 다시 시도해 주세요.",
            headers={"Retry-After": str(_WINDOW)},
        )
    _hits[key].append(now)


# ─── 학기 데이터 (명단 없음) ─────────────────────────────────────────────────
@router.get("/")
async def get_term_data(
    response: Response,
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """지정 학기의 과목·분반·시간·강의실. **수강생 명단은 들어 있지 않습니다.**

    인원수(`student_count`)는 줍니다 — 개인을 가리키지 않고 수강신청에 실제로 쓸모가
    있습니다. 다만 **학번 분포는 주지 않습니다.** 1학년 필수 과목 명단에서 혼자 다른
    학번이면 그게 곧 재수강 표시라, 이름이 없어도 그 사실만으로 드러납니다.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    target_year, target_semester = resolve_term(db, year, semester)

    # 명단을 안 내보내므로 Student 까지 조인할 필요가 없습니다.
    # Enrollment.stuId 만으로 인원수와 중복 제거가 됩니다.
    all_classes = db.query(models.Class).filter(
        models.Class.year == target_year,
        models.Class.semester == target_semester,
    ).options(
        selectinload(models.Class.enrollments),
        selectinload(models.Class.times),
        joinedload(models.Class.subject).joinedload(models.Subject.course)
        .joinedload(models.Course.department),
    ).all()

    grouped: dict[int, list] = {}
    subjects: dict[int, models.Subject] = {}
    subject_students: dict[int, set[str]] = {}
    total_active_students: set[str] = set()

    for cls in all_classes:
        stu_ids = {e.stuId for e in cls.enrollments}
        subjects.setdefault(cls.subject_id, cls.subject)
        grouped.setdefault(cls.subject_id, [])
        subject_students.setdefault(cls.subject_id, set()).update(stu_ids)
        total_active_students.update(stu_ids)

        grouped[cls.subject_id].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "student_count": len(stu_ids),
            "times": sorted(
                [{"day": t.day, "period": t.period, "room": t.room} for t in cls.times],
                key=lambda x: (["MON", "TUE", "WED", "THU", "FRI"].index(x["day"]), x["period"])
            ),
        })

    final_data = []
    for subject_id, sections in grouped.items():
        subject = subjects[subject_id]
        course = subject.course
        sections.sort(key=lambda s: get_section_num(s["section"]))
        display = f"{subject.name}(EC)" if subject.is_ec else subject.name
        final_data.append({
            "subject": display,
            "subject_id": subject_id,
            "subject_english": subject.name_english,
            "is_ec": subject.is_ec,
            "subject_student_count": len(subject_students[subject_id]),
            "section_count": len(sections),
            "sections": sections,
            "credits": course.credits if course else None,
            "is_pf": course.is_pf if course else False,
            "department": course.department.name if course else None,
            "category": course.department.category if course else None,
        })
    final_data.sort(key=lambda item: item["subject"])

    # 학년별 총원은 남깁니다 — 전교 집계라 개인을 가리키지 않습니다.
    # 위험한 건 **분반별** 학번 분포지 학기 전체 분포가 아닙니다.
    student_counts: dict[str, int] = {}
    for s_id in total_active_students:
        yr = s_id.split("-")[0] if "-" in s_id else "Unknown"
        student_counts[yr] = student_counts.get(yr, 0) + 1

    return {
        "term": {"year": target_year, "semester": target_semester},
        "available_terms": list_terms(db),
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students),
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data,
    }


# ─── 통계 (집계만) ───────────────────────────────────────────────────────────
@router.get("/stats/enrollment")
async def get_enrollment_stats(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """"한 학생이 주당 몇 교시를 듣는가", "몇 과목을 듣는가" 의 분포.

    분석 화면이 쓰던 값인데, 원래는 프론트가 명단을 통째로 들고 직접 셌습니다.
    명단을 안 보내기로 했으니 세는 일을 서버가 대신합니다 — **분포만 나가고 누가
    어디 있는지는 나가지 않습니다.**

    학번(입학연도)별로 쪼갠 값도 같이 줍니다. 이건 "3학년 중 18교시를 듣는 사람이
    몇 명" 같은 전교 집계라 개인을 가리키지 않습니다. **과목별 학번 분포는 주지
    않습니다** — 1학년 필수 과목에서 혼자 다른 학번이면 그게 곧 재수강 표시입니다.
    """
    target_year, target_semester = resolve_term(db, year, semester)

    rows = (
        db.query(
            models.Enrollment.stuId,
            models.Class.subject_id,
            models.ClassTime.day,
            models.ClassTime.period,
        )
        .join(models.Class, models.Class.id == models.Enrollment.classId)
        .outerjoin(models.ClassTime, models.ClassTime.class_id == models.Class.id)
        .filter(
            models.Class.year == target_year,
            models.Class.semester == target_semester,
        )
        .all()
    )

    periods_by_student: dict[str, set[tuple[str, int]]] = {}
    subjects_by_student: dict[str, set[int]] = {}
    for stu_id, subject_id, day, period in rows:
        subjects_by_student.setdefault(stu_id, set()).add(subject_id)
        if day is not None:
            periods_by_student.setdefault(stu_id, set()).add((day, period))

    def histogram(sizes: dict[str, int]) -> dict:
        """값 → 인원수, 그리고 값 → 학번 → 인원수"""
        total: dict[int, int] = {}
        by_year: dict[int, dict[str, int]] = {}
        for stu_id, size in sizes.items():
            yr = stu_id.split("-")[0] if "-" in stu_id else "Unknown"
            total[size] = total.get(size, 0) + 1
            by_year.setdefault(size, {})
            by_year[size][yr] = by_year[size].get(yr, 0) + 1
        return {"total": total, "by_year": by_year}

    period_sizes = {s: len(v) for s, v in periods_by_student.items()}
    subject_sizes = {s: len(v) for s, v in subjects_by_student.items()}

    return {
        "term": {"year": target_year, "semester": target_semester},
        "weekly_periods": histogram(period_sizes),
        "subject_count": histogram(subject_sizes),
    }


# ─── 사람 찾기 ───────────────────────────────────────────────────────────────
SEARCH_MIN_LENGTH = 2
SEARCH_LIMIT = 20


@router.get("/students/search")
async def search_students(
    request: Request,
    q: str = Query(min_length=1, max_length=32),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """이름·학번 부분 일치로 **후보 목록만** 돌려줍니다. 시간표는 여기 없습니다.

    두 글자 이상을 요구하고 결과를 20명에서 끊는 이유는 같습니다 — 한 번의 질의가
    명단이 되지 않게 하려는 것입니다. `김` 한 글자로 김씨 전원이 나오면 다중 검색을
    없앤 의미가 사라집니다.

    **초성 검색은 없습니다.** `ㄱㅊㅅ` 로 수십 명이 한 번에 걸리는 데다, 어차피 상한에
    잘려서 쓸모도 없습니다.
    """
    _check_limit("search", current_user.id, _SEARCH_LIMIT)

    term = q.strip()
    if len(term) < SEARCH_MIN_LENGTH:
        return {"students": [], "has_more": False, "too_short": True}

    like = f"%{term}%"
    rows = (
        db.query(models.Student)
        .filter(models.Student.name.ilike(like) | models.Student.stuId.ilike(like))
        .order_by(models.Student.stuId)
        .limit(SEARCH_LIMIT + 1)
        .all()
    )

    has_more = len(rows) > SEARCH_LIMIT
    return {
        "students": [{"stuId": s.stuId, "name": s.name} for s in rows[:SEARCH_LIMIT]],
        "has_more": has_more,
        "too_short": False,
    }


@router.get("/students/{stu_id}")
async def get_student_timetable(
    stu_id: str,
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """한 학생의 해당 학기 시간표. **한 번에 한 명만** 됩니다.

    여러 명을 한 요청으로 받지 않는 것이 이 앱의 핵심 제약입니다. 학번이 연속이라
    `25-001+25-002+…` 같은 다중 질의를 허용하면 한 방에 전교생이 긁힙니다.
    """
    _check_limit("detail", current_user.id, _DETAIL_LIMIT)

    student = db.query(models.Student).filter(models.Student.stuId == stu_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="학생을 찾을 수 없습니다.")

    target_year, target_semester = resolve_term(db, year, semester)

    classes = (
        db.query(models.Class)
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .filter(
            models.Enrollment.stuId == stu_id,
            models.Class.year == target_year,
            models.Class.semester == target_semester,
        )
        .options(
            selectinload(models.Class.times),
            joinedload(models.Class.subject).joinedload(models.Subject.course)
            .joinedload(models.Course.department),
        )
        .all()
    )

    items = []
    for cls in classes:
        subject = cls.subject
        course = subject.course if subject else None
        items.append({
            "id": cls.id,
            "subject": f"{subject.name}(EC)" if subject.is_ec else subject.name,
            "subject_id": cls.subject_id,
            "is_ec": subject.is_ec,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "credits": course.credits if course else None,
            "is_pf": course.is_pf if course else False,
            "department": course.department.name if course else None,
            "times": sorted(
                [{"day": t.day, "period": t.period, "room": t.room} for t in cls.times],
                key=lambda x: (["MON", "TUE", "WED", "THU", "FRI"].index(x["day"]), x["period"])
            ),
        })
    items.sort(key=lambda item: (item["subject"], get_section_num(item["section"])))

    return {
        "student": {"stuId": student.stuId, "name": student.name},
        "term": {"year": target_year, "semester": target_semester},
        "classes": items,
    }


# ─── 본인 이수 현황 ──────────────────────────────────────────────────────────
@router.get("/me/progress")
async def get_my_progress(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """내 누적 이수 현황. class-explorer 는 아무 학번이나 조회할 수 있지만 여기는 본인뿐입니다."""
    if not current_user.stu_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="계정에 학번이 등록되어 있지 않습니다.",
        )
    return fetch_progress(db, current_user.stu_id)
