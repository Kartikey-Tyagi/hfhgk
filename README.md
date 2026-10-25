# Wind Forecast Intelligence

A quantitative web application for a UK energy utility analyst to evaluate national wind generation forecasts against actual outturn generation using the official **Elexon BMRS (Insights Solution) API**.

---

## 1. Project Overview

The application enables energy analysts to:
1. **Retrieve and Select Eligible Forecasts**: Query national wind generation forecasts (`WINDFOR`) and select the latest eligible forecast published at or before a specified day-ahead purchasing decision cutoff.
2. **Evaluate Accuracy Against Actual Generation**: Compare selected forecasts with actual half-hourly outturn generation (`FUELHH`, filtered to `fuelType = WIND`) aggregated to hourly intervals.
3. **Analyze Quantitative Accuracy Metrics**: Compute Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), Mean Error (ME with explicit directional sign), and data coverage across single-day or multi-day horizons.
4. **Inspect Forecast Vintages**: Full transparency into which publication timestamp was chosen for each delivery hour, guaranteeing strict historical decision cutoff compliance.

> **Scope Boundary**: This application is strictly an evaluation and forecast intelligence dashboard. It does not perform consumer demand forecasting, electricity price forecasting, or automated procurement recommendations.

---

## 2. Architecture and Data Flow

```mermaid
flowchart TD
    subgraph Elexon BMRS API
        ElexonWF["/datasets/WINDFOR/stream<br/>(publishDateTimeFrom, publishDateTimeTo)"]
        ElexonFHH["/datasets/FUELHH/stream<br/>(settlementDateFrom, settlementDateTo, fuelType=WIND)"]
    end

    subgraph FastAPI Backend (Python 3.12)
        ElexonClient["ElexonClient (httpx, TLS verify=True)"]
        Timestamps["Timezone Engine (UTC internal / Europe/London user-facing)"]
        ForecastProcessor["Forecast Selector (publishTime <= Cutoff on D-1)"]
        ActualsProcessor["Actuals Aggregator (SP 2h+1 & SP 2h+2 -> Hourly Avg)"]
        Evaluator["Metrics & Coverage Engine (MAE, RMSE, ME)"]
    end

    subgraph Vite + React + TypeScript Frontend
        Controls["Evaluation Controls & Presets"]
        MetricCards["KPI Summary Cards (MAE, RMSE, ME, Coverage)"]
        ForecastChart["Forecast vs. Actual Time Series (Disjoint SVG gaps)"]
        ErrorChart["Error Residuals Analysis (Zero Reference Line)"]
        VintageTable["Vintage Transparency & Interval Quality Table"]
    end

    ElexonWF --> ElexonClient
    ElexonFHH --> ElexonClient
    ElexonClient --> ForecastProcessor
    ElexonClient --> ActualsProcessor
    ForecastProcessor --> Evaluator
    ActualsProcessor --> Evaluator
    Evaluator --> Controls
    Evaluator --> MetricCards
    Evaluator --> ForecastChart
    Evaluator --> ErrorChart
    Evaluator --> VintageTable
```

---

## 3. Critical Data Rules & Metric Definitions

### 3.1 Decision Cutoff & Vintage Selection
- **Delivery Date ($D$)**: The calendar date when electricity is generated and consumed (e.g., $D \in [2026\text{-}01\text{-}01, 2026\text{-}01\text{-}31]$).
- **Provisional Default Cutoff**: **12:00:00 UTC on day $D - 1$** *(Assessment baseline assumption, configurable via UI/API)*.
- **Selection Criterion**: For each delivery hour $T$ on day $D$, the system evaluates only forecasts with $\text{publishTime} \le \text{Cutoff}(D)$ and selects the record maximizing $\text{publishTime}$.
- **Strict Post-Cutoff Exclusion**: Forecasts published after the cutoff (e.g. afternoon runs on $D - 1$ or intra-day runs on day $D$) are strictly excluded.
- **Lookback Window**: Delivery on 1 January 2026 uses forecasts published on or before 12:00 UTC on 31 December 2025. Data retrieval queries `WINDFOR` starting 48 hours prior to the delivery window.

### 3.2 Temporal Aggregation (Hourly vs. Half-Hourly)
- `FUELHH` provides outturn average MW over 30-minute settlement periods ($SP_1$ to $SP_{48}$).
- `WINDFOR` publishes hourly forecasts ($H_0$ to $H_{23}$).
- **Aggregation Rule**: For each hour $H$, the hourly actual generation is the arithmetic mean of its two constituent settlement periods:
  $$\text{Actual}_{\text{hour } H} = \frac{\text{Actual}(SP_{2H+1}) + \text{Actual}(SP_{2H+2})}{2}$$
