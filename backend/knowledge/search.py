"""ksain 글 검색 — Agent 의 `search`·`read_ksain`·`ksain_digest` 가 씁니다 (읽기 전용).

**두 단계입니다.** FTS5 색인(`knowledge/index.py`)이 질문 낱말이 든 조각을 BM25 순으로 넉넉히
뽑고, 여기서 글 단위로 다시 매깁니다.

| 점수 | 값 |
| --- | --- |
| 낱말이 제목에 / 분석 요약에 / 본문에 / 첨부에 | 5 / 3 / 1 / 1 × 낱말 무게 |
| 질문 낱말을 얼마나 덮었나 (무게 합 비율 = 관련도) | 최대 +4 |
| BM25 (가장 잘 맞는 조각, 1등 글 기준 비율) | 최대 +3 |
| 중요도 · 일정이 아직 안 지났는가 · 최신성 | ×0.5 · ±2 · 오늘 +4 → 180일 0 — **관련도를 곱해서** |

**낱말 무게는 희소도(IDF)입니다.** "외출 신청 방법" 에서 "신청"(조각 3,634개)·"방법"(2,108개)은
흔하고 "외출"(221개)은 드뭅니다. 같은 무게로 세면 "HP 참가 신청 방법" 같은 최근 공지가 외출
안내를 이겼습니다.

최신성과 "아직 안 지났는가" 가 없으면 제목에 "포스터" 가 든 8월 중간발표 공지가 11월 최종발표
공지를 이겨서, "R&E 포스터 언제까지?" 에 지난 마감을 답했습니다. 다만 이 둘은 **관련 있는 글끼리
순서를 정하는 값**이라 관련도를 곱합니다 — 안 그러면 질문과 상관없는 이번 주 공지가 앞에 섭니다.

**답에는 근거 발췌(`passages`)를 싣습니다** — 글마다 질문 낱말이 걸린 조각을 본문이든 첨부든
골라서요. 12B 모델은 첨부 이름을 보고도 `read_ksain` 을 잘 안 부르는데, 마감일 같은 답이 첨부에만
있는 공지가 많습니다(100109 의 넷째 PDF "최종보고서 11월 29일"). 앞에서부터 자르면 거기까지 닿지
않습니다.

색인이 아직 없으면(수집 타이머가 새 코드로 한 번도 안 돌았으면) 후보를 LIKE 로 뽑고 같은 점수로
매깁니다 — 느리고 발췌가 덜 정확할 뿐 답은 나옵니다.
"""
from __future__ import annotations

import datetime
import math
import re

from sqlalchemy import or_, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, selectinload

from backend.core import clock
from backend.knowledge import index
from backend.knowledge.text import expand, fts_query, query_terms, squeeze
from backend.ksain.models import Analysis, Attachment, Post, SearchChunk

#: FTS 에서 뽑아 올 조각 수 — 글 단위로 다시 매기기 전의 후보입니다
CANDIDATE_CHUNKS = 300
#: 발췌 길이(글자)
PASSAGE = 420


def _when(post: Post) -> str | None:
    return post.posted_at.strftime("%Y-%m-%d %H:%M") if post.posted_at else None


def post_out(post: Post) -> dict:
    """글 한 건 — 요약·중요도·일정은 분석이 있을 때만."""
    analysis = post.analysis
    return {
        "id": post.id,
        "title": post.title,
        "board": post.board_name,
        "posted_at": _when(post),
        "url": post.url,
        "summary": analysis.summary if analysis else None,
        "importance": analysis.importance if analysis else None,
        "mandatory": analysis.mandatory if analysis else None,
        "items": analysis.items if analysis else [],
        # 날짜가 첨부에만 있는 공지가 많아서, 이름이 보여야 모델이 read_ksain 으로 열어 봅니다
        "attachments": [a.name for a in post.attachments][:6],
    }


