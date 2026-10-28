"""본 DB 를 손으로 떠 둡니다 — 배포 직전처럼 사람이 남기는 백업.

재수집 백업과 같은 함수(`services/backup.py` 의 `create_backup`)라 `backups/` 에 같은 꼴로 남고, ksain 글로
만든 기억·자동 일정은 빠집니다. 이유는 그 파일의 머리말에 있습니다.

    python3.14 -m backend.cli.snapshot            # 이름표 manual
    python3.14 -m backend.cli.snapshot deploy     # 이름표 deploy

⚠️ **본 DB 를 `cp` 로 복사하지 마세요.** 기억·자동 일정에, 지운 행이 남아 있는 빈 페이지까지 그대로
따라갑니다 — 원문이 지워지면 같이 지운다는 약속(개인정보처리방침)이 그 사본에서는 안 지켜집니다.
"""
from __future__ import annotations

import argparse
import json

from backend.services import backup


def main() -> None:
    parser = argparse.ArgumentParser(description="본 DB 스냅샷 (ksain 글로 만든 기억·자동 일정은 뺌)")
    parser.add_argument("label", nargs="?", default="manual", help="파일 이름에 붙는 이름표 (예: deploy)")
    args = parser.parse_args()
    info = backup.create_backup(args.label)
    print(json.dumps(info, ensure_ascii=False) if info else "본 DB 파일이 없습니다")


if __name__ == "__main__":
    main()
