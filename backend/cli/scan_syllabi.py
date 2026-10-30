"""받아 둔 문서 폴더에서 강의계획서 고르기 — 데스크탑 Gemma 가 문서마다 첫머리를 읽고 판정합니다.

    python -m backend.cli.scan_syllabi <폴더나 파일>... --out <결과 폴더> [--known <sha256 목록 파일>]

**이번 학기 강의계획서는 학교가 한데 모아 주지 않습니다.** 수강신청 공지에 붙는 묶음(ksain #2739 의 Google
Drive 링크)은 수강신청용이라 대부분 지난 학기 것이고 — 서버의 `data/syllabi` 127개가 바로 그 묶음입니다 — 이번
학기 것은 과목마다 수업에서 따로 받습니다. 그래서 받아 둔 폴더를 통째로 훑어 고릅니다. 이름에 "강의계획서" 가
없는 것(OT 자료에 든 계획서)과 zip 안의 문서도 봅니다.

- **판정은 로컬 모델만 씁니다.** 개인 폴더의 글을 바깥(OpenAI 등)으로 보내지 않고, 문서가 수백 개라 비용도
  있습니다
- ⚠️ **학기는 근거 문구가 본문에 실제로 있을 때만 믿습니다.** 모델이 학기를 그럴듯하게 지어내면 지난 학기
  계획서가 이번 학기 것으로 올라가고, Ask 가 범위·날짜를 틀리게 말합니다
- 결과는 `<out>/report.json`. 강의계획서로 고른 pdf·docx 는 `<out>/syllabi/<학기>/` 에 복사합니다 — 서버
  `data/syllabi/` 에 그대로 얹으면 Ask 가 다음 질문부터 읽습니다(목록은 파일이 바뀌면 다시 만듭니다). 파일
  이름으로 학기를 못 읽으면 이름 앞에 학기를 붙입니다(`services/syllabi.py` 의 `_term` 이 이름부터 봅니다)
- ⚠️ **학번(`25-059`)이 든 문서는 모델 판정과 상관없이 뺍니다**(`personal`). 그래도 올리기 전에
  `staged` 목록은 사람이 한 번 훑어보세요 — 올린 파일은 로그인한 모두가 받아 보고 Ask 가 읽습니다
- hwp·hwpx·pptx 계획서는 서버 목록이 받지 않아서(pdf·docx 만) 보고서에만 남깁니다 — PDF 로 바꿔 올리세요
- `--known` 에 서버 파일의 sha256 목록을 주면 이미 있는 것은 모델에 묻지 않습니다

맥북에서 돌릴 때는 게이트웨이가 서버(10.8.0.1)에서 오는 연결만 받아서 서버를 거치는 터널이 필요합니다.

    ssh -f -N -L 18435:10.8.10.1:11434 server
    LLM_GATEWAY_URL=http://127.0.0.1:18435 python -m backend.cli.scan_syllabi ~/School/KSA --out /tmp/scan
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import shutil
import subprocess
import sys
import unicodedata
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath

from backend.agent import llm
from backend.ksain import extract
from backend.services import syllabi

READ = {"pdf", "docx", "hwp", "hwpx", "pptx", "doc"}
SERVABLE = {"pdf", "docx"}          # 서버 목록이 받는 형식 (services/syllabi.py 의 MEDIA_TYPES)
HEAD_CHARS = 3500                   # 첫 쪽 남짓 — 표지·과목 정보·평가 계획이 대개 여기 있습니다
MAX_BYTES = 60 * 1024 * 1024

# ⚠️ `["string","null"]` 유니언은 Ollama 가 null 로만 채웁니다(ksain 분석에서 겪었습니다) — 모르면 빈 문자열
SCHEMA = {
    "type": "object",
    "properties": {
        "is_syllabus": {"type": "boolean"},
        "course": {"type": "string"},
        "course_english": {"type": "string"},
        "term": {"type": "string"},
        "term_evidence": {"type": "string"},
        "teacher": {"type": "string"},
        "has_schedule": {"type": "boolean"},
    },
    "required": ["is_syllabus", "course", "course_english", "term", "term_evidence", "teacher", "has_schedule"],
}

PROMPT = """너는 한국과학영재학교(KSA) 학생이 받아 둔 문서를 분류한다. 아래는 문서 하나의 파일 이름과 첫머리다.

