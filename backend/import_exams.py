"""정규화한 시험 공지와 비공개 응시 명단을 DB에 원자적으로 적재합니다."""
from __future__ import annotations
import argparse
import datetime
import json
from pathlib import Path
import re
import unicodedata
from sqlalchemy.orm import joinedload
from backend import models
from backend.backup import create_backup
from backend.database import SessionLocal, init_schema
from backend.versioning import at_version

SEED_PATH = Path(__file__).with_name("exam_seed.json")


def _name(value: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", value))


def _room(exam: dict, cls: models.Class | None) -> str | None:
    rules = exam["room_rules"]
    all_rooms = {rule["room"] for rule in rules}
    if len(all_rooms) == 1:
        return next(iter(all_rooms))
    if cls is None:
        return None
    section = re.search(r"\d+", cls.section or "")
    if not section:
        return None
    rooms = {
        rule["room"] for rule in rules
        if (rule["is_ec"] is None or rule["is_ec"] == cls.subject.is_ec)
        and (not rule["sections"] or section[0] in rule["sections"])
    }
    return next(iter(rooms)) if len(rooms) == 1 else None


def run(seed_path: Path, registrations_path: Path, dry_run: bool = False) -> None:
    seed = json.loads(seed_path.read_text(encoding="utf-8"))
    roster = json.loads(registrations_path.read_text(encoding="utf-8"))
    period = seed["period"]
    if roster["period_key"] != period["key"]:
        raise ValueError("시험 회차가 일치하지 않습니다")
    memberships = roster["registrations"]
    keys = [e["key"] for e in seed["exams"]]
    if len(keys) != len(set(keys)) or set(keys) != set(memberships):
        raise ValueError("시험 키와 응시 명단이 일치하지 않습니다")
    dates = {key: datetime.date.fromisoformat(period[key]) for key in (
        "start_date", "end_date", "visible_from", "visible_until"
    )}
    if dates["start_date"] > dates["end_date"] or dates["visible_from"] > dates["visible_until"]:
        raise ValueError("기간의 시작은 종료보다 빨라야 합니다")
    for exam in seed["exams"]:
        if exam["date"] is not None:
            day = datetime.date.fromisoformat(exam["date"])
            if not dates["start_date"] <= day <= dates["end_date"]:
                raise ValueError(f"시험 날짜가 회차 기간 밖입니다: {exam['key']}")
            if not 0 <= exam["start_minute"] < exam["end_minute"] <= 1440:
                raise ValueError(f"시험 시각이 잘못되었습니다: {exam['key']}")
        elif not exam["note"] or exam["start_minute"] is not None or exam["end_minute"] is not None:
            raise ValueError("별도 실시 시험은 시각 없이 안내문을 저장해야 합니다")
        if not memberships[exam["key"]] or len(memberships[exam["key"]]) != len(set(memberships[exam["key"]])):
            raise ValueError(f"빈 명단 또는 중복 응시자: {exam['key']}")

    init_schema()
    db = SessionLocal()
    try:
        student_ids = {s for group in memberships.values() for s in group}
        known = {s[0] for s in db.query(models.Student.stuId).filter(models.Student.stuId.in_(student_ids))}
        if student_ids != known:
            raise ValueError(f"DB에 없는 학번 {len(student_ids - known)}개 — 저장하지 않았습니다")
        rows = db.query(models.Enrollment.stuId, models.Class).join(
            models.Class, models.Class.id == models.Enrollment.classId
        ).filter(
            models.Class.year == period["year"], models.Class.semester == period["semester"],
            at_version(models.Class), at_version(models.Enrollment),
        ).options(joinedload(models.Class.subject)).all()
        by_student: dict[str, list[models.Class]] = {}
        for stu_id, cls in rows:
            by_student.setdefault(stu_id, []).append(cls)

        prepared = []
        unresolved = 0
        unlinked = 0
        for exam in seed["exams"]:
            for stu_id in memberships[exam["key"]]:
                candidates = [cls for cls in by_student.get(stu_id, [])
                    if _name(cls.subject.name) == _name(exam["subject_name"])
                    and (exam["is_ec"] is None or cls.subject.is_ec == exam["is_ec"])]
                cls = candidates[0] if len(candidates) == 1 else None
                room = _room(exam, cls)
                unlinked += cls is None
                unresolved += exam["date"] is not None and room is None
                prepared.append((exam["key"], stu_id, cls.id if cls else None, room))
        print(json.dumps({
            "period": period["key"], "exams": len(keys), "students": len(student_ids),
            "registrations": len(prepared), "unlinked_classes": unlinked,
            "unresolved_rooms": unresolved, "dry_run": dry_run,
        }, ensure_ascii=False))
        if dry_run:
            return
        snapshot = create_backup(f"exams-{period['key']}")
        if not snapshot:
            raise RuntimeError("DB 백업을 만들지 못했습니다")
        row = db.query(models.ExamPeriod).filter_by(key=period["key"]).first()
        if row is None:
            row = models.ExamPeriod(key=period["key"])
            db.add(row)
        for key in ("year", "semester", "kind", "title", "source_name", "source_sha256"):
            setattr(row, key, period[key])
        for key, value in dates.items():
            setattr(row, key, value)
        db.flush()
        exam_ids = [r[0] for r in db.query(models.Exam.id).filter_by(period_id=row.id)]
        if exam_ids:
            db.query(models.ExamRegistration).filter(models.ExamRegistration.exam_id.in_(exam_ids)).delete(synchronize_session=False)
            db.query(models.Exam).filter_by(period_id=row.id).delete(synchronize_session=False)
        new_exams = {}
        for exam in seed["exams"]:
            record = models.Exam(
                period_id=row.id, source_key=exam["key"], subject=exam["subject"],
                subject_english=exam["subject_english"],
                date=datetime.date.fromisoformat(exam["date"]) if exam["date"] else None,
                start_minute=exam["start_minute"], end_minute=exam["end_minute"],
                source_rooms=exam["source_rooms"], room_rules=exam["room_rules"], note=exam["note"],
            )
            db.add(record)
            db.flush()
            new_exams[exam["key"]] = record.id
        db.add_all([models.ExamRegistration(exam_id=new_exams[key], stu_id=stu_id,
            class_id=class_id, room=room) for key, stu_id, class_id, room in prepared])
        db.commit()
        print(f"저장 완료 · 백업: {snapshot['name']}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=Path, default=SEED_PATH)
    parser.add_argument("--registrations", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    run(args.seed, args.registrations, args.dry_run)
