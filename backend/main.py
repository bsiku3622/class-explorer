from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
import re
from backend import models, database
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

@app.get("/student/{student_id}")
async def get_student_classes(student_id: str, db: Session = Depends(get_db)):
    """
    특정 학생의 수강 정보를 과목별 계층 구조로 반환합니다.
    """
    student = db.query(models.Student).filter(models.Student.stuId == student_id).first()
    if not student:
        return {"stuId": student_id, "name": "Unknown", "total_subjects": 0, "data": []}

    enrollments = student.enrollments
    
    grouped = {}
    for e in enrollments:
        cls = e.class_info
        if cls.subject not in grouped:
            grouped[cls.subject] = []
        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room
        })

    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        final_data.append({
            "subject": subject,
            "section_count": len(sections),
            "sections": sections
        })

    return {
        "stuId": student_id,
        "name": student.name,
        "total_subjects": len(final_data),
        "total_sections": len(enrollments),
        "data": final_data
    }

@app.get("/student/{student_query}")
async def get_student_classes(student_query: str, db: Session = Depends(get_db)):
    """
    학번 혹은 이름으로 특정 학생을 찾아 그 학생의 수강 정보를 반환합니다.
    """
    # 1. 먼저 학번으로 정확히 일치하는지 확인
    student = db.query(models.Student).filter(models.Student.stuId == student_query).first()
    
    # 2. 없다면 이름으로 검색 (가장 먼저 나오는 학생 1명 기준)
    if not student:
        student = db.query(models.Student).filter(models.Student.name == student_query).first()
    
    if not student:
        return {
            "keyword": student_query,
            "prefix": "student",
            "total_subjects": 0,
            "data": []
        }

    enrollments = student.enrollments
    
    grouped = {}
    for e in enrollments:
        cls = e.class_info
        if cls.subject not in grouped:
            grouped[cls.subject] = []
        
        # 전체 수강생 정보 포함 (아코디언용)
        students = [{"stuId": en.student.stuId, "name": en.student.name} for en in cls.enrollments]
        students.sort(key=lambda x: x["stuId"])

        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": students,
            "student_count": len(students)
        })

    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        
        # 해당 학생이 듣는 과목 내 전체 학생 수 (아코디언용)
        subject_students_ids = set()
        for s in sections:
            for stu in s["students"]:
                subject_students_ids.add(stu["stuId"])

        final_data.append({
            "subject": subject,
            "subject_student_count": len(subject_students_ids),
            "section_count": len(sections),
            "sections": sections
        })

    return {
        "keyword": student_query,
        "prefix": "student",
        "stuId": student.stuId,
        "name": student.name,
        "total_subjects": len(final_data),
        "total_sections": len(enrollments),
        "data": final_data
    }

@app.get("/teacher/{name}")
async def get_teacher_classes(name: str, db: Session = Depends(get_db)):
    """
    특정 선생님이 담당하는 모든 과목과 분반을 반환합니다.
    """
    matching_classes = db.query(models.Class).filter(models.Class.teacher == name).all()
    
    grouped = {}
    for cls in matching_classes:
        if cls.subject not in grouped:
            grouped[cls.subject] = []
        
        students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        students.sort(key=lambda x: x["stuId"])
        
        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": students,
            "student_count": len(students)
        })
    
    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        
        subject_students_ids = set()
        for s in sections:
            for stu in s["students"]:
                subject_students_ids.add(stu["stuId"])
            
        final_data.append({
            "subject": subject,
            "subject_student_count": len(subject_students_ids),
            "section_count": len(sections),
            "sections": sections
        })
    
    return {
        "keyword": name,
        "prefix": "teacher",
        "total_subjects": len(final_data),
        "total_sections": len(matching_classes),
        "data": final_data
    }

