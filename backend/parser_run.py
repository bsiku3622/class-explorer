"""
KEIS 시간표 API에서 학기 단위로 시간표를 수집해 DB에 반영합니다.

    python -m backend.parser_run                      # 현재 학기 자동 판별
    python -m backend.parser_run --year 2026 --semester 2
    python -m backend.parser_run -y 2026 -s 2 --prune # 데이터 없는 학생을 students.txt에서 제거
    python -m backend.parser_run --no-backup          # 반영 직전 스냅샷 생략

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

from backend import backup, models, parser
from backend.database import SessionLocal, init_schema
from backend.subject_names import match_course, split_name
from backend.terms import current_term
from backend.versioning import at_version, current_version, record_version

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


# ───────────── 변경 판정 ─────────────
def _label(name: str, is_ec: bool, section: str, teacher: str) -> str:
    return f"{name}{'(EC)' if is_ec else ''} · {section} · {teacher}"


TermState = tuple[
    dict[tuple, str],                     # 분반 → 대표 강의실
    dict[tuple, set[tuple[str, int, str]]],  # 분반 → {(요일, 교시, 교실)}
    set[tuple[str, tuple]],               # {(학번, 분반)}
]


def desired_state(fetched: dict[str, list[parser.ParsedClass]]) -> TermState:
    """
    수집 결과를 비교 가능한 모양으로 펼칩니다.

    분반을 id 가 아니라 `(과목명, EC여부, 분반, 교사)` 로 잡습니다 — 아직 DB 를 건드리기
    전이라 id 가 없고, 무엇보다 **정말 바뀌었는지 확인하기 전에는 아무것도 쓰지 않으려는**
    것이 이 함수가 있는 이유입니다.
    """
    rooms: dict[tuple, str] = {}
    times: dict[tuple, set[tuple[str, int, str]]] = {}
    enrolled: set[tuple[str, tuple]] = set()

    for stu_id, parsed_classes in fetched.items():
        for pc in parsed_classes:
            name, _english, is_ec = split_name(pc["subject"])
            key = (name, is_ec, pc["section"], pc["teacher"])
            rooms.setdefault(key, pc["room"])
            slot = times.setdefault(key, set())
            for t in pc["times"]:
                slot.add((t["day"], t["period"], t["room"]))
            enrolled.add((stu_id, key))

    return rooms, times, enrolled


def live_state(db: Session, year: int, semester: int) -> TermState:
    """지금 열려 있는 행들을 같은 모양으로 뽑습니다."""
    rows = (
        db.query(
            models.Class.id,
            models.Subject.name,
            models.Subject.is_ec,
            models.Class.section,
            models.Class.teacher,
            models.Class.room,
        )
        .join(models.Subject, models.Subject.id == models.Class.subject_id)
        .filter(models.Class.year == year, models.Class.semester == semester)
        .filter(at_version(models.Class))
        .all()
    )
    by_id: dict[int, tuple] = {}
    rooms: dict[tuple, str] = {}
    for cid, name, is_ec, section, teacher, room in rows:
        key = (name, bool(is_ec), section, teacher)
        by_id[cid] = key
        rooms[key] = room

    times: dict[tuple, set[tuple[str, int, str]]] = {key: set() for key in rooms}
    if by_id:
        for cid, day, period, room in (
            db.query(
                models.ClassTime.class_id,
                models.ClassTime.day,
                models.ClassTime.period,
                models.ClassTime.room,
            )
            .filter(models.ClassTime.class_id.in_(by_id.keys()))
            .filter(at_version(models.ClassTime))
            .all()
        ):
            times[by_id[cid]].add((day, period, room))

    enrolled: set[tuple[str, tuple]] = set()
    if by_id:
        for stu_id, cid in (
            db.query(models.Enrollment.stuId, models.Enrollment.classId)
            .filter(models.Enrollment.classId.in_(by_id.keys()))
            .filter(at_version(models.Enrollment))
            .all()
        ):
            enrolled.add((stu_id, by_id[cid]))

    return rooms, times, enrolled


def diff_terms(before: TermState, after: TermState, student_changes: dict) -> dict:
    """
    두 상태의 차이를 사람이 읽을 수 있게 정리합니다.

    **개인 이름은 담지 않습니다.** 관리자만 보는 화면이라도 명단이 새는 통로를 하나 더
    만들 이유가 없습니다 — 분반별 인원 증감까지만 적습니다.
    """
    old_rooms, old_times, old_enr = before
    new_rooms, new_times, new_enr = after

    added = sorted(set(new_rooms) - set(old_rooms))
    removed = sorted(set(old_rooms) - set(new_rooms))
    kept = set(new_rooms) & set(old_rooms)

    # 담당 교사만 바뀐 분반은 "폐강 + 신설" 로 보입니다. 분반을 `(과목, EC, 분반, 교사)`
    # 로 잡기 때문인데, 이게 틀린 건 아닙니다 — 교사가 다르면 DB 에서도 다른 행입니다.
    # 다만 읽는 사람에게는 한 사건이라 짝을 지어 따로 적습니다
    by_section = {(name, ec, sec): teacher for name, ec, sec, teacher in removed}
    swapped: list[dict] = []
    for key in list(added):
        name, ec, sec, teacher = key
        old_teacher = by_section.get((name, ec, sec))
        if old_teacher is not None and old_teacher != teacher:
            swapped.append({
                "class": f"{name}{'(EC)' if ec else ''} · {sec}",
                "from": old_teacher,
                "to": teacher,
            })
            added.remove(key)
            removed.remove((name, ec, sec, old_teacher))

    moved = [
        {"class": _label(*key), "from": old_rooms[key], "to": new_rooms[key]}
        for key in sorted(kept)
        if old_rooms[key] != new_rooms[key]
    ]

    time_added = sum(len(new_times.get(k, set()) - old_times.get(k, set())) for k in set(new_times) | set(old_times))
    time_removed = sum(len(old_times.get(k, set()) - new_times.get(k, set())) for k in set(new_times) | set(old_times))

    enr_added = new_enr - old_enr
    enr_removed = old_enr - new_enr

    delta: dict[tuple, int] = {}
    for _stu, key in enr_added:
        delta[key] = delta.get(key, 0) + 1
    for _stu, key in enr_removed:
        delta[key] = delta.get(key, 0) - 1
    top = sorted(
        ({"class": _label(*k), "delta": v} for k, v in delta.items() if v),
        key=lambda item: abs(item["delta"]),
        reverse=True,
    )[:20]

    changed = bool(
        added or removed or swapped or moved or time_added or time_removed
        or enr_added or enr_removed
        or student_changes.get("new") or student_changes.get("renamed")
    )

    return {
        "changed": changed,
        "classes": {
            "added": [_label(*k) for k in added],
            "removed": [_label(*k) for k in removed],
            "moved": moved,
            "swapped": swapped,
            "kept": len(kept),
        },
        "times": {"added": time_added, "removed": time_removed},
        "enrollments": {
            "added": len(enr_added),
            "removed": len(enr_removed),
            "by_class": top,
        },
        "students": student_changes,
    }


def plan_student_changes(db: Session, students: dict[str, str]) -> dict:
    """학생 마스터에 생길 변화 — 쓰기 전에 세어만 둡니다."""
    existing = {row[0]: row[1] for row in db.query(models.Student.stuId, models.Student.name).all()}
    new = [sid for sid in students if sid not in existing]
    renamed = [
        sid for sid, name in students.items()
        if sid in existing and existing[sid] != name and name != UNKNOWN_NAME
    ]
    return {"new": len(new), "renamed": len(renamed)}


# ───────────── DB 반영 ─────────────
def replace_term_data(
    db: Session,
    year: int,
    semester: int,
    students: dict[str, str],
    fetched: dict[str, list[parser.ParsedClass]],
    version: int,
) -> None:
    """
    해당 학기를 `version` 회차로 올립니다.

    ⚠️ **아무것도 지우지 않습니다.** 없어진 분반·시간·수강은 `version_to` 를 찍어 닫을
    뿐입니다. 그래서 지난 회차를 그대로 다시 열어 볼 수 있고, Trade 계획이 가리키는
    분반 id 도 폐강 이후까지 살아남습니다.

    `Class` 행은 `(subject_id, section, teacher)` 로 찾아 **재사용**합니다. 재수집마다
    id 가 새로 매겨지면 그 id 를 들고 있는 저장물이 조용히 어긋나기 때문입니다.
    대표 강의실만은 제자리에서 고칩니다 — 교실 이력은 `ClassTime` 이 들고 있고,
    여기서 행을 새로 만들면 id 를 지키는 의미가 없어집니다.
    """
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

    old_classes = {
        (cls.subject_id, cls.section, cls.teacher): cls
        for cls in db.query(models.Class)
        .filter(models.Class.year == year, models.Class.semester == semester)
        .filter(at_version(models.Class))
        .all()
    }

    # 이번 수집에 있는 분반 — 있던 것은 id 를 지키고, 없던 것만 새로 엽니다
    class_ids: dict[tuple[int, str, str], int] = {}
    wanted_rooms: dict[tuple[int, str, str], str] = {}
    wanted_times: dict[tuple[int, str, str], set[tuple[str, int, str]]] = {}
    wanted_enr: set[tuple[str, tuple[int, str, str]]] = set()

    for stu_id, parsed_classes in fetched.items():
        for pc in parsed_classes:
            key = (subject_ids[pc["subject"]], pc["section"], pc["teacher"])
            wanted_rooms.setdefault(key, pc["room"])
            slot = wanted_times.setdefault(key, set())
            for t in pc["times"]:
                slot.add((t["day"], t["period"], t["room"]))
            wanted_enr.add((stu_id, key))

    for key, room in wanted_rooms.items():
        cls = old_classes.get(key)
        if cls is None:
            cls = models.Class(
                subject_id=key[0], section=key[1], teacher=key[2], room=room,
                year=year, semester=semester,
                version_from=version, version_to=None,
            )
            db.add(cls)
            db.flush()
        elif cls.room != room:
            cls.room = room
        class_ids[key] = cls.id

    # 이번 수집에 없는 분반은 폐강 — 행을 지우지 않고 닫습니다
    stale_ids = [cls.id for key, cls in old_classes.items() if key not in class_ids]
    if stale_ids:
        db.query(models.Class).filter(models.Class.id.in_(stale_ids)).update(
            {"version_to": version}, synchronize_session=False
        )

    live_ids = list(class_ids.values()) + stale_ids

    # ── 시간 ─────────────────────────────────────────────────────────────────
    open_times: dict[tuple[int, str, int, str], models.ClassTime] = {}
    if live_ids:
        for row in (
            db.query(models.ClassTime)
            .filter(models.ClassTime.class_id.in_(live_ids))
            .filter(at_version(models.ClassTime))
            .all()
        ):
            open_times[(row.class_id, row.day, row.period, row.room)] = row

    wanted_time_rows = {
        (class_ids[key], day, period, room)
        for key, slots in wanted_times.items()
        for day, period, room in slots
    }
    for ident, row in open_times.items():
        if ident not in wanted_time_rows:
            row.version_to = version
    for cid, day, period, room in sorted(wanted_time_rows - set(open_times)):
        db.add(models.ClassTime(
            class_id=cid, day=day, period=period, room=room,
            version_from=version, version_to=None,
        ))

    # ── 수강 ─────────────────────────────────────────────────────────────────
    open_enr: dict[tuple[str, int], models.Enrollment] = {}
    if live_ids:
        for row in (
            db.query(models.Enrollment)
            .filter(models.Enrollment.classId.in_(live_ids))
            .filter(at_version(models.Enrollment))
            .all()
        ):
            open_enr[(row.stuId, row.classId)] = row

    wanted_enr_rows = {(stu_id, class_ids[key]) for stu_id, key in wanted_enr}
    for ident, row in open_enr.items():
        if ident not in wanted_enr_rows:
            row.version_to = version
    for stu_id, cid in sorted(wanted_enr_rows - set(open_enr)):
        db.add(models.Enrollment(
            stuId=stu_id, classId=cid, version_from=version, version_to=None,
        ))

    reused = len(class_ids) - sum(1 for key in class_ids if key not in old_classes)
    print(
        f"분반: 유지 {reused} · 신설 {len(class_ids) - reused} · 폐강 {len(stale_ids)}"
        f"  (v{version})"
    )


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
async def run(year: int, semester: int, prune: bool, make_backup: bool = True) -> int:
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

    # ── 정말 바뀌었는지 먼저 봅니다 ──────────────────────────────────────────
    #
    # 여기서 백업도 회차도 갈립니다. 8월 11일부터 19일까지 서버에 백업 다섯 개가 쌓여
    # 있었는데 내용이 전부 같았습니다 — "돌렸으니 남긴다" 의 결과입니다. 바뀐 게 없으면
    # 아무것도 남기지 않습니다. 이 판정은 읽기만 하므로 DB 를 건드리지 않습니다.
    probe: Session = SessionLocal()
    try:
        before = live_state(probe, year, semester)
        student_changes = plan_student_changes(probe, students)
        version = current_version(probe, year, semester) + 1
    finally:
        probe.close()

    summary = diff_terms(before, desired_state(fetched), student_changes)

    backup_name = ""
    if summary["changed"]:
        # 갈아 끼우기 직전 상태를 통째로 남깁니다. 백업을 못 만들면 수집을 접습니다 —
        # 되돌릴 곳 없이 한 학기를 덮어쓰는 쪽이 더 위험합니다 (`--no-backup` 으로 생략)
        if make_backup:
            try:
                info = backup.create_backup(f"sync-{year}-{semester}-v{version}")
            except OSError as e:
                print(f"Error: 백업 실패({e}). DB를 건드리지 않고 종료합니다.")
                return 1
            if info:
                backup_name = info["name"]
                print(f"백업: {info['name']} ({info['bytes'] / 1_048_576:.1f} MB)")

        db: Session = SessionLocal()
        try:
            replace_term_data(db, year, semester, students, fetched, version)
            record_version(
                db, year, semester, "sync",
                summary=summary,
                stats={
                    "synced": len(fetched),
                    "skipped": len(skipped),
                    "errors": len(errors),
                    "elapsed": f"{time.time() - start:.1f}s",
                    "backup": backup_name,
                },
            )
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"[!] DB 반영 실패: {e}")
            return 1
        finally:
            db.close()
    else:
        version -= 1
        print(f"직전 회차(v{version})와 같습니다 — DB·백업 모두 그대로 둡니다.")

    if prune and skipped:
        keep = {sid: name for sid, name in students.items() if sid not in skipped}
        with open(STUDENTS_TXT, "w", encoding="utf-8") as f:
            f.write("\n".join(f"{sid} {name}" for sid, name in keep.items()) + "\n")
        print(f"students.txt 정리: {len(skipped)}명 제거")

    elapsed = time.time() - start
    print("-" * 30)
    print(
        f"SYNC_RESULT synced={len(fetched)} skipped={len(skipped)} "
        f"errors={len(errors)} elapsed={elapsed:.1f}s backup={backup_name or '-'} "
        f"version={version} changed={1 if summary['changed'] else 0}"
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
    ap.add_argument(
        "--no-backup", action="store_true",
        help="반영 직전 DB 스냅샷을 만들지 않음",
    )
    args = ap.parse_args()

    return asyncio.run(run(args.year, args.semester, args.prune, not args.no_backup))


if __name__ == "__main__":
    raise SystemExit(main())
