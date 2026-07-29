"""
교육과정 카탈로그와 과목 선수관계를 seed JSON으로 만듭니다.

    python -m backend.build_curriculum_seed
    python -m backend.build_curriculum_seed --dry-run    # 저장하지 않고 결과만 출력

## 소스가 두 개인 이유

과목 목록·학점·설명은 SweetZamong이 이미 정리해 둔 `courses` 테이블에서 가져옵니다.
반면 **선수관계는 DB에 없습니다** — Zamong 워크북의 학과별 시트에만, 그것도 데이터가
아니라 셀 배경색으로 그린 그림으로 들어 있습니다. 그래서 xlsx를 따로 읽습니다.

## 선수관계를 읽는 방법 — 두 가지 표기가 섞여 있습니다

**(1) 선으로 그린 학과 시트** (융합 제외 전부)

    [수학1]──[수학2]─┬─[미적분학1]─┬─[미적분학2]─┬─[미적분학3]
                     ├─[수학3]     ├─[선형대수]  ├─[확률및통계]
                     └─[기초정수론] └─[미분방정식] └─[논리및집합]

과목 상자는 배경색을 칠한 셀 덩어리이고, 상자를 잇는 선은 회색(D2D2D6)으로 칠한
셀들입니다. 세로 선은 폭 3짜리 좁은 열(H·M·R)을 통로로 씁니다.

1. 회색 셀들을 4방향으로 이어 붙여 선 한 가닥(연결 성분)을 만듭니다
2. 그 가닥의 왼쪽에 닿은 상자가 선수 과목, 오른쪽에 닿은 상자들이 후수 과목입니다
3. 한 가닥이 여러 상자에 닿으면 그만큼 분기합니다 (수학2 → 3과목)

**(2) 이름을 적어 둔 융합 시트**

융합 과목은 다른 학과 과목을 선수로 받기 때문에 선을 그릴 수 없습니다. 대신 상자
왼쪽에 선수 과목명을 회색 셀에 적어 뒀고, 대체 가능하면 사이에 "OR"을 넣었습니다.

    [물리학및실험2]
                   [OR]  ┃예술속의물리┃
    [일반물리학2]

그래서 회색 셀의 글자를 과목명으로 해석해 오른쪽 상자에 잇습니다. "OR"이 함께 있으면
`alternative`로 표시해 둘 중 하나만 들어도 되는 관계임을 남깁니다.

두 방식 모두 카탈로그에 있는 이름만 씁니다. "택1", "3학점 이상 택2" 같은 안내 문구는
카탈로그에 없으므로 자연히 걸러집니다.

결과 JSON만 리포에 커밋합니다. 원본 xlsx(685KB)와 SweetZamong DB는 넣지 않습니다 —
교육과정은 자주 바뀌지 않고, 서버가 엑셀을 다시 읽을 이유가 없습니다.
"""

import argparse
import json
import os
import re
import sqlite3
import zipfile
from collections import deque
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

SHEET_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

DEFAULT_DB = os.path.expanduser(
    "~/Projects/Side Projects/SweetZamong/backend/sweet_zamong.db"
)
DEFAULT_XLSX_DIR = os.path.expanduser("~/Projects/Side Projects/SweetZamong")
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), "curriculum_seed.json")

# 학과 시트 이름 — Zamong 워크북의 시트 구성과 같아야 합니다
DEPARTMENTS = [
    "수학", "정보과학", "물리학", "지구과학", "화학", "생물학",
    "외국어", "국어", "사회", "예체능", "융합",
]

# 과목 상자를 잇는 선의 색. 융합 시트에서는 선수 과목명을 적는 칸의 색이기도 합니다
LINE_FILL = "FFD2D2D6"

# 선 대신 과목명을 적어 둔 시트
TEXT_PREREQ_SHEETS = {"융합"}

# 시트에만 쓰이는 축약형
ABBREVIATIONS = {
    "일물실1": "일반물리학실험1",
    "일물실2": "일반물리학실험2",
    "일물1": "일반물리학1",
    "일물2": "일반물리학2",
}


def column_number(column: str) -> int:
    number = 0
    for char in column:
        number = number * 26 + ord(char) - 64
    return number


@dataclass
class Sheet:
    """셀 좌표 → (텍스트, 채움색)"""

    cells: dict[tuple[int, int], tuple[str, str]] = field(default_factory=dict)


class Workbook:
    """xlsx에서 셀 값과 채움색만 읽습니다 (openpyxl 없이)."""

    def __init__(self, path: str):
        self.archive = zipfile.ZipFile(path)
        self._load_fills()
        self._load_shared_strings()
        self._load_sheet_index()

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


