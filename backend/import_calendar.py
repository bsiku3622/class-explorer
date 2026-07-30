"""
`calendar_seed.json` → `calendar_events` 적재.

    python -m backend.import_calendar --dry-run   # 결과만 확인
    python -m backend.import_calendar             # 저장

**PDF 에서 온 일정만 갈아끼웁니다** (`source='pdf'`). 개정판이 나오면 다시 돌리면
되고, 사람이 손으로 넣은 일정과 개인 일정은 건드리지 않습니다 — 그러라고 `source`를
둔 것입니다.
"""
from __future__ import annotations

import datetime
import json
import os
import sys

from backend.database import SessionLocal, init_schema
from backend import models

SEED_PATH = os.path.join(os.path.dirname(__file__), "calendar_seed.json")


def load_seed() -> list[dict]:
    with open(SEED_PATH, encoding="utf-8") as f:
        return json.load(f)["events"]


def run(dry_run: bool = False) -> None:
    init_schema()
    events = load_seed()
    db = SessionLocal()
    try:
        existing = (
            db.query(models.CalendarEvent)
            .filter(models.CalendarEvent.source == "pdf")
            .count()
        )
        by_category: dict[str, int] = {}
        for e in events:
            by_category[e["category"]] = by_category.get(e["category"], 0) + 1

        print(f"seed {len(events)}건 · 이미 들어 있는 pdf 일정 {existing}건")
        for name, count in sorted(by_category.items(), key=lambda kv: -kv[1]):
            print(f"  {name:<9} {count}")
        if dry_run:
            print("\n--dry-run 이라 저장하지 않았습니다.")
            return

        db.query(models.CalendarEvent).filter(
            models.CalendarEvent.source == "pdf"
        ).delete(synchronize_session=False)

        for e in events:
            grades = e.get("target_grades") or []
            db.add(
                models.CalendarEvent(
                    title=e["title"],
                    start_date=datetime.date.fromisoformat(e["start_date"]),
                    end_date=datetime.date.fromisoformat(e["end_date"]),
                    time_mode="allday",
                    category=e["category"],
                    target_grades=",".join(str(g) for g in grades) or None,
                    source="pdf",
                    owner_id=None,
                )
            )
        db.commit()
        print(f"\n저장했습니다 — pdf 일정 {existing}건을 지우고 {len(events)}건을 넣었습니다.")
    finally:
        db.close()


if __name__ == "__main__":
    run(dry_run="--dry-run" in sys.argv)
