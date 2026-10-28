"""과목 자료 파일의 일일 압축 snapshot. 최근 30개를 유지하고, 1년이 지난 것은 지웁니다.

매일 도는 타이머라 **본 DB 백업의 1년 정리**(`services/backup.py` 의 `prune_backups`)도 여기서 같이 돌립니다 —
`baeks` 로 돌아서 API 가 못 지우는 코드 옆의 옛 손 백업까지 지울 수 있습니다.
"""

from __future__ import annotations

import datetime
from contextlib import closing
import hashlib
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile

from backend.core.db import main_db_file
from backend.services.backup import KEEP_DAYS, prune_backups, scrub_backup
from backend.services.materials import storage_root


KEEP_BACKUPS = 30


def backup_dir() -> Path:
    return storage_root().parent / "material-backups"


def database_path() -> Path:
    return main_db_file()


def _signature(db_file: Path, files: list[Path], source: Path) -> str:
    digest = hashlib.sha256()
    with closing(sqlite3.connect(db_file)) as connection:
        for table in ("materials", "material_files"):
            columns = [
                row[1]
                for row in connection.execute(f"PRAGMA table_info({table})")
            ]
            if not columns:
                continue
            query = f"SELECT {', '.join(columns)} FROM {table} ORDER BY id"
            for row in connection.execute(query):
                digest.update(repr(row).encode("utf-8"))
    for path in sorted(files):
        stat_result = path.stat()
        digest.update(str(path.relative_to(source)).encode("utf-8"))
        digest.update(f"{stat_result.st_size}:{stat_result.st_mtime_ns}".encode())
    return digest.hexdigest()


def prune_archives(keep_days: int = KEEP_DAYS) -> list[str]:
    """`keep_days` 가 지난 자료 압축본을 지웁니다 — 자료가 안 바뀌면 새 압축본이 안 생겨서, 개수(30개)만으로는
    몇 년 묵은 것이 남을 수 있습니다."""
    limit = datetime.datetime.now() - datetime.timedelta(days=keep_days)
    removed = []
    for path in sorted(backup_dir().glob("materials-*.tar.gz")):
        # 이름의 시각으로 잽니다(`materials-20260911-025723`) — 걷어내기(`scrub_archive`)가 파일을 다시 써도 그대로입니다
        try:
            created = datetime.datetime.strptime(path.name[len("materials-"):][:15], "%Y%m%d-%H%M%S")
        except ValueError:
            created = datetime.datetime.fromtimestamp(path.stat().st_mtime)
        if created < limit:
            path.unlink()
            removed.append(path.name)
    return removed


def scrub_archive(path: Path) -> None:
    """이미 있는 자료 압축본 안의 DB 에서도 기억·글에서 온 일정·세션을 걷어냅니다(`scrub_backup`). 한 번만 씁니다
    (`python -m backend.cli.snapshot --scrub-existing`)."""
    with tempfile.TemporaryDirectory(dir=path.parent) as temp_name:
        temp = Path(temp_name)
        with tarfile.open(path, "r:gz") as archive:
            archive.extractall(temp, filter="data")
        database = temp / "ksa_timetable.db"
        if database.is_file():
            scrub_backup(database)
        rebuilt = path.with_suffix(path.suffix + ".tmp")
        with tarfile.open(rebuilt, "w:gz") as archive:
            for item in sorted(temp.rglob("*")):
                if item.is_file():
                    archive.add(item, arcname=str(item.relative_to(temp)))
        os.replace(rebuilt, path)


def create_backup() -> Path | None:
    for name in prune_backups() + prune_archives():
        print(f"[materials-backup] removed {name} (older than {KEEP_DAYS} days)")
    source = storage_root()
    db_file = database_path()
    files = (
        [
            path
            for path in source.rglob("*")
            if path.is_file() and ".tmp" not in path.parts
        ]
        if source.exists()
        else []
    )
    if not db_file.is_file():
        print("[materials-backup] database not found")
        return None

    destination_dir = backup_dir()
    destination_dir.mkdir(parents=True, exist_ok=True)
    signature = _signature(db_file, files, source)
    state_file = destination_dir / ".last-signature"
    if state_file.is_file() and state_file.read_text(encoding="ascii") == signature:
        print("[materials-backup] no changes")
        return None

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    destination = destination_dir / f"materials-{stamp}.tar.gz"
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with tempfile.TemporaryDirectory(dir=destination_dir) as temp_name:
        database_snapshot = Path(temp_name) / "ksa_timetable.db"
        with (
            closing(sqlite3.connect(db_file)) as live_database,
            closing(sqlite3.connect(database_snapshot)) as snapshot_database,
        ):
            live_database.backup(snapshot_database)
        # 기억·글에서 온 일정·세션은 빼고 묶습니다 — 이유는 services/backup.py 의 scrub_backup
        scrub_backup(database_snapshot)

        with tarfile.open(temporary, "w:gz") as archive:
            archive.add(database_snapshot, arcname="ksa_timetable.db")
            for path in files:
                archive.add(
                    path,
                    arcname=Path("materials") / path.relative_to(source),
                )
    os.replace(temporary, destination)
    state_temporary = state_file.with_suffix(".tmp")
    state_temporary.write_text(signature, encoding="ascii")
    os.replace(state_temporary, state_file)

    for old in sorted(destination_dir.glob("materials-*.tar.gz"), reverse=True)[KEEP_BACKUPS:]:
        old.unlink()

    print(f"[materials-backup] created {destination}")
    return destination


if __name__ == "__main__":
    create_backup()
