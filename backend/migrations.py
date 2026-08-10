"""
앱 시작 시 실행되는 SQLite 스키마 마이그레이션.

모든 마이그레이션은 멱등적입니다 — 이미 적용된 DB에 다시 돌려도 아무 일도 하지 않습니다.
"""

from sqlalchemy import Engine, text

from backend.subject_names import candidate_names, split_name

# 학기 컬럼 도입 이전에 쌓인 데이터가 속한 학기
LEGACY_YEAR = 2026
LEGACY_SEMESTER = 1

# 학과 → 계열. 학과가 계열을 결정하므로 과목마다 들고 있을 필요가 없습니다
DEPARTMENT_CATEGORY = {
    "수학": "natural", "정보과학": "natural", "물리학": "natural",
    "화학": "natural", "생물학": "natural", "지구과학": "natural",
    "국어": "humanities", "사회": "humanities",
    "외국어": "humanities", "예체능": "humanities",
    "융합": "convergence",
}

# 화면에 늘어놓는 순서 — 프론트에 하드코딩돼 있던 것을 DB로 옮깁니다
DEPARTMENT_ORDER = [
    "수학", "정보과학", "물리학", "화학", "생물학", "지구과학",
    "국어", "사회", "외국어", "예체능", "융합",
]


def _has_column(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


def _has_table(conn, table: str) -> bool:
    return bool(
        conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:t"),
            {"t": table},
        ).fetchone()
    )


def _add_semester_columns(conn) -> None:
    """
    classes 에 year/semester 를 추가하고 UNIQUE 제약을 학기 단위로 확장합니다.

    SQLite 는 UNIQUE 제약을 ALTER 로 바꿀 수 없어 테이블을 재생성합니다.
    id 를 그대로 옮기므로 enrollments/class_times 의 FK 는 유지됩니다.
    """
    if _has_column(conn, "classes", "year"):
        return

    conn.execute(text("PRAGMA foreign_keys=OFF"))
    conn.execute(
        text(
            """
            CREATE TABLE classes_migrated (
                id INTEGER NOT NULL,
                subject VARCHAR,
                section VARCHAR,
                teacher VARCHAR,
                room VARCHAR,
                year INTEGER NOT NULL,
                semester INTEGER NOT NULL,
                PRIMARY KEY (id),
                CONSTRAINT _subject_section_uc UNIQUE (subject, section, teacher, year, semester)
            )
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO classes_migrated (id, subject, section, teacher, room, year, semester)
            SELECT id, subject, section, teacher, room, :year, :semester FROM classes
            """
        ),
        {"year": LEGACY_YEAR, "semester": LEGACY_SEMESTER},
    )
    conn.execute(text("DROP TABLE classes"))
    conn.execute(text("ALTER TABLE classes_migrated RENAME TO classes"))
    conn.execute(text("CREATE INDEX ix_classes_id ON classes (id)"))
    conn.execute(text("CREATE INDEX ix_classes_subject ON classes (subject)"))
    conn.execute(text("CREATE INDEX ix_classes_year ON classes (year)"))
    conn.execute(text("CREATE INDEX ix_classes_semester ON classes (semester)"))
    conn.execute(text("PRAGMA foreign_keys=ON"))
    conn.commit()

    print(f"[migration] classes → year/semester 추가 (기존 데이터 {LEGACY_YEAR}-{LEGACY_SEMESTER} 지정)")