@app.get("/search/{keyword}")
async def search_classes(keyword: str, db: Session = Depends(get_db)):
    """
    통합 검색 결과를 반환하며, '+', '&' 연산자를 지원합니다.
    논리 구조: (A & B) + (C & D) -> A와 B를 모두 만족하거나, C와 D를 모두 만족하는 클래스 검색
    """
    # 1. 논리 구조 파싱: OR 그룹(+) 내부에 AND 그룹(&) 존재
    or_groups = [g.strip() for g in keyword.split("+") if g.strip()]
    parsed_query = []
    for group in or_groups:
        and_terms = [t.strip() for t in group.split("&") if t.strip()]
        if and_terms:
            parsed_query.append(and_terms)

    if not parsed_query:
        return {"keyword": keyword, "entities": [], "total_subjects": 0, "total_sections": 0, "data": []}

    # 모든 클래스 정보를 가져와서 메모리에서 필터링 (데이터 규모가 작으므로 효율적)
    all_classes = db.query(models.Class).all()
    matching_classes = []

    for cls in all_classes:
        # 해당 클래스의 모든 텍스트 정보 수집 (과목, 분반, 교사, 강의실, 학생들)
        class_students = [e.student for e in cls.enrollments]
        student_texts = []
        for s in class_students:
            student_texts.append(s.stuId.lower())
            student_texts.append(s.name.lower())
        
        class_pool = [
            cls.subject.lower(),
            cls.section.lower(),
            cls.teacher.lower(),
            cls.room.lower()
        ] + student_texts

        # 논리 체크: ANY(OR 그룹) of ALL(AND 그룹)
        match_found = False
        for and_group in parsed_query:
            if all(any(term.lower() in item for item in class_pool) for term in and_group):
                match_found = True
                break
        
        if match_found:
            matching_classes.append(cls)

    # 매칭된 클래스들을 기반으로 entities(프로필 카드) 추출
    entities = []
    seen_entity_ids = set()
    
    # 검색어에 직접적으로 언급된 인물들 우선 추출
    flat_terms = [term.lower() for group in parsed_query for term in group]
    
    # 1. 매칭된 클래스의 선생님들 중 검색어에 포함된 경우
    for cls in matching_classes:
        t_name = cls.teacher
        if f"teacher_{t_name}" not in seen_entity_ids:
            if any(term in t_name.lower() for term in flat_terms):
                t_classes = db.query(models.Class).filter(models.Class.teacher == t_name).all()
                t_subjects = {}
                for c in t_classes:
                    if c.subject not in t_subjects: t_subjects[c.subject] = []
                    section_num = re.sub(r'[^0-9]', '', c.section)
                    t_subjects[c.subject].append(section_num)
                
                entities.append({
                    "type": "teacher",
                    "name": t_name,
                    "id": "Teacher",
                    "subject_count": len(t_subjects),
                    "subjects": [f"{s}({','.join(sorted(secs))})" for s, secs in t_subjects.items()]
                })
                seen_entity_ids.add(f"teacher_{t_name}")

        # 2. 매칭된 클래스의 학생들 중 검색어에 포함된 경우
        for e in cls.enrollments:
            student = e.student
            if student.stuId not in seen_entity_ids:
                if any(term in student.stuId.lower() or term in student.name.lower() for term in flat_terms):
                    student_subjects = sorted(list(set(en.class_info.subject for en in student.enrollments)))
                    entities.append({
                        "type": "student",
                        "name": student.name,
                        "id": student.stuId,
                        "subject_count": len(student_subjects),
                        "subjects": student_subjects
                    })
                    seen_entity_ids.add(student.stuId)

    # 최종 트리 구조 데이터 구성
    grouped = {}
    for cls in matching_classes:
        if cls.subject not in grouped:
            grouped[cls.subject] = []
        
        students = [{"stuId": en.student.stuId, "name": en.student.name} for en in cls.enrollments]
        students.sort(key=lambda x: x["stuId"])
        
        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": students,
            "student_count": len(students)
        })
    
    final_data = []
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        
        subject_students_ids = set()
        for s in sections:
            for stu in s["students"]:
                subject_students_ids.add(stu["stuId"])
            
        final_data.append({
            "subject": subject,
            "subject_student_count": len(subject_students_ids),
            "section_count": len(sections),
            "sections": sections
        })
    
    return {
        "keyword": keyword,
        "entities": entities,
        "total_subjects": len(final_data),
        "total_sections": len(matching_classes),
        "data": final_data
    }

