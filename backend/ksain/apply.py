"""분석된 일정 항목을 공용 학사일정에 자동으로 반영합니다 (`calendar_events.source='ksain'`).

글 하나에서 온 일정은 `source_ref = "<글 번호>:<순번>"` 으로 묶여서, 글이 바뀌거나 다시
분석되면 **그 글 것만** 지우고 새로 만듭니다. PDF·수동 일정은 건드리지 않습니다.

반영하는 항목:
- 모델이 `calendar=true` 로 고르고 확신도가 `MIN_CONFIDENCE` 이상
- 끝나는 날이 오늘에서 `KEEP_PAST_DAYS` 일 안쪽 (백필한 옛 글이 지난 일정을 쏟아내지 않게)
- 기간이 `MAX_SPAN_DAYS` 일 이하 (모집 기간 같은 긴 띠는 마감 하루로 들어와야 합니다)

건너뛰는 항목:
- 날짜가 겹치고 제목이 비슷한 공용 일정이 이미 있을 때 (학사일정 PDF, 다른 글)
- **사람이 지웠거나 고친 일정** — `Analysis.applied` 에 적어 둔 일정이 없어졌으면 그 항목의
  sig 를 `suppressed` 에 넣고 다시 만들지 않습니다. 고친 일정은 calendar_router 가
  `source='manual'` 로 바꿔 자동 관리에서 빼 줍니다

⚠️ `holiday`·`term` 분류는 쓰지 않습니다. 홈이 `holiday` 일정으로 그날 수업을 지우고,
`term` 의 개학·종업 표지로 방학을 판정합니다 — 모델 실수 하나로 전교생 시간표가 사라집니다.
"""
from __future__ import annotations

import datetime
import re

from backend import models as core
from backend.core import clock
from backend.knowledge import facts as memory
from backend.ksain.models import Analysis, Post

MIN_CONFIDENCE = 0.6
KEEP_PAST_DAYS = 14
MAX_SPAN_DAYS = 45
CATEGORIES = {"exam", "dorm", "academic", "event"}

def _norm(text: str) -> str:
    return re.sub(r"[\s\W_]+", "", (text or "").lower())


def similar(a: str, b: str) -> bool:
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    if na in nb or nb in na:
        return True
    grams_a = {na[i:i + 2] for i in range(len(na) - 1)} or {na}
    grams_b = {nb[i:i + 2] for i in range(len(nb) - 1)} or {nb}
    return len(grams_a & grams_b) / len(grams_a | grams_b) >= 0.5


# 날짜가 겹치는 두 일정이 이 말을 함께 쓰면 같은 일정입니다 ("12월 귀가" = "귀가(전학년)")
IDENTITY_WORDS = ("귀가", "귀교", "폐쇄", "개학", "종업", "방학", "중간고사", "기말고사", "수강신청", "수강정정",
                  "졸업", "입학", "축제", "체육대회")


def same_identity(a: str, b: str) -> bool:
    return any(word in a and word in b for word in IDENTITY_WORDS)


def signature(item: dict) -> str:
    return f"{item['start_date']}|{_norm(item['title'])}"


def _minutes(hhmm: str | None) -> int | None:
    if not hhmm:
        return None
    hour, minute = hhmm.split(":")
    return int(hour) * 60 + int(minute)


def desired(analysis: Analysis, today: datetime.date) -> list[dict]:
    out = []
    for item in analysis.items or []:
        if not item.get("calendar") or item.get("confidence", 0) < MIN_CONFIDENCE:
            continue
        # 날짜가 글에 실제로 적혀 있어야 합니다 (analyze.grounded — 모델이 지어낸 날짜 차단)
        if not item.get("grounded"):
            continue
        start = datetime.date.fromisoformat(item["start_date"])
        end = datetime.date.fromisoformat(item["end_date"])
        if end < today - datetime.timedelta(days=KEEP_PAST_DAYS) or (end - start).days > MAX_SPAN_DAYS:
            continue
        out.append(item)
    return out


