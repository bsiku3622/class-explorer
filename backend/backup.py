"""
DB 스냅샷 — 재수집 직전 상태를 통째로 남깁니다.

재수집은 한 학기를 통째로 갈아 끼우는 작업입니다. 학교 API 가 이상한 값을 주거나
학기를 잘못 지정한 걸 나중에 알아채면, 되돌릴 곳이 파일 말고는 없습니다.

**자동으로 지우지 않습니다.** 오래된 것부터 정리하는 규칙을 두면 하필 그게 필요한
날에 없습니다 — 용량은 목록에 총합으로 띄우고, 지우는 건 사람이 판단합니다.
"""

import datetime
import os
import re
import sqlite3

from backend.database import engine


# `ksa_timetable-20260818-143012-sync-2026-2.db`
_NAME_PATTERN = re.compile(r"^ksa_timetable-(\d{8})-(\d{6})-(.+)\.db$")
_LABEL_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")

# backups/ 를 만들기 전에 손으로 떠 둔 것들 (`backend/ksa_timetable.db.bak-...`)
_LEGACY_PREFIX = "ksa_timetable.db.bak-"


def db_path() -> str:
    """앱이 실제로 열고 있는 DB 파일 경로."""
    return os.path.abspath(engine.url.database or "")


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
    resolved = os.path.realpath(db_path()) if db_path() else ""
    base = os.path.dirname(resolved) or os.path.dirname(__file__)
    return os.path.join(base, "backups")


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

    return _describe(dest)


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
