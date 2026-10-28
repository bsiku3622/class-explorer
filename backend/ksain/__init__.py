"""ksain 게시글 수집·분석. 글·첨부·분석은 본 DB 와 분리된 `backend/ksain.db` 에 있습니다.

| 모듈 | 하는 일 |
| --- | --- |
| `models.py` | 게시판 · 글 · 첨부 · 빈 번호 · 분석 결과 · 검색 색인 조각 |
| `client.py` | ksain API (본문·첨부는 api.ksain.kr, 최신 목록은 개발자 API) |
| `extract.py` | 첨부 텍스트 (xlsx · docx · pptx · hwpx · hwp · pdf) |
| `sync.py` | 수집 CLI — 전체 백필과 10분 주기 증분, 끝나면 검색 색인 갱신 |
| `analyze.py` | LLM 분석 CLI — 요약·중요도·일정 항목·사실 |
| `apply.py` | 분석된 일정을 공용 학사일정(`source='ksain'`)에 반영 |

연결은 `core/db.py`(`KsainSession`), 검색·기억은 `knowledge/` 입니다.
"""
