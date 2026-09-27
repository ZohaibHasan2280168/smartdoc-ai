import logging
import sys
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import settings
from app.database import init_db
from app.routers import health, docs, ai_service

# Configure Structured Logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("smartdoc.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events: startup table verification and shutdown teardown."""
    logger.info("Initializing %s in %s mode...", settings.PROJECT_NAME, settings.ENVIRONMENT)
    try:
        init_db()
    except Exception as e:
        logger.error("Failed to run DB init in startup: %s", e)
    yield
    logger.info("Shutting down %s...", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Tier 2 AI Microservice for Document Ingestion, Retrieval-Augmented Generation, and DevOps Observability.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request Latency & Observability Middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time)
    response.headers["X-Service-Name"] = "SmartDoc-AI-Backend"
    return response


# Setup Prometheus Metrics (/metrics)
# Exposes request count, latency histograms, error rates, and system gauges
instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
    should_respect_env_var=False,
    should_instrument_requests_inprogress=True,
    excluded_handlers=["/metrics", "/health", "/api/v1/health"]
)
instrumentator.instrument(app).expose(app, endpoint="/metrics", tags=["Observability"])

# Include Routers under API v1 prefix
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(docs.router, prefix=settings.API_V1_STR)
app.include_router(ai_service.router, prefix=settings.API_V1_STR)

# Top-level health convenience endpoint for container liveness/readiness probes
@app.get("/health", tags=["Health & Monitoring"], include_in_schema=False)
def root_health():
    return JSONResponse(content={"status": "healthy", "service": "smartdoc-backend", "uptime_probe": True})


@app.get("/", tags=["Root"])
def root_info():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "metrics": "/metrics",
        "health": "/api/v1/health"
    }