def _excerpt(source: str, terms: list[str], start: int = 0, stop: int | None = None,
             weights: list[float] | None = None, size: int = PASSAGE) -> str:
    """[start, stop) 안에서 질문 낱말이 가장 무겁게 모인 자리 앞뒤로 `size` 글자.

    흔한 낱말("제출")만 몰린 자리와 드문 낱말("보고서")이 든 자리가 같은 개수면 드문 쪽입니다 —
    100109 첨부에서 "연구노트 … 제출" 문단이 "최종보고서 … 11월 29일" 문단을 이겼습니다.
    """
    piece = source[start:stop]
    if len(piece) <= size:
        return piece.strip()
    flat = piece.lower()
    weights = weights or [1.0] * len(terms)
    groups = []
    for term, weight in zip(terms, weights):
        words = expand(term) + (["r&e", "r & e"] if term == "rne" else [])  # 원문은 정규화 전 표기입니다
        groups.append((words, weight))
    positions = [m.start() for words, _w in groups for w in words for m in re.finditer(re.escape(w), flat)]
    if not positions:
        return piece[:size].strip()

    def density(pos: int) -> float:
        window = flat[max(0, pos - size // 3): pos + size * 2 // 3]
        return sum(weight for words, weight in groups if any(w in window for w in words))

    best = max(positions, key=density)
    left = max(0, min(best - size // 3, len(piece) - size))
    return piece[left:left + size].strip()


def _coverage(text_: str, variants: list[list[str]], weights: list[float]) -> float:
    flat = squeeze(text_)
    return sum(weight for group, weight in zip(variants, weights) if any(v in flat for v in group))


def _candidates(db: Session, terms: list[str]) -> dict[int, list[tuple[float, int | None, int, int]]]:
    """글 번호 → [(BM25, 첨부 id, start, stop)] — 잘 맞는 조각부터."""
    query = fts_query(terms)
    if not query:
        return {}
    rows = db.execute(text(
        "SELECT c.post_id, c.attachment_id, c.start, c.stop, bm25(ksain_search_fts) AS rank "
        "FROM ksain_search_fts JOIN ksain_search_chunks c ON c.id = ksain_search_fts.rowid "
        "WHERE ksain_search_fts MATCH :q ORDER BY rank LIMIT :n"
    ), {"q": query, "n": CANDIDATE_CHUNKS}).all()
    out: dict[int, list] = {}
    for post_id, attachment_id, start, stop, rank in rows:
        # bm25() 는 잘 맞을수록 더 작은(음수) 값입니다 — 뒤집어 씁니다
        out.setdefault(post_id, []).append((-rank, attachment_id, start, stop))
    return out


def _post_chunks(db: Session, terms: list[str], post_ids: list[int]) -> dict[int, list]:
    """고른 글들 안에서만 다시 — 전체 상위 조각에는 흔한 낱말 조각이 몰려서, 정작 답이 든 조각
    (100109 첨부의 "최종보고서 … 11월 29일")이 빠질 수 있습니다."""
    query = fts_query(terms)
    if not query or not post_ids:
        return {}
    marks = ", ".join(str(int(i)) for i in post_ids)
    rows = db.execute(text(
        "SELECT c.post_id, c.attachment_id, c.start, c.stop, bm25(ksain_search_fts) AS rank "
        "FROM ksain_search_fts JOIN ksain_search_chunks c ON c.id = ksain_search_fts.rowid "
        f"WHERE ksain_search_fts MATCH :q AND c.post_id IN ({marks}) ORDER BY rank LIMIT 200"
    ), {"q": query}).all()
    out: dict[int, list] = {}
    for post_id, attachment_id, start, stop, rank in rows:
        out.setdefault(post_id, []).append((-rank, attachment_id, start, stop))
    return out


def _weights(db: Session, terms: list[str]) -> list[float]:
    """낱말마다 희소도(IDF) — 평균이 1 이 되게 맞춥니다. 색인이 없으면 모두 1."""
    try:
        total = max(1, db.query(SearchChunk).count())
        raw = []
        for term in terms:
            query = fts_query([term])
            df = db.execute(text("SELECT count(*) FROM ksain_search_fts WHERE ksain_search_fts MATCH :q"),
                            {"q": query}).scalar() if query else 0
            raw.append(math.log(1 + (total - df + 0.5) / (df + 0.5)))
    except OperationalError:
        return [1.0] * len(terms)
    mean = sum(raw) / len(raw) if raw else 0
    return [w / mean for w in raw] if mean else [1.0] * len(terms)


def _like_candidates(db: Session, terms: list[str]) -> list[int]:
    """색인이 없을 때 — 낱말이 제목·본문·첨부 어디든 든 글."""
    clauses = []
    for term in terms:
        like = f"%{term}%"
        clauses += [Post.title.ilike(like), Post.content_text.ilike(like),
                    Post.attachments.any(Attachment.text.ilike(like))]
    rows = db.query(Post.id).filter(or_(*clauses)).order_by(Post.posted_at.desc()).limit(400).all()
    return [post_id for (post_id,) in rows]


def search(db: Session, query: str, *, since: datetime.date | None = None, until: datetime.date | None = None,
           board: str | None = None, limit: int = 6) -> list[dict]:
    terms = query_terms(query)
    chunk_hits: dict[int, list] = {}
    q = db.query(Post).filter(Post.missing_since.is_(None)).options(
        selectinload(Post.analysis), selectinload(Post.attachments))
    if since:
        q = q.filter(Post.posted_at >= datetime.datetime.combine(since, datetime.time.min))
    if until:
        q = q.filter(Post.posted_at <= datetime.datetime.combine(until, datetime.time.max))
    if board:
        q = q.filter(Post.board_name.like(f"%{board}%"))
    if terms:
        try:
            chunk_hits = _candidates(db, terms) if index.ready(db) else {}
        except OperationalError:
            chunk_hits = {}  # 색인 표가 아직 없는 DB
        ids = list(chunk_hits) or _like_candidates(db, terms)
        posts = q.filter(Post.id.in_(ids)).all() if ids else []
    else:
        # 낱말 없는 질문("이번 주 공지") — 기간 안의 글을 중요도·최신순으로
        posts = q.order_by(Post.posted_at.desc()).limit(400).all()

    now = clock.now_naive()
    best_rank = max((max(r for r, *_ in chunks) for chunks in chunk_hits.values()), default=0) or 1
    variants = [[squeeze(v) for v in expand(term)] for term in terms]
    weights = _weights(db, terms) if chunk_hits else [1.0] * len(terms)
    total_weight = sum(weights) or 1

    scored = []
    for post in posts:
        analysis = post.analysis
        score, relevance = 0.0, 1.0
        if terms:
            title = squeeze(post.title)
            summary = squeeze(analysis.summary if analysis else "")
            body = squeeze(post.content_text)
            attached = squeeze("\n".join(a.text or "" for a in post.attachments if a.status == "ok"))
            covered = 0.0
            for weight, group in zip(weights, variants):
                found = [any(v in place for v in group) for place in (title, summary, body, attached)]
                score += weight * (5 * found[0] + 3 * found[1] + found[2] + found[3])
                covered += weight if any(found) else 0
            relevance = covered / total_weight
            score += 4 * relevance
            if post.id in chunk_hits:
                score += 3 * max(r for r, *_ in chunk_hits[post.id]) / best_rank
        tiebreak = 0.0
        if analysis:
            tiebreak += analysis.importance * 0.5
            # 일정이 아직 안 지난 글을 앞으로, 다 지난 글을 뒤로
            ends = [item["end_date"] for item in analysis.items or []]
            if ends:
                tiebreak += 2 if max(ends) >= now.date().isoformat() else -2
        if post.posted_at:
            # "언제까지 내야 해" 는 거의 늘 올해 공지를 묻습니다 — 작년 글이 제목 일치로 먼저 나오지 않게
            tiebreak += max(0.0, 4 * (1 - (now - post.posted_at).days / 180))
        scored.append((score + tiebreak * relevance, post))
    scored.sort(key=lambda pair: pair[0], reverse=True)

    top = scored[:limit]
    if chunk_hits:
        chunk_hits = _post_chunks(db, terms, [post.id for _score, post in top]) or chunk_hits
    out = []
    for rank, (_score, post) in enumerate(top):
        entry = post_out(post)
        entry["passages"] = _passages(post, terms, chunk_hits.get(post.id, []), 2 if rank < 3 else 1, weights)
        out.append(entry)
    return out


def _passages(post: Post, terms: list[str], chunks: list, count: int,
              weights: list[float] | None = None) -> list[dict]:
    """글에서 질문에 가장 잘 맞는 조각 `count` 개 — 본문이든 첨부든."""
    body = index.post_body(post)
    attachments = {a.id: a for a in post.attachments if a.status == "ok" and a.text}
    variants = [[squeeze(v) for v in expand(term)] for term in terms]
    weights = weights or [1.0] * len(terms)

    def source(attachment_id: int | None) -> str:
        return body if attachment_id is None else (attachments[attachment_id].text if attachment_id in attachments else "")

    # 질문 낱말을 많이 덮은 조각부터, 같으면 BM25 순
    ranked = sorted(chunks, key=lambda c: (_coverage(source(c[1])[c[2]:c[3]], variants, weights), c[0]),
                    reverse=True)
    out, seen = [], set()
    for _rank, attachment_id, start, stop in ranked:
        if (attachment_id, start) in seen:
            continue
        seen.add((attachment_id, start))
        if attachment_id is None:
            out.append({"from": "본문", "text": _excerpt(body, terms, start, stop, weights)})
        elif attachment_id in attachments:
            att = attachments[attachment_id]
            out.append({"from": f"첨부 {att.name}", "text": _excerpt(att.text, terms, start, stop, weights)})
        if len(out) >= count:
            return out
    if not out:
        # 색인 없이 찾았거나 낱말 없는 질문 — 본문에서, 본문이 비면 첫 첨부에서
        if post.content_text.strip():
            out.append({"from": "본문", "text": _excerpt(body, terms, weights=weights)})
        elif attachments:
            att = next(iter(attachments.values()))
            out.append({"from": f"첨부 {att.name}", "text": _excerpt(att.text, terms, weights=weights)})
    return out


def read(db: Session, post_id: int) -> dict | None:
    """글 하나의 본문과 첨부 텍스트."""
    post = db.get(Post, post_id)
    if post is None or post.missing_since is not None:
        return None
    out = post_out(post)
    out["content"] = post.content_text[:6000]
    out["attachments"] = [
        {"name": a.name, "url": a.url, "text": (a.text or "")[:3000] if a.status == "ok" else None, "status": a.status}
        for a in post.attachments
    ]
    return out


def digest(db: Session, start: datetime.date, end: datetime.date, min_importance: int = 2) -> dict:
    """기간 안에 올라온 중요한 글과, 기간 안에 날짜가 걸린 필참·마감 항목."""
    start_dt = datetime.datetime.combine(start, datetime.time.min)
    end_dt = datetime.datetime.combine(end, datetime.time.max)
    posted = (
        db.query(Post).join(Analysis)
        .filter(Post.posted_at >= start_dt, Post.posted_at <= end_dt, Post.missing_since.is_(None),
                Analysis.importance >= min_importance)
        .order_by(Analysis.importance.desc(), Post.posted_at.desc()).limit(15).all()
    )
    window = (
        db.query(Post).join(Analysis)
        .filter(Post.posted_at >= start_dt - datetime.timedelta(days=60), Post.missing_since.is_(None))
        .all()
    )
    upcoming = []
    for post in window:
        for item in post.analysis.items or []:
            day = datetime.date.fromisoformat(item["start_date"])
            last = datetime.date.fromisoformat(item["end_date"])
            if last >= start and day <= end and (item["kind"] in ("mandatory", "deadline", "exam", "dorm") or post.analysis.mandatory):
                upcoming.append({**item, "post_id": post.id, "post_title": post.title, "url": post.url})
    upcoming.sort(key=lambda item: (item["start_date"], item.get("start_time") or ""))
    # 아직 분석이 안 된 글은 중요도를 모르니 제목만이라도 넘깁니다 — 없으면 "올라온 게 없다" 로 읽힙니다
    unanalyzed = (
        db.query(Post).outerjoin(Analysis)
        .filter(Post.posted_at >= start_dt, Post.posted_at <= end_dt, Post.missing_since.is_(None),
                Analysis.post_id.is_(None))
        .order_by(Post.posted_at.desc()).limit(20).all()
    )
    return {
        "posted": [post_out(p) for p in posted],
        "dated_items": upcoming[:25],
        "unanalyzed": [{"id": p.id, "title": p.title, "board": p.board_name, "url": p.url,
                        "posted_at": _when(p)} for p in unanalyzed],
    }