def duplicate(db, item: dict, post_id: int) -> bool:
    start = datetime.date.fromisoformat(item["start_date"])
    end = datetime.date.fromisoformat(item["end_date"])
    rows = db.query(core.CalendarEvent).filter(
        core.CalendarEvent.owner_id.is_(None),
        core.CalendarEvent.start_date <= end,
        core.CalendarEvent.end_date >= start,
    ).all()
    for row in rows:
        if row.source == "ksain" and (row.source_ref or "").startswith(f"{post_id}:"):
            continue
        if similar(row.title, item["title"]):
            return True
        # 분류는 보지 않습니다 — 모델이 기말고사를 academic 으로 줘서 PDF 의 exam 일정과 겹쳐 들어갔습니다
        if same_identity(row.title, item["title"]):
            return True
        # "기말고사" 와 "2학기 기말고사 시작" 처럼 시험 기간은 이름이 달라도 같은 일정입니다
        if item["category"] == "exam" and row.category == "exam" and row.source != "ksain":
            return True
    return False


def _event(post: Post, item: dict, index: int) -> core.CalendarEvent:
    start_minute, end_minute = _minutes(item.get("start_time")), _minutes(item.get("end_time"))
    title = item["title"]
    # 마감은 "15:00 까지" 라 시간 블록으로 그리면 15:00–16:00 행사처럼 읽힙니다 — 종일 + 제목에 시각
    if item.get("kind") == "deadline" and start_minute is not None:
        # "24:00 까지" 를 모델이 00:00 으로 적습니다 — 그날 자정입니다
        title = f"{title} ({'자정' if start_minute == 0 else item['start_time']}까지)"
        start_minute = end_minute = None
    timed = start_minute is not None
    if timed and (end_minute is None or end_minute <= start_minute):
        end_minute = min(start_minute + 60, 23 * 60 + 59)
    category = item["category"] if item["category"] in CATEGORIES else "event"
    return core.CalendarEvent(
        title=title,
        start_date=datetime.date.fromisoformat(item["start_date"]),
        end_date=datetime.date.fromisoformat(item["end_date"]),
        time_mode="clock" if timed else "allday",
        start_minute=start_minute if timed else None,
        end_minute=end_minute if timed else None,
        category=category,
        target_grades=",".join(str(g) for g in item.get("target_grades") or []) or None,
        source="ksain",
        source_ref=f"{post.id}:{index}",
        note=f"ksain 자동 등록 — {post.title}\n{post.url}",
    )


def apply_post(db, post: Post, analysis: Analysis) -> int:
    """이 글에서 온 자동 일정을 분석 결과에 맞춥니다. 새로 만든 일정 수를 돌려줍니다.

    `db` 는 본 DB 세션입니다. 커밋은 부르는 쪽이 합니다(`analyze.run` 이 글마다 한 번).
    """
    current = db.query(core.CalendarEvent).filter(
        core.CalendarEvent.source == "ksain",
        core.CalendarEvent.source_ref.like(f"{post.id}:%"),
    ).all()
    alive = {row.id for row in current}
    suppressed = set(analysis.suppressed or [])
    for record in analysis.applied or []:
        if record["event_id"] not in alive:
            suppressed.add(record["sig"])
    for row in current:
        db.delete(row)
    db.flush()

    applied = []
    for index, item in enumerate(desired(analysis, clock.today())):
        sig = signature(item)
        if sig in suppressed or duplicate(db, item, post.id):
            continue
        event = _event(post, item, index)
        db.add(event)
        db.flush()
        applied.append({"sig": sig, "event_id": event.id})
    analysis.applied = applied
    analysis.suppressed = sorted(suppressed)
    return len(applied)


def remove_missing(ksain_db, db) -> int:
    """ksain 에서 사라진 글의 자동 일정·기억과 분석(요약에 원문 내용이 들어 있습니다)을 지웁니다.

    `ksain_db` 는 ksain.db, `db` 는 본 DB 세션입니다. 커밋은 부르는 쪽이 합니다.
    """
    rows = ksain_db.query(Analysis).join(Post).filter(Post.missing_since.isnot(None)).all()
    if not rows:
        return 0
    removed = 0
    for row in rows:
        removed += db.query(core.CalendarEvent).filter(
            core.CalendarEvent.source == "ksain",
            core.CalendarEvent.source_ref.like(f"{row.post_id}:%"),
        ).delete(synchronize_session=False)
    memory.remove_posts(db, [row.post_id for row in rows])
    for row in rows:
        ksain_db.delete(row)
    return removed