is_syllabus: 교사가 만든 한 과목의 강의계획서(Syllabus·수업계획서·교수학습계획·과목 OT 의 수업 운영 계획)면
  true. 강의 노트·과제·시험지·문제 풀이·공지·시간표·여러 과목 목록·보고서·발표 자료는 false.
  신청서·양식·명단처럼 학생이 채우거나 학생 이름·학번이 적힌 문서는 과목 이야기가 있어도 false.
course / course_english: 과목명 (한국어·영어, 없으면 "")
term: 이 계획서의 학기 "YYYY-1"(봄) 또는 "YYYY-2"(가을). 본문이나 파일 이름에 학기가 적혀 있지 않으면 "".
  짐작하지 마라.
term_evidence: term 의 근거가 된 문구를 본문에서 **그대로** 옮겨 적는다(예: "2026학년도 2학기", "Fall 2026").
  파일 이름이 근거면 "파일 이름". 없으면 "".
teacher: 담당 교사 이름 (없으면 ""). 이메일·전화번호는 적지 않는다.
has_schedule: 주차별 진도나 퀴즈·시험·과제의 일정(주차나 날짜)이 들어 있으면 true.

파일 이름: {name}

첫머리:
{head}"""


def _pdf_head(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:3])


def _doc_head(path: Path) -> str:
    """옛 Word(.doc) — macOS 의 textutil 로만 읽습니다(서버에는 없습니다)."""
    res = subprocess.run(["textutil", "-convert", "txt", "-stdout", str(path)], capture_output=True, timeout=60)
    return res.stdout.decode("utf-8", errors="ignore")


def head_of(name: str, data: bytes, path: Path | None) -> str:
    ext = extract.extension(name)
    if ext == "pdf":
        text = _pdf_head(data)
    elif ext == "doc":
        text = _doc_head(path) if path else ""
    else:
        text = extract.attachment_text(name, data)
    return re.sub(r"\s+", " ", text).strip()[:HEAD_CHARS]


def _zip_name(info: zipfile.ZipInfo) -> str:
    if info.flag_bits & 0x800:
        return info.filename
    raw = info.filename.encode("cp437")
    for encoding in ("utf-8", "cp949"):
        try:
            return raw.decode(encoding)
        except UnicodeDecodeError:
            pass
    return info.filename


def documents(roots: list[Path]):
    """`(표시 이름, 원래 자리, 바이트, 디스크 경로 | None)` — zip 은 안의 문서를 하나씩 꺼냅니다."""
    files = []
    for root in roots:
        files += [root] if root.is_file() else sorted(p for p in root.rglob("*") if p.is_file())
    for path in files:
        if path.name.startswith(("~$", ".")) or path.stat().st_size > MAX_BYTES:
            continue
        ext = extract.extension(path.name)
        if ext in READ:
            yield path.name, str(path), path.read_bytes(), path
        elif ext == "zip":
            try:
                with zipfile.ZipFile(path) as zf:
                    for info in zf.infolist():
                        name = _zip_name(info)
                        inner = PurePosixPath(name)
                        if (info.is_dir() or extract.extension(name) not in READ - {"doc"}
                                or inner.name.startswith(("~$", ".")) or info.file_size > MAX_BYTES):
                            continue
                        yield inner.name, f"{path}!{name}", zf.read(info), None
            except zipfile.BadZipFile:
                continue


# 학번(`25-059`). ⚠️ 강의계획서에는 학생 학번이 없습니다 — 이름이나 첫머리에 있으면 모델 판정과 상관없이 뺍니다.
# 시험 때 모델이 학생 둘의 이름·학번이 든 "심화멘토링 신청서" 를 계획서로 골랐습니다. 서버에 올라가면 로그인한
# 모두가 받아 보고 Ask 가 읽습니다
STUDENT_ID = re.compile(r"(?<![\d-])\d\d-\d{3}(?![\d-])")


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", text).lower()


def judge(model: llm.Model, name: str, head: str) -> dict:
    message = llm.chat_sync(model, [{"role": "user", "content": PROMPT.format(name=name, head=head)}],
                            schema=SCHEMA, max_tokens=400, timeout=180)
    verdict = json.loads(message.get("content") or "{}")
    term = verdict.get("term") or ""
    evidence = verdict.get("term_evidence") or ""
    # 학기는 근거가 있어야 받습니다 — 파일 이름에서 읽히거나, 근거 문구가 본문에 그대로 있고 연도를 담고 있을 때
    trusted = bool(re.fullmatch(r"20\d\d-[12]", term)) and (
        syllabi._term(name, "") == term
        or (evidence and _squash(evidence) in _squash(head) and term[:4] in evidence))
    verdict["term"] = term if trusted else ""
    verdict["term_dropped"] = "" if trusted or not term else term
    return verdict


def scan_one(model: llm.Model, item: tuple, known: set[str]) -> dict:
    name, origin, data, path = item
    digest = hashlib.sha256(data).hexdigest()
    row = {"name": name, "origin": origin, "sha256": digest, "ext": extract.extension(name)}
    if digest in known:
        return {**row, "status": "known"}
    try:
        head = head_of(name, data, path)
    except Exception as error:  # 깨진 파일 하나 때문에 훑기를 멈추지 않습니다
        return {**row, "status": "unreadable", "error": str(error)[:200]}
    if len(head) < 80:
        return {**row, "status": "no-text"}   # 스캔본 PDF 처럼 글자가 없는 것
    if STUDENT_ID.search(name) or STUDENT_ID.search(head):
        return {**row, "status": "personal"}
    try:
        return {**row, "status": "judged", **judge(model, name, head)}
    except (llm.LLMError, ValueError) as error:
        return {**row, "status": "model-error", "error": str(error)[:200]}


def stage(rows: list[dict], items: dict[str, tuple], out: Path) -> list[str]:
    staged = []
    for row in rows:
        if row.get("status") != "judged" or not row.get("is_syllabus") or row["ext"] not in SERVABLE:
            continue
        # 맥에서 온 이름은 한글이 조합형(NFD)일 수 있습니다 — 서버의 다른 파일과 같게 맞춥니다
        name = unicodedata.normalize("NFC", items[row["origin"]][0])
        term = row["term"] or "unknown-term"
        if row["term"] and syllabi._term(Path(name).stem, "") != row["term"]:
            name = f"{row['term']} {name}"
        target = out / "syllabi" / term / name
        if target.exists():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(items[row["origin"]][2])
        row["staged"] = str(target.relative_to(out / "syllabi"))
        staged.append(row["staged"])
    return staged


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("roots", nargs="+", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--known", type=Path, help="이미 서버에 있는 파일의 sha256 (한 줄에 하나, 첫 칸)")
    parser.add_argument("--model", default=None, help="로컬 모델만 (예: local:gemma4:12b)")
    args = parser.parse_args()

    model = llm.resolve(args.model, "analyze")   # 분석 용도 — 로컬만 받습니다
    known = set()
    if args.known:
        known = {line.split()[0] for line in args.known.read_text().splitlines() if line.strip()}
    # 같은 파일이 여러 자리에 있으면 한 번만 묻고 한 번만 올립니다
    items: dict[str, tuple] = {}
    seen: set[str] = set()
    for item in documents(args.roots):
        digest = hashlib.sha256(item[2]).hexdigest()
        if digest not in seen:
            seen.add(digest)
            items[item[1]] = item
    print(f"{len(items)} documents, model {model.id}", file=sys.stderr)

    rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=2) as pool:   # 게이트웨이의 OLLAMA_NUM_PARALLEL 과 같게
        for i, row in enumerate(pool.map(lambda it: scan_one(model, it, known), items.values()), 1):
            rows.append(row)
            if row.get("is_syllabus"):
                print(f"[{i}/{len(items)}] syllabus: {row['course'] or row['name']} ({row['term'] or '학기 모름'})",
                      file=sys.stderr)
            elif i % 25 == 0:
                print(f"[{i}/{len(items)}]", file=sys.stderr)

    args.out.mkdir(parents=True, exist_ok=True)
    if (args.out / "syllabi").exists():
        shutil.rmtree(args.out / "syllabi")
    staged = stage(rows, items, args.out)
    (args.out / "report.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    found = [r for r in rows if r.get("is_syllabus")]
    print(json.dumps({
        "documents": len(rows),
        "status": {s: sum(r["status"] == s for r in rows) for s in sorted({r["status"] for r in rows})},
        "syllabi": len(found), "staged": staged,
        "not_servable": [r["origin"] for r in found if r["ext"] not in SERVABLE],
    }, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
