"""ksa-bench 진입점.

`uvicorn backend.bench_main:app --port 8001`

class-explorer 와 **같은 코드·같은 DB** 를 쓰지만 라우터를 다르게 붙인 별도 프로세스입니다.
전교생에게 열 앱이라, 명단을 통째로 주는 라우터를 여기서는 아예 등록하지 않습니다.

여기 **없는** 것과, 그게 왜 없는지:

| 안 붙인 것 | 이유 |
| --- | --- |
| `classes_router.router` (`GET /`) | 학기 전체를 분반 명단까지 내려줍니다. 이 앱의 대안은 `bench_router` 에 있습니다 |
| `curriculum_router.explorer_router` | 학번만 알면 남의 누적 이수 이력이 나옵니다. 본인 것은 `GET /me/progress` 로 봅니다 |
| `admin_router` | `/admin/students` 가 전교생 명단을 그대로 돌려줍니다. ksa-bench 용 관리 화면이 필요해지면 **그때 안전한 것만 골라** 새로 만듭니다 |

붙어 있는 것은 전부 본인 것만 다루거나(state·grades·개인 일정) 개인 정보가 없습니다
(학기 목록·교육과정 카탈로그).
"""

from backend.app_factory import create_app
from backend.auth_router import router as auth_router
from backend.curriculum_router import router as curriculum_router
from backend.state_router import router as state_router
from backend.calendar_router import router as calendar_router
from backend.classes_router import terms_router
from backend.bench_router import router as bench_router

app = create_app(
    title="ksa-bench",
    origins=[
        "https://ksabench.bsiku.dev",
    ],
)

app.include_router(auth_router)
app.include_router(curriculum_router)
app.include_router(state_router)
app.include_router(calendar_router)
app.include_router(terms_router)

# 명단 없는 학기 데이터 + 학생 1명 조회. class-explorer 에는 없습니다
app.include_router(bench_router)