def connected_groups(positions: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    """상하좌우로 붙어 있는 셀들을 한 덩어리로 묶습니다."""
    remaining = set(positions)
    groups: list[set[tuple[int, int]]] = []
    while remaining:
        start = remaining.pop()
        group = {start}
        queue = deque([start])
        while queue:
            row, col = queue.popleft()
            for neighbor in ((row + 1, col), (row - 1, col), (row, col + 1), (row, col - 1)):
                if neighbor in remaining:
                    remaining.discard(neighbor)
                    group.add(neighbor)
                    queue.append(neighbor)
        groups.append(group)
    return groups


def resolve_course_name(text: str, known_courses: set[str]) -> str | None:
    """
    시트에 적힌 글자를 카탈로그 과목명으로 바꿉니다. 못 찾으면 None.

    시트는 "미적분학2"라고만 쓰지만 카탈로그 이름은 "미적분학2(EC)"이고,
    "일물실1" 같은 축약형도 씁니다.
    """
    name = text.strip().strip(",")
    if not name:
        return None
    for candidate in (name, ABBREVIATIONS.get(name, ""), f"{name}(EC)"):
        if candidate in known_courses:
            return candidate
    return None


def find_boxes(
    sheet: Sheet, known_courses: set[str]
) -> tuple[dict[tuple[int, int], str], dict[str, tuple[int, int, int, int]]]:
    """
    과목 상자를 찾습니다. 셀 → 과목명 맵과, 과목명 → 상자 범위를 함께 돌려줍니다.

    상자 안에는 한글명·영문명·학점이 함께 들어 있어서, 카탈로그에 있는 이름만 고릅니다.
    """
    box_cells = {
        position for position, (_, fill) in sheet.cells.items()
        if fill not in ("none", LINE_FILL)
    }
    cell_name: dict[tuple[int, int], str] = {}
    bounds: dict[str, tuple[int, int, int, int]] = {}
    for group in connected_groups(box_cells):
        names = [
            resolved
            for position in sorted(group)
            if (resolved := resolve_course_name(sheet.cells[position][0], known_courses))
        ]
        if not names:
            continue
        name = names[0]
        rows = [row for row, _ in group]
        cols = [col for _, col in group]
        bounds.setdefault(name, (min(rows), max(rows), min(cols), max(cols)))
        for position in group:
            cell_name[position] = name
    return cell_name, bounds


def extract_line_prerequisites(
    sheet: Sheet, known_courses: set[str]
) -> tuple[set[tuple[str, str]], list[str]]:
    """선으로 그린 시트에서 (선수과목, 후수과목) 쌍을 뽑습니다."""
    cell_name, _ = find_boxes(sheet, known_courses)
    line_cells = {
        position for position, (text, fill) in sheet.cells.items()
        if fill == LINE_FILL and not text
    }

    edges: set[tuple[str, str]] = set()
    dangling: list[str] = []
    for group in connected_groups(line_cells):
        before: set[str] = set()
        after: set[str] = set()
        for row, col in group:
            if left := cell_name.get((row, col - 1)):
                before.add(left)
            if right := cell_name.get((row, col + 1)):
                after.add(right)
        if before and after:
            for source in before:
                for target in after:
                    if source != target:
                        edges.add((source, target))
        elif before or after:
            dangling.extend(sorted(before or after))
    return edges, dangling


def extract_text_prerequisites(
    sheet: Sheet, known_courses: set[str]
) -> tuple[set[tuple[str, str, bool]], list[str]]:
    """
    선수 과목명을 적어 둔 시트(융합)에서 관계를 뽑습니다.

    회색 칸의 글자를 과목명으로 읽고, 그 오른쪽에서 세로로 겹치는 가장 가까운
    상자에 잇습니다. 상자 왼쪽에 "OR"이 적혀 있으면 대체 관계로 표시합니다.
    """
    cell_name, bounds = find_boxes(sheet, known_courses)

    labels: list[tuple[int, int, str]] = []
    or_marks: list[tuple[int, int]] = []
    for (row, col), (text, fill) in sheet.cells.items():
        if fill != LINE_FILL or not text:
            continue
        if text.strip().upper() == "OR":
            or_marks.append((row, col))
            continue
        for piece in text.split(","):
            if name := resolve_course_name(piece, known_courses):
                labels.append((row, col, name))

    def target_at(row: int, col: int) -> str | None:
        """오른쪽에서 세로로 겹치는 가장 가까운 상자"""
        candidates = [
            (left, name)
            for name, (top, bottom, left, _) in bounds.items()
            if left > col and top <= row <= bottom
        ]
        return min(candidates)[1] if candidates else None

    # "OR"도 과목명과 같은 규칙으로 상자를 찾습니다. 단순히 상자 왼쪽에 있는지만 보면
    # 한참 왼쪽 다른 열의 마커까지 걸려서, 선수가 하나뿐인 과목이 대체로 잘못 표시됩니다
    or_targets = {target for row, col in or_marks if (target := target_at(row, col))}

    edges: set[tuple[str, str, bool]] = set()
    unmatched: list[str] = []
    for row, col, before in labels:
        after = target_at(row, col)
        if after is None or after == before:
            unmatched.append(before)
            continue
        edges.add((before, after, after in or_targets))
    return edges, unmatched


def load_catalog(db_path: str) -> list[dict]:
    if not os.path.exists(db_path):
        raise SystemExit(f"SweetZamong DB를 찾을 수 없습니다: {db_path}")

    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        """
        SELECT name, english_name, department, category, credits, ap_credits,
               is_ec, is_pf, recommended_semester, aliases,
               description, description_sections, description_source, description_page
        FROM courses ORDER BY department, name
        """
    ).fetchall()
    conn.close()

    catalog = []
    for row in rows:
        (name, english, department, category, credits, ap_credits, is_ec, is_pf,
         semester, aliases, description, sections, source, page) = row
        catalog.append(
            {
                "name": name,
                "english_name": english,
                "department": department,
                "category": category,
                "credits": float(credits or 0),
                "ap_credits": float(ap_credits or 0),
                "is_ec": bool(is_ec),
                "is_pf": bool(is_pf),
                "recommended_semester": semester,
                "aliases": json.loads(aliases or "[]"),
                "description": description,
                "description_sections": json.loads(sections or "{}"),
                "description_source": source,
                "description_page": page,
            }
        )
    return catalog


