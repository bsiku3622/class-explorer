import asyncio
import httpx
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models, parser
import os

# 테이블 생성 확인
models.Base.metadata.create_all(bind=engine)

async def sync_student_enrollments(student_id: str, student_name: str, db: Session):
    """
    학생의 수강 목록을 가져와서 유효한 경우에만 DB에 저장합니다.
    데이터가 없으면 기존 정보를 삭제하고 False를 반환합니다.
    """
    url = f"https://api.ksain.net/ksain/timetable.php?stuId={student_id}"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url)
            if response.status_code != 200:
                return False
            
            parsed_classes = parser.parse_ksain_data(response.text)
            
            # 1. 데이터가 없는 경우 (졸업/휴학 등)
            if not parsed_classes:
                # 기존 데이터가 있다면 삭제
                db.query(models.Enrollment).filter(models.Enrollment.stuId == student_id).delete()
                db.query(models.Student).filter(models.Student.stuId == student_id).delete()
                db.commit()
                print(f"[{student_id}] {student_name} 데이터 없음 - 리스트에서 제외됩니다.")
                return False

            # 2. 데이터가 있는 경우 - 학생 정보 보장 및 이름 업데이트
            student = db.query(models.Student).filter(models.Student.stuId == student_id).first()
            if not student:
                student = models.Student(stuId=student_id, name=student_name)
                db.add(student)
            else:
                student.name = student_name # 이름 정보 갱신
            
            db.commit()

            # 3. 기존 수강 정보 초기화 후 재등록
            db.query(models.Enrollment).filter(models.Enrollment.stuId == student_id).delete()
            
            for pc in parsed_classes:
                cls = db.query(models.Class).filter(
                    models.Class.subject == pc["subject"],
                    models.Class.section == pc["section"],
                    models.Class.teacher == pc["teacher"]
                ).first()
                
                if not cls:
                    cls = models.Class(
                        subject=pc["subject"],
                        section=pc["section"],
                        teacher=pc["teacher"],
                        room=pc["room"]
                    )
                    db.add(cls)
                    db.flush()

                enrollment = models.Enrollment(stuId=student_id, classId=cls.id)
                db.add(enrollment)
            
            db.commit()
            print(f"[{student_id}] 동기화 완료 ({len(parsed_classes)}개 과목)")
            return True
            
        except Exception as e:
            print(f"[{student_id}] 오류 발생: {e}")
            db.rollback()
            return False

async def main():
    txt_path = "backend/students.txt"
    if not os.path.exists(txt_path):
        print(f"Error: {txt_path} 파일이 존재하지 않습니다.")
        return

    student_data = []
    with open(txt_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # "학번 이름" 형식 파싱 (공백 기준 분리)
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                student_data.append((parts[0], parts[1]))
            else:
                # 이름이 없는 경우 예외 처리
                student_data.append((parts[0], "Unknown"))

    print(f"총 {len(student_data)}명의 학번 검증 및 동기화를 시작합니다...")
    
    active_students = []
    db = SessionLocal()
    
    try:
        for stu_id, stu_name in student_data:
            is_active = await sync_student_enrollments(stu_id, stu_name, db)
            if is_active:
                active_students.append(f"{stu_id} {stu_name}")
            
            # 서버 부하 조절이 필요하다면 주석 해제
            # await asyncio.sleep(0.05)
            
    finally:
        db.close()
    
    # 유효한 학번 리스트로 파일 갱신
    with open(txt_path, "w") as f:
        f.write("\n".join(active_students))
    
    print("-" * 30)
    print(f"작업 완료!")
    print(f"초기 대상: {len(student_data)}명")
    print(f"최종 활성: {len(active_students)}명 (students.txt 갱신 완료)")
    print("-" * 30)

if __name__ == "__main__":
    asyncio.run(main())
