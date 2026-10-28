"""ksain.db 의 표.

글 번호는 ksain 의 번호를 그대로 PK 로 씁니다. 구 사이트(ksain.net)에서 쓴 글은 3천 번대,
새 사이트(ksain.kr)에서 쓴 글은 100000 번대이고 둘은 같은 DB 에 있습니다.
"""
import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from backend.ksain.db import Base


class Board(Base):
    __tablename__ = "ksain_boards"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Post(Base):
    """글 하나. `raw` 에 원본 응답을 남겨 정규화를 바꿔도 다시 받지 않게 합니다."""
    __tablename__ = "ksain_posts"
    id = Column(Integer, primary_key=True, autoincrement=False)
    board_id = Column(Integer, nullable=True, index=True)
    board_name = Column(String, nullable=True)
    category = Column(String, nullable=True)
    writer = Column(String, nullable=True)
    title = Column(String, nullable=False, default="")
    eng_title = Column(String, nullable=True)
    content_text = Column(Text, nullable=False, default="")
    eng_content_text = Column(Text, nullable=True)
    posted_at = Column(DateTime, nullable=True, index=True)   # KST
    read_count = Column(Integer, nullable=True)
    is_anonymous = Column(Boolean, default=False, nullable=False)
    content_hash = Column(String, nullable=False)              # 제목·본문·첨부 목록
    raw = Column(JSON, nullable=True)
    fetched_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    # 다시 물었을 때 없어진 글. 지우지 않고 표시만 합니다 — 학사일정 반영만 걷어냅니다
    missing_since = Column(DateTime, nullable=True)

    attachments = relationship("Attachment", back_populates="post", cascade="all, delete-orphan")
    analysis = relationship("Analysis", back_populates="post", uselist=False, cascade="all, delete-orphan")

    @property
    def url(self) -> str:
        return f"https://ksain.kr/document/{self.id}"


class Attachment(Base):
    """첨부 하나. 파일은 저장하지 않고 **텍스트만** 남깁니다 (원본은 ksain 링크로)."""
    __tablename__ = "ksain_attachments"
    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("ksain_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    path = Column(String, nullable=False)
    size = Column(Integer, nullable=True)
    mime = Column(String, nullable=True)
    sha256 = Column(String, nullable=True)
    text = Column(Text, nullable=True)
    # pending · ok · unsupported(이미지 등) · skipped(너무 큼) · error
    status = Column(String, default="pending", nullable=False, index=True)
    error = Column(String, nullable=True)
    extracted_at = Column(DateTime, nullable=True)

    post = relationship("Post", back_populates="attachments")
    __table_args__ = (UniqueConstraint("post_id", "path", name="_ksain_attachment_uc"),)

    @property
    def url(self) -> str:
        from urllib.parse import quote
        return f"https://api.ksain.kr/document/{quote(self.path)}"


class Gap(Base):
    """물어봤더니 없던 번호. 백필이 같은 번호를 매번 다시 묻지 않게 합니다."""
    __tablename__ = "ksain_gaps"
    id = Column(Integer, primary_key=True, autoincrement=False)
    checked_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class State(Base):
    """수집 상태 (마지막 수집 시각·결과 등)."""
    __tablename__ = "ksain_state"
    key = Column(String, primary_key=True)
    value = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)


class Analysis(Base):
    """LLM 분석 결과. 글 내용(`content_hash`)이나 분석기 버전이 바뀌면 다시 돌립니다."""
    __tablename__ = "ksain_analyses"
    post_id = Column(Integer, ForeignKey("ksain_posts.id", ondelete="CASCADE"), primary_key=True)
    content_hash = Column(String, nullable=False)
    version = Column(Integer, nullable=False)
    model = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    importance = Column(Integer, default=0, nullable=False, index=True)  # 0~3
    tags = Column(JSON, default=list, nullable=False)
    mandatory = Column(Boolean, default=False, nullable=False)
    target_grades = Column(JSON, default=list, nullable=False)  # 비어 있으면 전학년
    items = Column(JSON, default=list, nullable=False)          # 일정 항목
    # 학사일정에 반영한 것 [{sig, event_id}] 과, 사람이 지워서 다시 만들지 않을 항목의 sig
    applied = Column(JSON, default=list, nullable=False)
    suppressed = Column(JSON, default=list, nullable=False)
    error = Column(String, nullable=True)
    analyzed_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)

    post = relationship("Post", back_populates="analysis")
