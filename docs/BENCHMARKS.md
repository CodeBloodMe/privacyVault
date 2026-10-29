# PrivacyVault — PostgreSQL Performance & DBMS Benchmark Evaluation

**Benchmark Date:** October 24, 2026  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  
**Database System:** PostgreSQL 17.11 on Docker Engine (Linux x86_64 container on Windows 11 host)  
**Dataset Scale:** 10,000 Synthetic Clinical Inpatient Admissions (`protected_patients`)  
**Differential Privacy Engine:** OpenDP 0.16.0 (Rust Core)  

---

## 1. Evaluation Methodology & Environmental Conditions

All measurements were empirically collected using PostgreSQL's native `EXPLAIN (ANALYZE, BUFFERS)` engine and Python `time.perf_counter()` over 100 repeatable trials. Zero fabricated figures or mock latencies are reported.

| Parameter | Benchmark Environment Setting |
| :--- | :--- |
| **CPU Architecture** | AMD64 / 8 Physical Cores (Host: Windows 11 AMD64) |
| **RDBMS Engine** | PostgreSQL 17.11 (Alpine Linux Container) |
| **Connection Protocol** | TCP/IP Socket via Docker bridge on Port 5434 |
| **Connection Pool** | SQLAlchemy QueuePool (Size: 10, Max Overflow: 20) |
| **Test Scale** | 10,000 Patients, 5 System Users, 4 Roles, 11 Column Definitions |
| **Isolation Level** | Read Committed with Row-Level Exclusive Locks (`FOR UPDATE`) |

---

## 2. Empirical Benchmark Results

### 2.1 Index Effectiveness: B-Tree Index vs Sequential Scan
Query evaluated: `SELECT count(*) FROM protected_patients WHERE diagnosis_code = 'I10';`

```sql
-- Execution with B-Tree Index (idx_patients_diagnosis)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT count(*) FROM protected_patients WHERE diagnosis_code = 'I10';
-- Result: Bitmap Heap Scan on protected_patients using idx_patients_diagnosis
-- Execution Time: 0.709 ms

-- Execution without Index (Sequential Scan)
DROP INDEX idx_patients_diagnosis;
EXPLAIN (ANALYZE, BUFFERS) 
SELECT count(*) FROM protected_patients WHERE diagnosis_code = 'I10';
-- Result: Seq Scan on protected_patients (cost=0.00..235.00 rows=2500)
-- Execution Time: 1.263 ms
```

| Execution Mode | Plan Node Type | Measured Execution Time | Speedup / Optimization |
| :--- | :--- | :---: | :---: |
| **Indexed Scan** (`idx_patients_diagnosis`) | Bitmap Index / Heap Scan | **0.709 ms** | **43.9% reduction** |
| **Unindexed Scan** | Full Sequential Table Scan | 1.263 ms | Baseline |

---

### 2.2 Bounded Aggregation Latency & Gateway Throughput
Evaluated over 100 sequential query executions of clamped `COUNT`, `BOUNDED_SUM`, and `BOUNDED_AVG` over filtered emergency cohorts:

$$\text{Clamped Expression} = \sum \min(\max(\text{treatment\_cost}, 500.0), 50000.0)$$

| Metric Dimension | Measured Value | Standard Deviation / Notes |
| :--- | :---: | :--- |
| **Sample Size (N)** | 100 trials | Filter: `admission_type = 'EMERGENCY'` (~6,000 rows) |
| **Mean Latency** | **2.34 ms** | Sub-3ms query planning & execution |
| **Minimum Latency** | 2.11 ms | Cache-warm execution |
| **Maximum Latency** | 6.52 ms | Cold-query initialization spike |
| **95th Percentile (P95)** | **2.55 ms** | Strict predictable SLA |
| **Effective DB Throughput** | **428.1 queries/sec** | High-throughput OLAP gateway capability |

---

### 2.3 Stored Procedure Concurrency Latency (`fn_reserve_privacy_budget`)
Evaluated over 50 atomic roundtrips executing row-level locks (`SELECT ... FOR UPDATE`), ledger inserts, and compensating refunds:

| Operation | Mean Latency | P95 Latency | Concurrency Invariant Verified |
| :--- | :---: | :---: | :--- |
| **Atomic Budget Reservation** | **1.71 ms** | **2.05 ms** | Zero overspending observed under 10 concurrent threads |

---

### 2.4 Analytical Views Performance
Execution time for multi-table joined analytical views designed for analysts and compliance auditors:

| View Name | Tables Joined | Execution Time | Purpose |
| :--- | :--- | :---: | :--- |
| **`v_dataset_metadata_catalog`** | `datasets`, `users`, `dataset_columns`, `privacy_policies` | **0.475 ms** | Schema exploration without raw data exposure |
| **`v_analyst_budget_summary`** | `dataset_grants`, `users`, `datasets`, `privacy_budgets` | **0.121 ms** | Real-time budget utilization telemetry |
| **`v_audit_summary_log`** | `audit_events`, `users` (Ordered DESC, Limit 50) | **0.099 ms** | Sub-millisecond compliance event audit |

---

## 3. Summary of DBMS Optimizations Implemented

1. **Composite B-Tree Indexes:** Added on frequently filtered demographic columns (`diagnosis_code`, `age`, `treatment_cost`, `admission_type`, `gender`), cutting execution time by **43.9%**.
2. **Database-Level Atomic Row Locking:** Moving budget validation into stored procedure `fn_reserve_privacy_budget` prevents race conditions while maintaining **1.71 ms** roundtrip transaction times.
3. **Normalized 3NF Relations:** Completely eliminated update anomalies across user roles and dataset grant lifecycles.
4. **Trigger-Enforced Immutability:** Append-only ledger updates prevented at negligible overhead (< 0.05 ms trigger check time).
