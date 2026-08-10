"""
xlsx 에서 셀 값·채움색·글자 강조만 읽습니다 (openpyxl 없이).

교육과정 seed 를 만들 때(`build_curriculum_seed`)와 사람이 올린 자몽 워크북을 읽을
때(`zamong_import`) 같은 리더를 씁니다. 서버에도 들어가는 코드라 의존성을 늘리지
않으려고 표준 라이브러리(zipfile + ElementTree)만 씁니다.

⚠️ **읽기 전용입니다.** 수식은 계산하지 않고 캐시된 값만 봅니다 — 엑셀이 저장할 때
넣어 둔 값이라, 파일을 한 번도 열지 않고 만든 xlsx 라면 비어 있을 수 있습니다.
"""

import io
import re
import zipfile
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

SHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def column_number(column: str) -> int:
    number = 0
    for char in column:
        number = number * 26 + ord(char) - 64
    return number


@dataclass
class Sheet:
    """셀 좌표 → (텍스트, 채움색)"""

    cells: dict[tuple[int, int], tuple[str, str]] = field(default_factory=dict)
    # 굵은 밑줄이 걸린 칸 — 시트에서 심화필수 과목을 그렇게 표시해 뒀습니다
    strong: set[tuple[int, int]] = field(default_factory=set)


class Workbook:
    """xlsx에서 셀 값·채움색·글자 강조만 읽습니다 (openpyxl 없이)."""

    def __init__(self, source: str | bytes):
        # 파일 경로(seed 를 만들 때)와 업로드된 바이트(사람이 올린 워크북)를 둘 다
        # 받습니다 — 임시 파일을 만들 이유가 없습니다
        self.archive = zipfile.ZipFile(
            io.BytesIO(source) if isinstance(source, (bytes, bytearray)) else source
        )
        self._load_styles()
        self._load_shared_strings()
        self._load_sheet_index()

    def _load_styles(self) -> None:
        self._load_fills()
        self._load_fonts()

    def _load_fonts(self) -> None:
        """굵기와 밑줄이 **둘 다** 걸린 글꼴만 표시해 둡니다 (심화필수 표기)."""
        styles = ET.fromstring(self.archive.read("xl/styles.xml"))
        self.font_strong: list[bool] = [
            node.find(f"{SHEET_NS}b") is not None and node.find(f"{SHEET_NS}u") is not None
            for node in styles.find(f"{SHEET_NS}fonts")
        ]
        self.style_font: list[int] = [
            int(xf.get("fontId", 0)) for xf in styles.find(f"{SHEET_NS}cellXfs")
        ]

    def _load_fills(self) -> None:
        styles = ET.fromstring(self.archive.read("xl/styles.xml"))
        self.fills: list[str] = []
        for node in styles.find(f"{SHEET_NS}fills"):
            pattern = node.find(f"{SHEET_NS}patternFill")
            key = "none"
            if pattern is not None and pattern.get("patternType") not in (None, "none"):
                color = pattern.find(f"{SHEET_NS}fgColor")
                if color is not None:
                    key = color.get("rgb") or f"theme{color.get('theme')}"
                else:
                    key = pattern.get("patternType")
            self.fills.append(key)

        self.style_fill: list[int] = [
            int(xf.get("fillId", 0)) for xf in styles.find(f"{SHEET_NS}cellXfs")
        ]

    def _load_shared_strings(self) -> None:
        root = ET.fromstring(self.archive.read("xl/sharedStrings.xml"))
        self.shared = [
            "".join(node.text or "" for node in item.iter(f"{SHEET_NS}t"))
            for item in root.findall(f"{SHEET_NS}si")
        ]

    def _load_sheet_index(self) -> None:
        workbook = self.archive.read("xl/workbook.xml").decode("utf-8")
        rels = self.archive.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        targets = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
        self.sheets: dict[str, str] = {}
        for match in re.finditer(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', workbook):
            self.sheets[match.group(1)] = "xl/" + targets[match.group(2)].lstrip("/")

    def read(self, sheet_name: str) -> Sheet:
        root = ET.fromstring(self.archive.read(self.sheets[sheet_name]))
        sheet = Sheet()
        for cell in root.iter(f"{SHEET_NS}c"):
            ref = re.fullmatch(r"([A-Z]+)(\d+)", cell.get("r") or "")
            if not ref:
                continue
            position = (int(ref.group(2)), column_number(ref.group(1)))
            style = int(cell.get("s", 0))
            fill = self.fills[self.style_fill[style]] if style < len(self.style_fill) else "none"
            if style < len(self.style_font) and self.font_strong[self.style_font[style]]:
                sheet.strong.add(position)

            kind = cell.get("t")
            value = cell.find(f"{SHEET_NS}v")
            text = ""
            if kind == "s" and value is not None:
                text = self.shared[int(value.text)]
            elif kind == "inlineStr":
                inline = cell.find(f"{SHEET_NS}is")
                if inline is not None:
                    text = "".join(n.text or "" for n in inline.iter(f"{SHEET_NS}t"))
            elif value is not None:
                text = value.text or ""
            sheet.cells[position] = (text.strip(), fill)
        return sheet
