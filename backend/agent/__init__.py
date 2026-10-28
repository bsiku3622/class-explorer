"""Ask (질문창) — 도구를 부르는 LLM Agent. HTTP 는 `routers/agent.py` 가 받습니다.

| 모듈 | 하는 일 |
| --- | --- |
| `llm.py` | LLM 호출 한 곳 — 모델 목록(데스크탑 게이트웨이·OpenAI) + Chat Completions |
| `chat.py` | 질문 하나 → 답 — 시스템 프롬프트, 기억 싣기, 도구 호출 루프, SSE |
| `tools.py` | 모델이 부를 수 있는 읽기 전용 도구 |

기억(facts)과 검색 색인은 `knowledge/` 에 있습니다.
"""
