"""
KEIS 시간표 API에서 학기 단위로 시간표를 수집해 DB에 반영합니다.

    python -m backend.parser_run                      # 현재 학기 자동 판별
    python -m backend.parser_run --year 2026 --semester 2
    python -m backend.parser_run -y 2026 -s 2 --prune # 데이터 없는 학생을 students.txt에서 제거

수집은 학기 단위로 원자적입니다. 모든 학생의 응답을 받아온 뒤에야 해당 학기 데이터를
지우고 새로 넣기 때문에, 다른 학기 데이터와 수집 도중 실패에 영향받지 않습니다.
"""

import argparse
import asyncio
import os
import time
from typing import Any

import httpx
from sqlalchemy.orm import Session

from backend import models, parser
from backend.database import SessionLocal, init_schema
from backend.subject_names import match_course, split_name
from backend.terms import current_term

API_BASE = "https://keis.ksa.hs.kr/restapi/v1/schedule"
STUDENTS_TXT = os.path.join(os.path.dirname(__file__), "students.txt")

# 이름을 아직 모르는 학생. 이 값으로는 이미 알고 있는 이름을 덮어쓰지 않습니다
UNKNOWN_NAME = "Unknown"

MAX_CONCURRENT_REQUESTS = 20
REQUEST_TIMEOUT = 15.0
MAX_RETRIES = 2

init_schema()


# ───────────── 수집 ─────────────
async def fetch_student(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    stu_id: str,
    year: int,
    semester: int,
) -> tuple[str, list[parser.ParsedClass] | None]:
    """한 학생의 시간표를 가져옵니다. 실패 시 두 번째 값이 None."""
    url = f"{API_BASE}/{stu_id}/{year}/{semester}"

    async with semaphore:
        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await client.get(url, timeout=REQUEST_TIMEOUT)
                if response.status_code != 200:
                    return stu_id, None
                return stu_id, parser.parse_schedule(response.text)
            except (httpx.TimeoutException, httpx.TransportError) as e:
                if attempt == MAX_RETRIES:
                    print(f"[!] {stu_id} 요청 실패: {e}")
                    return stu_id, None
                await asyncio.sleep(0.5 * (attempt + 1))

    return stu_id, None


# ───────────── DB 반영 ─────────────
def resolve_subject(db: Session, raw: str, courses: dict[str, int]) -> int:
    """
    KEIS 과목명에 해당하는 `Subject` 행을 찾거나 만들어 id를 돌려줍니다.

    같은 과목이라도 영어강의(EC)와 한국어강의는 별개 행입니다 — 실제로 따로
    개설되고 수강생도 다릅니다. 반면 영문 표기가 학기마다 흔들리는 것(`Physics &
    Exp.1` → `Physics and Exp.1`)은 같은 과목이므로, `(name, is_ec)`로 찾고
    원문은 최근 값으로 갱신합니다.
    """
    name, english, is_ec = split_name(raw)

    subject = (
        db.query(models.Subject)
        .filter(models.Subject.name == name, models.Subject.is_ec == is_ec)
        .first()
    )
    if subject is not None:
        if subject.name_raw != raw:
            subject.name_raw = raw
        if english and subject.name_english != english:
            subject.name_english = english
        # 교육과정이 나중에 들어와 이제 이어지는 경우
        if subject.course_id is None:
            matched = match_course(name, courses)
            if matched:
                subject.course_id = courses[matched]
        return subject.id

    matched = match_course(name, courses)
    subject = models.Subject(
        course_id=courses[matched] if matched else None,
        name=name,
        name_english=english,
        name_raw=raw,
        is_ec=is_ec,
    )
    db.add(subject)
    db.flush()
    return subject.id


