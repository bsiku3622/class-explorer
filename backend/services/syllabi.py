"""강의계획서 — 학교가 배포한 강의계획서 원본(pdf·docx)과, docx 를 PDF 로 바꾼 미리보기.

학부 폴더의 127개는 ksain #2739(2026-2학기 수강신청 오리엔테이션)의 Google Drive 묶음과 해시까지 같습니다 —
수강신청용이라 대부분 2026-1·2025-2 처럼 **지난 학기** 계획서입니다. 이번 학기 것은 과목마다 따로 받아서
학기 폴더(`2026-2/`)에 둡니다 — 받아 둔 폴더에서 고르는 건 `cli/scan_syllabi.py`.

⚠️ **git 에 두지 않고 로그인한 사람에게만 줍니다**(`routers/syllabi.py`). 한때
`frontend/src/assets/syllabi/` 에 두고 화면 번들에 실었더니 Netlify 가 로그인 없이 내줬고, 파일 대부분에
교사 이메일·전화번호가 들어 있었습니다. 지금 자리는 `SYLLABI_DIR`, 비우면 **본 DB 의 진짜 위치 옆**
`syllabi/` 입니다 — 서버에서는 `data/syllabi/`, 로컬에서는 `backend/syllabi/`.

폴더 구조는 예전 그대로입니다(학부/학과/파일) — 화면이 경로로 과목을 짝짓습니다
(`frontend/src/lib/syllabi.ts`). docx 의 미리보기는 같은 자리의 `<이름>.preview.pdf` 입니다.

URL 에는 경로 대신 경로의 해시(`id`)만 씁니다. 파일 이름에 교사 이름이 든 것이 있어서, 경로를 그대로
쓰면 접속 로그에 남습니다.

**Ask 도 읽습니다**(`agent/tools.py` 의 `syllabus`). 파일마다 첫 쪽에서 과목명·학기를 읽어 목록을 만들고
(`catalog` — 프로세스마다 한 번, 5초 남짓이라 질문창이 열릴 때 미리 만듭니다), 고른 파일의 본문은 그때
뽑습니다. ⚠️ 파일 이름만으로는 못 짝짓습니다 — `Calulus2` 처럼 이름이 틀린 파일이 있고, `고급알고리즘` 파일
이름에는 `알고리즘` 도 들어 있습니다. 화면은 따로 손으로 적은 규칙으로 짝짓습니다(`frontend/src/lib/syllabi.ts`).
교사 이메일·전화번호는 지우고 넘깁니다 — 답에 필요 없고, 이용자가 OpenAI 를 고르면 바깥으로 갑니다.
"""
from __future__ import annotations

import hashlib
import logging
import re
import threading
from pathlib import Path

from backend.core import config
from backend.core.db import main_db_file
from backend.ksain import extract
from backend.knowledge.text import query_terms
from backend.services.subject_names import abbreviation, squash

# pypdf 는 일부 PDF 를 읽으며 "Ignoring wrong pointing object" 경고를 수십 줄 남깁니다 — 읽기에는 지장이 없어서,
# 목록을 만들 때마다 API 로그를 덮지 않게 오류만 남깁니다(처음 운영에서 한 번에 42줄)
logging.getLogger("pypdf").setLevel(logging.ERROR)

MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def root() -> Path:
    if config.SYLLABI_DIR:
        return Path(config.SYLLABI_DIR).resolve()
    return main_db_file().parent / "syllabi"


def file_id(relative: str) -> str:
    """경로 → 바뀌지 않는 짧은 id. 같은 파일이면 언제 물어도 같습니다."""
    return hashlib.sha1(relative.encode("utf-8")).hexdigest()[:16]


