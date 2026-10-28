"""
DB 스냅샷 — 재수집 직전 상태를 통째로 남깁니다.

재수집은 한 학기를 통째로 갈아 끼우는 작업입니다. 학교 API 가 이상한 값을 주거나
학기를 잘못 지정한 걸 나중에 알아채면, 되돌릴 곳이 파일 말고는 없습니다.

**자동으로 지우지 않습니다.** 오래된 것부터 정리하는 규칙을 두면 하필 그게 필요한
날에 없습니다 — 용량은 목록에 총합으로 띄우고, 지우는 건 사람이 판단합니다.

**ksain 글에서 만든 것과 세션은 넣지 않습니다**(`scrub_backup`) — 기억(`facts`)과 글에서 온 일정,
그리고 로그인 세션. 원문이 지워지면 같이 지운다고 개인정보처리방침에 약속했는데, 자동으로 안 지우는
백업에 들어가면 그 약속이 영영 안 지켜집니다. 둘 다 ksain.db 의 분석에서 다시 만들 수 있어서, 백업에서
되돌린 뒤에는 `python -m backend.ksain.analyze --reapply` 로 채웁니다. ⚠️ 사람이 고치거나 숨긴 기억은
되돌아오지 않습니다 — 숨겼던 사실은 다시 숨겨야 합니다. 세션이 없으니 되돌리면 모두 다시 로그인합니다.
"""

import datetime
import os
import re
import sqlite3
from contextlib import closing

from backend.core.db import main_db_file


# `ksa_timetable-20260818-143012-sync-2026-2.db`
_NAME_PATTERN = re.compile(r"^ksa_timetable-(\d{8})-(\d{6})-(.+)\.db$")
_LABEL_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")

# backups/ 를 만들기 전에 손으로 떠 둔 것들 (`backend/ksa_timetable.db.bak-...`)
_LEGACY_PREFIX = "ksa_timetable.db.bak-"


def db_path() -> str:
    """앱이 실제로 열고 있는 DB 파일 경로."""
    return str(main_db_file())


def _backup_dir() -> str:
    """
    백업은 **DB 옆**에 둡니다 — 코드 옆이 아닙니다.

    두 가지 때문입니다.

    1. **쓸 수 있어야 합니다.** 배포된 서버에서 `backend/` 는 `baeks:baeks 755` 라
       서비스 계정(`ksaclass`)이 디렉토리를 만들 수 없습니다. 코드 옆에 두면 첫 수집이
       백업을 못 만들어 그대로 멈춥니다 — 되돌릴 곳 없이 덮어쓰지 않으려고 그렇게
       해 뒀기 때문입니다
    2. **저장소 안이면 위험합니다.** `backend/` 는 git 작업 트리라 `git clean -fdx`
       한 번에 백업이 통째로 날아갑니다. DB 는 어차피 저장소 밖에 있습니다

    서버의 DB 는 symlink(`backend/ksa_timetable.db` → `../data/ksa_timetable.db`)여서
    실제 위치를 따라갑니다. 로컬은 진짜 파일이라 `backend/backups/` 그대로입니다.
    """
    return os.path.join(os.path.dirname(db_path()), "backups")


BACKUP_DIR = _backup_dir()


def _describe(path: str, label_override: str | None = None) -> dict:
    stat = os.stat(path)
    name = os.path.basename(path)
    matched = _NAME_PATTERN.match(name)
    if matched and label_override is None:
        date, time, label = matched.groups()
        created = f"{date[:4]}-{date[4:6]}-{date[6:]} {time[:2]}:{time[2:4]}:{time[4:]}"
    else:
        label = label_override or ""
        created = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
    return {"name": name, "label": label, "created": created, "bytes": stat.st_size}


