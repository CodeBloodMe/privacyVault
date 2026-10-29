# PrivacyVault — Project Progress & Task Tracking

**Last Updated:** 2026-10-24 01:32:00 IST  
**Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)  
**Course:** BCSE302P Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (SCOPE, VIT)  

---

## 1. Master Directive Execution Status: Phase 1 & Phase 2 Verified

### Phase 1: Requirements Finalization, Threat Model & Database Foundation (VERIFIED)
- [x] **Requirements & Threat Modeling Finalization:**
  - Audited and updated [`docs/REQUIREMENTS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/REQUIREMENTS.md) and [`docs/THREAT_MODEL.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/THREAT_MODEL.md).
  - Explicitly modeled threats: Differential Privacy Reconstruction Attacks ($T_1$), Concurrency Race-Condition Budget Overspending ($T_2$), SQL Injection into Aggregate Pipelines ($T_3$), Ledger Tampering & Audit Repudiation ($T_4$), Microdata Exfiltration via Direct Runtime Access ($T_5$), and Token Privilege Escalation ($T_6$).
- [x] **Relational Architecture & Documentation:**
  - Complete 13-table 3NF normalized schema documented in [`docs/ER_DIAGRAM.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/ER_DIAGRAM.md) and [`docs/DATA_DICTIONARY.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/DATA_DICTIONARY.md).
  - Formal mathematical relational notation and Third Normal Form functional dependency proofs ($X \to Y$) documented.
- [x] **PostgreSQL 17 Roles & Least-Privilege Grants:**
  - `privacyvault_admin`: Full DDL/DML, extension management, migration execution.
  - `privacyvault_app`: Restricted runtime application user. Disallowed direct table access to `protected_patients`; access restricted to stored procedures, views, and execution definers.
  - `privacyvault_readonly`: Read-only access for compliance and audit reporting.
- [x] **Row-Level Security (RLS) Policies:**
  - Implemented in [`database/init/04_row_level_security.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/04_row_level_security.sql) and migration `V004`.
  - `ALTER TABLE protected_patients ENABLE ROW LEVEL SECURITY;` + `FORCE ROW LEVEL SECURITY;`
  - Restricts direct `SELECT` on `protected_patients` strictly to admin/maintenance contexts.
  - Policy `pol_query_requests_analyst_isolation` on `query_requests` ensures analysts can only read their own query requests.
- [x] **Stored Procedures & Triggers:**
  - `fn_reserve_privacy_budget`: Row-level pessimistic locking (`SELECT ... FOR UPDATE`) with atomic debit and ledger insertion.
  - `fn_refund_privacy_budget`: Failure compensating refund transaction logging `REFUND` type to ledger.
  - `fn_execute_bounded_aggregation`: `SECURITY DEFINER` function allowing the runtime app role to execute clamped, aggregate counts and sums without direct table access.
  - `tr_enforce_append_only_ledger`: Trigger blocking all `UPDATE` and `DELETE` operations on `privacy_budget_ledger`.
- [x] **Versioned Migrations Engine:**
  - Migration scripts created in [`database/migrations/`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/migrations/):
    - `V001__init_roles_and_extensions.sql`
    - `V002__normalized_schema_ddl.sql`
    - `V003__stored_procedures_and_triggers.sql`
    - `V004__row_level_security_policies.sql`
  - Python runner [`database/scripts/migrate.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/scripts/migrate.py) tracking `schema_migrations` with SHA-256 checksums, execution duration, and author signatures.
