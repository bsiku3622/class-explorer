"""교시별 시각표.

**여기가 유일한 원본입니다.** 프론트가 따로 상수를 들고 있으면 한쪽만 고쳤을 때
조용히 어긋나므로, 화면도 `GET /periods` 로 받아 씁니다.

**정규 수업은 9교시까지**이고, 50분 수업 + 10분 쉬는시간으로 이어집니다.

    1교시 08:40  …  4교시 ~12:30
    점심 12:30–13:20 · AA 미팅 13:20–13:40
    5교시 13:40  …  9교시 ~18:30
    저녁 17:30–19:00  ← 수업과 **동시에** 돌아갑니다 (9교시와 겹침)
    10·11교시 = 자습 19:30–21:30
    간식 21:30–22:10

⚠️ **10·11교시는 앞의 50+10 규칙을 따르지 않습니다.** 자습이 19:30~21:30 한 덩어리라
그 안에서 반씩 나눕니다 — 이어붙이면 18:40·19:40 이 나오는데 자습보다 이릅니다.

`BREAKS` 는 두 종류가 섞여 있습니다. 점심·AA 미팅·간식은 교시 사이의 빈 자리지만,
**저녁은 수업과 동시에 진행**됩니다. 그래서 `current_period()` 와 `current_break()` 를
배타적으로 보면 안 되고, 화면은 "9교시 · 저녁" 처럼 둘을 같이 보여 줍니다.

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
    *_series(_m(13, 40), 5, 5),   # 5~9교시  13:40 ~ 18:30
    # 10·11교시는 자습(19:30~21:30)을 반으로 나눈 것입니다. 50+10 규칙 밖입니다
    (10, _m(19, 30), _m(20, 30)),
    (11, _m(20, 30), _m(21, 30)),
]

# 수업 외 시간대. **저녁은 교시와 겹칩니다** — 수업과 동시에 돌아갑니다.
# 자습은 10·11교시 그 자체라 여기 두면 이름이 두 번 나오므로 넣지 않습니다.
BREAKS: list[tuple[str, int, int]] = [
    ("점심", _m(12, 30), _m(13, 20)),
    ("AA 미팅", _m(13, 20), _m(13, 40)),
    ("저녁", _m(17, 30), _m(19, 0)),    # 9교시와 겹침
    ("간식", _m(21, 30), _m(22, 10)),
]

# 자습으로 도는 교시. 화면이 "10교시" 대신 "자습" 으로 부를 수 있게 표시해 둡니다
STUDY_PERIODS = frozenset({10, 11})

FIRST_PERIOD_START = PERIODS[0][1]
LAST_PERIOD_END = PERIODS[-1][2]


def hhmm(minute: int) -> str:
    return f"{minute // 60:02d}:{minute % 60:02d}"


def current_period(minute: int) -> int | None:
    """지금이 몇 교시인지. 쉬는시간·점심이면 None. 10·11교시는 자습입니다"""
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


def label(period: int) -> str:
    """화면에 부를 이름. 10·11교시는 자습입니다"""
    return "자습" if period in STUDY_PERIODS else f"{period}교시"


def as_table() -> list[dict]:
    """`GET /periods` 응답용"""
    return [
        {
            "period": p,
            "start": hhmm(s),
            "end": hhmm(e),
            "start_minute": s,
            "end_minute": e,
            "is_study": p in STUDY_PERIODS,
            "label": label(p),
        }
        for p, s, e in PERIODS
    ]


def breaks_table() -> list[dict]:
    return [
        {"name": n, "start": hhmm(s), "end": hhmm(e), "start_minute": s, "end_minute": e}
        for n, s, e in BREAKS
    ]
