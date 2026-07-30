"""
연간 학사일정 PDF → `calendar_seed.json`

    python -m backend.parse_calendar_pdf "~/Downloads/2026학년도_연간학사일정_2026. 4. 1..pdf"

문서는 한 페이지에 세 달이 나란한 표입니다. 그런데 `extract_tables()`로 읽으면 한 칸에
여러 줄이 든 경우 행이 쪼개지고 글자가 잘려서, **좌표로 직접 읽습니다.**

    ┌────┬──────┬────────────────┬──────┬─────────────┬──────┬─────────────┐
    │    │        2월           │        3월         │        4월         │  ← 머리글 행이 달 경계를 정합니다
    ├────┼──────┼────────────────┼──────┼─────────────┼──────┼─────────────┤
    │ 1  │  일  │                │  일  │ 삼일절       │  수  │ 담임협의회(2)│
    │    │      │                │      │ 1주차 종료   │      │ 졸업연구(6)  │  ← 같은 날의 둘째 줄
    └────┴──────┴────────────────┴──────┴─────────────┴──────┴─────────────┘
      ↑ 날짜 칸이 있는 행 = 새 날. 없으면 윗날의 계속

**분류는 색이 아니라 글자로 합니다.** 원본은 공휴일을 빨강, 주차를 보라, 귀가를 주황으로
칠해 두었지만, 색은 뽑아서 *검증*에만 씁니다 — 색이 의미를 나르게 하면 문서 서식이
조금만 바뀌어도 조용히 어긋납니다. 글자에는 `N주차 종료`·`귀가`·`중간고사`처럼 규칙이
분명한 표지가 이미 있습니다.

년도는 문서에 없어서 진행 순서로 정합니다. 2월에서 시작해 달이 작아지면(12월 → 1월)
해가 바뀐 것으로 봅니다. 맞게 붙였는지는 **PDF에 적힌 요일과 계산한 요일을 대조**해
확인합니다.
"""
from __future__ import annotations

import datetime
import json
import os
import re
import sys
from collections import defaultdict

import pdfplumber

SEED_PATH = os.path.join(os.path.dirname(__file__), "calendar_seed.json")

# 학년도 시작 달 — 이 달을 만나면 첫 해로 봅니다
FIRST_MONTH = 2

WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]

# ─── 분류 규칙 ───────────────────────────────────────────────────────────────
#
# 앞에 있는 것이 먼저 걸립니다. 겹치는 말이 있어서 순서가 의미를 가집니다 —
# "개교기념 휴업"은 쉬는 날이지만 "개교기념일"은 그냥 기념일입니다.
CATEGORY_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("holiday", (
        "삼일절", "대체휴일", "어린이날", "현충일", "광복절", "개천절", "한글날",
        "성탄절", "신정", "설날", "추석", "부처님오신날", "지방선거", "휴업",
        "노동절",
    )),
    ("dorm", ("귀가", "귀교", "생활관", "방배정")),
    ("exam", ("중간고사", "기말고사", "시험")),  # 미국 AP·SAT 시험도 시험입니다
    ("term", ("주차 종료", "개학", "입학식", "졸업식", "종업", "개교기념일")),
    ("academic", (
        "교무회의", "졸업연구", "창의설계활동", "R&E", "연구방법기초세미나",
        "담임협의회", "수강신청", "수강철회", "재수강", "원서접수", "학부모",
        "진학 OT", "공개수업", "상담",
    )),
]

# `1주차 종료` 같은 주차 표지
WEEK_MARKER = re.compile(r"^(\d{1,2})주차\s*종료$")
# `(~4.17)` `(~2.6.)` `(~4.30, 2,3학년)` — 괄호 안 어디든 있는 종료일
END_DATE = re.compile(r"~\s*(\d{1,2})\s*\.\s*(\d{1,2})")
# `(1학년)` `(2,3학년)` `1학년 귀가` `(1,2학년, 대강당)`
GRADES = re.compile(r"([\d,\s]+)학년")


def classify(title: str) -> str:
    """
    띄어쓰기는 무시하고 봅니다 — 같은 말이 `대체휴일`과 `대체 휴일`로 둘 다 나옵니다.
    """
    flat = title.replace(" ", "")
    for category, keywords in CATEGORY_RULES:
        if any(k.replace(" ", "") in flat for k in keywords):
            return category
    return "event"


def parse_grades(title: str) -> list[int]:
    """
    제목에서 대상 학년을 읽습니다. 못 찾으면 빈 목록 = 전학년.

    `전학년`은 일부러 빈 목록으로 둡니다 — "1·2·3"으로 펼쳐 두면 나중에 학년이
    늘거나 교직원 대상이 생겼을 때 뜻이 어긋납니다.
    """
    if "전학년" in title:
        return []
    grades: set[int] = set()
    for chunk in GRADES.findall(title):
        for n in re.findall(r"\d", chunk):
            if n in "123":
                grades.add(int(n))
    return sorted(grades)


