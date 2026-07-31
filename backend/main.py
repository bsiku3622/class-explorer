"""class-explorer 진입점.

`uvicorn backend.main:app`

**분반 명단까지 전부 내려주는 앱입니다.** 초대제로 운영하는 비공식 검색기라 그렇습니다.
전교생에게 여는 쪽은 `backend/bench_main.py` 이고, 거기에는 `classes_router.router` 와
`curriculum_router.explorer_router` 를 **등록하지 않습니다** — 왜 권한이 아니라 등록으로
가르는지는 `app_factory.py` 상단에 적어 뒀습니다.
"""

from backend.app_factory import create_app
from backend.auth_router import router as auth_router
from backend.admin_router import router as admin_router
from backend.curriculum_router import (
    router as curriculum_router,
    explorer_router as curriculum_explorer_router,
)
from backend.state_router import router as state_router
from backend.calendar_router import router as calendar_router
from backend.friends_router import router as friends_router
from backend.classes_router import router as classes_router, terms_router

app = create_app(
    title="class-explorer",
    origins=[
        "https://classes.bsiku.dev",
        "https://ksa-class-finder.netlify.app",
    ],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(curriculum_router)
app.include_router(state_router)
app.include_router(calendar_router)
app.include_router(friends_router)   # 친구 + 교시 시각표 — 두 앱 공통

# ── 여기부터는 class-explorer 에만 있습니다 ──────────────────────────────────
app.include_router(terms_router)
app.include_router(curriculum_explorer_router)  # 아무 학생의 누적 이수 현황
app.include_router(classes_router)              # GET / — 학기 전체 + 분반 명단
