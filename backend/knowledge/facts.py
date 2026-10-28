"""기억 — 본 DB 의 `facts` 를 쓰고 읽습니다. 사실 하나하나는 ksain 글 하나에 묶입니다.

| 누가 | 무엇을 |
| --- | --- |
| 분석 타이머 (`ksain.analyze`) | `apply_post` — 글의 분석 결과를 사실로 옮겨 적기 · `remove_posts` — 지워진 글의 사실 지우기 |
| 매니저 (`routers/facts.py`) | `edit` — 문장 고치기 · 숨기기 |
| Ask (`agent/`) | `recall` — 질문에 맞는 사실을 시스템 프롬프트에 · `search` 도구 결과에 |
| Admin 기억 패널 | `listing` — 글 단위로 묶어 보기 |

**사람의 손이 우선입니다.** 숨긴 사실과 고친 사실은 글을 다시 분석해도 그대로 두고, 새로 뽑힌
사실이 그것과 같은 말이면(`similar`) 다시 만들지 않습니다 — 학사일정의 자동 일정이 사람이 지우거나
고친 것을 되살리지 않는 것과 같은 규칙입니다.

검색은 `facts_fts`(바이그램 토큰, rowid = facts.id)로 합니다. 사실을 쓰거나 고칠 때 여기서 같이
맞춥니다 — 다른 곳에서 `facts` 를 직접 고치면 검색이 옛 문장으로 걸립니다.
"""
from __future__ import annotations

import datetime
import math

from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from backend import models
from backend.core import clock
from backend.knowledge.text import expand, fts_query, query_terms, similar, squeeze, tokens
from backend.services.calendar import grades

#: 이보다 확신이 낮은 사실은 옮겨 적지 않습니다 (분석기가 "추정" 이라고 한 것)
MIN_CONFIDENCE = 0.6
#: 질문 하나에 시스템 프롬프트로 싣는 사실 수
RECALL_LIMIT = 6
#: 이보다 오래된 글의 사실은 같은 주제의 새 사실에 밀립니다 — 최신성 가산점이 0 이 되는 날수
FRESH_DAYS = 365


def ksain_url(post_id: int) -> str:
    return f"https://ksain.kr/document/{post_id}"


def fact_out(fact: models.Fact) -> dict:
    return {
        "id": fact.id,
        "statement": fact.statement,
        "topic": fact.topic,
        "post_id": fact.post_id,
        "post_title": fact.post_title,
        "posted_on": fact.posted_on.isoformat() if fact.posted_on else None,
        "url": ksain_url(fact.post_id),
        "target_grades": grades(fact.target_grades),
        "valid_until": fact.valid_until.isoformat() if fact.valid_until else None,
        "confidence": fact.confidence,
        "status": fact.status,
        "edited": fact.edited,
    }


# ─── 검색 색인 (facts_fts) ───────────────────────────────────────────────────
def _index(db: Session, fact: models.Fact) -> None:
    db.execute(text("DELETE FROM facts_fts WHERE rowid = :id"), {"id": fact.id})
    db.execute(text("INSERT INTO facts_fts(rowid, tokens) VALUES (:id, :tokens)"),
               {"id": fact.id, "tokens": " ".join(tokens(f"{fact.topic}\n{fact.statement}"))})


def _unindex(db: Session, fact_ids: list[int]) -> None:
    for fact_id in fact_ids:
        db.execute(text("DELETE FROM facts_fts WHERE rowid = :id"), {"id": fact_id})


def reindex_all(db: Session) -> int:
    """색인을 표에서 다시 만듭니다 — 토큰 만드는 법을 바꿨을 때."""
    db.execute(text("DELETE FROM facts_fts"))
    rows = db.query(models.Fact).all()
    for fact in rows:
        _index(db, fact)
    db.commit()
    return len(rows)