def _drop_grade_student_column(conn) -> None:
    """
    course_grades 에서 stu_id 를 걷어냅니다.

    한 계정이 여러 학생의 이수 기록을 들 수 있던 시절의 컬럼입니다. 이제 계정에 학번이
    붙으므로 본인 기록만 남기면 됩니다 — 계정의 학번과 일치하는 행만 옮기고, 학번이
    등록되지 않은 계정의 기록은 누구 것인지 알 수 없어 버립니다.
    """
    if not _has_column(conn, "course_grades", "stu_id"):
        return

    conn.execute(text("PRAGMA foreign_keys=OFF"))
    conn.execute(
        text(
            """
            CREATE TABLE course_grades_migrated (
                id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                course VARCHAR NOT NULL,
                grade VARCHAR,
                PRIMARY KEY (id),
                CONSTRAINT _course_grade_uc UNIQUE (user_id, course)
            )
            """
        )
    )
    conn.execute(
        text(
            """
            INSERT INTO course_grades_migrated (id, user_id, course, grade)
            SELECT g.id, g.user_id, g.course, g.grade
            FROM course_grades g
            JOIN users u ON u.id = g.user_id
            WHERE u.stu_id IS NOT NULL AND u.stu_id = g.stu_id
            """
        )
    )
    moved = conn.execute(text("SELECT COUNT(*) FROM course_grades_migrated")).scalar()
    total = conn.execute(text("SELECT COUNT(*) FROM course_grades")).scalar()
    conn.execute(text("DROP TABLE course_grades"))
    conn.execute(text("ALTER TABLE course_grades_migrated RENAME TO course_grades"))
    conn.execute(text("CREATE INDEX ix_course_grades_id ON course_grades (id)"))
    conn.execute(text("CREATE INDEX ix_course_grades_user_id ON course_grades (user_id)"))
    conn.execute(text("PRAGMA foreign_keys=ON"))
    conn.commit()

    dropped = (total or 0) - (moved or 0)
    note = f", 주인을 알 수 없어 버림 {dropped}건" if dropped else ""
    print(f"[migration] course_grades → stu_id 제거 (이관 {moved}건{note})")


def _unique_student_link(conn) -> None:
    """
    users.stu_id 를 유니크로 만듭니다 — 한 학번은 한 계정만.

    처음에는 평범한 인덱스로 만들었는데, 그러면 라우터 검사를 통과한 두 요청이 동시에
    같은 학번을 넣을 수 있습니다. SQLite 는 유니크 검사에서 NULL 을 빼므로 미등록
    계정이 여럿이어도 문제없습니다.

    이미 중복이 있으면 인덱스를 만들 수 없어, 늦게 등록한 쪽을 비워 자리를 만듭니다.
    """
    rows = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='index' AND name='ix_users_stu_id'")
    ).fetchall()
    if not rows:
        return  # 아직 컬럼 추가 전 — 위쪽 simple 문에서 만들고 다음 실행 때 처리됩니다

    is_unique = conn.execute(
        text("SELECT \"unique\" FROM pragma_index_list('users') WHERE name='ix_users_stu_id'")
    ).scalar()
    if is_unique:
        return

    duplicates = conn.execute(
        text(
            """
            SELECT stu_id, COUNT(*) FROM users
            WHERE stu_id IS NOT NULL GROUP BY stu_id HAVING COUNT(*) > 1
            """
        )
    ).fetchall()
    for stu_id, _ in duplicates:
        # 가장 먼저 등록한 계정만 남깁니다
        conn.execute(
            text(
                """
                UPDATE users SET stu_id = NULL
                WHERE stu_id = :stu_id
                  AND id != (SELECT MIN(id) FROM users WHERE stu_id = :stu_id)
                """
            ),
            {"stu_id": stu_id},
        )
        print(f"[migration] 학번 {stu_id} 중복 — 먼저 등록한 계정만 남기고 비웠습니다")

    conn.execute(text("DROP INDEX ix_users_stu_id"))
    conn.execute(text("CREATE UNIQUE INDEX ix_users_stu_id ON users (stu_id)"))
    conn.commit()
    print("[migration] users.stu_id → 유니크 (한 학번 = 한 계정)")


