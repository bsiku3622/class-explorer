from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
import re
from backend import models
from backend.database import engine, SessionLocal

# DB 테이블 생성
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_section_num(section_str):
    match = re.search(r'(\d+)', section_str)
    return int(match.group(1)) if match else 0

@app.get("/")
async def get_all_data(db: Session = Depends(get_db)):
    """수업 정보, 전체 통계, 학년별 학생 수를 하나의 JSON으로 반환"""
    # 1. 수업 및 수강 정보 조회
    all_classes = db.query(models.Class).all()
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

    return {
        "stats": {
            "total_subjects": len(final_data),
            "total_sections": len(all_classes),
            "total_active_students": len(total_active_students)
        },
        "student_counts": dict(sorted(student_counts.items())),
        "data": final_data
    }