# ─── 쓰기 ────────────────────────────────────────────────────────────────────
def apply_post(db: Session, post, analysis) -> int:
    """이 글의 사실을 분석 결과(`analysis.facts`)에 맞춥니다. 새로 적은 사실 수를 돌려줍니다.

    `post`·`analysis` 는 ksain.db 의 행입니다. 커밋은 부르는 쪽이 합니다.
    """
    existing = db.query(models.Fact).filter(models.Fact.post_id == post.id).all()
    keep = [f for f in existing if f.edited or f.status == "hidden"]
    doomed = [f for f in existing if f not in keep]
    _unindex(db, [f.id for f in doomed])
    for fact in doomed:
        db.delete(fact)
    db.flush()

    posted_on = post.posted_at.date() if post.posted_at else None
    created = 0
    for seq, item in enumerate(analysis.facts or []):
        if item.get("confidence", 0) < MIN_CONFIDENCE:
            continue
        if any(similar(item["statement"], kept.statement) for kept in keep):
            continue  # 사람이 숨기거나 고친 그 사실입니다
        valid_until = item.get("valid_until")
        fact = models.Fact(
            post_id=post.id, post_title=post.title, posted_on=posted_on, seq=seq,
            statement=item["statement"], topic=item.get("topic") or "",
            target_grades=",".join(str(g) for g in item.get("target_grades") or []) or None,
            valid_until=datetime.date.fromisoformat(valid_until) if valid_until else None,
            confidence=float(item.get("confidence") or 0),
        )
        db.add(fact)
        db.flush()
        _index(db, fact)
        created += 1
    for kept in keep:
        kept.post_title = post.title  # 글 제목을 고쳤으면 출처 표시도 따라갑니다
    return created


def remove_posts(db: Session, post_ids: list[int]) -> int:
    """ksain 에서 사라진 글의 사실 — 사람이 고친 것까지 전부 지웁니다(개인정보처리방침 4항)."""
    if not post_ids:
        return 0
    ids = [fact_id for (fact_id,) in db.query(models.Fact.id).filter(models.Fact.post_id.in_(post_ids))]
    _unindex(db, ids)
    return db.query(models.Fact).filter(models.Fact.id.in_(ids)).delete(synchronize_session=False) if ids else 0


def edit(db: Session, fact: models.Fact, user: models.User, *, statement: str | None = None,
         topic: str | None = None, valid_until: datetime.date | None | str = "keep",
         status: str | None = None) -> models.Fact:
    """매니저의 손질 — 문장·주제·유효 기간을 고치면 `edited`, 숨기면 `hidden`. 커밋까지 합니다."""
    changed = False
    if statement is not None and statement.strip() and statement.strip() != fact.statement:
        fact.statement, changed = statement.strip(), True
    if topic is not None and topic.strip() != fact.topic:
        fact.topic, changed = topic.strip(), True
    if valid_until != "keep" and valid_until != fact.valid_until:
        fact.valid_until, changed = valid_until, True
    if changed:
        fact.edited, fact.edited_by_id, fact.edited_at = True, user.id, clock.utcnow()
        _index(db, fact)
    if status in ("active", "hidden") and status != fact.status:
        fact.status = status
        fact.edited_by_id, fact.edited_at = user.id, clock.utcnow()
    db.commit()
    return fact


# ─── 읽기 ────────────────────────────────────────────────────────────────────
def _usable(today: datetime.date):
    """기억으로 쓸 수 있는 사실 — 숨기지 않았고 아직 유효한 것."""
    return (models.Fact.status == "active",
            or_(models.Fact.valid_until.is_(None), models.Fact.valid_until >= today))


def _weights(db: Session, terms: list[str]) -> list[float]:
    """낱말마다 희소도(IDF) — `knowledge/search.py` 와 같은 계산을 사실 표에 합니다."""
    total = max(1, db.query(func.count(models.Fact.id)).scalar() or 0)
    raw = []
    for term in terms:
        query = fts_query([term])
        df = db.execute(text("SELECT count(*) FROM facts_fts WHERE facts_fts MATCH :q"),
                        {"q": query}).scalar() if query else 0
        raw.append(math.log(1 + (total - df + 0.5) / (df + 0.5)))
    mean = sum(raw) / len(raw) if raw else 0
    return [w / mean for w in raw] if mean else [1.0] * len(terms)


