import time
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db, get_redis_client

router = APIRouter(tags=["Health & Monitoring"])

APP_START_TIME = time.time()


@router.get("/health")
def check_health(db: Session = Depends(get_db)):
    """
    Health check endpoint returning microservice uptime, PostgreSQL status,
    and Redis cache status. Designed for Kubernetes liveness & readiness probes.
    """
    uptime_seconds = round(time.time() - APP_START_TIME, 2)
    db_status = "disconnected"
    redis_status = "disconnected"
    db_latency_ms = None
    
    # 1. Probe PostgreSQL
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:60]}"

    # 2. Probe Redis
    try:
        client = get_redis_client()
        if client and client.ping():
            redis_status = "connected"
    except Exception as e:
        redis_status = f"error: {str(e)[:60]}"

    # Overall service status
    is_healthy = (db_status == "connected")
    overall_status = "healthy" if (is_healthy and redis_status == "connected") else ("degraded" if is_healthy else "unhealthy")
    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "status": overall_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": uptime_seconds,
        "dependencies": {
            "database": {
                "type": "postgresql",
                "status": db_status,
                "latency_ms": db_latency_ms,
            },
            "cache": {
                "type": "redis",
                "status": redis_status,
            }
        }
    }

    return JSONResponse(status_code=http_status, content=payload)
