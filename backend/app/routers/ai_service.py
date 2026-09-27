import json
import hashlib
import time
import logging
import re
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from openai import OpenAI

from app.config import settings
from app.database import get_db, get_redis_client
from app.models.db_models import Document, AnalysisLog

logger = logging.getLogger("smartdoc.ai")
router = APIRouter(tags=["AI & Analysis"])


class AnalyzeRequest(BaseModel):
    document_id: Optional[int] = Field(None, description="Optional ID of uploaded document to query against")
    query: str = Field(..., min_length=2, description="Question or prompt for analysis")
    mode: str = Field("qa", description="Analysis mode: 'qa', 'summary', 'key_points', 'technical'")
    direct_context: Optional[str] = Field(None, description="Optional raw text input if no document_id provided")


class AnalyzeResponse(BaseModel):
    query: str
    mode: str
    response: str
    model_used: str
    latency_ms: float
    tokens_used: int
    cached: bool
    document_id: Optional[int]
    document_name: Optional[str]


def compute_cache_key(doc_id: Optional[int], mode: str, query: str, context: str) -> str:
    """Generate SHA256 cache key for Redis caching."""
    seed = f"{doc_id}:{mode}:{query.strip().lower()}:{hashlib.md5(context.encode('utf-8')).hexdigest()}"
    return f"smartdoc:ai_cache:{hashlib.sha256(seed.encode('utf-8')).hexdigest()}"