- [x] **Synthetic Microdata & Seed Data:**
  - [`database/seed/seed_data.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/seed/seed_data.py) seeds 10,000 realistic clinical records (ICD-10 codes, treatment costs, demographics), 5 users with Bcrypt hashes, 4 system roles, default policies, and grants.
  - Enhanced with `--db` parameter support for targeted database seeding.

---

## 2. Verification on Isolated Development/Test Database (`privacyvault_test`)

An isolated test database was created from scratch to verify reproducible migration from an empty state:
1. **Migration from Scratch:**
   - Database `privacyvault_test` provisioned on PostgreSQL 17 (port 5434).
   - `python database/scripts/migrate.py --db privacyvault_test` executed:
     - `V001`: Applied successfully in 8.35ms.
     - `V002`: Applied successfully in 16.53ms (13 tables, constraints, foreign keys, indexes).
     - `V003`: Applied successfully in 16.65ms (Stored procedures, triggers, views).
     - `V004`: Applied successfully in 6.07ms (RLS policies).
   - Migration status confirmed: 4 applied, 0 pending, 100% clean schema migration.
2. **Synthetic Data Population:**
   - `python database/seed/seed_data.py --db privacyvault_test` executed:
     - 10,000 patient microdata records loaded.
     - 5 RBAC users created with Bcrypt hashes.
     - Seeded datasets, columns metadata, privacy policies, and active grants.
3. **Automated Integration Testing Results:**
   - Tested against `privacyvault_test`: **18 / 18 PASSED (100%)** in 7.11s.
   - Tested against `privacyvault`: **18 / 18 PASSED (100%)** in 6.98s.
   - Concurrency overspend prevention: 10 threads, 2 succeeded, 8 rejected, zero overspend.
   - Direct microdata access denial: `SQLSTATE 42501 (insufficient_privilege)` verified.
   - Append-only ledger immutability: `UPDATE` and `DELETE` blocked by trigger verified.

---

## 3. Step 3: Differential Privacy Engine & Backend Rigorous Audit (VERIFIED)

### Differential Privacy Correctness & Mathematical Formalisms:
- [x] **Privacy Unit & Adjacency Definition:**
  - Formally specified: Privacy unit is one individual patient record in `protected_patients`.
  - Neighboring datasets $D, D'$ differ by the addition or removal of at most one patient record (unbounded DP).
- [x] **Global Sensitivity $\Delta f$ Calculations:**
  - `COUNT`: $\Delta f = 1.0$ (adding or removing one record changes the count by exactly 1). Verified in [`test_dp_sensitivity_calculation_and_bounds`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py#L60).
  - `BOUNDED_SUM`: $\Delta f = \max(|L|, |U|)$ where $L = \text{clamp\_low}$ and $U = \text{clamp\_high}$. Verified for positive, negative, and mixed domain bounds.
  - `BOUNDED_AVG`: Implemented as a **Compositional DP Mean**: $\epsilon_{\text{sum}} = \epsilon/2$, $\epsilon_{\text{count}} = \epsilon/2$. Total budget spent: $\epsilon$ (pure DP). Plug-in ratio estimation clamped to $[L, U]$ eliminates the critical flaw where raw private cohort size $N$ was previously exposed through variable sensitivity. Verified in [`test_composite_bounded_average_execution`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py#L110).
- [x] **OpenDP 0.16.0 Measurement Verification:**
  - Pure $\epsilon$-DP verified via `opendp.measurements.make_laplace` with `AtomDomain(T=f64, nan=False)` and `AbsoluteDistance(f64)`.
  - Approximate $(\epsilon, \delta)$-DP verified via `opendp.measurements.make_gaussian` with strict parameter validation ($0 < \delta < 1.0$ and $\epsilon > 0$). Verified in [`test_gaussian_dp_query_submission`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py#L130).
- [x] **Stored Procedure Hardening & Invariants:**
  - `fn_reserve_privacy_budget`: Rejects negative or zero epsilon requests (`p_requested_epsilon <= 0`). Rejects duplicate reservations for identical `request_id`.
  - `fn_refund_privacy_budget`: Strictly blocks refunds if the query request has already been `RELEASED` (prevents free releases). Strictly blocks duplicate refunds for the same query. Enforces that a matching `RESERVATION` must exist. Verified in [`test_post_release_refund_prevention_in_stored_procedure`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py#L190).
- [x] **Client Idempotency & Network Retry Safety:**
  - Supported optional `request_id` in `AggregateQueryRequest`.
  - If a client retries a query with the same `request_id` after a successful release, the gateway idempotently returns the existing release without re-executing or double-charging privacy budget. Verified in [`test_duplicate_and_retried_request_idempotency`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py#L150).
- [x] **Query-History Risk Engine Characterization:**
  - Evaluated detection of repeated queries (noise averaging attack -> `HIGH` risk).
  - Evaluated differencing attacks ($Q_1 \setminus Q_2$ on narrow attributes -> `CRITICAL` risk, blocked).
  - Evaluated narrow predicate shifts -> `HIGH` risk.
  - Documented engine limitations: heuristic defense-in-depth advisory, not a substitute for formal mathematical DP budget accounting.

---

## 4. Current Test & Verification Summary
- **Total Automated Integration Tests:** **27 / 27 PASSED (100%)**
  - Primary DB (`privacyvault`): 27 passed in 17.15s.
  - Isolated Test DB (`privacyvault_test`): 27 passed in 22.69s.
  - Test suites:
    1. [`backend/tests/test_api_endpoints.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_api_endpoints.py): 12 API & DP tests.
    2. [`backend/tests/test_concurrency_and_security.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_concurrency_and_security.py): 6 Concurrency & SQL isolation tests.
    3. [`backend/tests/test_differential_privacy_and_lifecycle.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/tests/test_differential_privacy_and_lifecycle.py): 9 DP sensitivity, parameter validation, composite mean, retry idempotency, and stored procedure immutability tests.
