"""두 앱이 공유하는 뼈대.

이 저장소는 FastAPI 앱을 **둘** 띄웁니다.

| 진입점 | 앱 | 성격 |
| --- | --- | --- |
| `backend.main:app` | class-explorer | 초대제. 분반 명단까지 전부 |
| `backend.bench_main:app` | ksa-bench | 전교생 공개. 명단을 주는 라우터가 **등록되지 않음** |

권한 검사로 가르지 않고 프로세스를 가른 이유는 하나입니다. 한 앱에 명단을 통째로 주는
엔드포인트와 공개 서비스가 같이 살면, 새 기능을 붙이다 의존성 하나를 빠뜨리는 것이 곧
사고가 됩니다. 라우터가 아예 등록되지 않으면 그 실수가 성립하지 않습니다.

DB·모델·파서는 한 벌을 같이 씁니다. 두 벌이 되면 KEIS 응답이 바뀔 때마다 같은 수정을
두 번 하게 되고, 곧 서로 달라집니다.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from backend.database import init_schema


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)

        # 공통 보안 헤더
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS (환경변수 FORCE_HTTPS 활성화 시)
        if os.environ.get("FORCE_HTTPS"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Swagger / Redoc 전용 CSP 완화
        if request.url.path.startswith("/docs") or request.url.path.startswith("/redoc"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com;"
            )
        else:
            # 나머지 엔드포인트 강력 CSP
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        return response


# 두 앱 모두 로컬 개발 서버를 허용합니다. 배포 도메인만 앱마다 다릅니다.
LOCAL_ORIGINS = [
    "http://localhost",
    "https://localhost",
    "http://localhost:*",
    "https://localhost:*",
]


# # ───────────── CORS 설정 ─────────────
# _origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=[o.strip() for o in _origins.split(",")],
#     allow_credentials=True,
#     allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
#     allow_headers=["Authorization", "Content-Type"],
# )


def create_app(*, title: str, origins: list[str]) -> FastAPI:
    """미들웨어까지 얹은 빈 앱을 돌려줍니다. 라우터는 호출한 쪽이 붙입니다."""
    init_schema()

    app = FastAPI(title=title)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=LOCAL_ORIGINS + origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    return app
