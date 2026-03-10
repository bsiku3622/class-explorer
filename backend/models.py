from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.database import Base

class Student(Base):
    __tablename__ = "students"
    stuId = Column(String, primary_key=True, index=True)
    name = Column(String) # 학생 이름 추가
    enrollments = relationship("Enrollment", back_populates="student")

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, index=True) # 과목명
    section = Column(String)             # 분반
    teacher = Column(String)             # 교사
    room = Column(String)                # 강의실 (대표 강의실)

    enrollments = relationship("Enrollment", back_populates="class_info")
    times = relationship("ClassTime", back_populates="class_info", cascade="all, delete-orphan")

    # 동일한 과목/분반/교사 조합이 중복되지 않도록 설정
    __table_args__ = (UniqueConstraint('subject', 'section', 'teacher', name='_subject_section_uc'),)

class ClassTime(Base):
    __tablename__ = "class_times"
    id = Column(Integer, primary_key=True, index=True)
    day = Column(String)      # 요일 (MON, TUE, WED, THU, FRI)
    period = Column(Integer)  # 교시 (1-11)
    room = Column(String)     # 해당 시간의 강의실
    class_id = Column(Integer, ForeignKey("classes.id"))

    class_info = relationship("Class", back_populates="times")

class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    stuId = Column(String, ForeignKey("students.stuId"))
    classId = Column(Integer, ForeignKey("classes.id"))

    student = relationship("Student", back_populates="enrollments")
    class_info = relationship("Class", back_populates="enrollments")

    # 학생이 동일 수업에 중복 등록 방지
    __table_args__ = (UniqueConstraint('stuId', 'classId', name='_student_enrollment_uc'),)
