"""Agent 가 쓰는 ksain 검색.

FTS5 대신 LIKE 와 점수 계산으로 찾습니다. 글이 3천 건 남짓이라 충분히 빠르고, FTS5 의
trigram 토크나이저는 "필참"·"귀가" 같은 **두 글자 한국어 단어를 못 찾습니다.**

점수: 제목 5 · 분석 요약 3 · 본문 1 · 첨부 1 (단어마다) + 중요도 + 최신성.
"""
from __future__ import annotations

import datetime
import re

from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from backend.ksain.models import Analysis, Attachment, Post

# 질문에 붙어 오는 조사·어미. "마감일이" 로 찾으면 "마감일" 이 안 걸립니다
_SUFFIX = re.compile(r"(에서|에게|으로|이랑|하고|이야|인가요|인가|이에요|예요|은|는|이|가|을|를|에|의|도|만|랑|야|요)$")
_STOP = {"언제", "어디", "뭐", "무엇", "알려줘", "알려", "있어", "있나", "오늘", "내일", "공지", "ksain", "관련", "좀"}


def terms(query: str) -> list[str]:
    out = []
    for word in re.findall(r"[0-9A-Za-z가-힣&]+", query or ""):
        word = word.lower()
        if len(word) > 2:
            word = _SUFFIX.sub("", word)
        if len(word) >= 2 and word not in _STOP:
            out.append(word)
    return list(dict.fromkeys(out))[:8]


def post_out(post: Post, snippet_terms: list[str] | None = None) -> dict:
    analysis = post.analysis
    out = {
        "id": post.id,
        "title": post.title,
        "board": post.board_name,
        "posted_at": post.posted_at.strftime("%Y-%m-%d %H:%M") if post.posted_at else None,
        "url": post.url,
        "summary": analysis.summary if analysis else None,
        "importance": analysis.importance if analysis else None,
        "mandatory": analysis.mandatory if analysis else None,
        "items": analysis.items if analysis else [],
    }
    if snippet_terms and not out["summary"]:
        body = post.content_text
        hit = min((body.lower().find(t) for t in snippet_terms if t in body.lower()), default=0)
        out["snippet"] = body[max(0, hit - 80): hit + 220]
    return out


def search(db: Session, query: str, *, since: datetime.date | None = None, until: datetime.date | None = None,
           board: str | None = None, limit: int = 8) -> list[dict]:
    words = terms(query)
    q = db.query(Post).outerjoin(Analysis).filter(Post.missing_since.is_(None)).options(
        selectinload(Post.analysis), selectinload(Post.attachments))
    if since:
        q = q.filter(Post.posted_at >= datetime.datetime.combine(since, datetime.time.min))
    if until:
        q = q.filter(Post.posted_at <= datetime.datetime.combine(until, datetime.time.max))
    if board:
        q = q.filter(Post.board_name.like(f"%{board}%"))
    if words:
        clauses = []
        for word in words:
            like = f"%{word}%"
            clauses += [Post.title.ilike(like), Post.content_text.ilike(like), Analysis.summary.ilike(like),
                        Post.attachments.any(Attachment.text.ilike(like))]
        q = q.filter(or_(*clauses))
    rows = q.order_by(Post.posted_at.desc()).limit(400).all()

    now = datetime.datetime.now()
    scored = []
    for post in rows:
        title = post.title.lower()
        summary = (post.analysis.summary or "").lower() if post.analysis else ""
        body = post.content_text.lower()
        attached = " ".join((a.text or "").lower() for a in post.attachments)
        score = 0.0
        for word in words:
            score += 5 * (word in title) + 3 * (word in summary) + (word in body) + (word in attached)
        if post.analysis:
            score += post.analysis.importance * 0.5
        if post.posted_at:
            score += max(0.0, 2 - (now - post.posted_at).days / 90)
        scored.append((score, post))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [post_out(post, words) for _score, post in scored[:limit]]


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
    return {"posted": [post_out(p) for p in posted], "dated_items": upcoming[:25]}


def read(db: Session, post_id: int) -> dict | None:
    post = db.get(Post, post_id)
    if post is None:
        return None
    out = post_out(post)
    out["content"] = post.content_text[:6000]
    out["attachments"] = [
        {"name": a.name, "url": a.url, "text": (a.text or "")[:3000] if a.status == "ok" else None, "status": a.status}
        for a in post.attachments
    ]
    return out
