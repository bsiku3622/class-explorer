"""전공 — 학교 공식 이름은 **심화필수 전공 트랙**입니다(ksain 2315번 「심화필수 전공 트랙 조사」).

1·2학년 때 학교가 조사하고, **3학년 2학기까지 바꿀 수 있습니다.** 그래서 계정에 적어 두되 본인이
언제든 고칠 수 있게 합니다(`PUT /majors/me`). 트랙은 교육과정의 과학 6개 학과 — `departments.track`
(심화필수 조건)이 있는 학과 — 와 같습니다.

| 학부 | 전공 트랙 |
| --- | --- |
| 수리정보과학부 | 수학 · 정보과학 |
| 물리지구과학부 | 물리학 · 지구과학 |
| 화학생물학부 | 화학 · 생물학 |

인문예술학부는 트랙이 없습니다. 공지는 학부 단위로 오는 일이 많아서("물리지구과학부 주관") 대상을
적을 때는 학부를 전공 둘로 풀어 적습니다(`normalize`).

⚠️ **계정에는 학과 이름을 적습니다.** `cli/import_curriculum.py` 가 학과 행을 지우고 다시 만들어서 id 가
바뀝니다 — id 로 묶으면 교육과정을 다시 적재하는 날 모든 사람의 전공이 끊깁니다.
"""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from backend import models
from backend.services.versioning import at_version

DIVISIONS: dict[str, tuple[str, ...]] = {
    "수리정보과학부": ("수학", "정보과학"),
    "물리지구과학부": ("물리학", "지구과학"),
    "화학생물학부": ("화학", "생물학"),
}
MAJORS: tuple[str, ...] = tuple(major for majors in DIVISIONS.values() for major in majors)

# 공지에 실제로 나오는 다른 표기 (ksain 글에서 셌습니다 — "화생학부" 7번, "수리정보학부" 4번 …)
_ALIASES = {
    "수리정보학부": "수리정보과학부", "수리정보": "수리정보과학부",
    "물리지구학부": "물리지구과학부", "물리지구": "물리지구과학부",
    "화학생물": "화학생물학부", "화생학부": "화학생물학부", "화생": "화학생물학부",
    "수리": "수학", "정보": "정보과학", "물리": "물리학", "지구": "지구과학", "생물": "생물학",
    "컴퓨터": "정보과학", "천문": "지구과학", "천문학": "지구과학",
}


def division_of(major: str | None) -> str | None:
    return next((division for division, majors in DIVISIONS.items() if major in majors), None)


# 제목·문장에서 대상을 알아보는 말 — 학부 이름만 봅니다. 트랙 이름("물리학")은 과목·대회 이름에도 흔합니다
_DIVISION_WORD = re.compile("|".join(sorted(
    [*DIVISIONS, *(alias for alias in _ALIASES if alias.endswith("학부"))], key=len, reverse=True)))


def mentioned(text: str | None) -> list[str]:
    """글에 적힌 학부 → 전공 트랙. "화생학부 설명회" → `["화학", "생물학"]`."""
    return normalize(_DIVISION_WORD.findall(text or ""))


def with_divisions(targets: list[str]) -> list[str]:
    """트랙 이름 뒤에 그 학부 이름까지 — 검색어로 맞춰 볼 때 씁니다. 학부 공지의 사실·일정은 문장에 학부
    이름이 없는 일이 많아서, "화학생물학부 특강" 으로 물었을 때 걸리려면 대상에서 이름을 꺼내 와야 합니다."""
    return [*targets, *dict.fromkeys(division for division in map(division_of, targets) if division)]


def normalize(values) -> list[str]:
    """전공·학부 이름 목록 → 전공 트랙 이름(정해진 순서). 학부는 두 전공으로 풉니다. 모르는 이름은 버립니다.

    여섯 개 전부면 빈 목록(= 전공 무관)으로 돌려줍니다 — 학년의 "전학년" 관례와 같습니다.
    """
    if isinstance(values, str):
        values = re.split(r"[,·/\s]+", values)
    found: set[str] = set()
    for raw in values or []:
        name = _ALIASES.get(str(raw).strip(), str(raw).strip())
        if name in DIVISIONS:
            found.update(DIVISIONS[name])
        elif name in MAJORS:
            found.add(name)
    ordered = [major for major in MAJORS if major in found]
    return [] if len(ordered) == len(MAJORS) else ordered


def joined(values) -> str | None:
    """DB 에 적는 꼴 — `"물리학,지구과학"`. 비면 None(전공 무관)."""
    return ",".join(normalize(values)) or None


def split(value: str | None) -> list[str]:
    return [major for major in (value or "").split(",") if major in MAJORS]


def options(db: Session) -> list[dict]:
    """팝업이 늘어놓을 선택지 — 학부별로, 트랙마다 심화필수 조건을 같이."""
    requirement = dict(
        db.query(models.Department.name, models.Department.track)
        .filter(models.Department.name.in_(MAJORS)).all()
    )
    return [
        {"division": division, "majors": [{"name": major, "requirement": requirement.get(major)} for major in majors]}
        for division, majors in DIVISIONS.items()
    ]


def suggest(db: Session, stu_id: str | None) -> dict | None:
    """수강 이력으로 짐작한 트랙 — 팝업이 미리 골라 둡니다. 확실하지 않으면 None.

    1학년 필수 과목은 모두가 같이 들어서 단서가 안 됩니다. 그래서 학과마다 **심화필수 과목**(3점)과
    **심화·AP 과목**(2점)만 셉니다. 1등이 2등의 1.5배를 넘고 4점 이상일 때만 짐작을 내놓습니다 —
    애매할 때 틀린 전공을 골라 두면 그대로 눌러 버리기 쉽습니다.
    """
    if not stu_id:
        return None
    rows = (
        db.query(models.Course.name, models.Course.tier, models.Course.required_advanced, models.Department.name)
        .join(models.Department, models.Department.id == models.Course.department_id)
        .join(models.Subject, models.Subject.course_id == models.Course.id)
        .join(models.Class, models.Class.subject_id == models.Subject.id)
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .filter(models.Enrollment.stuId == stu_id, models.Department.name.in_(MAJORS),
                at_version(models.Class), at_version(models.Enrollment))
        .distinct()
        .all()
    )
    scores: dict[str, float] = {}
    because: dict[str, list[str]] = {}
    for course, tier, required_advanced, department in rows:
        weight = 3 if required_advanced else 2 if tier in ("advanced", "ap") else 0
        if weight:
            scores[department] = scores.get(department, 0) + weight
            because.setdefault(department, []).append(course)
    if not scores:
        return None
    ranked = sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
    best, score = ranked[0]
    runner_up = ranked[1][1] if len(ranked) > 1 else 0
    if score < 4 or score < runner_up * 1.5:
        return None
    return {"major": best, "division": division_of(best), "courses": sorted(set(because[best]))[:4]}


def me(user: models.User) -> dict:
    """계정의 전공 상태 — `/auth/me` 와 `/majors` 가 같이 씁니다."""
    return {
        "major": user.major if user.major in MAJORS else None,
        "division": division_of(user.major),
        # 고르거나 "아직 정하지 않았어요" 를 누르면 True — 그 뒤로 팝업이 다시 뜨지 않습니다
        "answered": user.major_answered_at is not None,
    }
