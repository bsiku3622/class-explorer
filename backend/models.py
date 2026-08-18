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

from sqlalchemy import Column, Integer, String, Boolean, Float, ForeignKey, UniqueConstraint, DateTime, Date, Text, JSON
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
    # 이 학과의 트랙 이수 조건 — 문장 그대로입니다. 학과마다 규칙이 제각각이라
    # 판정은 하지 않고 보여 주기만 합니다
    track = Column(String, nullable=True)
    notes = Column(JSON, default=list, nullable=False)       # 시트에 붙어 있던 안내

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
    # 워크북이 상자 색으로 칠해 둔 분류 — core(핵심) | advanced(심화) | ap | special(특강)
    # | convergence(융합). 색이 곧 분류라 화면도 이 값으로 칠합니다
    tier = Column(String, nullable=True)
    # 그 학과의 심화필수 (워크북에서 굵은 밑줄) — 트랙 조건에 걸리는 과목입니다
    required_advanced = Column(Boolean, default=False, nullable=False)
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

# 권한은 위계입니다 — 위 단계는 아래 단계가 할 수 있는 일을 전부 할 수 있습니다.
#
#   user     내 일정을 관리하고, 공용 일정은 추가를 "요청"만 합니다
#   manager  학사일정(공용)을 직접 고치고, 올라온 요청을 허용·거절합니다
#   admin    manager 가 하는 일 전부 + 계정 관리
#
# 불리언 두 개(is_admin·is_manager) 대신 컬럼 하나로 둡니다 — 둘 다 켜진 계정이
# 무슨 뜻인지 아무도 모르게 되는 걸 막기 위해서입니다.
ROLES = ("user", "manager", "admin")
_ROLE_RANK = {name: i for i, name in enumerate(ROLES)}


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False)
    # 학교 구글 계정. 로그인할 때마다 여기로 사람을 찾습니다.
    # 관리자가 만들어 준 옛 계정은 비어 있고, 구글로 처음 들어올 때 학번으로 이어붙입니다.
    email = Column(String, unique=True, nullable=True, index=True)
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

    def has_role(self, minimum: str) -> bool:
        """`minimum` 이상인지. 위계라서 admin 은 manager 검사도 통과합니다."""
        return _ROLE_RANK.get(self.role, 0) >= _ROLE_RANK[minimum]

    @property
    def is_admin(self) -> bool:
        return self.role == "admin"

    @property
    def is_manager(self) -> bool:
        return self.has_role("manager")


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
    계정 본인이 **직접 적는** 이수 내역 — 자몽 한 칸입니다.

    ⚠️ **실제 수강 이력(`Enrollment`)과 별개입니다.** 한때 수집된 학기를 그대로 이수로
    박아 뒀는데, 재수강한 과목이 두 학기에 걸쳐 나타나면서 어느 쪽이 진짜인지 화면이
    정할 수 없었습니다. 학사 사이트를 붙이면 같은 문제가 더 커집니다 — 기록은 사실을
    말하고 자몽은 **본인의 선언**을 담습니다. 둘을 섞지 마세요.

    `term`이 이 표의 중심입니다. 워크북과 같은 규칙으로, **학기가 있어야 학점이
    인정됩니다.** 재수강은 별도 장치 없이 학기를 다시 고르면 끝입니다 — 자몽에 남는
    건 인정받는 한 번뿐이라 행을 여럿 둘 이유가 없습니다.

    `Course` 단위로 기록하고, 영어강의로 들었는지는 `is_ec`가 담습니다 — EC 요건은
    과목의 성질이 아니라 어느 분반을 들었느냐로 정해집니다.
    """
    __tablename__ = "course_grades"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    grade = Column(String, nullable=True)  # "A+", "A0" ... 미입력이면 None
    term = Column(String, nullable=True)   # "1"~"6" | "S"(계절). 없으면 학점 미인정
    is_ec = Column(Boolean, default=False, nullable=False)  # 영어강의로 들었는지

    __table_args__ = (UniqueConstraint('user_id', 'course_id', name='_course_grade_uc'),)


# ─── 학사일정 ────────────────────────────────────────────────────────────────

# 일정의 성격. 화면에서 색과 아이콘을 고르는 기준이고, PDF 파서가 글자에서 알아냅니다.
EVENT_CATEGORIES = (
    "holiday",   # 공휴일 — 삼일절 · 추석 · 대체휴일
    "dorm",      # 귀가 · 귀교 · 생활관 폐쇄
    "exam",      # 중간고사 · 기말고사
    "term",      # 개학 · 종업 · 주차 종료
    "academic",  # 수강신청 · 교무회의 · 졸업연구 같은 학사 행사
    "event",     # 그 밖의 행사 (기본값)
)

# 시간을 어떻게 적었는지. 학사일정은 전부 종일이고, 개인 일정만 시각·교시를 씁니다.
TIME_MODES = ("allday", "clock", "period")


class CalendarEvent(Base):
    """
    달력에 찍히는 일정 하나.

    `owner_id`가 비어 있으면 **학교 공용 일정**이라 모두에게 보이고 매니저만 고칩니다.
    차 있으면 그 계정의 **개인 일정**이라 본인만 보고 본인만 고칩니다. 공개 범위를
    따로 두지 않은 이유는 지금 경우의 수가 이 둘뿐이기 때문입니다 — 나중에 공유가
    생기면 그때 컬럼을 하나 붙이면 됩니다.

    `end_date`는 하루짜리여도 `start_date`와 같은 값을 채웁니다. 비워 두면 달력이
    한 달치를 물어볼 때마다 "끝이 없으면 시작일로 친다"를 매번 따져야 해서입니다.

    **반복은 규칙이 아니라 실제 행으로 펼쳐 둡니다.** 같은 묶음은 `series_id`가
    같습니다. 규칙으로 두면 조회할 때마다 펼쳐야 하고 "이번 주만 빼기"가 어려워지는데,
    행으로 두면 한 회차만 지우는 게 그냥 삭제입니다. 학교 규모에서 행이 늘어나는
    비용은 무시할 만합니다.
    """
    __tablename__ = "calendar_events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)

    time_mode = Column(String, default="allday", nullable=False)
    start_minute = Column(Integer, nullable=True)   # clock — 자정 기준 분 (13:30 → 810)
    end_minute = Column(Integer, nullable=True)
    start_period = Column(Integer, nullable=True)   # period — 1~11 교시
    end_period = Column(Integer, nullable=True)

    category = Column(String, default="event", nullable=False)
    # 대상 학년. "1,2" 처럼 적고 비어 있으면 전학년입니다.
    target_grades = Column(String, nullable=True)
    # pdf = 학사일정 문서에서 온 것. 개정판을 다시 파싱할 때 이것만 갈아끼웁니다
    source = Column(String, default="manual", nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    series_id = Column(String, nullable=True, index=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class EventRequest(Base):
    """
    일반 계정이 "이건 다들 알아야 할 것 같은데요" 하고 올리는 공용 일정 제안.

    이벤트와 컬럼이 겹치지만 테이블을 따로 둡니다 — 거절한 제안이 일정 목록에 계속
    끼어 있으면 곤란하고, 매니저가 내용을 고쳐서 허용했을 때 원문이 남아야 합니다.
    """
    __tablename__ = "event_requests"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    time_mode = Column(String, default="allday", nullable=False)
    start_minute = Column(Integer, nullable=True)
    end_minute = Column(Integer, nullable=True)
    start_period = Column(Integer, nullable=True)
    end_period = Column(Integer, nullable=True)
    category = Column(String, default="event", nullable=False)
    target_grades = Column(String, nullable=True)
    note = Column(Text, nullable=True)

    status = Column(String, default="pending", nullable=False, index=True)  # pending | approved | rejected
    reason = Column(String, nullable=True)          # 거절 사유
    decided_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at = Column(DateTime, nullable=True)
    # 허용해서 만들어진 일정. 매니저가 내용을 고쳤다면 원문과 다를 수 있습니다
    event_id = Column(Integer, ForeignKey("calendar_events.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class MealMenu(Base):
    """
    그날의 조·중·석식. 출처는 ksain.net 급식 API 입니다.

    **한 번 받은 날짜는 다시 묻지 않습니다.** 지난 급식은 바뀔 일이 없고, 학교 API 를
    사람 수만큼 두드릴 이유도 없습니다. 메모리 캐시로만 두면 서버를 재시작할 때마다
    처음부터 다시 받게 됩니다.

    **비어 있는 날은 저장하지 않습니다.** 아직 안 올라온 날(주로 다음 주)을 빈 값으로
    적어 두면 영영 빈 채로 굳습니다 — 행이 없으면 다음 요청이 다시 물어봅니다.
    """
    __tablename__ = "meal_menus"
    date = Column(Date, primary_key=True)
    breakfast = Column(Text, nullable=True)
    lunch = Column(Text, nullable=True)
    dinner = Column(Text, nullable=True)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow)


class Session(Base):
    """
    로그인한 기기 하나. **한 계정에 여럿입니다** (`auth.MAX_SESSIONS_PER_USER`).

    한동안 로그인할 때마다 이 표의 기존 행을 통째로 지웠습니다 — 표는 1:N 인데 코드가
    1:1 을 강제하고 있었던 셈입니다. 지금은 상한을 넘으면 **가장 오래 안 쓴 행부터**
    밀어냅니다.
    """
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_token = Column(String, unique=True, nullable=False)
    device_type = Column(String, default="web")  # "web" | "mobile"
    #: `"Chrome · Android"` — User-Agent 에서 뽑습니다. 세션 목록에서 **어느 게 내
    #: 폰인지** 가리는 유일한 단서라, 없으면 폐기 버튼을 누를 수가 없습니다.
    #: 이 컬럼이 생기기 전에 만들어진 세션은 `None` 입니다
    device_label = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_used_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    user = relationship("User", back_populates="sessions")


class Friend(Base):
    """
    친구 등록. **단방향입니다** — 내가 추가하면 끝이고 상대의 수락이 필요 없습니다.

    상호 승인을 두지 않은 이유는, 이 앱에서 남의 시간표는 이미 `GET /students/{stu_id}`
    로 한 명씩 볼 수 있기 때문입니다. 그러니 이 표는 **새로 뭘 열어 주는 게 아니라
    자주 보는 사람을 북마크해 두는 것**에 가깝습니다. 승인 절차를 붙이면 마찰만 늘고
    막아 주는 건 없습니다.

    한쪽 방향이라 A가 B를 추가해도 B의 목록에는 A가 없습니다.
    """
    __tablename__ = "friends"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    friend_stu_id = Column(String, ForeignKey("students.stuId"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "friend_stu_id", name="_friend_uc"),
    )
