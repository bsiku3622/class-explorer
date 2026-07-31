"""API 진입점. **서버는 하나이고 두 프론트가 같이 씁니다.**

`uvicorn backend.main:app`

| 프론트 | 도메인 |
| --- | --- |
| class-explorer (`frontend/`) | `classes.bsiku.dev` |
| ksa-bench (`bench-frontend/`) | `ksabench.bsiku.dev` |

한때 앱을 둘로 나눠(`bench_main.py`) ksa-bench 쪽에 명단 라우터를 등록하지 않았습니다.
Trade(수강 변경 탐색)가 "이 분반 수강생 중 내 분반을 받을 수 있는 사람"을 찾는 기능이라
명단 없이는 성립하지 않아 되돌렸고, 그러자 두 앱의 API 표면이 거의 같아져서 프로세스를
둘로 둘 이유가 사라졌습니다. 배포도 유닛 하나로 끝납니다.

**그래서 지금 접근 제어는 라우터 등록이 아니라 권한 검사에 있습니다.** `/admin/*` 은
`role=admin` 이고, 개인 데이터(state·grades·개인 일정·친구)는 전부 본인 것만 다룹니다.
새 엔드포인트가 남의 데이터를 돌려줄 수 있으면 **의존성으로 막으세요** — 이제 "그 앱에는
안 붙였으니까" 가 방패가 되지 않습니다.
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
from backend.home_router import router as home_router
from backend.classes_router import router as classes_router, terms_router
from backend.bench_router import router as bench_router

app = create_app(
    title="class-explorer",
    origins=[
        "https://classes.bsiku.dev",
        "https://ksabench.bsiku.dev",
        "https://ksa-class-finder.netlify.app",
    ],
)

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(curriculum_router)
app.include_router(curriculum_explorer_router)
app.include_router(state_router)
app.include_router(calendar_router)
app.include_router(friends_router)      # 친구 + 교시 시각표
app.include_router(home_router)         # 홈 대시보드 (한 요청으로 다)
app.include_router(terms_router)
app.include_router(classes_router)      # GET / — 학기 전체 + 분반 명단
app.include_router(bench_router)        # 사람 1명 조회 · 수강 분포 · 본인 이수