- **Database Engine:** PostgreSQL 17 on Docker port 5434 (Healthy).
- **Academic Report Gate (Section 22):** Strictly observed. No final academic report generated early. All evidence, logs, and database structures are preserved.

---

## 5. Step 4: Frontend Audit, Enterprise Design Integration & Live Verification (VERIFIED)

### Design System & User Interface Overhaul:
- [x] **Restrained Enterprise Light-First Aesthetic:**
  - Overhauled [`frontend/src/index.css`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/index.css) to eliminate generic AI dashboard clichés (excessive glassmorphism, neon glowing cyan cards, oversized rounded containers).
  - Adopted warm neutral background (`#f8fafc`), clean surface panels (`#ffffff`), dark readable typography (`#0f172a`), deep enterprise navy primary accent (`#1e40af`), and restrained semantic status badges.
  - Implemented dense, accessible data tables (`.data-table`), standardized form inputs, and solid progress gauges.
- [x] **Component Hierarchy & Clean Navigation:**
  - Modernized [`frontend/src/components/Navbar.tsx`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/components/Navbar.tsx) with system health connectivity indicators (`DB Online`), author credentials (`KRISH 24BCE0846` & `PARV 24BCE0870`), and role-scoped tabs.
  - Refactored [`frontend/src/App.tsx`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/App.tsx) landing screen with crisp enterprise hero, eliminating dark neon gradients.

