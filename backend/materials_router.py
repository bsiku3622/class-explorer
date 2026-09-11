"""인증된 과목 자료실: 업로드, 검수, preview와 다운로드."""

from __future__ import annotations

import datetime
import logging
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import subprocess
import tempfile
from typing import Annotated, Literal
from urllib.parse import quote
import uuid
import zipfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from backend import models
from backend.auth import get_current_admin, get_current_user, get_db
from backend.database import engine
from backend.versioning import at_version


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/materials", tags=["materials"])
admin_router = APIRouter(prefix="/admin/materials", tags=["admin", "materials"])

MaterialCategory = Literal[
    "syllabus", "lecture_note", "worksheet", "assignment", "reference", "other"
]
MaterialStatus = Literal["pending", "approved", "rejected"]

MAX_UPLOAD_BYTES = 50 * 1024 * 1024
MAX_REQUEST_BYTES = 90 * 1024 * 1024
MAX_EXTRACTED_BYTES = 300 * 1024 * 1024
MAX_DIRECT_FILES = 20
MAX_BUNDLE_FILES = 100
MAX_COMPRESSION_RATIO = 100

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".pptx", ".xlsx"
}
UPLOAD_EXTENSIONS = ALLOWED_EXTENSIONS | {".zip"}
MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


class MaterialPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    subject_id: int | None = None
    category: MaterialCategory | None = None
    description: str | None = Field(default=None, max_length=1000)


class MaterialDecision(MaterialPatch):
    status: Literal["approved", "rejected"]
    rejection_reason: str | None = Field(default=None, max_length=500)
    primary_syllabus: bool = False


def storage_root() -> Path:
    configured = os.environ.get("MATERIAL_STORAGE_DIR")
    if configured:
        return Path(configured).resolve()
    db_file = Path(engine.url.database or "backend/ksa_timetable.db").resolve()
    return db_file.resolve().parent / "materials"


def _material_dir(material: models.Material) -> Path:
    return storage_root() / material.storage_key


def _subject_label(subject: models.Subject) -> str:
    return f"{subject.name}(EC)" if subject.is_ec else subject.name


def _file_dict(item: models.MaterialFile) -> dict:
    return {
        "id": item.id,
        "name": item.relative_name,
        "media_type": item.media_type,
        "size_bytes": item.size_bytes,
        "preview_available": bool(item.preview_name),
        "preview_media_type": item.preview_media_type,
    }


def _material_dict(material: models.Material, *, admin: bool = False) -> dict:
    result = {
        "id": material.id,
        "term": {"year": material.year, "semester": material.semester},
        "subject": {
            "id": material.subject.id,
            "name": material.subject.name,
            "label": _subject_label(material.subject),
            "english": material.subject.name_english,
            "is_ec": material.subject.is_ec,
        },
        "title": material.title,
        "category": material.category,
        "description": material.description,
        "status": material.status,
        "rejection_reason": material.rejection_reason,
        "primary_syllabus": material.primary_syllabus,
        "files": [_file_dict(item) for item in material.files],
        "created_at": material.created_at.isoformat(),
        "updated_at": material.updated_at.isoformat(),
    }
    if admin:
        result["uploader"] = {
            "id": material.uploader.id,
            "username": material.uploader.username,
            "stu_id": material.uploader.stu_id,
        }
        result["decided_at"] = (
            material.decided_at.isoformat() if material.decided_at else None
        )
    return result


def _query_materials(db: Session):
    return db.query(models.Material).options(
        joinedload(models.Material.subject),
        joinedload(models.Material.files),
        joinedload(models.Material.uploader),
    )


def _opened_subject(
    db: Session, subject_id: int, year: int, semester: int
) -> models.Subject:
    subject = (
        db.query(models.Subject)
        .join(models.Class, models.Class.subject_id == models.Subject.id)
        .filter(
            models.Subject.id == subject_id,
            models.Class.year == year,
            models.Class.semester == semester,
            at_version(models.Class),
        )
        .first()
    )
    if subject is None:
        raise HTTPException(status_code=422, detail="해당 학기에 개설된 과목이 아닙니다.")
    return subject


def _safe_relative_name(name: str) -> str:
    normalized = name.replace("\\", "/").strip("/")
    path = PurePosixPath(normalized)
    if not normalized or path.is_absolute() or ".." in path.parts:
        raise HTTPException(status_code=422, detail="ZIP 안에 안전하지 않은 경로가 있습니다.")
    if any(part.startswith(".") for part in path.parts):
        raise HTTPException(status_code=422, detail="숨김 파일은 업로드할 수 없습니다.")
    return str(path)


