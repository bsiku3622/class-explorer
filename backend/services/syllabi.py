"""강의계획서 — 학교가 배포한 2026-1 강의계획서 원본(pdf·docx)과, docx 를 PDF 로 바꾼 미리보기.

⚠️ **git 에 두지 않고 로그인한 사람에게만 줍니다**(`routers/syllabi.py`). 한때
`frontend/src/assets/syllabi/` 에 두고 화면 번들에 실었더니 Netlify 가 로그인 없이 내줬고, 파일 대부분에
교사 이메일·전화번호가 들어 있었습니다. 지금 자리는 `SYLLABI_DIR`, 비우면 **본 DB 의 진짜 위치 옆**
`syllabi/` 입니다 — 서버에서는 `data/syllabi/`, 로컬에서는 `backend/syllabi/`.

폴더 구조는 예전 그대로입니다(학부/학과/파일) — 화면이 경로로 과목을 짝짓습니다
(`frontend/src/lib/syllabi.ts`). docx 의 미리보기는 같은 자리의 `<이름>.preview.pdf` 입니다.

URL 에는 경로 대신 경로의 해시(`id`)만 씁니다. 파일 이름에 교사 이름이 든 것이 있어서, 경로를 그대로
쓰면 접속 로그에 남습니다.
"""
from __future__ import annotations

import hashlib
from pathlib import Path

from backend.core import config
from backend.core.db import main_db_file

MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def root() -> Path:
    if config.SYLLABI_DIR:
        return Path(config.SYLLABI_DIR).resolve()
    return main_db_file().parent / "syllabi"


def file_id(relative: str) -> str:
    """경로 → 바뀌지 않는 짧은 id. 같은 파일이면 언제 물어도 같습니다."""
    return hashlib.sha1(relative.encode("utf-8")).hexdigest()[:16]


def listing() -> list[dict]:
    """`[{id, path, format}]` — `path` 는 `syllabi/` 기준 상대 경로(`/` 구분)입니다.

    폴더 밖을 가리키는 심볼릭 링크는 건너뜁니다 — 목록에 든 것만 내주므로, 여기서 막으면 다른 파일로 새는 길이
    없습니다.
    """
    base = root()
    if not base.is_dir():
        return []
    resolved = base.resolve()
    out = []
    for path in sorted(base.rglob("*")):
        if path.suffix.lower() not in MEDIA_TYPES or path.name.startswith(".") or not path.is_file():
            continue
        if not path.resolve().is_relative_to(resolved):
            continue
        relative = path.relative_to(base).as_posix()
        out.append({"id": file_id(relative), "path": relative, "format": path.suffix.lower()[1:]})
    return out


def find(identifier: str) -> Path | None:
    """id 에 맞는 파일. 경로를 받지 않으므로 목록에 없는 파일은 줄 수 없습니다."""
    for item in listing():
        if item["id"] == identifier:
            return root() / item["path"]
    return None
