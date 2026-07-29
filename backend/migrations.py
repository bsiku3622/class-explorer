"""
앱 시작 시 실행되는 SQLite 스키마 마이그레이션.

모든 마이그레이션은 멱등적입니다 — 이미 적용된 DB에 다시 돌려도 아무 일도 하지 않습니다.
"""

from sqlalchemy import Engine, text

# 학기 컬럼 도입 이전에 쌓인 데이터가 속한 학기
LEGACY_YEAR = 2026
LEGACY_SEMESTER = 1


def _has_column(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(row[1] == column for row in rows)


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


def run_migrations(engine: Engine) -> None:
    # 단순 컬럼 추가 — 이미 있으면 무시
    simple = [
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0 NOT NULL",
        "ALTER TABLE users ADD COLUMN stu_id VARCHAR REFERENCES students(stuId)",
        "CREATE INDEX IF NOT EXISTS ix_users_stu_id ON users (stu_id)",
        "ALTER TABLE sessions ADD COLUMN ip_address VARCHAR",
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
