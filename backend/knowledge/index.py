"""ksain 글 검색 색인 — 글 본문과 첨부 텍스트를 조각으로 나눠 FTS5(바이그램)에 넣습니다.

    python -m backend.knowledge.index            # 바뀐 글만 (수집 타이머가 매번 부릅니다)
    python -m backend.knowledge.index --rebuild  # 처음부터 (1~2초)

**색인은 수집 쪽(`baeks`)만 씁니다.** API 는 읽기만 합니다 — 서버에서 ksain.db 는 `baeks` 의
파일이고 API 는 `data/` 밖에 못 씁니다. 그래서 `ksain.sync` 가 끝날 때마다 `refresh()` 를 부릅니다.

**글자는 저장하지 않습니다.** FTS 표는 contentless 이고 조각 표(`ksain_search_chunks`)는 원문의
위치만 듭니다. 원문은 글·첨부 표에 이미 있어서 두 벌로 둘 이유가 없습니다 — 그대로 두면 색인이
19MB, 글자까지 넣으면 그 몇 배입니다.

⚠️ **contentless FTS5 는 행을 지울 수 없습니다** (SQLite 3.43 부터 되는데 서버가 3.37 입니다).
그래서 글이 바뀌면 조각 행만 지우고 FTS 쪽 토큰은 남겨 둡니다 — 검색이 조각 표와 이어 붙여 보므로
고아 토큰은 안 걸립니다. 고아가 조각 수의 30% 를 넘으면 처음부터 다시 만듭니다.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections.abc import Iterator

from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, selectinload

from backend.core import clock
from backend.core.db import KsainSession, init_ksain_schema
from backend.knowledge.text import tokens
from backend.ksain.models import Post, SearchChunk, SearchStamp, State

#: 자르는 법이나 토큰이 바뀌면 올립니다 — 다음 `refresh()` 가 처음부터 다시 만듭니다
INDEX_VERSION = 1
#: 조각 길이(글자). 답에 근거로 싣는 발췌가 이 안에서 나오므로 너무 길면 모델이 읽을 게 늘어납니다
CHUNK = 600
#: 조각끼리 겹치는 길이 — 경계에 걸린 문장을 양쪽에서 다 찾게 합니다
OVERLAP = 120
STATE_KEY = "search_index"


def chunks(body: str, size: int = CHUNK, overlap: int = OVERLAP) -> Iterator[tuple[int, int]]:
    """[start, stop) 구간들. 되도록 줄바꿈에서 끊습니다."""
    if not body.strip():
        return
    if len(body) <= size:
        yield 0, len(body)
        return
    start = 0
    while start < len(body):
        stop = min(len(body), start + size)
        if stop < len(body):
            cut = body.rfind("\n", start + size // 2, stop)
            if cut > start:
                stop = cut
        yield start, stop
        if stop >= len(body):
            break
        start = max(stop - overlap, start + 1)


def post_body(post: Post) -> str:
    """글 본문 조각이 가리키는 글자열 — 색인과 검색이 **똑같이** 만들어야 위치가 맞습니다."""
    return f"{post.title}\n{post.content_text}"


def _stamps(db: Session) -> dict[int, str]:
    """글마다 지금 내용의 지문. 첨부 텍스트는 길이만 봅니다(전부 읽지 않으려고)."""
    attachments: dict[int, list] = {}
    for post_id, att_id, status, length in db.execute(text(
            "SELECT post_id, id, status, length(text) FROM ksain_attachments ORDER BY post_id, id")):
        attachments.setdefault(post_id, []).append((att_id, status, length))
    out = {}
    for post_id, content_hash, missing in db.execute(text(
            "SELECT id, content_hash, missing_since FROM ksain_posts")):
        basis = json.dumps([content_hash, bool(missing), attachments.get(post_id, []), INDEX_VERSION])
        out[post_id] = hashlib.sha1(basis.encode()).hexdigest()
    return out


def _state(db: Session) -> dict:
    row = db.get(State, STATE_KEY)
    return dict(row.value or {}) if row else {}


def _save_state(db: Session, value: dict) -> None:
    db.merge(State(key=STATE_KEY, value=value))


def _drop(db: Session, post_id: int) -> int:
    """그 글의 조각을 지웁니다. FTS 토큰은 고아로 남습니다(머리말)."""
    return db.query(SearchChunk).filter(SearchChunk.post_id == post_id).delete(synchronize_session=False)


def _add(db: Session, post: Post) -> int:
    rows = []
    body = post_body(post)
    rows += [(None, start, stop, body[start:stop]) for start, stop in chunks(body)]
    for att in post.attachments:
        if att.status == "ok" and att.text:
            rows += [(att.id, start, stop, att.text[start:stop]) for start, stop in chunks(att.text)]
    for attachment_id, start, stop, piece in rows:
        # 조각이 수만 개라 ORM 객체를 만들지 않고 바로 넣습니다 — rowid 를 FTS 쪽에 그대로 씁니다
        chunk_id = db.execute(
            text("INSERT INTO ksain_search_chunks (post_id, attachment_id, start, stop) "
                 "VALUES (:post_id, :attachment_id, :start, :stop)"),
            {"post_id": post.id, "attachment_id": attachment_id, "start": start, "stop": stop},
        ).lastrowid
        db.execute(text("INSERT INTO ksain_search_fts(rowid, tokens) VALUES (:id, :tokens)"),
                   {"id": chunk_id, "tokens": " ".join(tokens(piece))})
    return len(rows)


def rebuild(db: Session) -> dict:
    """처음부터 다시 — 한 트랜잭션입니다(도중에 실패하면 옛 색인이 그대로 남습니다)."""
    db.execute(text("INSERT INTO ksain_search_fts(ksain_search_fts) VALUES('delete-all')"))
    db.query(SearchChunk).delete(synchronize_session=False)
    db.query(SearchStamp).delete(synchronize_session=False)
    count = 0
    stamps = _stamps(db)
    ids = [post_id for (post_id,) in db.query(Post.id).filter(Post.missing_since.is_(None))]
    for i in range(0, len(ids), 200):
        batch = db.query(Post).filter(Post.id.in_(ids[i:i + 200])).options(selectinload(Post.attachments)).all()
        for post in batch:
            count += _add(db, post)
        db.expunge_all()  # 첨부 텍스트가 크니 한 묶음씩만 붙들고 있습니다
    for post_id, stamp in stamps.items():
        db.add(SearchStamp(post_id=post_id, stamp=stamp))
    _save_state(db, {"version": INDEX_VERSION, "chunks": count, "orphans": 0,
                     "built_at": clock.utcnow().isoformat(timespec="seconds")})
    db.commit()
    return {"rebuilt": True, "chunks": count}


def refresh(db: Session) -> dict:
    """바뀐 글만 다시 색인합니다. 버전이 바뀌었거나 고아가 많으면 처음부터."""
    state = _state(db)
    if state.get("version") != INDEX_VERSION:
        return rebuild(db)
    stamps = _stamps(db)
    known = {row.post_id: row.stamp for row in db.query(SearchStamp)}
    changed = [post_id for post_id, stamp in stamps.items() if known.get(post_id) != stamp]
    gone = [post_id for post_id in known if post_id not in stamps]
    orphans, added = int(state.get("orphans", 0)), 0
    for post_id in changed + gone:
        orphans += _drop(db, post_id)
        post = db.get(Post, post_id)
        if post is not None and post.missing_since is None:
            added += _add(db, post)
        if post_id in stamps:
            db.merge(SearchStamp(post_id=post_id, stamp=stamps[post_id]))
        else:
            db.query(SearchStamp).filter(SearchStamp.post_id == post_id).delete()
    total = db.query(SearchChunk).count()
    if orphans > max(1000, total * 0.3):
        db.rollback()
        return rebuild(db)
    _save_state(db, {**state, "chunks": total, "orphans": orphans})
    db.commit()
    return {"rebuilt": False, "reindexed": len(changed) + len(gone), "chunks": total, "orphans": orphans}


def ready(db: Session) -> bool:
    """검색에 쓸 색인이 있는가. 없으면(수집 타이머가 아직 한 번도 안 돌았으면) 검색은 LIKE 로 돕니다."""
    try:
        state = _state(db)
        return state.get("version") == INDEX_VERSION and state.get("chunks", 0) > 0
    except OperationalError:
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ksain 글 검색 색인")
    parser.add_argument("--rebuild", action="store_true", help="처음부터 다시 만듭니다")
    args = parser.parse_args()
    init_ksain_schema()
    session = KsainSession()
    try:
        result = rebuild(session) if args.rebuild else refresh(session)
    finally:
        session.close()
    print(json.dumps(result, ensure_ascii=False))