def create_backup(label: str) -> dict | None:
    """
    지금 DB 를 `backups/` 에 복사합니다. DB 파일이 아직 없으면 `None`.

    파일 복사가 아니라 sqlite 의 backup API 를 씁니다 — 쓰는 중에 떠도 반쪽짜리
    파일이 나오지 않습니다.
    """
    source_path = db_path()
    if not source_path or not os.path.exists(source_path):
        return None

    os.makedirs(BACKUP_DIR, exist_ok=True)
    safe = _LABEL_SAFE.sub("-", label).strip("-") or "manual"
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")

    # 같은 초에 두 번 부르면 덮어쓰지 않고 뒤에 번호를 답니다
    dest = os.path.join(BACKUP_DIR, f"ksa_timetable-{stamp}-{safe}.db")
    seq = 2
    while os.path.exists(dest):
        dest = os.path.join(BACKUP_DIR, f"ksa_timetable-{stamp}-{safe}-{seq}.db")
        seq += 1

    source = sqlite3.connect(source_path)
    try:
        target = sqlite3.connect(dest)
        try:
            with target:
                source.backup(target)
        finally:
            target.close()
    finally:
        source.close()

    try:
        scrub_backup(dest)
    except Exception:
        os.remove(dest)  # 걷어내지 못한 백업은 남기지 않습니다
        raise

    return _describe(dest)


def scrub_backup(path) -> None:
    """백업 파일에서 넣지 않을 것을 걷어냅니다. 자료 백업(`cli/material_backup.py`)도 씁니다.

    - **ksain 글로 만든 기억과 일정** — `facts`·`facts_fts`, 그리고 글 번호(`source_ref`)가 붙은 일정. 매니저가
      고쳐서 `manual` 이 된 자동 일정도 글에서 왔으니 뺍니다. 원문이 지워지면 같이 지운다고 약속한 것들입니다
    - **세션** — 토큰을 평문으로 들고 있어서 백업 파일이 새면 그 토큰으로 바로 로그인됩니다. 접속 IP 도 들어
      있습니다. 백업에서 되돌리면 모두 다시 로그인합니다

    ⚠️ **VACUUM 까지 해야 합니다.** sqlite 는 지운 행을 빈 페이지에 그대로 두고, backup API 는 그 빈
    페이지까지 복사합니다 — 지우기만 하면 문장이 파일 안에 그대로 남습니다(실험으로 확인했습니다). 본 DB 에서
    이미 지운 행이 빈 페이지에 남아 있던 것도 이때 같이 사라집니다. `facts_fts` 는 표째 지웁니다 — 행만 지우면
    색인 조각에 낱말이 남을 수 있고, 앱이 뜰 때 마이그레이션이 빈 표로 다시 만듭니다. 예전 백업에도 쓸 수 있게
    없는 표·칼럼은 건너뜁니다.
    """
    with closing(sqlite3.connect(path)) as conn:
        tables = {name for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
        if "facts" in tables:
            conn.execute("DELETE FROM facts")
        conn.execute("DROP TABLE IF EXISTS facts_fts")
        if "calendar_events" in tables:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(calendar_events)")}
            conn.execute("DELETE FROM calendar_events WHERE source = 'ksain'"
                         + (" OR source_ref IS NOT NULL" if "source_ref" in columns else ""))
        if "sessions" in tables:
            conn.execute("DELETE FROM sessions")
        conn.commit()
        conn.execute("VACUUM")


def list_backups() -> list[dict]:
    """최신순 목록. 이름이 규칙에서 벗어난 파일도 버리지 않고 수정 시각으로 세웁니다."""
    items: list[dict] = []

    if os.path.isdir(BACKUP_DIR):
        items += [
            _describe(os.path.join(BACKUP_DIR, name))
            for name in os.listdir(BACKUP_DIR)
            if name.endswith(".db")
        ]

    # 예전 방식으로 DB 옆에 떠 둔 백업도 같이 보여 줍니다 — 옮기지는 않습니다
    db_dir = os.path.dirname(db_path())
    if os.path.isdir(db_dir):
        items += [
            _describe(os.path.join(db_dir, name), label_override="legacy")
            for name in os.listdir(db_dir)
            if name.startswith(_LEGACY_PREFIX)
        ]

    return sorted(items, key=lambda item: item["created"], reverse=True)
