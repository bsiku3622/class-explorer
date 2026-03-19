import os
import re
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import text

from backend import models
from backend.database import engine, SessionLocal
from backend.auth import get_current_user, get_db
from backend.auth_router import router as auth_router
from backend.admin_router import router as admin_router

# ───────────── DB 초기화 ─────────────
models.Base.metadata.create_all(bind=engine)

# 컬럼 추가 마이그레이션
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE sessions ADD COLUMN ip_address VARCHAR",
        "CREATE TABLE IF NOT EXISTS subject_aliases (id INTEGER PRIMARY KEY, subject VARCHAR NOT NULL, alias VARCHAR NOT NULL, UNIQUE (subject, alias))",
    ]:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            pass  # 이미 존재하면 무시

# ───────────── FastAPI 앱 생성 ─────────────
app = FastAPI()

origins = [    "http://localhost",
    "https://localhost",
    "http://localhost:5173",
    "https://localhost:5173",
    "https://classes.bsiku.dev",
    "https://ksa-class-finder.netlify.app",
]
# CORS 미들웨어를 앱에 추가합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # 교차 출처 요청을 허용할 오리진 목록
    allow_credentials=True,    # 교차 출처 요청에 쿠키를 포함하도록 허용
    allow_methods=["*"],         # 모든 HTTP 메소드(GET, POST 등) 허용
    allow_headers=["*"],         # 모든 HTTP 헤더 허용
)

# ───────────── 보안 헤더 미들웨어 ─────────────
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

app.add_middleware(SecurityHeadersMiddleware)

# ───────────── CORS 설정 ─────────────
_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ───────────── 라우터 등록 ─────────────
app.include_router(auth_router)
app.include_router(admin_router)

# ───────────── 유틸 ─────────────
def get_section_num(section_str):
    match = re.search(r'(\d+)', section_str)
    return int(match.group(1)) if match else 0

# ───────────── 메인 엔드포인트 ─────────────
@app.get("/")
async def get_all_data(
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """전체 수업/학생/별칭 데이터 반환 (인증 필요)"""
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"

    # 1. 수업 및 수강 정보 조회
    all_classes = db.query(models.Class).options(
        selectinload(models.Class.enrollments).joinedload(models.Enrollment.student),
        selectinload(models.Class.times),
    ).all()

    grouped = {}
    total_active_students = set()

    for cls in all_classes:
        students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        if cls.subject not in grouped:
            grouped[cls.subject] = []

        for s in students:
            total_active_students.add(s["stuId"])

        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": sorted(students, key=lambda x: x["stuId"]),
            "student_count": len(students),
            "times": sorted(
                [{"day": t.day, "period": t.period, "room": t.room} for t in cls.times],
                key=lambda x: (["MON", "TUE", "WED", "THU", "FRI"].index(x["day"]), x["period"])
            )
        })

    # 2. 학년별 전체 학생 수 통계
    all_students = db.query(models.Student.stuId).all()
    student_counts = {}
    for (s_id,) in all_students:
        yr = s_id.split("-")[0] if "-" in s_id else "Unknown"
        student_counts[yr] = student_counts.get(yr, 0) + 1

    # 3. 과목 별칭 맵
    all_aliases = db.query(models.SubjectAlias).all()
    alias_map: dict[str, list[str]] = {}
    for a in all_aliases:
        alias_map.setdefault(a.subject, []).append(a.alias)

    # 4. final_data 구성
    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        sub_students = set(stu["stuId"] for s in sections for stu in s["students"])
        final_data.append({
            "subject": subject,
            "subject_student_count": len(sub_students),
            "section_count": len(sections),
            "sections": sections,
            "aliases": alias_map.get(subject, [])
        })

    return {
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students)
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data
    }