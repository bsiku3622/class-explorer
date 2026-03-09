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

def evaluate_bool_expression(expression, pool):
    """
    Evaluates boolean logic (+, &&, &, ()) against a pool of lowercase strings.
    Operator priority: && > & > +
    Note: Both && and & are treated as 'and' here, but the calling logic 
    differentiates their behavior by how it calls this function.
    """
    normalized_pool = [str(p).lower() for p in pool]
    
    # 1. 전처리: 괄호와 연산자 주변 공백 확보 및 표준화
    expr = expression.replace('(', ' ( ').replace(')', ' ) ')
    expr = expr.replace('&&', ' and ').replace('&', ' and ').replace('+', ' or ')
    
    # 2. 토큰화 및 평가
    tokens = re.findall(r'\(|\)|\band\b|\bor\b|[^\s\(\)+&]+', expr)
    
    processed_tokens = []
    for token in tokens:
        token = token.strip()
        if not token: continue
        if token in ('(', ')', 'and', 'or'):
            processed_tokens.append(token)
        else:
            term = token.lower()
            match_found = any(term in item for item in normalized_pool)
            processed_tokens.append('True' if match_found else 'False')
    
    py_expr = ' '.join(processed_tokens)
    try:
        return eval(py_expr, {"__builtins__": None}, {})
    except Exception:
        return False

