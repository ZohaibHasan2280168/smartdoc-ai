# =============================================================================
# SmartDoc AI Backend - Production Multi-Stage Dockerfile
# Python FastAPI Microservice
# =============================================================================

# --- Stage 1: Build Dependencies ---
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir --user -r requirements.txt

# --- Stage 2: Minimal Runtime Environment ---
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime PostgreSQL client library and curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security: Create non-root system user and group
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

# Copy installed Python packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Copy application source code
COPY --chown=appuser:appgroup app/ ./app/

# Create upload directory and grant permissions
RUN mkdir -p /tmp/smartdoc_uploads && \
    chown -R appuser:appgroup /tmp/smartdoc_uploads /app

# Configure environment variables
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

USER appuser

EXPOSE 8000

# Container Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
