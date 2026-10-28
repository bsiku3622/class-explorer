"""ksain 글 분석 — 요약 · 중요도 · 태그 · 일정 항목.

    python -m backend.ksain.analyze                 # 밀린 글을 최신순으로 (기본 150건)
    python -m backend.ksain.analyze --limit 20 --model local:gemma4:12b
    python -m backend.ksain.analyze --post 3092 --dry-run
    python -m backend.ksain.analyze --reapply      # LLM 없이 학사일정만 다시 맞춤

글 내용(`content_hash`)이나 `ANALYZER_VERSION` 이 바뀐 글만 다시 돌립니다. 모델에 닿지
않으면(데스크탑이 꺼져 있으면) 그 자리에서 멈추고 다음 주기에 이어갑니다.

모델 출력은 그대로 믿지 않습니다 — `coerce()` 가 날짜·시각 형식, 허용된 분류·태그, 학년을
다시 거르고, 작년 공지를 복사해 연도만 안 고친 날짜(작성 시각보다 200일 넘게 과거)는 작성
연도로 바로잡습니다.
"""
from __future__ import annotations

import argparse
import datetime
import json
import re

from backend.agent import llm
from backend.core import clock
from backend.core.db import KsainSession, init_ksain_schema
from backend.ksain.models import Analysis, Attachment, Post

ANALYZER_VERSION = 3  # 2: 날짜 근거 검사(grounded) · 3: 시트별 첨부 발췌, 요약에도 근거 없는 날짜 금지
MAX_BODY = 5000
MAX_ATTACHMENT = 2500
MAX_ATTACHMENTS_TOTAL = 6000

TAGS = ["시험", "수업·수강", "R&E·연구", "필참교육", "행사", "대회·공모", "모집·선발", "생활·기숙사",
        "귀가·귀교", "급식", "학생회", "동아리·연구회", "입시", "시설", "장학·행정", "건의", "기타"]
KINDS = ["event", "deadline", "mandatory", "exam", "dorm", "recruit"]
# 자동 일정에 쓸 수 있는 분류. holiday·term 은 홈이 수업을 지우거나 방학을 판정하는 표지라 빼 둡니다
CATEGORIES = ["exam", "dorm", "academic", "event"]

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "importance": {"type": "integer", "minimum": 0, "maximum": 3},
        "tags": {"type": "array", "items": {"type": "string", "enum": TAGS}},
        "mandatory": {"type": "boolean"},
        "target_grades": {"type": "array", "items": {"type": "integer", "enum": [1, 2, 3]}},
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "kind": {"type": "string", "enum": KINDS},
                    "title": {"type": "string"},
                    # ⚠️ ["string", "null"] 유니언을 주면 Ollama 의 문법 제약이 null 로만 채웁니다.
                    # 문자열 하나로 두고 없으면 빈 문자열을 받습니다
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "target_grades": {"type": "array", "items": {"type": "integer", "enum": [1, 2, 3]}},
                    "calendar": {"type": "boolean"},
                    "confidence": {"type": "number"},
                },
                "required": ["kind", "title", "start_date", "end_date", "start_time", "end_time",
                             "category", "target_grades", "calendar", "confidence"],
            },
        },
    },
    "required": ["summary", "importance", "tags", "mandatory", "target_grades", "items"],
}

