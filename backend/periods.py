"""교시별 시각표.

**여기가 유일한 원본입니다.** 프론트가 따로 상수를 들고 있으면 한쪽만 고쳤을 때
조용히 어긋나므로, 화면도 `GET /periods` 로 받아 씁니다.

규칙은 단순합니다 — 50분 수업 + 10분 쉬는시간.

    1교시 08:40  …  4교시 ~12:30
    점심 12:30–13:20 · AA 미팅 13:20–13:40
    5교시 13:40  …  11교시 ~20:30

**`BREAKS` 는 수업을 밀지 않습니다.** 점심·AA 미팅은 교시 사이의 빈 자리지만,
저녁(17:30–19:00)과 자습(19:30–21:30)은 **수업과 동시에 진행**됩니다 — 저녁은 9교시
전체와 10교시 앞부분에, 자습은 11교시에 겹칩니다. 그래서 `current_period()` 와
`current_break()` 는 각각 따로 답하고, 화면은 "9교시 · 저녁" 처럼 같이 보여 줍니다.

남은 미정: 자습 시간대를 학교에서 몇 교시로 부르는지. 표시 문구에만 영향을 줍니다.

시각은 자정 기준 분(minute)입니다.
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

# 수업 외 시간대. **교시와 겹칠 수 있습니다** — 저녁·자습은 수업과 동시에 돌아갑니다.
# 서로 겹치지는 않으므로 먼저 걸리는 것을 그대로 씁니다.
BREAKS: list[tuple[str, int, int]] = [
    ("점심", _m(12, 30), _m(13, 20)),
    ("AA 미팅", _m(13, 20), _m(13, 40)),
    ("저녁", _m(17, 30), _m(19, 0)),    # 9교시~10교시 앞부분과 겹침
    ("자습", _m(19, 30), _m(21, 30)),   # 11교시와 겹침
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
