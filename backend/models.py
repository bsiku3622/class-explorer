from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from backend.database import Base
import datetime

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


class SubjectAlias(Base):
    __tablename__ = "subject_aliases"
    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String, index=True, nullable=False)  # 원본 과목명 (Class.subject 와 일치)
    alias = Column(String, nullable=False)                # 검색 키워드
    __table_args__ = (UniqueConstraint('subject', 'alias', name='_subject_alias_uc'),)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String, unique=True, nullable=False)
    device_type = Column(String, default="web")  # "web" | "mobile"
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    user = relationship("User", back_populates="sessions")
