# SmartDoc AI — Production 3-Tier AI Web Platform

SmartDoc AI is an enterprise-grade, 3-tier AI-powered document intelligence microservices application designed specifically for validating end-to-end DevOps automation workflows:
- **Containerization:** Docker multi-stage builds and Docker Compose orchestration.
- **Cluster Orchestration:** Kubernetes (Minikube / EKS / GKE) manifests and Helm charts.
- **Infrastructure as Code (IaC):** Terraform cloud provisioning.
- **Configuration Management:** Ansible playbooks.
- **CI/CD Automation:** Jenkins and GitHub Actions declarative pipelines.
- **Full-Stack Telemetry:** Prometheus metrics scraping (`/metrics`) and Grafana dashboards.

---

## 🏛️ System Architecture

```text
                  [ Browser Client / Ingress ]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Tier 1: Presentation Layer (Next.js 14)       │
        │ - Port 3000                                  │
        │ - Real-Time Microservice Trace Console       │
        │ - Reactive Health-Check Polling Indicator    │
        │ - Multi-format Document Ingestion Dropzone   │
        └──────────────────────┬───────────────────────┘
                               │ HTTP / JSON
                               ▼
        ┌──────────────────────────────────────────────┐
        │ Tier 2: Application Microservice (FastAPI)    │
        │ - Port 8000                                  │
        │ - /api/v1/upload (PDF & Text parsing)        │
        │ - /api/v1/analyze (RAG + Fallback AI Engine) │
        │ - /api/v1/health (DB, Redis, Uptime probe)   │
        │ - /metrics (Prometheus Instrumentator)       │
        └──────────────┬────────────────┬──────────────┘
                       │                │
            SQL Pool   ▼                ▼  Redis Key-Value
  ┌─────────────────────────┐      ┌─────────────────────────┐
  │ Tier 3: PostgreSQL 15   │      │ Tier 3: Redis 7 Cache   │
  │ - Port 5432             │      │ - Port 6379             │
  │ - Persistent volume     │      │ - Fast query cache      │
  │ - init.sql schema       │      │ - 3600s TTL key storage │
  └─────────────────────────┘      └─────────────────────────┘
```

---

## 🚀 Quick Start (Docker Compose)

### 1. Launch the Stack
Run the following command from the `smartdoc-ai/` root:
```bash
docker compose up --build
```

### 2. Access the Endpoints
| Component | URL | Description |
|-----------|-----|-------------|
| **Frontend UI** | [http://localhost:3000](http://localhost:3000) | SmartDoc AI Dashboard & Console |
| **Backend API** | [http://localhost:8000](http://localhost:8000) | FastAPI Root |
| **API Docs (Swagger)** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI Documentation |
| **Prometheus Metrics** | [http://localhost:8000/metrics](http://localhost:8000/metrics) | Scrape target for Prometheus |
| **Health Check** | [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health) | Readiness & Liveness endpoint |

---

## 🛡️ Deterministic Local AI Fallback (Offline Mode)

If `OPENAI_API_KEY` is not provided in `.env`, SmartDoc AI activates an intelligent **local deterministic natural language synthesizer**. 

- **Zero Cost & Offline:** No external API calls are made, guaranteeing zero billing costs and 100% offline uptime for CI/CD test pipelines.
- **Dynamic Context Parsing:** Ingests document text, evaluates word counts, structures executive summaries, bullet points, and DevOps audit observations based on your selected prompt mode (`qa`, `summary`, `key_points`, `technical`).
- **Telemetry Preservation:** Generates simulated token metrics and server latency logs identical to real LLM calls for Prometheus verification.

To enable OpenAI GPT-3.5/4 completions, simply set:
```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

---

## 🧪 DevOps Verification Guide

### 1. Health & Dependency Check
```bash
curl -s http://localhost:8000/api/v1/health | jq .
```
Expected output:
```json
{
  "status": "healthy",
  "service": "SmartDoc AI Backend",
  "version": "1.0.0",
  "environment": "production",
  "uptime_seconds": 42.15,
  "dependencies": {
    "database": {
      "type": "postgresql",
      "status": "connected",
      "latency_ms": 1.2
    },
    "cache": {
      "type": "redis",
      "status": "connected"
    }
  }
}
```

### 2. Prometheus Metrics Scraping
```bash
curl -s http://localhost:8000/metrics | grep http_request
```

### 3. File Upload Simulation (CLI)
```bash
curl -X POST http://localhost:8000/api/v1/upload \
  -F "file=@database/init.sql"
```

### 4. AI Ingestion & Analysis Simulation (CLI)
```bash
curl -X POST http://localhost:8000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"query": "Summarize the database tables", "mode": "summary"}'
```
