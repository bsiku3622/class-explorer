"""Agent 도구 — 모델이 부를 수 있는 읽기 전용 함수들.

**화면에서 볼 수 있는 것만 돌려줍니다.** class-explorer 는 로그인한 사람에게 학기 전체(다른
학생·교사 시간표, 분반 명단)를 보여 주므로 그건 열어 두고, 화면이 본인 것만 보여 주는 것
(시험 시간표·개인 일정)은 여기서도 본인 것만 줍니다. 새 도구를 붙일 때도 이 경계를 지키세요.

날짜를 받는 도구는 홈과 같은 규칙으로 그날을 판정합니다 — 방학·주말·휴업일이면 수업이
없고, 대체 시간표(`TimetableOverride`)가 있으면 그 요일 수업으로 갈아 끼웁니다.

**모델이 넘기는 값은 너그럽게 읽습니다.** 과목은 줄임말(`미1`·`선대`·`일물2`)로, 날짜는 "목요일"·"10/30" 으로,
인자 이름은 `course=` 처럼 바꿔서 옵니다. 예전에는 이런 호출이 "찾지 못했습니다" 로 실패했고(질문 30개에
도구 실패 7번, 전부 이름), 모델은 그대로 "그런 과목은 없다" 고 답했습니다.
"""
from __future__ import annotations

import asyncio
import datetime
import json
import re
import unicodedata

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend import models
from backend.core import clock
from backend.core.db import KsainSession, db_session
from backend.knowledge import archive as memory_archive
from backend.knowledge import facts as memory
from backend.knowledge import search as knowledge
from backend.knowledge.text import query_terms
from backend.services import majors, periods, syllabi
from backend.services.calendar import event_out, grades, visible_to
from backend.services.exams import exams_for
from backend.services.meals import fetch_meal
from backend.services.schoolday import day_status
from backend.services.subject_names import rank_names
from backend.services.terms import resolve_term
from backend.services.timetable import section_num, student_slots, subject_label, term_slots
from backend.services.versioning import at_version

WEEKDAYS = "월화수목금토일"
# 학사일정이면 다 해당하는 말 — `calendar` 의 검색어로 쓰면 제목에 그 말이 든 일정만 남습니다("오늘 일정 뭐야?")
_GENERIC = {"일정", "학사일정", "일정표", "스케줄", "달력", "캘린더"}
PERIOD_TIME = {p: (s, e) for p, s, e in periods.PERIODS}
ALL_PERIODS = [p for p, _s, _e in periods.PERIODS]
CLASSROOM = re.compile(r"^[형탐예창]\d{4}")
# 질문한 사람을 가리키는 말 — `person`·`people`·`syllabus(subject=…)` 에 옵니다
_ME = {"", "me", "my", "i", "myself", "나", "내", "저", "제", "본인", "나의", "저의", "질문자", "내과목", "전부"}
_RELATIVE = {"오늘": 0, "금일": 0, "today": 0, "내일": 1, "tomorrow": 1, "모레": 2, "내일모레": 2, "글피": 3,
             "어제": -1, "yesterday": -1, "그제": -2, "그저께": -2}
_EC = re.compile(r"\(\s*EC\s*\)|\bEC\b", re.I)


class ToolError(Exception):
    """모델에게 그대로 돌려줄 오류 — 도구 결과의 `error` 가 됩니다(예외 이름을 붙이지 않습니다)."""


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text or "")).lower()


def _is_me(value) -> bool:
    return re.sub(r"\s+", "", str(value or "")).lower() in _ME


def _period_label(period: int) -> str:
    start, end = PERIOD_TIME[period]
    return f"{period}교시({periods.hhmm(start)}–{periods.hhmm(end)})"


def _when(start: str, end: str | None = None, start_time: str | None = None, end_time: str | None = None) -> str:
    """일정 한 줄 — "2026-10-28(수) 15:40–16:30 · 7교시".

    ⚠️ 날짜·시각·학년을 따로 주면 12B 모델이 항목 여러 개를 엇갈려 짝짓습니다(외국인 OT 15:40 을
    다른 학년 줄에 붙였습니다). 코드가 완성된 문장을 만들고 모델은 옮기기만 하게 합니다.
    """
    day = datetime.date.fromisoformat(start)
    text = f"{start}({WEEKDAYS[day.weekday()]})"
    if end and end != start:
        last = datetime.date.fromisoformat(end)
        text += f"~{end}({WEEKDAYS[last.weekday()]})"
    if start_time:
        text += f" {start_time}" + (f"–{end_time}" if end_time else "")
        minute = int(start_time[:2]) * 60 + int(start_time[3:5])
        period = next((p for p, s, _e in periods.PERIODS if s == minute), None)
        if period:
            text += f" · {period}교시"
    return text


def profile_of(db: Session, stu_id: str | None, major: str | None = None) -> dict | None:
    """학번에서 읽어 내는 질문자 정보 — 학년과 내국인·외국인. 전공은 계정에 적힌 것(`User.major`)을 받습니다.

    - 학년: 학번 앞 두 자리가 입학 연도이고 학년도는 3월에 바뀝니다 (2026년 10월의 25학번 = 2학년).
      4년째 다니는 학생도 있어 3학년으로 묶습니다
    - 외국인: **번호가 200 이상** (`24-201`, `26-205`). 2026-2 기준으로 외국인 전용 과목(한국어·TOPIK·
      로마숫자 과목 — `영어Ⅱ` 는 내국인도 들어서 제외) 수강생 18명과 정확히 같은 18명입니다
    """
    if not stu_id or not re.fullmatch(r"\d{2}-\d{3}", stu_id):
        return None
    today = clock.today()
    school_year = today.year if today.month >= 3 else today.year - 1
    years = school_year - (2000 + int(stu_id[:2])) + 1
    student = db.get(models.Student, stu_id)
    major = major if major in majors.MAJORS else None
    return {
        "name": student.name if student else None, "stu_id": stu_id,
        "grade": max(1, min(3, years)), "years": years,
        "track": "외국인" if int(stu_id[3:]) >= 200 else "내국인",
        "major": major, "division": majors.division_of(major),
    }


def applies(profile: dict | None, title: str, grades: list[int] | None,
            target_majors: list[str] | None = None) -> bool | None:
    """이 일정이 질문자에게 해당하는가. 모를 때는 None.

    모델에게 맡기면 항목 여러 개를 엇갈려 고릅니다 — 코드가 학년(`target_grades` 나 제목의
    "N학년"), 전공(`target_majors` 나 제목의 학부 이름)과 구분(제목의 내국인·외국인, 국내반·국제반)으로
    미리 정합니다. 전공을 아직 안 정한 사람에게는 전공을 따지지 않습니다.
    """
    if not profile:
        return None
    wanted = set(grades or [])
    if not wanted:
        match = re.search(r"((?:[123]\s*,\s*)*[123])\s*학년", title or "")
        if match:
            wanted = {int(g) for g in re.findall(r"[123]", match.group(1))}
    if wanted and profile["grade"] not in wanted:
        return False
    wanted_majors = set(target_majors or []) or set(majors.mentioned(title))
    if wanted_majors and profile.get("major") and profile["major"] not in wanted_majors:
        return False
    foreign = profile["track"] == "외국인"
    if re.search(r"외국인|국제반", title or "") and not foreign:
        return False
    if re.search(r"내국인|국내반", title or "") and foreign:
        return False
    return True


def _items(items: list[dict], profile: dict | None = None) -> list[dict]:
    out = []
    for item in items or []:
        entry = {"title": item["title"], "when": _when(item["start_date"], item.get("end_date"),
                                                      item.get("start_time"), item.get("end_time"))}
        if item.get("target_grades"):
            entry["grades"] = item["target_grades"]
        if item.get("target_majors"):
            entry["majors"] = item["target_majors"]
        mine = applies(profile, item["title"], item.get("target_grades"), item.get("target_majors"))
        if mine is not None:
            entry["mine"] = mine
        for key in ("post_title", "url"):
            if item.get(key):
                entry[key] = item[key]
        out.append(entry)
    return out


