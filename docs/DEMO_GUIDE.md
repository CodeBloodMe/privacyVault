# PrivacyVault — Demonstration & Evaluation Guide

**Student Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)  
**Course:** BCSE302P Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (School of Computer Science and Engineering, VIT)  
**Academic Year:** 2026  

---

## 1. Quick Start Demonstration

PrivacyVault provides two official demonstration interfaces:
1. **Automated Live Demonstration CLI:** Executes all 8 core evaluation scenarios (A through H) with verified database outputs.
2. **Interactive Glassmorphic Web Application:** Full React + Vite dashboard supporting live visual testing across all four RBAC user roles.

---

## 2. Seed Accounts & Credentials

The database is pre-seeded with four primary operational roles. Passwords are encrypted with Bcrypt (work factor 12).

| Role | Name | Email Address | Password | Permissions & Views |
| :--- | :--- | :--- | :--- | :--- |
| **ANALYST** | Krish (Student 1) | `krish.24bce0846@vitstudent.ac.in` | `AnalystPass2026!` | Dataset Explorer, Query Builder, DP Releases, Budget Meter |
| **ANALYST** | Parv (Student 2) | `parv.24bce0870@vitstudent.ac.in` | `AnalystPass2026!` | Secondary analyst for concurrency and grant revocation testing |
| **DATA OWNER** | Dr. V. Sivakumar | `dr.sivakumar@vit.ac.in` | `OwnerPass2026!` | Data Owner Portal, Dataset Registration, Policy Tuning, Grant Issuance |
| **AUDITOR** | Compliance Auditor | `compliance.auditor@vit.ac.in` | `AuditorPass2026!` | Auditor Console, `v_audit_summary_log`, Query Event Inspection |
| **ADMIN** | System Administrator | `admin@privacyvault.local` | `AdminPass2026!` | User Account Management, System Health, Database Monitoring |

---

## 3. Method 1: Automated Live Demonstration CLI

Execute the complete end-to-end demonstration script from the project root:
```bash
python database/scripts/run_demo_scenarios.py
```
*(Or alternatively: `python scripts/run_demo_scenarios.py`)*

### Expected Script Execution Breakdown:

```
================================================================================
  PRIVACYVAULT: EXPLAINABLE PRIVACY-PRESERVING DATABASE ANALYTICS GATEWAY
  Live Demonstration of Database Architecture, Differential Privacy & RBAC
  Authors: KRISH (24BCE0846) & PARV (24BCE0870) | Faculty: Dr. V. SIVAKUMAR
================================================================================

SCENARIO A: ORDINARY AGGREGATE ACCESS (OpenDP Differential Privacy Release)
  [PASS] HTTP Status Code: 201
  [PASS] Perturbed Result Released: ~6040 (True count perturbed with Laplace noise)
  [PASS] Mechanism Applied: OPENDP_LAPLACE
  [PASS] Calculated Noise Scale (b): 2.0000
  [PASS] Sensitivity Bound (Delta f): 1.00
  [PASS] Privacy Budget Spent: 0.5 epsilon

SCENARIO B: DIRECT ACCESS DENIAL (Database Least Privilege & Access Control)
  [PASS] Database Exception: SQLSTATE 42501 (insufficient_privilege)
  [PASS] PostgreSQL Message: permission denied for table protected_patients
  [!] Architectural Defense: The gateway runtime role has direct SELECT explicitly revoked.

SCENARIO C: DIFFERENCING RISK DETECTION (Query-History Aware Defense)
  [PASS] Baseline Query Q1 Status: 201 Released
  [PASS] HTTP Status Code: 403 (Differencing Query Q2 Blocked)
  [PASS] Gateway Defense: Differencing Attack Blocked Before Execution
  [PASS] Risk Summary: DIFFERENCING DISCLOSURE DETECTED: Candidate query restricts Prior Query by narrow attribute 'age'.

SCENARIO D: PRIVACY BUDGET EXHAUSTION (Non-Overspend Enforcement)
  [PASS] Over-Budget Submission Status: 400 Denied
  [PASS] Gateway Denial Detail: Requested epsilon exceeds policy ceiling (1.0000)

SCENARIO E: CONCURRENCY RACE CONDITION TEST (PostgreSQL FOR UPDATE Row Lock)
  [PASS] Successful Reservations: 2 (Expected: exactly 2)
  [PASS] Rejected Reservations: 8 (Expected: exactly 8)
  [PASS] Final PostgreSQL Balance: 0.0000 (Zero Overspend)

SCENARIO F: AUTHORIZATION & GRANT REVOCATION (Instant Privilege Revocation)
  [PASS] Pre-Revocation Query Execution: HTTP 201 Released
  [PASS] Grant Revocation by Data Owner: HTTP 200 (is_active = FALSE)
  [PASS] Analyst Query Post-Revocation: HTTP 403 Forbidden (Access Denied)

SCENARIO G: FAILURE RECOVERY & ATOMIC REFUNDS (State Machine Self-Healing)
  [PASS] Budget Reservation Phase: Reserved 0.2000 epsilon
  [PASS] Compensating Refund Executed: Balance Restored to 1.0000
  [PASS] Ledger Audit Trail: Transaction Type: REFUND, Amount: 0.2000

SCENARIO H: AUDITOR VERIFICATION (Zero Raw Record Leakage)
  [PASS] Audit Log Retrieval: HTTP 200
  [PASS] Total Audit Events Logged: > 60 events verified
```

