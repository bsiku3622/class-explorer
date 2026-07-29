"""
SweetZamong 교육과정 DB에서 과목별 학점을 가져옵니다.

    python -m backend.import_credits
    python -m backend.import_credits --source /path/to/sweet_zamong.db
    python -m backend.import_credits --dry-run          # 저장하지 않고 매칭 결과만 확인

KEIS 시간표 API에는 학점이 없어서, 교육과정 정보를 따로 관리하는
SweetZamong 쪽 `courses` 테이블을 정본으로 씁니다.

## 과목명 매칭
양쪽 표기가 다릅니다.

    class-explorer : "미적분학2(EC)(Calculus2(EC))"   ← KEIS 원문, 영문 병기
    SweetZamong    : "미적분학2(EC)"                   ← EC 태그는 이름에 포함

그래서 뒤쪽 영문 괄호를 균형 맞춰 떼어낸 뒤, EC 태그를 붙였다 뗐다 하며 맞춰봅니다.
EC/일반 분반이 따로 열리는 과목(미적분학2, 선형대수 등)은 교육과정상 같은 과목이라
학점도 같게 봅니다.
"""

import argparse
import json
import os
import sqlite3
from dataclasses import dataclass

from sqlalchemy.orm import Session

from backend import models
from backend.database import SessionLocal, init_schema

DEFAULT_SOURCE = os.path.expanduser(
    "~/Projects/Side Projects/SweetZamong/backend/sweet_zamong.db"
)


@dataclass
class Course:
    name: str
    credits: float
    ap_credits: float
    is_ec: bool
    is_pf: bool


def strip_trailing_parens(name: str) -> str:
    """
    맨 뒤 괄호 묶음을 괄호 균형을 맞춰 떼어냅니다.
    정규식으로는 "(EC)(Calculus2(EC))" 같은 중첩을 다루기 어렵습니다.

    >>> strip_trailing_parens("미적분학2(EC)(Calculus2(EC))")
    '미적분학2(EC)'
    >>> strip_trailing_parens("화학특강(센서화학)(Special Topics in Chemistry )")
    '화학특강(센서화학)'
    """
    text = name.strip()
    if not text.endswith(")"):
        return text
    depth = 0
    for i in range(len(text) - 1, -1, -1):
        if text[i] == ")":
            depth += 1
        elif text[i] == "(":
            depth -= 1
            if depth == 0:
                return text[:i].strip()
    return text


def candidate_names(subject: str) -> list[str]:
    """과목명 하나에서 시도해볼 이름 후보를 우선순위대로 만듭니다."""
    seen: list[str] = []

    def add(value: str) -> None:
        value = value.strip()
        if value and value not in seen:
            seen.append(value)

    add(subject)
    base = strip_trailing_parens(subject)
    add(base)

    # EC 태그를 떼거나 붙여서도 찾아봅니다 — 같은 과목의 EC/일반 분반
    without_ec = base.replace("(EC)", "").strip()
    add(without_ec)
    if not base.endswith("(EC)"):
        add(f"{without_ec}(EC)")

    # "화학특강(센서화학)" → "화학특강" 처럼 부제까지 떼어낸 형태
    trimmed = strip_trailing_parens(without_ec)
    add(trimmed)
    if not trimmed.endswith("(EC)"):
        add(f"{trimmed}(EC)")

    return seen


def load_courses(source: str) -> dict[str, Course]:
    if not os.path.exists(source):
        raise SystemExit(f"SweetZamong DB를 찾을 수 없습니다: {source}")

    conn = sqlite3.connect(source)
    courses: dict[str, Course] = {}
    rows = conn.execute(
        "SELECT name, english_name, credits, ap_credits, is_ec, is_pf, aliases FROM courses"
    )
    for name, english, credits, ap_credits, is_ec, is_pf, aliases in rows:
        course = Course(
            name=name,
            credits=float(credits or 0),
            ap_credits=float(ap_credits or 0),
            is_ec=bool(is_ec),
            is_pf=bool(is_pf),
        )
        courses[name] = course
        # 영문명·별칭으로도 찾을 수 있게 (이름이 겹치면 원래 이름 우선)
        for key in filter(None, [english, *(json.loads(aliases or "[]"))]):
            courses.setdefault(key, course)
    conn.close()
    return courses


def match(subject: str, courses: dict[str, Course]) -> Course | None:
    for candidate in candidate_names(subject):
        found = courses.get(candidate)
        if found:
            return found
    return None


def run(source: str, dry_run: bool) -> int:
    courses = load_courses(source)
    db: Session = SessionLocal()
    try:
        subjects = [row[0] for row in db.query(models.Class.subject).distinct().all()]
        matched: list[tuple[str, Course]] = []
        missing: list[str] = []

        for subject in sorted(subjects):
            found = match(subject, courses)
            if found:
                matched.append((subject, found))
            else:
                missing.append(subject)

        print(f"과목 {len(subjects)}개 중 {len(matched)}개 매칭, {len(missing)}개 실패")
        if missing:
            print("\n[매칭 실패 — 학점 없음으로 남습니다]")
            for subject in missing:
                print(f"  {subject}")

        if dry_run:
            print("\n--dry-run: 저장하지 않았습니다.")
            return 0

        db.query(models.SubjectCredit).delete()
        for subject, course in matched:
            db.add(
                models.SubjectCredit(
                    subject=subject,
                    credits=course.credits,
                    ap_credits=course.ap_credits,
                    is_ec=course.is_ec,
                    is_pf=course.is_pf,
                    matched_name=course.name,
                )
            )
        db.commit()
        print(f"\n{len(matched)}개 과목의 학점을 저장했습니다.")
        return 0
    finally:
        db.close()


def main() -> int:
    ap = argparse.ArgumentParser(description="SweetZamong에서 과목 학점 가져오기")
    ap.add_argument("--source", default=DEFAULT_SOURCE, help="SweetZamong sqlite 경로")
    ap.add_argument("--dry-run", action="store_true", help="저장 없이 매칭 결과만 출력")
    args = ap.parse_args()

    init_schema()
    return run(args.source, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
