"""
사람이 채운 Zamong 워크북(xlsx)을 읽어 자몽 기록으로 옮깁니다.

## 왜 서버에서 읽나

브라우저에서 xlsx 를 열려면 파서를 하나 더 들여야 하는데(SheetJS 는 1MB 가까이 됩니다),
서버에는 교육과정 seed 를 만들 때 쓰던 리더(`workbook.py`)가 이미 있습니다. 표준
라이브러리만 쓰는 코드라 의존성도 안 늘어납니다.

## 카드를 찾는 방법

학과 시트의 과목 카드는 **어디에 있든 같은 모양**입니다:

```
      (r,  c)  과목명            ← 사용자가 EC 를 골랐으면 "미적분학2(EC)"
      (r+1,c)  Calculus2
      (r+2,c)  5        (r+2,c+1) "학기"
      (r+3,c)  "학점"   (r+3,c+1) 4
      (r+4,c)  "평어"   (r+4,c+1) A-
```

그래서 **`(r+3,c)=="학점"` 이고 `(r+4,c)=="평어"`** 인 자리를 카드 제목으로 봅니다.
색이나 병합을 보지 않으므로 시트를 조금 손봐도 잘 버팁니다.

⚠️ **읽는 건 캐시된 값입니다.** 학기·평어 칸은 드롭다운으로 고른 **값**이라 수식이
아니고 그대로 들어 있습니다. 다만 파일을 한 번도 저장하지 않았다면 비어 있을 수
있는데, 그건 워크북 문제라 우리가 할 수 있는 게 없습니다.
"""

from dataclasses import dataclass

from backend.workbook import Sheet, Workbook

# 학과 시트 이름. 요약 시트(`Zamong`)와 `HP` 는 카드가 없어 건너뜁니다
DEPARTMENT_SHEETS = [
    "수학", "정보과학", "물리학", "지구과학", "화학", "생물학",
    "외국어", "국어", "사회", "예체능", "융합",
]

EC_TAG = "(EC)"


@dataclass
class ImportedEntry:
    course: str
    term: str | None
    grade: str | None
    is_ec: bool


@dataclass
class ImportResult:
    entries: list[ImportedEntry]
    """워크북에 있지만 우리 교육과정에 없는 이름 — 무시했습니다"""
    unknown_courses: list[str]
    """학기 값이 우리가 아는 칸이 아니어서 버린 것 (`7학기(HP)` 같은 표기)"""
    unknown_terms: list[str]
    unknown_grades: list[str]
    sheets_read: list[str]


def _text(sheet: Sheet, row: int, col: int) -> str:
    value = sheet.cells.get((row, col))
    return value[0].strip() if value else ""


def _normalize_term(raw: str, valid: set[str]) -> tuple[str | None, str | None]:
    """
    워크북의 학기 값을 우리 칸으로 옮깁니다.

    `5`, `5.0`, `5학기`, `계절`, `계절학기` 를 모두 받습니다 — 드롭다운으로 고른 값이
    시트마다 조금씩 다르게 저장돼 있습니다.
    """
    if not raw:
        return None, None
    text = raw.replace("학기", "").strip()
    if text.startswith("계절") or text == "S":
        return ("S", None) if "S" in valid else (None, raw)
    try:
        # "5.0" 처럼 숫자로 저장된 경우
        index = int(float(text))
    except ValueError:
        return None, raw
    key = str(index)
    return (key, None) if key in valid else (None, raw)


def parse_workbook(
    data: bytes,
    known_courses: set[str],
    valid_terms: set[str],
    valid_grades: set[str],
) -> ImportResult:
    """
    워크북 바이트를 읽어 자몽 기록을 만듭니다.

    `known_courses` 는 **언어 태그를 뗀** 교육과정 이름입니다. 워크북 제목이
    `미적분학2(EC)` 면 과목은 `미적분학2` 이고 `is_ec` 가 참이 됩니다.
    """
    workbook = Workbook(data)

    found: dict[str, ImportedEntry] = {}
    unknown_courses: list[str] = []
    unknown_terms: list[str] = []
    unknown_grades: list[str] = []
    sheets_read: list[str] = []

    for name in DEPARTMENT_SHEETS:
        if name not in workbook.sheets:
            continue
        sheet = workbook.read(name)
        sheets_read.append(name)

        for (row, col), (text, _fill) in sheet.cells.items():
            title = text.strip()
            if not title:
                continue
            # 카드 제목의 표식 — 세 줄 아래가 "학점", 네 줄 아래가 "평어"
            if _text(sheet, row + 3, col) != "학점" or _text(sheet, row + 4, col) != "평어":
                continue

            is_ec = title.endswith(EC_TAG)
            course = title[: -len(EC_TAG)].strip() if is_ec else title
            if course not in known_courses:
                unknown_courses.append(title)
                continue

            term, bad_term = _normalize_term(_text(sheet, row + 2, col), valid_terms)
            if bad_term:
                unknown_terms.append(bad_term)

            grade_raw = _text(sheet, row + 4, col + 1)
            grade = grade_raw if grade_raw in valid_grades else None
            if grade_raw and grade is None:
                unknown_grades.append(grade_raw)

            # ⚠️ **학기가 없으면 안 들은 것입니다.** 워크북에는 안 들은 과목의 카드도
            # 다 있고, 제목만 EC 로 골라 둔 카드(`미분방정식(EC)`)도 흔합니다 — 학기
            # 없는 EC 표시는 "영어강의로 들을 생각" 이지 이수가 아닙니다. 우리 규칙도
            # 같습니다: 학기가 있어야 학점이 붙습니다
            if term is None:
                continue

            # 같은 과목이 여러 시트·여러 칸에 나올 수 있어(융합 시트가 타 학과 과목을
            # 적어 두는 식) 먼저 찾은 것을 남깁니다
            if course in found:
                continue
            found[course] = ImportedEntry(
                course=course, term=term, grade=grade, is_ec=is_ec
            )

    return ImportResult(
        entries=sorted(found.values(), key=lambda entry: entry.course),
        unknown_courses=sorted(set(unknown_courses)),
        unknown_terms=sorted(set(unknown_terms)),
        unknown_grades=sorted(set(unknown_grades)),
        sheets_read=sheets_read,
    )