### API Integration, Privacy Correctness & Idempotency:
- [x] **Idempotency & Network Retry Safety:**
  - Added optional `request_id: string` (UUID v4) to `AggregateQueryRequest` in [`frontend/src/types/api.ts`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/types/api.ts#L77).
  - Generated unique `crypto.randomUUID()` in [`AnalystDashboard.tsx`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/components/AnalystDashboard.tsx#L125) and [`DemoScenariosModal.tsx`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/components/DemoScenariosModal.tsx#L35) prior to submission.
  - Verified that repeated requests return the existing release without re-executing or double-charging privacy budget.
- [x] **Double-Submission Prevention:**
  - Guarded submission handlers with `if (!selectedGrant || isSubmitting) return;` preventing race conditions.
  - Execution buttons transition to "Perturbing with OpenDP..." and enter disabled states during flight.
- [x] **Compositional Bounded Average (`BOUNDED_AVG`) Handling:**
  - Added clear contextual explanation in UI: "Uses OpenDP 0.16.0 compositional DP ($\epsilon/2$ Bounded Sum + $\epsilon/2$ Count). Both components receive independent Laplace noise; raw counts are never disclosed."
  - Verified live execution against numerical columns (`age`, `treatment_cost`, `length_of_stay_days`).
- [x] **Data Hygiene & Privacy Guarantees:**
  - Verified zero raw microdata records exposed in client responses or DOM.
  - System refuses direct identifier aggregations (`mrn`, `patient_id`) and shows safe, actionable error messages.

### Role-Based Access Control & Isolation:
- [x] **Front-End & Server-Side Dual Enforcement:**
  - **Analyst:** Restricted strictly to Analytics Gateway and Dataset Catalog. Blocked from Data Governance and Audit consoles.
  - **Data Owner:** Access to Data Custodian Portal (grant issuance, budget allocation, dynamic revocation) and Audit logs. Blocked from Analyst endpoints by backend RBAC (HTTP 403 Forbidden verified).
  - **Auditor:** Dedicated access to Immutable Financial Ledger (protected by trigger `tr_enforce_append_only_ledger`) and Security Audit Event Log (`v_audit_summary_log`).
  - **Unauthorized UI State:** Implemented explicit HTTP 403 Forbidden restriction screen in `AnalystDashboard` when a non-analyst navigates to analyst views.

### Live Automated Browser & Visual Verification (Chrome DevTools MCP):
- [x] **Visual Inspection at Multiple Viewports:**
  - Desktop (1280x800) and tablet (768x1024) inspected. Screenshots saved in `docs/screenshots/`:
    - `landing_desktop.png` (Landing hero & system architecture badges)
    - `login_modal.png` (1-click role switcher dialog)
    - `analyst_dashboard_desktop.png` (Active grant, budget meter, query builder)
    - `analyst_query_released.png` (Live OpenDP Laplace release for COUNT)
    - `dataset_catalog_desktop.png` (Column data dictionary, sensitivity tags, bounds)
    - `data_owner_portal_desktop.png` (Grant issuance & dynamic revocation)
    - `audit_console_desktop.png` (Append-only budget ledger & verifiable event log)
    - `tablet_analytics_gateway.png` & `tablet_audit_console.png` (Responsive layout)
    - `scenario_c_differencing_verified.png` (Live differencing attack interception)
- [x] **Live Scenario Execution in Browser:**
  - Scenario A: Verified live OpenDP Laplace perturbation on COUNT.
  - Scenario C: Verified Query-History Risk Engine intercepts differencing reconstruction attack with `CRITICAL` risk and halts query before data access.
- [x] **Browser Console Health:**
  - Zero uncaught JavaScript errors or broken module imports.

### Build & Verification Commands Executed:
- [x] **Linter (`npm run lint`):** 0 errors, 0 unused variables.
- [x] **Production Build (`npm run build`):** Built in 1.61s with zero errors (`dist/index.html` 0.47 kB, `dist/assets/index-B69vRW16.js` 291.96 kB).
- [x] **Full Backend Regression Suite (`pytest backend/tests -v`):** **27 / 27 PASSED (100%)** in 23.92s.

---

## 6. Step 5: Full-System Adversarial Security Audit & E2E Verification (COMPLETED & VERIFIED)

### Established Baseline State:
- Verified clean Git working tree on branch `dev`.
- Database: PostgreSQL 17 on Port 5434 (`privacyvault` and `privacyvault_test`).
- Backend: FastAPI 0.115 on Port 8000; OpenDP 0.16.0; Bcrypt hashing; HS256 JWT.
- Frontend: React 19 + TypeScript on Vite; production build in `frontend/dist`.

### Adversarial Security & Database Audit (Section 2, 3, 5):
- [x] **Authentication & Session Hardening:**
  - Unauthenticated requests to protected endpoints return HTTP 401 Unauthorized (`test_unauthenticated_requests_strictly_denied`).
  - Malformed and tampered JWT tokens rejected with HTTP 401/403 (`test_malformed_and_tampered_tokens_rejected`).
- [x] **Role-Based Access Control (RBAC) & Vertical Privilege Enforcement:**
  - Analysts cannot issue grants (`test_analyst_cannot_issue_grants`), revoke grants (`test_analyst_cannot_revoke_grants`), view global budget summaries (`test_analyst_cannot_view_all_budget_summaries`), or view compliance audit logs (`test_analyst_cannot_view_audit_events`).
  - Auditors cannot submit differential privacy queries (`test_auditor_cannot_submit_queries`).
- [x] **Horizontal Privilege Escalation (IDOR) Remediations (SEC-01, SEC-02):**
  - **SEC-01 Fixed:** Added dataset ownership check to `POST /api/v1/datasets/grants/{grant_id}/revoke`. A Data Owner cannot revoke grants on datasets owned by another Data Owner (`test_idor_grant_revocation_denied` PASSED).
  - **SEC-02 Fixed:** Added dataset ownership check to `DatasetService.issue_grant`. A Data Owner cannot issue grants on datasets owned by another Data Owner (`test_idor_grant_issuance_denied` PASSED).
  - **Budget Ledger IDOR Fixed:** Added dataset ownership check to `GET /api/v1/budgets/{budget_id}/ledger` (`test_idor_budget_ledger_access_denied` PASSED).
  - **Query Record Access Fixed:** Cross-analyst query inspection blocked with HTTP 403 (`test_cross_analyst_query_record_access_denied` PASSED).
- [x] **Direct Identifier Cohort Filtering Leakage Remediation (SEC-03):**
  - Disallowed direct identifiers (`mrn`, `patient_id`) from filter predicates in `query_service.py::validate_query` (`test_direct_identifier_filter_blocked_at_api` PASSED).
  - Added security check inside PostgreSQL stored procedure `fn_execute_bounded_aggregation` via migration `V005__disallow_identifier_filters.sql` (`test_db_stored_procedure_rejects_identifier_filter` PASSED).
- [x] **SQL Injection & Ledger Immutability Verification:**
  - Injected SQL payloads in filter columns or values are strictly rejected by schema checks or treated as literal strings (`test_sql_injection_payloads_in_filters_safely_rejected_or_parameterized` PASSED).
  - PostgreSQL trigger `tr_enforce_append_only_ledger` blocks any UPDATE or DELETE on `privacy_budget_ledger` (`test_append_only_ledger_trigger_blocks_update_and_delete` PASSED).
- [x] **Row-Level Security (RLS) Verification:**
  - Verified `pol_protected_patients_runtime_deny` forces `USING (false)` for `privacyvault_app`, preventing raw row inspection.

### Differential Privacy & Budget Accounting Audit (Section 4):
- [x] **Adjacency & Mathematical Sensitivities:**
  - Formally verified bounded substitution adjacency ($d(D, D') \le 1$, protected unit: 1 patient record).
  - COUNT sensitivity $\Delta_1 = 1$; BOUNDED_SUM sensitivity $\Delta_1 = \max(|L|, |U|)$; BOUNDED_AVG composite mean under sequential composition ($\epsilon/2$ sum + $\epsilon/2$ count) with support projection.
- [x] **OpenDP Mechanism Calibration:**
  - Laplace calibrated to scale $b = \Delta_1 / \epsilon$.
  - Gaussian calibrated to $\sigma = \Delta_2 \sqrt{2\ln(1.25/\delta)} / \epsilon$ for $\epsilon \le 1.0, \delta \le 10^{-4}$.
- [x] **Post-Release Refund & Idempotency Key Hardening (SEC-04):**
  - Stored procedure `fn_refund_privacy_budget` blocks refunds after query status is `RELEASED`.
  - Duplicate refunds on failed queries rejected.
  - Idempotent `request_id` reuse returns existing release without double spending or re-noising.
  - Cross-analyst `request_id` collision returns HTTP 403 Forbidden; in-flight collision returns HTTP 409 Conflict.
- [x] **Risk Engine Characterization (SEC-05):**
  - Formally characterized as an *advisory heuristic defense-in-depth layer*, not a replacement for mathematical differential privacy. Documented in `docs/DP_GUARANTEE_REVIEW.md`.

### Full Test Suite Execution Results (Section 7):
- **Full Pytest Suite:** **44 / 44 PASSED (100%)** in 20.03 seconds.
  - `backend/tests/test_api_endpoints.py`: 12 passed.
  - `backend/tests/test_concurrency_and_security.py`: 6 passed.
  - `backend/tests/test_differential_privacy_and_lifecycle.py`: 9 passed.
  - `backend/tests/test_security_adversarial_and_e2e.py`: 17 passed.
- **Frontend Build (`npm run build`):** Built in 1.34s with zero TypeScript or Vite errors.
- **Database Migrations:** Applied migrations `V001` through `V005` to both `privacyvault` and `privacyvault_test`.

### Required Deliverables Created:
- [x] [`docs/SECURITY_AUDIT.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/SECURITY_AUDIT.md): Scope, methodology, findings SEC-01 through SEC-05, remediation, reproducible evidence, and residual risks.
- [x] [`docs/DP_GUARANTEE_REVIEW.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/DP_GUARANTEE_REVIEW.md): Mathematical derivations, adjacency definition, sensitivity bounds, OpenDP calibration, sequential composition, and heuristic characterization.
- [x] [`docs/E2E_TEST_REPORT.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/E2E_TEST_REPORT.md): Complete multi-role workflows, test environment, exact execution commands, results, and limitations.
- [x] [`docs/PROGRESS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/PROGRESS.md): Updated with Step 5 verified metrics.

### Academic Report Gate (Section 10):
- **STRICTLY ENFORCED:** Academic report, research paper, and final submission manuscripts remain locked and ungenerated until explicit user directive: *"Prepare the final project report."*

---

## 7. Step 5B: Security Verification, Differential Privacy Proof Audit & Release Gate (COMPLETED & VERIFIED)

### Phase 1: Baseline Independent Reproduction:
- **Baseline Test Suite:** Independently reproduced 44 passed tests across 4 modular suites on dedicated test database `privacyvault_test` (Exit code: 0, 44 passed, 11 warnings in 9.50s).
- **Frontend Production Build:** Built in 1.22s with zero TypeScript or Vite bundle errors.
- **Frontend Linter:** Executed `npm run lint` (0 errors, 6 warnings).
- **Commit Baseline:** Confirmed commit `000a84d` on branch `dev`. Clean working tree.

### Phase 2: Differential Privacy Mathematical Proof Audit:
- [x] **Adjacency Model & Protected Unit:**
  - Formally clarified and proved that the implementation operates under **Add/Remove (Unbounded) Adjacency** ($|D \triangle D'| \le 1$).
  - Corrected previous report text conflating substitution adjacency with add/remove. Proved that under substitution adjacency, sensitivity is $(U - L)$, whereas under add/remove with a non-contributing baseline of 0, sensitivity is $\max(|L|, |U|)$.
  - Proved that row-level DP rigorously guarantees individual patient-level DP because and *only because* table `protected_patients` strictly enforces `PRIMARY KEY (patient_id)` and `UNIQUE (mrn)`. Documented the multi-visit encounter limitation.
- [x] **COUNT & BOUNDED_SUM Sensitivity:**
  - COUNT: $\Delta_1 = 1.0, \Delta_2 = 1.0$ under add/remove.
  - BOUNDED_SUM: $\Delta_1 = \max(|L|, |U|)$ under add/remove. Evaluated negative bounds, extreme out-of-bound values, and empty cohorts ($N=0 \implies 0.0$).
- [x] **Composite Bounded Average Mechanism:**
  - Evaluated sequential composition ($\epsilon/2$ sum + $\epsilon/2$ count), independent Laplace noise, denominator bounding $\max(1.0, \tilde{N})$, and post-processing projection onto $[L, U]$.
  - Proved that intermediate true counts, true sums, and noisy counts are never exposed in releases, preventing cohort size disclosure.
- [x] **OpenDP 0.16.0 API & Gaussian Calibration:**
  - Audited OpenDP internal representation: `make_gaussian` produces `ZeroConcentratedDivergence` ($\rho$-zCDP where $\rho = \Delta_2^2 / (2\sigma^2)$).
  - Proved that the classical standard deviation formula $\sigma = \Delta_2 \sqrt{2\ln(1.25/\delta)} / \epsilon$ is provably conservative under OpenDP's `make_zCDP_to_approxDP` conversion curve ($\epsilon_{actual} \approx 0.822 \le 1.0$ for target $(1.0, 10^{-5})$).
- [x] **Privacy Accounting & Release Lifecycle:**
  - Verified all 10 release lifecycle scenarios (concurrency, idempotency replay, cross-analyst isolation, in-flight conflict, failure refunds, post-release refund blocks, and retry noise stability).

### Phase 3 & 4: PostgreSQL Security, Isolation & Authorization Audit:
- [x] **RLS & Role Boundaries:**
  - Application runtime role `privacyvault_app` lacks `BYPASSRLS`, lacks table ownership, has `REVOKE ALL ON protected_patients`, and RLS policy `pol_protected_patients_runtime_deny` forces `USING (false) WITH CHECK (false)`.
  - All security-definer procedures (`fn_reserve_privacy_budget`, `fn_refund_privacy_budget`, `fn_execute_bounded_aggregation`) enforce `SET search_path = public, pg_temp`.
- [x] **Dynamic SQL Escaping:**
  - Safe identifier escaping (`%I`) and literal binding (`%L`) verified immune to SQL injection.
- [x] **Clean Database Migration Reproducibility:**
  - Verified that an empty test database cleanly executes migrations `V001` through `V005` in under 120ms with zero errors.

### Phase 5: Live Frontend & E2E Browser Verification:
- [x] **Chrome DevTools MCP Automated Verification:**
  - Navigated to `http://127.0.0.1:5173/`.
  - Analyst login (Krish): Executed live `COUNT` query with $\epsilon = 0.5$. Received noisy result `10,000.04` via OpenDP Laplace mechanism. Observed real-time budget meter deduction from $5.0$ to $4.5$ $\epsilon$.
  - Data Owner login (Dr. Sivakumar): Inspected active grants table displaying Krish's 10.0% budget utilization.
  - Audit Console: Verified financial budget ledger and `v_audit_summary_log` capturing live events. Captured viewport screenshot.

### Phase 6: Remediation & Regression Testing (SEC-06):
- [x] **SEC-06 Remediated:** Hardened `query_service.py` to catch `sqlalchemy.exc.IntegrityError` on millisecond-level concurrent `request_id` collisions, rolling back and returning clean HTTP 409 Conflict instead of unhandled HTTP 500 errors.
- [x] **New Regression Test:** Added `test_concurrent_request_id_race_integrity_error_handled`.
- [x] **Updated Regression Suite:** **45 / 45 PASSED (100%)** in 12.16s.

### Phase 7: Release Gate Verdict:
- **STATUS: READY FOR STEP 6**
- **Justification:** All 45 backend regression tests pass across both development and dedicated test databases. Differential privacy mathematical bounds are rigorously derived and validated against OpenDP 0.16.0. PostgreSQL isolation, RLS, search_path security, and trigger immutability are verified. The frontend production build compiles cleanly and E2E browser interactions function seamlessly.
- **Academic Report Gate:** Strictly enforced. No final academic report or research paper has been generated. System awaits explicit directive: *"Prepare the final project report."*