def _date(value: str | None) -> datetime.date:
    """도구가 받은 날짜 — `YYYY-MM-DD` 가 원칙이지만 모델이 "내일"·"10/30"·"목요일" 로도 넘깁니다.

    예전에는 못 읽으면 조용히 오늘로 바꿨습니다. "11월 2일" 을 오늘로 읽으면 틀린 날의 시간표로 답하므로, 못
    읽으면 오류로 돌려 모델이 다시 부르게 합니다. 요일만 오면 오늘부터 다가오는 그 요일입니다(오늘이 목요일이면
    "목요일" 은 오늘) — 목요일에 "목요일 3교시 빈 교실" 을 물었더니 모델이 금요일 날짜를 넘겼습니다.
    """
    if not value:
        return clock.today()
    text = str(value).strip()
    today = clock.today()
    try:
        match = re.match(r"(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})", text)
        if match:
            return datetime.date(*map(int, match.groups()))
        match = re.fullmatch(r"(\d{1,2})\s*[-./월]\s*(\d{1,2})\s*일?", text)
        if match:
            day = datetime.date(today.year, int(match.group(1)), int(match.group(2)))
            # 12월에 "1/5" 를 물으면 다음 해입니다
            return day.replace(year=today.year + 1) if (today - day).days > 183 else day
    except ValueError as error:
        raise ToolError(f"날짜 '{text}' 가 달력에 없습니다") from error
    key = re.sub(r"(에|날|요|쯤)$", "", re.sub(r"\s+", "", text).lower())
    if key in _RELATIVE:
        return today + datetime.timedelta(days=_RELATIVE[key])
    match = re.fullmatch(r"(이번주|다음주|담주|지난주|저번주)?([월화수목금토일])(?:요일)?", key)
    if match:
        weekday = WEEKDAYS.index(match.group(2))
        if not match.group(1):
            return today + datetime.timedelta(days=(weekday - today.weekday()) % 7)
        monday = today - datetime.timedelta(days=today.weekday())
        shift = {"다음주": 7, "담주": 7, "지난주": -7, "저번주": -7}.get(match.group(1), 0)
        return monday + datetime.timedelta(days=shift + weekday)
    raise ToolError(f"날짜 '{text}' 를 읽지 못했습니다 — YYYY-MM-DD 로 주세요")


def _numbers(value) -> list[int]:
    """교시 목록 — `[3]`·`["3교시"]`·`"3,4"`·`"3~5"` 를 다 받습니다."""
    if value in (None, "", []):
        return []
    out = []
    for item in value if isinstance(value, list) else [value]:
        for first, last, single in re.findall(r"(\d+)\s*[~\-–]\s*(\d+)|(\d+)", str(item)):
            out += list(range(int(first), int(last) + 1)) if first else [int(single)]
    return out


