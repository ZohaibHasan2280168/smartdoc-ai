-- =============================================================================
-- SmartDoc AI - Database Initialization Script
-- Target Database: PostgreSQL 15+
-- Schema: users, documents, analysis_logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'devops_engineer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    content_text TEXT,
    summary_preview TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS analysis_logs (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    analysis_mode VARCHAR(50) DEFAULT 'qa',
    response TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    latency_ms DOUBLE PRECISION NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cached BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance and Prometheus metric aggregation queries
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_document_id ON analysis_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_created_at ON analysis_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_model_used ON analysis_logs(model_used);

-- Initial seed data for DevOps test workflows
INSERT INTO users (email, name, role)
VALUES ('devops.admin@smartdoc.ai', 'DevOps Administrator', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO documents (filename, file_path, file_size_bytes, mime_type, content_text, summary_preview, user_id)
VALUES (
    'smartdoc_architecture_spec.txt',
    '/data/uploads/smartdoc_architecture_spec.txt',
    1842,
    'text/plain',
    'SmartDoc AI Architecture Overview:
1. Presentation Tier: Next.js 14 App Router, dynamic UI console, responsive layout, health indicator polling.
2. Application Tier: FastAPI asynchronous Python microservice, CORS enabled, Prometheus FastAPI Instrumentator exposing /metrics, connection pooling for PostgreSQL and Redis.
3. Data Tier: PostgreSQL 15 storing metadata and analysis audit logs; Redis 7 caching frequently asked document analysis queries.
4. DevOps Pipeline: Docker multi-stage builds, Kubernetes Helm/Manifests, Terraform infrastructure definitions, Ansible host configuration, Jenkins declarative CI/CD pipeline, Prometheus and Grafana dashboards for cluster monitoring.
Fallback Behavior: When OPENAI_API_KEY is not configured, the service utilizes an intelligent local deterministic natural language synthesizer to simulate LLM responses without external API calls or billing costs.',
    'Architecture blueprint detailing 3-tier structure, FastAPI backend, Next.js frontend, PostgreSQL, Redis, and DevOps pipeline integrations.',
    1
)
ON CONFLICT DO NOTHING;