SYSTEM = f"""너는 KAIST 부설 한국과학영재학교(KSA) 커뮤니티 ksain 의 게시글을 정리하는 도우미다.
글 하나를 읽고 아래 JSON 만 출력한다. 설명이나 코드 블록은 쓰지 않는다.

- summary: 학생이 한눈에 알 수 있게 1~2문장. 날짜·장소·대상·해야 할 일을 담는다.
  날짜·시각은 본문이나 첨부 발췌에 적힌 것만 쓴다. 확인할 수 없으면 "자세한 일정은 첨부 참고" 라고 쓴다.
- importance: 0 = 개인적·잡담·감사 글, 1 = 일부 학생 관련(동아리 모집·홍보 등),
  2 = 다수 학생 관련 공지(행사·공모·생활 안내), 3 = 전교생이 놓치면 안 되는 것(시험·필참 교육·수강 변경·귀가 일정).
- tags: {", ".join(TAGS)} 중에서 고른다.
- mandatory: 참석·제출이 의무인 글("필참", "필독", "전원 참석", "반드시 제출")이면 true.
- target_grades: 대상 학년(1·2·3). 전교생이거나 알 수 없으면 빈 배열.
- items: 글에 나온 날짜 있는 일정·마감. 없으면 빈 배열. 많으면 중요한 것부터 최대 12개만.
  - kind: event(행사·교육·설명회), deadline(신청·제출 마감), mandatory(필참 교육), exam(시험), dorm(귀가·귀교·생활관), recruit(모집 기간)
  - title: 달력에 들어갈 짧은 이름(20자 안팎). 예: "TISF 2027 참가 신청 마감", "성인지감수성 교육(필참)"
  - start_date / end_date: YYYY-MM-DD. 하루짜리면 end_date 는 start_date 와 같게. 신청 기간처럼 기간이 길면 마감일 하루만 deadline 으로 적는다.
  - start_time / end_time: HH:MM (24시간). 본문이나 제목에 시각이 있으면 반드시 채운다
    ("09:00~09:20" → "09:00", "09:20" / "13시" → "13:00"). 정말 없을 때만 빈 문자열 "".
  - 연도가 없으면 작성 시각을 기준으로 가장 가까운 날짜로 정한다.
  - category: exam(시험), dorm(귀가·귀교·생활관), academic(수업·수강·연구·교육·학사), event(그 밖의 행사·모집)
  - target_grades: 그 항목의 대상 학년. 학년마다 날짜·시각이 다르면 학년별로 항목을 나누고 이 칸을 채운다.
  - calendar: 학교·학생회가 공지한 일정 가운데 한 학년 이상 또는 다수 학생이 대상인 것
    (행사·교육·시험·귀가/귀교·설명회, R&E 보고서·포스터 제출 같은 학년 단위 마감, 대회·장학 신청 마감)은 true.
    개인 글, 동아리·연구회 내부 일정, 회의 결과 보고, 이미 끝난 일의 결과 발표, 단순 홍보는 false.
  - confidence: 날짜를 글에서 직접 읽었으면 0.9 이상, 추정했으면 0.6 이하.
"""


def _weekday(day: datetime.date) -> str:
    return "월화수목금토일"[day.weekday()]


def prompt(post: Post) -> str:
    posted = post.posted_at
    lines = [
        f"게시판: {post.board_name or post.board_id} / 분류: {post.category or '-'}",
        f"작성: {post.writer or '익명'} · {posted:%Y-%m-%d %H:%M}({_weekday(posted.date())})" if posted else "작성: -",
        f"제목: {post.title}",
        "본문:",
        post.content_text[:MAX_BODY] or "(본문 없음)",
    ]
    budget = MAX_ATTACHMENTS_TOTAL
    for att in post.attachments:
        lines.append(f"[첨부] {att.name}")
        if att.status == "ok" and att.text and budget > 0:
            excerpt = _excerpt(att.text, min(MAX_ATTACHMENT, budget))
            budget -= len(excerpt)
            lines.append(excerpt)
    return "\n".join(lines)


def _excerpt(text: str, limit: int) -> str:
    """첨부 발췌. xlsx 는 시트마다 앞부분을 고르게 나눠 담습니다.

    ⚠️ 앞에서부터 자르면 첫 시트만 보입니다. 기말고사 공지(3092)는 첫 시트가 `수강 현황`
    (명단 머리)이고 날짜는 둘째 시트에 있어서, 모델이 날짜를 못 보고 "11/1 기말고사" 를
    지어냈습니다.
    """
    sheets = [s for s in text.split("\n\n[시트:") if s.strip()]
    if len(sheets) <= 1:
        return text[:limit]
    share = max(300, limit // len(sheets))
    parts = [(s if i == 0 else "[시트:" + s)[:share] for i, s in enumerate(sheets)]
    return "\n\n".join(parts)[:limit]


def _date(value) -> datetime.date | None:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value.strip()):
        return None
    try:
        return datetime.date.fromisoformat(value.strip())
    except ValueError:
        return None


def _time(value) -> str | None:
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match or int(match[1]) > 23 or int(match[2]) > 59:
        return None
    return f"{int(match[1]):02d}:{match[2]}"


def _grades(value) -> list[int]:
    grades = sorted({g for g in value if isinstance(g, int) and g in (1, 2, 3)}) if isinstance(value, list) else []
    # 세 학년 전부는 "전학년" 이라 학사일정의 관례대로 비워 둡니다
    return [] if grades == [1, 2, 3] else grades