def _split_into_subject_tables(conn) -> None:
    """
    과목을 departments / courses / subjects / classes 네 층으로 쪼갭니다.

    이전에는 `classes.subject` 문자열 하나가 표시 이름과 과목 식별자를 겸하고,
    `subject_credits`·`subject_aliases`가 그 원문을 키로 물고 있었습니다. 그래서
    영어강의(EC)와 한국어강의를 구분할 수 없었고 — 카탈로그에 EC 표기가 4개뿐이라
    18건이 엉뚱하게 이어졌습니다 — 표기가 조금 바뀌면 조용히 끊겼습니다.

    옮기는 순서가 중요합니다. `classes.id`는 그대로 지켜야 합니다.
    `enrollments`(19,801행)와 `class_times`가 그 id를 참조하고 있어서, 새로 만들면
    수강 기록이 통째로 끊깁니다.

    `subject_credits`는 폐기합니다 — 학점은 `Subject → Course`로 조회합니다.
    `subject_aliases`도 폐기합니다 — 등록된 98개 중 89개가 유사도 검색으로 이미
    잡히고, 나머지는 음차(칼큘→Calculus)라 유지 가치가 낮습니다.
    """
    if not _has_table(conn, "classes") or _has_column(conn, "classes", "subject_id"):
        return  # 새 DB이거나 이미 옮겨졌습니다

    old_courses = conn.execute(
        text("""SELECT name, english_name, department, credits, ap_credits, is_pf,
                       recommended_semester, description, description_sections,
                       description_source, description_page
                FROM courses""")
    ).fetchall()
    old_classes = conn.execute(
        text("SELECT id, subject, section, teacher, room, year, semester FROM classes")
    ).fetchall()
    old_prereqs = conn.execute(
        text("SELECT before, after, alternative FROM course_prereqs")
    ).fetchall()
    old_grades = (
        conn.execute(text("SELECT user_id, course, grade FROM course_grades")).fetchall()
        if _has_table(conn, "course_grades")
        else []
    )

    conn.execute(text("PRAGMA foreign_keys=OFF"))

    # ── 1. departments ─────────────────────────────────────────────────
    conn.execute(text("DROP TABLE IF EXISTS departments"))
    conn.execute(
        text("""CREATE TABLE departments (
                  id INTEGER NOT NULL PRIMARY KEY,
                  name VARCHAR NOT NULL UNIQUE,
                  category VARCHAR NOT NULL,
                  display_order INTEGER NOT NULL DEFAULT 0)""")
    )
    present = {row[2] for row in old_courses}
    ordered = [d for d in DEPARTMENT_ORDER if d in present]
    ordered += sorted(present - set(ordered))  # 목록에 없는 학과는 뒤에
    department_id: dict[str, int] = {}
    for index, name in enumerate(ordered):
        conn.execute(
            text("""INSERT INTO departments (name, category, display_order)
                    VALUES (:name, :category, :order)"""),
            {"name": name, "category": DEPARTMENT_CATEGORY.get(name, "natural"), "order": index},
        )
        department_id[name] = conn.execute(text("SELECT last_insert_rowid()")).scalar()

    # ── 2. courses — name PK → id PK, 이름에서 (EC) 태그 제거 ──────────
    conn.execute(text("DROP TABLE IF EXISTS courses_new"))
    conn.execute(
        text("""CREATE TABLE courses_new (
                  id INTEGER NOT NULL PRIMARY KEY,
                  department_id INTEGER NOT NULL REFERENCES departments(id),
                  name VARCHAR NOT NULL UNIQUE,
                  name_english VARCHAR,
                  credits FLOAT NOT NULL,
                  ap_credits FLOAT NOT NULL DEFAULT 0,
                  is_pf BOOLEAN NOT NULL DEFAULT 0,
                  recommended_semester VARCHAR,
                  description TEXT,
                  description_sections JSON NOT NULL DEFAULT '{}',
                  description_source VARCHAR,
                  description_page INTEGER)""")
    )
    course_id: dict[str, int] = {}   # 태그 뗀 이름 → id
    legacy_course_id: dict[str, int] = {}  # 옛 이름(태그 포함) → id
    for row in old_courses:
        (name, english, dept, credits, ap, is_pf, semester,
         desc, sections, source, page) = row
        clean = name[:-4].strip() if name.endswith("(EC)") else name
        if clean in course_id:
            legacy_course_id[name] = course_id[clean]
            continue
        conn.execute(
            text("""INSERT INTO courses_new
                      (department_id, name, name_english, credits, ap_credits, is_pf,
                       recommended_semester, description, description_sections,
                       description_source, description_page)
                    VALUES (:dept, :name, :english, :credits, :ap, :is_pf,
                            :semester, :desc, :sections, :source, :page)"""),
            {"dept": department_id[dept], "name": clean, "english": english,
             "credits": credits or 0, "ap": ap or 0, "is_pf": bool(is_pf),
             "semester": semester, "desc": desc, "sections": sections or "{}",
             "source": source, "page": page},
        )
        new_id = conn.execute(text("SELECT last_insert_rowid()")).scalar()
        course_id[clean] = new_id
        legacy_course_id[name] = new_id

    conn.execute(text("DROP TABLE courses"))
    conn.execute(text("ALTER TABLE courses_new RENAME TO courses"))
    conn.execute(text("CREATE INDEX ix_courses_id ON courses (id)"))
    conn.execute(text("CREATE INDEX ix_courses_name ON courses (name)"))
    conn.execute(text("CREATE INDEX ix_courses_department_id ON courses (department_id)"))

    # ── 3. subjects — KEIS 개설명을 분해해 담습니다 ─────────────────────
    conn.execute(text("DROP TABLE IF EXISTS subjects"))
    conn.execute(
        text("""CREATE TABLE subjects (
                  id INTEGER NOT NULL PRIMARY KEY,
                  course_id INTEGER REFERENCES courses(id),
                  name VARCHAR NOT NULL,
                  name_english VARCHAR,
                  name_raw VARCHAR NOT NULL,
                  is_ec BOOLEAN NOT NULL DEFAULT 0,
                  CONSTRAINT _subject_name_lang_uc UNIQUE (name, is_ec))""")
    )
    subject_id: dict[str, int] = {}   # KEIS 원문 → subjects.id
    by_identity: dict[tuple[str, bool], int] = {}
    unlinked: list[str] = []
    for raw in sorted({row[1] for row in old_classes}):
        name, english, is_ec = split_name(raw)
        existing = by_identity.get((name, is_ec))
        if existing is not None:
            subject_id[raw] = existing
            continue
        matched = next((n for n in candidate_names(name) if n in course_id), None)
        if matched is None:
            unlinked.append(name)
        conn.execute(
            text("""INSERT INTO subjects (course_id, name, name_english, name_raw, is_ec)
                    VALUES (:course, :name, :english, :raw, :is_ec)"""),
            {"course": course_id.get(matched) if matched else None,
             "name": name, "english": english, "raw": raw, "is_ec": is_ec},
        )
        new_id = conn.execute(text("SELECT last_insert_rowid()")).scalar()
        subject_id[raw] = new_id
        by_identity[(name, is_ec)] = new_id

    conn.execute(text("CREATE INDEX ix_subjects_id ON subjects (id)"))
    conn.execute(text("CREATE INDEX ix_subjects_name ON subjects (name)"))
    conn.execute(text("CREATE INDEX ix_subjects_course_id ON subjects (course_id)"))

    # ── 4. classes — subject 문자열 → subject_id. id 는 그대로 지킵니다 ─
    conn.execute(text("DROP TABLE IF EXISTS classes_new"))
    conn.execute(
        text("""CREATE TABLE classes_new (
                  id INTEGER NOT NULL PRIMARY KEY,
                  subject_id INTEGER NOT NULL REFERENCES subjects(id),
                  section VARCHAR,
                  teacher VARCHAR,
                  room VARCHAR,
                  year INTEGER NOT NULL,
                  semester INTEGER NOT NULL,
                  CONSTRAINT _subject_section_uc
                    UNIQUE (subject_id, section, teacher, year, semester))""")
    )
    for class_id, raw, section, teacher, room, year, semester in old_classes:
        conn.execute(
            text("""INSERT INTO classes_new
                      (id, subject_id, section, teacher, room, year, semester)
                    VALUES (:id, :subject, :section, :teacher, :room, :year, :semester)"""),
            {"id": class_id, "subject": subject_id[raw], "section": section,
             "teacher": teacher, "room": room, "year": year, "semester": semester},
        )
    conn.execute(text("DROP TABLE classes"))
    conn.execute(text("ALTER TABLE classes_new RENAME TO classes"))
    conn.execute(text("CREATE INDEX ix_classes_id ON classes (id)"))
    conn.execute(text("CREATE INDEX ix_classes_subject_id ON classes (subject_id)"))
    conn.execute(text("CREATE INDEX ix_classes_year ON classes (year)"))
    conn.execute(text("CREATE INDEX ix_classes_semester ON classes (semester)"))

    # ── 5. course_prereqs — 이름 참조 → id 참조 ─────────────────────────
    conn.execute(text("DROP TABLE IF EXISTS course_prereqs"))
    conn.execute(
        text("""CREATE TABLE course_prereqs (
                  id INTEGER NOT NULL PRIMARY KEY,
                  before_id INTEGER NOT NULL REFERENCES courses(id),
                  after_id INTEGER NOT NULL REFERENCES courses(id),
                  alternative BOOLEAN NOT NULL DEFAULT 0,
                  CONSTRAINT _course_prereq_uc UNIQUE (before_id, after_id))""")
    )
    dropped_edges = 0
    for before, after, alternative in old_prereqs:
        before_id = legacy_course_id.get(before)
        after_id = legacy_course_id.get(after)
        if before_id is None or after_id is None or before_id == after_id:
            dropped_edges += 1
            continue
        conn.execute(
            text("""INSERT OR IGNORE INTO course_prereqs (before_id, after_id, alternative)
                    VALUES (:before, :after, :alt)"""),
            {"before": before_id, "after": after_id, "alt": bool(alternative)},
        )
    conn.execute(text("CREATE INDEX ix_course_prereqs_id ON course_prereqs (id)"))
    conn.execute(text("CREATE INDEX ix_course_prereqs_before_id ON course_prereqs (before_id)"))
    conn.execute(text("CREATE INDEX ix_course_prereqs_after_id ON course_prereqs (after_id)"))

    # ── 6. course_grades — 과목명 → course_id ──────────────────────────
    conn.execute(text("DROP TABLE IF EXISTS course_grades"))
    conn.execute(
        text("""CREATE TABLE course_grades (
                  id INTEGER NOT NULL PRIMARY KEY,
                  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                  course_id INTEGER NOT NULL REFERENCES courses(id),
                  grade VARCHAR,
                  CONSTRAINT _course_grade_uc UNIQUE (user_id, course_id))""")
    )
    for user_id, course_name, grade in old_grades:
        target = legacy_course_id.get(course_name)
        if target is None:
            continue
        conn.execute(
            text("""INSERT OR IGNORE INTO course_grades (user_id, course_id, grade)
                    VALUES (:user, :course, :grade)"""),
            {"user": user_id, "course": target, "grade": grade},
        )
    conn.execute(text("CREATE INDEX ix_course_grades_id ON course_grades (id)"))
    conn.execute(text("CREATE INDEX ix_course_grades_user_id ON course_grades (user_id)"))
    conn.execute(text("CREATE INDEX ix_course_grades_course_id ON course_grades (course_id)"))

    # ── 7. 폐기 ────────────────────────────────────────────────────────
    conn.execute(text("DROP TABLE IF EXISTS subject_credits"))
    conn.execute(text("DROP TABLE IF EXISTS subject_aliases"))

    conn.execute(text("PRAGMA foreign_keys=ON"))
    conn.commit()

    ec_count = conn.execute(text("SELECT COUNT(*) FROM subjects WHERE is_ec")).scalar()
    print(
        f"[migration] 과목 4층 분리 — 학과 {len(department_id)} · 교육과정 {len(course_id)} · "
        f"개설명 {len(by_identity)}(영어강의 {ec_count}) · 분반 {len(old_classes)}"
    )
    if unlinked:
        print(f"[migration]   교육과정에 없는 개설 과목 {len(unlinked)}개 — course_id 비움")
    if dropped_edges:
        print(f"[migration]   옮기지 못한 선수관계 {dropped_edges}개")