class Context:
    def __init__(self, db: Session, user: models.User) -> None:
        self.db = db
        self.user = user
        self.year, self.semester = resolve_term(db, None, None)
        self.sources: list[dict] = []
        # 이 대화에서 모델에게 보인 사실 — 답의 [F번호] 를 출처로 바꿀 때 씁니다 (agent/chat.py)
        self.facts: dict[int, models.Fact] = {}
        # 확인 단계에서 원문을 연 글 — 답의 [P번호] 를 출처로 바꿀 때 씁니다 (agent/chat.py 의 `verify`)
        self.originals: dict[int, dict] = {}
        # 데스크탑 모델로 묻는 중인가 — 바깥으로 내보내면 안 되는 자료(`archive`)를 가립니다. `chat.run` 이 정합니다
        self.local_model = True
        self.profile = profile_of(db, user.effective_stu_id, user.major)
        # 걸어만 둔 근거 — 답이 그 제목을 말할 때만 남깁니다(`agent/chat.py` 의 `finish_text`). 학사일정 도구가
        # 찾은 일정마다 원문을 걸었더니 "오늘 일정" 답 밑에 답과 상관없는 수강신청·SAT 링크가 붙었습니다
        self.weak: set[str] = set()
        self._classes: list[models.Class] | None = None
        self._mine: list[models.Class] | None = None
        self._names: list[str] | None = None
        self._term: dict | None = None
        self._week_ends: dict[int, datetime.date] = {}

    def cite(self, title: str, url: str, first: bool = False, weak: bool = False) -> None:
        if not url:
            return
        if not weak:
            self.weak.discard(url)
        elif all(s["url"] != url for s in self.sources):
            self.weak.add(url)
        self.sources = [s for s in self.sources if s["url"] != url] if first else self.sources
        if all(s["url"] != url for s in self.sources):
            entry = {"title": title, "url": url}
            if first:
                self.sources.insert(0, entry)
            else:
                self.sources.append(entry)

    def remember(self, facts: list[models.Fact]) -> list[dict]:
        """모델에게 보이는 사실 — 번호(F12)를 붙여 돌려주고, 답에서 그 번호를 찾을 수 있게 기억해 둡니다.

        시스템 프롬프트의 기억 줄(`agent/chat.py` 의 `memory_line`)도 이 항목으로 만듭니다. 출처에 게시판
        (말머리)을 붙이는 건 교무연구부 공지와 동아리 홍보를 모델이 가려 읽게 하려는 것이고, 대상 학년·전공과
        `mine` 은 다른 학년·전공 이야기를 질문자의 것처럼 답하지 않게 하려는 것입니다.
        """
        out = []
        for fact in facts:
            self.facts[fact.id] = fact
            entry = {"id": f"F{fact.id}", "fact": fact.statement,
                     "from": " · ".join(x for x in (fact.posted_on.isoformat() if fact.posted_on else None,
                                                    fact.board, fact.post_title[:60]) if x)}
            target_grades, target_majors = grades(fact.target_grades), majors.split(fact.target_majors)
            if target_grades:
                entry["grades"] = target_grades
            if target_majors:
                entry["majors"] = target_majors
            mine = applies(self.profile, fact.statement, target_grades, target_majors)
            if mine is not None:
                entry["mine"] = mine
            out.append(entry)
        return out

    # ── 날짜 판정 ────────────────────────────────────────────────────────────
    def day(self, day: datetime.date) -> dict:
        status = day_status(self.db, day)
        override = status.override
        return {
            "date": day.isoformat(),
            "weekday": WEEKDAYS[day.weekday()],
            "class_day": status.class_day,
            "no_class_reason": status.off_label,
            "override": f"{override.title} ({override.source_day} 시간표)" if override else None,
        }

    # ── 수업 조회 ────────────────────────────────────────────────────────────
    def _rows(self, *filters):
        return term_slots(self.db, self.year, self.semester, *filters)

    def _student_rows(self, stu_id: str):
        return student_slots(self.db, stu_id, self.year, self.semester)

    @staticmethod
    def _entry(cls: models.Class, time: models.ClassTime) -> dict:
        subject = cls.subject
        return {
            "day": time.day, "period": _period_label(time.period), "p": time.period,
            "subject": subject_label(subject.name, subject.is_ec),
            "section": cls.section, "teacher": cls.teacher, "room": time.room or cls.room,
        }

    def _schedule(self, rows, date: str | None) -> dict:
        entries = sorted((self._entry(c, t) for c, t in rows), key=lambda e: (periods.DAYS.index(e["day"]) if e["day"] in periods.DAYS else 9, e["p"]))
        if not date:
            week = {d: [] for d in periods.DAYS}
            for e in entries:
                if e["day"] in week:
                    week[e["day"]].append({k: v for k, v in e.items() if k not in ("day", "p")})
            return {"week": week}
        info = self.day(_date(date))
        today = [{k: v for k, v in e.items() if k not in ("day", "p")} for e in entries if info["class_day"] and e["day"] == info["class_day"]]
        busy = {e["p"] for e in entries if info["class_day"] and e["day"] == info["class_day"]}
        free = [_period_label(p) for p in ALL_PERIODS if p not in busy] if info["class_day"] else []
        return {**info, "classes": today, "free_periods": free}

    def person(self, who: str) -> dict:
        text = re.sub(r"\s*(선생님|선생|쌤|교수님|학생|님|씨)$", "", str(who or "").strip())
        if _is_me(text):
            stu = self.user.effective_stu_id
            if not stu:
                return {"error": "이 계정에 학번이 연결되어 있지 않습니다"}
            student = self.db.get(models.Student, stu)
            return {"kind": "student", "id": stu, "name": student.name if student else stu}
        # "백재원(25-059)" 처럼 이름과 학번을 같이 넘기기도 합니다
        stu = re.search(r"\d{2}-\d{3}", text)
        if stu:
            text = stu.group(0)
        if re.fullmatch(r"\d{2}-\d{3}", text):
            student = self.db.get(models.Student, text)
            return {"kind": "student", "id": text, "name": student.name} if student else {"error": f"{text} 학생이 없습니다"}
        students = self.db.query(models.Student).filter(models.Student.name == text).all()
        if len(students) == 1:
            return {"kind": "student", "id": students[0].stuId, "name": students[0].name}
        if len(students) > 1:
            return {"error": "같은 이름이 여럿입니다", "candidates": [{"id": s.stuId, "name": s.name} for s in students]}
        teachers = {t for (t,) in self.db.query(models.Class.teacher).filter(
            models.Class.year == self.year, models.Class.semester == self.semester, at_version(models.Class),
            models.Class.teacher.like(f"%{text}%")).distinct()}
        exact = [t for t in teachers if _norm(t) == _norm(text)]
        if len(exact) == 1 or len(teachers) == 1:
            return {"kind": "teacher", "name": (exact or list(teachers))[0]}
        if teachers:
            return {"error": "교사 후보가 여럿입니다", "candidates": sorted(teachers)[:10]}
        partial = self.db.query(models.Student).filter(models.Student.name.like(f"%{text}%")).limit(10).all()
        if partial:
            return {"error": "정확히 일치하는 사람이 없습니다", "candidates": [{"id": s.stuId, "name": s.name} for s in partial]}
        return {"error": f"'{who}' 에 해당하는 학생·교사를 찾지 못했습니다"}

    # ── 과목 ────────────────────────────────────────────────────────────────
    def term_classes(self) -> list[models.Class]:
        """이번 학기 분반 전부 (과목·교육과정까지)."""
        if self._classes is None:
            self._classes = (
                self.db.query(models.Class).join(models.Subject)
                .filter(models.Class.year == self.year, models.Class.semester == self.semester, at_version(models.Class))
                .options(joinedload(models.Class.subject).joinedload(models.Subject.course)).all()
            )
        return self._classes

    def my_classes(self) -> list[models.Class]:
        """질문한 사람이 이번 학기 듣는 분반 — 학번이 없으면 빈 목록."""
        if self._mine is None:
            stu = self.user.effective_stu_id
            rows = self._student_rows(stu) if stu else []
            self._mine = list({cls.id: cls for cls, _time in rows}.values())
        return self._mine

    def match_classes(self, query: str) -> list[models.Class]:
        """이번 학기 분반 중 `query` 로 부른 과목의 것 — 줄임말(`미1`·`일물2`)·영문명도 받고, 가까운 과목부터.

        `(EC)` 를 붙여 물으면 영어강의만 남깁니다. 안 붙이면 둘 다입니다(한국어강의와 영어강의는 다른 과목입니다).
        """
        wants_ec = bool(_EC.search(query or ""))
        by_name: dict[str, list[models.Class]] = {}
        for cls in self.term_classes():
            for name in (cls.subject.name, cls.subject.name_english):
                if name:
                    by_name.setdefault(name, []).append(cls)
        out: list[models.Class] = []
        for name in rank_names(_EC.sub("", query or ""), by_name):
            out += [cls for cls in by_name[name] if cls not in out]
        if wants_ec and any(cls.subject.is_ec for cls in out):
            out = [cls for cls in out if cls.subject.is_ec]
        return out

    def subject_names(self) -> list[str]:
        """아는 과목 이름 전부(교육과정 + 이번 학기 개설, 한글·영문) — 강의계획서를 다른 과목 몫과 가를 때 씁니다."""
        if self._names is None:
            names = [n for row in self.db.query(models.Course.name, models.Course.name_english) for n in row if n]
            names += [n for cls in self.term_classes() for n in (cls.subject.name, cls.subject.name_english) if n]
            self._names = list(dict.fromkeys(names))
        return self._names

    def term_dates(self) -> dict:
        """이번 학기 날짜 — 개학·시험·종업, 그리고 학사일정의 "N주차 종료" 표지로 만든 주차표와 지금 주차.

        강의계획서는 주차로 적혀 있습니다("제17주 기말고사"). 이번 학기 날짜로 옮겨 보려면 이 표가 있어야 합니다.
        """
        if self._term is not None:
            return self._term
        first, last = ((datetime.date(self.year, 2, 1), datetime.date(self.year, 7, 31)) if self.semester == 1
                       else (datetime.date(self.year, 8, 1), datetime.date(self.year + 1, 2, 28)))
        rows = (
            self.db.query(models.CalendarEvent)
            .filter(models.CalendarEvent.owner_id.is_(None), models.CalendarEvent.category.in_(("term", "exam")),
                    models.CalendarEvent.start_date >= first, models.CalendarEvent.start_date <= last)
            .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id).all()
        )
        ends = {int(m.group(1)): row.start_date for row in rows if (m := re.fullmatch(r"(\d+)\s*주차\s*종료", row.title.strip()))}
        self._week_ends = ends

        def week(day: datetime.date) -> str:
            number = next((n for n, end in sorted(ends.items()) if day <= end), None)
            return f" · {number}주차" if number else ""

        today = clock.today()
        self._term = {
            "term": f"{self.year}-{self.semester}",
            "now": f"{today.isoformat()}({WEEKDAYS[today.weekday()]}){week(today)}",
            "dates": [f"{row.title} {_when(row.start_date.isoformat(), row.end_date.isoformat())}{week(row.start_date)}"
                      for row in rows if not re.fullmatch(r"\d+\s*주차\s*종료", row.title.strip())],
        }
        if ends:
            self._term["weeks"] = [f"{n}주차 {(end - datetime.timedelta(days=6)):%m-%d}~{end:%m-%d}"
                                   for n, end in sorted(ends.items())]
        return self._term

    def week_span(self, first: int, last: int | None = None) -> tuple[datetime.date, datetime.date] | None:
        """N주차(또는 N~M주차)의 실제 날짜 — 주차표에 없으면 None."""
        self.term_dates()
        start, end = self._week_ends.get(first), self._week_ends.get(last or first)
        return (start - datetime.timedelta(days=6), end) if start and end else None

    def rooms(self) -> list[str]:
        names = set()
        for cls, time in self._rows():
            if time.room or cls.room:
                names.add(time.room or cls.room)
        return sorted(names)

    def room(self, query: str) -> dict:
        rooms = self.rooms()
        q = _norm(query)
        exact = [r for r in rooms if _norm(r) == q]
        if exact:
            return {"room": exact[0]}
        digits = re.findall(r"\d{3,4}", query or "")
        hits = [r for r in rooms if digits and all(d in r for d in digits)] or [r for r in rooms if q and q in _norm(r)]
        if len(hits) == 1:
            return {"room": hits[0]}
        return {"error": f"'{query}' 강의실을 특정하지 못했습니다", "candidates": hits[:15]}


# ─── 도구 구현 ────────────────────────────────────────────────────────────────
def today_info(ctx: Context) -> dict:
    now = clock.now()
    minute = now.hour * 60 + now.minute
    current = periods.current_period(minute)
    upcoming = periods.next_period(minute)
    return {
        **ctx.day(now.date()), "time": now.strftime("%H:%M"), "term": f"{ctx.year}-{ctx.semester}",
        "current_period": _period_label(current) if current else None,
        "next_period": _period_label(upcoming[0]) if upcoming else None,
        "break": periods.current_break(minute),
        "periods": [_period_label(p) for p in ALL_PERIODS],
        "me": ctx.profile,
    }