def find(db: Session, query: str, *, today: datetime.date | None = None, grade: int | None = None,
         limit: int = RECALL_LIMIT, min_relevance: float = 0.5) -> list[models.Fact]:
    """질문에 맞는 사실 — 질문 낱말을 무게 기준으로 절반 넘게 덮은 것만.

    같은 주제(`topic`)의 사실이 여럿이면 **새 글의 것 하나만** 남깁니다 — 해마다 다시 오는
    공지(11월 귀가·수강 정정)는 작년 사실이 올해 사실을 흐립니다.
    """
    today = today or clock.today()
    terms = query_terms(query)
    fts = fts_query(terms)
    if not fts:
        return []
    ranks = dict(db.execute(text(
        "SELECT rowid, bm25(facts_fts) FROM facts_fts WHERE facts_fts MATCH :q ORDER BY bm25(facts_fts) LIMIT 60"
    ), {"q": fts}).all())
    if not ranks:
        return []
    facts = db.query(models.Fact).filter(models.Fact.id.in_(list(ranks)), *_usable(today)).all()
    weights = _weights(db, terms)
    total = sum(weights) or 1
    variants = [[squeeze(v) for v in expand(term)] for term in terms]
    best = max(-r for r in ranks.values()) or 1

    scored = []
    for fact in facts:
        flat = squeeze(f"{fact.topic}\n{fact.statement}")
        relevance = sum(w for w, group in zip(weights, variants) if any(v in flat for v in group)) / total
        if relevance < min_relevance and len(terms) > 1:
            continue
        score = 4 * relevance + 2 * (-ranks[fact.id]) / best + 0.5 * fact.confidence
        if fact.posted_on:
            score += max(0.0, 1 - (today - fact.posted_on).days / FRESH_DAYS)
        if grade and fact.target_grades and grade not in grades(fact.target_grades):
            score -= 1  # 다른 학년 이야기 — 빼지는 않습니다(다른 학년 걸 묻기도 합니다)
        if fact.edited:
            score += 0.5  # 사람이 확인한 문장
        scored.append((score, fact))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    out: list[models.Fact] = []
    for _score, fact in scored:
        twin = next((kept for kept in out if fact.topic and kept.topic and similar(fact.topic, kept.topic, 0.6)), None)
        if twin is not None:
            if (fact.posted_on or datetime.date.min) > (twin.posted_on or datetime.date.min):
                out[out.index(twin)] = fact
            continue
        out.append(fact)
        if len(out) >= limit:
            break
    return out


def by_post(db: Session, post_id: int, today: datetime.date | None = None) -> list[models.Fact]:
    """한 글의 쓸 수 있는 사실 — `read_ksain` 이 같이 싣습니다."""
    return (db.query(models.Fact).filter(models.Fact.post_id == post_id, *_usable(today or clock.today()))
            .order_by(models.Fact.seq).all())


def listing(db: Session, *, q: str | None = None, status: str | None = None, page: int = 1,
            per_page: int = 20) -> dict:
    """Admin 기억 패널 — 글 단위로 묶어서, 새 글부터."""
    query = db.query(models.Fact)
    if status == "hidden":
        query = query.filter(models.Fact.status == "hidden")
    elif status == "edited":
        query = query.filter(models.Fact.edited.is_(True))
    elif status == "active":
        query = query.filter(models.Fact.status == "active")
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(models.Fact.statement.ilike(like), models.Fact.topic.ilike(like),
                                 models.Fact.post_title.ilike(like)))
    posts = (
        query.with_entities(models.Fact.post_id, func.max(models.Fact.posted_on).label("posted_on"))
        .group_by(models.Fact.post_id)
        .order_by(func.max(models.Fact.posted_on).desc().nullslast(), models.Fact.post_id.desc())
    )
    total_posts = posts.count()
    page_ids = [post_id for post_id, _ in posts.offset((page - 1) * per_page).limit(per_page)]
    facts = query.filter(models.Fact.post_id.in_(page_ids)).order_by(models.Fact.seq).all() if page_ids else []
    grouped: dict[int, list] = {post_id: [] for post_id in page_ids}
    for fact in facts:
        grouped[fact.post_id].append(fact)
    counts = dict(db.query(models.Fact.status, func.count(models.Fact.id)).group_by(models.Fact.status).all())
    return {
        "posts": [
            {"post_id": post_id, "post_title": items[0].post_title if items else "",
             "posted_on": items[0].posted_on.isoformat() if items and items[0].posted_on else None,
             "url": ksain_url(post_id), "facts": [fact_out(f) for f in items]}
            for post_id, items in grouped.items()
        ],
        "page": page,
        "per_page": per_page,
        "total_posts": total_posts,
        "counts": {
            "active": counts.get("active", 0),
            "hidden": counts.get("hidden", 0),
            "edited": db.query(func.count(models.Fact.id)).filter(models.Fact.edited.is_(True)).scalar() or 0,
        },
    }