def _fix_year(day: datetime.date, posted: datetime.date | None) -> datetime.date:
    """작년 공지를 복사해 연도만 안 고친 날짜를 작성 연도로 옮깁니다."""
    if posted is None or (posted - day).days <= 200:
        return day
    try:
        moved = day.replace(year=posted.year)
    except ValueError:
        return day
    return moved if (posted - moved).days <= 60 else day


def source_text(post: Post) -> str:
    parts = [post.title, post.content_text, post.eng_content_text or ""]
    parts += [a.text or "" for a in post.attachments if a.status == "ok"]
    return "\n".join(parts)


def grounded(day: datetime.date, text: str) -> bool:
    """그 날짜가 글 어딘가에 적혀 있는가 — "12.11", "12/11", "12월 11일", "2026-12-11".

    ⚠️ 모델은 본문에 없는 날짜를 지어냅니다. 3092번(기말고사 시간표 안내)은 날짜가 첨부
    xlsx 에만 있는데, 첨부를 못 읽은 상태에서 "11/1 기말고사" 를 만들어 냈습니다. 근거가 없는
    항목은 정보로만 남기고 학사일정에는 넣지 않습니다.
    """
    pattern = rf"(?<!\d)0?{day.month}\s*(?:[./\-]|월)\s*0?{day.day}(?!\d)"
    return re.search(pattern, text) is not None


def coerce(raw: dict, post: Post) -> dict:
    posted = post.posted_at.date() if post.posted_at else None
    text = source_text(post)
    items = []
    for item in raw.get("items") or []:
        if not isinstance(item, dict):
            continue
        start = _date(item.get("start_date"))
        if start is None:
            continue
        start = _fix_year(start, posted)
        end = _date(item.get("end_date"))
        end = _fix_year(end, posted) if end else start
        if end < start:
            end = start
        category = item.get("category") if item.get("category") in CATEGORIES else "event"
        items.append({
            "kind": item.get("kind") if item.get("kind") in KINDS else "event",
            "title": str(item.get("title") or post.title).strip()[:60],
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "start_time": _time(item.get("start_time")),
            "end_time": _time(item.get("end_time")),
            "category": category,
            "target_grades": _grades(item.get("target_grades")),
            "calendar": bool(item.get("calendar")),
            "confidence": max(0.0, min(1.0, float(item.get("confidence") or 0))),
            "grounded": grounded(start, text),
        })
    importance = raw.get("importance")
    return {
        "summary": str(raw.get("summary") or "").strip()[:500],
        "importance": importance if isinstance(importance, int) and 0 <= importance <= 3 else 0,
        "tags": [t for t in raw.get("tags") or [] if t in TAGS][:5],
        "mandatory": bool(raw.get("mandatory")),
        "target_grades": _grades(raw.get("target_grades")),
        "items": items,
    }


def parse(content: str) -> dict:
    text = content.strip()
    fenced = re.search(r"\{.*\}", text, re.S)
    if not fenced:
        raise ValueError("JSON 이 없습니다")
    return json.loads(fenced.group(0))


def analyze_post(post: Post, model: llm.Model) -> dict:
    message = llm.chat_sync(model, [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt(post)},
    ], schema=SCHEMA, max_tokens=3000)
    if message.get("finish_reason") == "length":
        raise ValueError("출력이 한도에서 잘렸습니다")
    return coerce(parse(message.get("content") or ""), post)


def pending(db, limit: int):
    from sqlalchemy import or_
    return (
        db.query(Post)
        .outerjoin(Analysis, Analysis.post_id == Post.id)
        .filter(Post.missing_since.is_(None), or_(
            Analysis.post_id.is_(None),
            Analysis.content_hash != Post.content_hash,
            Analysis.version < ANALYZER_VERSION,
        ))
        # 첨부를 아직 못 읽은 글은 미룹니다 — 날짜가 첨부에만 있는 공지가 많고, 첨부 텍스트는
        # content_hash 에 안 들어가서 한 번 분석하면 다시 돌지 않습니다
        .filter(~Post.attachments.any(Attachment.status == "pending"))
        .order_by(Post.posted_at.desc())
        .limit(limit)
        .all()
    )


