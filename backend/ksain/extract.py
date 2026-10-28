"""본문 정규화와 첨부 텍스트 추출.

구 사이트 글의 `content` 는 HTML 이 한 번 더 escape 된 형태(`&lt;h2&gt;…`)이고, 새 사이트
글은 평문입니다. 둘 다 `html_to_text` 하나로 받습니다.

첨부는 형식마다 표준 라이브러리로 읽을 수 있는 건 직접 읽고(xlsx·docx·pptx·hwpx 는 zip 안의
XML), PDF 는 `pypdf`, 한글(hwp 5.x)은 `olefile` 로 본문 레코드만 꺼냅니다. 이미지 포스터는
아직 읽지 않습니다(`unsupported`).
"""
from __future__ import annotations

import html
import io
import re
import zipfile
import zlib
from xml.etree import ElementTree as ET

MAX_TEXT = 20_000          # 첨부 하나에서 남길 글자 수
MAX_ROWS_PER_SHEET = 150   # 명단처럼 긴 시트는 앞부분만 남깁니다

_BLOCK = re.compile(r"<\s*(br|/p|/div|/h\d|/li|/tr|p|div|h\d|li|tr)\b[^>]*>", re.I)
_TAG = re.compile(r"<[^>]+>")


def html_to_text(raw: str | None) -> str:
    if not raw:
        return ""
    text = raw
    # 구 사이트 글은 escape 가 한 겹 더 씌워져 있습니다
    if "&lt;" in text and "<" not in text:
        text = html.unescape(text)
    text = _BLOCK.sub("\n", text)
    text = _TAG.sub("", text)
    text = html.unescape(text).replace("\r", "").replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.split("\n")]
    out: list[str] = []
    for line in lines:
        if line or (out and out[-1]):
            out.append(line)
    return "\n".join(out).strip()


def _xml_text(data: bytes, tag_suffix: str, para_suffix: str | None = None) -> str:
    root = ET.fromstring(data)
    if para_suffix is None:
        return " ".join(el.text for el in root.iter() if el.tag.endswith(tag_suffix) and el.text)
    paragraphs = []
    for para in root.iter():
        if para.tag.endswith(para_suffix):
            text = "".join(el.text or "" for el in para.iter() if el.tag.endswith(tag_suffix))
            if text.strip():
                paragraphs.append(text.strip())
    return "\n".join(paragraphs)


def _xlsx(data: bytes) -> str:
    from backend.workbook import Workbook

    book = Workbook(data)
    parts = []
    for name in book.sheets:
        sheet = book.read(name)
        rows: dict[int, list[tuple[int, str]]] = {}
        for (r, c), (value, _fill) in sheet.cells.items():
            if value and str(value).strip():
                rows.setdefault(r, []).append((c, str(value).strip().replace("\n", " / ")))
        lines = [" | ".join(v for _c, v in sorted(cells)) for _r, cells in sorted(rows.items())]
        extra = f"\n… ({len(lines) - MAX_ROWS_PER_SHEET}행 생략)" if len(lines) > MAX_ROWS_PER_SHEET else ""
        parts.append(f"[시트: {name}]\n" + "\n".join(lines[:MAX_ROWS_PER_SHEET]) + extra)
    return "\n\n".join(parts)


def _docx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        return _xml_text(z.read("word/document.xml"), "}t", "}p")


def _pptx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        slides = sorted(
            (n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
            key=lambda n: int(re.search(r"\d+", n.rsplit("/", 1)[1]).group()),
        )
        return "\n\n".join(_xml_text(z.read(n), "}t", "}p") for n in slides)


def _hwpx(data: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        sections = sorted(n for n in z.namelist() if re.fullmatch(r"Contents/section\d+\.xml", n))
        return "\n".join(_xml_text(z.read(n), "}t", "}p") for n in sections)


# 문단 텍스트 안의 0~31 은 컨트롤입니다. 아래 코드만 한 글자 폭이고, 나머지(표·그림·각주
# 같은 인라인·확장 컨트롤)는 뒤따르는 데이터까지 8글자 폭을 차지합니다
_HWP_CHAR_CONTROLS = {0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31}


def _hwp_para(chunk: bytes) -> str:
    chars = [int.from_bytes(chunk[j:j + 2], "little") for j in range(0, len(chunk) - 1, 2)]
    out, k = [], 0
    while k < len(chars):
        code = chars[k]
        if code >= 32:
            out.append(chr(code))
            k += 1
        elif code in _HWP_CHAR_CONTROLS:
            if code in (10, 13):
                out.append("\n")
            elif code == 24:
                out.append("-")
            elif code in (30, 31):
                out.append(" ")
            k += 1
        else:
            out.append(" " if code == 9 else "")
            k += 8
    return "".join(out)


def _hwp(data: bytes) -> str:
    """hwp 5.x — BodyText 의 문단 텍스트 레코드(태그 67)만 꺼냅니다."""
    import olefile

    ole = olefile.OleFileIO(io.BytesIO(data))
    header = ole.openstream("FileHeader").read()
    compressed = bool(header[36] & 1)
    if header[36] & 2:
        raise ValueError("암호화된 문서")
    sections = sorted(
        (entry for entry in ole.listdir() if entry[0] == "BodyText"),
        key=lambda entry: int(re.sub(r"\D", "", entry[1]) or 0),
    )
    paragraphs = []
    for entry in sections:
        raw = ole.openstream(entry).read()
        if compressed:
            raw = zlib.decompress(raw, -15)
        i = 0
        while i + 4 <= len(raw):
            head = int.from_bytes(raw[i:i + 4], "little")
            tag, size = head & 0x3FF, (head >> 20) & 0xFFF
            i += 4
            if size == 0xFFF:
                size = int.from_bytes(raw[i:i + 4], "little")
                i += 4
            if tag == 67:
                text = _hwp_para(raw[i:i + size])
                if text.strip():
                    paragraphs.append(text.strip())
            i += size
    return "\n".join(paragraphs)


def _pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:40])


READERS = {
    "xlsx": _xlsx, "xlsm": _xlsx, "docx": _docx, "pptx": _pptx, "hwpx": _hwpx, "hwp": _hwp, "pdf": _pdf,
    "txt": lambda d: d.decode("utf-8", errors="ignore"), "csv": lambda d: d.decode("utf-8", errors="ignore"),
}
IMAGE_EXT = {"png", "jpg", "jpeg", "gif", "webp", "bmp", "heic"}


def extension(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def readable(name: str) -> bool:
    return extension(name) in READERS


def attachment_text(name: str, data: bytes) -> str:
    text = READERS[extension(name)](data)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_TEXT]
