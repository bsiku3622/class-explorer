"""
교육과정 seed JSON을 DB에 넣습니다.

    python -m backend.import_curriculum
    python -m backend.import_curriculum --seed /path/to/curriculum_seed.json
    python -m backend.import_curriculum --dry-run

seed는 `build_curriculum_seed.py`가 Zamong 워크북에서 만들어 둔 파일입니다.
이 스크립트는 워크북도 SweetZamong DB도 필요 없어서 서버에서 그대로 돌릴 수 있습니다.

교육과정은 학기와 무관한 정의라 통째로 갈아끼웁니다.
"""

import argparse
import json
import os

from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, init_schema

DEFAULT_SEED = os.path.join(os.path.dirname(__file__), "curriculum_seed.json")


def load_seed(path: str) -> dict:
    if not os.path.exists(path):
        raise SystemExit(f"seed 파일을 찾을 수 없습니다: {path}")
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def run(seed_path: str, dry_run: bool) -> int:
    seed = load_seed(seed_path)
    courses = seed.get("courses", [])
    prerequisites = seed.get("prerequisites", [])

    # 워크북에 같은 과목이 여러 학기 슬롯으로 들어 있어 이름이 겹칠 수 있습니다
    by_name: dict[str, dict] = {}
    for course in courses:
        by_name.setdefault(course["name"], course)
    duplicates = len(courses) - len(by_name)

    print(f"seed: 과목 {len(courses)}개 → 고유 {len(by_name)}개" + (f" (중복 {duplicates})" if duplicates else ""))
    print(f"      선수관계 {len(prerequisites)}개")

    valid = [
        edge for edge in prerequisites
        if edge["before"] in by_name and edge["after"] in by_name
    ]
    if len(valid) != len(prerequisites):
        dropped = [
            f"{edge['before']}→{edge['after']}"
            for edge in prerequisites
            if edge not in valid
        ]
        print(f"      카탈로그에 없는 과목을 가리키는 관계 {len(dropped)}개 제외: {', '.join(dropped)}")

    if dry_run:
        print("\n--dry-run: 저장하지 않았습니다.")
        return 0

    db: Session = SessionLocal()
    try:
        db.query(models.CoursePrereq).delete()
        db.query(models.Course).delete()
        db.flush()

        for course in by_name.values():
            db.add(
                models.Course(
                    name=course["name"],
                    english_name=course.get("english_name"),
                    department=course["department"],
                    category=course["category"],
                    credits=course.get("credits") or 0,
                    ap_credits=course.get("ap_credits") or 0,
                    is_ec=bool(course.get("is_ec")),
                    is_pf=bool(course.get("is_pf")),
                    recommended_semester=course.get("recommended_semester"),
                    description=course.get("description"),
                    description_sections=course.get("description_sections") or {},
                    description_source=course.get("description_source"),
                    description_page=course.get("description_page"),
                )
            )
        for edge in valid:
            db.add(
                models.CoursePrereq(
                    before=edge["before"],
                    after=edge["after"],
                    alternative=bool(edge.get("alternative")),
                )
            )
        db.commit()
        print(f"\n과목 {len(by_name)}개, 선수관계 {len(valid)}개를 저장했습니다.")
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
