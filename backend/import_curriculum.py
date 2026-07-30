"""
교육과정 seed JSON을 DB에 넣습니다.

    python -m backend.import_curriculum
    python -m backend.import_curriculum --seed /path/to/curriculum_seed.json
    python -m backend.import_curriculum --dry-run

seed는 `build_curriculum_seed.py`가 Zamong 워크북에서 만들어 둔 파일입니다.
이 스크립트는 워크북도 SweetZamong DB도 필요 없어서 서버에서 그대로 돌릴 수 있습니다.

교육과정은 학기와 무관한 정의라 통째로 갈아끼웁니다. 다만 `Subject`(KEIS 개설명)는
지우지 않고 `course_id`만 다시 잇습니다 — 개설 이력은 교육과정이 바뀌어도 남아야
하니까요.
"""

import argparse
import json
import os

from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, init_schema
from backend.subject_names import EC_TAG, match_course

DEFAULT_SEED = os.path.join(os.path.dirname(__file__), "curriculum_seed.json")

# 학과 → 계열. 학과가 계열을 결정하므로 과목마다 들고 있지 않습니다
DEPARTMENT_CATEGORY = {
    "수학": "natural", "정보과학": "natural", "물리학": "natural",
    "화학": "natural", "생물학": "natural", "지구과학": "natural",
    "국어": "humanities", "사회": "humanities",
    "외국어": "humanities", "예체능": "humanities",
    "융합": "convergence",
}

# 화면에 늘어놓는 순서
DEPARTMENT_ORDER = [
    "수학", "정보과학", "물리학", "화학", "생물학", "지구과학",
    "국어", "사회", "외국어", "예체능", "융합",
]


def load_seed(path: str) -> dict:
    if not os.path.exists(path):
        raise SystemExit(f"seed 파일을 찾을 수 없습니다: {path}")
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def strip_language_tag(name: str) -> str:
    """
    교육과정 이름에서 언어 태그를 뗍니다.

    워크북은 일부 과목에만 `(EC)`를 달아 뒀는데(145개 중 4개), 그대로 두면 같은 과목의
    한국어강의가 갈 곳이 없어집니다. 언어 구분은 `Subject.is_ec`가 담습니다.
    """
    return name[: -len(EC_TAG)].strip() if name.endswith(EC_TAG) else name


def run(seed_path: str, dry_run: bool) -> int:
    seed = load_seed(seed_path)
    raw_courses = seed.get("courses", [])
    prerequisites = seed.get("prerequisites", [])

    # 언어 태그를 뗀 이름으로 묶습니다. 워크북에 같은 과목이 여러 학기 슬롯으로
    # 들어 있어 이름이 겹치기도 합니다
    by_name: dict[str, dict] = {}
    alias: dict[str, str] = {}  # seed 원래 이름 → 태그 뗀 이름
    for course in raw_courses:
        clean = strip_language_tag(course["name"])
        alias[course["name"]] = clean
        by_name.setdefault(clean, course)

    departments = sorted(
        {course["department"] for course in raw_courses},
        key=lambda name: (
            DEPARTMENT_ORDER.index(name) if name in DEPARTMENT_ORDER else len(DEPARTMENT_ORDER),
            name,
        ),
    )

    edges = [
        (alias[edge["before"]], alias[edge["after"]], bool(edge.get("alternative")))
        for edge in prerequisites
        if alias.get(edge["before"]) in by_name
        and alias.get(edge["after"]) in by_name
        and alias[edge["before"]] != alias[edge["after"]]
    ]

    print(f"seed: 과목 {len(raw_courses)}개 → 고유 {len(by_name)}개 · 학과 {len(departments)}개")
    print(f"      선수관계 {len(prerequisites)}개 중 {len(edges)}개 유효")

    if dry_run:
        print("\n--dry-run: 저장하지 않았습니다.")
        return 0

    db: Session = SessionLocal()
    try:
        # 교육과정을 갈아끼우는 동안 개설 과목은 잠시 연결을 놓습니다
        db.query(models.Subject).update({models.Subject.course_id: None})
        db.query(models.CoursePrereq).delete()
        db.query(models.CourseGrade).delete()
        db.query(models.Course).delete()
        db.query(models.Department).delete()
        db.flush()

        department_id: dict[str, int] = {}
        for index, name in enumerate(departments):
            row = models.Department(
                name=name,
                category=DEPARTMENT_CATEGORY.get(name, "natural"),
                display_order=index,
            )
            db.add(row)
            db.flush()
            department_id[name] = row.id

        course_id: dict[str, int] = {}
        for name, course in by_name.items():
            row = models.Course(
                department_id=department_id[course["department"]],
                name=name,
                name_english=course.get("english_name"),
                credits=course.get("credits") or 0,
                ap_credits=course.get("ap_credits") or 0,
                is_pf=bool(course.get("is_pf")),
                recommended_semester=course.get("recommended_semester"),
                description=course.get("description"),
                description_sections=course.get("description_sections") or {},
                description_source=course.get("description_source"),
                description_page=course.get("description_page"),
            )
            db.add(row)
            db.flush()
            course_id[name] = row.id

        seen: set[tuple[int, int]] = set()
        for before, after, alternative in edges:
            pair = (course_id[before], course_id[after])
            if pair in seen:
                continue
            seen.add(pair)
            db.add(
                models.CoursePrereq(
                    before_id=pair[0], after_id=pair[1], alternative=alternative
                )
            )

        # 개설 과목을 교육과정에 다시 잇습니다 — 예전 import_credits 가 하던 일입니다
        linked, unlinked = 0, []
        for subject in db.query(models.Subject).all():
            matched = match_course(subject.name, course_id)
            if matched:
                subject.course_id = course_id[matched]
                linked += 1
            else:
                unlinked.append(subject.name)

        db.commit()
        print(f"\n학과 {len(department_id)} · 과목 {len(course_id)} · 선수관계 {len(seen)} 저장")
        print(f"개설 과목 연결 {linked}개" + (f" · 교육과정에 없음 {len(unlinked)}개" if unlinked else ""))
        if unlinked:
            for name in sorted(unlinked):
                print(f"  {name}")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="교육과정 seed를 DB에 적재")
    parser.add_argument("--seed", default=DEFAULT_SEED, help="seed JSON 경로")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 결과만 출력")
    args = parser.parse_args()

    init_schema()
    return run(args.seed, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
