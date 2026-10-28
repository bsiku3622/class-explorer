"""시각 — 학교 시각(KST)과 저장용 UTC 를 여기서만 만듭니다.

| 함수 | 쓰는 곳 |
| --- | --- |
| `now()` · `today()` | 교시·오늘 시간표·"이번 주" — 화면과 판정에 쓰는 **학교 시각** |
| `utcnow()` | 세션 만료·`created_at` 처럼 **저장하고 비교만 하는 값** |

⚠️ **`datetime.now()` 를 그대로 쓰지 마세요.** 배포 서버가 UTC 로 돌아서 교시가 9시간
어긋나고 날짜가 하루 밀립니다. 시스템 타임존을 고치지 않고 코드에서 KST 를 박은 이유는,
서버를 옮겨도 학교 시각은 KST 여야 하고 같은 서버의 다른 서비스까지 건드릴 이유가 없어서입니다.

⚠️ **둘을 섞지 마세요.** DB 의 `DateTime` 칸은 시간대 없이(naive) 저장됩니다. 세션 만료처럼
UTC 로 넣은 값은 `utcnow()` 와, ksain 글의 작성 시각처럼 KST 로 넣은 값은 `now()` 와
비교합니다. (ksain 글 시각이 KST 인 건 학사일정과 같은 날짜로 읽으려는 것입니다.)
"""
import datetime
from zoneinfo import ZoneInfo

#: 학교 시각. 서버 타임존에 기대지 않습니다
KST = ZoneInfo("Asia/Seoul")


def now() -> datetime.datetime:
    """지금(KST, 시간대 정보 있음). 시각을 보는 곳은 전부 여기를 거칩니다."""
    return datetime.datetime.now(KST)


def today() -> datetime.date:
    """오늘(KST). UTC 서버에서 `date.today()` 는 하루 밀립니다."""
    return now().date()


def now_naive() -> datetime.datetime:
    """지금(KST)을 시간대 없이 — KST 로 저장된 `DateTime` 칸(ksain 글 시각)과 비교할 때."""
    return now().replace(tzinfo=None)


def utcnow() -> datetime.datetime:
    """지금(UTC)을 시간대 없이 — `datetime.utcnow()` 를 대신합니다.

    3.12 부터 `utcnow()` 가 폐기 경고를 내서 수집 타이머 로그를 덮었습니다. 저장된 값이 전부
    naive UTC 라 같은 모양으로 돌려줍니다.
    """
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)