- **Missing Data Policy**: If either constituent half-hour observation is missing or null, the hourly actual is left as `None` (not zero). It is excluded from accuracy metrics and counted against coverage.
- **Zero Generation**: `0.0 MW` is treated as a valid numeric generation reading, not missing data.

### 3.3 Accuracy Metrics & Sign Conventions
- **Error Definition**:
  $$\text{Error}_i = \text{Forecast}_i - \text{Actual}_i = \hat{y}_i - y_i$$
- **Mean Absolute Error (MAE)**:
  $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |\hat{y}_i - y_i|$$
- **Root Mean Squared Error (RMSE)**:
  $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (\hat{y}_i - y_i)^2}$$
- **Mean Error (ME)**:
  $$\text{ME} = \frac{1}{N} \sum_{i=1}^N (\hat{y}_i - y_i)$$
  - **$\text{ME} > 0$ (Positive)**: Systematically **over-forecasting** on average (forecast higher than outturn).
  - **$\text{ME} < 0$ (Negative)**: Systematically **under-forecasting** on average (forecast lower than outturn).
- **Data Coverage**:
  $$\text{Coverage (\%)} = \frac{N_{\text{valid pairs}}}{N_{\text{expected intervals}}} \times 100\%$$
  - Denominator for complete January 2026: **744 hourly intervals** (31 days × 24 hours).
  - Denominator for single day: **24 hourly intervals**.
  - Describes **data availability**, not forecast accuracy. Missing results are displayed as `N/A`, never numeric zero.

---

---

## 4. Docker Execution (Recommended)

The entire application (FastAPI backend + React/Nginx frontend) is containerized and can be launched with a single command without installing Python, Node.js, or local dependencies.

### 4.1 Prerequisites
- **Docker Desktop** (macOS, Windows, or Linux) with Docker Compose v2 (`docker compose version`).

### 4.2 Quick Start
From the project root directory, run:
```bash
docker compose up --build
```