def _migrate_admin_flag_to_role(conn) -> None:
    """
    `users.is_admin` 불리언을 `users.role` 한 컬럼으로 옮깁니다.

    권한이 셋(user·manager·admin)이 되면서 불리언을 하나 더 붙이면 "둘 다 켜진 계정"의
    뜻이 애매해집니다. 위계라서 값 하나면 충분합니다.

    옛 컬럼은 옮긴 뒤 지웁니다. 남겨 두면 모델에 없는 컬럼이라 아무도 안 채우는데
    스키마에는 보여서, 다음에 읽는 사람이 둘 중 뭐가 진짜인지 헷갈립니다.
    """
    if not _has_column(conn, "users", "role"):
        conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL"))
        conn.commit()

    if _has_column(conn, "users", "is_admin"):
        moved = conn.execute(
            text("UPDATE users SET role='admin' WHERE is_admin=1 AND role<>'admin'")
        ).rowcount
        conn.commit()
        try:
            conn.execute(text("ALTER TABLE users DROP COLUMN is_admin"))
            conn.commit()
        except Exception:
            # 옛 SQLite 는 DROP COLUMN 을 모릅니다. 값은 이미 옮겼으니 그냥 둡니다
            conn.rollback()
        if moved:
            print(f"[migration] 권한을 role 로 이관 — 관리자 {moved}명")


