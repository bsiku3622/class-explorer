import asyncio
import httpx
from sqlalchemy.orm import Session
from backend.database import SessionLocal, engine
from backend import models, parser
import os
import time

# 테이블 생성 확인
models.Base.metadata.create_all(bind=engine)

# 동시 요청 수를 제한하는 세마포어 (서버 부하 및 차단 방지)
MAX_CONCURRENT_REQUESTS = 20
semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

async def sync_student_enrollments(client: httpx.AsyncClient, student_id: str, student_name: str):
    """
    한 명의 학생 데이터를 동기화합니다. 세마포어를 통해 실행 수를 제어합니다.
    """
    async with semaphore:
        url = f"https://api.ksain.net/ksain/timetable.php?stuId={student_id}"
        db: Session = SessionLocal()
        try:
            # 타임아웃을 적절히 설정하여 무한 대기 방지
            response = await client.get(url, timeout=10.0)
            if response.status_code != 200:
                return None
            
            parsed_classes = parser.parse_ksain_data(response.text)
            
            if not parsed_classes:
                db.query(models.Enrollment).filter(models.Enrollment.stuId == student_id).delete()
                db.query(models.Student).filter(models.Student.stuId == student_id).delete()
                db.commit()
                print(f"[-] {student_id} {student_name}: 데이터 없음 (제외)")
                return ("skipped", f"{student_id} {student_name}")

            # 학생 정보 갱신
            student = db.query(models.Student).filter(models.Student.stuId == student_id).first()
            if not student:
                student = models.Student(stuId=student_id, name=student_name)
                db.add(student)
            else:
                student.name = student_name
            
            db.commit()

            # 수강 정보 재등록
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

                # 시간표 정보 갱신
                db.query(models.ClassTime).filter(models.ClassTime.class_id == cls.id).delete()
                for t in pc["times"]:
                    class_time = models.ClassTime(
                        day=t["day"],
                        period=t["period"],
                        room=t["room"],
                        class_id=cls.id
                    )
                    db.add(class_time)

                enrollment = models.Enrollment(stuId=student_id, classId=cls.id)
                db.add(enrollment)
            
            db.commit()
            print(f"[+] {student_id} {student_name} - 동기화 완료")
            return ("synced", f"{student_id} {student_name}")

        except Exception as e:
            print(f"[!] {student_id} 오류: {e}")
            db.rollback()
            return ("error", student_id)
        finally:
            db.close()

async def main():
    txt_path = "backend/students.txt"
    if not os.path.exists(txt_path):
        print(f"Error: {txt_path} 파일이 존재하지 않습니다.")
        return

    student_data = []
    with open(txt_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                student_data.append((parts[0], parts[1]))
            else:
                student_data.append((parts[0], "Unknown"))

    start_time = time.time()
    print(f"{len(student_data)}명 병렬 동기화 시작 (동시성: {MAX_CONCURRENT_REQUESTS})...")
    
    async with httpx.AsyncClient() as client:
        # 모든 학생에 대한 태스크 생성
        tasks = [
            sync_student_enrollments(client, stu_id, stu_name)
            for stu_id, stu_name in student_data
        ]
        
        # 병렬 실행 및 결과 수집
        results = await asyncio.gather(*tasks)
    
    synced = [r[1] for r in results if r and r[0] == "synced"]
    skipped = [r[1] for r in results if r and r[0] == "skipped"]
    errors  = [r[1] for r in results if r and r[0] == "error"]

    with open(txt_path, "w") as f:
        f.write("\n".join(synced))

    end_time = time.time()
    elapsed = end_time - start_time
    print("-" * 30)
    print(f"SYNC_RESULT synced={len(synced)} skipped={len(skipped)} errors={len(errors)} elapsed={elapsed:.1f}s")
    print("-" * 30)

if __name__ == "__main__":
    asyncio.run(main())