def listing() -> list[dict]:
    """`[{id, path, format}]` — `path` 는 `syllabi/` 기준 상대 경로(`/` 구분)입니다.

    폴더 밖을 가리키는 심볼릭 링크는 건너뜁니다 — 목록에 든 것만 내주므로, 여기서 막으면 다른 파일로 새는 길이
    없습니다.
    """
    base = root()
    if not base.is_dir():
        return []
    resolved = base.resolve()
    out = []
    for path in sorted(base.rglob("*")):
        if path.suffix.lower() not in MEDIA_TYPES or path.name.startswith(".") or not path.is_file():
            continue
        if not path.resolve().is_relative_to(resolved):
            continue
        relative = path.relative_to(base).as_posix()
        out.append({"id": file_id(relative), "path": relative, "format": path.suffix.lower()[1:]})
    return out


def find(identifier: str) -> Path | None:
    """id 에 맞는 파일. 경로를 받지 않으므로 목록에 없는 파일은 줄 수 없습니다."""
    for item in listing():
        if item["id"] == identifier:
            return root() / item["path"]
    return None


# ─── Ask 가 읽는 본문 ─────────────────────────────────────────────────────────
_CONTACT = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}")
# 과목명 칸 — 한국어 양식("과목명미적분학1교과목 번호…")과 영어 양식("Course Title Calculus 2 Course Code…")
_TITLE = [
    re.compile(r"과목명\s*(.{2,60}?)\s*(?:교과목\s*번호|수강\s*대상|학점|교과\s*구분)", re.S),
    re.compile(r"Course\s*Title\s*(.{2,80}?)\s*(?:Course\s*(?:Code|No)|Credit|Instructor)", re.S | re.I),
    re.compile(r"Course\s*Name\s*(.{2,80}?)\s*Code", re.S | re.I),
    re.compile(r"Subject\s*(.{2,60}?)\s*Class\s*Code", re.S | re.I),
    re.compile(r"KAIST\s*(.{3,60}?)\s*\[\s*[A-Z]{2,3}\d{4}\s*\]", re.S),  # "… KAIST Computer Science 3 [MC2201]"
]
# 학기 표기 — 파일 이름이 먼저입니다. 내용은 옛 양식을 고쳐 쓰다 학년도를 안 바꾼 것이 있습니다
# (2025-2 미적분학1 이 본문에는 "2024학년도 2학기"). 파일 이름의 `26-1`·`2025_2` 꼴은 본문에서는 안 봅니다
# — 깨진 표("학점 28-1.")에서 엉뚱한 학기가 나옵니다
_TERM_NAME = re.compile(r"(?<!\d)(20\d\d|2\d)\s*[-_]\s*0?([12])(?!\d)")
_TERM_TEXT = [
    re.compile(r"(20\d\d)\s*(?:학년도|년)?\s*(?:제\s*)?([12])\s*학기"),
    re.compile(r"학년도\s*학기\s*(20\d\d)\s*([12])"),
    re.compile(r"(spring|fall|autumn|1st|2nd)\s*(?:semester)?\s*,?\s*(20\d\d)", re.I),
    re.compile(r"(20\d\d)\s*(spring|fall|autumn|1st|2nd|[fs](?![a-z]))", re.I),
]
_SEASON = {"spring": "1", "1st": "1", "s": "1", "fall": "2", "autumn": "2", "2nd": "2", "f": "2"}
_EC = re.compile(r"\(EC\)|(?<![A-Za-z])EC(?![A-Za-z])")

_lock = threading.Lock()
_catalog: dict = {"key": None, "entries": []}
_texts: dict[str, str] = {}