Once running:
- Open your browser to the **Wind Forecast Intelligence Dashboard**:
  $$\text{\textbf{http://localhost:8080}}$$
- The frontend reverse proxy forwards API requests (`/api/`) internally to the FastAPI backend (`http://backend:8000/api/`).
- The backend health status is visible in the top-right header badge (**"Elexon BMRS Ready"**).

### 4.3 Container Management
```bash
# View live application logs (both services)
docker compose logs -f

# View logs for a specific service
docker compose logs -f backend
docker compose logs -f frontend

# Check container health and status
docker compose ps

# Stop and remove containers and network
docker compose down

# Rebuild containers after code changes
docker compose up --build
```

### 4.4 Docker Architecture & Networking
```
  [ Web Browser ]
        │  http://localhost:8080/ (SPA static assets)
        │  http://localhost:8080/api/... (Same-origin API calls)
        ▼
┌────────────────────────────────────────────────────────┐
│  frontend container (wind-forecast-frontend)           │
│  - Nginx Alpine web server listening on port 80        │
│  - Serves compiled React 19 + TypeScript bundle        │
│  - Reverse proxy: location /api/ ──┐                   │
└────────────────────────────────────┼───────────────────┘
                                     │ internal bridge network (wind-forecast-network)
                                     ▼ http://backend:8000/api/...
┌────────────────────────────────────────────────────────┐
│  backend container (wind-forecast-backend)             │
│  - Python 3.12-slim / Uvicorn listening on port 8000   │
│  - Non-root user (appuser:1000)                        │
│  - Health check: curl -f http://localhost:8000/api/health
│  - Queries official Elexon BMRS API with verified TLS  │
└────────────────────────────────────┬───────────────────┘
                                     │ Outbound HTTPS (TLS verified)
                                     ▼
                    [ Official Elexon BMRS API ]
                    https://data.elexon.co.uk/bmrs/api/v1
```

- **Same-Origin Reverse Proxy**: The browser issues standard relative API requests to `/api/health` and `/api/evaluation`. Nginx proxies these over Docker's internal DNS network to `http://backend:8000/api/`. This completely eliminates browser CORS issues without requiring host-level DNS tricks.
- **Port Isolation**: Port 8000 is kept private to the Docker network. Only port 8080 is published to the host machine.
- **Health-Checked Dependency**: The frontend container startup waits for the backend to report healthy (`service_healthy` condition on `/api/health`).

### 4.5 Troubleshooting Docker Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| **Port 8080 already in use** | Another service on your machine is using port 8080. | Modify `ports` in `docker-compose.yml` to `"8081:80"` and access `http://localhost:8081`. |
| **Backend reports offline in header** | Backend container failed health check or hasn't finished initial data query. | Check backend logs: `docker compose logs backend`. Confirm container status with `docker compose ps`. |
| **Elexon API connection timeout** | Corporate firewall, VPN, or network blocking outbound HTTPS to `data.elexon.co.uk`. | Ensure outbound HTTPS on port 443 is permitted. Increase `ELEXON_REQUEST_TIMEOUT=60.0` in `.env`. |
| **Stale build assets** | Docker layer caching reused an earlier build stage. | Force a clean rebuild without cache: `docker compose build --no-cache && docker compose up`. |

---

## 5. Production Cloud Deployment (Vercel + Docker PaaS)

The application supports decoupled production deployment:
- **Frontend**: Hosted on **Vercel** as a high-performance Single Page Application (SPA) with global CDN caching.
- **Backend**: Hosted on any **Docker-compatible PaaS** (such as **Render**, **Railway**, or **Heroku Container Registry**) using `backend/Dockerfile`.

```
  [ Client Browser ]
        │
        ├──► https://<your-app>.vercel.app (Static Assets & React SPA)
        │
        └──► https://<your-backend>.onrender.com/api/... (FastAPI Analytical API)
                    │
                    ▼ Outbound HTTPS (TLS verify=True)
         [ Official Elexon BMRS API ]
```

### 5.1 Step 1: Deploy the Backend (Docker PaaS)
1. **Container Configuration**:
   - The backend runs using `backend/Dockerfile`.
   - The server dynamically binds to `$PORT` provided by PaaS runtimes (e.g., Render, Heroku) while defaulting to `8000` for local Docker Compose.
2. **Environment Variables**:
   - `CORS_ORIGINS`: Set to your deployed Vercel URL and local ports (e.g. `https://wind-forecast-intelligence.vercel.app,http://localhost:5173`).
   - `ELEXON_BASE_URL`: `https://data.elexon.co.uk/bmrs/api/v1` (safe default in code).
   - `ELEXON_REQUEST_TIMEOUT`: `30.0` (safe default in code).
   - `DEFAULT_CUTOFF_TIME`: `12:00:00` (safe default in code).
3. **Health Check**:
   - Verify deployment by visiting `https://<your-backend>/api/health`. It returns HTTP 200 with `{"status": "ok"}`.

### 5.2 Step 2: Deploy the Frontend (Vercel)
1. **Vercel Project Settings**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
2. **API Connection Options**:
   - **Method A (Recommended — Direct CORS)**:
     In your Vercel Project Settings under **Environment Variables**, set:
     ```bash
     VITE_API_BASE_URL=https://<your-deployed-backend-url>
     ```
     During `npm run build`, Vite inlines this URL into the frontend API service layer.
   - **Method B (Edge Rewrites via `vercel.json`)**:
     Update `frontend/vercel.json` and replace `https://BACKEND_URL_PLACEHOLDER` with your live backend domain:
     ```json
     {
       "rewrites": [
         { "source": "/api/:path*", "destination": "https://<your-deployed-backend-url>/api/:path*" },
         { "source": "/(.*)", "destination": "/index.html" }
       ]
     }
     ```
     Leave `VITE_API_BASE_URL` empty, and Vercel will proxy `/api/*` server-side at the edge.

### 5.3 Environment Variables Reference

| Environment Variable | Service | Local Docker Compose | Production Cloud | Description |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Backend | `8000` (internal) | Dynamic (PaaS assigned) | Port Uvicorn listens on. |
| `CORS_ORIGINS` | Backend | `http://localhost:5173,http://localhost:8080` | `https://<app>.vercel.app` | Allowed browser origins. |
| `ELEXON_BASE_URL` | Backend | `https://data.elexon.co.uk/bmrs/api/v1` | `https://data.elexon.co.uk/bmrs/api/v1` | Official Elexon BMRS API base. |
| `ELEXON_REQUEST_TIMEOUT` | Backend | `30.0` | `30.0` | Upstream request timeout in seconds. |
| `DEFAULT_CUTOFF_TIME` | Backend | `12:00:00` | `12:00:00` | Day-ahead D−1 cutoff time in UTC. |
| `VITE_API_BASE_URL` | Frontend | *(Empty — proxied by Nginx)* | `https://<backend-host>` | Base URL for frontend API calls. |

---

## 6. Local Development (Optional / Without Docker)

A local Python virtual environment and local `npm install` are **optional** and only required if you choose to develop without Docker.

### 6.1 Backend Setup
```bash
# 1. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install --upgrade pip
pip install -r backend/requirements.txt

# 3. Start the FastAPI development server
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Backend API available at: `http://localhost:8000` (Swagger docs: `http://localhost:8000/docs`).

### 6.2 Frontend Setup
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
Frontend development dashboard available at: `http://localhost:5173`.

---

## 7. Running Automated Tests

### 7.1 Backend Unit Tests (43 tests, ~0.4s)
Deterministic tests using `pytest` and mocked HTTP transports (no live external network requests):
```bash
.venv/bin/pytest backend/tests
```

### 7.2 Backend Live January 2026 Validation Script
Queries official Elexon endpoints with verified TLS and executes the complete backtest:
```bash
.venv/bin/python backend/scripts/validate_january_2026.py
```

### 7.3 Frontend Unit & Integration Tests (43 tests in 7 suites, ~3.5s)
Runs Vitest and React Testing Library:
```bash
cd frontend && npm test
```

### 7.4 Frontend Production Build
Validates TypeScript compilation and bundles static assets:
```bash
cd frontend && npm run build
```

---

## 8. Empirical January 2026 Backtest Results

Executing the pipeline across the complete month of January 2026 (provisional cutoff: 12:00 UTC on $D-1$) yielded the following empirical findings:
- **Expected Hourly Intervals**: 744 hours
- **Valid Forecast–Actual Pairs**: 744 hours
- **Data Coverage**: **100.00%**
- **Mean Absolute Error (MAE)**: **2,017.92 MW**
- **Root Mean Squared Error (RMSE)**: **2,477.04 MW**
- **Mean Error (ME)**: **+1,806.23 MW** *(Net day-ahead over-forecasting observed across January 2026)*

---

## 9. Known Limitations & API Observations

1. **Winter vs. Summer Publication Timestamps**:
   - Elexon Data Catalogue lists publication times as `03:30, 05:30, ...`.
   - Live API verification revealed that during winter (GMT / UTC+0), actual UTC publication timestamps are `02:30Z, 04:30Z, ...` (1 hour earlier in UTC). On the daylight saving transition (29 March 2026), they shift to `03:30Z, 05:30Z, ...`. The system compares raw UTC timestamps directly without manual clock offset tampering.
2. **Daylight Saving Time (DST) & Settlement Period Mapping**:
   - January 2026 is entirely within Greenwich Mean Time (GMT / UTC+0), where every day has exactly 24 hours and 48 half-hourly settlement periods ($SP_1$ to $SP_{48}$).
   - Under UK BSC market rules, the spring clock change day (e.g. 29 March 2026) has 46 settlement periods (23 clock hours), while the autumn clock change day (e.g. 25 October 2026) has 50 settlement periods (25 clock hours). The current aggregator maps standard 48-period days ($SP_{2h+1}$ and $SP_{2h+2}$). Supporting clock-change transition days with non-standard settlement counts (46 or 50 SPs) is a documented limitation outside the January 2026 assessment scope.
3. **Assessment Assumption vs. Commercial Policy**:
   - The provisional 12:00 UTC cutoff on $D-1$ is an analytical assessment assumption to inspect day-ahead forecast vintages. It does not represent a commercial trading policy.
   - The application evaluates forecast vs. outturn wind generation only. Because consumer demand, thermal/nuclear dispatch, transmission constraints, and electricity market prices are excluded, no automated procurement recommendations are generated or implied.
4. **Resolution Mismatch**:
   - `FUELHH` is half-hourly; `WINDFOR` is hourly. Hourly arithmetic averaging of the two settlement periods is employed to ensure physical and dimensional consistency in MW.

---

## 10. AI Tools Disclosure

In accordance with project guidelines:
- **Antigravity (Gemini 3.8 Flash)** was utilized as an agentic pair-programming assistant throughout all phases of this project, including:
  - Phase 1: Investigating official Elexon OpenAPI specifications, swagger schemas, and empirical endpoint verification.
  - Phase 2: Implementing the Python FastAPI backend, Elexon client, cutoff filtering, metric equations, and automated unit test suite.
  - Phase 3: Scaffolding the React + TypeScript frontend, building responsive SVG visualization components, and writing Vitest integration tests.
  - Phase 4: Usability and presentation pass implementing the polished Light Analytics Theme, accessible metric cards, and DST safe controls.
  - Phase 5A/5B: Containerization with multi-stage frontend Dockerfile, Nginx reverse proxy, Python 3.12 backend Dockerfile, and root Docker Compose configuration.
  - Phase 5C: Comprehensive audit, centralization, and standardization of date and time formatting (Intl.DateTimeFormat, dynamic GMT/BST, dual publication timestamps, timezone-safe calendar parsing).
  - Phase 5D: Production deployment audit and hardening for decoupled cloud hosting (Vercel SPA edge routing, dynamic PaaS $PORT binding, configurable CORS origin filtering).