def save(db, post: Post, result: dict, model: llm.Model) -> Analysis:
    row = post.analysis or Analysis(post_id=post.id)
    row.content_hash = post.content_hash
    row.version = ANALYZER_VERSION
    row.model = model.id
    row.summary = result["summary"]
    row.importance = result["importance"]
    row.tags = result["tags"]
    row.mandatory = result["mandatory"]
    row.target_grades = result["target_grades"]
    row.items = result["items"]
    row.error = None
    row.analyzed_at = clock.utcnow()
    if post.analysis is None:
        db.add(row)
    return row


def run(limit: int, model_id: str | None, post_id: int | None = None, dry_run: bool = False,
        apply_calendar: bool = True) -> dict:
    from backend.ksain import apply

    init_ksain_schema()
    model = llm.resolve(model_id, "analyze")
    db = KsainSession()
    counts = {"analyzed": 0, "failed": 0, "events": 0, "model": model.id}
    try:
        posts = [db.get(Post, post_id)] if post_id else pending(db, limit)
        for post in posts:
            if post is None:
                continue
            try:
                result = analyze_post(post, model)
            except llm.LLMError as error:
                counts["stopped"] = str(error)[:200]
                break
            except (ValueError, TypeError) as error:
                counts["failed"] += 1
                print(f"  ! {post.id}: {error}", flush=True)
                # 실패도 기록합니다 — 안 남기면 그 글이 "밀린 글" 로 남아 10분마다 같은 실패를
                # 되풀이하며 GPU 를 씁니다. 글이 바뀌거나 버전을 올리면 다시 돕니다
                if not dry_run:
                    failed = save(db, post, {"summary": None, "importance": 0, "tags": [], "mandatory": False,
                                             "target_grades": [], "items": []}, model)
                    failed.error = str(error)[:300]
                    db.commit()
                continue
            if dry_run:
                print(json.dumps({"id": post.id, "title": post.title, **result}, ensure_ascii=False, indent=1))
                continue
            analysis = save(db, post, result, model)
            db.commit()
            counts["analyzed"] += 1
            if apply_calendar:
                counts["events"] += apply.apply_post(post, analysis)
                db.commit()
            print(f"  · {post.id} [{result['importance']}] {post.title[:40]} — items {len(result['items'])}", flush=True)
        if apply_calendar and not dry_run:
            counts["removed"] = apply.remove_missing(db)
            db.commit()
    finally:
        db.close()
    return counts


def reapply(fresh: bool = False) -> dict:
    """LLM 을 부르지 않고 저장된 분석으로 학사일정만 다시 맞춥니다.

    분석을 다른 DB(스테이징)에서 미리 돌렸거나 `apply.py` 규칙을 바꿨을 때 씁니다. 반영
    기록(`applied`)은 그 DB 의 일정 번호라 여기서는 비우고 시작합니다 — 남겨 두면 "사람이
    지운 일정" 으로 오해해 전부 막아 버립니다.

    사람이 지워 둔 기록(`suppressed`)은 평소엔 남깁니다. ⚠️ **스테이징에서 만든 분석을 운영에
    처음 반영할 때는 `fresh=True`** 로 그것까지 비우세요 — 스테이징 사본에서 지운 일정이
    운영에서도 막힙니다.
    """
    from backend.ksain import apply

    init_ksain_schema()
    db = KsainSession()
    created = 0
    try:
        rows = db.query(Analysis).join(Post).filter(Post.missing_since.is_(None)).all()
        for row in rows:
            row.applied = []
            if fresh:
                row.suppressed = []
            created += apply.apply_post(row.post, row)
            db.commit()
        removed = apply.remove_missing(db)
        db.commit()
    finally:
        db.close()
    return {"analyses": len(rows), "events": created, "removed": removed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ksain 글 분석")
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--model", default=None, help="예: local:gemma4:12b, openai:gpt-5-mini")
    parser.add_argument("--post", type=int, default=None, help="글 하나만")
    parser.add_argument("--dry-run", action="store_true", help="저장하지 않고 결과만 출력")
    parser.add_argument("--no-calendar", action="store_true", help="학사일정에 반영하지 않음")
    parser.add_argument("--reapply", action="store_true", help="분석 없이 저장된 결과로 학사일정만 다시 맞춤")
    parser.add_argument("--fresh", action="store_true", help="--reapply 때 '사람이 지운 일정' 기록까지 비움 (첫 운영 반영)")
    args = parser.parse_args()
    if args.reapply:
        print(json.dumps(reapply(args.fresh), ensure_ascii=False))
    else:
        print(json.dumps(run(args.limit, args.model, args.post, args.dry_run, not args.no_calendar), ensure_ascii=False))
