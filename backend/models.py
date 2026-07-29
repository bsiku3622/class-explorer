from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, UniqueConstraint, DateTime, Text, JSON
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
    year = Column(Integer, index=True, nullable=False)     # 학년도 (예: 2026)
    semester = Column(Integer, index=True, nullable=False) # 학기 (1 | 2)

    enrollments = relationship("Enrollment", back_populates="class_info")
    times = relationship("ClassTime", back_populates="class_info", cascade="all, delete-orphan")

    # 동일 학기 안에서 과목/분반/교사 조합이 중복되지 않도록 설정
    __table_args__ = (
        UniqueConstraint('subject', 'section', 'teacher', 'year', 'semester', name='_subject_section_uc'),
    )

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


class SubjectCredit(Base):
    """
    과목별 학점. KEIS 시간표 API에는 학점이 없어 SweetZamong 교육과정 데이터에서 가져옵니다.
    과목명은 `Class.subject` 원문 그대로 저장합니다 (분반과 무관하게 과목 단위).
    """
    __tablename__ = "subject_credits"
    subject = Column(String, primary_key=True, index=True)
    credits = Column(Float, nullable=False)
    ap_credits = Column(Float, default=0, nullable=False)
    is_ec = Column(Boolean, default=False, nullable=False)
    is_pf = Column(Boolean, default=False, nullable=False)
    # 매칭에 쓴 SweetZamong 과목명 — 어떤 항목과 이어졌는지 추적용
    matched_name = Column(String, nullable=True)


class Course(Base):
    """
    교육과정 카탈로그. 학교가 개설할 수 있는 과목의 정의로, 특정 학기에 실제로 열린
    분반(`Class`)과는 다른 층위입니다.

    `Class.subject`(KEIS 원문)와는 `SubjectCredit.matched_name`을 거쳐 이어집니다.

        Class.subject → SubjectCredit.subject
                        SubjectCredit.matched_name → Course.name

    출처는 Zamong 워크북이며 `curriculum_seed.json`으로 옮겨 담습니다.
    """
    __tablename__ = "courses"
    name = Column(String, primary_key=True, index=True)
    english_name = Column(String, nullable=True)
    department = Column(String, index=True, nullable=False)   # 수학, 물리학, 융합 ...
    category = Column(String, index=True, nullable=False)     # natural | humanities | convergence
    credits = Column(Float, nullable=False)
    ap_credits = Column(Float, default=0, nullable=False)
    is_ec = Column(Boolean, default=False, nullable=False)
    is_pf = Column(Boolean, default=False, nullable=False)
    recommended_semester = Column(String, nullable=True)      # "1"~"6" | "summer"
    description = Column(Text, nullable=True)
    description_sections = Column(JSON, default=dict, nullable=False)
    description_source = Column(String, nullable=True)        # 출처 책자
    description_page = Column(Integer, nullable=True)


class CoursePrereq(Base):
    """
    과목 선수관계. `before`를 이수해야 `after`를 들을 수 있습니다.

    `alternative`는 같은 `after`를 향한 다른 항목과 **택일** 관계라는 뜻입니다.
    예를 들어 예술속의물리는 물리학및실험2 또는 일반물리학2 중 하나면 되지만,
    법과학은 화학및실험과 생물학및실험을 모두 들어야 합니다.
    """
    __tablename__ = "course_prereqs"
    id = Column(Integer, primary_key=True, index=True)
    before = Column(String, ForeignKey("courses.name"), index=True, nullable=False)
    after = Column(String, ForeignKey("courses.name"), index=True, nullable=False)
    alternative = Column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint('before', 'after', name='_course_prereq_uc'),)


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
    계정이 기록한 이수 내역과 성적.

    행이 있으면 이수한 것으로 봅니다. `grade`는 선택이라, 성적 없이 이수 여부만
    체크해 둘 수도 있습니다.

    `stu_id`를 함께 두는 이유는 한 계정으로 여러 학생의 계획을 짤 수 있기 때문입니다
    (탐색 도구 성격상 학번을 직접 고르는 구조). 다른 계정의 기록은 보이지 않습니다.
    """
    __tablename__ = "course_grades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stu_id = Column(String, nullable=False, index=True)
    course = Column(String, ForeignKey("courses.name"), nullable=False)
    grade = Column(String, nullable=True)  # "A+", "A0" ... 미입력이면 None

    __table_args__ = (UniqueConstraint('user_id', 'stu_id', 'course', name='_course_grade_uc'),)


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
