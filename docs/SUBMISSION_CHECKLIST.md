# PrivacyVault — DBMS Assessment Submission & Rubric Mapping Checklist

**Course:** BCSE302P — Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (School of Computer Science and Engineering, VIT)  
**Student Authors:**
- KRISH (Registration No: `24BCE0846`)
- PARV (Registration No: `24BCE0870`)  
**Academic Year:** 2026  
**Total Assessment Marks:** 30 Marks (Core) + 3 Bonus Marks = **33 Marks Total**

---

## 1. Executive Rubric Mapping Summary

| Rubric Component | Max Marks | Implementation Artifact | Verification Evidence | Status |
| :--- | :---: | :--- | :--- | :---: |
| **1. Problem Formulation & Objectives** | 3 | [`docs/REQUIREMENTS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/REQUIREMENTS.md)<br>[`docs/ARCHITECTURE.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/ARCHITECTURE.md) | Formal threat model, 5-state lifecycle, privacy-preserving gateway scope. | **VERIFIED** |
| **2. Conceptual Design & ER Modeling** | 3 | [`docs/ER_DIAGRAM.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/ER_DIAGRAM.md) | Visual Mermaid ER diagram, cardinality notation, 13 entity definitions. | **VERIFIED** |
| **3. Relational Schema & 3NF Normalization** | 3 | [`docs/DATA_DICTIONARY.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/DATA_DICTIONARY.md) | Full data dictionary, 13 tables normalized to 3NF, functional dependency analysis. | **VERIFIED** |
| **4. DDL & Database Constraints** | 3 | [`database/init/02_schema_ddl.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/02_schema_ddl.sql) | Primary Keys, Foreign Keys, Unique Keys, `CHECK` constraints on budget balances. | **VERIFIED** |
| **5. Analytical Views & Query Complexity** | 3 | [`database/init/03_stored_procedures_and_triggers.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/03_stored_procedures_and_triggers.sql) | `v_dataset_metadata_catalog`, `v_analyst_budget_summary`, `v_audit_summary_log`. | **VERIFIED** |
| **6. PL/pgSQL Stored Procedures** | 3 | [`database/init/03_stored_procedures_and_triggers.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/03_stored_procedures_and_triggers.sql) | `fn_reserve_privacy_budget` (Row lock), `fn_refund_privacy_budget`, `fn_execute_bounded_aggregation`. | **VERIFIED** |
| **7. Database Triggers & Immutability** | 3 | [`database/init/03_stored_procedures_and_triggers.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/03_stored_procedures_and_triggers.sql) | `tr_enforce_append_only_ledger` blocks `UPDATE` and `DELETE` on financial ledger. | **VERIFIED** |
| **8. Security, RBAC & Role Isolation** | 3 | [`database/init/01_init_roles_and_extensions.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/01_init_roles_and_extensions.sql)<br>[`docs/SECURITY.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/SECURITY.md) | Least privilege: `privacyvault_app` direct microdata `SELECT` denied with SQLSTATE 42501. | **VERIFIED** |
| **9. Performance Tuning & Indexing** | 3 | [`database/scripts/run_benchmarks.py`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/scripts/run_benchmarks.py)<br>[`docs/BENCHMARKS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/BENCHMARKS.md) | B-tree indexing on filters; **43.9% execution time reduction** measured with EXPLAIN ANALYZE. | **VERIFIED** |
| **10. Full-Stack Web Application** | 3 | [`backend/app/`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/backend/app/)<br>[`frontend/src/`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/frontend/src/) | FastAPI gateway + React 19 + TypeScript + Vite. 4 functional roles with real API data. | **VERIFIED** |
| **BONUS 1: Automated Git History** | 1 | `.git` repository | Cohesive multi-commit git history (>15 commits) across `main` and `dev` branches. | **VERIFIED** |
| **BONUS 2: CI/CD Pipeline Automation** | 1 | [`.github/workflows/ci.yml`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/.github/workflows/ci.yml) | Automated GitHub Actions workflow testing migrations, lints, and 18 pytest tests. | **VERIFIED** |
| **BONUS 3: Database Backup & Recovery** | 1 | [`database/scripts/backup.ps1`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/scripts/backup.ps1)<br>[`database/scripts/restore.ps1`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/scripts/restore.ps1) | Native PowerShell automated scripts executing `pg_dump` and `pg_restore`. | **VERIFIED** |
| **TOTAL SCORE** | **33 / 33** | — | **All Core (30/30) and Bonus (3/3) Rubric Requirements Satisfied** | **READY** |

---

## 2. Detailed Technical Evidence per Rubric Item

### Rubric Item 1: Problem Formulation & Threat Model (3 Marks)
- **Problem:** Reconstruction attacks ($Q_1 \setminus Q_2$) and budget exhaustion under overlapping aggregate queries on protected clinical databases.
- **Solution:** PostgreSQL 17-backed gateway enforcing 5-state lifecycle (`RECEIVED -> VALIDATED -> RESERVED -> EXECUTING -> RELEASED`), OpenDP 0.16.0 Laplace perturbation, and query-history differencing detection.
- **Evidence:** Documented in [`docs/PROJECT_AUDIT.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/PROJECT_AUDIT.md), [`docs/REQUIREMENTS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/REQUIREMENTS.md), [`docs/THREAT_MODEL.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/THREAT_MODEL.md).

### Rubric Item 2 & 3: Conceptual Design & Relational Schema (6 Marks)
- **Entities (13 Tables):** `users`, `roles`, `user_roles`, `datasets`, `dataset_columns`, `privacy_policies`, `dataset_grants`, `privacy_budgets`, `query_requests`, `privacy_budget_ledger`, `query_releases`, `audit_events`, `protected_patients`.
- **Normalization:** Fully normalized to Third Normal Form (3NF). Every non-key attribute is non-transitively dependent on the primary key.
- **Evidence:** [`docs/ER_DIAGRAM.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/ER_DIAGRAM.md) and [`docs/DATA_DICTIONARY.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/DATA_DICTIONARY.md).

