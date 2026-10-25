# Elexon BMRS API Investigation: Wind Generation Forecasts (WINDFOR) and Actuals (FUELHH)

**Date**: October 2026  
**Status**: Completed  
**Author**: Engineering Team  

---

## 1. Executive Summary

The primary objective of this investigation is to determine whether the official Elexon Insights Solution (BMRS) API enables the reconstruction of **historical forecast vintages for January 2026**, so that for any delivery interval, a UK energy utility can select the latest forecast published at or before a specified day-ahead purchasing decision cutoff and quantitatively evaluate it against actual generation.

### Core Conclusion
**Yes, accurate historical day-ahead forecast evaluation for January 2026 is fully feasible with the available API.**

Key verified findings:
1. **Public Access**: The Elexon Insights Solution API requires **no authentication** (no API key or token needed) for standard queries.
2. **Historical Forecast Vintages Retained**: When queried with `publishDateTimeFrom` and `publishDateTimeTo`, the `WINDFOR` endpoint does **not** collapse data to only the latest forecast. It returns **all historical forecast publication runs** within the requested publish window.
3. **Verified Revisions in January 2026**: Empirical testing on January 2026 data confirms multiple publication vintages per delivery interval (`startTime`), showing genuine forecast revisions across successive publication runs prior to delivery.
4. **Complete Coverage for January 2026**:
   - `FUELHH` returns all **1,488 settlement periods** (31 days × 48 half-hours) for `fuelType = WIND`.
   - `WINDFOR` returns **18,104 forecast records** across **248 distinct publication runs** (published approximately every 2–4 hours with a 72-hour forecast horizon).
5. **Critical Resolution Difference Identified**:
   - `FUELHH` actuals are **half-hourly** (30-minute intervals).
   - `WINDFOR` forecasts are **hourly** (60-minute intervals).
   - A documented interval alignment strategy is required (e.g. averaging the two settlement periods comprising each hour, or matching by matching hourly start timestamps).

---

## 2. API Endpoints and Authentication

### 2.1 Base URL
```
https://data.elexon.co.uk/bmrs/api/v1
```