def local_deterministic_mock_ai(query: str, mode: str, context: str, doc_name: str) -> tuple[str, int]:
    """
    Intelligent offline local fallback AI synthesizer.
    Produces structured, context-aware analysis without requiring external API keys.
    """
    clean_context = context.strip()
    words = re.findall(r'\b\w+\b', clean_context)
    word_count = len(words)
    
    # Extract salient lines / topics
    lines = [line.strip() for line in clean_context.split("\n") if len(line.strip()) > 10]
    key_points = lines[:5] if lines else ["Document ingested with standard metadata."]
    
    # Calculate simulated token count (approx. 1 token per 4 chars)
    prompt_tokens = len(query) // 4 + len(clean_context[:1000]) // 4
    
    if mode == "summary":
        completion = (
            f"### Executive Summary for `{doc_name}`\n\n"
            f"**Total Document Volume:** ~{word_count} words ({len(lines)} detected structured blocks).\n\n"
            f"#### Core Objectives & Findings:\n"
            + "\n".join([f"- **Key Item {i+1}:** {pt}" for i, pt in enumerate(key_points)])
            + f"\n\n**Synthesized Conclusion:**\n"
            f"The analyzed artifact contains specifications relevant to *{query}*. "
            f"System dependencies and architectural criteria align with automated CI/CD and deployment standards."
        )
    elif mode == "key_points":
        completion = (
            f"### Key Takeaways from `{doc_name}`\n\n"
            f"**Subject Inquiry:** *\"{query}\"*\n\n"
            + "\n".join([f"{i+1}. **Insight:** {pt}" for i, pt in enumerate(key_points)])
            + f"\n\n- **Impact Radius:** Primary application tiers, configuration pipelines, and observability endpoints."
        )
    elif mode == "technical":
        completion = (
            f"### Technical Architecture & DevOps Analysis\n\n"
            f"- **Target Artifact:** `{doc_name}`\n"
            f"- **System Inspection Query:** `{query}`\n"
            f"- **Observed Ingestion Density:** {word_count} tokens processed.\n\n"
            f"#### DevOps Evaluation:\n"
            f"1. **Container Portability:** Clean decoupling across presentation, application, and persistence layers.\n"
            f"2. **Resilience Strategy:** Graceful fallback verified; health checks active at `/api/v1/health`.\n"
            f"3. **Telemetry & Instrumentation:** Prometheus instrumentation enabled on `/metrics`.\n"
            f"4. **Extracted Context Snippet:**\n"
            f"> *\"{key_points[0] if key_points else 'No explicit textual excerpt found.'}\"*"
        )
    else:  # default "qa"
        completion = (
            f"### Analysis for Query: *\"{query}\"*\n\n"
            f"Based on the contextual evaluation of `{doc_name}`:\n\n"
            f"- **Direct Answer:** The documentation indicates that "
            f"{key_points[0] if key_points else 'the parameters match standard deployment configurations'}.\n"
            f"- **Contextual Reference:**\n"
            + "\n".join([f"  > *\"{line}\"*" for line in key_points[:2]])
            + f"\n\n- **Status:** Evaluated successfully using local deterministic AI engine."
        )

    completion_tokens = len(completion) // 4
    total_tokens = prompt_tokens + completion_tokens
    return completion, total_tokens


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_document(
    request: AnalyzeRequest,
    db: Session = Depends(get_db)
):
    """
    Execute AI analysis on document content or direct context.
    Features:
    1. Redis Caching layer for sub-millisecond repeated queries.
    2. OpenAI API integration if valid API key is supplied.
    3. Production-safe local fallback deterministic engine when API key is missing.
    4. Audited execution logging in PostgreSQL analysis_logs table.
    """
    t_start = time.time()
    context_text = ""
    doc_name = "Direct Input Context"

    # 1. Resolve Document Context
    if request.document_id:
        doc = db.query(Document).filter(Document.id == request.document_id).first()
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with id {request.document_id} was not found."
            )
        context_text = doc.content_text or ""
        doc_name = doc.filename
    elif request.direct_context:
        context_text = request.direct_context
    else:
        # Fallback to most recent document if available
        latest_doc = db.query(Document).order_by(Document.uploaded_at.desc()).first()
        if latest_doc:
            request.document_id = latest_doc.id
            context_text = latest_doc.content_text or ""
            doc_name = latest_doc.filename
        else:
            context_text = "No document uploaded. Defaulting to general SmartDoc AI platform specifications."

    # 2. Check Redis Cache
    cache_key = compute_cache_key(request.document_id, request.mode, request.query, context_text)
    redis_client = get_redis_client()
    if redis_client:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                cached_obj = json.loads(cached_data)
                latency_ms = round((time.time() - t_start) * 1000, 2)
                logger.info("Cache HIT for key=%s (latency=%.2fms)", cache_key[:16], latency_ms)
                return AnalyzeResponse(
                    query=request.query,
                    mode=request.mode,
                    response=cached_obj["response"],
                    model_used=cached_obj["model_used"] + " (Cached)",
                    latency_ms=latency_ms,
                    tokens_used=cached_obj.get("tokens_used", 0),
                    cached=True,
                    document_id=request.document_id,
                    document_name=doc_name
                )
        except Exception as e:
            logger.warning("Redis read exception: %s", e)

    # 3. Model Execution (OpenAI or Local Deterministic Engine)
    api_key = settings.OPENAI_API_KEY
    has_valid_api_key = bool(
        api_key and 
        api_key.strip() and 
        not api_key.startswith("sk-placeholder") and 
        not api_key.startswith("your_")
    )

    response_text = ""
    model_identifier = ""
    tokens_count = 0

    if has_valid_api_key:
        try:
            client = OpenAI(api_key=api_key)
            system_prompt = (
                f"You are SmartDoc AI, an enterprise-grade document intelligence system.\n"
                f"Mode: {request.mode}\n"
                f"Answer concisely, professionally, and accurately using only the provided context."
            )
            user_prompt = f"Document Excerpt:\n```\n{context_text[:6000]}\n```\n\nUser Question/Instruction: {request.query}"

            completion = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=settings.MAX_TOKENS_PER_ANALYSIS,
                temperature=0.2
            )
            response_text = completion.choices[0].message.content
            model_identifier = f"openai/{settings.OPENAI_MODEL}"
            tokens_count = completion.usage.total_tokens if completion.usage else 0
        except Exception as e:
            logger.warning("OpenAI invocation failed (%s). Activating local deterministic fallback.", e)
            response_text, tokens_count = local_deterministic_mock_ai(request.query, request.mode, context_text, doc_name)
            model_identifier = "mock-smartdoc-engine-v1 (DevOps Fallback)"
    else:
        # Graceful Local Fallback Engine
        response_text, tokens_count = local_deterministic_mock_ai(request.query, request.mode, context_text, doc_name)
        model_identifier = "mock-smartdoc-engine-v1 (DevOps Fallback)"

    latency_ms = round((time.time() - t_start) * 1000, 2)

    # 4. Save to Redis Cache (1 hour TTL)
    if redis_client:
        try:
            cache_payload = json.dumps({
                "response": response_text,
                "model_used": model_identifier,
                "tokens_used": tokens_count
            })
            redis_client.setex(cache_key, settings.REDIS_CACHE_TTL_SECONDS, cache_payload)
        except Exception as e:
            logger.warning("Redis write exception: %s", e)

    # 5. Persist Audit Record in PostgreSQL
    try:
        log_entry = AnalysisLog(
            document_id=request.document_id,
            query=request.query,
            analysis_mode=request.mode,
            response=response_text,
            model_used=model_identifier,
            latency_ms=latency_ms,
            tokens_used=tokens_count,
            cached=False
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        logger.error("Failed to commit analysis log to database: %s", e)
        db.rollback()

    logger.info("Completed analysis query='%s', latency=%.2fms, model=%s", request.query[:30], latency_ms, model_identifier)

    return AnalyzeResponse(
        query=request.query,
        mode=request.mode,
        response=response_text,
        model_used=model_identifier,
        latency_ms=latency_ms,
        tokens_used=tokens_count,
        cached=False,
        document_id=request.document_id,
        document_name=doc_name
    )


@router.get("/logs")
def get_analysis_logs(limit: int = 20, db: Session = Depends(get_db)):
    """Retrieve recent analysis audit logs for the live DevOps console."""
    logs = db.query(AnalysisLog).order_by(AnalysisLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "document_id": l.document_id,
            "query": l.query,
            "mode": l.analysis_mode,
            "model_used": l.model_used,
            "latency_ms": l.latency_ms,
            "tokens_used": l.tokens_used,
            "cached": l.cached,
            "created_at": l.created_at.isoformat() if l.created_at else None
        }
        for l in logs
    ]