def _check_package(path: Path, extension: str) -> None:
    try:
        with zipfile.ZipFile(path) as package:
            items = package.infolist()
            names = {item.filename for item in items}
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail=f"손상된 {extension[1:].upper()} 파일입니다.") from exc

    required_prefix = {".docx": "word/", ".pptx": "ppt/", ".xlsx": "xl/"}[extension]
    if "[Content_Types].xml" not in names or not any(
        name.startswith(required_prefix) for name in names
    ):
        raise HTTPException(status_code=422, detail=f"올바른 {extension[1:].upper()} 파일이 아닙니다.")
    if len(items) > 2_000:
        raise HTTPException(status_code=422, detail="비정상적으로 많은 항목이 든 문서입니다.")
    total_size = 0
    for item in items:
        if item.flag_bits & 0x1:
            raise HTTPException(status_code=422, detail="암호화된 문서는 검사할 수 없습니다.")
        total_size += item.file_size
        if total_size > MAX_EXTRACTED_BYTES:
            raise HTTPException(status_code=413, detail="문서 압축 해제 크기는 최대 300MB입니다.")
        if item.compress_size and item.file_size / item.compress_size > MAX_COMPRESSION_RATIO:
            raise HTTPException(status_code=422, detail="비정상적인 압축률의 문서입니다.")
        if item.filename.lower().endswith("vbaproject.bin"):
            raise HTTPException(status_code=422, detail="매크로가 든 문서는 업로드할 수 없습니다.")


def _validate_file(path: Path, extension: str) -> None:
    with path.open("rb") as stream:
        head = stream.read(16)
    valid = True
    if extension == ".pdf":
        valid = head.startswith(b"%PDF-")
    elif extension == ".png":
        valid = head.startswith(b"\x89PNG\r\n\x1a\n")
    elif extension in {".jpg", ".jpeg"}:
        valid = head.startswith(b"\xff\xd8\xff")
    elif extension == ".webp":
        valid = head.startswith(b"RIFF") and head[8:12] == b"WEBP"
    elif extension in {".docx", ".pptx", ".xlsx"}:
        _check_package(path, extension)
        return
    if not valid:
        raise HTTPException(status_code=422, detail=f"확장자와 실제 파일 형식이 다릅니다: {path.name}")


def _scan_file(path: Path) -> None:
    scanner = shutil.which("clamscan")
    if scanner is None:
        return
    result = subprocess.run(
        [scanner, "--no-summary", str(path)],
        capture_output=True,
        text=True,
        timeout=180,
    )
    if result.returncode == 1:
        raise HTTPException(status_code=422, detail="악성 파일로 의심되어 업로드를 중단했습니다.")
    if result.returncode != 0:
        logger.error("ClamAV failed for %s: %s", path.name, result.stderr)
        raise HTTPException(status_code=503, detail="파일 보안 검사를 완료하지 못했습니다.")


