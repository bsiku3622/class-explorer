"""
한시적으로 여는 기능의 **마감 시각**.

프론트에도 같은 이름의 파일(`frontend/src/lib/features.ts`)이 있지만, **여는지 닫는지를
정하는 건 여기입니다.** 화면 쪽은 껍데기(어느 학기인지·손으로 내리는 스위치)만 들고
있고, 시각 판정은 서버가 해서 `/auth/me` 에 실어 보냅니다.

⚠️ **기기 시계로 판정하면 안 됩니다.** 브라우저의 `Date.now()` 는 그 기기가 믿는
시각이라, 시계가 틀어진 폰에서는 마감이 지나도 열려 있습니다. 마감이 있는 기능은
**한 시계**로 재야 하고, 그 시계는 서버입니다.
"""

import datetime

from backend import periods

# ─── 수강 변경 탐색 (Trade) ──────────────────────────────────────────────────

#: 2026-2 수강신청 정정 마감 — 2026년 8월 28일 **오후 5시 정각**(KST).
#:
#: ⚠️ 시간대를 붙여 둡니다. 배포 서버가 UTC 로 돌고 있어서 naive 로 적으면 9시간
#: 어긋납니다 (`periods.py` 의 같은 경고를 보세요).
TRADE_UNTIL = datetime.datetime(2026, 8, 28, 17, 0, 0, tzinfo=periods.KST)

#: 기간과 무관하게 손으로 내리는 스위치.
TRADE_ENABLED = True


def trade_open() -> bool:
    """지금 Trade 를 열어도 되는가. 화면 넷(배너·메뉴·라우트·계획 전환)이 이 하나로 갈립니다."""
    return TRADE_ENABLED and periods.now() < TRADE_UNTIL
