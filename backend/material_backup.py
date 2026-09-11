"""과목 자료 파일의 일일 압축 snapshot. 최근 30개를 유지합니다."""

from __future__ import annotations

import datetime
from contextlib import closing
import hashlib
import os
from pathlib import Path
import sqlite3
import tarfile
import tempfile

from backend.database import engine
from backend.materials_router import storage_root


KEEP_BACKUPS = 30


def backup_dir() -> Path:
    return storage_root().parent / "material-backups"


def database_path() -> Path:
    return Path(engine.url.database or "backend/ksa_timetable.db").resolve()


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


def create_backup() -> Path | None:
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
