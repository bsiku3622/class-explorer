"""Agent 가 쓰는 ksain 검색.

FTS5 대신 LIKE 와 점수 계산으로 찾습니다. 글이 3천 건 남짓이라 충분히 빠르고, FTS5 의
trigram 토크나이저는 "필참"·"귀가" 같은 **두 글자 한국어 단어를 못 찾습니다.**

점수: 제목 5 · 분석 요약 3 · 본문 1 · 첨부 1 (단어마다) + 중요도 × 0.5 + 최신성(최대 4).
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
        # 날짜가 첨부에만 있는 공지가 많아서, 이름이 보여야 모델이 read_ksain 으로 열어 봅니다
        "attachments": [a.name for a in post.attachments][:6],
    }
    if snippet_terms and not out["summary"]:
        body = post.content_text
        hit = min((body.lower().find(t) for t in snippet_terms if t in body.lower()), default=0)
        out["snippet"] = body[max(0, hit - 80): hit + 220]
    return out


def search(db: Session, query: str, *, since: datetime.date | None = None, until: datetime.date | None = None,
           board: str | None = None, limit: int = 6) -> list[dict]:
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
            # 일정이 아직 안 지난 글을 앞으로, 다 지난 글을 뒤로 — 8월 중간발표 포스터 공지가
            # 11월 최종발표 포스터 공지를 제목 일치만으로 이기지 않게요
            ends = [item["end_date"] for item in post.analysis.items or []]
            if ends:
                score += 2 if max(ends) >= now.date().isoformat() else -2
        if post.posted_at:
            # "언제까지 내야 해" 는 거의 늘 올해 공지를 묻습니다. 제목 일치(5)에 밀려 작년 글이
            # 먼저 나오지 않게 최근 글에 넉넉히 줍니다 (오늘 +4 → 180일 0)
            score += max(0.0, 4 * (1 - (now - post.posted_at).days / 180))
        scored.append((score, post))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    out = [post_out(post, words) for _score, post in scored[:limit]]
    # 상위 세 글은 첨부 발췌까지 싣습니다. 12B 모델은 첨부 이름을 보고도 read_ksain 을 잘 안
    # 부르는데, 마감일 같은 답이 첨부에만 있는 공지가 많습니다.
    # ⚠️ 앞에서부터 자르면 안 됩니다 — R&E 최종발표회 공지(100109)는 첨부가 넷이고 "최종보고서
    # 11월 29일" 은 세 번째에 있어서, 앞의 둘이 한도를 다 먹었습니다. 질문 단어 주변을 뜹니다
    for entry, (_score, post) in zip(out[:3], scored[:3]):
        hits = []
        for att in post.attachments:
            if att.status == "ok" and att.text:
                count, excerpt = _window(att.text, words)
                hits.append((count, f"[{att.name}]\n{excerpt}"))
        hits.sort(key=lambda pair: pair[0], reverse=True)
        if hits:
            entry["attachment_excerpt"] = "\n".join(text for _c, text in hits[:3])[:1500]
    return out


def _window(text: str, words: list[str], before: int = 250, after: int = 450) -> tuple[int, str]:
    """질문 단어가 가장 많이 모인 자리 앞뒤. (걸린 단어 수, 발췌)"""
    lower = text.lower()
    positions = [m.start() for w in words for m in re.finditer(re.escape(w), lower)]
    if not positions:
        return 0, text[:400]
    best = max(positions, key=lambda p: sum(w in lower[max(0, p - before): p + after] for w in words))
    count = sum(w in lower[max(0, best - before): best + after] for w in words)
    return count, text[max(0, best - before): best + after]


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
                        "posted_at": p.posted_at.strftime("%Y-%m-%d %H:%M") if p.posted_at else None} for p in unanalyzed],
    }


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
