"""ksain 글 분석 — 요약 · 중요도 · 태그 · 일정 항목 · 사실(기억).

    python -m backend.ksain.analyze                 # 밀린 글을 최신순으로 (기본 150건)
    python -m backend.ksain.analyze --limit 20 --model local:gemma4:12b
    python -m backend.ksain.analyze --post 3092 --dry-run
    python -m backend.ksain.analyze --reapply      # LLM 없이 학사일정·기억만 다시 맞춤

분석 결과는 두 곳으로 옮겨 적습니다 — 날짜 있는 일정은 공용 학사일정(`apply.py`), 사실은 기억
(`knowledge/facts.py`). 둘 다 본 DB 에 있고, 글 하나를 마칠 때마다 커밋합니다.

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
import time

from sqlalchemy import and_, or_

from backend import models
from backend.agent import llm
from backend.core import clock
from backend.core.db import KsainSession, SessionLocal, init_ksain_schema, init_schema
from backend.knowledge import facts as memory
from backend.ksain.models import Analysis, Attachment, Post
from backend.services import majors

ANALYZER_VERSION = 5  # 2: 날짜 근거 검사(grounded) · 3: 시트별 첨부 발췌, 요약에도 근거 없는 날짜 금지
#                       4: 사실(기억) · 5: 사실에서 날짜를 빼고(날짜는 일정으로), 일정·사실에 대상 전공
# 버전을 올렸을 때 다시 돌리는 범위 — 최근 1년의 글만(게시판·중요도와 상관없이). 전부 다시 돌리면
# 데스크탑 GPU 로 하루가 넘습니다. 새 글과 내용이 바뀐 글은 이 범위와 상관없이 늘 돕니다
REANALYZE_DAYS = 365
MAX_FACTS = 6
# 일정 세부(detail) 길이 — 날짜 때문에 사실에서 빠진 문장을 덧붙이면 이만큼까지 늘어납니다
MAX_DETAIL = 200
MAX_DETAIL_MERGED = 500
MAX_BODY = 5000
MAX_ATTACHMENT = 2500
MAX_ATTACHMENTS_TOTAL = 6000

TAGS = ["시험", "수업·수강", "R&E·연구", "필참교육", "행사", "대회·공모", "모집·선발", "생활·기숙사",
        "귀가·귀교", "급식", "학생회", "동아리·연구회", "입시", "시설", "장학·행정", "건의", "기타"]
KINDS = ["event", "deadline", "mandatory", "exam", "dorm", "recruit"]
# 대상 전공 — 트랙 여섯과 학부 셋. 학부는 coerce 가 트랙 둘로 풉니다 (services/majors.py)
MAJOR_NAMES = [*majors.MAJORS, *majors.DIVISIONS]
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
                    "detail": {"type": "string"},
                    # ⚠️ ["string", "null"] 유니언을 주면 Ollama 의 문법 제약이 null 로만 채웁니다.
                    # 문자열 하나로 두고 없으면 빈 문자열을 받습니다
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "start_time": {"type": "string"},
                    "end_time": {"type": "string"},
                    "category": {"type": "string", "enum": CATEGORIES},
                    "target_grades": {"type": "array", "items": {"type": "integer", "enum": [1, 2, 3]}},
                    "target_majors": {"type": "array", "items": {"type": "string", "enum": MAJOR_NAMES}},
                    "calendar": {"type": "boolean"},
                    "confidence": {"type": "number"},
                },
                "required": ["kind", "title", "detail", "start_date", "end_date", "start_time", "end_time",
                             "category", "target_grades", "target_majors", "calendar", "confidence"],
            },
        },
        "facts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "statement": {"type": "string"},
                    "topic": {"type": "string"},
                    "valid_until": {"type": "string"},
                    "target_grades": {"type": "array", "items": {"type": "integer", "enum": [1, 2, 3]}},
                    "target_majors": {"type": "array", "items": {"type": "string", "enum": MAJOR_NAMES}},
                    "confidence": {"type": "number"},
                },
                "required": ["statement", "topic", "valid_until", "target_grades", "target_majors", "confidence"],
            },
        },
    },
    "required": ["summary", "importance", "tags", "mandatory", "target_grades", "items", "facts"],
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
  - detail: 그 일정에 딸린 세부 — 장소·버스 시각·준비물·제출 방법처럼 학생이 그날 알아야 할 것을 한두 문장
    (150자 안팎). facts 에 쓸 수 없는 날짜 딸린 정보는 여기에 적는다. 학생·졸업생 이름은 쓰지 않는다.
    없으면 빈 문자열 "".
  - start_date / end_date: YYYY-MM-DD. 하루짜리면 end_date 는 start_date 와 같게. 신청 기간처럼 기간이 길면 마감일 하루만 deadline 으로 적는다.
  - start_time / end_time: HH:MM (24시간). 본문이나 제목에 시각이 있으면 반드시 채운다
    ("09:00~09:20" → "09:00", "09:20" / "13시" → "13:00"). 정말 없을 때만 빈 문자열 "".
  - 연도가 없으면 작성 시각을 기준으로 가장 가까운 날짜로 정한다.
  - category: exam(시험), dorm(귀가·귀교·생활관), academic(수업·수강·연구·교육·학사), event(그 밖의 행사·모집)
  - target_grades: 그 항목의 대상 학년. 학년마다 날짜·시각이 다르면 학년별로 항목을 나누고 이 칸을 채운다.
  - target_majors: 그 항목의 대상 전공 트랙(수학·정보과학·물리학·지구과학·화학·생물학). 학부 단위면 학부 이름
    (수리정보과학부·물리지구과학부·화학생물학부)을 적는다. 전공과 상관없거나 모르면 빈 배열.
  - calendar: 학교·학생회가 공지한 일정 가운데 학년·학부·전공 단위나 다수 학생이 대상인 것
    (행사·교육·시험·귀가/귀교·설명회, R&E 보고서·포스터 제출 같은 학년 단위 마감, 학부·전공 트랙 행사와 마감,
    대회·장학 신청 마감)은 true. 대상이 일부 학년·전공이면 target_grades·target_majors 에 적는다.
    개인 글, 동아리·연구회 내부 일정, 회의 결과 보고, 이미 끝난 일의 결과 발표, 단순 홍보는 false.
  - confidence: 날짜를 글에서 직접 읽었으면 0.9 이상, 추정했으면 0.6 이하.
- facts: 나중에 학생이 물어볼 만한 사실을 글에서 최대 6개. 없으면 빈 배열.
  ⚠️ 날짜(몇 월 며칠·요일이 붙은 날)와 마감 시각은 facts 에 쓰지 않는다 — 날짜가 있는 정보는 모두 items 로 가고,
  그 일정의 세부는 그 항목의 detail 에 적는다.
  facts 에는 날짜 없이도 맞는 정보만 고른다: 방법·장소·대상·준비물·제출 양식·기준·규칙·바뀐 점·
  결과(선발·수상)·담당 부서. 일정에 딸린 정보라면 날짜를 빼고 행사·제도 이름으로 적는다
  ("R&E 최종보고서는 지도교원 검토 뒤 PDF 로 제출한다").
  - statement: 글을 안 읽은 사람이 봐도 뜻이 통하는 한 문장. "이번", "위", "본 행사", "해당" 대신
    행사·제도의 이름을 쓴다. 본문·첨부에 적힌 것만 쓴다. 매일·매주처럼 반복되는 시각("평일 16:00~22:30")은 괜찮다.
  - topic: 같은 주제를 묶는 짧은 이름(15자 안팎). 예: "R&E 최종보고서 제출", "외출 신청"
  - valid_until: 이 사실이 더는 쓸모없어지는 날(YYYY-MM-DD). 규칙·방법처럼 계속 유효하면 "".
  - target_grades: 대상 학년. 전교생이거나 알 수 없으면 빈 배열.
  - target_majors: 대상 전공 트랙이나 학부 (items 와 같은 규칙). 전공과 상관없으면 빈 배열.
  - confidence: 글에 그대로 적혀 있으면 0.9 이상, 해석이 들어갔으면 0.6 이하.
  - 전화번호·이메일·학번·성적, 학생·졸업생의 이름 같은 개인 정보는 쓰지 않는다
    ("배준수(KSA18) 선배가 진행" → "졸업생 선배가 진행"). 교사 이름은 담당·문의처를 말할 때만 쓴다.
    사람을 칭찬하거나 평가하는 말은 사실로 쓰지 않는다.
  - 감사 인사·잡담처럼 다른 학생이 물어볼 정보가 없는 글이면 빈 배열.
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


def coerce(raw: dict, post: Post, names: re.Pattern | None = None) -> dict:
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
            "detail": _detail(item.get("detail"), names),
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "start_time": _time(item.get("start_time")),
            "end_time": _time(item.get("end_time")),
            "category": category,
            "target_grades": _grades(item.get("target_grades")),
            "target_majors": majors.normalize(item.get("target_majors")),
            "calendar": bool(item.get("calendar")),
            "confidence": max(0.0, min(1.0, float(item.get("confidence") or 0))),
            "grounded": grounded(start, text),
        })
    facts, dated = coerce_facts(raw.get("facts"), post, names)
    _attach_dated(items, dated)
    importance = raw.get("importance")
    importance = importance if isinstance(importance, int) and 0 <= importance <= 3 else 0
    return {
        "summary": str(raw.get("summary") or "").strip()[:500],
        "importance": importance,
        "tags": [t for t in raw.get("tags") or [] if t in TAGS][:5],
        "mandatory": bool(raw.get("mandatory")),
        "target_grades": _grades(raw.get("target_grades")),
        "items": items,
        "facts": facts,
    }


# 특정한 날을 가리키는 말 — "11월 29일"·"11월 귀가" 처럼 달이 적힌 것, "2026. 11. 29."·"2026-11-29"·
# "11. 29."·"11/29"·"귀가일(3/2)", 날짜 뒤에 붙는 요일 "(금)".
# ⚠️ "3.5"·"1.5배"·"1/3 이상" 은 날짜가 아닙니다. 평점·결석 비율 같은 기준이 기억의 단골이라, 숫자 둘만
# 있으면 날짜로 보지 않고 연도·끝 마침표·요일·괄호·"까지" 가 붙거나 두 자리 수가 든 슬래시("11/13")만
# 날짜로 봅니다. 소수는 괄호를 봐 주지 않습니다 — "A-(3.7)" 같은 평점이 괄호에 듭니다
_DATED = re.compile(
    r"(?<!\d)(?:1[0-2]|0?[1-9])\s*월(?!\s*요일)"
    r"|\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}"
    r"|(?<![\d.])(?:1[0-2]|0?[1-9])\s*\.\s*(?:3[01]|[12]\d|0?[1-9])\s*\.(?!\d)"
    r"|(?<![\d/])(?:1[0-2]/(?:3[01]|[12]\d|0?[1-9])|0?[1-9]/(?:3[01]|[12]\d)"
    r"|0?[1-9]/0?[1-9](?=\s*(?:[()~]|까지|부터)))(?![\d/])"
    r"|\((?:월|화|수|목|금|토|일)\)"
)
# 기억에 남기지 않는 것 — 학번은 사실째 버리고, 전화번호·이메일은 문장에서 걷어냅니다
_STUDENT_ID = re.compile(r"(?<!\d)\d{2}-\d{3}(?!\d)")
_CONTACT = re.compile(r"\(?\s*(?:\d{2,3}-\d{3,4}-\d{4}|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)\s*\)?")
# 졸업생을 가리키는 꼴 — "배준수(KSA18) 선배". 지금 학생 명단에 없어서 `student_names` 로는 못 잡습니다
_ALUMNUS = re.compile(r"[가-힣]{2,4}\s*\(\s*KSA\s*\d{2}\s*\)", re.I)


def student_names(db) -> re.Pattern | None:
    """학생 이름 — 사실·일정 세부에 들어가면 그 문장을 버립니다. `run` 이 본 DB 에서 한 번 만들어 넘깁니다.

    세 글자 이상 한글 이름만 봅니다. 두 글자 이름은 "이수"·"정보" 같은 낱말과 겹칩니다(그건 지시문이 막습니다).
    """
    names = {name for (name,) in db.query(models.Student.name) if name and re.fullmatch(r"[가-힣]{3,4}", name)}
    return re.compile("|".join(sorted(map(re.escape, names), key=len, reverse=True))) if names else None


def _personal(text: str, names: re.Pattern | None) -> bool:
    """학번·졸업생 표기·학생 이름이 든 문장인가 — 기억과 일정 메모에 남기지 않습니다.

    기억은 질문마다 프롬프트에 실리고, 일정 메모는 달력에서 모두에게 보입니다. 모든 글(감사 글·선거 글
    포함)에서 사실을 뽑으면서 이름이 섞일 자리가 늘었습니다.
    """
    return bool(_STUDENT_ID.search(text) or _ALUMNUS.search(text) or (names and names.search(text)))


def _detail(value, names: re.Pattern | None = None) -> str:
    """일정 세부 — 자동 일정의 메모가 됩니다(`apply._event`). 연락처는 걷어내고, 학번·이름이 든 문장은 뺍니다."""
    detail = _drop_contacts(str(value or ""))[:MAX_DETAIL]
    return " ".join(part for part in re.split(r"(?<=[.!?])\s+", detail) if part and not _personal(part, names))


def _attach_dated(items: list[dict], dated: list[str]) -> None:
    """날짜 때문에 사실에서 뺀 문장을 그 날짜의 일정 세부에 붙입니다 — 날짜가 든 정보는 학사일정이 맡습니다.

    모델은 지시를 어기고 "귀가일(11/13) 학교버스는 16:40, 17:30 에 운행" 처럼 날짜를 단 사실을 씁니다.
    그냥 버리면 버스 시각이 어디에도 안 남아서, 문장에 적힌 날짜(`grounded` 와 같은 꼴)가 시작일이나
    끝날인 일정을 찾아 붙입니다. 맞는 일정이 없으면 버립니다 — 글은 검색으로 여전히 찾을 수 있습니다.
    """
    for statement in dated:
        for item in items:
            days = {datetime.date.fromisoformat(item["start_date"]), datetime.date.fromisoformat(item["end_date"])}
            if any(grounded(day, statement) for day in days):
                if statement not in item["detail"]:
                    item["detail"] = " ".join(x for x in (item["detail"], statement) if x)[:MAX_DETAIL_MERGED]
                break


def _drop_contacts(statement: str) -> str:
    """전화번호·이메일을 걷어냅니다. 뒤에 조사가 붙어 있으면 앞말에 붙여 "이메일 로" 가 남지 않게."""
    marked = _CONTACT.sub("\x00", statement)
    marked = re.sub(r"\s*\x00\s*(?=(?:으로|로|에게|에|을|를)(?:\s|$))", "", marked)
    return re.sub(r"\s+", " ", marked.replace("\x00", " ")).strip()


def coerce_facts(raw: list | None, post: Post, names: re.Pattern | None = None) -> tuple[list[dict], list[str]]:
    """모델이 뽑은 사실을 거릅니다. (남길 사실, 날짜가 들어 뺀 문장) 을 돌려줍니다.

    ⚠️ **날짜가 든 사실은 기억에 남기지 않습니다**(`_DATED`). 날짜는 일정(items → 학사일정)이 맡습니다 —
    기억은 질문마다 시스템 프롬프트에 실려서, 마감이 연장되거나 매니저가 학사일정을 고쳐도 옛 날짜가 그대로
    남습니다. 지시문에서도 막지만 모델이 가끔 어겨서 여기서 한 번 더 거르고, 뺀 문장은 `_attach_dated` 가
    그 날짜의 일정 세부로 옮깁니다.
    """
    posted = post.posted_at.date() if post.posted_at else None
    out = []
    dated = []
    for item in raw or []:
        if not isinstance(item, dict):
            continue
        statement = _drop_contacts(str(item.get("statement") or ""))
        if not 10 <= len(statement) <= 220 or _personal(statement, names):
            continue
        if _DATED.search(statement):
            dated.append(statement)
            continue
        until = _date(item.get("valid_until"))
        until = _fix_year(until, posted) if until else None
        if until and posted and until < posted:
            until = None  # 글보다 앞선 "유효 기한" 은 모델의 실수입니다
        out.append({
            "statement": statement,
            "topic": str(item.get("topic") or "").strip()[:40] or statement[:30],
            "valid_until": until.isoformat() if until else None,
            "target_grades": _grades(item.get("target_grades")),
            "target_majors": majors.normalize(item.get("target_majors")),
            "confidence": max(0.0, min(1.0, float(item.get("confidence") or 0))),
        })
        if len(out) >= MAX_FACTS:
            break
    return out, dated


def parse(content: str) -> dict:
    text = content.strip()
    fenced = re.search(r"\{.*\}", text, re.S)
    if not fenced:
        raise ValueError("JSON 이 없습니다")
    return json.loads(fenced.group(0))


def analyze_post(post: Post, model: llm.Model, names: re.Pattern | None = None) -> dict:
    message = llm.chat_sync(model, [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": prompt(post)},
    ], schema=SCHEMA, max_tokens=3000)
    if message.get("finish_reason") == "length":
        raise ValueError("출력이 한도에서 잘렸습니다")
    return coerce(parse(message.get("content") or ""), post, names)


def pending(db, limit: int):
    recent = clock.now_naive() - datetime.timedelta(days=REANALYZE_DAYS)
    return (
        db.query(Post)
        .outerjoin(Analysis, Analysis.post_id == Post.id)
        .filter(Post.missing_since.is_(None), or_(
            Analysis.post_id.is_(None),
            Analysis.content_hash != Post.content_hash,
            # 버전업 재분석은 최근 1년의 글만 — REANALYZE_DAYS
            and_(Analysis.version < ANALYZER_VERSION, Post.posted_at >= recent),
        ))
        # 첨부를 아직 못 읽은 글은 미룹니다 — 날짜가 첨부에만 있는 공지가 많고, 첨부 텍스트는
        # content_hash 에 안 들어가서 한 번 분석하면 다시 돌지 않습니다
        .filter(~Post.attachments.any(Attachment.status == "pending"))
        .order_by(Post.posted_at.desc())
        .limit(limit)
        .all()
    )


FAILED = {"summary": None, "importance": 0, "tags": [], "mandatory": False, "target_grades": [], "items": [],
          "facts": []}


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
    row.facts = result["facts"]
    row.error = None
    row.analyzed_at = clock.utcnow()
    if post.analysis is None:
        db.add(row)
    return row


def publish(core, post: Post, analysis: Analysis) -> tuple[int, int]:
    """분석 결과를 본 DB 로 — 학사일정 자동 일정과 기억. (새 일정 수, 새 사실 수)"""
    from backend.ksain import apply

    return apply.apply_post(core, post, analysis), memory.apply_post(core, post, analysis)


def run(limit: int, model_id: str | None, post_id: int | None = None, dry_run: bool = False,
        apply_results: bool = True, minutes: float | None = None) -> dict:
    """밀린 글을 최신순으로. `minutes` 가 지나면 새 글을 더 잡지 않고 멈춥니다.

    ⚠️ 사실까지 뽑으면서 글 하나가 15~30초 걸립니다(전엔 5~10초). 타이머 유닛은 50분이 지나면
    작업을 죽이므로, 버전을 올려 밀린 글이 많을 때는 시간으로 끊는 쪽이 안전합니다 — 글마다
    커밋하니 다음 주기가 이어 받습니다.
    """
    from backend.ksain import apply

    deadline = time.monotonic() + minutes * 60 if minutes else None

    init_ksain_schema()
    init_schema()  # 학사일정·기억을 적을 본 DB
    model = llm.resolve(model_id, "analyze")
    db, core = KsainSession(), SessionLocal()
    names = student_names(core)
    counts = {"analyzed": 0, "failed": 0, "events": 0, "facts": 0, "model": model.id}
    try:
        posts = [db.get(Post, post_id)] if post_id else pending(db, limit)
        for post in posts:
            if post is None:
                continue
            if deadline and time.monotonic() > deadline:
                counts["stopped"] = f"{minutes:g}분이 지나 멈춤 — 다음 주기에 이어갑니다"
                break
            try:
                result = analyze_post(post, model, names)
            except llm.LLMError as error:
                counts["stopped"] = str(error)[:200]
                break
            except (ValueError, TypeError) as error:
                counts["failed"] += 1
                print(f"  ! {post.id}: {error}", flush=True)
                # 실패도 기록합니다 — 안 남기면 그 글이 "밀린 글" 로 남아 10분마다 같은 실패를
                # 되풀이하며 GPU 를 씁니다. 글이 바뀌거나 버전을 올리면 다시 돕니다
                if not dry_run:
                    failed = save(db, post, FAILED, model)
                    failed.error = str(error)[:300]
                    db.commit()
                continue
            if dry_run:
                print(json.dumps({"id": post.id, "title": post.title, **result}, ensure_ascii=False, indent=1))
                continue
            analysis = save(db, post, result, model)
            db.commit()
            counts["analyzed"] += 1
            if apply_results:
                events, facts = publish(core, post, analysis)
                counts["events"] += events
                counts["facts"] += facts
                core.commit()
                db.commit()  # 반영 기록(applied·suppressed)
            print(f"  · {post.id} [{result['importance']}] {post.title[:40]} — items {len(result['items'])}"
                  f" · facts {len(result['facts'])}", flush=True)
        if apply_results and not dry_run:
            counts["removed"] = apply.remove_missing(db, core)
            core.commit()
            db.commit()
    finally:
        db.close()
        core.close()
    return counts


def reapply(fresh: bool = False) -> dict:
    """LLM 을 부르지 않고 저장된 분석으로 학사일정과 기억만 다시 맞춥니다.

    분석을 다른 DB(스테이징)에서 미리 돌렸거나 `apply.py`·`knowledge/facts.py` 규칙을 바꿨을 때
    씁니다. 반영 기록(`applied`)은 그 DB 의 일정 번호라 여기서는 비우고 시작합니다 — 남겨 두면
    "사람이 지운 일정" 으로 오해해 전부 막아 버립니다.

    사람이 지워 둔 기록(`suppressed`)은 평소엔 남깁니다. ⚠️ **스테이징에서 만든 분석을 운영에
    처음 반영할 때는 `fresh=True`** 로 그것까지 비우세요 — 스테이징 사본에서 지운 일정이
    운영에서도 막힙니다. (기억은 사람의 손질이 본 DB 의 사실 행 자체에 있어서 따로 비울 것이 없습니다.)
    """
    from backend.ksain import apply

    init_ksain_schema()
    init_schema()
    db, core = KsainSession(), SessionLocal()
    events = facts = 0
    try:
        rows = db.query(Analysis).join(Post).filter(Post.missing_since.is_(None)).all()
        for row in rows:
            row.applied = []
            if fresh:
                row.suppressed = []
            created_events, created_facts = publish(core, row.post, row)
            events += created_events
            facts += created_facts
            core.commit()
            db.commit()
        removed = apply.remove_missing(db, core)
        core.commit()
        db.commit()
    finally:
        db.close()
        core.close()
    return {"analyses": len(rows), "events": events, "facts": facts, "removed": removed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ksain 글 분석")
    parser.add_argument("--limit", type=int, default=150)
    parser.add_argument("--model", default=None, help="예: local:gemma4:12b, openai:gpt-5-mini")
    parser.add_argument("--post", type=int, default=None, help="글 하나만")
    parser.add_argument("--dry-run", action="store_true", help="저장하지 않고 결과만 출력")
    parser.add_argument("--no-calendar", action="store_true", help="학사일정·기억에 반영하지 않음")
    parser.add_argument("--reapply", action="store_true", help="분석 없이 저장된 결과로 학사일정·기억만 다시 맞춤")
    parser.add_argument("--fresh", action="store_true", help="--reapply 때 '사람이 지운 일정' 기록까지 비움 (첫 운영 반영)")
    parser.add_argument("--minutes", type=float, default=None, help="이 시간이 지나면 새 글을 더 잡지 않고 멈춤")
    args = parser.parse_args()
    if args.reapply:
        print(json.dumps(reapply(args.fresh), ensure_ascii=False))
    else:
        print(json.dumps(run(args.limit, args.model, args.post, args.dry_run, not args.no_calendar, args.minutes),
                         ensure_ascii=False))
