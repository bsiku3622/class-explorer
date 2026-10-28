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

from backend.core.app import create_app
from backend.routers import (
    admin,
    agent,
    auth,
    bench,
    calendar,
    classes,
    curriculum,
    exams,
    facts,
    friends,
    home,
    majors,
    materials,
    state,
)

app = create_app(
    title="class-explorer",
    origins=[
        "https://classes.bsiku.dev",
        "https://ksabench.bsiku.dev",
        "https://ksa-class-finder.netlify.app",
    ],
)

# 순서가 곧 경로 매칭 순서입니다 — 바꿀 때는 겹치는 경로가 없는지 보세요
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(curriculum.router)
app.include_router(curriculum.explorer_router)
app.include_router(state.router)
app.include_router(calendar.router)
app.include_router(friends.router)          # 친구 + 교시 시각표
app.include_router(home.router)             # 홈 대시보드 (한 요청으로 다)
app.include_router(exams.router)
app.include_router(classes.terms_router)
app.include_router(classes.router)          # GET / — 학기 전체 + 분반 명단
app.include_router(bench.router)            # 사람 1명 조회 · 수강 분포 · 본인 이수
app.include_router(materials.router)        # 인증된 과목 자료실 + 업로드
app.include_router(materials.admin_router)  # 자료 검수
app.include_router(agent.router)            # Ask — 도구를 부르는 LLM Agent
app.include_router(facts.router)            # Ask 의 기억 — 매니저가 고치고 숨깁니다
app.include_router(majors.router)           # 내 전공(심화필수 전공 트랙)
