import os
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from sqlalchemy.orm import Session, selectinload, joinedload
import re
from backend import models
from backend.database import engine, SessionLocal
from backend.auth import get_current_user, get_db
from backend.auth_router import router as auth_router
from backend.admin_router import router as admin_router

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

# 컬럼 추가 마이그레이션 (기존 DB 호환)
from sqlalchemy import text
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
            pass  # 이미 존재하는 컬럼이면 무시

app = FastAPI()

# ─── 보안 헤더 미들웨어 ───────────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if os.environ.get("FORCE_HTTPS"):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS: 환경변수 CORS_ORIGINS에 콤마 구분으로 허용 도메인 설정
# 예) CORS_ORIGINS=https://your-app.netlify.app,https://custom-domain.com
_origins = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(admin_router)


def get_section_num(section_str):
    match = re.search(r'(\d+)', section_str)
    return int(match.group(1)) if match else 0

@app.get("/")
async def get_all_data(
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """수업 정보, 전체 통계, 학년별 학생 수를 하나의 JSON으로 반환 (인증 필요)"""
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
            "id": cls.id, "section": cls.section, "teacher": cls.teacher, "room": cls.room,
            "students": sorted(students, key=lambda x: x["stuId"]),
            "student_count": len(students),
            "times": sorted(
                [{"day": t.day, "period": t.period, "room": t.room} for t in cls.times],
                key=lambda x: (["MON", "TUE", "WED", "THU", "FRI"].index(x["day"]), x["period"])
            )
        })

    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        sub_students = set(stu["stuId"] for s in sections for stu in s["students"])
        final_data.append({
            "subject": subject, "subject_student_count": len(sub_students),
            "section_count": len(sections), "sections": sections
        })

    # 2. 학년별 전체 학생 수 통계 (필터용)
    all_students = db.query(models.Student.stuId).all()
    student_counts = {}
    for (s_id,) in all_students:
        yr = s_id.split("-")[0] if "-" in s_id else "Unknown"
        student_counts[yr] = student_counts.get(yr, 0) + 1

    # 3. 과목 별칭 맵 { subject: [alias, ...] }
    all_aliases = db.query(models.SubjectAlias).all()
    alias_map: dict[str, list[str]] = {}
    for a in all_aliases:
        alias_map.setdefault(a.subject, []).append(a.alias)

    # 4. final_data에 aliases 필드 추가
    for item in final_data:
        item["aliases"] = alias_map.get(item["subject"], [])

    return {
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students)
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data
    }
