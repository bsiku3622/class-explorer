"""
데이터 회차 — 수집이 한 학기를 갈아 끼운 이력.

수업·시간·수강 행은 지워지지 않습니다. 대신 `[version_from, version_to)` 라는 유효
구간을 들고 있어서, 폐강되거나 수강을 뺀 행은 **닫힐 뿐** 남아 있습니다. 덕분에
"지난 회차엔 뭐가 달랐나"를 백업 파일을 열지 않고 쿼리로 물을 수 있습니다.

## 읽을 때

**`at_version()` 을 거치세요.** 조건을 손으로 적으면 언젠가 한 자리를 빠뜨리고, 그러면
폐강된 분반이 조회에 섞여 나옵니다. 화면에서 티가 안 나는 종류의 사고입니다.

    db.query(models.Class).filter(at_version(models.Class))            # 지금 유효한 것
    db.query(models.Class).filter(at_version(models.Class, 5))         # 5회차 시점

인자를 안 주면 현재입니다. **현재를 물을 때는 학기를 몰라도 됩니다** — 열려 있는 행은
어느 학기든 `version_to` 가 비어 있으니까요. 학기를 알아야 하는 건 과거를 물을 때뿐이라,
대부분의 조회 자리는 인자 없이 부르면 끝납니다.

## 올릴 때

회차는 **바뀐 게 있을 때만** 늘어납니다. 수집을 돌려도 결과가 직전과 같으면 만들지
않습니다. 화면에 나가는 내용이 달라지는 변경이면 수집이 아니어도 올립니다 — 학생·교사
이름 수정이 그렇습니다. 회차가 그대로면 브라우저가 캐시를 계속 쓰기 때문입니다.
"""

import datetime

from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from backend import models

# 버전 구간을 들고 있는 모델 — 마이그레이션과 진단이 같은 목록을 봅니다
VERSIONED = (models.Class, models.ClassTime, models.Enrollment)


def at_version(model, version: int | None = None):
    """
    `version` 시점에 유효한 행만 고르는 조건. 인자가 없으면 지금 열려 있는 행.

    구간은 시작을 포함하고 끝을 포함하지 않습니다 — 5회차에 닫힌 행은 4회차까지
    유효합니다.
    """
    if version is None:
        return model.version_to.is_(None)
    return and_(
        model.version_from <= version,
        or_(model.version_to.is_(None), model.version_to > version),
    )


def current_version(db: Session, year: int, semester: int) -> int:
    """해당 학기의 최신 회차. 기록이 없으면 0."""
    row = (
        db.query(models.TermVersion.version)
        .filter(models.TermVersion.year == year, models.TermVersion.semester == semester)
        .order_by(models.TermVersion.version.desc())
        .first()
    )
    return row[0] if row else 0


def version_map(db: Session) -> dict[str, int]:
    """
    `{"2026-2": 7, "2026-1": 3}` — 학기마다 지금 몇 회차인지.

    프론트가 캐시를 버릴지 판단하는 값이라 매 로그인 확인마다 실립니다. 학기가 몇 개
    안 되고 정수뿐이라 무게가 없습니다.
    """
    rows = (
        db.query(
            models.TermVersion.year,
            models.TermVersion.semester,
            models.TermVersion.version,
        )
        .order_by(models.TermVersion.version.asc())
        .all()
    )
    latest: dict[str, int] = {}
    for year, semester, version in rows:
        latest[f"{year}-{semester}"] = version
    return latest


def record_version(
    db: Session,
    year: int,
    semester: int,
    source: str,
    *,
    note: str | None = None,
    summary: dict | None = None,
    stats: dict | None = None,
) -> models.TermVersion:
    """
    새 회차를 남깁니다. **부르기 전에 정말 바뀌었는지 확인하세요** — 이 함수는
    판단하지 않고 적기만 합니다.
    """
    stats = stats or {}
    entry = models.TermVersion(
        year=year,
        semester=semester,
        version=current_version(db, year, semester) + 1,
        created_at=datetime.datetime.utcnow(),
        source=source,
        note=note,
        summary=summary,
        synced=stats.get("synced"),
        skipped=stats.get("skipped"),
        errors=stats.get("errors"),
        elapsed=stats.get("elapsed"),
        backup_name=stats.get("backup"),
    )
    db.add(entry)
    db.flush()
    return entry


def terms_of_student(db: Session, stu_id: str) -> list[tuple[int, int]]:
    """그 학생이 수강 기록을 가진 학기들 — 이름을 고치면 이 학기들의 캐시가 갈려야 합니다."""
    rows = (
        db.query(models.Class.year, models.Class.semester)
        .join(models.Enrollment, models.Enrollment.classId == models.Class.id)
        .filter(models.Enrollment.stuId == stu_id)
        .filter(at_version(models.Enrollment))
        .filter(at_version(models.Class))
        .distinct()
        .all()
    )
    return [(y, s) for y, s in rows]


def terms_of_teacher(db: Session, teacher: str) -> list[tuple[int, int]]:
    """그 교사가 분반을 맡은 학기들."""
    rows = (
        db.query(models.Class.year, models.Class.semester)
        .filter(models.Class.teacher == teacher)
        .filter(at_version(models.Class))
        .distinct()
        .all()
    )
    return [(y, s) for y, s in rows]


def bump_terms(db: Session, terms: list[tuple[int, int]], note: str) -> None:
    """
    수집이 아닌 변경으로 회차를 올립니다 — 이름 수정처럼 화면에 나가는 내용이 달라질 때.

    행의 유효 구간은 건드리지 않습니다. `students`·`subjects` 에는 버전이 없어서
    **과거 회차를 열어도 이름은 현재 값으로 보입니다.** 그 대신 캐시는 정확히 갈립니다.
    """
    for year, semester in terms:
        record_version(db, year, semester, "edit", note=note)