def replace_term_data(
    db: Session,
    year: int,
    semester: int,
    students: dict[str, str],
    fetched: dict[str, list[parser.ParsedClass]],
) -> None:
    """
    해당 학기의 수업/시간/수강 데이터를 통째로 교체합니다.
    Student 레코드는 다른 학기가 참조할 수 있으므로 삭제하지 않습니다.
    """
    old_class_ids = [
        row[0]
        for row in db.query(models.Class.id)
        .filter(models.Class.year == year, models.Class.semester == semester)
        .all()
    ]

    if old_class_ids:
        db.query(models.Enrollment).filter(
            models.Enrollment.classId.in_(old_class_ids)
        ).delete(synchronize_session=False)
        db.query(models.ClassTime).filter(
            models.ClassTime.class_id.in_(old_class_ids)
        ).delete(synchronize_session=False)
        db.query(models.Class).filter(
            models.Class.id.in_(old_class_ids)
        ).delete(synchronize_session=False)

    # 학생 마스터 갱신 (신규만 추가, 이름은 최신 목록 기준)
    #
    # 이름을 모르는 명단(과거 학기 학번은 API로 긁어와서 이름이 없습니다)으로 수집할 때
    # 이미 알고 있는 이름을 UNKNOWN_NAME 으로 덮어쓰면 안 됩니다.
    existing = {row[0]: row[1] for row in db.query(models.Student.stuId, models.Student.name).all()}
    for stu_id, name in students.items():
        if stu_id not in existing:
            db.add(models.Student(stuId=stu_id, name=name))
        elif existing[stu_id] != name and name != UNKNOWN_NAME:
            db.query(models.Student).filter(models.Student.stuId == stu_id).update({"name": name})
    db.flush()

    # 과목명 → Subject. 학기마다 새로 만들지 않고 이미 있는 행을 재사용합니다
    courses = {name: cid for name, cid in db.query(models.Course.name, models.Course.id).all()}
    subject_ids: dict[str, int] = {}
    for parsed_classes in fetched.values():
        for pc in parsed_classes:
            if pc["subject"] not in subject_ids:
                subject_ids[pc["subject"]] = resolve_subject(db, pc["subject"], courses)
    db.flush()

    # 수업 등록 — 동일 (과목, 분반, 교사) 는 학기 안에서 하나로 합쳐집니다
    class_ids: dict[tuple[int, str, str], Any] = {}
    for stu_id, parsed_classes in fetched.items():
        for pc in parsed_classes:
            key = (subject_ids[pc["subject"]], pc["section"], pc["teacher"])
            if key in class_ids:
                continue

            cls = models.Class(
                subject_id=subject_ids[pc["subject"]],
                section=pc["section"],
                teacher=pc["teacher"],
                room=pc["room"],
                year=year,
                semester=semester,
            )
            db.add(cls)
            db.flush()
            class_ids[key] = cls.id

            db.add_all(
                models.ClassTime(
                    day=t["day"], period=t["period"], room=t["room"], class_id=cls.id
                )
                for t in pc["times"]
            )

    # 수강 등록
    for stu_id, parsed_classes in fetched.items():
        seen: set[int] = set()
        for pc in parsed_classes:
            class_id = class_ids[(subject_ids[pc["subject"]], pc["section"], pc["teacher"])]
            if class_id in seen:
                continue
            seen.add(class_id)
            db.add(models.Enrollment(stuId=stu_id, classId=class_id))

    db.commit()


# ───────────── 학생 목록 ─────────────
def load_students(path: str) -> dict[str, str]:
    students: dict[str, str] = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split(maxsplit=1)
            students[parts[0]] = parts[1] if len(parts) == 2 else "Unknown"
    return students


# ───────────── 엔트리포인트 ─────────────
async def run(year: int, semester: int, prune: bool) -> int:
    if not os.path.exists(STUDENTS_TXT):
        print(f"Error: {STUDENTS_TXT} 파일이 존재하지 않습니다.")
        return 1

    students = load_students(STUDENTS_TXT)
    if not students:
        print("Error: students.txt 가 비어 있습니다.")
        return 1

    start = time.time()
    print(f"{year}-{semester} · {len(students)}명 수집 시작 (동시성 {MAX_CONCURRENT_REQUESTS})...")

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *(fetch_student(client, semaphore, sid, year, semester) for sid in students)
        )

    fetched: dict[str, list[parser.ParsedClass]] = {}
    skipped: list[str] = []
    errors: list[str] = []

    for stu_id, parsed_classes in results:
        if parsed_classes is None:
            errors.append(stu_id)
        elif not parsed_classes:
            skipped.append(stu_id)
        else:
            fetched[stu_id] = parsed_classes

    if not fetched:
        print("Error: 수집된 시간표가 없습니다. DB를 건드리지 않고 종료합니다.")
        return 1

    # 응답을 못 받은 학생이 절반을 넘으면 API 장애로 보고 중단합니다
    if len(errors) > len(students) // 2:
        print(f"Error: 요청 실패 {len(errors)}건으로 과반 초과. DB를 건드리지 않고 종료합니다.")
        return 1

    db: Session = SessionLocal()
    try:
        replace_term_data(db, year, semester, students, fetched)
    except Exception as e:
        db.rollback()
        print(f"[!] DB 반영 실패: {e}")
        return 1
    finally:
        db.close()

    if prune and skipped:
        keep = {sid: name for sid, name in students.items() if sid not in skipped}
        with open(STUDENTS_TXT, "w", encoding="utf-8") as f:
            f.write("\n".join(f"{sid} {name}" for sid, name in keep.items()) + "\n")
        print(f"students.txt 정리: {len(skipped)}명 제거")

    elapsed = time.time() - start
    print("-" * 30)
    print(
        f"SYNC_RESULT synced={len(fetched)} skipped={len(skipped)} "
        f"errors={len(errors)} elapsed={elapsed:.1f}s"
    )
    print("-" * 30)
    return 0


def main() -> int:
    default_year, default_semester = current_term()

    ap = argparse.ArgumentParser(description="KEIS 시간표 학기별 동기화")
    ap.add_argument("-y", "--year", type=int, default=int(os.environ.get("SYNC_YEAR", default_year)))
    ap.add_argument(
        "-s", "--semester", type=int, choices=[1, 2],
        default=int(os.environ.get("SYNC_SEMESTER", default_semester)),
    )
    ap.add_argument(
        "--prune", action="store_true",
        help="해당 학기에 시간표가 없는 학생을 students.txt 에서 제거",
    )
    args = ap.parse_args()

    return asyncio.run(run(args.year, args.semester, args.prune))


if __name__ == "__main__":
    raise SystemExit(main())