@app.get("/student/{student_query}")
async def get_student_classes(student_query: str, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.stuId == student_query).first()
    if not student:
        return {"keyword": student_query, "prefix": "student", "total_subjects": 0, "total_sections": 0, "data": []}

    enrollments = student.enrollments
    grouped = {}
    for e in enrollments:
        cls = e.class_info
        if cls.subject not in grouped: grouped[cls.subject] = []
        students = [{"stuId": en.student.stuId, "name": en.student.name} for en in cls.enrollments]
        students.sort(key=lambda x: x["stuId"])
        grouped[cls.subject].append({
            "id": cls.id, "section": cls.section, "teacher": cls.teacher, "room": cls.room,
            "students": students, "student_count": len(students)
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

    return {
        "keyword": student_query, "prefix": "student", "stuId": student.stuId, "name": student.name,
        "total_subjects": len(final_data), "total_sections": len(enrollments), "data": final_data
    }

@app.get("/teacher/{name}")
async def get_teacher_classes(name: str, db: Session = Depends(get_db)):
    matching_classes = db.query(models.Class).filter(models.Class.teacher == name).all()
    grouped = {}
    for cls in matching_classes:
        if cls.subject not in grouped: grouped[cls.subject] = []
        students = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        students.sort(key=lambda x: x["stuId"])
        grouped[cls.subject].append({
            "id": cls.id, "section": cls.section, "teacher": cls.teacher, "room": cls.room,
            "students": students, "student_count": len(students)
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
    return {
        "keyword": name, "prefix": "teacher", "total_subjects": len(final_data),
        "total_sections": len(matching_classes), "data": final_data
    }

@app.get("/search/{keyword:path}")
async def search_classes(keyword: str, db: Session = Depends(get_db)):
    # / 구분자 처리
    if "/" in keyword:
        parts = keyword.split("/", 1)
        subject_expr = parts[0].strip()
        person_expr = parts[1].strip()
    else:
        subject_expr = keyword.strip()
        person_expr = None

    all_classes = db.query(models.Class).all()
    subject_map = {}
    for cls in all_classes:
        if cls.subject not in subject_map: subject_map[cls.subject] = []
        subject_map[cls.subject].append(cls)

    matching_classes = []
    is_strict_mode = '&&' in keyword or person_expr is not None
    is_logical = any(op in keyword for op in ['+', '&', '/', '('])

    # 검색어 추출 (매칭 확인용)
    match_terms_src = person_expr if person_expr else keyword
    match_terms = re.findall(r'[^\+&/\(\)]+', match_terms_src)
    flat_match_terms = [t.strip().lower() for t in match_terms if t.strip()]

    for subject_name, sections in subject_map.items():
        # 1. 과목 레벨 풀 구성
        subject_level_person_pool = set()
        for s in sections:
            subject_level_person_pool.add(s.teacher)
            for e in s.enrollments:
                subject_level_person_pool.add(e.student.stuId)
                subject_level_person_pool.add(e.student.name)
        
        # 2. 과목 레벨 매칭 체크
        if person_expr:
            p_match = evaluate_bool_expression(person_expr, list(subject_level_person_pool))
            s_match = evaluate_bool_expression(subject_expr, [subject_name])
            is_subject_match = s_match and p_match
        else:
            is_subject_match = evaluate_bool_expression(subject_expr, [subject_name] + list(subject_level_person_pool))

        if not is_subject_match: continue

        # 3. 분반 레벨 필터링
        for cls in sections:
            section_person_pool = [cls.teacher.lower()] + [e.student.stuId.lower() for e in cls.enrollments] + [e.student.name.lower() for e in cls.enrollments]
            section_info_pool = [cls.subject.lower(), cls.section.lower(), cls.teacher.lower(), cls.room.lower()]
            
            if is_strict_mode:
                # STRICT (&& 또는 /): 해당 분반이 논리식을 직접 만족해야 함
                if person_expr:
                    s_m = evaluate_bool_expression(subject_expr, section_info_pool)
                    p_m = evaluate_bool_expression(person_expr, section_person_pool)
                    if s_m and p_m: matching_classes.append(cls)
                else:
                    if evaluate_bool_expression(subject_expr, section_info_pool + section_person_pool):
                        matching_classes.append(cls)
            else:
                # SOFT (& 또는 일반 논리): 과목은 통과했으니, 분반에 관련 인물이 한명이라도 있는지 확인
                if is_logical:
                    if any(any(term in p for p in section_person_pool) for term in flat_match_terms):
                        matching_classes.append(cls)
                else:
                    # 완전 일반 검색: 모든 분반 포함
                    matching_classes.append(cls)

    # entities 추출
    entities = []
    seen_ids = set()
    for cls in matching_classes:
        if f"t_{cls.teacher}" not in seen_ids:
            if any(t in cls.teacher.lower() for t in flat_match_terms):
                t_classes = db.query(models.Class).filter(models.Class.teacher == cls.teacher).all()
                t_subjects = {}
                for c in t_classes:
                    if c.subject not in t_subjects: t_subjects[c.subject] = []
                    t_subjects[c.subject].append(re.sub(r'[^0-9]', '', c.section))
                entities.append({
                    "type": "teacher", "name": cls.teacher, "id": "Teacher", "subject_count": len(t_subjects),
                    "subjects": [f"{s}({','.join(sorted(secs))})" for s, secs in t_subjects.items()]
                })
                seen_ids.add(f"t_{cls.teacher}")
        for e in cls.enrollments:
            if e.student.stuId not in seen_ids:
                if any(t in e.student.stuId.lower() or t in e.student.name.lower() for t in flat_match_terms):
                    subjs = sorted(list(set(en.class_info.subject for en in e.student.enrollments)))
                    entities.append({
                        "type": "student", "name": e.student.name, "id": e.student.stuId,
                        "subject_count": len(subjs), "subjects": subjs
                    })
                    seen_ids.add(e.student.stuId)

    # 최종 결과 구성
    grouped = {}
    for cls in matching_classes:
        if cls.subject not in grouped: grouped[cls.subject] = []
        stus = [{"stuId": en.student.stuId, "name": en.student.name} for en in cls.enrollments]
        stus.sort(key=lambda x: x["stuId"])
        grouped[cls.subject].append({
            "id": cls.id, "section": cls.section, "teacher": cls.teacher, "room": cls.room,
            "students": stus, "student_count": len(stus)
        })
    
    final_data = []
    for sub in sorted(grouped.keys()):
        secs = grouped[sub]
        secs.sort(key=lambda s: get_section_num(s["section"]))
        sub_stus = set(stu["stuId"] for s in secs for stu in s["students"])
        final_data.append({"subject": sub, "subject_student_count": len(sub_stus), "section_count": len(secs), "sections": secs})
    
    return {"keyword": keyword, "entities": entities, "total_subjects": len(final_data), "total_sections": len(matching_classes), "data": final_data}

@app.get("/classes_info")
async def get_classes_info(years: str = None, db: Session = Depends(get_db)):
    selected_years = years.split(",") if years else []
    all_classes = db.query(models.Class).all()
    grouped = {}
    total_secs = 0
    for cls in all_classes:
        stus = [{"stuId": e.student.stuId, "name": e.student.name} for e in cls.enrollments]
        if selected_years:
            stus = [s for s in stus if s["stuId"].split("-")[0] in selected_years]
            if not stus: continue
        if cls.subject not in grouped: grouped[cls.subject] = []
        stus.sort(key=lambda x: x["stuId"])
        grouped[cls.subject].append({
            "id": cls.id, "section": cls.section, "teacher": cls.teacher, "room": cls.room,
            "students": stus, "student_count": len(stus)
        })
        total_secs += 1
    final_data = []
    total_stus = set()
    for sub in sorted(grouped.keys()):
        secs = grouped[sub]
        secs.sort(key=lambda s: get_section_num(s["section"]))
        sub_stus = set(stu["stuId"] for s in secs for stu in s["students"])
        for s_id in sub_stus: total_stus.add(s_id)
        final_data.append({"subject": sub, "subject_student_count": len(sub_stus), "section_count": len(secs), "sections": secs})
    return {"total_stats": {"total_subjects": len(final_data), "total_sections": total_secs, "total_active_students": len(total_stus)}, "data": final_data}

@app.get("/students_num_info")
async def get_students_num_info(db: Session = Depends(get_db)):
    students = db.query(models.Student.stuId).all()
    summary = {}
    for (s_id,) in students:
        yr = s_id.split("-")[0] if "-" in s_id else "Unknown"
        summary[yr] = summary.get(yr, 0) + 1
    return dict(sorted(summary.items()))