def find_person(ctx: Context, query: str) -> dict:
    text = (query or "").strip()
    if len(text) < 1:
        return {"students": [], "teachers": []}
    students = ctx.db.query(models.Student).filter(
        or_(models.Student.name.like(f"%{text}%"), models.Student.stuId.like(f"%{text}%"))).limit(15).all()
    teachers = sorted({t for (t,) in ctx.db.query(models.Class.teacher).filter(
        models.Class.year == ctx.year, models.Class.semester == ctx.semester, at_version(models.Class),
        models.Class.teacher.like(f"%{text}%")).distinct() if t})[:15]
    out = {"students": [{"id": s.stuId, "name": s.name} for s in students], "teachers": teachers}
    if not students and not teachers:
        # "자구 선생님 누구야?" 에 모델이 과목 줄임말을 사람으로 찾았습니다 — 과목이면 담당 교사를 붙여 줍니다
        subject = re.sub(r"\s*(선생님|선생|쌤)$", "", text)
        subjects: dict[str, set[str]] = {}
        for cls in ctx.match_classes(subject):
            subjects.setdefault(subject_label(cls.subject.name, cls.subject.is_ec), set()).add(cls.teacher or "")
        if subjects:
            out["subjects"] = [{"subject": name, "teachers": sorted(t for t in names if t)}
                               for name, names in list(subjects.items())[:5]]
            out["note"] = "사람이 아니라 과목 이름이라 그 과목의 담당 교사를 붙였습니다"
        elif courses := _courses(ctx, subject):
            out["note"] = f"사람이 아니라 과목 이름({courses[0].name})인데, 이번 학기에는 개설되지 않았습니다"
    return out


def timetable(ctx: Context, person: str = "me", date: str | None = None) -> dict:
    who = ctx.person(person)
    if "error" in who:
        return who
    if who["kind"] == "student":
        rows = ctx._student_rows(who["id"])
    else:
        rows = ctx._rows(models.Class.teacher == who["name"])
    return {"person": who, **ctx._schedule(rows, date)}


def room_schedule(ctx: Context, room: str, date: str | None = None) -> dict:
    found = ctx.room(room)
    if "error" in found:
        return found
    name = found["room"]
    rows = ctx._rows(or_(models.ClassTime.room == name, (models.ClassTime.room.is_(None)) & (models.Class.room == name)))
    return {"room": name, **ctx._schedule(rows, date)}


def empty_rooms(ctx: Context, date: str | None = None, periods_: list[int] | None = None, building: str | None = None) -> dict:
    info = ctx.day(_date(date))
    if not info["class_day"]:
        return {**info, "note": "수업이 없는 날이라 모든 강의실이 비어 있습니다"}
    wanted = [p for p in (_numbers(periods_) or ALL_PERIODS[:9]) if p in PERIOD_TIME]
    rooms = [r for r in ctx.rooms() if CLASSROOM.match(r) and (not building or r.startswith(building[:1]))]
    busy: dict[int, set[str]] = {p: set() for p in wanted}
    for cls, time in ctx._rows(models.ClassTime.day == info["class_day"]):
        if time.period in busy:
            busy[time.period].add(time.room or cls.room)
    return {**info, "empty": {_period_label(p): [r for r in rooms if r not in busy[p]] for p in wanted}}


def common_free(ctx: Context, people: list[str] | str, date: str | None = None) -> dict:
    if isinstance(people, str):  # "me, 25-106" 처럼 한 줄로 넘기기도 합니다
        people = [p.strip() for p in re.split(r"[,·/]|\s+및\s+", people) if p.strip()]
    resolved, slots = [], None
    info = ctx.day(_date(date)) if date else None
    for name in people or ["me"]:
        who = ctx.person(name)
        if "error" in who:
            return {"error": f"{name}: {who['error']}", "candidates": who.get("candidates")}
        rows = ctx._student_rows(who["id"]) if who["kind"] == "student" else ctx._rows(models.Class.teacher == who["name"])
        busy = {(t.day, t.period) for _c, t in rows}
        days = [info["class_day"]] if info and info["class_day"] else ([] if info else list(periods.DAYS))
        free = {(d, p) for d in days for p in ALL_PERIODS if (d, p) not in busy}
        slots = free if slots is None else slots & free
        resolved.append(who)
    by_day: dict[str, list[str]] = {}
    for d, p in sorted(slots or [], key=lambda s: (periods.DAYS.index(s[0]), s[1])):
        by_day.setdefault(d, []).append(_period_label(p))
    return {"people": resolved, **(info or {}), "common_free": by_day}


def class_info(ctx: Context, subject: str, section: str | None = None) -> dict:
    hits = ctx.match_classes(subject)
    note = None
    if not hits:
        # "김효진 선생님 화요일 수업" 에 모델이 교사 이름을 과목 칸에 넣었습니다 — 교사면 그 교사의 분반을 줍니다
        who = ctx.person(subject)
        if who.get("kind") == "teacher":
            hits = [cls for cls in ctx.term_classes() if cls.teacher == who["name"]]
            note = f"'{subject}' 는 과목이 아니라 교사라서 그 교사의 이번 학기 분반입니다"
    if section:
        num = re.search(r"\d+", str(section))
        hits = [c for c in hits if num and section_num(c.section) == int(num[0])]
    if not hits:
        return {"error": f"'{subject}' 과목을 이번 학기에서 찾지 못했습니다"}
    order = {name: i for i, name in enumerate(dict.fromkeys(c.subject.name for c in hits))}
    mine = {cls.id for cls in ctx.my_classes()}
    out = []
    for cls in sorted(hits, key=lambda c: (order[c.subject.name], c.subject.is_ec, section_num(c.section))):
        members = [e.stuId for e in cls.enrollments]
        entry = {
            "subject": subject_label(cls.subject.name, cls.subject.is_ec),
            "section": cls.section, "teacher": cls.teacher,
            "times": [f"{WEEKDAYS[periods.DAYS.index(t.day)]} {_period_label(t.period)} {t.room or cls.room}"
                      for t in sorted(cls.times, key=lambda t: (periods.DAYS.index(t.day), t.period))],
            "students": len(members),
        }
        if cls.id in mine:
            entry["mine"] = True
        if len(hits) == 1 or section:
            names = dict(ctx.db.query(models.Student.stuId, models.Student.name).filter(models.Student.stuId.in_(members)))
            entry["roster"] = [f"{s} {names.get(s, '')}".strip() for s in sorted(members)]
        out.append(entry)
    result = {"term": f"{ctx.year}-{ctx.semester}", "classes": out[:20]}
    return {**result, "note": note} if note else result


def _events(ctx: Context, first: datetime.date, last: datetime.date) -> list[models.CalendarEvent]:
    return (
        ctx.db.query(models.CalendarEvent)
        .filter(models.CalendarEvent.start_date <= last, models.CalendarEvent.end_date >= first,
                visible_to(ctx.user))
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id).all()
    )


def _event_matches(row: models.CalendarEvent, words: list[str]) -> bool:
    """검색어가 제목·메모·대상 전공에 들었거나, 제목이 검색어 안에 든 일정 — "종업식" 으로 "종업" 을 찾습니다.

    대상 전공·학부 이름도 봅니다 — "정보과학 일정" 을 물으면 제목이 "수학 모의면접" 이어도 걸려야 합니다.
    """
    text = _norm(" ".join([row.title, row.note or "", *majors.with_divisions(majors.split(row.target_majors))]))
    core = _norm(re.sub(r"\([^)]*\)", "", row.title))
    return any(w in text or (len(core) >= 2 and core in w) for w in words)


def calendar(ctx: Context, start: str | None = None, end: str | None = None, query: str | None = None) -> dict:
    first = _date(start)
    # "앞으로 뭐 남았어?" 에 30일로 끊었더니 한 달 하고 이틀 뒤의 R&E 최종보고서 마감이 빠졌습니다
    last = _date(end) if end else first + datetime.timedelta(days=60)
    if last < first:
        first, last = last, first
    rows = _events(ctx, first, last)
    words = [w for w in query_terms(query or "") if w not in _GENERIC]
    hint = None
    if words:
        matched = [r for r in rows if _event_matches(r, words)]
        if not matched and not end:
            # 기간을 안 줬으면 1년 앞까지, 그래도 없으면 지난 반년에서 찾습니다 — "이번 학기 종업식 언제야?" 에 개학
            # 무렵부터 60일만 보고 12월의 종업을 놓쳐 "등록되어 있지 않습니다" 라고 답했습니다
            later = first + datetime.timedelta(days=365)
            matched = [r for r in _events(ctx, first, later) if _event_matches(r, words)]
            if matched:
                last = later
            else:
                earlier = first - datetime.timedelta(days=183)
                matched = [r for r in _events(ctx, earlier, first) if _event_matches(r, words)]
                if matched:
                    first, hint = earlier, "앞으로는 없고 이미 지난 일정입니다"
        if matched or not rows:
            rows = matched
        else:
            # 걸린 게 없으면 기간 안의 일정을 그대로 줍니다 — 빈 목록을 받은 모델은 "일정이 없다" 고 답합니다
            hint = f"'{query}' 에 맞는 일정은 없습니다. 아래는 이 기간의 일정 전부입니다"
    events = []
    for row in rows[:60]:
        out = event_out(row)
        clock = out["time_mode"] == "clock" and out["start_minute"] is not None
        out["when"] = _when(out["start_date"], out["end_date"],
                            periods.hhmm(out["start_minute"]) if clock else None,
                            periods.hhmm(out["end_minute"]) if clock and out["end_minute"] is not None else None)
        mine = applies(ctx.profile, row.title, out["target_grades"], out["target_majors"])
        if mine is not None:
            out["mine"] = mine
        url = re.search(r"https://ksain\.kr/document/\d+", row.note or "")
        if url:
            ctx.cite(row.title, url.group(0), weak=True)
        events.append({k: v for k, v in out.items() if v not in (None, [], "") and k not in (
            "id", "series_id", "start_minute", "end_minute", "start_date", "end_date", "time_mode",
            "start_period", "end_period")})
    result = {"from": first.isoformat(), "to": last.isoformat(), "events": events}
    return {**result, "hint": hint} if hint else result


