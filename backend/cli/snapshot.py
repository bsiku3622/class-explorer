"""본 DB 를 손으로 떠 둡니다 — 배포 직전처럼 사람이 남기는 백업.

재수집 백업과 같은 함수(`services/backup.py` 의 `create_backup`)라 `backups/` 에 같은 꼴로 남고, ksain 글로
만든 기억·일정과 로그인 세션은 빠집니다. 1년이 지나면 지워집니다. 이유는 그 파일의 머리말에 있습니다.

    python3.14 -m backend.cli.snapshot            # 이름표 manual
    python3.14 -m backend.cli.snapshot deploy     # 이름표 deploy
    python3.14 -m backend.cli.snapshot --scrub-existing   # 이미 있는 백업도 걷어내기 (한 번)

⚠️ **본 DB 를 `cp` 로 복사하지 마세요.** 기억·자동 일정에, 지운 행이 남아 있는 빈 페이지까지 그대로
따라갑니다 — 원문이 지워지면 같이 지운다는 약속(개인정보처리방침)이 그 사본에서는 안 지켜집니다.
"""
from __future__ import annotations

import argparse
import json
import os

from backend.cli import material_backup
from backend.services import backup


def scrub_existing() -> None:
    """이 규칙이 생기기 전에 뜬 백업 — 1년 지난 것은 지우고, 남은 것에서 기억·글에서 온 일정·세션을 걷어냅니다."""
    for name in backup.prune_backups() + material_backup.prune_archives():
        print(f"removed {name}")
    for path in backup.backup_files():
        # 수정 시각을 되돌려 놓습니다 — 이름에 날짜가 없는 옛 손 백업은 그 시각으로 나이를 재서, 그대로 두면
        # 걷어낸 날부터 1년을 다시 셉니다
        stat = os.stat(path)
        backup.scrub_backup(path)
        os.utime(path, (stat.st_atime, stat.st_mtime))
        print(f"scrubbed {os.path.basename(path)}")
    for archive in sorted(material_backup.backup_dir().glob("materials-*.tar.gz")):
        material_backup.scrub_archive(archive)
        print(f"scrubbed {archive.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="본 DB 스냅샷 (ksain 글로 만든 기억·일정과 세션은 뺌)")
    parser.add_argument("label", nargs="?", default="manual", help="파일 이름에 붙는 이름표 (예: deploy)")
    parser.add_argument("--scrub-existing", action="store_true",
                        help="새로 뜨지 않고, 이미 있는 백업을 정리합니다 (1년 지난 것 삭제 + 걷어내기)")
    args = parser.parse_args()
    if args.scrub_existing:
        scrub_existing()
        return
    info = backup.create_backup(args.label)
    print(json.dumps(info, ensure_ascii=False) if info else "본 DB 파일이 없습니다")


if __name__ == "__main__":
    main()
