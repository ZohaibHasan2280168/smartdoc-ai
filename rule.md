# AI Engineering Rulebook: SmartDoc AI

---

## 1. Core Principles & Pair Programming Etiquette

1. **User Authority & Terminal Execution**:
   - The user executes all terminal commands manually in their terminal.
   - Do NOT run destructive or modifying commands silently in the background unless explicitly requested.
   - Always provide exact, copy-pasteable commands with clear context.
2. **Clear Explanations Before & After (What, How, Why)**:
   - Provide a concise technical explanation before introducing a step.
   - Explain what happened under the hood after commands run.
   - Maintain the communication style preferred by the user: **Roman Urdu + Professional English technical terms**.
3. **Preserve Documentation & Code Integrity**:
   - Preserve existing comments, docstrings, and structure that are unrelated to current edits.
   - Never blind-overwrite files; use targeted, minimal edits wherever possible.

---

## 2. What the AI MUST DO ✅

1. **Adhere to GitOps Separation of Concerns**:
   - Understand that **ArgoCD owns the deployment state** in Kubernetes.
   - Ensure Jenkins focuses on **Continuous Integration (CI)**: Linting, Building, Testing, and Publishing images.
   - Avoid adding direct `kubectl apply` commands in Jenkins when ArgoCD is managing manifests.
2. **Security & Non-Root Container Standards**:
   - Maintain non-root user execution in all Dockerfiles (`appuser:appgroup` UID 1001 for Python, `nextjs:nodejs` UID 1001 for Next.js).
   - Never commit sensitive secrets, `.env` files, or `terraform.tfstate` files to Git. Ensure `.gitignore` remains complete and active.
3. **Multi-Stage Build Standards**:
   - Keep production runtime images minimal (e.g., `python:3.11-slim`, `node:20-alpine`).
   - Use `/opt/venv` for Python virtual environments to prevent permission issues for non-root users.
4. **Git Commit Conventions**:
   - Follow semantic commit messages:
     - `feat:` for new capabilities.
     - `fix:` for bug fixes.
     - `chore:` for maintenance or tag updates.
     - `docs:` for documentation.

---

## 3. What the AI MUST STRICTLY AVOID ❌

1. **NEVER Bypass GitOps with Direct `kubectl` Overrides**:
   - Do not encourage manual cluster edits (e.g. `kubectl edit`, `kubectl scale`) as a permanent solution.
   - Always explain that manual edits cause **Configuration Drift** that ArgoCD will automatically self-heal.
2. **NEVER Hardcode IP Addresses or Passwords in Manifests**:
   - Use Kubernetes Secrets and ConfigMaps for database passwords, API tokens, and host configurations.
3. **NEVER Delete or Prune Active Running Containers Recklessly**:
   - Use `docker image prune -f --filter "dangling=true"` instead of aggressive `docker system prune -a` which wipes out monitoring networks and cached images.
4. **NEVER Connect New Containers to the `minikube` Network without a Fixed IP**:
   - Connecting containers dynamically to `minikube` network can steal `192.168.49.2`, preventing Minikube from starting upon reboot.
   - Always assign a static IP (e.g., `--ip 192.168.49.100`) for third-party containers on the `minikube` network.

---

## 4. Error Handling & Troubleshooting Protocols

### 4.1. "Address already in use" on `minikube start`
* **Root Cause**: A container (like `smartdoc-jenkins`) was allocated IP `192.168.49.2` while Minikube was stopped.
* **Resolution Protocol**:
  1. `docker network disconnect minikube smartdoc-jenkins || true`
  2. `minikube start`
  3. `docker network connect --ip 192.168.49.100 minikube smartdoc-jenkins`

### 4.2. "No route to host: 192.168.49.2:8443"
* **Root Cause**: Minikube container was stopped due to laptop shutdown or system sleep.
* **Resolution Protocol**:
  1. Run `minikube start`.
  2. Verify with `kubectl get nodes`.

### 4.3. Jenkins Webhook 403 Forbidden
* **Root Cause 1**: Trailing characters in webhook URL (e.g. `/github-webhook/a` instead of `/github-webhook/`).
* **Root Cause 2**: Jenkins "Allow anonymous read access" is disabled in Global Security.
* **Resolution Protocol**:
  1. Verify URL is exactly `https://<tunnel-id>.trycloudflare.com/github-webhook/`.
  2. In Jenkins: `Manage Jenkins ➔ Security ➔ Authorization ➔ [✔] Allow anonymous read access`.
  3. Redeliver webhook payload in GitHub settings.

### 4.4. UI not updating on `http://localhost:3000`
* **Root Cause**: The old Phase 2 Docker Compose container (`smartdoc-frontend`) is holding port 3000 on the host, preventing the live Kubernetes pod from being viewed.
* **Resolution Protocol**:
  1. `docker stop smartdoc-frontend || true`
  2. `kubectl port-forward -n smartdoc-ai svc/frontend 3000:3000`
  3. Hard refresh browser: `Ctrl + Shift + R`.
