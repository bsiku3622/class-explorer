"""Agent 도구 — 모델이 부를 수 있는 읽기 전용 함수들.

**화면에서 볼 수 있는 것만 돌려줍니다.** class-explorer 는 로그인한 사람에게 학기 전체(다른
학생·교사 시간표, 분반 명단)를 보여 주므로 그건 열어 두고, 화면이 본인 것만 보여 주는 것
(시험 시간표·개인 일정)은 여기서도 본인 것만 줍니다. 새 도구를 붙일 때도 이 경계를 지키세요.

날짜를 받는 도구는 홈과 같은 규칙으로 그날을 판정합니다 — 방학·주말·휴업일이면 수업이
없고, 대체 시간표(`TimetableOverride`)가 있으면 그 요일 수업으로 갈아 끼웁니다.
"""
from __future__ import annotations

import datetime
import re
import unicodedata

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend import models, periods
from backend.calendar_router import event_out
from backend.home_router import fetch_meal, holiday_today, session_state
from backend.ksain import search as ksain_search
from backend.ksain.db import SessionLocal as KsainSession
from backend.terms import resolve_term
from backend.versioning import at_version

WEEKDAYS = "월화수목금토일"
PERIOD_TIME = {p: (s, e) for p, s, e in periods.PERIODS}
ALL_PERIODS = [p for p, _s, _e in periods.PERIODS]
CLASSROOM = re.compile(r"^[형탐예창]\d{4}")


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text or "")).lower()


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


def _items(items: list[dict]) -> list[dict]:
    out = []
    for item in items or []:
        entry = {"title": item["title"], "when": _when(item["start_date"], item.get("end_date"),
                                                      item.get("start_time"), item.get("end_time"))}
        if item.get("target_grades"):
            entry["grades"] = item["target_grades"]
        for key in ("post_title", "url"):
            if item.get(key):
                entry[key] = item[key]
        out.append(entry)
    return out


def _date(value: str | None) -> datetime.date:
    if not value:
        return periods.today()
    try:
        return datetime.date.fromisoformat(value.strip()[:10])
    except ValueError:
        return periods.today()


