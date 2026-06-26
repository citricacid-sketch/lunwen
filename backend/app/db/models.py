"""SQLAlchemy ORM models for the multi-user web system."""

import datetime

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON,
)
from sqlalchemy.orm import DeclarativeBase, relationship

_utcnow = lambda: datetime.datetime.now(datetime.UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="user", comment="admin|user")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    profiles = relationship("LLMProfile", back_populates="user", cascade="all, delete-orphan")
    histories = relationship("History", back_populates="user", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")


class LLMProfile(Base):
    __tablename__ = "llm_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False, default="默认配置")
    provider = Column(String(50), nullable=False, default="openai")
    encrypted_api_key = Column(Text, nullable=False, default="")
    base_url = Column(String(500), nullable=False, default="https://api.openai.com/v1")
    model = Column(String(100), nullable=False, default="gpt-4o")
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="profiles")


class History(Base):
    __tablename__ = "history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False, comment="rewrite|diagram")
    mode = Column(String(50), nullable=True)
    original_text = Column(Text, nullable=True)
    result_text = Column(Text, nullable=True)
    quality_report = Column(JSON, nullable=True)
    label = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="histories")


class Document(Base):
    """Metadata for RAG-indexed documents."""

    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    chunk_count = Column(Integer, default=0)
    char_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=_utcnow)

    user = relationship("User", back_populates="documents")