def _read(path: Path, first_page: bool = False) -> str:
    """첫 쪽(목록의 과목명·학기) 또는 본문.

    ⚠️ PDF 본문은 **배치 모드**(`extraction_mode="layout"`)로 뽑습니다. 기본 모드는 줄을 이어 붙여 미적분학1 의
    "기말고사 : chapters 1-7" 뒤에 다음 절 번호가 붙어 "chapters 1-76. 학점 부여 기준" 이 됐습니다 — 모델이
    "1~76장" 으로 읽을 수 있습니다. 첫 쪽은 기본 모드 그대로입니다(과목명 칸을 읽는 규칙이 그 모양에 맞춰져 있습니다).
    """
    if path.suffix.lower() != ".pdf":
        return extract.attachment_text(path.name, path.read_bytes())
    from pypdf import PdfReader

    pages = PdfReader(str(path)).pages
    if first_page:
        return (pages[0].extract_text() or "") if len(pages) else ""
    try:
        text = "\n".join(page.extract_text(extraction_mode="layout") or "" for page in pages[:40])
    except Exception:  # 배치 모드가 못 읽는 파일 — 기본 모드로
        return extract.attachment_text(path.name, path.read_bytes())
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()[:extract.MAX_TEXT]


def _term(name: str, head: str) -> str | None:
    """`"2025-2"` — 파일 이름, 그다음 본문 첫머리. 못 읽으면 None."""
    match = _TERM_NAME.search(name)
    if match:
        year = match.group(1)
        return f"{year if len(year) == 4 else '20' + year}-{match.group(2)}"
    for text in (name, head):
        for pattern in _TERM_TEXT:
            match = pattern.search(text)
            if not match:
                continue
            a, b = match.group(1), match.group(2)
            year, season = (a, b) if a.isdigit() else (b, a)
            return f"{year}-{season if season.isdigit() else _SEASON[season.lower()]}"
    return None


def _key(text: str | None) -> str:
    """짝짓기용 이름 — `squash` 에 `&` 를 `and` 로. 과목 영문명은 "Chemistry & Exp.Ⅱ", 계획서는
    "Chemistry and Experiment II" 처럼 둘을 섞어 씁니다."""
    return squash(re.sub(r"\s*&\s*", " and ", text or ""))


def _title(head: str) -> str | None:
    flat = re.sub(r"\s+", " ", head[:1500])
    for pattern in _TITLE:
        match = pattern.search(flat)
        if match:
            return match.group(1).strip(" :")
    return None


def catalog() -> list[dict]:
    """강의계획서마다 `{id, path, name, title, term, ec, keys, blob}` — docx 미리보기 PDF 는 뺍니다.

    `keys` 는 과목명 칸(못 읽으면 첫머리)·파일 이름(짝짓기), `blob` 은 파일 이름 + 첫머리(담당 교사 이름
    찾기)입니다.

    파일이 바뀌지 않았으면 다시 읽지 않습니다(이름·수정 시각으로 봅니다). 여러 요청이 한꺼번에 와도 한 번만
    만들도록 잠급니다.
    """
    files = [f for f in listing() if not f["path"].endswith(".preview.pdf")]
    base = root()
    key = tuple((f["path"], (base / f["path"]).stat().st_mtime) for f in files)
    with _lock:
        if _catalog["key"] == key:
            return _catalog["entries"]
        entries = []
        for item in files:
            path = base / item["path"]
            try:
                head = _read(path, first_page=True)
            except Exception:  # 깨진 파일 하나 때문에 목록 전체를 잃지 않습니다
                head = ""
            title = _title(head)
            entries.append({
                **item, "name": path.stem, "title": title, "term": _term(path.stem, head),
                "ec": bool(_EC.search(f"{path.stem} {title or ''}")),
                "keys": [k for k in (_key(title or head[:60]), _key(path.stem)) if k],
                "blob": squash(path.stem) + squash(head[:800]),
            })
        _catalog.update(key=key, entries=entries)
        return entries


