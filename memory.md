# Project Memory & Knowledge Base: SmartDoc AI

---

## 1. Executive Context & Mission
This document serves as the institutional memory and historical log of architectural decisions, critical bugs, root causes, and verified solutions discovered throughout the development of **SmartDoc AI**. Future sessions and engineers must consult this record before altering network topologies, container permissions, or pipeline stages.

---

## 2. Architectural Decision Records (ADRs)

### ADR 001: Next.js Module Path Resolution
* **Context**: Building Next.js 14 in a multi-stage Docker container failed with `Module not found: Can't resolve '@/components/FileUpload'`.
* **Decision**: Added `frontend/jsconfig.json` with `"paths": { "@/*": ["./src/*"] }` and converted local page imports in `page.jsx` to relative imports (`../components/FileUpload`).
* **Consequence**: Next.js Webpack compiler cleanly resolves components in both local node environments and Docker standalone builds.

### ADR 002: Python Virtualenv Isolation for Non-Root Containers
* **Context**: Installing pip packages via `pip install --user` in a non-root container failed with file permission conflicts during runtime execution.
* **Decision**: Separated build dependencies into `/opt/venv` during the `builder` stage, changed ownership to `appuser:appgroup` (UID 1001), and set `ENV PATH="/opt/venv/bin:$PATH"` in the runner image.
* **Consequence**: Full package isolation with zero root privileges required in production.

### ADR 003: Host Networking for Observability Stack
* **Context**: Prometheus running inside a Docker bridge network could not reliably scrape the FastAPI backend when port-forwarded from Kubernetes.
* **Decision**: Configured `network_mode: "host"` in `monitoring/docker-compose.monitoring.yml`.
* **Consequence**: Prometheus (`:9090`) and Grafana (`:3001`) communicate directly over `localhost` without NAT or Docker bridge IP translation.

### ADR 004: Docker Network IP Collision Fix on Minikube
* **Context**: Upon laptop restart, `minikube start` failed with `Error response from daemon: Address already in use`.
* **Root Cause**: Docker sequentially assigned the first available subnet IP (`192.168.49.2`) to `smartdoc-jenkins` while Minikube was stopped. Minikube's static network configuration requires `192.168.49.2`.
* **Decision**: Hardcoded Jenkins to a static IP on the Minikube network:
  `docker network connect --ip 192.168.49.100 minikube smartdoc-jenkins`.
* **Consequence**: Minikube always claims `192.168.49.2` unimpeded upon system boot.

### ADR 005: Cloudflare Quick Tunnel over Localtunnel
* **Context**: GitHub webhooks sent via Localtunnel failed with `HTTP 403 Forbidden` due to anti-bot headers and IP verification prompts.
* **Decision**: Adopted Cloudflare Tunnel (`cloudflared`) via Docker:
  `docker run --rm --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:8080`.
* **Consequence**: Zero-configuration, high-speed, direct HTTPS tunnel that seamlessly passes GitHub webhook POST payloads.

### ADR 006: Jenkins CSRF & Anonymous Read Access
* **Context**: GitHub webhook payloads hitting Jenkins returned `Error 403 No valid crumb was included in the request`.
* **Root Cause 1**: Typo in payload URL (e.g., `/github-webhook/a` instead of `/github-webhook/`).
* **Root Cause 2**: Jenkins "Allow anonymous read access" was unchecked, causing unauthenticated incoming webhook requests to be blocked at the gateway.
* **Decision**: Configured exact payload URL `/github-webhook/` and enabled `Allow anonymous read access` under `Manage Jenkins ➔ Security`.
* **Consequence**: Instant, automated webhook triggering on every `git push`.

### ADR 007: Migration to GitOps Model with ArgoCD
* **Context**: Direct `kubectl apply` in Jenkins created security risks (Jenkins holding cluster admin rights) and configuration drift.
* **Decision**: Installed ArgoCD in Minikube (`argocd` namespace). Refactored `Jenkinsfile` to remove all `kubectl apply` commands. Jenkins now focuses solely on CI (building and publishing images), while ArgoCD declaratively pulls and self-heals Kubernetes state from Git.
* **Consequence**: Automated drift detection, instant rollback capability, and complete separation of CI from CD.

### ADR 008: Repository Secrets Hardening & Git Tracking Elimination
* **Context**: `.env` and `.env.example` files were previously tracked in Git from the initial setup commit, exposing environment blueprints on GitHub.
* **Decision**: Enforced strict multi-layer security:
  1. Untracked `.env` and `.env.example` via `git rm --cached`.
  2. Hardened `.gitignore` to match all variations (`**/.env`, `**/.env.*`, `*.env`, `*.key`, `*.pem`, `*.token`).
  3. Kept runtime secrets locally on the developer workstation and cluster secrets inside Kubernetes Secrets.
* **Consequence**: Zero credential or environment configuration leakage to public/remote Git repositories.

---

## 3. Bug History & Troubleshooting Reference

| Issue | Symptom | Exact Root Cause | Verified Resolution |
| :--- | :--- | :--- | :--- |
| **Jenkins Git Ownership** | `fatal: detected dubious ownership in repository` | Jenkins container user running as different UID than host repository owner. | Added `git config --global --add safe.directory '*'` in Jenkinsfile checkout step. |
| **Kubectl Connection Refused** | `connect: connection refused to 192.168.49.2:8443` | Minikube container stopped due to laptop shutdown/sleep. | Execute `minikube start`. |
| **Port 3000 Stale UI** | UI in browser shows old badge despite successful pipeline run. | The Phase 2 standalone Docker Compose container (`smartdoc-frontend`) was still running on host port 3000. | Run `docker stop smartdoc-frontend` and forward live K8s pod: `kubectl port-forward -n smartdoc-ai svc/frontend 3000:3000`. |
| **Post-Build Prune Conflict** | Monitoring or Jenkins containers lose network bindings after build. | `docker system prune -a` was wiping out unreferenced networks and cached base images. | Replaced with targeted prune: `docker image prune -f --filter "dangling=true"`. |
| **ArgoCD CRD Annotation Limit** | `metadata.annotations: Too long: may not be more than 262144 bytes` | Client-side `kubectl apply` exceeds annotation limit on huge ApplicationSet CRD. | Use server-side apply: `kubectl apply -n argocd --server-side -f ...`. |

---

## 4. System Reboot & Revival Cheat Sheet

When the laptop is powered on or restarted, execute this sequence:

```bash
# 1. Start Kubernetes cluster
minikube start

# 2. Start Jenkins & attach to Minikube network with permanent IP
docker start smartdoc-jenkins
docker network connect --ip 192.168.49.100 minikube smartdoc-jenkins || true

# 3. Resume Monitoring stack (Prometheus & Grafana)
docker compose -f monitoring/docker-compose.monitoring.yml up -d

# 4. Open ArgoCD Dashboard (in dedicated terminal tab)
kubectl port-forward svc/argocd-server -n argocd 8081:443
# Access: https://localhost:8081 (User: admin)

# 5. Open SmartDoc Live Application (in dedicated terminal tab)
docker stop smartdoc-frontend || true
kubectl port-forward -n smartdoc-ai svc/frontend 3000:3000
# Access: http://localhost:3000

# 6. (Optional) Start Cloudflare Tunnel for GitHub Webhook
docker run --rm --net=host cloudflare/cloudflared:latest tunnel --url http://localhost:8080
```
