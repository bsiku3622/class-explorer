"""ksain 게시글 수집·분석. 저장소는 본 DB 와 분리된 `backend/ksain.db` 입니다.

| 모듈 | 하는 일 |
| --- | --- |
| `db.py` | ksain.db 연결과 스키마 |
| `models.py` | 게시판 · 글 · 첨부 · 빈 번호 · 분석 결과 |
| `client.py` | ksain API (본문·첨부는 api.ksain.kr, 최신 목록은 개발자 API) |
| `extract.py` | 첨부 텍스트 (xlsx · docx · pptx · hwpx · hwp · pdf) |
| `sync.py` | 수집 CLI — 전체 백필과 10분 주기 증분 |
| `analyze.py` | LLM 분석 CLI — 요약·중요도·일정 항목 |
| `apply.py` | 분석된 일정을 공용 학사일정(`source='ksain'`)에 반영 |
| `search.py` | Agent 가 쓰는 검색 |
"""
