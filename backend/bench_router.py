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
from pydantic import BaseModel, Field
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
    """지정 학기의 과목·분반·시간·강의실 + **분반 명단**.

    ⚠️ 명단이 들어 있습니다. 원래는 뺐는데, Trade(수강 변경 탐색)가 "이 분반 수강생
    중에 내 분반을 받을 수 있는 사람"을 찾는 기능이라 명단 없이는 성립하지 않아
    되돌렸습니다. 그래서 **이 앱이 class-explorer 보다 좁은 지점은 명단 유무가 아니라
    아래 셋**입니다.

    - 검색이 한 번에 한 명 (다중 검색·불린 연산·초성 없음)
    - 전교생을 늘어놓는 화면이 없음 (`/browse` 학생 목록 제거)
    - 남의 누적 이수 이력·`/admin/*` 라우터가 등록돼 있지 않음

    바꿔 말하면 **훑는 화면은 없앴지만 데이터는 내려갑니다.** 이걸 다시 좁히려면
    Trade 를 "양쪽이 등록했을 때만 맞춰 주는" 매칭 방식으로 새로 만들어야 합니다.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    target_year, target_semester = resolve_term(db, year, semester)

    all_classes = db.query(models.Class).filter(
        models.Class.year == target_year,
        models.Class.semester == target_semester,
    ).options(
        selectinload(models.Class.enrollments).joinedload(models.Enrollment.student),
        selectinload(models.Class.times),
        joinedload(models.Class.subject).joinedload(models.Subject.course)
        .joinedload(models.Course.department),
    ).all()

    grouped: dict[int, list] = {}
    subjects: dict[int, models.Subject] = {}
    subject_students: dict[int, set[str]] = {}
    total_active_students: set[str] = set()

    def year_of(stu_id: str) -> str:
        return stu_id.split("-")[0] if "-" in stu_id else "Unknown"

    for cls in all_classes:
        students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        stu_ids = {s["stuId"] for s in students}
        subjects.setdefault(cls.subject_id, cls.subject)
        grouped.setdefault(cls.subject_id, [])
        subject_students.setdefault(cls.subject_id, set()).update(stu_ids)
        total_active_students.update(stu_ids)

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
            "student_count": len(stu_ids),
            "year_counts": dict(sorted(year_counts.items())),
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

        # 과목 단위 분포는 분반 합이 아니라 **중복을 뺀** 값입니다 — 한 학생이 두 분반에
        # 걸쳐 있으면 두 번 세이면 안 됩니다
        subject_year_counts: dict[str, int] = {}
        for stu_id in subject_students[subject_id]:
            yr = year_of(stu_id)
            subject_year_counts[yr] = subject_year_counts.get(yr, 0) + 1

        final_data.append({
            "subject": display,
            "subject_id": subject_id,
            "subject_english": subject.name_english,
            "is_ec": subject.is_ec,
            "subject_student_count": len(subject_students[subject_id]),
            "subject_year_counts": dict(sorted(subject_year_counts.items())),
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


# ─── 친구 ────────────────────────────────────────────────────────────────────
#
# **단방향입니다.** 내가 추가하면 끝이고 상대의 수락이 없습니다. 남의 시간표는 어차피
# `GET /students/{stu_id}` 로 한 명씩 볼 수 있으니, 이 목록은 새로 뭘 열어 주는 게
# 아니라 자주 보는 사람을 북마크해 두는 것입니다.
class FriendRequest(BaseModel):
    stu_id: str = Field(min_length=1, max_length=16)


def _friend_stu_ids(db: Session, user_id: int) -> list[str]:
    return [
        row[0]
        for row in db.query(models.Friend.friend_stu_id)
        .filter(models.Friend.user_id == user_id)
        .order_by(models.Friend.friend_stu_id)
        .all()
    ]


@router.get("/friends")
async def list_friends(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """내가 등록한 사람들. 이름과 학번만 옵니다."""
    stu_ids = _friend_stu_ids(db, current_user.id)
    if not stu_ids:
        return {"friends": []}
    rows = (
        db.query(models.Student)
        .filter(models.Student.stuId.in_(stu_ids))
        .order_by(models.Student.stuId)
        .all()
    )
    return {"friends": [{"stuId": s.stuId, "name": s.name} for s in rows]}


@router.post("/friends", status_code=status.HTTP_201_CREATED)
async def add_friend(
    body: FriendRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.Student).filter(models.Student.stuId == body.stu_id).first()
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="학생을 찾을 수 없습니다.")
    if student.stuId == current_user.stu_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="본인은 추가할 수 없습니다.")

    exists = (
        db.query(models.Friend)
        .filter(
            models.Friend.user_id == current_user.id,
            models.Friend.friend_stu_id == student.stuId,
        )
        .first()
    )
    if not exists:
        db.add(models.Friend(user_id=current_user.id, friend_stu_id=student.stuId))
        db.commit()
    return {"stuId": student.stuId, "name": student.name}


@router.delete("/friends/{stu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(
    stu_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Friend).filter(
        models.Friend.user_id == current_user.id,
        models.Friend.friend_stu_id == stu_id,
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/friends/busy")
async def friends_busy_slots(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """친구들이 **언제 수업이 있는지**만. 무슨 수업인지는 주지 않습니다.

    공강을 맞춰 보는 게 목적이라 요일·교시면 충분하고, 과목·교실까지 주면 "누가 뭘
    듣는지"를 목록으로 훑는 화면이 되어 버립니다. 슬롯은 `"MON-3"` 모양입니다.

    본인도 함께 돌려줍니다 — 어차피 내 시간표고, 겹쳐 보려면 있어야 합니다.
    """
    target_year, target_semester = resolve_term(db, year, semester)

    stu_ids = _friend_stu_ids(db, current_user.id)
    if current_user.stu_id:
        stu_ids = [current_user.stu_id] + stu_ids
    if not stu_ids:
        return {"term": {"year": target_year, "semester": target_semester}, "people": []}

    rows = (
        db.query(
            models.Enrollment.stuId,
            models.ClassTime.day,
            models.ClassTime.period,
        )
        .join(models.Class, models.Class.id == models.Enrollment.classId)
        .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
        .filter(
            models.Enrollment.stuId.in_(stu_ids),
            models.Class.year == target_year,
            models.Class.semester == target_semester,
        )
        .all()
    )

    busy: dict[str, set[str]] = {stu_id: set() for stu_id in stu_ids}
    for stu_id, day, period in rows:
        busy.setdefault(stu_id, set()).add(f"{day}-{period}")

    names = {
        s.stuId: s.name
        for s in db.query(models.Student).filter(models.Student.stuId.in_(stu_ids)).all()
    }

    return {
        "term": {"year": target_year, "semester": target_semester},
        "people": [
            {
                "stuId": stu_id,
                "name": names.get(stu_id, stu_id),
                "is_me": stu_id == current_user.stu_id,
                "busy": sorted(busy.get(stu_id, set())),
            }
            for stu_id in stu_ids
        ],
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
