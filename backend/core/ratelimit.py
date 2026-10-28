"""요청 수 제한 — 키마다 최근 `window` 초 안의 횟수를 셉니다.

로그인(IP 단위, 브루트포스 방어)과 ksa-bench 사람 조회(계정 단위, 훑기 방지)가 같이 씁니다.
한때 두 라우터가 거의 같은 코드를 따로 들고 있었습니다.

프로세스 메모리에만 있어서 재시작하면 초기화됩니다. 서버는 uvicorn 프로세스 하나라 충분합니다.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from collections.abc import Hashable

from fastapi import HTTPException, status

#: 만료된 키를 이 간격(초)마다 걷어냅니다 — 안 하면 한 번 온 IP·계정이 메모리에 계속 남습니다
CLEANUP_INTERVAL = 300


class SlidingWindow:
    def __init__(self, window: int) -> None:
        self.window = window
        self._hits: dict[Hashable, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_cleanup = time.time()

    def _maybe_cleanup(self, now: float) -> None:
        if now - self._last_cleanup < CLEANUP_INTERVAL:
            return
        with self._lock:
            if now - self._last_cleanup < CLEANUP_INTERVAL:
                return
            cutoff = now - self.window
            for key in [k for k, v in self._hits.items() if not any(t > cutoff for t in v)]:
                del self._hits[key]
            self._last_cleanup = now

    def hit(self, key: Hashable, limit: int, detail: str) -> None:
        """한 번 셉니다. 창 안에서 `limit` 번을 이미 채웠으면 429 를 던집니다(그 시도는 안 셉니다)."""
        now = time.time()
        self._maybe_cleanup(now)
        cutoff = now - self.window
        recent = [t for t in self._hits[key] if t > cutoff]
        self._hits[key] = recent
        if len(recent) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
                headers={"Retry-After": str(self.window)},
            )
        recent.append(now)

    def reset(self, key: Hashable) -> None:
        self._hits.pop(key, None)