---

## 4. Method 2: Interactive Web Application Walkthrough

### Step 1: Start Backend API Gateway
In a terminal, start the FastAPI server:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8001 --reload
```
- API Documentation (OpenAPI / Swagger): `http://localhost:8001/docs`
- Health Check: `http://localhost:8001/api/v1/health`

### Step 2: Start Frontend Application
In a second terminal, start the Vite development server:
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.

### Step 3: Interactive Visual Demonstration

1. **Quick Role Switcher:**
   - Click the **"Switch Role"** button in the top navigation bar.
   - Use the 1-click test credential buttons to instantly switch between **Analyst (Krish)**, **Analyst (Parv)**, **Data Owner (Dr. Sivakumar)**, and **Auditor**.

2. **Analyst Dashboard & Query Builder:**
   - Log in as **Analyst (Krish)**.
   - Inspect the **Privacy Budget Gauge**: View real-time Remaining Epsilon, Total Allocation, and Spent Percentage.
   - Under **Query Builder**:
     - Select Metric: `COUNT`.
     - Add Filter: `admission_type = EMERGENCY`.
     - Set Epsilon: `0.5000`.
     - Click **"Validate Query (Dry Run)"**: Notice the real-time Risk Engine assessment (`LOW` Risk, Green Badge).
     - Click **"Submit Query"**: Watch the live release panel display the perturbed result, calculated noise scale, and cryptographic timestamp.
     - Observe the budget gauge update dynamically.

3. **Demonstrating Differencing Attack Detection:**
   - In Query Builder, submit a query for: `diagnosis_code = I10` AND `gender = FEMALE`.
   - Next, submit a query for: `diagnosis_code = I10` AND `gender = FEMALE` AND `age > 75`.
   - **Visual Result:** The Risk Engine flags the query with a red **CRITICAL DIFFERENCING RISK** banner, displaying the exact prior query ID, the isolating attribute (`age`), and recommended mitigation.

4. **Data Owner Portal:**
   - Switch to **Data Owner (Dr. Sivakumar)**.
   - View registered clinical datasets, column sensitivity flags, and active differential privacy policies.
   - Issue a new time-bounded grant or click **"Revoke"** to revoke an existing grant.

5. **Auditor Console:**
   - Switch to **Auditor**.
   - Inspect the real-time tabular event feed loaded directly from the database view `v_audit_summary_log`.
   - Filter by event outcome (`SUCCESS`, `DENIED`, `ERROR`) or event type (`QUERY_RELEASED`, `AUTH_LOGIN_SUCCESS`).
   - Verify that **zero private microdata attributes** are visible in the audit payload.

6. **Interactive Demo Scenarios Modal:**
   - In the navigation bar, click the **"Demo Scenarios"** button.
   - Review descriptions and expected database behaviors for Scenarios A through H.

---

## 5. Database Verification via psql / pgAdmin

You can directly inspect PostgreSQL 17 on port 5434:
```bash
docker exec -it privacyvault-postgres psql -U privacyvault_admin -d privacyvault
```

Useful analytical SQL queries to demonstrate:
```sql
-- 1. Inspect Safe Dataset Catalog View
SELECT * FROM v_dataset_metadata_catalog LIMIT 5;

-- 2. Inspect Real-Time Analyst Budget Balances
SELECT * FROM v_analyst_budget_summary;

-- 3. Verify Append-Only Immutability on Ledger
UPDATE privacy_budget_ledger SET amount = 0;
-- Aborted with: LEDGER_IMMUTABILITY_ERROR

-- 4. Verify Least-Privilege Denial as Runtime App Role
SET ROLE privacyvault_app;
SELECT * FROM protected_patients LIMIT 1;
-- Denied with: ERROR: permission denied for table protected_patients
RESET ROLE;
```

---

## 6. Troubleshooting & Reset

If you need to completely reset the database to a fresh initial state:
```bash
python database/seed/seed_data.py
```
This script cleanly truncates transactional data and re-seeds 10,000 synthetic patient records, default roles, system users, and active grants in approximately 3 seconds.