def parse_end_date(title: str, start: datetime.date) -> datetime.date:
    """
    `중간고사(~4.17)` 의 끝나는 날. 없으면 하루짜리라 시작일을 그대로 돌려줍니다.

    끝나는 달이 시작보다 작으면 해를 넘긴 것입니다 (`12월 ... (~1.31)`).
    """
    m = END_DATE.search(title)
    if not m:
        return start
    month, day = int(m.group(1)), int(m.group(2))
    year = start.year + 1 if month < start.month else start.year
    try:
        end = datetime.date(year, month, day)
    except ValueError:
        return start
    return end if end >= start else start


# ─── PDF 읽기 ────────────────────────────────────────────────────────────────
def month_blocks(page) -> list[tuple[int, float, float, float]]:
    """
    머리글 행에서 `(달, x시작, 내용칸 x시작, x끝)`을 읽습니다.

    한 달 블록은 좁은 요일 칸과 넓은 내용 칸으로 나뉩니다. 그 경계를 눈대중으로
    잡으면 안 됩니다 — 몇 pt 차이로 낱말이 통째로 빠져 제목이 잘립니다. 표가 이미
    세로선을 알고 있으니 그걸 씁니다.
    """
    table = page.find_tables()[0]
    columns = [c.bbox for c in table.columns]
    blocks: list[tuple[int, float, float, float]] = []
    for cell in table.rows[0].cells:
        if cell is None:
            continue
        x0, top, x1, bottom = cell
        text = (page.crop((x0, top, x1, bottom)).extract_text() or "").strip()
        # 오른쪽 끝 칸은 문서 상단의 개정일("2026. 4. 1.")과 세로로 겹쳐서 크롭에 딸려
        # 들어옵니다. 앞머리만 보면 그 칸을 통째로 놓치므로 맨 뒤의 "N월"을 씁니다
        found = re.findall(r"(\d{1,2})월", text)
        if not found:
            continue
        inner = [c[0] for c in columns if c[0] > x0 + 1 and c[2] <= x1 + 1]
        blocks.append((int(found[-1]), x0, min(inner) if inner else x0 + 28, x1))
    return blocks


def day_bands(page) -> list[tuple[int, float, float]]:
    """
    `(날짜, y시작, y끝)`. 날짜 칸이 있는 행이 새 날이고, 없는 행은 윗날의 계속입니다.
    """
    table = page.find_tables()[0]
    bands: list[tuple[int, float, float]] = []
    for row in table.rows:
        cell = row.cells[0]
        if cell is None:
            if bands:  # 계속 행 — 윗날의 아래끝을 늘립니다
                day, top, _ = bands[-1]
                bands[-1] = (day, top, row.bbox[3])
            continue
        x0, top, x1, bottom = cell
        text = (page.crop((x0, top, x1, bottom)).extract_text() or "").strip()
        if text.isdigit():
            bands.append((int(text), top, bottom))
        elif bands:
            bands[-1] = (bands[-1][0], bands[-1][1], bottom)
    return bands


def word_color(word: dict) -> str | None:
    """검증용. 낱말 색을 red/purple/orange/black 으로 거칩니다."""
    color = word.get("non_stroking_color")
    if not color:
        return None
    if isinstance(color, (int, float)):
        return "black" if color == 0 else None
    if len(color) < 3:
        return None
    r, g, b = color[0], color[1], color[2]
    if r > 0.6 and g < 0.4 and b < 0.4:
        return "red"
    if r > 0.3 and b > 0.5 and g < 0.4:
        return "purple"
    if r > 0.7 and 0.3 < g < 0.75 and b < 0.3:
        return "orange"
    if r < 0.3 and g < 0.3 and b < 0.3:
        return "black"
    return None


def cell_lines(
    words: list[dict], x0: float, x1: float, top: float, bottom: float
) -> list[tuple[str, str | None]]:
    """
    한 칸 안의 낱말을 `(글, 색)` 줄로 묶습니다. 한 칸에 일정이 여러 개 들어 있습니다.

    색을 줄마다 따로 보는 이유는, 같은 칸에 빨간 공휴일과 보라색 주차 표지가 함께
    있는 날이 흔해서입니다. 칸 하나에 색 하나로 보면 검증이 통째로 어긋납니다.
    """
    inside = [
        w for w in words
        if w["x0"] >= x0 - 1 and w["x1"] <= x1 + 1
        and top <= (w["top"] + w["bottom"]) / 2 <= bottom
    ]
    # 같은 줄인지는 윗변이 가까운지로 봅니다. 고정 폭으로 나누면 경계에 걸친 줄이
    # 둘로 쪼개져서, 앞 낱말과의 거리로 판단합니다
    inside.sort(key=lambda w: (w["top"], w["x0"]))
    out: list[tuple[str, str | None]] = []
    line: list[dict] = []

    def flush() -> None:
        if not line:
            return
        row = sorted(line, key=lambda w: w["x0"])
        text = " ".join(w["text"] for w in row).strip()
        if text:
            out.append((text, word_color(row[0])))

    for w in inside:
        if line and w["top"] - line[0]["top"] > 4:
            flush()
            line = []
        line.append(w)
    flush()
    return _join_wrapped(out)


