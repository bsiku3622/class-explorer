"""과목 자료 원본의 자리 — 자료실 라우터·계정 삭제(admin)·자료 백업 CLI 가 같이 씁니다.

`MATERIAL_STORAGE_DIR` 이 없으면 **본 DB 의 진짜 위치 옆** `materials/` 입니다. 서버에서는 DB 가
`data/` 를 가리키는 symlink 라 `data/materials/` 가 되고, API 서비스(`ProtectSystem=strict`)가
쓸 수 있는 곳도 `data/` 뿐입니다.

⚠️ 본 DB 파일을 옮기거나 이름을 바꾸면 이 폴더도 같이 옮겨 가서, 이미 올라온 자료가 404 가
됩니다. 옮길 일이 있으면 `MATERIAL_STORAGE_DIR` 을 먼저 지금 자리로 박아 두세요.
"""
from pathlib import Path

from backend import models
from backend.core import config
from backend.core.db import main_db_file


def storage_root() -> Path:
    if config.MATERIAL_STORAGE_DIR:
        return Path(config.MATERIAL_STORAGE_DIR).resolve()
    return main_db_file().parent / "materials"


def material_dir(material: models.Material) -> Path:
    return storage_root() / material.storage_key
