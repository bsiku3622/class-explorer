"""앱 뼈대 — 스키마 초기화 + CORS + 보안 헤더. 라우터는 `main.py` 가 붙입니다.

서버는 하나(`backend.main:app`)이고 두 프론트(class-explorer · ksa-bench)가 같이 씁니다. 한때 앱을
둘로 나눠 ksa-bench 쪽에 명단 라우터를 등록하지 않았지만, Trade 가 명단 없이는 성립하지 않아
되돌렸습니다. 그래서 **접근 제어는 라우터 등록이 아니라 권한 검사에 있습니다** (`main.py` 머리말).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from backend.core import config
from backend.core.db import init_schema


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)

        # 공통 보안 헤더
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS (환경변수 FORCE_HTTPS 활성화 시)
        if config.FORCE_HTTPS:
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
