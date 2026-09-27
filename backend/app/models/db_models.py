from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(String(50), default="devops_engineer")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    content_text = Column(Text, nullable=True)
    summary_preview = Column(Text, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    user = relationship("User", back_populates="documents")
    analysis_logs = relationship("AnalysisLog", back_populates="document", cascade="all, delete-orphan")


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    query = Column(Text, nullable=False)
    analysis_mode = Column(String(50), default="qa")
    response = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=False, index=True)
    latency_ms = Column(Float, nullable=False)
    tokens_used = Column(Integer, default=0)
    cached = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    document = relationship("Document", back_populates="analysis_logs")
