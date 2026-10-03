# ⚡ Production PromQL Queries & SRE Runbook
### *SmartDoc AI — Field-Tested Prometheus Queries & Real-World Use Cases*

---

## 📑 Quick Navigation
1. [Throughput & Traffic (RED: Rate)](#1-throughput--traffic-red-rate)
2. [Error Rates & SLA Violations (RED: Errors)](#2-error-rates--sla-violations-red-errors)
3. [Latency & User Experience (RED: Duration)](#3-latency--user-experience-red-duration)
4. [Service Uptime & Healthchecks](#4-service-uptime--healthchecks)
5. [Process & System Saturation (Memory & CPU)](#5-process--system-saturation-memory--cpu)
6. [Kubernetes Pod & Node Metrics](#6-kubernetes-pod--node-metrics)

---

## 1. Throughput & Traffic (RED: Rate)

### 🔹 Query 1.1: Total API Throughput (Requests Per Second - RPS)
```promql
sum(rate(http_requests_total{job="smartdoc-backend"}[1m]))
```
* **Kyun use hoti hai?**:
  Yeh query batati hai ke aapka system is waqt **per second kitni requests** process kar raha hai.
* **Real-World Industry Use Case**:
  1. **Capacity Planning**: Yeh janne ke liye ke kya hamari app 500 users per second handle kar sakti hai.
  2. **Kubernetes Auto-scaling (HPA)**: Agar throughput 100 req/s se upar jaye to automatically pods 2 se barha kar 6 kar do.
  3. **DDoS Attack Detection**: Raat ke 3 baje agar achanak 10 req/s se 20,000 req/s par jump kare to alert baj jaye ke attack hua hai.
* **Grafana Panel**: **Time Series Graph** ya **Stat Panel**.

---

### 🔹 Query 1.2: Throughput Broken Down by API Route / Handler
```promql
sum by (handler) (rate(http_requests_total{job="smartdoc-backend"}[5m]))
```
* **Kyun use hoti hai?**:
  Aapko batati hai ke **sabse zyada traffic kis specific API endpoint par aa raha hai** (e.g., `/api/v1/documents` vs `/api/v1/query`).
* **Real-World Industry Use Case**:
  Bottleneck identify karna. Agar server slow ho raha hai to is query se pata chalega ke kahin koi ek specific endpoint (jaise PDF upload) poora server to nahi baitha raha.
* **Grafana Panel**: **Bar Chart** ya **Stacked Time Series**.

---

### 🔹 Query 1.3: Active Requests Currently in Flight
```promql
http_requests_inprogress{job="smartdoc-backend"}
```
* **Kyun use hoti hai?**:
  Yeh ek **Gauge** metric hai jo batati hai ke is single instant me kitni requests process ho rahi hain.
* **Real-World Industry Use Case**:
  Thread pool ya worker pool saturation check karna. Agar yeh number lagatar barh raha ho (e.g. 50+ in progress), to matlab backend requests process karne me phans gaya hai.
* **Grafana Panel**: **Gauge** ya **Stat Panel**.

---

## 2. Error Rates & SLA Violations (RED: Errors)

### 🔹 Query 2.1: Percentage of 5xx Server Errors (SRE Golden Signal)
```promql
(
  sum(rate(http_requests_total{job="smartdoc-backend", status=~"5.."}[5m]))
  /
  sum(rate(http_requests_total{job="smartdoc-backend"}[5m]))
) * 100
```
* **Kyun use hoti hai?**:
  Kul requests me se **kitne percent (%) requests crash / 500 Internal Server Error** hui hain.
* **Real-World Industry Use Case**:
  - **SLA / SLO Tracking**: Companies ka SLA hota hai: "99.9% uptime, error rate must be < 0.1%".
  - **Automated Rollback**: Agar deployment ke baad error rate 2% se upar jaye to ArgoCD ya Jenkins automatically purane stable version par rollback kar deta hai.
* **Grafana Thresholds**:
  - 🟢 Green: `< 1%`
  - 🟡 Warning: `1% - 5%`
  - 🔴 Critical: `> 5%` (On-call engineer ko jaga do!)

---

### 🔹 Query 2.2: Count of Client Errors (HTTP 4xx: Bad Requests, Unauthorized)
```promql
sum(rate(http_requests_total{job="smartdoc-backend", status=~"4.."}[5m]))
```
* **Kyun use hoti hai?**:
  Batata hai kitne users 400 Bad Request, 401 Unauthorized, ya 404 Not Found face kar rahe hain.
* **Real-World Industry Use Case**:
  Agar frontend me koi bug aa jaye jo backend par ghalat format me data bhej raha ho, to 4xx graph achanak aasmaan par chala jata hai.

---

## 3. Latency & User Experience (RED: Duration)

### 🔹 Query 3.1: 95th Percentile (P95) Latency
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job="smartdoc-backend"}[5m])) by (le))
```
* **Kyun use hoti hai?**:
  Yeh batati hai ke **95% users ko kitne seconds ke andar response mil raha hai**.
* **Real-World Industry Use Case**:
  Average latency hamesha outliers ko chupati hai. P95 asli user experience dikhata hai. Agar P95 > 2.0s ho to matlab users ka system bohot slow hai.
* **Target Benchmark**: `< 0.2s (200ms)`.

---

### 🔹 Query 3.2: 99th Percentile (P99) Latency (Worst 1% Users)
```promql
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket{job="smartdoc-backend"}[5m])) by (le))
```
* **Kyun use hoti hai?**:
  Dunya ke sabse badtareen (slowest) 1% users kitna wait kar rahe hain. Heavy AI queries ya database deadlock yahin pakray jate hain.
* **Target Benchmark**: `< 1.0s`.

---

### 🔹 Query 3.3: Average Request Duration (Mean Latency)
```promql
sum(rate(http_request_duration_seconds_sum{job="smartdoc-backend"}[5m]))
/
sum(rate(http_request_duration_seconds_count{job="smartdoc-backend"}[5m]))
```
* **Kyun use hoti hai?**:
  Kul time divided by kul requests = Average response time.

---

## 4. Service Uptime & Healthchecks

### 🔹 Query 4.1: Target Health Probe
```promql
up{job="smartdoc-backend"}
```
* **Output**:
  - `1`: Service zinda aur healthy hai.
  - `0`: Service mar chuki hai ya port band hai.
* **Real-World Industry Use Case**:
  P1 Alert: `up{job="smartdoc-backend"} == 0` for 1m ➔ Send immediate PagerDuty call to on-call engineer!

---

## 5. Process & System Saturation (Memory & CPU)

### 🔹 Query 5.1: Backend RAM Usage in Megabytes (MB)
```promql
process_resident_memory_bytes{job="smartdoc-backend"} / 1024 / 1024
```
* **Kyun use hoti hai?**:
  Python FastAPI process actual physical RAM kitni consume kar raha hai.
* **Real-World Industry Use Case**:
  **Memory Leak Detection**: Agar yeh line lagatar upar hi ja rahi ho aur kabhi neeche na aaye to code me memory leak hai jo pod ko OOMKill (Out Of Memory) kar dega.

---

### 🔹 Query 5.2: Backend CPU Usage in Cores
```promql
rate(process_cpu_seconds_total{job="smartdoc-backend"}[1m])
```
* **Kyun use hoti hai?**:
  Batata hai ke Python backend kitne CPU cores use kar raha hai (e.g. `0.25` matlab 25% of 1 CPU core).
* **Real-World Industry Use Case**:
  CPU limits tune karna in Kubernetes `resources.limits.cpu`.

---

### 🔹 Query 5.3: Open File Descriptors Percentage
```promql
(process_open_fds{job="smartdoc-backend"} / process_max_fds{job="smartdoc-backend"}) * 100
```
* **Kyun use hoti hai?**:
  Linux OS me har network connection, database socket aur file ek "File Descriptor" hota hai. Agar yeh 100% ho jaye to server `Too many open files` error ke sath crash kar jata hai.

---

## 6. The USE Method Runbook (Hardware & Linux OS Metrics)

### 🔹 U1: CPU Utilization (%)
```promql
100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
```
* **Kyun use hoti hai?**: Pure Linux host machine ka CPU kitne percent busy hai (Idle time ko 100 se minus kiya hai).
* **Thresholds**: 🟢 `< 70%`, 🟡 `70% - 85%`, 🔴 `> 85%`.
* **Grafana Panel**: **Gauge** ya **Time series**.

### 🔹 S1: CPU Saturation (1-Minute Load Average per Core)
```promql
node_load1 / count by (instance) (node_cpu_seconds_total{mode="idle"})
```
* **Kyun use hoti hai?**: Agar Load Average CPU cores se barh jaye (Ratio > 1.0), to processes CPU pane ke liye queue me line laga kar kharay hain!
* **Thresholds**: 🟢 `< 1.0`, 🟡 `1.0 - 1.5`, 🔴 `> 2.0` (System is suffocating!).

### 🔹 U2: Memory (RAM) Utilization (%)
```promql
((node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes) * 100
```
* **Kyun use hoti hai?**: Linux OS ki kitni physical RAM currently consumed hai (Available buffers/cache ko subtract karke true usage).
* **Thresholds**: 🟢 `< 80%`, 🟡 `80% - 90%`, 🔴 `> 90%`.

### 🔹 S2: Memory Saturation (Swap Usage %)
```promql
((node_memory_SwapTotal_bytes - node_memory_SwapFree_bytes) / (node_memory_SwapTotal_bytes > 0)) * 100 or vector(0)
```
* **Kyun use hoti hai?**: Jab RAM full hone lagti hai to Linux disk par memory swap karne lagta hai, jis se system 100x slow ho jata hai.
* **Thresholds**: 🟢 `0%`, 🟡 `1% - 10%`, 🔴 `> 20%` (Memory exhausted!).

### 🔹 U3: Disk Space Utilization (%)
```promql
100 - ((node_filesystem_avail_bytes{mountpoint="/"} * 100) / node_filesystem_size_bytes{mountpoint="/"})
```
* **Kyun use hoti hai?**: Root disk partition (`/`) kitne percent bhar chuki hai.
* **Thresholds**: 🟢 `< 75%`, 🟡 `75% - 85%`, 🔴 `> 90%` (Disk full disaster imminent!).

### 🔹 E1: Network Interface Error & Drop Rate
```promql
sum by (device) (rate(node_network_receive_drop_total[5m])) + sum by (device) (rate(node_network_transmit_drop_total[5m]))
```
* **Kyun use hoti hai?**: Hardware ya virtual network cards kitne packets drop kar rahe hain.
* **Thresholds**: 🟢 `0`, 🔴 `> 0` (Network cable issue, faulty card, or buffer overflow).

