"""뼈대 — 설정·DB·시각·인증처럼 기능과 상관없이 모두가 기대는 것.

| 모듈 | 하는 일 |
| --- | --- |
| `config.py` | 경로와 환경변수 (전부 여기서만 읽습니다) |
| `db.py` | 본 DB · ksain.db 연결, `get_db`, `init_schema` |
| `migrations.py` | 멱등 스키마 마이그레이션 |
| `clock.py` | 학교 시각(KST)과 저장용 UTC |
| `auth.py` | 비밀번호·세션 토큰·현재 사용자 의존성 |
| `ratelimit.py` | 요청 수 제한 (로그인 · ksa-bench 사람 조회) |
| `app.py` | FastAPI 앱 뼈대 (CORS + 보안 헤더) |
| `workbook.py` | 표준 라이브러리만 쓰는 xlsx 리더 |
"""