def run_migrations(engine: Engine) -> None:
    # 단순 컬럼 추가 — 이미 있으면 무시
    simple = [
        "ALTER TABLE users ADD COLUMN stu_id VARCHAR REFERENCES students(stuId)",
        "CREATE INDEX IF NOT EXISTS ix_users_stu_id ON users (stu_id)",
        "ALTER TABLE users ADD COLUMN email VARCHAR",
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email)",
        "ALTER TABLE sessions ADD COLUMN ip_address VARCHAR",
        # 자몽 — 이수 기록이 학기와 EC 여부를 함께 답니다. 학기가 없는 예전 행은
        # 화면이 "학기 미지정"으로 골라내 채우게 합니다
        "ALTER TABLE course_grades ADD COLUMN term VARCHAR",
        "ALTER TABLE course_grades ADD COLUMN is_ec BOOLEAN DEFAULT 0 NOT NULL",
        # 교육과정 — 워크북 상자 색에서 읽은 분류와 심화필수 표시
        "ALTER TABLE courses ADD COLUMN tier VARCHAR",
        "ALTER TABLE courses ADD COLUMN required_advanced BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE departments ADD COLUMN track VARCHAR",
        "ALTER TABLE departments ADD COLUMN notes JSON DEFAULT '[]' NOT NULL",
        (
            "CREATE TABLE IF NOT EXISTS subject_aliases ("
            "id INTEGER PRIMARY KEY, subject VARCHAR NOT NULL, "
            "alias VARCHAR NOT NULL, UNIQUE (subject, alias))"
        ),
    ]

    with engine.connect() as conn:
        for stmt in simple:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                conn.rollback()  # 이미 존재하면 무시

        _add_semester_columns(conn)
        _drop_grade_student_column(conn)
        _unique_student_link(conn)
        _split_into_subject_tables(conn)
        _migrate_admin_flag_to_role(conn)
