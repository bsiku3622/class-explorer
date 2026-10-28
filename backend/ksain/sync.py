"""ksain 글 수집.

    python -m backend.ksain.sync --backfill    # 처음 한 번 — 두 번호 공간을 처음부터
    python -m backend.ksain.sync               # 10분 주기 (systemd timer)

증분 수집은 세 갈래입니다.

1. 개발자 API 로 게시판별 최신 30건을 받아 모르는 구 공간 번호를 가져옵니다
2. 두 공간 모두 아는 가장 큰 번호 다음부터 앞으로 훑습니다. 빈 번호가 `FORWARD_MISSES`
   개 이어지면 멈춥니다 — 100000번대 글은 목록 API 에 안 잡혀서 이게 유일한 길입니다
3. 최근 `--refresh-days` 일 글을 다시 받아 수정(해시 비교)과 삭제(`missing_since`)를 잡습니다

⚠️ 끝 부근의 빈 번호는 매번 다시 묻습니다. ksain 에는 예약 발행이 있어서, 번호는 먼저
잡히고 글은 나중에 보이는 경우가 있습니다.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json

from backend.ksain import extract
from backend.ksain.client import KsainClient, KsainError
from backend.ksain.db import SessionLocal, init_ksain_schema
from backend.ksain.models import Attachment, Board, Gap, Post, State

LEGACY_FIRST, NEW_FIRST = 1, 100001
SPACES = ((LEGACY_FIRST, NEW_FIRST - 1), (NEW_FIRST, 10**9))
FORWARD_MISSES = 30
RECHECK_TAIL = 60
KST = datetime.timezone(datetime.timedelta(hours=9))


def _kst(stamp: str | None) -> datetime.datetime | None:
    if not stamp:
        return None
    moment = datetime.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
    return moment.astimezone(KST).replace(tzinfo=None)


def _hash(doc: dict) -> str:
    basis = json.dumps([
        doc.get("title"), doc.get("content"), doc.get("engContent"),
        [a.get("path") for a in doc.get("attachments") or []],
    ], ensure_ascii=False)
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def store(db, doc: dict) -> tuple[Post, bool]:
    """응답 하나를 저장합니다. 두 번째 값은 새 글이거나 내용이 바뀌었는지."""
    post = db.get(Post, doc["id"])
    digest = _hash(doc)
    changed = post is None or post.content_hash != digest
    if post is None:
        post = Post(id=doc["id"])
        db.add(post)
    post.board_id = doc.get("boardID")
    post.board_name = doc.get("boardName")
    post.category = doc.get("category")
    post.writer = None if doc.get("isAnonymous") else doc.get("writer")
    post.title = (doc.get("title") or "").strip()
    post.eng_title = doc.get("engTitle")
    post.content_text = extract.html_to_text(doc.get("content"))
    post.eng_content_text = extract.html_to_text(doc.get("engContent")) or None
    post.posted_at = _kst(doc.get("timestamp"))
    post.read_count = doc.get("readCount")
    post.is_anonymous = bool(doc.get("isAnonymous"))
    post.content_hash = digest
    post.raw = {k: v for k, v in doc.items() if k not in ("embedding", "content", "engContent")}
    post.fetched_at = datetime.datetime.utcnow()
    post.missing_since = None

    if changed:
        known = {a.path: a for a in post.attachments}
        current, seen = [], set()
        for meta in doc.get("attachments") or []:
            # 같은 파일이 목록에 두 번 실려 오는 글이 있습니다
            if not meta.get("path") or meta["path"] in seen:
                continue
            seen.add(meta["path"])
            row = known.get(meta["path"]) or Attachment(path=meta["path"], status="pending")
            row.name, row.size, row.mime = meta.get("name") or meta["path"], meta.get("size"), meta.get("type")
            current.append(row)
        post.attachments = current
    if post.board_id is not None and doc.get("boardName"):
        board = db.get(Board, post.board_id)
        if board is None:
            db.add(Board(id=post.board_id, name=doc["boardName"]))
        else:
            board.name = doc["boardName"]
    db.query(Gap).filter(Gap.id == post.id).delete()
    # autoflush 를 끈 세션이라, 다음 글이 같은 게시판을 db.get 으로 찾으려면 여기서 내려야 합니다
    db.flush()
    return post, changed


def fetch(db, client: KsainClient, doc_id: int) -> bool:
    """있으면 저장하고 True. 없으면 빈 번호로 기록합니다."""
    doc = client.document(doc_id)
    if doc is None:
        db.merge(Gap(id=doc_id, checked_at=datetime.datetime.utcnow()))
        db.commit()
        return False
    store(db, doc)
    # 글마다 바로 커밋합니다 — 쓰기 잠금을 오래 쥐고 있으면 분석·검색 쪽이 기다립니다
    db.commit()
    return True


def _max_id(db, first: int, last: int) -> int | None:
    row = db.query(Post.id).filter(Post.id >= first, Post.id <= last).order_by(Post.id.desc()).first()
    return row[0] if row else None


def scan_forward(db, client: KsainClient, first: int, last: int, misses: int) -> int:
    top = _max_id(db, first, last)
    cursor = (top + 1) if top else first
    found, miss = 0, 0
    # 끝 부근의 빈 번호 — 예약 발행 글이 뒤늦게 보이는지 다시 묻습니다
    if top:
        for (gap_id,) in db.query(Gap.id).filter(Gap.id > top - RECHECK_TAIL, Gap.id < top).all():
            found += fetch(db, client, gap_id)
    while cursor <= last and miss < misses:
        if fetch(db, client, cursor):
            found, miss = found + 1, 0
        else:
            miss += 1
        cursor += 1
        if cursor % 50 == 0:
            db.commit()
    db.commit()
    return found


def backfill(db, client: KsainClient) -> int:
    """두 공간을 처음부터. 이미 아는 번호와 확인한 빈 번호는 건너뜁니다."""
    known = {row[0] for row in db.query(Post.id)} | {row[0] for row in db.query(Gap.id)}
    legacy_top = max([d["documentID"] for b in (0, 2) for d in client.latest(b)] + [_max_id(db, *SPACES[0]) or 0])
    found = 0
    for doc_id in range(LEGACY_FIRST, legacy_top + 1):
        if doc_id not in known:
            found += fetch(db, client, doc_id)
            if doc_id % 50 == 0:
                db.commit()
                print(f"  … {doc_id}/{legacy_top}", flush=True)
    db.commit()
    # 목록 API 키가 없으면 구 공간의 끝을 모르니 빈 번호를 넉넉히 허용하며 훑습니다
    legacy_misses = FORWARD_MISSES if legacy_top else 300
    found += scan_forward(db, client, *SPACES[0], misses=legacy_misses)
    found += scan_forward(db, client, *SPACES[1], misses=200)
    return found


def from_lists(db, client: KsainClient) -> int:
    boards = [row[0] for row in db.query(Board.id)] or [0]
    found = 0
    for board_id in boards:
        for item in client.latest(board_id):
            doc_id = item["documentID"]
            if db.get(Post, doc_id) is None:
                found += fetch(db, client, doc_id)
    db.commit()
    return found


def refresh(db, client: KsainClient, days: int) -> tuple[int, int]:
    since = datetime.datetime.now(KST).replace(tzinfo=None) - datetime.timedelta(days=days)
    changed = missing = 0
    for post in db.query(Post).filter(Post.posted_at >= since, Post.missing_since.is_(None)).all():
        doc = client.document(post.id)
        if doc is None:
            post.missing_since = datetime.datetime.utcnow()
            missing += 1
        else:
            changed += store(db, doc)[1]
    db.commit()
    return changed, missing


def extract_attachments(db, client: KsainClient, limit: int = 500) -> dict:
    counts: dict[str, int] = {}
    rows = db.query(Attachment).filter(Attachment.status == "pending").order_by(Attachment.post_id.desc()).limit(limit).all()
    for row in rows:
        ext = extract.extension(row.name)
        if ext in extract.IMAGE_EXT or not extract.readable(row.name):
            row.status = "unsupported"
        elif row.size and row.size > 25 * 1024 * 1024:
            row.status = "skipped"
        else:
            try:
                data = client.download(row.path)
                row.sha256 = hashlib.sha256(data).hexdigest()
                row.text = extract.attachment_text(row.name, data)
                row.status = "ok"
                row.error = None
            except Exception as error:  # 형식이 깨진 파일 하나가 수집 전체를 멈추면 안 됩니다
                row.status, row.error = "error", f"{type(error).__name__}: {error}"[:300]
        row.extracted_at = datetime.datetime.utcnow()
        counts[row.status] = counts.get(row.status, 0) + 1
        db.commit()
    return counts


def run(do_backfill: bool, refresh_days: int, attachments: bool) -> dict:
    init_ksain_schema()
    client = KsainClient()
    db = SessionLocal()
    summary: dict = {"started_at": datetime.datetime.utcnow().isoformat(timespec="seconds")}
    try:
        if do_backfill:
            summary["backfill"] = backfill(db, client)
        summary["from_lists"] = from_lists(db, client)
        summary["forward"] = sum(scan_forward(db, client, a, b, FORWARD_MISSES) for a, b in SPACES)
        summary["changed"], summary["missing"] = refresh(db, client, refresh_days)
        if attachments:
            summary["attachments"] = extract_attachments(db, client, limit=5000 if do_backfill else 300)
        summary["posts"] = db.query(Post).count()
        summary["ok"] = True
    except KsainError as error:
        db.rollback()
        summary.update(ok=False, error=str(error))
    finally:
        summary["finished_at"] = datetime.datetime.utcnow().isoformat(timespec="seconds")
        db.merge(State(key="sync", value=summary))
        db.commit()
        db.close()
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ksain 글 수집")
    parser.add_argument("--backfill", action="store_true", help="두 번호 공간을 처음부터 훑습니다")
    parser.add_argument("--refresh-days", type=int, default=14)
    parser.add_argument("--no-attachments", action="store_true")
    args = parser.parse_args()
    result = run(args.backfill, args.refresh_days, not args.no_attachments)
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result.get("ok") else 1)