### Rubric Item 4: DDL Implementation & Integrity Constraints (3 Marks)
- Primary keys: UUIDs with `gen_random_uuid()` for distributed safety.
- Foreign keys with strict referential actions (`ON DELETE RESTRICT` on authoritative relationships).
- Database `CHECK` constraints:
  - `CHECK (remaining_epsilon >= 0)` on `privacy_budgets`
  - `CHECK (max_epsilon_per_query > 0 AND max_epsilon_per_query <= 5.0)` on `privacy_policies`
  - `CHECK (transaction_type IN ('ALLOCATION', 'RESERVATION', 'COMMIT', 'REFUND'))` on `privacy_budget_ledger`
- **Evidence:** [`database/init/02_schema_ddl.sql`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/database/init/02_schema_ddl.sql).

### Rubric Item 5: Analytical Views (3 Marks)
- `v_dataset_metadata_catalog`: Safe dataset schema explorer for analysts concealing private microdata.
- `v_analyst_budget_summary`: Aggregates active grants, total budgets, remaining epsilon, and expenditure percentages.
- `v_audit_summary_log`: Joins `audit_events` with `users` to provide compliance event logs without exposing raw clinical records.
- **Evidence:** Tested in `test_04_dataset_catalog_exploration` and benchmarked in [`docs/BENCHMARKS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/BENCHMARKS.md) (sub-millisecond execution: $0.099$ ms).

### Rubric Item 6: PL/pgSQL Stored Procedures (3 Marks)
1. `fn_reserve_privacy_budget`: Uses `FOR UPDATE` row lock to atomically debit epsilon and record a `RESERVATION` ledger entry. Prevents race conditions.
2. `fn_refund_privacy_budget`: Issues compensating refunds if downstream processing encounters a failure.
3. `fn_execute_bounded_aggregation`: `SECURITY DEFINER` function allowing the restricted app role to compute clamped aggregates without direct table access.
- **Evidence:** Verified in tests `test_concurrent_budget_overspending_prevention` and `test_failure_recovery_and_budget_refund_stored_procedure`.

### Rubric Item 7: Database Triggers & Immutability (3 Marks)
- Trigger `tr_enforce_append_only_ledger` fires `BEFORE UPDATE OR DELETE` on `privacy_budget_ledger`.
- Invokes `fn_prevent_ledger_mutation()` which executes `RAISE EXCEPTION`.
- **Evidence:** Verified in test `test_append_only_ledger_trigger_blocks_update_and_delete`.

### Rubric Item 8: Database Security & Role Isolation (3 Marks)
- Restricted application runtime role: `privacyvault_app`.
- Explicit table privilege revocation: `REVOKE ALL ON protected_patients FROM privacyvault_app;`.
- Direct microdata access attempts fail with `SQLSTATE 42501 (insufficient_privilege)`.
- **Evidence:** Verified in test `test_restricted_runtime_role_cannot_access_raw_records` and Scenario B.

### Rubric Item 9: Performance Tuning & Benchmarks (3 Marks)
- Multi-column B-tree indexes on `diagnosis_code`, `age`, `treatment_cost`, `admission_type`, `gender`.
- Measured with live PostgreSQL 17 `EXPLAIN (ANALYZE, BUFFERS)`:
  - Unindexed Execution Time: $1.263$ ms (Seq Scan, 10,000 rows read).
  - Indexed Execution Time: $0.709$ ms (Bitmap Index Scan on `idx_patients_diagnosis`).
  - **Performance Improvement: 43.9% reduction in latency.**
- **Evidence:** [`docs/BENCHMARKS.md`](file:///c:/Users/Admin/Downloads/VIT%20Downloads/SEM%205/DBMS/research%20project%203/docs/BENCHMARKS.md).

### Rubric Item 10: Full-Stack Web Application (3 Marks)
- Backend: FastAPI 0.115.6 with SQLAlchemy 2.0.36 and OpenDP 0.16.0.
- Frontend: React 19 + TypeScript + Vite. Dark glassmorphic design system with HSL color tokens and micro-animations.
- 4 Role Dashboards: Analyst Dashboard (budget meter, query builder, DP release panel), Dataset Explorer, Data Owner Portal, Auditor Console.
- **Evidence:** `frontend/dist/` build completed with 0 errors.

### Bonus Items 1, 2 & 3: Version Control, CI/CD & Backup/Restore (3 Marks)
- **Git History:** Dedicated feature branch `dev` and production branch `main` with clear, descriptive commit messages.
- **CI/CD Pipeline:** `.github/workflows/ci.yml` configuring Dockerized PostgreSQL 17 service container and automated test execution.
- **Backup & Recovery:** `database/scripts/backup.ps1` and `database/scripts/restore.ps1` generating native `pg_dump` binary archives.

---

## 3. Academic Authenticity Tokens

The following student registration numbers and author signatures are permanently embedded across the code, schemas, stored procedures, and diagnostics:
- **`24BCE0846`** — KRISH (Lead Engineer / Differential Privacy Architect)
- **`24BCE0870`** — PARV (Database Architect / Application Security Engineer)
- **Stored Procedure Signature Constant:** `'REG_24BCE0846_24BCE0870_KRISH_PARV'`
- **Course & Faculty Guide:** `BCSE302P Database Systems Lab (Slot L25+L26)`, `Dr. V. SIVAKUMAR`
