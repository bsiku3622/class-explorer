"""급식 — ksain.net 이 열어 둔 학교 급식 API 를 `meal_menus` 에 쌓아 두고 읽습니다.

홈(`GET /meal`)과 Agent(`meal` 도구)가 같이 씁니다. 키(`KSAIN_API_KEY`)가 없으면 급식만 비고
나머지는 그대로 돕니다 — 홈 전체가 죽으면 안 됩니다.
"""
import datetime
import re

import httpx
from sqlalchemy.orm import Session

from backend import models
from backend.core import config
from backend.services import periods

MEAL_URL = "https://api.ksain.net/v1/meal.php"
SLOTS = ("breakfast", "lunch", "dinner")


def enabled() -> bool:
    """급식을 받을 수 있는가 — 키가 없으면 화면이 급식 칸을 아예 그리지 않습니다."""
    return bool(config.KSAIN_API_KEY)


def _lines(raw: str | None) -> list[str]:
    """API 가 주는 한 덩어리 문자열을 메뉴 줄로 쪼갭니다.

    앞뒤로 빈 줄이 붙어 오고, 급식이 아직 안 올라온 날은 `"\\n"` 하나만 옵니다 —
    그래서 빈 줄을 걷어낸 결과가 곧 "그날 급식이 있느냐"입니다.

    원문에 섞여 있는 두 가지를 여기서 정리합니다.

    - **축산물 이력번호** — `찹스테이크(호주산801000310667)`. 원산지는 남기고 번호만
      지웁니다. 화면에서 읽을 일이 없는 12자리입니다
    - **`&` 로 시작하는 줄** — `단호박카레라이스` / `&소시지` 처럼 한 메뉴가 급식표
      칸 너비 때문에 두 줄로 갈린 것이라 앞 줄에 붙입니다
    - **괄호가 안 닫힌 줄** — `과일(메론` / `파인애플)` 도 같은 이유로 갈린 것입니다.
      앞 줄에 여는 괄호가 더 많으면 다음 줄은 그 줄의 이어짐입니다
    """
    if not raw:
        return []

    items: list[str] = []
    for line in raw.splitlines():
        text = re.sub(r"\d{8,}", "", line).strip()
        if not text:
            continue
        open_paren = items and items[-1].count("(") > items[-1].count(")")
        if items and (text.startswith("&") or open_paren):
            items[-1] += "" if text.startswith("&") else " "
            items[-1] += text
        else:
            items.append(text)
    return items


async def fetch_meal(db: Session, day: datetime.date) -> dict[str, list[str]] | None:
    """그날의 조·중·석식.

    **DB 를 먼저 봅니다.** 한 번 받은 날짜는 다시 묻지 않습니다 — 지난 급식은 바뀌지
    않고, 학교 API 를 사람 수만큼 두드릴 이유도 없습니다.

    키가 없거나 API 가 실패하면 `None`. 아직 급식이 안 올라온 날도 `None` 이고, 이때는
    **저장하지 않아** 다음 요청이 다시 물어봅니다.
    """
    row = db.get(models.MealMenu, day)
    if row:
        return {slot: _lines(getattr(row, slot)) for slot in SLOTS}

    if not enabled():
        return None

    try:
        # 학교 API 가 3~5초씩 걸립니다. 짧게 잡으면 그날 첫 조회가 통째로 실패해서
        # 아무도 급식을 못 봅니다 — 대신 이 호출은 홈이 아니라 급식 칸만 기다립니다
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(
                MEAL_URL,
                data={"key": config.KSAIN_API_KEY, "date": day.isoformat()},
            )
        body = res.json()
    except Exception as exc:
        # 급식이 안 나온다고 홈이 죽으면 안 됩니다. 저장하지 않아 다음에 다시 시도합니다.
        # 다만 조용히 삼키면 "왜 급식만 안 나오지" 를 알 길이 없어 로그는 남깁니다
        print(f"[meal] {day} 받아오기 실패: {exc!r}")
        return None

    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, dict):
        return None

    menu = {slot: _lines(data.get(slot)) for slot in SLOTS}
    if not any(menu.values()):
        return None  # 아직 안 올라온 날 — 빈 값으로 굳히지 않습니다

    db.add(
        models.MealMenu(
            date=day,
            **{slot: "\n".join(menu[slot]) for slot in SLOTS},
        )
    )
    try:
        db.commit()
    except Exception:
        # 같은 날짜를 동시에 받아 왔을 뿐입니다. 내용은 같으니 그냥 넘어갑니다
        db.rollback()
    return menu


def current_slot(minute: int) -> str | None:
    """지금 시간대에 해당하는 끼니. 식사 시간이 아니면 다음 끼니를 가리킵니다."""
    if minute < periods.minute_of(8, 30):
        return "breakfast"
    if minute < periods.minute_of(13, 10):
        return "lunch"
    if minute < periods.minute_of(19, 0):
        return "dinner"
    return None
