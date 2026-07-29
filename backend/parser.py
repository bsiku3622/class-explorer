import json
from collections import Counter
from typing import Any, TypedDict


class ClassTimeDict(TypedDict):
    day: str
    period: int
    room: str


class ParsedClass(TypedDict):
    subject: str
    section: str
    teacher: str
    room: str
    times: list[ClassTimeDict]


DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI"]
UNASSIGNED_ROOM = "배정중"


def _pick_room(rooms: list[str]) -> str:
    """
    시간대별 강의실 목록에서 대표 강의실을 고릅니다.
    실제 배정된 강의실이 하나라도 있으면 '배정중'보다 우선합니다.
    """
    assigned = [r for r in rooms if r and r != UNASSIGNED_ROOM]
    pool = assigned or [r for r in rooms if r]
    if not pool:
        return UNASSIGNED_ROOM
    return Counter(pool).most_common(1)[0][0]


def _parse_cell(cell: str) -> tuple[str, str, str, str] | None:
    """
    시간표 한 칸을 `subject / section / teacher / room` 으로 분해합니다.
    형식: "미적분학2(Calculus2)<br>5분반<br>임종렬<br>형3407"
    """
    parts = [p.strip() for p in cell.split("<br>")]
    if len(parts) < 3 or not parts[0]:
        return None
    subject, section, teacher = parts[0], parts[1], parts[2]
    room = parts[3] if len(parts) > 3 and parts[3] else UNASSIGNED_ROOM
    return subject, section, teacher, room


def parse_schedule(raw_data: str) -> list[ParsedClass]:
    """
    KEIS 시간표 API 응답에서 '중복 없는 수강 목록'과 각 수업의 시간대(요일, 교시)를 추출합니다.

    응답 형식 (이중 JSON 인코딩):
      {"data": "[{\"kyosi\": \"1\", \"value1\": null, \"value2\": \"과목<br>분반<br>교사<br>강의실\", ...}]"}
      - kyosi   = 교시 번호
      - value1~5 = 월~금
    """
    try:
        payload: Any = json.loads(raw_data)
    except (json.JSONDecodeError, TypeError):
        return []

    inner = payload.get("data") if isinstance(payload, dict) else None
    if not inner:
        return []

    try:
        rows = json.loads(inner) if isinstance(inner, str) else inner
    except json.JSONDecodeError:
        return []

    if not isinstance(rows, list):
        return []

    # (subject, section, teacher) 단위로 묶고 시간대를 누적
    class_map: dict[tuple[str, str, str], ParsedClass] = {}
    seen_slots: dict[tuple[str, str, str], set[tuple[str, int]]] = {}
    room_pool: dict[tuple[str, str, str], list[str]] = {}

    for row in rows:
        if not isinstance(row, dict):
            continue

        try:
            period = int(str(row.get("kyosi", "")).strip())
        except (TypeError, ValueError):
            continue

        for i, day in enumerate(DAY_NAMES, start=1):
            cell = row.get(f"value{i}")
            if not cell or not isinstance(cell, str):
                continue

            parsed = _parse_cell(cell)
            if parsed is None:
                continue
            subject, section, teacher, room = parsed

            key = (subject, section, teacher)
            if key not in class_map:
                class_map[key] = {
                    "subject": subject,
                    "section": section,
                    "teacher": teacher,
                    "room": room,
                    "times": [],
                }
                seen_slots[key] = set()
                room_pool[key] = []

            slot = (day, period)
            if slot in seen_slots[key]:
                continue
            seen_slots[key].add(slot)

            class_map[key]["times"].append({"day": day, "period": period, "room": room})
            room_pool[key].append(room)

    for key, cls in class_map.items():
        cls["room"] = _pick_room(room_pool[key])
        cls["times"].sort(key=lambda t: (DAY_NAMES.index(t["day"]), t["period"]))

    return list(class_map.values())
