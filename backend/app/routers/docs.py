import io
import os
import shutil
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from pypdf import PdfReader

from app.config import settings
from app.database import get_db
from app.models.db_models import Document, User

logger = logging.getLogger("smartdoc.docs")
router = APIRouter(tags=["Document Management"])


class DocumentResponse(BaseModel):
    id: int
    filename: str
    file_size_bytes: int
    mime_type: str
    summary_preview: Optional[str]
    uploaded_at: str
    char_count: int

    class Config:
        from_attributes = True


def extract_text_from_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    """Extract readable text from PDF or plain text files."""
    text_content = ""
    lower_name = filename.lower()
    
    if lower_name.endswith(".pdf") or "pdf" in content_type:
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_content += extracted + "\n"
        except Exception as e:
            logger.error("Error reading PDF %s: %s", filename, e)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Unable to parse PDF document: {str(e)}"
            )
    else:
        # Treat as plain text / markdown / logs
        try:
            text_content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text_content = file_bytes.decode("latin-1")
            except Exception as e:
                logger.error("Encoding error for %s: %s", filename, e)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Uploaded file contains unsupported binary or non-text content."
                )
    
    return text_content.strip()


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a document (PDF or Text), extract textual data, and persist metadata
    in PostgreSQL for downstream AI analysis.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Empty filename provided.")

    allowed_exts = (".pdf", ".txt", ".md", ".json", ".csv", ".log", ".yaml", ".yml")
    if not any(file.filename.lower().endswith(ext) for ext in allowed_exts):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Please upload one of: {', '.join(allowed_exts)}"
        )

    # Read file contents into memory
    content_bytes = await file.read()
    file_size = len(content_bytes)

    if file_size == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if file_size > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=413, detail="File size exceeds 20MB limit.")

    # Extract text
    content_text = extract_text_from_file(content_bytes, file.filename, file.content_type or "")
    if not content_text:
        content_text = f"[Empty text extracted from {file.filename}]"

    # Persist file on disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{int(os.times().elapsed * 1000)}_{os.path.basename(file.filename)}"
    disk_path = os.path.join(settings.UPLOAD_DIR, safe_filename)
    try:
        with open(disk_path, "wb") as f:
            f.write(content_bytes)
    except Exception as e:
        logger.error("Failed to write file to disk: %s", e)
        disk_path = f"/tmp/{safe_filename}"

    # Preview snippet (first 300 chars)
    preview = (content_text[:300] + "...") if len(content_text) > 300 else content_text

    # Default user fallback if table exists
    user = db.query(User).first()
    user_id = user.id if user else None

    # Persist in DB
    db_doc = Document(
        filename=file.filename,
        file_path=disk_path,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/octet-stream",
        content_text=content_text,
        summary_preview=preview,
        user_id=user_id
    )
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    logger.info("Successfully ingested document id=%d, name=%s, size=%d bytes", db_doc.id, db_doc.filename, file_size)

    return DocumentResponse(
        id=db_doc.id,
        filename=db_doc.filename,
        file_size_bytes=db_doc.file_size_bytes,
        mime_type=db_doc.mime_type,
        summary_preview=db_doc.summary_preview,
        uploaded_at=db_doc.uploaded_at.isoformat() if db_doc.uploaded_at else "",
        char_count=len(content_text)
    )


@router.get("/documents", response_model=List[DocumentResponse])
def list_documents(limit: int = 50, db: Session = Depends(get_db)):
    """List recently uploaded documents."""
    docs = db.query(Document).order_by(Document.uploaded_at.desc()).limit(limit).all()
    results = []
    for d in docs:
        results.append(DocumentResponse(
            id=d.id,
            filename=d.filename,
            file_size_bytes=d.file_size_bytes,
            mime_type=d.mime_type,
            summary_preview=d.summary_preview,
            uploaded_at=d.uploaded_at.isoformat() if d.uploaded_at else "",
            char_count=len(d.content_text or "")
        ))
    return results


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    """Retrieve full document text and details by ID."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    return {
        "id": doc.id,
        "filename": doc.filename,
        "file_size_bytes": doc.file_size_bytes,
        "mime_type": doc.mime_type,
        "content_text": doc.content_text,
        "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
    }


@router.delete("/documents/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """Delete a document and cascade its analysis logs."""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    
    # Attempt cleanup from disk
    if doc.file_path and os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return {"message": f"Document {doc_id} deleted successfully."}