def _convert_office(path: Path, output_dir: Path) -> Path:
    converter = shutil.which("libreoffice") or shutil.which("soffice")
    if converter is None:
        raise HTTPException(
            status_code=503,
            detail="문서 preview 변환기가 준비되지 않았습니다. 관리자에게 알려주세요.",
        )
    profile = output_dir / f"lo-{uuid.uuid4().hex}"
    result = subprocess.run(
        [
            converter,
            "--headless",
            f"-env:UserInstallation={profile.as_uri()}",
            "--convert-to",
            "pdf",
            "--outdir",
            str(output_dir),
            str(path),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    converted = output_dir / f"{path.stem}.pdf"
    if result.returncode != 0 or not converted.exists():
        logger.error("LibreOffice conversion failed for %s: %s", path.name, result.stderr)
        raise HTTPException(status_code=422, detail=f"preview로 변환하지 못했습니다: {path.name}")
    return converted


async def _copy_upload(upload: UploadFile, destination: Path) -> int:
    written = 0
    with destination.open("wb") as target:
        while chunk := await upload.read(1024 * 1024):
            written += len(chunk)
            if written > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail="파일 하나는 최대 50MB까지 올릴 수 있습니다.")
            target.write(chunk)
    await upload.close()
    if written == 0:
        raise HTTPException(status_code=422, detail="빈 파일은 업로드할 수 없습니다.")
    return written


def _extract_zip(archive_path: Path, work_dir: Path) -> list[tuple[Path, str]]:
    extracted: list[tuple[Path, str]] = []
    total_size = 0
    try:
        archive = zipfile.ZipFile(archive_path)
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=422, detail="손상된 ZIP 파일입니다.") from exc

    with archive:
        files = [item for item in archive.infolist() if not item.is_dir()]
        if len(files) > MAX_BUNDLE_FILES:
            raise HTTPException(status_code=413, detail="ZIP에는 최대 100개 파일을 담을 수 있습니다.")
        for item in files:
            mode = item.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise HTTPException(status_code=422, detail="ZIP 안의 심볼릭 링크는 허용하지 않습니다.")
            if item.flag_bits & 0x1:
                raise HTTPException(status_code=422, detail="암호화된 ZIP은 검사할 수 없습니다.")
            relative_name = _safe_relative_name(item.filename)
            extension = Path(relative_name).suffix.lower()
            if extension not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=422,
                    detail=f"ZIP에 허용되지 않은 파일이 있습니다: {relative_name}",
                )
            if item.file_size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=413, detail=f"압축 해제 파일이 50MB를 넘습니다: {relative_name}")
            if item.compress_size and item.file_size / item.compress_size > MAX_COMPRESSION_RATIO:
                raise HTTPException(status_code=422, detail="비정상적인 압축률의 ZIP입니다.")
            total_size += item.file_size
            if total_size > MAX_EXTRACTED_BYTES:
                raise HTTPException(status_code=413, detail="ZIP 압축 해제 크기는 최대 300MB입니다.")

            destination = work_dir / f"extract-{uuid.uuid4().hex}{extension}"
            with archive.open(item) as source, destination.open("wb") as target:
                shutil.copyfileobj(source, target)
            if destination.stat().st_size != item.file_size:
                raise HTTPException(status_code=422, detail="ZIP 파일 크기 검증에 실패했습니다.")
            extracted.append((destination, relative_name))
    if not extracted:
        raise HTTPException(status_code=422, detail="ZIP 안에 업로드할 파일이 없습니다.")
    return extracted


def _prepare_files(
    source_files: list[tuple[Path, str]], work_dir: Path
) -> list[dict]:
    prepared: list[dict] = []
    if len(source_files) > MAX_BUNDLE_FILES:
        raise HTTPException(status_code=413, detail="자료 하나에는 최대 100개 파일을 담을 수 있습니다.")
    for path, relative_name in source_files:
        extension = path.suffix.lower()
        _validate_file(path, extension)
        _scan_file(path)
        preview_path: Path | None = None
        preview_media_type: str | None = None
        if extension in {".docx", ".pptx", ".xlsx"}:
            preview_path = _convert_office(path, work_dir)
            _validate_file(preview_path, ".pdf")
            preview_media_type = "application/pdf"
        elif extension in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
            preview_path = path
            preview_media_type = MEDIA_TYPES[extension]
        prepared.append(
            {
                "path": path,
                "relative_name": relative_name,
                "extension": extension,
                "media_type": MEDIA_TYPES[extension],
                "size_bytes": path.stat().st_size,
                "preview_path": preview_path,
                "preview_media_type": preview_media_type,
            }
        )
    return prepared


