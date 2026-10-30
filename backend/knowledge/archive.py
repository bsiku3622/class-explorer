"""멘토링 아카이브 색인 읽기 — 학업봉사부가 모은 과목별 자료(기출·모의고사·멘토링·정리 …)·학업보조 책자·전공 설명회.

`cli/index_archive.py` 가 맥북에서 만들어 올린 `archive.db` 를 읽기만 합니다. Ask 의 `archive` 도구가 씁니다.

- **원본은 서버에 없습니다.** 묶음의 이름(과목·연도·유형)과 Drive 링크, 일부 묶음의 글 조각만 있습니다. 파일은 Drive 권한이
  있는 사람만 링크로 엽니다. 묶음 대부분(정리·발표자료·보고서)은 링크만 있고 글 조각이 없습니다
- ⚠️ **학생 이름·학번은 저장하지 않습니다.** 폴더 이름에 "미적분학2_2025_서승재(24-045)_정리" 처럼 들어 있어서 색인할 때 지웁니다
- ⚠️ **데스크탑 모델로 물을 때만 씁니다**(`agent/tools.py`). 아카이브의 "당부의 말씀" 이 본인 학업·교내 멘토링 밖의 복제·유출을
  금합니다. 운영자가 이 서비스(10명 미만)의 학업 용도로 판단해 넣었고, 이용자가 OpenAI 를 고르면 바깥으로 나가지 않게 막습니다
"""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

from backend.core import config
from backend.core.db import main_db_file
from backend.knowledge.text import fts_query, query_terms
from backend.services.subject_names import rank_names

SCHEMA = """
CREATE TABLE IF NOT EXISTS packs (
    id INTEGER PRIMARY KEY, key TEXT UNIQUE NOT NULL, grp TEXT, course TEXT, year TEXT, kind TEXT, title TEXT, url TEXT,
    summary TEXT, status TEXT NOT NULL DEFAULT 'listed');
CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, pack_id INTEGER NOT NULL, file TEXT, text TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS chunks_pack ON chunks(pack_id);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(tokens, tokenize='unicode61 remove_diacritics 0');
"""
# 어떤 묶음을 먼저 보여 주는가 — 평가와 가까운 것부터
_KIND_ORDER = ["기출", "모의고사", "중간고사", "기말고사", "문제", "문제풀이", "풀이", "답지", "멘토링", "정리", "노트정리"]


def db_file() -> Path:
    return Path(config.ARCHIVE_DB).resolve() if config.ARCHIVE_DB else main_db_file().parent / "archive.db"


def _connect() -> sqlite3.Connection | None:
    path = db_file()
    if not path.exists():
        return None
    db = sqlite3.connect(f"{path.as_uri()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    return db


def plain_course(course: str | None) -> str:
    """`미적분학2 (Calculus 2)` → `미적분학2`"""
    return re.sub(r"\s*\(.*$", "", course or "").strip()


def _rank(kind: str | None) -> int:
    return _KIND_ORDER.index(kind) if kind in _KIND_ORDER else len(_KIND_ORDER)


def _pack(row: sqlite3.Row) -> dict:
    out = {"course": plain_course(row["course"]), "year": row["year"], "kind": row["kind"], "title": row["title"],
           "url": row["url"]}
    return {key: value for key, value in out.items() if value}


def search(query: str | None, subject: str | None = None, limit: int = 6) -> dict | None:
    """`{course, materials, results}` — 색인이 없으면 None.

    `subject` 를 주면 그 과목에 어떤 자료가 몇 개 있는지(`materials`)와, 그 과목 안에서 `query` 에 맞는 글 조각을 줍니다. 글 조각이
    없으면 평가와 가까운 유형·최근 연도 순으로 링크를 줍니다.
    """
    db = _connect()
    if db is None:
        return None
    try:
        course = None
        if subject:
            names = {plain_course(r["course"]): r["course"]
                     for r in db.execute("SELECT DISTINCT course FROM packs WHERE course <> ''")}
            ranked = rank_names(subject, names)
            course = names[ranked[0]] if ranked else None
            if course is None:
                return {"course": None, "materials": {}, "results": []}
        out: dict = {"course": plain_course(course) or None, "materials": {}, "results": []}
        if course:
            for row in db.execute("SELECT kind, count(*) AS n, min(year) AS first, max(year) AS last FROM packs "
                                  "WHERE course = ? GROUP BY kind", (course,)):
                out["materials"][row["kind"] or "기타"] = f"{row['n']}개 ({row['first']}~{row['last']})"
        match = fts_query(query_terms(query))
        seen: set[int] = set()
        if match:
            sql = ("SELECT c.pack_id, c.file, c.text, p.* FROM chunks_fts f JOIN chunks c ON c.id = f.rowid "
                   "JOIN packs p ON p.id = c.pack_id WHERE chunks_fts MATCH ?")
            args: list = [match]
            if course:
                sql += " AND p.course = ?"
                args.append(course)
            for row in db.execute(sql + " ORDER BY bm25(chunks_fts) LIMIT 40", args):
                if row["pack_id"] in seen:
                    continue
                seen.add(row["pack_id"])
                out["results"].append({**_pack(row), "summary": row["summary"], "file": row["file"],
                                       "passage": row["text"][:500]})
                if len(out["results"]) >= limit:
                    break
        # 글 조각이 없는 묶음도 제목으로는 찾습니다 — "학업보조 책자" · "전공 설명회"
        for term in query_terms(query) if not course else []:
            for row in db.execute("SELECT * FROM packs WHERE title LIKE ? OR grp LIKE ? LIMIT 12", (f"%{term}%", f"%{term}%")):
                if row["id"] not in seen and len(out["results"]) < limit:
                    seen.add(row["id"])
                    out["results"].append(_pack(row))
        if course and len(out["results"]) < limit:
            rows = db.execute("SELECT * FROM packs WHERE course = ?", (course,)).fetchall()
            rows.sort(key=lambda r: (_rank(r["kind"]), -int(r["year"] or 0)))
            for row in rows:
                if row["id"] not in seen and len(out["results"]) < limit:
                    seen.add(row["id"])
                    item = _pack(row)
                    if row["summary"]:
                        item["summary"] = row["summary"]
                    out["results"].append(item)
        return out
    finally:
        db.close()