def names_for(name: str, english: str | None, course: str | None = None,
              course_english: str | None = None) -> list[str]:
    """강의계획서를 찾을 이름들 — 과목 이름·영문명과 부제(`수학특강(위상수학)` 의 `위상수학`).

    교육과정 이름(`course`)은 부제가 없을 때만 넣습니다 — `수학특강` 을 넣으면 다른 부제의 특강 계획서가 다 걸립니다.
    부제만 따로 넣는 건 부제만 적힌 파일 때문입니다(`물리학을위한수학적도구들-Special Topics in …`).
    """
    subtitle = re.search(r"\(([^()]{3,})\)$", name or "")
    out = [name, english, subtitle.group(1)] if subtitle else [name, english, course, course_english]
    return [n for n in dict.fromkeys(out) if n]


def _fit(names: set[str], keys: list[str]) -> tuple[tuple[int, int], tuple[int, int]] | None:
    """이름들이 강의계획서에 얼마나 맞는가 — 작을수록 가깝습니다.

    `(맞은 정도, 자리)` 로 줄을 세우고 `(맞은 정도, -이름 길이)` 로 다른 과목과 겨룹니다. 맞은 정도는 같음 0·포함 1·
    줄임 2("General Chemistry Lab1" ↔ "…Laboratory 1"), 자리는 과목명 칸 0·파일 이름 1 입니다. 둘은 따로 셉니다 —
    "일반물리학실험2" 는 과목명 칸에 짧은 한글 이름으로, 파일 이름에 긴 영문명으로 맞는데, 한글 쪽 길이로 겨루면
    파일 이름 속 "Physics & Lab 2"(물리학및실험2)에 졌습니다.
    """
    place = strength = None
    for name in names:
        for rank, key in enumerate(keys):
            if key == name:
                kind = 0
            elif name in key:
                kind = 1
            elif abbreviation(name, key):
                kind = 2
            else:
                continue
            place = min(place or (kind, rank), (kind, rank))
            strength = min(strength or (kind, -len(name)), (kind, -len(name)))
    return (place, strength) if place else None


def matching(names: list[str], teacher: str | None = None, ec: bool | None = None,
             others: list[str] = ()) -> list[dict]:
    """과목 이름들(한글명·영문명)에 맞는 강의계획서 — 가까운 순.

    `others` 는 다른 과목들의 이름입니다(같은 과목의 교육과정 이름은 빼고 넘깁니다). 계획서가 그쪽에 더 잘 맞으면
    뺍니다 — 안 그러면 "일반지구과학" 에 "General Earth Science **Lab**" 이, "생물학및실험" 에 외국인 과목
    "Biology & Experiment Ⅱ" 가 걸립니다. "더 잘 맞는다" 는 맞은 정도가 높거나, 같으면 더 긴 이름입니다.
    ⚠️ 과목명 칸이냐 파일 이름이냐는 따지지 않습니다 — 따지면 "Art"(미술)가 오타 난 제목 "Gerneral E**art**h
    Science" 안에 들어 있다고 일반지구과학 계획서를 가져갔습니다.
    같은 과목의 계획서가 여럿이면 ① 질문자의 담당 교사 이름이 든 것 ② 과목명 칸으로 맞은 것 ③ 영어강의 여부가 같은 것
    ④ 최근 학기 순입니다. 각 항목의 `fit` 은 맞은 정도(같음 0·포함 1·줄임 2)입니다.
    """
    wanted = {_key(name) for name in names} - {""}
    # 우리 이름 안에 통째로 든 이름은 더 넓은 이름이라 다투지 않습니다 — 외국인 과목 "Biology & Exp.Ⅱ" 의 계획서를
    # 한국어 과목 "Biology & Exp." 가 가져갔습니다
    rivals = {r for r in ({_key(name) for name in others} - wanted - {""}) if not any(r in w for w in wanted)}
    scored = []
    for entry in catalog():
        fit = _fit(wanted, entry["keys"])
        if fit is None or any((rival := _fit({name}, entry["keys"])) and rival[1] < fit[1] for name in rivals):
            continue
        teacher_miss = int(bool(teacher) and squash(teacher) not in entry["blob"])
        ec_miss = int(ec is not None and entry["ec"] != ec)
        term = int((entry["term"] or "0-0").replace("-", ""))
        place = fit[0]
        scored.append(((place[0], teacher_miss, place[1], ec_miss, -term), {**entry, "fit": place[0]}))
    return [entry for _key, entry in sorted(scored, key=lambda pair: pair[0])]