# 줄 끝이 이런 모양이면 제목이 다음 줄로 넘어간 것입니다
_CONTINUES = re.compile(r"(및|와|과|,|·|-)$")


def _join_wrapped(lines: list[tuple[str, str | None]]) -> list[tuple[str, str | None]]:
    """
    칸 폭에 안 맞아 두 줄로 접힌 제목을 도로 붙입니다.

    한 칸에 일정이 여러 개 들어 있어서 "줄 = 일정"이 기본인데, 긴 제목은 접힙니다.
    접힌 줄은 끝이 접속사(`… 및`)거나 괄호가 안 닫힌 채로 끝납니다 —
    `제15회 KSA 토론대회 예선(16:30,` + `시청각실)` 같은 식입니다. 줄 길이로
    판단하지 않는 이유는, 접힌 줄이 오른쪽 끝까지 꽉 차지 않는 경우가 있어서입니다.
    """
    merged: list[tuple[str, str | None]] = []
    for text, color in lines:
        if merged:
            prev, prev_color = merged[-1]
            # 여는 괄호로 시작하는 줄은 앞 제목의 꼬리입니다 — `… 표현하기 주간` + `(~4.10)`.
            # 이때는 붙여 씁니다. 사이에 공백을 넣으면 원문과 달라집니다
            if text.startswith("("):
                merged[-1] = (f"{prev}{text}", prev_color)
                continue
            if _CONTINUES.search(prev) or prev.count("(") > prev.count(")"):
                merged[-1] = (f"{prev} {text}", prev_color)
                continue
        merged.append((text, color))
    return merged


def parse(path: str) -> tuple[list[dict], list[str]]:
    events: list[dict] = []
    problems: list[str] = []
    year = None
    prev_month = None
    seen_months: set[tuple[int, int]] = set()

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            if not page.find_tables():
                continue
            words = page.extract_words(extra_attrs=["non_stroking_color"])
            blocks = month_blocks(page)
            bands = day_bands(page)
            if not blocks or not bands:
                continue

            for month, bx0, content_x0, bx1 in blocks:
                if year is None:
                    if month != FIRST_MONTH:
                        problems.append(f"첫 달이 {month}월입니다 — {FIRST_MONTH}월로 시작할 줄 알았습니다")
                    year = 2026
                elif prev_month is not None and month < prev_month:
                    year += 1
                prev_month = month

                if (year, month) in seen_months:
                    continue  # 영문판 — 같은 달을 두 번 읽지 않습니다
                seen_months.add((year, month))

                for day, top, bottom in bands:
                    try:
                        date = datetime.date(year, month, day)
                    except ValueError:
                        continue  # 2월 30일 같은 빈 칸

                    weekday = cell_lines(words, bx0, content_x0, top, bottom)
                    if weekday:
                        expected = WEEKDAY_KO[date.weekday()]
                        if weekday[0][0].strip() != expected:
                            problems.append(
                                f"{date} 요일 불일치 — 문서 {weekday[0][0]}, 계산 {expected}"
                            )

                    for title, color in cell_lines(words, content_x0, bx1, top, bottom):
                        title = title.strip()
                        if not title:
                            continue
                        events.append({
                            "title": title,
                            "start_date": date.isoformat(),
                            "end_date": parse_end_date(title, date).isoformat(),
                            "category": classify(title),
                            "target_grades": parse_grades(title),
                            "color": color,
                        })

    return events, problems


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = os.path.expanduser(sys.argv[1])
    events, problems = parse(path)

    # 색과 분류가 어긋나는 건을 보고합니다. 색이 기준은 아니라 고치지는 않습니다
    mismatch = []
    for e in events:
        color, category = e.pop("color"), e["category"]
        if color == "red" and category not in ("holiday", "dorm"):
            mismatch.append(f"빨강인데 {category}: {e['title']}")
        elif color == "purple" and category != "term":
            mismatch.append(f"보라인데 {category}: {e['title']}")

    by_category: dict[str, int] = defaultdict(int)
    for e in events:
        by_category[e["category"]] += 1

    with open(SEED_PATH, "w", encoding="utf-8") as f:
        json.dump({"events": events}, f, ensure_ascii=False, indent=1)

    dates = sorted(e["start_date"] for e in events)
    print(f"일정 {len(events)}건 — {dates[0]} ~ {dates[-1]}")
    for name, count in sorted(by_category.items(), key=lambda kv: -kv[1]):
        print(f"  {name:<9} {count}")
    if problems:
        print(f"\n확인 필요 {len(problems)}건:")
        for p in problems[:20]:
            print("  ", p)
    if mismatch:
        print(f"\n색과 분류가 어긋난 {len(mismatch)}건 (색은 참고용):")
        for m in mismatch[:20]:
            print("  ", m)
    print(f"\n→ {SEED_PATH}")


if __name__ == "__main__":
    main()