def find_workbook(directory: str) -> str:
    candidates = [
        os.path.join(directory, name)
        for name in sorted(os.listdir(directory))
        if name.endswith(".xlsx") and not name.startswith("~$")
    ]
    if not candidates:
        raise SystemExit(f"xlsx 파일을 찾을 수 없습니다: {directory}")
    return candidates[0]


def run(db_path: str, xlsx_dir: str, output: str, dry_run: bool) -> int:
    catalog = load_catalog(db_path)
    known = {course["name"] for course in catalog}
    print(f"카탈로그 {len(catalog)}개 과목 (고유 이름 {len(known)}개)")

    xlsx_path = find_workbook(xlsx_dir)
    workbook = Workbook(xlsx_path)
    print(f"워크북: {os.path.basename(xlsx_path)}")

    all_edges: set[tuple[str, str, bool]] = set()
    print("\n[학과별 선수관계]")
    for department in DEPARTMENTS:
        if department not in workbook.sheets:
            print(f"  {department}: 시트 없음 — 건너뜁니다")
            continue
        sheet = workbook.read(department)
        if department in TEXT_PREREQ_SHEETS:
            edges, skipped = extract_text_prerequisites(sheet, known)
            note = f" (연결할 상자를 못 찾음: {', '.join(skipped)})" if skipped else ""
        else:
            line_edges, dangling = extract_line_prerequisites(sheet, known)
            edges = {(before, after, False) for before, after in line_edges}
            note = f" (한쪽만 닿은 선: {', '.join(dangling)})" if dangling else ""
        all_edges |= edges
        alternatives = sum(1 for *_, is_alt in edges if is_alt)
        alt_note = f", 대체 {alternatives}개" if alternatives else ""
        print(f"  {department}: {len(edges)}개{alt_note}{note}")

    print(f"\n선수관계 총 {len(all_edges)}개")

    seed = {
        "version": 1,
        "source_workbook": os.path.basename(xlsx_path),
        "courses": catalog,
        "prerequisites": [
            {"before": before, "after": after, "alternative": alternative}
            for before, after, alternative in sorted(all_edges)
        ],
    }

    if dry_run:
        print("\n--dry-run: 저장하지 않았습니다.")
        return 0

    with open(output, "w", encoding="utf-8") as file:
        json.dump(seed, file, ensure_ascii=False, indent=2)
        file.write("\n")
    size = os.path.getsize(output) / 1024
    print(f"\n{output} 저장 ({size:.0f}KB)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="교육과정 seed JSON 생성")
    parser.add_argument("--db", default=DEFAULT_DB, help="SweetZamong sqlite 경로")
    parser.add_argument("--xlsx-dir", default=DEFAULT_XLSX_DIR, help="Zamong 워크북이 있는 폴더")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="생성할 seed JSON 경로")
    parser.add_argument("--dry-run", action="store_true", help="저장 없이 결과만 출력")
    args = parser.parse_args()
    return run(args.db, args.xlsx_dir, args.output, args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
