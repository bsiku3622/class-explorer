"""경로와 환경변수 — 백엔드가 읽는 설정은 전부 여기 있습니다.

배포에서는 systemd `Environment=` 와 `/etc/class-explorer/ai.env` 가 채웁니다
(deploy-guide.md). 값이 없을 때 어떻게 도는지는 변수마다 적어 뒀습니다.

⚠️ 모듈을 불러오는 순간 한 번 읽습니다. 값을 바꾸면 프로세스를 다시 띄워야 합니다.
"""
import os
from pathlib import Path

#: `backend/` — seed 파일과 DB 의 기본 자리
BACKEND_DIR = Path(__file__).resolve().parent.parent

# ─── DB ──────────────────────────────────────────────────────────────────────
#
# **파일이 둘입니다.** 나눈 기준은 "사람의 것인가, 다시 만들 수 있는가" 입니다.
#
# | 파일 | 담는 것 | 백업 |
# | --- | --- | --- |
# | 본 DB | 계정·시간표·학사일정·기억(facts) — 사람이 보고 고치는 것 | 스냅샷 (`services/backup.py`) |
# | ksain.db | ksain 글·첨부·분석·검색 색인 — 언제든 다시 받고 다시 만들 수 있는 것 | 안 함 |
#
# 합치지 않는 이유는 두 가지입니다. 본 DB 스냅샷은 자동으로 지우지 않아서, 합치면 ksain 에서
# 지워진 글(시험 명단이 든 첨부 등)이 스냅샷 속에 계속 남습니다 — 개인정보처리방침 4항이
# 지운다고 약속한 것입니다. 그리고 서버에서 API 는 `ksaclass`, 수집 타이머는 `baeks` 로 돌아서
# 한 파일을 WAL 로 같이 쓰려면 데이터 폴더 권한부터 다시 짜야 합니다.

#: 본 DB. 서버에서는 `backend/ksa_timetable.db` 가 `../data/ksa_timetable.db` 를 가리키는 symlink 이고,
#: SQLite 가 그걸 따라갑니다 (백업·자료 폴더도 진짜 위치 옆에 생깁니다)
DATABASE_URL = os.environ.get("DATABASE_URL") or f"sqlite:///{BACKEND_DIR / 'ksa_timetable.db'}"
#: ksain 수집 사본
KSAIN_DB_URL = os.environ.get("KSAIN_DB_URL") or f"sqlite:///{BACKEND_DIR / 'ksain.db'}"

# ─── 학교 데이터 원본 ─────────────────────────────────────────────────────────
#: 수집할 학번 목록 (git 에 없습니다 — 서버에만)
STUDENTS_TXT = BACKEND_DIR / "students.txt"
CALENDAR_SEED = BACKEND_DIR / "calendar_seed.json"
CURRICULUM_SEED = BACKEND_DIR / "curriculum_seed.json"
EXAM_SEED = BACKEND_DIR / "exam_seed.json"

# ─── 외부 서비스 ──────────────────────────────────────────────────────────────
#: 학번 확인(`/auth/link-google`). 없으면 그 요청만 503
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
#: 급식(ksain.net) + ksain 최신 글 목록. 없으면 홈의 급식 칸만 비고, 수집은 번호 훑기로만 돕니다
KSAIN_API_KEY = os.environ.get("KSAIN_API_KEY", "")
#: ksain.kr 로그인 토큰. 비로그인 본문 조회가 막혔을 때만 넣습니다
KSAIN_TOKEN = os.environ.get("KSAIN_TOKEN", "")
#: KEIS 시간표 수집(`cli/parser_run.py`)이 기본으로 받을 학기. 비우면 오늘 날짜로 정합니다
SYNC_YEAR = os.environ.get("SYNC_YEAR", "")
SYNC_SEMESTER = os.environ.get("SYNC_SEMESTER", "")
#: 과목 자료 원본을 둘 곳. 비우면 본 DB 의 진짜 위치 옆 `materials/`
MATERIAL_STORAGE_DIR = os.environ.get("MATERIAL_STORAGE_DIR", "")
#: 켜면 HSTS 헤더를 붙입니다
FORCE_HTTPS = bool(os.environ.get("FORCE_HTTPS"))

# ─── LLM (agent/llm.py) ──────────────────────────────────────────────────────
#: 데스크탑 Ollama 게이트웨이 (WireGuard)
LLM_GATEWAY_URL = os.environ.get("LLM_GATEWAY_URL", "http://10.8.10.1:11434").rstrip("/")
#: 게이트웨이 목록을 못 받았을 때의 로컬 모델
LLM_LOCAL_MODEL = os.environ.get("LLM_LOCAL_MODEL", "gemma4:12b")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
#: 넣으면 질문창 모델 목록에 `OPENAI_MODELS` 가 붙습니다
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
OPENAI_MODELS = [m.strip() for m in os.environ.get("OPENAI_MODELS", "").split(",") if m.strip()]
OPENAI_REASONING_EFFORT = os.environ.get("OPENAI_REASONING_EFFORT", "")
#: 용도별 기본 모델 ID (`local:gemma4:12b`, `openai:…`). 비우면 로컬 기본 모델
AGENT_MODEL = os.environ.get("AGENT_MODEL", "")
ANALYZE_MODEL = os.environ.get("ANALYZE_MODEL", "")
