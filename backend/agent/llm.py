"""LLM 호출 — 모델 목록과 OpenAI 호환 Chat Completions 를 여기 한 곳에서만 다룹니다.

| 모델 ID | 어디로 | 언제 보이나 |
| --- | --- | --- |
| `local:<이름>` (예: `local:gemma4:12b`) | 데스크탑 게이트웨이 `LLM_GATEWAY_URL` (WireGuard 10.8.10.1) | 게이트웨이에 설치된 모델 |
| `openai:<이름>` | `OPENAI_BASE_URL` | `OPENAI_API_KEY` 가 있을 때, `OPENAI_MODELS` 에 적은 것 |

데스크탑 Ollama 는 상시로 떠 있지 않습니다. 게이트웨이(`deploy/llm-gateway/gateway.py`)가
요청이 오면 켜고 1시간 조용하면 끕니다. 꺼진 상태의 **첫 호출은 1분 넘게 걸려서**(모델 적재),
둘이 미리 깨웁니다 — 로그인한 사람이 사이트를 쓰면 `nudge()`(5분에 한 번), 질문창을 누르면
`warmup()`. 깨우는 요청도 게이트웨이의 1시간을 다시 채웁니다.

Gemma 4 는 기본으로 생각(thinking) 토큰을 먼저 쓰고 답합니다. 짧은 `max_tokens` 를 주면
본문이 빈 채로 끝나서, 로컬 모델에는 `reasoning_effort: "none"` 을 붙입니다.
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import httpx

from backend.core import config

GATEWAY_URL = config.LLM_GATEWAY_URL
LOCAL_DEFAULT = config.LLM_LOCAL_MODEL
OPENAI_BASE_URL = config.OPENAI_BASE_URL
OPENAI_API_KEY = config.OPENAI_API_KEY
OPENAI_MODELS = config.OPENAI_MODELS
OPENAI_REASONING_EFFORT = config.OPENAI_REASONING_EFFORT
# 용도별 기본 모델. 비어 있으면 로컬 기본 모델입니다
DEFAULTS = {
    "agent": config.AGENT_MODEL,
    "analyze": config.ANALYZE_MODEL,
}


class LLMError(RuntimeError):
    """모델을 부를 수 없거나 응답이 깨졌을 때."""


@dataclass(frozen=True)
class Model:
    id: str
    provider: str  # local | openai
    name: str

    @property
    def label(self) -> str:
        return f"{self.name} (데스크탑)" if self.provider == "local" else f"{self.name} (OpenAI)"

    @property
    def url(self) -> str:
        base = f"{GATEWAY_URL}/v1" if self.provider == "local" else OPENAI_BASE_URL
        return f"{base}/chat/completions"

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {OPENAI_API_KEY}"} if self.provider == "openai" else {}


_local_cache: tuple[float, list[str]] = (0.0, [])


def local_models() -> list[str]:
    """게이트웨이에 설치된 모델. Ollama 를 깨우지 않는 경로라 자주 불러도 됩니다."""
    global _local_cache
    stamp, names = _local_cache
    if names and time.monotonic() - stamp < 300:
        return names
    try:
        res = httpx.get(f"{GATEWAY_URL}/gateway/models", timeout=3)
        names = [m["name"] for m in res.json().get("models", []) if "embed" not in m["name"]]
    except (httpx.HTTPError, ValueError, KeyError):
        names = []
    names = names or [LOCAL_DEFAULT]
    _local_cache = (time.monotonic(), names)
    return names


def available() -> list[Model]:
    models = [Model(f"local:{name}", "local", name) for name in local_models()]
    if OPENAI_API_KEY:
        models += [Model(f"openai:{name}", "openai", name) for name in OPENAI_MODELS]
    return models


def resolve(model_id: str | None, purpose: str = "agent") -> Model:
    """쓸 모델 — **OpenAI 는 이용자가 질문창에서 직접 고른 경우에만** 고릅니다.

    개인정보처리방침 6절이 그렇게 약속합니다. 그래서 기본값(`AGENT_MODEL`)이 OpenAI 를 가리켜도 로컬로 가고,
    게시글 분석은 아예 로컬만 받습니다 — 글과 첨부에는 학생 명단·연락처가 그대로 있고, 방침은 분석을 운영자가
    직접 운영하는 컴퓨터에서 한다고 적었습니다.
    """
    models = {m.id: m for m in available()}
    if purpose != "agent" or not model_id:
        local = {key: model for key, model in models.items() if model.provider == "local"}
        if model_id and model_id not in local:
            raise LLMError(f"{model_id}: 게시글 분석은 로컬 모델로만 합니다 (개인정보처리방침 6절)")
        models = local
    if not models:
        raise LLMError("쓸 수 있는 모델이 없습니다")
    for candidate in (model_id, DEFAULTS.get(purpose), f"local:{LOCAL_DEFAULT}"):
        if candidate and candidate in models:
            return models[candidate]
    return next(iter(models.values()))


def _body(model: Model, messages: list[dict], tools: list[dict] | None, schema: dict | None,
          max_tokens: int | None) -> dict:
    body: dict = {"model": model.name, "messages": messages}
    if tools:
        body["tools"] = tools
    if schema:
        body["response_format"] = {"type": "json_schema", "json_schema": {"name": "result", "schema": schema}}
    if model.provider == "local":
        body["reasoning_effort"] = "none"
        body["temperature"] = 0.2
        if max_tokens:
            body["max_tokens"] = max_tokens
    else:
        if OPENAI_REASONING_EFFORT:
            body["reasoning_effort"] = OPENAI_REASONING_EFFORT
        if max_tokens:
            body["max_completion_tokens"] = max_tokens
    return body


def _message(res: httpx.Response) -> dict:
    if res.status_code != 200:
        raise LLMError(f"HTTP {res.status_code}: {res.text[:300]}")
    try:
        data = res.json()
        choice = data["choices"][0]
        message = choice["message"]
    except (ValueError, KeyError, IndexError) as error:
        raise LLMError(f"응답 형식이 다릅니다: {res.text[:300]}") from error
    message["usage"] = data.get("usage")
    # "length" 면 max_tokens 에서 잘린 것 — 부르는 쪽이 잘렸다고 알릴 수 있게 넘깁니다
    message["finish_reason"] = choice.get("finish_reason")
    return message


async def chat(model: Model, messages: list[dict], *, tools: list[dict] | None = None,
               schema: dict | None = None, max_tokens: int | None = None, timeout: float = 240) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            res = await client.post(model.url, json=_body(model, messages, tools, schema, max_tokens),
                                    headers=model.headers)
    except httpx.HTTPError as error:
        raise LLMError(f"{model.label} 에 닿지 않습니다: {error}") from error
    return _message(res)


def chat_sync(model: Model, messages: list[dict], *, schema: dict | None = None,
              max_tokens: int | None = None, timeout: float = 300) -> dict:
    try:
        res = httpx.post(model.url, json=_body(model, messages, None, schema, max_tokens),
                         headers=model.headers, timeout=timeout)
    except httpx.HTTPError as error:
        raise LLMError(f"{model.label} 에 닿지 않습니다: {error}") from error
    return _message(res)


async def gateway_status() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            return (await client.get(f"{GATEWAY_URL}/gateway/status")).json()
    except (httpx.HTTPError, ValueError):
        return None


async def warmup(model: Model) -> None:
    """로컬 모델을 미리 VRAM 에 올립니다. 프롬프트 없는 generate 가 Ollama 의 적재 요청입니다.

    언제 내릴지(keep_alive)는 싣지 않습니다 — 게이트웨이가 정합니다(상시 모드에선 내리지 않음).
    """
    if model.provider != "local":
        return
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            await client.post(f"{GATEWAY_URL}/api/generate", json={"model": model.name})
    except httpx.HTTPError:
        pass


NUDGE_EVERY = 300
_nudged_at = float("-inf")
# 이벤트 루프는 태스크를 약하게만 붙잡아서, 참조를 안 남기면 도는 중에 사라질 수 있습니다
_nudges: set[asyncio.Task] = set()


def nudge() -> None:
    """로그인한 사람이 사이트를 쓰는 중 — 데스크탑 모델을 깨워 둡니다(5분에 한 번, 기다리지 않음).

    질문창을 열 때만 깨우면 첫 답이 적재(1분 넘게)를 통째로 기다렸습니다. 사이트에 들어온 순간 깨우면
    질문할 즈음엔 올라와 있고, 깨우는 요청이 게이트웨이의 유휴 1시간을 다시 채워 쓰는 동안 꺼지지 않습니다.
    ⚠️ `resolve()` 를 거치지 않습니다 — 게이트웨이 목록을 동기로 물어서 미들웨어에서 부르면 이벤트 루프가 멈춥니다.
    """
    global _nudged_at
    now = time.monotonic()
    if now - _nudged_at < NUDGE_EVERY:
        return
    _nudged_at = now
    task = asyncio.get_running_loop().create_task(warmup(Model(f"local:{LOCAL_DEFAULT}", "local", LOCAL_DEFAULT)))
    _nudges.add(task)
    task.add_done_callback(_nudges.discard)