def ksain_events(ctx: Context, query: str, limit: int = 4) -> list[dict]:
    """일정 요약 — 질문 낱말에 맞는, ksain 글에서 자동으로 넣은 공용 일정과 그 글 번호(지난 반년 ~ 1년 뒤).

    `agent/chat.py` 의 확인 단계가 기억과 함께 "출처 글" 을 고르는 데 씁니다. 자동 일정은 분석 모델이 글을 읽고
    만든 요약이라 날짜·대상을 잘못 옮길 수 있어서, 답하기 전에 원문을 엽니다. 낱말이 없으면 고르지 않습니다 —
    "이번 주 일정" 에 몇 달 치 공지를 다 열 이유가 없습니다.
    """
    words = [w for w in query_terms(query) if w not in _GENERIC]
    if not words:
        return []
    today = clock.today()
    out = []
    for row in _events(ctx, today - datetime.timedelta(days=183), today + datetime.timedelta(days=365)):
        url = re.search(r"https://ksain\.kr/document/(\d+)", row.note or "")
        if row.owner_id is not None or not url or not _event_matches(row, words):
            continue
        event = event_out(row)
        timed = event["time_mode"] == "clock" and event["start_minute"] is not None
        out.append((row.end_date < today, {"title": row.title, "post_id": int(url.group(1)), "when": _when(
            event["start_date"], event["end_date"], periods.hhmm(event["start_minute"]) if timed else None,
            periods.hhmm(event["end_minute"]) if timed and event["end_minute"] is not None else None)}))
    # 아직 안 끝난 것부터 — 지난 일정은 뒤로 (sort 는 안정적이라 그 안에서는 날짜순 그대로)
    out.sort(key=lambda pair: pair[0])
    return [entry for _past, entry in out[:limit]]


def today_events(ctx: Context) -> list[str]:
    """오늘 걸친 공용 학사일정 한 줄씩 — 시스템 프롬프트에 처음부터 싣습니다(`agent/chat.py`).

    "오늘 뭐 있어?" 가 가장 흔한 질문인데, 모델이 도구를 엉뚱하게 부르면 확인할 길이 없었습니다 — 체육대회 날
    `calendar(query="일정")` 이 "KSA 한마당체육대회" 를 걸러 내고 "특별한 일정은 없습니다" 라고 답했습니다.
    홈 화면이 오늘 일정을 늘 보여 주는 것과 같은 이유로, 몇 줄 안 되는 오늘 것은 묻기 전에 줍니다.

    ⚠️ **개인 일정은 건수만** 싣습니다. 질문과 상관없이 매번 실리는 자리라, 제목을 넣으면 이용자가 OpenAI 를
    고른 날 묻지도 않은 개인 일정이 바깥으로 나갑니다. 내용은 물으면 `calendar` 가 줍니다.
    """
    today = clock.today()
    rows = (
        ctx.db.query(models.CalendarEvent)
        .filter(models.CalendarEvent.start_date <= today, models.CalendarEvent.end_date >= today,
                visible_to(ctx.user))
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id).all()
    )
    personal = sum(1 for row in rows if row.owner_id is not None)
    rows = [row for row in rows if row.owner_id is None]
    # 짧은 것부터 — 몇 달짜리("교직원 건강검진(~11.30)")가 맨 앞에 서면 오늘만의 일정(체육대회)이 묻힙니다
    rows.sort(key=lambda row: (row.end_date - row.start_date, row.start_date))
    lines = [f"질문자의 개인 일정 {personal}건 — 내용은 물으면 calendar 로 확인한다"] if personal else []
    for row in rows[:12]:
        out = event_out(row)
        timed = out["time_mode"] == "clock" and out["start_minute"] is not None
        when = _when(out["start_date"], out["end_date"],
                     periods.hhmm(out["start_minute"]) if timed else None,
                     periods.hhmm(out["end_minute"]) if timed and out["end_minute"] is not None else None)
        target = [f"{'·'.join(map(str, out['target_grades']))}학년"] if out["target_grades"] else []
        target += ["·".join(out["target_majors"])] if out["target_majors"] else []
        parts = [when, "대상 " + " · ".join(target) if target else None,
                 "질문자 해당 아님" if applies(ctx.profile, row.title, out["target_grades"], out["target_majors"]) is False
                 else None]
        lines.append(f"{row.title} ({' / '.join(p for p in parts if p)})")
    return lines


def my_exams(ctx: Context) -> dict:
    return exams_for(ctx.db, ctx.user)


async def meal(ctx: Context, date: str | None = None) -> dict:
    day = _date(date)
    return {"date": day.isoformat(), "weekday": WEEKDAYS[day.weekday()], "menu": await fetch_meal(ctx.db, day)}


def _courses(ctx: Context, name: str) -> list[models.Course]:
    """교육과정 과목 중 `name` 으로 부른 것 — 줄임말(미방·선대)·영문명도, 가까운 순(services/subject_names.py)."""
    by_name: dict[str, list[models.Course]] = {}
    for course in ctx.db.query(models.Course).options(joinedload(models.Course.department)):
        for label in (course.name, course.name_english):
            if label:
                by_name.setdefault(label, []).append(course)
    courses: list[models.Course] = []
    for label in rank_names(_EC.sub("", name or ""), by_name):
        courses += [c for c in by_name[label] if c not in courses]
    return courses


def course_info(ctx: Context, name: str) -> dict:
    courses = _courses(ctx, name)
    if not courses:
        return {"error": f"'{name}' 교육과정 과목을 찾지 못했습니다"}
    names = dict(ctx.db.query(models.Course.id, models.Course.name))
    out = []
    for course in courses[:5]:
        prereqs = ctx.db.query(models.CoursePrereq).filter(models.CoursePrereq.after_id == course.id).all()
        sections = course.description_sections or {}
        description = course.description or " ".join(str(v) for v in sections.values())
        out.append({
            "name": course.name, "department": course.department.name if course.department else None,
            "credits": course.credits, "pass_fail": course.is_pf, "recommended_semester": course.recommended_semester,
            "prerequisites": [names.get(p.before_id) for p in prereqs],
            "description": (description or "")[:700],
        })
    return {"courses": out}


def search(ctx: Context, query: str, since: str | None = None, until: str | None = None, board: str | None = None) -> dict:
    """학교 자료 — 정리해 둔 사실(기억)과 ksain 글(근거 발췌 포함)을 함께."""
    facts = memory.find(ctx.db, query, grade=ctx.profile["grade"] if ctx.profile else None,
                        major=ctx.profile["major"] if ctx.profile else None, limit=5)
    with db_session(KsainSession) as db:
        posts = knowledge.search(db, query, since=_date(since) if since else None,
                                 until=_date(until) if until else None, board=board)
    for post in posts:
        post["items"] = _items(post["items"], ctx.profile)
    for post in posts[:5]:
        ctx.cite(post["title"], post["url"])
    return {"query": query, "facts": ctx.remember(facts), "posts": posts}