### 2.2 Official Documentation References
- **WINDFOR/stream Documentation**: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)
- **WINDFOR Standard Documentation**: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR)
- **FUELHH/stream Documentation**: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- **FUELHH Standard Documentation**: [https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH)
- **OpenAPI 3.0 Specification**: `https://data.elexon.co.uk/swagger/v1/swagger.json`
- **Developer Portal**: [https://developer.data.elexon.co.uk](https://developer.data.elexon.co.uk)

### 2.3 Authentication
- **Requirements**: None.
- **Specification Status**: OpenAPI spec specifies no security schemes for these endpoints (`security: []`).
- **Empirical Verification**: Requests to `https://data.elexon.co.uk/bmrs/api/v1/...` succeed with HTTP 200 without headers, cookies, or API keys.

---

## 3. Dataset 1: Actual Generation (`FUELHH`)

### 3.1 Endpoint Details
- **Stream Endpoint (Recommended)**: `GET /datasets/FUELHH/stream`  
  *Returns a flat JSON array directly, minimizing payload wrapper overhead.*
- **Standard Endpoint**: `GET /datasets/FUELHH`  
  *Returns an object with envelope `{"data": [...]}` and supports `format` parameter (`json`, `xml`, `csv`).*

### 3.2 Supported Query Parameters
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `settlementDateFrom` | String (`YYYY-MM-DD`) | No | Start date for settlement day filter. |
| `settlementDateTo` | String (`YYYY-MM-DD`) | No | End date for settlement day filter. |
| `settlementPeriod` | Integer / Array | No | Settlement period filter (1 to 48, or up to 50 on clock change). |
| `fuelType` | String / Array | No | Fuel type category (e.g. `WIND`, `NUCLEAR`, `CCGT`, `BIOMASS`). |
| `publishDateTimeFrom` | ISO-8601 Date-Time | No | Filter by publication time start. |
| `publishDateTimeTo` | ISO-8601 Date-Time | No | Filter by publication time end. |
| `format` | String | No | `json`, `xml`, `csv` (Standard endpoint only). |

> **Critical Constraint from Documentation**: Settlement Date fields (`settlementDateFrom`/`settlementDateTo`) **cannot** be combined with Publish Date fields (`publishDateTimeFrom`/`publishDateTimeTo`). When querying generation actuals for specific calendar dates, use `settlementDateFrom` and `settlementDateTo`.

### 3.3 Response Schema and Field Definitions
Verified against OpenAPI model `AugmentedOutturnData`:
```json
{
  "dataset": "FUELHH",
  "publishTime": "2026-01-01T00:30:00Z",
  "startTime": "2026-01-01T00:00:00Z",
  "settlementDate": "2026-01-01",
  "settlementPeriod": 1,
  "fuelType": "WIND",
  "generation": 13756
}
```

- `dataset`: Fixed string `"FUELHH"`.
- `publishTime`: UTC ISO-8601 string when the outturn record was published.
- `startTime`: UTC ISO-8601 timestamp marking the start of the 30-minute settlement period.
- `settlementDate`: Calendar settlement date (`YYYY-MM-DD`).
- `settlementPeriod`: Integer 1 to 48 (representing the 48 half-hour periods of the settlement day).
- `fuelType`: Fuel type name. Must be filtered to `"WIND"`.
- `generation`: Average outturn generation over the 30-minute period in **Megawatts (MW)** (integer).

### 3.4 Verification for January 2026
- Query: `GET /datasets/FUELHH/stream?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-31&fuelType=WIND`
- **Result**: Exactly **1,488 records** returned (31 days × 48 settlement periods = 1,488).
- **Data Completeness**: 100% complete; zero null generation values for wind in January 2026.

---

## 4. Dataset 2: Wind Forecasts (`WINDFOR`)

### 4.1 Endpoint Details
- **Stream Endpoint (Recommended)**: `GET /datasets/WINDFOR/stream`  
  *Optimized flat JSON array of forecast records.*
- **Standard Endpoint**: `GET /datasets/WINDFOR`  
  *Returns `{"data": [...]}` envelope.*
- **Alternative Helper Endpoints** (found in OpenAPI spec):
  - `GET /forecast/generation/wind/evolution?startTime={iso}`: Returns all historical forecast revisions published for a specific delivery time.
  - `GET /forecast/generation/wind/history?publishTime={iso}`: Returns the full 72-hour forecast profile published at a specific publication timestamp.
  - `GET /forecast/generation/wind/latest?from={iso}&to={iso}`: Returns only the latest forecast for each interval in a window.

### 4.2 Supported Query Parameters for `/datasets/WINDFOR/stream`
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `publishDateTimeFrom` | ISO-8601 Date-Time | No | Filter forecasts published at or after this UTC timestamp. |
| `publishDateTimeTo` | ISO-8601 Date-Time | No | Filter forecasts published at or before this UTC timestamp. |

> **Crucial Behavioral Finding**: The documentation specifies: *"Specific publish time filters may be supplied, otherwise this will retrieve the latest published forecast."*  
> When `publishDateTimeFrom` and `publishDateTimeTo` are specified, the API returns **all forecasts published within that window**, preserving the historical series of vintages.

### 4.3 Response Schema and Field Definitions
Verified against OpenAPI model `WindGenerationForecast`:
```json
{
  "dataset": "WINDFOR",
  "publishTime": "2026-01-01T11:30:00Z",
  "startTime": "2026-01-02T12:00:00Z",
  "generation": 17893
}
```

- `dataset`: Fixed string `"WINDFOR"`.
- `publishTime`: UTC ISO-8601 timestamp at which the forecast run was computed and published by the National Grid ESO / Elexon system.
- `startTime`: UTC ISO-8601 timestamp at which the delivery interval begins.
- `generation`: Forecasted national wind generation in **Megawatts (MW)** (integer).

---

## 5. Historical Forecast-Vintage Investigation

### 5.1 The Core Question
Does `WINDFOR` allow reconstruction of historical forecast vintages for January 2026, enabling selection of the latest forecast published at or before a specified historical day-ahead decision cutoff?

### 5.2 Documented vs. Verified Behavior
| Capability | Documented in Elexon Portal | Verified via Live API Responses |
| :--- | :---: | :---: |
| Endpoint `/datasets/WINDFOR/stream` exists and accepts `publishDateTimeFrom` / `publishDateTimeTo` | **Yes** | **Yes** (HTTP 200) |
| Multiple forecast runs retained for January 2026 | **Implied** ("Specific publish time filters may be supplied") | **Yes** (248 runs, 18,104 records in Jan 2026) |
| Successive forecast runs contain revised values for the same delivery interval (`startTime`) | **Not explicitly stated** | **Verified empirically** |
| Response contains both `publishTime` and `startTime` | **Yes** (schema confirmed) | **Yes** |

### 5.3 Empirical Proof: Forecast Evolution for Delivery Time `2026-01-02T12:00:00Z`
To verify that real forecast revisions are recorded historically, we queried all forecasts published on January 1, 2026 for delivery on January 2, 2026 at 12:00 UTC:

```
Target Delivery startTime: 2026-01-02T12:00:00Z
------------------------------------------------------------
Publish Time (UTC)       Forecast Generation (MW)
2026-01-01T02:30:00Z     17,498 MW
2026-01-01T04:30:00Z     17,558 MW
2026-01-01T07:30:00Z     17,541 MW
2026-01-01T09:30:00Z     17,739 MW
2026-01-01T11:30:00Z     17,893 MW  <-- Latest at Day-Ahead 12:00 Cutoff
2026-01-01T15:30:00Z     18,144 MW
2026-01-01T18:30:00Z     18,218 MW
2026-01-01T22:30:00Z     18,110 MW
------------------------------------------------------------
Actual Outturn (FUELHH): 
- 2026-01-02T12:00:00Z (SP 25): 18,634 MW
- 2026-01-02T12:30:00Z (SP 26): 18,720 MW
```

### 5.4 Day-Ahead Decision Cutoff Simulation
If the energy utility's day-ahead purchasing decision cutoff is set to **12:00 UTC on day $D-1$ (`2026-01-01T12:00:00Z`)** for delivery on day $D$ (`2026-01-02`):
1. Candidate forecasts for `startTime = 2026-01-02T12:00:00Z` published on or before `2026-01-01T12:00:00Z`:
   - `02:30:00Z` (17,498 MW)
   - `04:30:00Z` (17,558 MW)
   - `07:30:00Z` (17,541 MW)
   - `09:30:00Z` (17,739 MW)
   - `11:30:00Z` (17,893 MW)
2. Filter condition: $\text{publishTime} \le \text{cutoff}$.
3. Latest eligible forecast selected: **`2026-01-01T11:30:00Z` (17,893 MW)**.
4. Forecast published after cutoff (`15:30:00Z`, `18:30:00Z`, `22:30:00Z`) are strictly excluded.

This proves that **historical forecast vintage reconstruction works as required**.

---

## 6. Interval Alignment & Temporal Resolution

### 6.1 Resolution Contrast
| Property | `WINDFOR` (Forecast) | `FUELHH` (Actual) |
| :--- | :--- | :--- |
| **Interval Frequency** | Hourly (60 minutes) | Half-hourly (30 minutes) |
| **Timestamp format** | `YYYY-MM-DDTHH:00:00Z` | `YYYY-MM-DDTHH:00:00Z` and `YYYY-MM-DDTHH:30:00Z` |
| **Settlement Periods** | Not present in dataset | 1 to 48 (explicitly given) |
| **Forecast Horizon** | 72 hours per run | N/A (outturn after delivery) |
| **Publication Frequency** | ~Every 2 to 4 hours (8 runs/day) | Every 30 minutes |

### 6.2 Alignment Strategies
Because `WINDFOR` publishes forecasts on the hour and `FUELHH` provides outturn per half-hour settlement period, the application must adopt a clear, statistically sound alignment rule:

- **Strategy 1: Hourly Outturn Averaging (Recommended)**
  Each hourly forecast interval $[T, T+60\text{m})$ is compared against the average of the two 30-minute settlement periods $[T, T+30\text{m})$ and $[T+30\text{m}, T+60\text{m})$.  
  $$\text{Actual}_{\text{hour}} = \frac{\text{Actual}(SP_{2k-1}) + \text{Actual}(SP_{2k})}{2}$$
  *Rationale*: Wind generation forecasts in MW represent average expected power over the hourly interval; averaging the two half-hourly outturn readings provides the exact physical average power delivered over that hour.

- **Strategy 2: Settlement Period Duplication**
  The hourly forecast is mapped to both constituent half-hour settlement periods (`HH:00` and `HH:30`), evaluating error across 48 periods.

- **Strategy 3: Exact `startTime` Matching**
  Only the half-hour settlement period starting exactly on the hour (`HH:00:00Z`) is matched, discarding the `:30:00Z` periods.  
  *Limitation*: Drops 50% of outturn observations.

**Recommendation**: Support **Strategy 1 (Hourly Aggregation)** as the primary method, with clear explanation in UI and documentation.

---

## 7. Limitations, Edge Cases, and Mitigations

1. **Query Duration for Full Month**:
   - Querying the full month of January 2026 `WINDFOR/stream` (18,104 records) takes ~15–20 seconds over the network.
   - *Mitigation*: The backend should cache downloaded data locally (e.g. SQLite or in-memory parquet/dict cache) so user date selections respond in milliseconds.
2. **Forecast Lookback Horizon**:
   - Delivery on the morning of January 1, 2026 requires forecasts published day-ahead on **December 31, 2025**.
   - *Mitigation*: When evaluating delivery date $D$, the backend data ingestion must query `WINDFOR` with `publishDateTimeFrom` starting at least 48 hours prior to $D$ (e.g. $D-2$), ensuring that even if the decision cutoff is early on $D-1$, eligible forecasts are captured.
3. **Missing Data Handling**:
   - Neither dataset contains synthesized zero values; if National Grid or Elexon had a telemetry failure, the period is omitted or null.
   - In accordance with `GEMINI.md`, missing intervals must never be filled with zero, and data coverage must be tracked explicitly:
     $$\text{Coverage} = \frac{N_{\text{valid pairs}}}{N_{\text{expected intervals}}} \times 100\%$$
4. **Timezone Handling**:
   - API timestamps are in UTC (`Z`). User display requires `Europe/London` (Greenwich Mean Time in January, British Summer Time in summer).
   - Python `zoneinfo` should be used consistently.

---

## 8. Recommended Architecture for Data Pipeline

```mermaid
flowchart TD
    subgraph Elexon BMRS API
        ElexonWF["/datasets/WINDFOR/stream<br/>(publishDateTimeFrom, publishDateTimeTo)"]
        ElexonFHH["/datasets/FUELHH/stream<br/>(settlementDateFrom, settlementDateTo, fuelType=WIND)"]
    end

    subgraph Python Backend
        IngestService["Data Ingestion Service"]
        LocalCache[("Cache / Storage<br/>(JSON / SQLite)")]
        CutoffFilter["Cutoff Filter<br/>publishTime <= Cutoff"]
        Selector["Latest Forecast Selector<br/>max(publishTime) per startTime"]
        Aligner["Temporal Aligner<br/>(Hourly Forecast vs Avg Actual)"]
        MetricsEngine["Accuracy Metrics Engine<br/>(MAE, RMSE, ME, Coverage)"]
    end

    subgraph React Frontend
        UI["Dashboard & Analytics<br/>- Decision Cutoff Picker<br/>- Delivery Date Range Picker<br/>- Forecast vs Actual Chart<br/>- Metric Summary Cards"]
    end

    ElexonWF --> IngestService
    ElexonFHH --> IngestService
    IngestService --> LocalCache
    LocalCache --> CutoffFilter
    CutoffFilter --> Selector
    Selector --> Aligner
    LocalCache --> Aligner
    Aligner --> MetricsEngine
    MetricsEngine --> UI
```

### Retrieval Steps
1. **Actuals**: Query `/datasets/FUELHH/stream?settlementDateFrom={startDate}&settlementDateTo={endDate}&fuelType=WIND`.
2. **Forecasts**: Query `/datasets/WINDFOR/stream?publishDateTimeFrom={startDate - 2 days}&publishDateTimeTo={cutoffDateTime}`.
3. **Filter**: For each target delivery interval (`startTime`), keep only records where $\text{publishTime} \le \text{cutoffDateTime}$.
4. **Select Latest**: Group candidate forecasts by `startTime` and take the row with the maximum `publishTime`.
5. **Align & Evaluate**: Join with actual outturns on delivery interval, aggregate actuals to hourly resolution, compute valid pair errors $(\text{error}_i = \hat{y}_i - y_i = \text{forecast}_i - \text{actual}_i)$, and calculate MAE, RMSE, ME, and coverage. Note: Under this convention, a positive Mean Error ($\text{ME} > 0$) signifies over-forecasting, while a negative Mean Error ($\text{ME} < 0$) signifies under-forecasting.

---

## 9. Conclusion

Accurate historical day-ahead forecast evaluation for January 2026 is **fully supported by Elexon's public APIs**. Both `FUELHH` and `WINDFOR` retain complete, uncorrupted historical data, and `WINDFOR` provides the publication vintages required to enforce decision-cutoff constraints.

---

## 10. Validation Addendum: Focused Verification & Empirical Reconciliations

**Date**: October 2026  
**Status**: Verified  

This addendum addresses four critical questions regarding decision cutoffs, publication timestamps, temporal aggregation, and API query limits prior to application implementation.

```
+----------------------------------------------------------------------------------------------------+
| TAXONOMY CONVENTION:                                                                              |
| - [DOCUMENTED]: Supported by official Elexon BSC/BMRS documentation or OpenAPI schemas.           |
| - [EMPIRICAL]: Verified via live read-only HTTP queries to data.elexon.co.uk.                     |
| - [ASSUMPTION]: Engineering design decision or business logic rule proposed for implementation.   |
+----------------------------------------------------------------------------------------------------+
```

---

### 10.1 Issue 1: Per-Delivery-Date Decision Cutoffs

#### 10.1.1 Distinction Between Delivery Date and Forecast Publication Date
- **Delivery Date ($D$)**: The calendar date during which electricity is generated and physically delivered to the GB grid. For January 2026, $D \in [2026\text{-}01\text{-}01, 2026\text{-}01\text{-}31]$. Delivery intervals are represented by `startTime` in UTC:
  $$\text{Intervals for } D = \{D\text{T}00:00:00\text{Z}, D\text{T}01:00:00\text{Z}, \dots, D\text{T}23:00:00\text{Z}\} \quad (24 \text{ hourly windows})$$
- **Forecast Publication Date ($P$)**: The timestamp when National Energy System Operator (NESO) / Elexon produced and published the forecast run. For day-ahead decisions, $P \le D - 1$.
- **Decision Cutoff**: The operational deadline on day $D - 1$ at which purchasing decisions must be committed. For our provisional baseline:
  $$\text{Cutoff}(D) = (D - 1)\text{T}12:00:00\text{Z}$$

#### 10.1.2 Independent Per-Date Forecast Selection Rule
For each delivery date $D$, candidate forecasts are filtered and selected **completely independently**:
1. **Candidate Pool**: A forecast record $r$ is eligible for delivery date $D$ if and only if:
   $$r.\text{startTime} \in \text{Intervals}(D) \quad \text{AND} \quad r.\text{publishTime} \le \text{Cutoff}(D)$$
2. **Latest Eligible Selection**: For each target delivery hour $T \in \text{Intervals}(D)$, select the unique record $r^*$ maximizing `publishTime`:
   $$r^*(T) = \arg\max_{r \in \text{Eligible}(T)} r.\text{publishTime}$$
3. **Strict Exclusion of Post-Cutoff Forecasts**: Any forecast published after $\text{Cutoff}(D)$ (such as afternoon runs on $D - 1$ at 15:30Z, 18:30Z, 22:30Z, or intra-day runs on day $D$) is strictly excluded from day $D$'s evaluation. A later forecast published on day $D - 1$ at 18:30Z can **never** contaminate the day-ahead evaluation for delivery on day $D$.

#### 10.1.3 Handling 1 January 2026 Delivery (December 2025 Retrieval)
- For delivery on $D = 2026\text{-}01\text{-}01$, the day-ahead cutoff is:
  $$\text{Cutoff}(2026\text{-}01\text{-}01) = 2025\text{-}12\text{-}31\text{T}12:00:00\text{Z}$$
- To ensure full coverage, `WINDFOR` retrieval must begin at least 48 hours prior to the delivery window (from `2025-12-30T00:00:00Z`).
- **[EMPIRICAL] Verification**:
  - Queried `GET /datasets/WINDFOR/stream?publishDateTimeFrom=2025-12-30T00:00:00Z&publishDateTimeTo=2025-12-31T23:59:59Z`.
  - Returned **1,168 records** across 16 publication runs.
  - Exactly **296 records** covering 1 January delivery were published on or before `2025-12-31T12:00:00Z`.
  - Exactly **24 / 24 hourly intervals** for 1 January 2026 have eligible forecasts published prior to the 12:00 UTC cutoff on 31 December 2025. The latest eligible run for all 24 hours of 1 January was published at `2025-12-31T11:30:00Z`.

---

### 10.2 Issue 2: Forecast Publication Timestamps & Documentation Reconciliation

#### 10.2.1 The Apparent Discrepancy
- **[DOCUMENTED] In Elexon Data Catalogue**:
  Official documentation for WINDFOR specifies 8 daily publications at:
  $$\text{Documented Schedule} = \{03:30, 05:30, 08:30, 10:30, 12:30, 16:30, 19:30, 23:30\}$$
- **[EMPIRICAL] In API Responses for January 2026**:
  The actual UTC timestamps in the `publishTime` field for all of January 2026 are:
  $$\text{Jan 2026 API } \text{publishTime} = \{02:30\text{Z}, 04:30\text{Z}, 07:30\text{Z}, 09:30\text{Z}, 11:30\text{Z}, 15:30\text{Z}, 18:30\text{Z}, 22:30\text{Z}\}$$
  Every single publication run in January is exactly **1 hour earlier** than the documented catalogue times.

#### 10.2.2 Empirical Reconciliation Across Seasons
To determine whether this is an error, a static offset, or a daylight saving artifact, we queried `WINDFOR/stream` across seasonal boundaries in 2026:

| Period | UK Clock / Daylight Saving | Verified API `publishTime` (UTC) |
| :--- | :--- | :--- |
| **January 2026** (Winter) | GMT (UTC+0) | `02:30Z, 04:30Z, 07:30Z, 09:30Z, 11:30Z, 15:30Z, 18:30Z, 22:30Z` |
| **2026-03-28** (Day before clock change) | GMT (UTC+0) | `02:30Z, 04:30Z, 07:30Z, 09:30Z, 11:30Z, 15:30Z, 18:30Z, 22:30Z` |
| **2026-03-29** (Daylight saving transition) | BST begins (UTC+1) | `03:30Z, 05:30Z, 08:30Z, 10:30Z, 12:30Z, 16:30Z, 19:30Z, 23:30Z` |
| **July 2026** (Summer) | BST (UTC+1) | `03:30Z, 05:30Z, 08:30Z, 10:30Z, 12:30Z, 16:30Z, 19:30Z, 23:30Z` |
| **October 2026** (Current) | BST (UTC+1) | `03:30Z, 05:30Z, 08:30Z, 10:30Z, 12:30Z, 16:30Z, 19:30Z, 23:30Z` |

#### 10.2.3 Findings & Conclusion on Timestamps
1. **[EMPIRICAL] Clock Shift**: On 29 March 2026, the UTC `publishTime` values shifted by exactly +1 hour.
2. **[DOCUMENTED vs REALITY]**: The published times listed in the Elexon Data Catalogue (`03:30, 05:30, ...`) represent the UTC timestamps during British Summer Time (or Central European Time in winter). During winter (GMT), the upstream NESO forecasting job runs 1 hour earlier in UTC (`02:30Z, 04:30Z, ...`).
3. **[ASSUMPTION / IMPLEMENTATION RULE]**: **Trust the explicit UTC string returned by the API**. Because the API provides ISO-8601 timestamps ending in `Z` (e.g. `2026-01-01T11:30:00Z`), the application must parse and compare timestamps strictly in UTC. A cutoff of `12:00:00Z` on day $D - 1$ correctly admits the `11:30:00Z` forecast run and rejects the `15:30:00Z` run without requiring ad-hoc manual offset adjustments.

---

### 10.3 Issue 3: Hourly Forecast vs. Half-Hourly Actuals

#### 10.3.1 Native Temporal Resolutions
- **[DOCUMENTED] `FUELHH` (Actuals)**: Half-hourly settlement periods. Generation is defined as *"average MW values over 30 minutes for each category"*.
- **[DOCUMENTED & EMPIRICAL] `WINDFOR` (Forecasts)**: Hourly. Across all 18,104 records in January 2026, 100% of `startTime` timestamps have minutes equal to `:00:00Z`. Zero half-hourly records exist in `WINDFOR`.

#### 10.3.2 Physical and Mathematical Soundness of Hourly Averaging
- For any delivery hour $[H, H+1)$:
  - Settlement Period $2H + 1$ covers $[H:00, H:30)$ with average power $P_1$ (MW).
  - Settlement Period $2H + 2$ covers $[H:30, H+1:00)$ with average power $P_2$ (MW).
- The total energy delivered in that hour is:
  $$E_{\text{actual}} = P_1 \times 0.5\text{ h} + P_2 \times 0.5\text{ h} = \left(\frac{P_1 + P_2}{2}\right) \times 1\text{ h} \quad (\text{MWh})$$
- The average power delivered over the full hour is:
  $$\bar{P}_{\text{actual}} = \frac{P_1 + P_2}{2} \quad (\text{MW})$$
- Because `WINDFOR` generation $\hat{P}$ is the expected average power over that 1-hour window, comparing $\hat{P}$ against $\bar{P}_{\text{actual}} = \frac{P_1 + P_2}{2}$ is the **physically and mathematically exact comparison of average power (MW)**.

#### 10.3.3 Coverage Denominators for January 2026
- **Monthly Evaluation Denominator**:
  $$N_{\text{expected}} = 31 \text{ days} \times 24 \text{ hours/day} = \mathbf{744} \text{ hourly evaluation intervals}$$
- **Single-Day Evaluation Denominator**:
  $$N_{\text{expected, daily}} = 1 \text{ day} \times 24 \text{ hours/day} = \mathbf{24} \text{ hourly evaluation intervals}$$
- **Coverage Metric Formula**:
  $$\text{Coverage (\%)} = \frac{N_{\text{valid pairs}}}{N_{\text{expected}}} \times 100\%$$

#### 10.3.4 Missing and Duplicate Data Rules
- **Missing Actuals**: If either $P_1$ or $P_2$ is missing/null in `FUELHH`, the hourly actual cannot be verified. That hour is marked as `missing_actual`, excluded from MAE/RMSE/ME calculations, and counted against coverage.
- **Missing Forecasts**: If no eligible forecast published on or before the cutoff exists for hour $H$, that hour is marked as `missing_forecast`, excluded from error metrics, and counted against coverage.
- **Duplicate Records**:
  - `FUELHH`: Unique composite key is `(settlementDate, settlementPeriod)`.
  - `WINDFOR`: Unique composite key within a publication run is `(publishTime, startTime)`.
  - **[EMPIRICAL] Verification**: Tested January 2026 data. Found **0 duplicates** in `FUELHH` (1,488 unique keys) and **0 duplicates** in `WINDFOR` (18,104 unique keys).
  - Ingestion logic must nevertheless apply idempotent deduplication (`dict` or `drop_duplicates`).

---

### 10.4 Issue 4: Retrieval Completeness, Query Limits, and Reproducible Backtest

#### 10.4.1 Endpoint Query Limits
- **[EMPIRICAL] Stream Endpoints**: `GET /datasets/WINDFOR/stream` and `GET /datasets/FUELHH/stream` support multi-week queries in a single HTTP request without client-side pagination.
- **Reproducible Query Examples & Response Times**:

```bash
# 1. Fetch FUELHH for all of January 2026 (1,488 records, ~1.4s)
curl -s "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDateFrom=2026-01-01&settlementDateTo=2026-01-31&fuelType=WIND"

# 2. Fetch WINDFOR for Dec 30, 2025 through Jan 31, 2026 (19,272 records, ~2.5s)
curl -s "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream?publishDateTimeFrom=2025-12-30T00:00:00Z&publishDateTimeTo=2026-01-31T23:59:59Z"
```

#### 10.4.2 Empirical January 2026 Day-Ahead Simulation Results
> [!NOTE]
> The figures below represent **empirical findings** from running the pipeline against January 2026 Elexon data with the provisional assumption of a 12:00 UTC day-ahead cutoff on day $D - 1$. They demonstrate feasibility and data availability, but are not universal guarantees for arbitrary cutoff times or future months.
>
> Error convention is strictly defined as $\text{Error} = \text{Forecast} - \text{Actual}$. A positive Mean Error ($\text{ME} > 0$) indicates net over-forecasting, while negative ($\text{ME} < 0$) indicates under-forecasting.

Executing the complete pipeline across all 31 days of January 2026 with a provisional day-ahead cutoff of **12:00 UTC on day $D - 1$** yielded:

- **Expected Evaluation Intervals**: 744 hours
- **Valid Forecast-Actual Pairs**: 744 hours
- **Missing Observations**: 0
- **Data Coverage**: **100.00%**
- **Mean Absolute Error (MAE)**: **2,017.92 MW**
- **Root Mean Squared Error (RMSE)**: **2,477.04 MW**
- **Mean Error (ME)**: **+1,806.23 MW** *(Empirical finding: net over-forecast on day-ahead horizon across January 2026)*

Sample daily metrics:
- **2026-01-01**: 24/24 pairs, MAE = 4,233.6 MW, RMSE = 4,283.0 MW, ME = +4,233.6 MW (100% coverage)
- **2026-01-15**: 24/24 pairs, MAE = 1,173.0 MW, RMSE = 1,281.3 MW, ME = +1,073.4 MW (100% coverage)
- **2026-01-31**: 24/24 pairs, MAE = 2,247.7 MW, RMSE = 2,368.2 MW, ME = +2,247.7 MW (100% coverage)

#### 10.4.3 Original Report Claims Clarified
1. **Network Latency**: The original report estimated 15–20s for querying 18k records. Live timing confirms it completes in **~2.5 seconds**.
2. **Chunking**: Chunking is **not required** by API limits for a single month; however, fetching the 33-day block once and caching locally (SQLite / JSON) guarantees sub-second responsiveness for UI users.
3. **Publication Times**: The original report listed winter publication times (`02:30Z, 11:30Z`) without explaining why they differed by 1 hour from the Data Catalogue (`03:30, 12:30`). The seasonal clock change reconciliation in Section 10.2 now resolves this completely.

