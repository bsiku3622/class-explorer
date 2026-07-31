"""교시별 시각표.

**여기가 유일한 원본입니다.** 프론트가 따로 상수를 들고 있으면 한쪽만 고쳤을 때
조용히 어긋나므로, 화면도 `GET /periods` 로 받아 씁니다.

출처는 생활관에 붙은 **「생활관 일과 운영」** 표입니다. 짐작으로 이어붙이지 마세요 —
10·11교시가 앞의 규칙을 따르지 않습니다.

    1교시 08:40~09:30  …  4교시 11:40~12:30      (50분 + 10분 쉬는시간)
    점심 12:30~13:10 · 학급모임 13:20~13:40
    5교시 13:40~14:30  …  9교시 17:40~18:30      (같은 규칙)
    저녁 17:30~19:00                              ← 9교시와 **겹칩니다**
    10교시 19:30~20:20 · 11교시 20:30~21:20
    자습 19:30~21:30                              ← 10·11교시를 **감쌉니다**

⚠️ **9교시 다음이 10교시가 아닙니다.** 9교시가 18:30 에 끝나고 한 시간을 건너뛰어
10교시가 19:30 에 시작합니다(그 사이가 저녁·퇴실). 5교시부터 50+10 을 그대로 이어
붙이면 18:40·19:40 이 나오는데 **틀립니다.**

`BREAKS` 중 **저녁과 자습은 교시와 겹칩니다.** 그래서 `current_period()` 와
`current_break()` 를 배타적으로 보면 안 되고, 화면은 "10교시 · 자습" 처럼 둘을 같이
보여 줍니다.

시각은 자정 기준 분(minute)입니다.

**"지금" 은 반드시 `now()` 로 가져오세요.** 배포 서버가 UTC 로 돌고 있어서
`datetime.now()` 를 그대로 쓰면 교시가 9시간 어긋나고 날짜가 하루 밀립니다.
"""

import datetime
from zoneinfo import ZoneInfo

DAYS = ("MON", "TUE", "WED", "THU", "FRI")

# 학교 시각. 서버 타임존에 기대지 않습니다 — 서버를 옮겨도 교시는 KST 여야 합니다
KST = ZoneInfo("Asia/Seoul")


def now() -> datetime.datetime:
    """지금(KST). 시각을 보는 곳은 전부 여기를 거칩니다."""
    return datetime.datetime.now(KST)


def today() -> datetime.date:
    """오늘(KST). UTC 서버에서 `date.today()` 는 하루 밀립니다."""
    return now().date()


def _m(hour: int, minute: int) -> int:
    return hour * 60 + minute


def _series(first_start: int, count: int, start_period: int) -> list[tuple[int, int, int]]:
    """50분 수업 + 10분 쉬는시간으로 이어지는 교시들"""
    return [
        (start_period + i, first_start + i * 60, first_start + i * 60 + 50)
        for i in range(count)
    ]


# (교시, 시작, 끝) — 자정 기준 분
PERIODS: list[tuple[int, int, int]] = [
    *_series(_m(8, 40), 4, 1),     # 1~4교시   08:40 ~ 12:30
    *_series(_m(13, 40), 5, 5),    # 5~9교시   13:40 ~ 18:30
    *_series(_m(19, 30), 2, 10),   # 10~11교시 19:30 ~ 21:20 (9교시와 한 시간 떨어져 있음)
]

# 수업 외 시간대. **저녁·자습은 교시와 겹칩니다** — 서로 겹치지는 않으므로 먼저
# 걸리는 것을 그대로 씁니다.
BREAKS: list[tuple[str, int, int]] = [
    ("아침식사", _m(7, 10), _m(8, 30)),
    ("점심", _m(12, 30), _m(13, 10)),
    ("학급모임", _m(13, 20), _m(13, 40)),
    ("저녁", _m(17, 30), _m(19, 0)),     # 9교시와 겹침
    ("자습", _m(19, 30), _m(21, 30)),    # 10·11교시를 감쌈
    ("입실", _m(21, 30), _m(23, 20)),
]

FIRST_PERIOD_START = PERIODS[0][1]
LAST_PERIOD_END = PERIODS[-1][2]


def hhmm(minute: int) -> str:
    return f"{minute // 60:02d}:{minute % 60:02d}"


def current_period(minute: int) -> int | None:
    """지금이 몇 교시인지. 쉬는시간·점심이면 None"""
    for period, start, end in PERIODS:
        if start <= minute < end:
            return period
    return None

def current_break(minute: int) -> str | None:
    """지금이 무슨 시간대인지 (점심·저녁·자습 등). 아니면 None.

    **교시와 배타적이지 않습니다** — 저녁·자습은 수업과 동시에 진행되므로
    `current_period()` 와 둘 다 값이 나올 수 있습니다.
    """
    for name, start, end in BREAKS:
        if start <= minute < end:
            return name
    return None


def next_period(minute: int) -> tuple[int, int, int] | None:
    """다음에 시작하는 교시. 오늘 수업이 다 끝났으면 None"""
    for entry in PERIODS:
        if entry[1] > minute:
            return entry
    return None


def as_table() -> list[dict]:
    """`GET /periods` 응답용"""
    return [
        {"period": p, "start": hhmm(s), "end": hhmm(e), "start_minute": s, "end_minute": e}
        for p, s, e in PERIODS
    ]


def breaks_table() -> list[dict]:
    return [
        {"name": n, "start": hhmm(s), "end": hhmm(e), "start_minute": s, "end_minute": e}
        for n, s, e in BREAKS
    ]
