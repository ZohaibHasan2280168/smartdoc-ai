# Enterprise Prometheus & Grafana Mastery Guide
### *SmartDoc AI — Observability, Telemetry & SRE Production Handbook*

---

## 📑 Table of Contents
1. [Core Philosophy: Monitoring vs. Observability (M.E.L.T)](#1-core-philosophy-monitoring-vs-observability-melt)
2. [Prometheus Architecture Under the Hood](#2-prometheus-architecture-under-the-hood)
3. [The 4 Metric Types (Deep Dive)](#3-the-4-metric-types-deep-dive)
4. [Industry Standards: The RED & USE Methods](#4-industry-standards-the-red--use-methods)
5. [PromQL (Prometheus Query Language) Masterclass](#5-promql-prometheus-query-language-masterclass)
6. [Grafana: Production Dashboards & Best Practices](#6-grafana-production-dashboards--best-practices)
7. [Alertmanager & SRE Incident Management](#7-alertmanager--sre-incident-management)
8. [Top 10 DevOps & SRE Interview Questions & Answers](#8-top-10-devops--sre-interview-questions--answers)
9. [SmartDoc AI Practical Implementation Reference](#9-smartdoc-ai-practical-implementation-reference)

---

## 1. Core Philosophy: Monitoring vs. Observability (M.E.L.T)

### The Fundamental Difference
* **Monitoring**: Answers the question *"Is the system working?"* (Healthchecks, ping checks, threshold triggers). It focuses on symptoms.
* **Observability**: Answers the question *"Why is the system broken or behaving this way?"* It infers the internal state of a system based on its external outputs.

### The 4 Pillars of Observability (M.E.L.T)
```
+-----------------------------------------------------------------------+
|                       OBSERVABILITY PILLARS (M.E.L.T)                 |
+-----------------------------------------------------------------------+
|  1. METRICS   | Numerical aggregated time-series data over intervals. |
|               | Tool: Prometheus, VictoriaMetrics, Datadog            |
|  2. EVENTS    | Discrete occurrences with contextual metadata.       |
|               | Tool: Kubernetes Events, AWS CloudTrail               |
|  3. LOGS      | Discrete text lines with timestamps & stack traces.   |
|               | Tool: Grafana Loki, ELK (Elasticsearch/Logstash/Kibana)|
|  4. TRACES    | Journey of a single request across microservices.     |
|               | Tool: Jaeger, Zipkin, OpenTelemetry                   |
+-----------------------------------------------------------------------+
```

---

## 2. Prometheus Architecture Under the Hood

### System Topology
```
+-------------------------------------------------------------------------------+
|                                  PROMETHEUS                                   |
|                                                                               |
|  +--------------------+        +---------------------+     +---------------+  |
|  | Service Discovery  | -----> |  Scrape Engine      | --> |  TSDB Engine  |  |
|  | (K8s API, DNS, AWS)|        |  (HTTP GET /metrics)|     | (WAL + Blocks)|  |
|  +--------------------+        +---------------------+     +---------------+  |
|                                                                    |          |
|                                +---------------------+             |          |
|                                | PromQL Query Engine | <-----------+          |
|                                +---------------------+                        |
+-------------------------------------------|-----------------------------------+
       ^ (Pulls every 15s)                  | (PromQL evaluation)
       |                                    v
+-----------------------+        +---------------------+     +---------------+
| Applications / Targets|        | Alertmanager        |     |    Grafana    |
| (FastAPI, Node Exporter|       | (Slack, PagerDuty)  |     | (Dashboards)  |
+-----------------------+        +---------------------+     +---------------+
```

### Core Components
1. **Scrape Engine (Pull Model)**: Periodically executes HTTP `GET` requests against `/metrics` endpoints.
2. **TSDB (Time Series Database)**:
   - Stores data points as `(timestamp: int64, value: float64)`.
   - Uses an append-only **Write-Ahead Log (WAL)** in memory and flushes compacted 2-hour blocks to disk.
   - Extremely high compression (~1-2 bytes per sample using Gorilla XOR float compression).
3. **Service Discovery (SD)**: Integrates natively with Kubernetes, Consul, AWS EC2, and DNS to dynamically discover target IPs as pods scale up or down.
4. **Alertmanager**: Receives alert firings from Prometheus, groups duplicate alerts, silences maintenance windows, and dispatches to Slack, PagerDuty, or Email.

---

## 3. The 4 Metric Types (Deep Dive)

| Metric Type | Characteristics | Can It Go Down? | Real-World Use Case | Mandatory PromQL Functions |
| :--- | :--- | :--- | :--- | :--- |
| **Counter** | Cumulative metric that only increases over time (resets to 0 on service restart). | ❌ No | Total HTTP requests, errors encountered, bytes sent. | `rate()`, `irate()`, `increase()` |
| **Gauge** | Value that fluctuates arbitrarily up and down. Snapshot of current state. | ✅ Yes | Memory usage, CPU load, active database connections, queue size. | `avg_over_time()`, `min_over_time()`, `delta()` |
| **Histogram** | Samples observations (usually request durations or sizes) into configurable buckets. | Cumulative buckets only increase | Request latency (e.g., <50ms, <200ms, <1s, +Inf). | `histogram_quantile()` |
| **Summary** | Similar to Histogram, but calculates client-side streaming quantiles directly in application memory. | Quantiles float | High-precision percentiles when server-side calculation cost is too high. | Direct metric query (Cannot be aggregated across pods!) |

> ⚠️ **Golden Rule**: Never use `rate()` on a **Gauge**. `rate()` assumes counter resets when values drop, which completely corrupts Gauge calculations.

---

## 4. Industry Standards: The RED & USE Methods

### A. The RED Method (Microservices & Web APIs)
*Formulated by Tom Wilkie. Mandatory for any REST, GraphQL, or gRPC application (e.g., SmartDoc Backend).*

1. **Rate**: The number of requests per second your service is serving.
   ```promql
   sum(rate(http_requests_total{job="smartdoc-backend"}[5m]))
   ```
2. **Errors**: The number of failed requests per second.
   ```promql
   sum(rate(http_requests_total{job="smartdoc-backend", status=~"5.."}[5m]))
   ```
3. **Duration**: The amount of time each request takes (Latency distribution).
   ```promql
   histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
   ```

### B. The USE Method (Infrastructure & Hardware)
*Formulated by Brendan Gregg (Netflix). Mandatory for VMs, Nodes, Disks, and Network interfaces.*

1. **Utilization**: Percentage of time the resource was busy (e.g., CPU 82%, Memory 75%).
2. **Saturation**: The degree to which extra work is queued waiting for the resource (e.g., CPU load average vs core count, disk queue depth).
3. **Errors**: Count of error events (e.g., Ethernet frame drops, disk read retries).

---

## 5. PromQL (Prometheus Query Language) Masterclass

### 1. Vector Types
- **Instant Vector**: A set of time series containing a single sample for each time series, all sharing the same timestamp.
  `http_requests_total`
- **Range Vector**: A set of time series containing a buffer of data points over a duration.
  `http_requests_total[5m]` *(Only functions like `rate()`, `increase()`, `avg_over_time()` can process Range Vectors)*.

### 2. SRE Production PromQL Arsenal

#### HTTP Request Throughput (Requests / Sec)
```promql
sum(rate(http_requests_total[5m])) by (method, handler)
```

#### HTTP 5xx Error Rate Percentage (%)
```promql
(
  sum(rate(http_requests_total{status=~"5.."}[5m]))
  /
  sum(rate(http_requests_total[5m]))
) * 100
```

#### Latency Percentiles (P50, P90, P99)
```promql
# Median Latency (P50)
histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# 95th Percentile Latency (SLA threshold)
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# 99th Percentile Latency (Tail latency / worst 1% users)
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

#### Service Uptime & Availability Check
```promql
# 1 = Target is healthy and scrape succeeded; 0 = Target is unreachable / crashed
up{job="smartdoc-backend"} == 1
```

#### Node CPU Utilization Percentage (%)
```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

#### Node RAM Usage Percentage (%)
```promql
(
  (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
  /
  node_memory_MemTotal_bytes
) * 100
```

---

## 6. Grafana: Production Dashboards & Best Practices

### Core Architecture
Grafana acts as the pure visualization layer, querying Prometheus using PromQL via HTTP API.

### Essential Production Features
1. **Dashboard Templating & Variables**:
   Instead of hardcoding targets, define dynamic variables:
   - `env`: `label_values(up, env)`
   - `service`: `label_values(http_requests_total, service)`
   - `pod`: `query_result(kube_pod_info{namespace="smartdoc-ai"})`
2. **Dashboard as Code (GitOps Provisioning)**:
   Enterprise environments do not build dashboards manually via the UI. Dashboards are defined as JSON files and loaded automatically via `/etc/grafana/provisioning/dashboards`.
3. **Thresholds & Color Maps**:
   - Green: Normal state (Error rate < 1%, Latency < 200ms)
   - Yellow / Amber: Warning state (Error rate 1% - 5%, Latency 200ms - 1s)
   - Red: Critical SLA breach (Error rate > 5%, Latency > 1s)

---

## 7. Alertmanager & SRE Incident Management

### The 3 States of an Alert
1. **Inactive**: Condition is not met (Everything is normal).
2. **Pending**: Condition is met, but has not remained active for the duration of the `for` clause (prevents alert flapping).
3. **Firing**: Condition has persisted beyond the `for` window; notification is dispatched.

### Production Alerting Rule Example (`prometheus-alerts.yml`)
```yaml
groups:
  - name: smartdoc_backend_alerts
    rules:
      - alert: BackendServiceDown
        expr: up{job="smartdoc-backend"} == 0
        for: 1m
        labels:
          severity: critical
          tier: application
        annotations:
          summary: "SmartDoc Backend instance {{ $labels.instance }} is down"
          description: "Backend has been unreachable for more than 60 seconds. ArgoCD or Kubernetes pod restart may be required."

      - alert: HighHttpErrorRate
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[5m])) 
           / sum(rate(http_requests_total[5m]))) * 100 > 5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "HTTP 5xx error rate exceeds 5%"
          description: "SmartDoc backend is throwing {{ $value | printf \"%.2f\" }}% 5xx errors over the last 5 minutes."
```

### Alertmanager Key Capabilities:
- **Grouping**: Bundles 20 simultaneous pod failures into 1 single Slack message.
- **Inhibition**: Suppresses low-severity alerts if a higher-severity alert is already firing (e.g., if `NodeDown` fires, mute `PodDown` alerts on that node).
- **Silencing**: Mutes alerts during planned maintenance or deployments.

---

## 8. Top 10 DevOps & SRE Interview Questions & Answers

### Q1: Why does Prometheus use a Pull model instead of a Push model?
> **Answer**:
> 1. **Centralized Health Check**: In a Pull model, if an application dies, Prometheus instantly detects failure because `GET /metrics` fails (`up == 0`). In a Push model, silence could mean the app died OR there was zero traffic.
> 2. **Overload Protection**: During sudden traffic spikes, 5,000 pods pushing metrics simultaneously can overwhelm and crash the monitoring server. Pull allows Prometheus to control its own ingestion rate based on configured `scrape_interval`.
> 3. **Simplified Target Configuration**: Targets don't need to know where Prometheus lives; Prometheus discovers targets via Kubernetes Service Discovery.
> *(Exception: For short-lived ephemeral batch jobs like CronJobs, Prometheus provides the **Pushgateway**).*

### Q2: What is the difference between `rate()` and `irate()`?
> **Answer**:
> - `rate(v[range])`: Calculates the average per-second rate across the entire range window (e.g., 5m). It smooths out graphs and is ideal for **alerting rules** and long-term trend analysis.
> - `irate(v[range])`: Calculates the instant per-second rate using only the last two data points in the range window. It is extremely sensitive and reveals **instantaneous spikes**, ideal for high-resolution live debugging.

### Q3: Why is Average (Mean) Latency a dangerous anti-pattern?
> **Answer**:
> The mean hides outliers. If 99 users experience 10ms latency and 1 user experiences 10,000ms (10 seconds), the average is ~110ms, which looks completely healthy on a dashboard while 1% of users are suffering a catastrophic outage. SRE standards mandate using **percentiles (P95, P99)** via `histogram_quantile()` to measure true tail latency.

### Q4: Can you calculate `rate()` on a Gauge?
> **Answer**:
> **No, never.** `rate()` expects monotonic increases and interprets any downward step as a server reboot / counter reset, falsely adding values back. Gauges must be analyzed using `avg_over_time()`, `max_over_time()`, or `delta()`.

### Q5: What is the difference between a Histogram and a Summary?
> **Answer**:
> - **Histogram**: Server-side quantile calculation. Exposes bucket counters (`_bucket{le="0.1"}`). It can be aggregated across multiple pods/instances using `sum()`.
> - **Summary**: Client-side quantile calculation. Exposes pre-calculated percentiles directly (`_summary{quantile="0.95"}`). **Cannot be aggregated** across multiple instances (averaging averages is mathematically invalid). Histograms are preferred in 95% of microservice setups.

### Q6: How does Prometheus discover pods dynamically in Kubernetes?
> **Answer**:
> Prometheus uses **Kubernetes Service Discovery (kubernetes_sd_configs)** to talk directly to the Kubernetes API Server (`/api/v1/pods`, `/api/v1/services`). It reads pod annotations (such as `prometheus.io/scrape: "true"`, `prometheus.io/port: "8000"`, `prometheus.io/path: "/metrics"`) and automatically populates targets without manual configuration reloads.

### Q7: What is Metric Cardinality and why can it crash Prometheus?
> **Answer**:
> Cardinality is the total number of unique time series generated by the multiplication of all label keys and values. 
> *Example of high cardinality disaster*: Putting `user_id`, `email`, or `order_id` as a label in a metric. If 1,000,000 users visit, Prometheus generates 1,000,000 distinct time series in RAM, causing TSDB Out-Of-Memory (OOM) crashes. Labels must only be finite enumerations (e.g., `status_code`, `method`, `environment`).

### Q8: How does Prometheus achieve High Availability (HA)?
> **Answer**:
> Prometheus is inherently single-node. HA is achieved by running **two identical, independent Prometheus servers scraping the exact same targets**. Alertmanager deduplicates alerts received from both instances. For global multi-cluster querying and multi-year data retention, enterprises use **Thanos**, **Cortex**, or **VictoriaMetrics** backed by AWS S3 / Google Cloud Storage.

### Q9: What happens when Prometheus crashes? Do we lose metrics?
> **Answer**:
> Prometheus uses a **WAL (Write-Ahead Log)** on disk. Any metrics held in RAM that were not yet flushed to compacted blocks are replayed from the WAL upon container restart, preventing data loss.

### Q10: How do you monitor infrastructure components that don't have native `/metrics` endpoints?
> **Answer**:
> We deploy **Exporters**. An exporter is a lightweight sidecar or agent that translates third-party system statistics into Prometheus format:
> - Linux OS metrics ➔ `node_exporter`
> - Kubernetes container metrics ➔ `cAdvisor` / `kube-state-metrics`
> - PostgreSQL database ➔ `postgres_exporter`
> - Redis cache ➔ `redis_exporter`
> - NGINX web server ➔ `nginx_exporter`

---

## 9. SmartDoc AI Practical Implementation Reference

### Our Architecture Setup
- **Metrics Endpoint**: FastAPI backend exposes metrics at `http://localhost:8000/metrics` via `prometheus-fastapi-instrumentator`.
- **Prometheus Service**: Runs on `http://localhost:9090` using host network mode for direct access.
- **Grafana Service**: Runs on `http://localhost:3001` (Admin: `admin` / `admin`).

### Quick Start Commands
```bash
# 1. Start Prometheus & Grafana stack
docker compose -f monitoring/docker-compose.monitoring.yml up -d

# 2. Verify Prometheus targets are UP
curl -s http://localhost:9090/api/v1/targets | jq .

# 3. Test backend metrics endpoint
curl -s http://localhost:8000/metrics | head -n 30

# 4. Open Dashboards:
# Prometheus Web UI: http://localhost:9090
# Grafana Web UI:    http://localhost:3001
```
