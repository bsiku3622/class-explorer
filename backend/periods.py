"""교시별 시각표.

**여기가 유일한 원본입니다.** 프론트가 따로 상수를 들고 있으면 한쪽만 고쳤을 때
조용히 어긋나므로, 화면도 `GET /periods` 로 받아 씁니다.

규칙은 단순합니다 — 50분 수업 + 10분 쉬는시간.

    1교시 08:40  …  4교시 ~12:30
    점심 12:30–13:20 · AA 미팅 13:20–13:40
    5교시 13:40  …  11교시 ~20:30

⚠️ **확인이 필요한 부분**

- 저녁 식사 시간이 이 표에 없습니다. 9~10교시가 17:40~19:30 으로 이어지는데,
  실제로 그 사이에 저녁이 있다면 10·11교시 시각이 통째로 밀립니다
- 자습(19:30–21:30)이 11교시(19:40–20:30)와 겹칩니다. 자습을 몇 교시로 부르는지는
  아직 확정되지 않았습니다

둘 다 정해지면 아래 표만 고치면 됩니다. 시각은 자정 기준 분(minute)입니다.
"""

DAYS = ("MON", "TUE", "WED", "THU", "FRI")


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
    *_series(_m(8, 40), 4, 1),    # 1~4교시  08:40 ~ 12:30
    *_series(_m(13, 40), 7, 5),   # 5~11교시 13:40 ~ 20:30
]

# 수업이 아닌 시간대. 화면에 "지금 뭐 하는 시간인지" 를 보여 줄 때 씁니다
BREAKS: list[tuple[str, int, int]] = [
    ("점심", _m(12, 30), _m(13, 20)),
    ("AA 미팅", _m(13, 20), _m(13, 40)),
    ("자습", _m(19, 30), _m(21, 30)),
    ("간식", _m(21, 30), _m(22, 10)),
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
    """지금이 무슨 시간인지 (점심·자습 등). 아니면 None"""
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
