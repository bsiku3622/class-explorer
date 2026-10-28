"""ksain API.

| 용도 | 주소 | 인증 |
| --- | --- | --- |
| 글 하나 | `GET api.ksain.kr/document/get/{id}` | 필요 없음 |
| 첨부 | `GET api.ksain.kr/document/{attachments[].path}` | 필요 없음 |
| 게시판별 최신 30건 | `POST api.ksain.net/v1/document.php` (`key`, `boardID`, `count`) | `KSAIN_API_KEY` |

⚠️ **목록 API 는 최신 30건만 주고 100000번대(ksain.kr 에서 쓴) 글을 빼먹습니다.** 그래서
수집은 번호를 앞으로 훑는 쪽이 중심이고, 목록 API 는 새 구 공간 번호를 빨리 알아채는
용도로만 씁니다.

⚠️ 글·첨부를 비로그인으로 주는 것은 ksain 의 **지금 동작**입니다. 막히면 `KSAIN_TOKEN`
(ksain.kr 로그인 토큰)을 넣어 같은 요청에 Bearer 로 붙입니다.
"""
from __future__ import annotations

import time
from urllib.parse import quote

import httpx

from backend.core import config

API = "https://api.ksain.kr"
LIST_API = "https://api.ksain.net/v1/document.php"
USER_AGENT = "class-explorer-ksain-sync/1 (+https://classes.bsiku.dev)"
MAX_DOWNLOAD = 25 * 1024 * 1024


class KsainError(RuntimeError):
    pass


class KsainClient:
    def __init__(self, interval: float = 0.4) -> None:
        headers = {"User-Agent": USER_AGENT}
        token = config.KSAIN_TOKEN
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self.http = httpx.Client(timeout=30, headers=headers, follow_redirects=True)
        self.interval = interval
        self._last = 0.0
        self.api_key = config.KSAIN_API_KEY

    def _wait(self) -> None:
        # 학교 서비스라 한 번에 몰아치지 않습니다
        delay = self._last + self.interval - time.monotonic()
        if delay > 0:
            time.sleep(delay)
        self._last = time.monotonic()

    def _get(self, url: str, **kwargs) -> httpx.Response:
        for attempt in range(3):
            self._wait()
            try:
                res = self.http.get(url, **kwargs)
            except httpx.TransportError as error:
                if attempt == 2:
                    raise KsainError(f"network: {error}") from error
                time.sleep(2 * (attempt + 1))
                continue
            if res.status_code >= 500 and attempt < 2:
                time.sleep(2 * (attempt + 1))
                continue
            return res
        raise KsainError("unreachable")

    def document(self, doc_id: int) -> dict | None:
        """글 하나. 없는 번호면 None."""
        res = self._get(f"{API}/document/get/{doc_id}")
        if res.status_code == 404:
            return None
        if res.status_code != 200:
            raise KsainError(f"document {doc_id}: HTTP {res.status_code}")
        body = res.json()
        if not body.get("success"):
            if "not found" in str(body.get("error", "")).lower():
                return None
            raise KsainError(f"document {doc_id}: {body.get('error')}")
        return body["document"]

    def latest(self, board_id: int) -> list[dict]:
        """게시판의 최신 글 목록(최대 30). 키가 없으면 빈 목록."""
        if not self.api_key:
            return []
        self._wait()
        res = self.http.post(LIST_API, data={"key": self.api_key, "boardID": board_id, "count": 30})
        if res.status_code != 200:
            raise KsainError(f"list {board_id}: HTTP {res.status_code}")
        return res.json().get("data") or []

    def download(self, path: str) -> bytes:
        url = f"{API}/document/{quote(path)}"
        self._wait()
        with self.http.stream("GET", url) as res:
            if res.status_code != 200:
                raise KsainError(f"attachment HTTP {res.status_code}")
            chunks, size = [], 0
            for chunk in res.iter_bytes():
                size += len(chunk)
                if size > MAX_DOWNLOAD:
                    raise KsainError("attachment too large")
                chunks.append(chunk)
        return b"".join(chunks)