def text(entry: dict) -> str:
    """강의계획서 본문 — 교사 연락처를 지운 것. 한 번 읽은 파일은 수정되기 전까지 다시 읽지 않습니다."""
    path = root() / entry["path"]
    key = f"{entry['path']}:{path.stat().st_mtime}"
    if key not in _texts:
        _texts[key] = _CONTACT.sub("", _read(path))
    return _texts[key]


# 강의계획서는 영어로 쓴 것이 많습니다 — 한국어 질문의 말에 영어 짝을 붙여 찾습니다
_ALIASES = {
    "기말": ["final"], "중간": ["midterm"], "시험": ["exam", "test"], "고사": ["exam"],
    "범위": ["chapter", "scope", "range"], "평가": ["grading", "grade", "evaluation", "assessment", "배점", "성적"],
    "비율": ["배점", "weight"], "과제": ["assignment", "homework", "숙제"], "숙제": ["homework", "assignment"],
    "보고서": ["report"], "퀴즈": ["quiz"], "출석": ["attendance", "출결"], "출결": ["attendance", "출석"],
    "교재": ["textbook"], "실험": ["lab", "experiment"], "발표": ["presentation"],
    "계획": ["week", "schedule"], "주차": ["week"], "진도": ["week", "schedule"],
}


def excerpt(body: str, query: str | None, budget: int, header: int = 500) -> str:
    """질문에 맞는 대목만 — 다 들어가면 통째로, 아니면 첫머리 + 질문 낱말이 든 줄과 그 앞뒤 줄.

    기말고사 범위는 대개 "평가 방법" 의 한 줄("기말고사 : chapters 1-7")이나 주차별 계획의 시험 주에 있습니다.
    자리가 모자라면 질문 낱말이 **많이** 든 줄부터 싣습니다 — 앞에서부터 실었더니 과목당 600자 안에서
    "평가 기준" 표가 자리를 먹고 정작 "기말고사 : chapters 1-7" 줄이 잘렸습니다.
    """
    if len(body) <= budget or not query:
        return body[:budget]
    words = set()
    for term in query_terms(query):
        words.add(squash(term))
        for key, aliases in _ALIASES.items():
            if key in term:
                words.update(squash(alias) for alias in aliases)
    words.discard("")
    pieces = []
    for line in body.split("\n"):
        while len(line) > 300:  # PDF 는 한 쪽이 한 줄로 나오기도 합니다
            cut = line.rfind(" ", 150, 300)
            cut = cut if cut > 0 else 300
            pieces.append(line[:cut])
            line = line[cut:]
        pieces.append(line)
    scores = {i: sum(w in squash(piece) for w in words) for i, piece in enumerate(pieces)}
    hits = sorted((i for i, score in scores.items() if score), key=lambda i: (-scores[i], i))
    if not hits:
        return body[:budget]
    head = body[:header].rstrip() if header else ""
    used = len(head)
    chosen: set[int] = set()
    for i in hits:  # 많이 맞은 줄부터, 그 뒤·앞 줄까지 자리가 있는 만큼
        for j in (i, i + 1, i - 1):
            piece = pieces[j].strip() if 0 <= j < len(pieces) else ""
            if not piece or j in chosen or (header and 0 <= body.find(piece) < header):
                continue
            if used + len(piece) + 3 > budget:
                break
            chosen.add(j)
            used += len(piece) + 3
    out, last = head, None
    for i in sorted(chosen):
        joiner = "\n" if last is not None and i == last + 1 else "\n…\n"
        out = f"{out}{joiner}{pieces[i].strip()}" if out else pieces[i].strip()
        last = i
    return out