def read_ksain(ctx: Context, post_id: int | str) -> dict:
    number = re.search(r"\d+", str(post_id or ""))  # "#3092"·"3092번" 으로도 옵니다
    if not number:
        raise ToolError("글 번호(post_id)를 숫자로 주세요")
    post_id = int(number.group(0))
    with db_session(KsainSession) as db:
        post = knowledge.read(db, post_id)
    if post is None:
        return {"error": f"{post_id}번 글이 없습니다"}
    post["items"] = _items(post["items"], ctx.profile)
    # 이 글에서 정리해 둔 사실 — 사람이 고친 문장이 있으면 그쪽이 더 정확합니다
    post["facts"] = ctx.remember(memory.by_post(ctx.db, post_id))
    ctx.cite(post["title"], post["url"])
    return post


def ksain_digest(ctx: Context, start: str | None = None, end: str | None = None, min_importance: int = 2) -> dict:
    first = _date(start)
    # end 를 빼먹고 "이번 주" 를 start 만으로 묻는 일이 잦습니다 — 비우면 오늘까지로 잡습니다
    last = _date(end) if end else max(first, clock.today())
    try:
        level = max(0, min(3, int(min_importance)))
    except (TypeError, ValueError):
        level = 2
    with db_session(KsainSession) as db:
        out = knowledge.digest(db, first, last, level)
    for post in out["posted"]:
        post["items"] = _items(post["items"], ctx.profile)
    out["dated_items"] = _items(out["dated_items"], ctx.profile)
    # 근거는 일정이 실린 글부터 — 질문자에게 해당하는 것 먼저. 기간 안의 중요 공지를 먼저 걸었더니
    # "내 필참교육" 답에 수강신청 OT 공지 대신 SAT·채점 공지가 붙었습니다
    ranked = sorted(out["dated_items"], key=lambda item: item.get("mine") is not True)
    for item in ranked:
        if item.get("url"):
            ctx.cite(item.get("post_title") or item["title"], item["url"])
    for post in out["posted"][:2]:
        ctx.cite(post["title"], post["url"])
    ctx.sources = ctx.sources[:4]
    return {"from": first.isoformat(), "to": last.isoformat(), **out}


def archive(ctx: Context, query: str | None = None, subject: str | None = None) -> dict:
    """멘토링 아카이브 — 그 과목에 어떤 자료가 있는지와 질문에 맞는 대목. 데스크탑 모델로 물을 때만 씁니다.

    ⚠️ 아카이브는 본인 학업·교내 멘토링 밖으로의 유출을 금합니다("당부의 말씀"). 이용자가 OpenAI 를 고르면 글이 바깥으로
    나가므로 막습니다 — `chat.py` 가 명세에서도 뺍니다. 링크는 Drive 권한이 있는 사람만 열립니다.
    """
    if not ctx.local_model:
        return {"error": "멘토링 아카이브는 데스크탑 모델에서만 읽습니다 — 모델을 바꿔 달라고 안내한다"}
    if not query and not subject:
        raise ToolError("찾을 내용(query)이나 과목(subject)을 주세요")
    found = memory_archive.search(query, subject)
    if found is None:
        return {"error": "멘토링 아카이브 색인이 아직 없습니다"}
    if subject and found["course"] is None:
        return {"error": f"'{subject}' 과목의 자료를 멘토링 아카이브에서 찾지 못했습니다"}
    # 답이 그 묶음을 말했을 때만 링크로 남습니다(`chat._named`) — "법과학 모의고사" 답 밑에 정리 묶음이 따라붙었습니다
    for item in found["results"]:
        ctx.cite(f"멘토링 아카이브 · {item.get('title', '')}", item.get("url", ""), weak=True)
    found["caution"] = "학생들이 만든 비공식 자료다. 그렇다고 밝히고, 연도가 오래됐으면 연도도 밝힌다. 공식 일정·범위는 syllabus·calendar 로 확인한다"
    return found