@router.get("/subjects")
def list_material_subjects(
    year: int = Query(ge=2000, le=2100),
    semester: int = Query(ge=1, le=2),
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    subjects = (
        db.query(models.Subject)
        .join(models.Class, models.Class.subject_id == models.Subject.id)
        .filter(
            models.Class.year == year,
            models.Class.semester == semester,
            at_version(models.Class),
        )
        .distinct()
        .order_by(models.Subject.name, models.Subject.is_ec)
        .all()
    )
    return [
        {
            "id": subject.id,
            "label": _subject_label(subject),
            "name": subject.name,
            "english": subject.name_english,
            "is_ec": subject.is_ec,
        }
        for subject in subjects
    ]


@router.get("")
def list_materials(
    year: int | None = Query(default=None, ge=2000, le=2100),
    semester: int | None = Query(default=None, ge=1, le=2),
    subject_id: int | None = None,
    category: MaterialCategory | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
):
    query = _query_materials(db).filter(models.Material.status == "approved")
    if year is not None:
        query = query.filter(models.Material.year == year)
    if semester is not None:
        query = query.filter(models.Material.semester == semester)
    if subject_id is not None:
        query = query.filter(models.Material.subject_id == subject_id)
    if category is not None:
        query = query.filter(models.Material.category == category)
    rows = query.order_by(
        models.Material.primary_syllabus.desc(), models.Material.created_at.desc()
    ).all()
    return [_material_dict(row) for row in rows]


@router.get("/mine")
def list_my_materials(
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    rows = (
        _query_materials(db)
        .filter(models.Material.uploader_id == current.id)
        .order_by(models.Material.created_at.desc())
        .all()
    )
    return [_material_dict(row) for row in rows]


@router.post("", status_code=201)
async def create_material(
    title: Annotated[str, Form(min_length=1, max_length=120)],
    subject_id: Annotated[int, Form()],
    year: Annotated[int, Form(ge=2000, le=2100)],
    semester: Annotated[int, Form(ge=1, le=2)],
    category: Annotated[MaterialCategory, Form()],
    files: Annotated[list[UploadFile], File()],
    description: Annotated[str, Form(max_length=1000)] = "",
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    clean_title = title.strip()
    if not clean_title:
        raise HTTPException(status_code=422, detail="제목을 입력해주세요.")
    _opened_subject(db, subject_id, year, semester)
    if not files or len(files) > MAX_DIRECT_FILES:
        raise HTTPException(status_code=413, detail="한 번에 최대 20개 파일을 선택할 수 있습니다.")

    root = storage_root()
    temp_root = root / ".tmp"
    temp_root.mkdir(parents=True, exist_ok=True)
    storage_key = uuid.uuid4().hex
    final_dir = root / storage_key

    with tempfile.TemporaryDirectory(dir=temp_root) as temp_name:
        work_dir = Path(temp_name)
        source_files: list[tuple[Path, str]] = []
        total_uploaded = 0
        for upload in files:
            filename = Path((upload.filename or "").replace("\\", "/")).name
            extension = Path(filename).suffix.lower()
            if extension not in UPLOAD_EXTENSIONS:
                raise HTTPException(status_code=422, detail=f"허용되지 않은 파일 형식입니다: {filename}")
            staged = work_dir / f"upload-{uuid.uuid4().hex}{extension}"
            total_uploaded += await _copy_upload(upload, staged)
            if total_uploaded > MAX_REQUEST_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail="한 번의 업로드는 총 90MB까지 가능합니다.",
                )
            if extension == ".zip":
                source_files.extend(_extract_zip(staged, work_dir))
            else:
                source_files.append((staged, filename))

        prepared = _prepare_files(source_files, work_dir)
        final_dir.mkdir(parents=True)
        file_rows: list[models.MaterialFile] = []
        try:
            for item in prepared:
                stored_name = f"{uuid.uuid4().hex}{item['extension']}"
                shutil.copy2(item["path"], final_dir / stored_name)
                preview_name = None
                preview_path = item["preview_path"]
                if preview_path is item["path"]:
                    preview_name = stored_name
                elif preview_path is not None:
                    preview_name = f"{uuid.uuid4().hex}.preview.pdf"
                    shutil.copy2(preview_path, final_dir / preview_name)
                file_rows.append(
                    models.MaterialFile(
                        relative_name=item["relative_name"],
                        stored_name=stored_name,
                        preview_name=preview_name,
                        media_type=item["media_type"],
                        preview_media_type=item["preview_media_type"],
                        size_bytes=item["size_bytes"],
                    )
                )

            material = models.Material(
                storage_key=storage_key,
                subject_id=subject_id,
                year=year,
                semester=semester,
                title=clean_title,
                category=category,
                description=description.strip() or None,
                uploader_id=current.id,
                files=file_rows,
            )
            db.add(material)
            db.commit()
            db.refresh(material)
            return _material_dict(material)
        except Exception:
            db.rollback()
            shutil.rmtree(final_dir, ignore_errors=True)
            raise


@router.patch("/{material_id}")
def update_material(
    material_id: int,
    body: MaterialPatch,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    material = _query_materials(db).filter(models.Material.id == material_id).first()
    if material is None or material.uploader_id != current.id:
        raise HTTPException(status_code=404, detail="자료를 찾을 수 없습니다.")
    if material.status == "rejected":
        raise HTTPException(status_code=409, detail="거절된 자료는 철회 후 다시 올려주세요.")
    patch = body.model_dump(exclude_unset=True)
    if "subject_id" in patch:
        _opened_subject(db, patch["subject_id"], material.year, material.semester)
    for key, value in patch.items():
        clean_value = value.strip() if isinstance(value, str) else value
        if key == "title" and not clean_value:
            raise HTTPException(status_code=422, detail="제목을 입력해주세요.")
        setattr(material, key, clean_value)
    if material.status == "approved":
        material.status = "pending"
        material.primary_syllabus = False
        material.decided_by_id = None
        material.decided_at = None
    material.rejection_reason = None
    db.commit()
    return _material_dict(material)


@router.delete("/{material_id}")
def withdraw_material(
    material_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if material is None or material.uploader_id != current.id:
        raise HTTPException(status_code=404, detail="자료를 찾을 수 없습니다.")
    if material.status == "approved":
        raise HTTPException(status_code=409, detail="승인된 자료의 삭제는 관리자에게 요청해주세요.")
    directory = _material_dir(material)
    db.delete(material)
    db.commit()
    shutil.rmtree(directory, ignore_errors=True)
    return {"detail": "Withdrawn"}


def _authorized_file(
    file_id: int, db: Session, current: models.User
) -> tuple[models.MaterialFile, models.Material]:
    item = (
        db.query(models.MaterialFile)
        .options(joinedload(models.MaterialFile.material))
        .filter(models.MaterialFile.id == file_id)
        .first()
    )
    if item is None:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    material = item.material
    if not (
        material.status == "approved"
        or material.uploader_id == current.id
        or current.has_role("admin")
    ):
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")
    return item, material


@router.get("/files/{file_id}/preview")
def preview_file(
    file_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    item, material = _authorized_file(file_id, db, current)
    if not item.preview_name:
        raise HTTPException(status_code=404, detail="이 파일은 preview를 지원하지 않습니다.")
    path = _material_dir(material) / item.preview_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="preview 파일이 없습니다.")
    filename = Path(item.relative_name).stem + (".pdf" if item.preview_media_type == "application/pdf" else Path(item.relative_name).suffix)
    return FileResponse(
        path,
        media_type=item.preview_media_type or "application/octet-stream",
        headers={
            "Cache-Control": "private, max-age=3600",
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(filename)}",
        },
    )


@router.get("/files/{file_id}/download")
def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_user),
):
    item, material = _authorized_file(file_id, db, current)
    path = _material_dir(material) / item.stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="원본 파일이 없습니다.")
    return FileResponse(
        path,
        media_type=item.media_type,
        filename=Path(item.relative_name).name,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@admin_router.get("")
def admin_list_materials(
    status: MaterialStatus | None = None,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    query = _query_materials(db)
    if status is not None:
        query = query.filter(models.Material.status == status)
    rows = query.order_by(
        (models.Material.status == "pending").desc(), models.Material.created_at.desc()
    ).all()
    return [_material_dict(row, admin=True) for row in rows]


@admin_router.patch("/{material_id}")
def decide_material(
    material_id: int,
    body: MaterialDecision,
    db: Session = Depends(get_db),
    current: models.User = Depends(get_current_admin),
):
    material = _query_materials(db).filter(models.Material.id == material_id).first()
    if material is None:
        raise HTTPException(status_code=404, detail="자료를 찾을 수 없습니다.")
    patch = body.model_dump(exclude={"status", "rejection_reason", "primary_syllabus"}, exclude_unset=True)
    if "subject_id" in patch:
        _opened_subject(db, patch["subject_id"], material.year, material.semester)
    for key, value in patch.items():
        clean_value = value.strip() if isinstance(value, str) else value
        if key == "title" and not clean_value:
            raise HTTPException(status_code=422, detail="제목을 입력해주세요.")
        setattr(material, key, clean_value)

    if body.status == "rejected" and not (body.rejection_reason or "").strip():
        raise HTTPException(status_code=422, detail="거절 사유를 입력해주세요.")
    material.status = body.status
    material.rejection_reason = (
        body.rejection_reason.strip() if body.status == "rejected" and body.rejection_reason else None
    )
    material.decided_by_id = current.id
    material.decided_at = datetime.datetime.utcnow()
    material.primary_syllabus = bool(
        body.status == "approved"
        and material.category == "syllabus"
        and body.primary_syllabus
    )
    if material.primary_syllabus:
        (
            db.query(models.Material)
            .filter(
                models.Material.id != material.id,
                models.Material.subject_id == material.subject_id,
                models.Material.year == material.year,
                models.Material.semester == material.semester,
                models.Material.primary_syllabus.is_(True),
            )
            .update({"primary_syllabus": False}, synchronize_session=False)
        )
    db.commit()
    return _material_dict(material, admin=True)


@admin_router.delete("/{material_id}")
def admin_delete_material(
    material_id: int,
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_admin),
):
    material = db.query(models.Material).filter(models.Material.id == material_id).first()
    if material is None:
        raise HTTPException(status_code=404, detail="자료를 찾을 수 없습니다.")
    directory = _material_dir(material)
    db.delete(material)
    db.commit()
    shutil.rmtree(directory, ignore_errors=True)
    return {"detail": "Deleted"}