@app.get("/class/{class_id}")
async def get_class_detail(class_id: int, db: Session = Depends(get_db)):
    """
    특정 분반 상세 정보를 반환합니다.
    """
    cls = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="해당 수업을 찾을 수 없습니다.")
    
    students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
    students.sort(key=lambda x: x["stuId"])
    
    return {
        "subject": cls.subject,
        "sections": [
            {
                "id": cls.id,
                "section": cls.section,
                "teacher": cls.teacher,
                "room": cls.room,
                "students": students,
                "student_count": len(students)
            }
        ]
    }

@app.get("/classes_info")
async def get_classes_info(years: str = None, db: Session = Depends(get_db)):
    """
    전체 수업 데이터를 과목별 계층 구조로 반환합니다. 
    years 파라미터가 있으면 해당 학번의 학생들만 포함하고, 해당 학생들이 듣는 수업만 반환합니다.
    """
    selected_years = years.split(",") if years else []
    
    all_classes = db.query(models.Class).all()
    
    grouped = {}
    total_sections_count = 0
    
    for cls in all_classes:
        # 분반의 모든 학생들
        students_info = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        
        # 학번 필터링 적용
        if selected_years:
            filtered_students = [s for s in students_info if s["stuId"].split("-")[0] in selected_years]
            if not filtered_students:
                continue
            students_info = filtered_students
            
        if cls.subject not in grouped:
            grouped[cls.subject] = []
        
        students_info.sort(key=lambda x: x["stuId"])
        
        grouped[cls.subject].append({
            "id": cls.id,
            "section": cls.section,
            "teacher": cls.teacher,
            "room": cls.room,
            "students": students_info,
            "student_count": len(students_info)
        })
        total_sections_count += 1
    
    final_data = []
    total_students_in_filtered = set()
    
    for subject in sorted(grouped.keys()):
        sections = grouped[subject]
        sections.sort(key=lambda s: get_section_num(s["section"]))
        
        subject_students_ids = set()
        for s in sections:
            for stu in s["students"]:
                subject_students_ids.add(stu["stuId"])
                total_students_in_filtered.add(stu["stuId"])
            
        final_data.append({
            "subject": subject,
            "subject_student_count": len(subject_students_ids),
            "section_count": len(sections),
            "sections": sections
        })
    
    return {
        "total_stats": {
            "total_subjects": len(final_data),
            "total_sections": total_sections_count,
            "total_active_students": len(total_students_in_filtered)
        },
        "data": final_data
    }

@app.get("/students_num_info")
async def get_students_num_info(db: Session = Depends(get_db)):
    """
    학번별 학생 수 통계를 반환합니다.
    """
    students = db.query(models.Student.stuId).all()
    
    summary_by_year = {}
    for (stu_id,) in students:
        year_prefix = stu_id.split("-")[0] if "-" in stu_id else "Unknown"
        summary_by_year[year_prefix] = summary_by_year.get(year_prefix, 0) + 1
    
    return dict(sorted(summary_by_year.items()))

@app.get("/students_info")
async def get_students_info(db: Session = Depends(get_db)):
    """
    모든 학생의 수강 목록 정보를 포함한 전체 학생 통계를 반환합니다.
    """
    students = db.query(models.Student).all()
    
    summary_by_year = {}
    student_list = []
    
    for s in students:
        # 학년별 통계 계산
        year_prefix = s.stuId.split("-")[0] if "-" in s.stuId else "Unknown"
        summary_by_year[year_prefix] = summary_by_year.get(year_prefix, 0) + 1
        
        # 학생별 상세 수강 목록 구성
        enrollments = []
        for e in s.enrollments:
            cls = e.class_info
            enrollments.append({
                "id": cls.id,
                "subject": cls.subject,
                "section": cls.section,
                "teacher": cls.teacher,
                "room": cls.room
            })
        
        student_list.append({
            "stuId": s.stuId,
            "name": s.name, # 이름 추가
            "total_subjects": len(enrollments),
            "enrollments": enrollments
        })
    
    # 학번 순 정렬
    student_list.sort(key=lambda x: x["stuId"])
    
    return {
        "total_active_students": len(students),
        "by_year": dict(sorted(summary_by_year.items())),
        "data": student_list
    }