# 강의계획서 본문을 얼마나 싣는가 — 결과 전체가 MAX_TOOL_CHARS(9,000자, agent/chat.py)에 들어가야 합니다
SYLLABUS_CHARS = 6000
SYLLABUS_EACH = 600  # 내 과목 전부일 때 과목 하나에
SYLLABUS_ALL = 7500  # 내 과목 전부일 때 평가표·대목을 다 합쳐서 (주차표 몫을 남깁니다)
# 근거 링크 — 파일은 로그인 헤더가 있어야 받으므로 앱 화면으로 겁니다(frontend 의 `/syllabus/:id`)
SYLLABUS_URL = "https://classes.bsiku.dev/syllabus/{}"
_MONTHS = {m: i for i, m in enumerate(("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
_DAY_NUMBER = re.compile(r"(?<!\d)(\d{1,2})\s*(?:월|\.|/)\s*(\d{1,2})(?!\d)")
_DAY_ENGLISH = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})(?:\s*[~–-]\s*(\d{1,2}))?", re.I)


def _syllabus_days(text: str, year: int, semester: int) -> tuple[datetime.date, datetime.date] | None:
    """계획서에 적힌 날짜("10.12.~10.16." · "10월 17일" · "June 15–19") → `(첫날, 끝날)`. 2학기의 1·2월은 다음 해입니다."""
    def day(month: int, number: int) -> datetime.date | None:
        try:
            return datetime.date(year + (1 if semester == 2 and month <= 2 else 0), month, number)
        except ValueError:
            return None

    english = _DAY_ENGLISH.search(text or "")
    if english:
        month = _MONTHS[english.group(1).lower()]
        start = day(month, int(english.group(2)))
        end = day(month, int(english.group(3))) if english.group(3) else start
    else:
        days = [d for d in (day(int(m), int(n)) for m, n in _DAY_NUMBER.findall(text or "")) if d]
        start, end = (days[0], days[-1]) if days else (None, None)
    return (start, end) if start and end and start <= end else None


def _schedule_item(ctx: Context, item: dict, current: bool) -> dict:
    """평가 일정 하나 — 언제인지·지났는지는 코드가 셉니다(12B 모델은 날짜 셈을 틀립니다).

    이번 학기 계획서만 적힌 날짜를 믿습니다. 지난 학기 계획서의 "10.12." 는 올해 날짜가 아니라서 그대로 적어만
    두고, 주차만 이번 학기 주차표로 옮깁니다 — 답에서 밝히라는 건 `caution` 이 시킵니다.
    """
    out = {"what": item.get("what", "")}
    numbers = [int(n) for n in re.findall(r"\d+", item.get("week") or "")][:2]
    span = ctx.week_span(*numbers) if numbers else None
    label = f"{'~'.join(map(str, numbers))}주차" if numbers else ""
    dated = _syllabus_days(item.get("date", ""), ctx.year, ctx.semester) if current else None
    if dated:
        out["when"] = _when(dated[0].isoformat(), dated[1].isoformat()) + (f" · {label}" if label else "")
    elif span:
        out["when"] = f"{label}({span[0]:%m-%d}~{span[1]:%m-%d})"
    elif label or item.get("date"):
        out["when"] = label or f"계획서 표기 {item['date']}"
    if not current and item.get("date"):
        out["written_date"] = item["date"]
    period = dated or span
    if current and period:
        today = clock.today()
        monday = today - datetime.timedelta(days=today.weekday())
        out["status"] = ("지남" if period[1] < today
                         else "이번 주" if period[0] <= monday + datetime.timedelta(days=6)
                         else "앞으로")
    if item.get("scope"):
        out["scope"] = item["scope"]
    if item.get("quote"):
        out["quote"] = item["quote"][:100]
    return out


def _assessment(ctx: Context, entry: dict) -> dict | None:
    """미리 뽑아 둔 평가표(`cli/index_syllabi.py`)를 모델에게 보일 꼴로. 아직 안 읽은 파일이면 None."""
    row = syllabi.assessment(entry)
    if not row or not (row.get("grading") or row.get("schedule") or row.get("policies")):
        return None
    current = entry["term"] == f"{ctx.year}-{ctx.semester}"
    return {
        "grading": [{"item": g.get("item"), "weight": g.get("weight"), "quote": (g.get("quote") or "")[:100]}
                    for g in row.get("grading", [])[:12]],
        "schedule": [_schedule_item(ctx, s, current) for s in row.get("schedule", [])[:20]],
        "policies": [p.get("rule") for p in row.get("policies", [])[:6]],
    }


def _assessment_brief(full: dict) -> dict:
    """내 과목 전부일 때 — 한 줄씩. 지난 일정은 앞으로 올 게 있으면 뺍니다."""
    def line(item: dict) -> str:
        parts = [item.get("when"), item.get("status"), f"범위 {item['scope']}" if item.get("scope") else None]
        return f"{item['what']} — " + " · ".join(p for p in parts if p)

    ahead = [s for s in full["schedule"] if s.get("status") != "지남"]
    return {"grading": " · ".join(f"{g['item']} {g['weight']}" for g in full["grading"]),
            "schedule": [line(s) for s in (ahead or full["schedule"])[:6]]}


def _cite_syllabus(ctx: Context, subject: str, entry: dict, weak: bool = False) -> None:
    ctx.cite(f"{subject} 강의계획서 ({entry['term'] or '학기 표기 없음'})", SYLLABUS_URL.format(entry["id"]), weak=weak)


def _syllabus_names(subject: models.Subject) -> list[str]:
    course = subject.course
    return syllabi.names_for(subject.name, subject.name_english,
                             course.name if course else None, course.name_english if course else None)


def _rivals(ctx: Context, course: models.Course | None) -> list[str]:
    """강의계획서를 다툴 다른 과목 이름 — 같은 과목의 교육과정 이름은 뺍니다. 안 빼면 제목이 "수학특강" 뿐인
    해석학 계획서를 "수학특강(해석학)" 이 교육과정 이름 "수학특강" 에 빼앗깁니다."""
    own = {course.name, course.name_english} if course else set()
    return [name for name in ctx.subject_names() if name not in own]


def _syllabus_target(ctx: Context, subject: str) -> dict:
    """`syllabus` 가 찾을 과목 — 이번 학기 개설 과목에서 먼저, 없으면 교육과정에서.

    질문자가 듣는 분반이 있으면 그 교사·영어강의 여부로 계획서를 고릅니다(같은 과목이라도 교사마다 계획서가 따로 있습니다).
    """
    classes = ctx.match_classes(subject)
    if classes:
        top = [cls for cls in classes if cls.subject.name == classes[0].subject.name]
        mine = {cls.id for cls in ctx.my_classes()}
        own = next((cls for cls in top if cls.id in mine), None)
        pick = own or top[0]
        ec = pick.subject.is_ec if own or _EC.search(subject or "") else None
        return {
            "subject": subject_label(pick.subject.name, pick.subject.is_ec) if ec is not None else pick.subject.name,
            "names": _syllabus_names(pick.subject), "teacher": own.teacher if own else None, "ec": ec,
            "mine": {"section": own.section, "teacher": own.teacher} if own else None,
            "teachers": sorted({cls.teacher for cls in top if cls.teacher}), "rivals": _rivals(ctx, pick.subject.course),
        }
    courses = _courses(ctx, subject)
    if not courses:
        return {"error": f"'{subject}' 과목을 찾지 못했습니다"}
    course = courses[0]
    return {"subject": course.name, "names": syllabi.names_for(course.name, course.name_english),
            "teacher": None, "ec": None, "mine": None, "teachers": [], "rivals": _rivals(ctx, course)}


async def syllabus(ctx: Context, subject: str | None = None, query: str | None = None) -> dict:
    """강의계획서 — 평가 방법·주차별 진도·시험 범위. `subject` 를 비우거나 'me' 면 질문자의 이번 학기 과목 전부.

    파일 읽기는 스레드에서 합니다 — 처음 한 번은 목록을 만드느라 몇 초 걸리고, 그동안 다른 요청을 막으면 안 됩니다.
    """
    if _is_me(subject):
        return await _my_syllabi(ctx, query)
    target = _syllabus_target(ctx, subject)
    if "error" in target:
        return target
    found = await asyncio.to_thread(syllabi.matching, target["names"], target["teacher"], target["ec"],
                                    target["rivals"])
    if not found:
        return {"error": f"'{target['subject']}' 강의계획서 파일이 없습니다 — 담당 선생님이나 학교 공지로 확인하라고 안내한다"}
    best = found[0]
    body = await asyncio.to_thread(syllabi.text, best)
    term = f"{ctx.year}-{ctx.semester}"
    out = {"subject": target["subject"], "syllabus": {"file": best["name"], "term": best["term"] or "학기 표기 없음"}}
    if target["mine"]:
        out["mine"] = target["mine"]
    if target["teachers"]:
        out["teachers_this_term"] = target["teachers"]
    if best["term"] != term:
        out["caution"] = (f"이번 학기({term}) 계획서가 아니라 {best['term'] or '학기를 알 수 없는'} 계획서다. 범위·주차·"
                          "날짜가 이번 학기와 다를 수 있다고 답에 밝힌다")
    out["this_term"] = ctx.term_dates()
    assessment = _assessment(ctx, best)
    budget = SYLLABUS_CHARS
    if assessment:
        out["assessment"] = assessment
        # 결과 전체가 MAX_TOOL_CHARS 에 들어가게 — 평가표가 큰 만큼 본문을 덜 싣습니다
        budget = max(1500, SYLLABUS_CHARS - len(json.dumps(assessment, ensure_ascii=False)))
    out["text"] = syllabi.excerpt(body, query, budget)
    _cite_syllabus(ctx, target["subject"], best)
    others = [e for e in found[1:] if e["fit"] == best["fit"] and e["name"] != best["name"]]
    if others:
        out["other_files"] = [f"{e['name']} ({e['term'] or '학기 표기 없음'})" for e in others[:3]]
    return out


async def _my_syllabi(ctx: Context, query: str | None) -> dict:
    """질문자의 이번 학기 과목마다 계획서에서 질문에 맞는 대목 — "내 과목들 기말고사 범위 정리해줘"."""
    targets: list[dict] = []
    for cls in ctx.my_classes():
        label = subject_label(cls.subject.name, cls.subject.is_ec)
        if all(t["subject"] != label for t in targets):
            targets.append({"subject": label, "names": _syllabus_names(cls.subject), "teacher": cls.teacher,
                            "ec": cls.subject.is_ec, "rivals": _rivals(ctx, cls.subject.course)})
    if not targets:
        return {"error": "이번 학기 수업이 없습니다 — 학번을 연결하지 않은 계정이면 내 과목을 알 수 없습니다"}

    each = SYLLABUS_ALL // len(targets)

    def read() -> list[dict]:
        out = []
        for target in targets:
            found = syllabi.matching(target["names"], target["teacher"], target["ec"], target["rivals"])
            if not found:
                out.append({"subject": target["subject"], "syllabus": None})
                continue
            best = found[0]
            row = {"subject": target["subject"], "syllabus": f"{best['name']} ({best['term'] or '학기 표기 없음'})"}
            full = _assessment(ctx, best)
            if full:
                row["assessment"] = _assessment_brief(full)
            # 평가표가 있으면 대목은 남는 자리만큼 — 평가표에 없는 것(교재·진도)을 물을 수 있어서 아주 빼지는 않습니다
            room = min(SYLLABUS_EACH, each - len(json.dumps(row, ensure_ascii=False)))
            if room >= 120:
                row["excerpt"] = syllabi.excerpt(syllabi.text(best), query, room, header=0)
            # 내 과목 전부를 읽어도 답이 그 과목을 말했을 때만 링크로 남습니다 — "다음 시험" 답 밑에 생활음악이 붙었습니다
            _cite_syllabus(ctx, target["subject"], best, weak=True)
            out.append(row)
        return out

    return {"this_term": ctx.term_dates(), "subjects": await asyncio.to_thread(read),
            "caution": f"계획서마다 학기가 다르다 — 이번 학기({ctx.year}-{ctx.semester}) 것이 아니면 그렇다고 밝힌다"}


# ─── 모델에 보여 줄 명세 ─────────────────────────────────────────────────────
def _fn(name: str, description: str, properties: dict | None = None, required: list[str] | None = None) -> dict:
    return {"type": "function", "function": {"name": name, "description": description, "parameters": {
        "type": "object", "properties": properties or {}, "required": required or []}}}


DATE = {"type": "string", "description": "YYYY-MM-DD. 비우면 오늘"}
TOOLS = [
    _fn("today_info", "오늘 날짜·요일·지금 교시·학기·수업 있는 날인지·교시 시각표"),
    _fn("timetable", "한 사람(학생 또는 교사)의 시간표. date 를 주면 그날 수업과 빈 교시, 없으면 한 주 전체",
        {"person": {"type": "string", "description": "'me'(질문한 사람), 학번(25-059), 학생 이름, 교사 이름"}, "date": DATE}),
    _fn("room_schedule", "강의실 하나의 사용 현황. date 를 주면 그날 교시별 수업과 빈 교시",
        {"room": {"type": "string", "description": "예: 형3404, 3404"}, "date": DATE}, ["room"]),
    _fn("empty_rooms", "특정 날짜·교시에 비어 있는 강의실 목록",
        {"date": DATE, "periods": {"type": "array", "items": {"type": "integer"}, "description": "교시 번호들. 비우면 1~9교시"},
         "building": {"type": "string", "description": "건물 머리글자: 형·탐·예·창"}}),
    _fn("common_free", "여러 사람이 함께 비는 교시 (공강 맞추기)",
        {"people": {"type": "array", "items": {"type": "string"}, "description": "'me', 학번, 이름"}, "date": DATE}, ["people"]),
    _fn("class_info", "과목의 분반·담당 교사·시간·강의실·수강 인원(질문자 분반에는 mine). 분반을 주면 수강생 명단까지",
        {"subject": {"type": "string", "description": "과목 이름. 줄임말(미1, 일물2)도 된다"},
         "section": {"type": "string", "description": "예: 3분반"}}, ["subject"]),
    _fn("find_person", "이름 일부나 학번으로 학생·교사 후보 찾기", {"query": {"type": "string"}}, ["query"]),
    _fn("calendar", "학사일정과 내 개인 일정. 시험·행사·귀가·마감 등",
        {"start": DATE, "end": {"type": "string", "description": "YYYY-MM-DD. 비우면 start 부터 60일. 하루만 보려면 start 와 같은 날"},
         "query": {"type": "string", "description": "찾는 일정의 이름(예: 기말고사, 귀가). 기간 안의 일정을 다 보려면 비운다"}}),
    _fn("my_exams", "질문한 사람의 이번 학기 시험 시간표 (과목·날짜·시각·시험실)"),
    _fn("meal", "급식 메뉴 (아침·점심·저녁)", {"date": DATE}),
    _fn("course_info", "교육과정 과목 정보 — 학점·선수과목·설명. 평가 방법·시험 범위·진도는 syllabus",
        {"name": {"type": "string", "description": "과목 이름. 줄임말(선대, 미방)도 된다"}}, ["name"]),
    _fn("syllabus", "강의계획서 — 평가 방법·비율, 주차별 진도, 시험 범위, 과제·교재. 이번 학기 개학·시험 날짜와 주차표도 같이 준다",
        {"subject": {"type": "string", "description": "과목 이름(줄임말 가능: 미1, 선대). 'me' 면 질문한 사람의 이번 학기 과목 전부"},
         "query": {"type": "string", "description": "찾을 내용 (예: 기말고사 범위, 평가 비율, 과제)"}}),
    _fn("search", "학교 자료 검색 — 정리해 둔 사실(기억)과 ksain(학교 커뮤니티) 게시글을 같이 찾고, 글마다 "
                  "질문에 맞는 근거 발췌(passages)를 줍니다. 공지·마감·행사·모집·규칙·방법을 찾을 때",
        {"query": {"type": "string", "description": "핵심 키워드 (예: R&E 최종 보고서 제출)"},
         "since": {"type": "string", "description": "이 날짜 이후 글만 (YYYY-MM-DD)"},
         "until": {"type": "string", "description": "이 날짜 이전 글만"},
         "board": {"type": "string", "description": "게시판 이름 일부 (예: 공지사항)"}}, ["query"]),
    _fn("read_ksain", "ksain 글 하나의 본문과 첨부 내용", {"post_id": {"type": "integer"}}, ["post_id"]),
    _fn("ksain_digest", "기간 안에 올라온 중요한 ksain 공지와 그 기간에 걸린 필참 교육·마감",
        {"start": DATE, "end": {"type": "string", "description": "YYYY-MM-DD. 비우면 오늘까지"},
         "min_importance": {"type": "integer", "description": "0~3, 기본 2"}}),
    _fn("archive", "멘토링 아카이브 — 선배 학생들이 만든 과목별 기출·모의고사·멘토링·정리 자료, 학업보조 책자, 전공 설명회. "
                   "시험 유형·공부법·과목 분위기·어떤 자료가 있는지 물을 때. 공식 일정·범위는 syllabus·calendar",
        {"query": {"type": "string", "description": "찾을 내용 (예: 중간고사 유형, 공부법)"},
         "subject": {"type": "string", "description": "과목 이름. 줄임말도 된다 (미2)"}}),
]


_PARAMS = {tool["function"]["name"]: set(tool["function"]["parameters"]["properties"]) for tool in TOOLS}
# 모델이 인자 이름을 바꿔 부르는 일이 있습니다 — `course_info(course=…)`·`timetable(student=…)`. 그대로 두면 빈 값으로
# 돌아 "'' 과목을 찾지 못했습니다" 로 실패합니다. 도구에 없는 이름일 때만 옮깁니다
_ALIASES = {
    "person": ("student", "teacher", "who", "name"),
    "subject": ("name", "course", "class", "class_name", "subject_name", "title"),
    "name": ("course", "subject", "course_name", "title", "query"),
    "query": ("keyword", "keywords", "q", "text", "topic", "search", "name"),
    "date": ("day", "when", "target_date"),
    "start": ("from", "start_date", "since", "begin"),
    "end": ("to", "end_date", "until"),
    "room": ("classroom", "room_name", "name"),
    "people": ("persons", "students", "names", "members"),
    "post_id": ("id", "post", "document_id", "doc_id", "number"),
    "periods": ("period", "class_periods"),
}


def canonical(name: str) -> str:
    """모델이 부른 도구 이름 — `functions.calendar`·`get_timetable` 처럼 붙여 오는 것을 떼어 냅니다."""
    name = (name or "").strip().removeprefix("functions.")
    if name not in _PARAMS:
        for prefix in ("get_", "search_", "find_", "lookup_", "read_"):
            if name.startswith(prefix) and name[len(prefix):] in _PARAMS:
                return name[len(prefix):]
    return name


def _arguments(name: str, args: dict) -> dict:
    params = _PARAMS.get(name, set())
    out = {key: value for key, value in args.items() if key in params}
    for param in params:
        if out.get(param) in (None, "", []):
            alias = next((a for a in _ALIASES.get(param, ()) if a not in params and args.get(a) not in (None, "", [])), None)
            if alias:
                out[param] = args[alias]
    # calendar(date=…) 는 그날 하루입니다
    if name == "calendar" and args.get("date") and not out.get("start") and not out.get("end"):
        out["start"] = out["end"] = args["date"]
    return out


async def execute(ctx: Context, name: str, args: dict) -> dict:
    args = _arguments(name, args)
    table = {
        "today_info": lambda: today_info(ctx),
        "timetable": lambda: timetable(ctx, args.get("person") or "me", args.get("date")),
        "room_schedule": lambda: room_schedule(ctx, args.get("room", ""), args.get("date")),
        "empty_rooms": lambda: empty_rooms(ctx, args.get("date"), args.get("periods"), args.get("building")),
        "common_free": lambda: common_free(ctx, args.get("people") or ["me"], args.get("date")),
        "class_info": lambda: class_info(ctx, args.get("subject", ""), args.get("section")),
        "find_person": lambda: find_person(ctx, args.get("query", "")),
        "calendar": lambda: calendar(ctx, args.get("start"), args.get("end"), args.get("query")),
        "my_exams": lambda: my_exams(ctx),
        "course_info": lambda: course_info(ctx, args.get("name", "")),
        "search": lambda: search(ctx, args.get("query", ""), args.get("since"), args.get("until"), args.get("board")),
        "read_ksain": lambda: read_ksain(ctx, args.get("post_id", 0)),
        "ksain_digest": lambda: ksain_digest(ctx, args.get("start"), args.get("end"), args.get("min_importance", 2)),
        "archive": lambda: archive(ctx, args.get("query"), args.get("subject")),
    }
    try:
        if name == "meal":
            return await meal(ctx, args.get("date"))
        if name == "syllabus":
            return await syllabus(ctx, args.get("subject"), args.get("query"))
        if name not in table:
            return {"error": f"없는 도구입니다: {name}"}
        return table[name]()
    except ToolError as error:
        return {"error": str(error)}
