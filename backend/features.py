"""
한시적으로 여는 기능의 **기간**.

프론트에도 같은 이름의 파일(`frontend/src/lib/features.ts`)이 있지만, **여는지 닫는지를
정하는 건 여기입니다.** 화면 쪽은 서버가 준 답을 받아 쓰기만 합니다.

⚠️ **기기 시계로 판정하면 안 됩니다.** 브라우저의 `Date.now()` 는 그 기기가 믿는
시각이라, 시계가 틀어진 폰에서는 마감이 지나도 열려 있습니다. 마감이 있는 기능은
**한 시계**로 재야 하고, 그 시계는 서버입니다.

값은 `settings` 표에 있고 관리자 화면에서 고칩니다 — 정정 기간은 학기마다 날짜가 달라서
상수로 두면 그때마다 배포해야 하고, 사람은 그걸 잊습니다. ⚠️ **표가 비어 있으면 아래
기본값을 씁니다.** 값을 지우는 것이 곧 "기본으로 되돌리기" 입니다.
"""

import datetime

from sqlalchemy.orm import Session

from backend import models, periods

TRADE_KEY = "trade"

#: 표에 아무것도 없을 때 쓰는 값 — 2026-2 정정 마감은 8월 28일 오후 5시(KST)였습니다.
#:
#: ⚠️ `until` 은 **시간대를 붙인 ISO** 로 적습니다. 저장이 문자열이라, 어디서 읽든 같은
#: 순간이 되려면 기준이 문자열 안에 있어야 합니다 (KST 오후 5시 = UTC 오전 8시).
TRADE_DEFAULT = {
    "enabled": True,
    "year": 2026,
    "semester": 2,
    "until": "2026-08-28T08:00:00+00:00",
}


def _read(db: Session) -> dict:
    row = db.query(models.Setting).filter(models.Setting.key == TRADE_KEY).first()
    stored = row.value if row and isinstance(row.value, dict) else {}
    return {**TRADE_DEFAULT, **stored}


def _until(value: str | None) -> datetime.datetime | None:
    """저장된 마감(ISO) → 비교할 수 있는 시각. 비어 있으면 `None` = 기한 없음."""
    if not value:
        return None
    try:
        parsed = datetime.datetime.fromisoformat(value)
    except ValueError:
        return None
    # 시간대가 없으면 UTC 로 읽습니다 — 서버 타임존에 기대지 않습니다
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=datetime.timezone.utc)


def trade_config(db: Session) -> dict:
    """
    화면에 그대로 내려보내는 모양.

    `open` 은 **스위치와 시각만** 봅니다. 어느 학기에서 보이는지는 화면이 지금 보고 있는
    학기와 `year`/`semester` 를 대 봐서 정합니다 — 서버는 그 사람이 어느 학기를 열어
    두었는지 모릅니다.
    """
    conf = _read(db)
    until = _until(conf.get("until"))
    return {
        "open": bool(conf.get("enabled")) and (until is None or periods.now() < until),
        "year": conf.get("year"),
        "semester": conf.get("semester"),
        "enabled": bool(conf.get("enabled")),
        "until": conf.get("until"),
    }


def save_trade_config(db: Session, patch: dict) -> dict:
    """관리자 화면이 보낸 값을 덮어씁니다. **준 칸만** 바뀝니다."""
    row = db.query(models.Setting).filter(models.Setting.key == TRADE_KEY).first()
    merged = {**_read(db), **patch}
    if row is None:
        db.add(models.Setting(key=TRADE_KEY, value=merged))
    else:
        row.value = merged
    db.commit()
    return trade_config(db)