class Context:
    def __init__(self, db: Session, user: models.User) -> None:
        self.db = db
        self.user = user
        self.year, self.semester = resolve_term(db, None, None)
        self.sources: list[dict] = []

    def cite(self, title: str, url: str) -> None:
        if url and all(s["url"] != url for s in self.sources):
            self.sources.append({"title": title, "url": url})

    # ── 날짜 판정 ────────────────────────────────────────────────────────────
    def day(self, day: datetime.date) -> dict:
        weekday = day.weekday()
        dow = periods.DAYS[weekday] if weekday < len(periods.DAYS) else None
        override = self.db.query(models.TimetableOverride).filter_by(date=day).first()
        session = session_state(self.db, day)
        off = None
        if override is None:
            if not session["in_session"]:
                off = session["label"] or "방학"
            elif dow is None:
                off = "주말"
            elif (holiday := holiday_today(self.db, day)) is not None:
                off = holiday
        return {
            "date": day.isoformat(),
            "weekday": WEEKDAYS[weekday],
            "class_day": override.source_day if override else (None if off else dow),
            "no_class_reason": off,
            "override": f"{override.title} ({override.source_day} 시간표)" if override else None,
        }

    # ── 수업 조회 ────────────────────────────────────────────────────────────
    def _rows(self, *filters):
        return (
            self.db.query(models.Class, models.ClassTime)
            .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
            .filter(models.Class.year == self.year, models.Class.semester == self.semester,
                    at_version(models.Class), at_version(models.ClassTime), *filters)
            .options(joinedload(models.Class.subject))
            .all()
        )

    def _student_rows(self, stu_id: str):
        return (
            self.db.query(models.Class, models.ClassTime)
            .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
            .join(models.ClassTime, models.ClassTime.class_id == models.Class.id)
            .filter(models.Enrollment.stuId == stu_id, models.Class.year == self.year,
                    models.Class.semester == self.semester, at_version(models.Class),
                    at_version(models.ClassTime), at_version(models.Enrollment))
            .options(joinedload(models.Class.subject))
            .all()
        )

    @staticmethod
    def _entry(cls: models.Class, time: models.ClassTime) -> dict:
        subject = cls.subject
        return {
            "day": time.day, "period": _period_label(time.period), "p": time.period,
            "subject": f"{subject.name}(EC)" if subject.is_ec else subject.name,
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
        text = re.sub(r"(선생님|쌤|교수님|님)$", "", (who or "").strip())
        if text in ("", "me", "나", "내", "저", "제"):
            stu = self.user.effective_stu_id
            if not stu:
                return {"error": "이 계정에 학번이 연결되어 있지 않습니다"}
            student = self.db.get(models.Student, stu)
            return {"kind": "student", "id": stu, "name": student.name if student else stu}
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
    now = periods.now()
    minute = now.hour * 60 + now.minute
    current = periods.current_period(minute)
    upcoming = periods.next_period(minute)
    return {
        **ctx.day(now.date()), "time": now.strftime("%H:%M"), "term": f"{ctx.year}-{ctx.semester}",
        "current_period": _period_label(current) if current else None,
        "next_period": _period_label(upcoming[0]) if upcoming else None,
        "break": periods.current_break(minute),
        "periods": [_period_label(p) for p in ALL_PERIODS],
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
    return {"students": [{"id": s.stuId, "name": s.name} for s in students], "teachers": teachers}


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
    wanted = [p for p in (periods_ or ALL_PERIODS[:9]) if p in PERIOD_TIME]
    rooms = [r for r in ctx.rooms() if CLASSROOM.match(r) and (not building or r.startswith(building[:1]))]
    busy: dict[int, set[str]] = {p: set() for p in wanted}
    for cls, time in ctx._rows(models.ClassTime.day == info["class_day"]):
        if time.period in busy:
            busy[time.period].add(time.room or cls.room)
    return {**info, "empty": {_period_label(p): [r for r in rooms if r not in busy[p]] for p in wanted}}


def common_free(ctx: Context, people: list[str], date: str | None = None) -> dict:
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
    q = _norm(subject).replace("(ec)", "")
    classes = (
        ctx.db.query(models.Class).join(models.Subject)
        .filter(models.Class.year == ctx.year, models.Class.semester == ctx.semester, at_version(models.Class))
        .options(joinedload(models.Class.subject)).all()
    )
    hits = [c for c in classes if q and q in _norm(c.subject.name)]
    if section:
        num = re.search(r"\d+", section)
        hits = [c for c in hits if num and re.search(r"\d+", c.section or "") and re.search(r"\d+", c.section)[0] == num[0]]
    if not hits:
        return {"error": f"'{subject}' 과목을 이번 학기에서 찾지 못했습니다"}
    out = []
    for cls in sorted(hits, key=lambda c: (c.subject.name, c.subject.is_ec, int(re.search(r"\d+", c.section or "0")[0]))):
        members = [e.stuId for e in cls.enrollments]
        entry = {
            "subject": f"{cls.subject.name}(EC)" if cls.subject.is_ec else cls.subject.name,
            "section": cls.section, "teacher": cls.teacher,
            "times": [f"{WEEKDAYS[periods.DAYS.index(t.day)]} {_period_label(t.period)} {t.room or cls.room}"
                      for t in sorted(cls.times, key=lambda t: (periods.DAYS.index(t.day), t.period))],
            "students": len(members),
        }
        if len(hits) == 1 or section:
            names = dict(ctx.db.query(models.Student.stuId, models.Student.name).filter(models.Student.stuId.in_(members)))
            entry["roster"] = [f"{s} {names.get(s, '')}".strip() for s in sorted(members)]
        out.append(entry)
    return {"term": f"{ctx.year}-{ctx.semester}", "classes": out[:20]}


def calendar(ctx: Context, start: str | None = None, end: str | None = None, query: str | None = None) -> dict:
    first = _date(start)
    last = _date(end) if end else first + datetime.timedelta(days=30)
    rows = (
        ctx.db.query(models.CalendarEvent)
        .filter(models.CalendarEvent.start_date <= last, models.CalendarEvent.end_date >= first,
                or_(models.CalendarEvent.owner_id.is_(None), models.CalendarEvent.owner_id == ctx.user.id))
        .order_by(models.CalendarEvent.start_date, models.CalendarEvent.id).all()
    )
    words = ksain_search.terms(query or "")
    if words:
        rows = [r for r in rows if any(w in _norm(r.title) or w in _norm(r.note or "") for w in words)]
    events = []
    for row in rows[:60]:
        out = event_out(row)
        clock = out["time_mode"] == "clock" and out["start_minute"] is not None
        out["when"] = _when(out["start_date"], out["end_date"],
                            periods.hhmm(out["start_minute"]) if clock else None,
                            periods.hhmm(out["end_minute"]) if clock and out["end_minute"] is not None else None)
        url = re.search(r"https://ksain\.kr/document/\d+", row.note or "")
        if url:
            ctx.cite(row.title, url.group(0))
        events.append({k: v for k, v in out.items() if v not in (None, [], "") and k not in (
            "id", "series_id", "start_minute", "end_minute", "start_date", "end_date", "time_mode",
            "start_period", "end_period")})
    return {"from": first.isoformat(), "to": last.isoformat(), "events": events}


def my_exams(ctx: Context) -> dict:
    from backend.exams_router import my_exams as exams_for

    return exams_for(year=None, semester=None, db=ctx.db, user=ctx.user)


async def meal(ctx: Context, date: str | None = None) -> dict:
    day = _date(date)
    return {"date": day.isoformat(), "weekday": WEEKDAYS[day.weekday()], "menu": await fetch_meal(ctx.db, day)}


def course_info(ctx: Context, name: str) -> dict:
    q = _norm(name).replace("(ec)", "")
    courses = [c for c in ctx.db.query(models.Course).options(joinedload(models.Course.department)).all() if q and q in _norm(c.name)]
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


def search_ksain(ctx: Context, query: str, since: str | None = None, until: str | None = None, board: str | None = None) -> dict:
    db = KsainSession()
    try:
        posts = ksain_search.search(db, query, since=_date(since) if since else None,
                                    until=_date(until) if until else None, board=board)
    finally:
        db.close()
    for post in posts:
        post["items"] = _items(post["items"])
    for post in posts[:5]:
        ctx.cite(post["title"], post["url"])
    return {"query": query, "posts": posts}


def read_ksain(ctx: Context, post_id: int) -> dict:
    db = KsainSession()
    try:
        post = ksain_search.read(db, int(post_id))
    finally:
        db.close()
    if post is None:
        return {"error": f"{post_id}번 글이 없습니다"}
    post["items"] = _items(post["items"])
    ctx.cite(post["title"], post["url"])
    return post


def ksain_digest(ctx: Context, start: str | None = None, end: str | None = None, min_importance: int = 2) -> dict:
    first = _date(start)
    # end 를 빼먹고 "이번 주" 를 start 만으로 묻는 일이 잦습니다 — 비우면 오늘까지로 잡습니다
    last = _date(end) if end else max(first, periods.today())
    db = KsainSession()
    try:
        out = ksain_search.digest(db, first, last, int(min_importance))
    finally:
        db.close()
    for post in out["posted"]:
        post["items"] = _items(post["items"])
    out["dated_items"] = _items(out["dated_items"])
    for post in out["posted"][:5]:
        ctx.cite(post["title"], post["url"])
    return {"from": first.isoformat(), "to": last.isoformat(), **out}


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
    _fn("class_info", "과목의 분반·교사·시간·강의실·수강 인원. 분반을 주면 수강생 명단까지",
        {"subject": {"type": "string"}, "section": {"type": "string", "description": "예: 3분반"}}, ["subject"]),
    _fn("find_person", "이름 일부나 학번으로 학생·교사 후보 찾기", {"query": {"type": "string"}}, ["query"]),
    _fn("calendar", "학사일정과 내 개인 일정. 시험·행사·귀가·마감 등",
        {"start": DATE, "end": {"type": "string", "description": "YYYY-MM-DD. 비우면 start 부터 30일"},
         "query": {"type": "string", "description": "제목 키워드 (선택)"}}),
    _fn("my_exams", "질문한 사람의 이번 학기 시험 시간표 (과목·날짜·시각·시험실)"),
    _fn("meal", "급식 메뉴 (아침·점심·저녁)", {"date": DATE}),
    _fn("course_info", "교육과정 과목 정보 — 학점·선수과목·설명", {"name": {"type": "string"}}, ["name"]),
    _fn("search_ksain", "ksain(학교 커뮤니티) 게시글 검색. 공지·마감·행사·모집 등을 찾을 때",
        {"query": {"type": "string", "description": "핵심 키워드 (예: R&E 최종 보고서 제출)"},
         "since": {"type": "string", "description": "이 날짜 이후 글만 (YYYY-MM-DD)"},
         "until": {"type": "string", "description": "이 날짜 이전 글만"},
         "board": {"type": "string", "description": "게시판 이름 일부 (예: 공지사항)"}}, ["query"]),
    _fn("read_ksain", "ksain 글 하나의 본문과 첨부 내용", {"post_id": {"type": "integer"}}, ["post_id"]),
    _fn("ksain_digest", "기간 안에 올라온 중요한 ksain 공지와 그 기간에 걸린 필참 교육·마감",
        {"start": DATE, "end": {"type": "string", "description": "YYYY-MM-DD. 비우면 오늘까지"},
         "min_importance": {"type": "integer", "description": "0~3, 기본 2"}}),
]


async def execute(ctx: Context, name: str, args: dict) -> dict:
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
        "search_ksain": lambda: search_ksain(ctx, args.get("query", ""), args.get("since"), args.get("until"), args.get("board")),
        "read_ksain": lambda: read_ksain(ctx, args.get("post_id", 0)),
        "ksain_digest": lambda: ksain_digest(ctx, args.get("start"), args.get("end"), args.get("min_importance", 2)),
    }
    if name == "meal":
        return await meal(ctx, args.get("date"))
    if name not in table:
        return {"error": f"없는 도구입니다: {name}"}
    return table[name]()
