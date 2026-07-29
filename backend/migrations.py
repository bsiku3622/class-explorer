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


def run_migrations(engine: Engine) -> None:
    # 단순 컬럼 추가 — 이미 있으면 무시
    simple = [
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0 NOT NULL",
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
