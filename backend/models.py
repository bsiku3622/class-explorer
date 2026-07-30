"""
SQLAlchemy ORM 모델.

과목은 네 층으로 나뉩니다. 층마다 출처와 바뀌는 속도가 달라서입니다.

    Department  학과            수학 · 물리학 · 융합 …          (거의 안 바뀜)
        ↑
    Course      교육과정 과목    "미적분학2" + 학점·선수관계      (교육과정 개편 때)
        ↑
    Subject     KEIS 개설명      "미적분학2" / "미적분학2(EC)"    (표기가 바뀜)
        ↑
    Class       실제 분반        3분반 · 김효진 · 2026-2         (학기마다)

`Course`가 따로 있는 이유는 **언어와 표기를 벗겨낸 과목 정체성**이 필요하기 때문입니다.
영어강의(EC)와 한국어강의는 별개로 개설되지만 학점·선수관계·졸업 요건은 하나여야
합니다. 옛 이름과 새 이름을 같은 과목으로 묶는 자리도 여기입니다.
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, UniqueConstraint, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from backend.database import Base
import datetime


class Student(Base):
    __tablename__ = "students"
    stuId = Column(String, primary_key=True, index=True)
    name = Column(String)
    enrollments = relationship("Enrollment", back_populates="student")


# ─── 과목 4층 ────────────────────────────────────────────────────────────────

class Department(Base):
    """학과. 계열(자연/인문/융합)은 학과가 결정하므로 여기 둡니다."""
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)       # 수학, 물리학, 융합 ...
    category = Column(String, nullable=False)                # natural | humanities | convergence
    display_order = Column(Integer, nullable=False, default=0)  # 화면에 늘어놓는 순서

    courses = relationship("Course", back_populates="department")


class Course(Base):
    """
    교육과정 과목. 학점·선수관계·졸업 요건이 붙는 층입니다.

    이름에 언어 태그를 넣지 않습니다 — `미적분학2(EC)`와 `미적분학2`는 같은 과목의
    다른 언어 개설이고, 그 구분은 `Subject.is_ec`가 담습니다.

    출처는 Zamong 워크북(`curriculum_seed.json`)입니다.
    """
    __tablename__ = "courses"
    id = Column(Integer, primary_key=True, index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    name = Column(String, unique=True, nullable=False, index=True)   # "미적분학2"
    name_english = Column(String, nullable=True)
    credits = Column(Float, nullable=False)
    ap_credits = Column(Float, default=0, nullable=False)
    is_pf = Column(Boolean, default=False, nullable=False)
    recommended_semester = Column(String, nullable=True)      # "1"~"6" | "summer"
    description = Column(Text, nullable=True)
    description_sections = Column(JSON, default=dict, nullable=False)
    description_source = Column(String, nullable=True)
    description_page = Column(Integer, nullable=True)

    department = relationship("Department", back_populates="courses")
    subjects = relationship("Subject", back_populates="course")


class Subject(Base):
    """
    KEIS가 부르는 개설 과목명. 영어강의와 한국어강의가 별개 행입니다.

    `course_id`가 비어 있으면 교육과정에 없는 과목입니다 — 외국인 전형 과목이나
    개편 전 이름이 여기 해당하고, 학점·계열을 알 수 없습니다.

    유일성은 `(name, is_ec)`로 봅니다. `name_raw`가 아닌 이유는 영문 표기가 학기마다
    흔들려서(`Physics & Exp.1` → `Physics and Exp.1`) 같은 과목이 두 행으로 갈릴 수
    있기 때문입니다. 원문은 파싱 규칙을 고칠 때 다시 쪼개려고 남겨 둡니다.
    """
    __tablename__ = "subjects"
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    name = Column(String, nullable=False, index=True)        # "미적분학2", "수학특강(논리및집합)"
    name_english = Column(String, nullable=True)             # "Calculus2"
    name_raw = Column(String, nullable=False)                # KEIS 원문
    is_ec = Column(Boolean, default=False, nullable=False)    # 영어강의(English Class)

    course = relationship("Course", back_populates="subjects")
    classes = relationship("Class", back_populates="subject")

    __table_args__ = (UniqueConstraint('name', 'is_ec', name='_subject_name_lang_uc'),)


class Class(Base):
    """한 학기에 실제로 열린 분반."""
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False, index=True)
    section = Column(String)             # 분반
    teacher = Column(String)             # 교사
    room = Column(String)                # 대표 강의실
    year = Column(Integer, index=True, nullable=False)
    semester = Column(Integer, index=True, nullable=False)

    subject = relationship("Subject", back_populates="classes")
    enrollments = relationship("Enrollment", back_populates="class_info")
    times = relationship("ClassTime", back_populates="class_info", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('subject_id', 'section', 'teacher', 'year', 'semester', name='_subject_section_uc'),
    )


class ClassTime(Base):
    __tablename__ = "class_times"
    id = Column(Integer, primary_key=True, index=True)
    day = Column(String)      # MON ~ FRI
    period = Column(Integer)  # 1-11
    room = Column(String)
    class_id = Column(Integer, ForeignKey("classes.id"))

    class_info = relationship("Class", back_populates="times")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(Integer, primary_key=True, index=True)
    stuId = Column(String, ForeignKey("students.stuId"))
    classId = Column(Integer, ForeignKey("classes.id"))

    student = relationship("Student", back_populates="enrollments")
    class_info = relationship("Class", back_populates="enrollments")

    __table_args__ = (UniqueConstraint('stuId', 'classId', name='_student_enrollment_uc'),)


class CoursePrereq(Base):
    """
    과목 선수관계. `before`를 이수해야 `after`를 들을 수 있습니다.

    `Course` 사이에 걸립니다 — `Subject` 사이에 걸면 영어강의·한국어강의 조합마다
    같은 관계가 중복돼 117개가 186개로 불어납니다.

    `alternative`는 같은 `after`를 향한 다른 항목과 **택일** 관계라는 뜻입니다.
    예술속의물리는 물리학및실험2 또는 일반물리학2 중 하나면 되지만, 법과학은
    화학및실험과 생물학및실험을 모두 들어야 합니다.
    """
    __tablename__ = "course_prereqs"
    id = Column(Integer, primary_key=True, index=True)
    before_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    after_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    alternative = Column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint('before_id', 'after_id', name='_course_prereq_uc'),)


# ─── 계정 ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    # 이 계정이 누구인지. 본인이 학번과 이름을 대조해 등록합니다.
    # 등록 전에는 비어 있고, 그동안 이수 기록 같은 개인 데이터를 쓸 수 없습니다.
    #
    # 한 학번은 한 계정만 가질 수 있습니다. 라우터에서도 검사하지만, 두 사람이 동시에
    # 같은 학번을 넣으면 둘 다 통과할 수 있어 DB에서 막습니다.
    # NULL 은 유니크 검사에서 빠지므로 미등록 계정은 얼마든지 있어도 됩니다.
    stu_id = Column(
        String, ForeignKey("students.stuId"), nullable=True, index=True, unique=True
    )
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")


class UserState(Base):
    """
    계정별 화면 상태. 기기(localStorage)가 아니라 계정에 붙여서 어디서 접속하든
    이어서 작업할 수 있게 합니다.

    `key`는 화면 이름(`plan` | `trade`)이고 `data`는 그 화면이 쓰던 JSON 그대로입니다.
    구조가 화면마다 달라 컬럼으로 펼치지 않았습니다 — 서버는 내용을 해석하지 않습니다.
    성적처럼 서버가 알아야 하는 값은 `CourseGrade`로 따로 뺐습니다.
    """
    __tablename__ = "user_states"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String, nullable=False)
    data = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    __table_args__ = (UniqueConstraint('user_id', 'key', name='_user_state_uc'),)


class CourseGrade(Base):
    """
    계정 본인의 이수 내역과 성적.

    행이 있으면 이수한 것으로 봅니다. `grade`는 선택이라, 성적 없이 이수 여부만
    체크해 둘 수도 있습니다.

    `Course` 단위로 기록합니다 — 같은 과목을 영어강의로 들었든 한국어강의로 들었든
    이수는 하나입니다.
    """
    __tablename__ = "course_grades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    grade = Column(String, nullable=True)  # "A+", "A0" ... 미입력이면 None

    __table_args__ = (UniqueConstraint('user_id', 'course_id', name='_course_grade_uc'),)


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
