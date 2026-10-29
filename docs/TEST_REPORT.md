# PrivacyVault — Verification & Automated Test Report

**Student Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)  
**Course:** BCSE302P Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (School of Computer Science and Engineering, VIT)  
**Academic Year:** 2026  
**Execution Timestamp:** 2026-10-24 01:03:54 IST  

---

## 1. Test Environment & System Configuration

| Parameter | Specification | Verification Method |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Pro (x86_64) | System environment |
| **Database Server** | PostgreSQL 17 (Docker Engine 27.x) | Live port `5434`, `SELECT version()` |
| **Python Runtime** | Python 3.12.4 | Active virtual environment |
| **Test Framework** | pytest 9.1.1 with AnyIO 4.12.1 | `python -m pytest --version` |
| **Differential Privacy Engine** | OpenDP 0.16.0 (`opendp.measurements`) | Exact version import |
| **Database Driver** | Psycopg2-binary 2.9.13 / SQLAlchemy 2.0.36 | DBAPI connection pool |
| **Web Gateway** | FastAPI 0.115.6 / Uvicorn 0.32.1 / Pydantic 2.10.4 | REST API endpoints |
| **Synthetic Records** | 10,000 synthetic patient records in `protected_patients` | Database row count query |

---

## 2. Test Execution Summary

```
============================= test session starts =============================
platform win32 -- Python 3.12.4, pytest-9.1.1, pluggy-1.6.0
collected 18 items

backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_01_health_check PASSED            [  5%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_02_auth_me_profile PASSED         [ 11%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_03_invalid_password_rejected PASSED [ 16%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_04_dataset_catalog_exploration PASSED [ 22%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_05_analyst_active_grants PASSED   [ 27%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_06_query_validation_success PASSED [ 33%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_07_aggregate_identifier_forbidden PASSED [ 38%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_08_execute_differential_privacy_count PASSED [ 44%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_09_execute_differential_privacy_bounded_sum PASSED [ 50%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_10_differencing_attack_detection_and_block PASSED [ 55%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_11_budget_exhaustion_denial PASSED [ 61%]
backend/tests/test_api_endpoints.py::TestPrivacyVaultGateway::test_12_audit_trail_inspection PASSED  [ 66%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_concurrent_budget_overspending_prevention PASSED [ 72%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_sql_injection_immunity PASSED [ 77%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_grant_revocation_enforcement PASSED [ 83%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_restricted_runtime_role_cannot_access_raw_records PASSED [ 88%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_append_only_ledger_trigger_blocks_update_and_delete PASSED [ 94%]
backend/tests/test_concurrency_and_security.py::TestConcurrencyAndSecurity::test_failure_recovery_and_budget_refund_stored_procedure PASSED [100%]

======================= 18 passed, 1 warning in 14.26s ========================
```

---

## 3. Comprehensive Test Case Matrix

| ID | Test Case | Target Component | Invariant / Expected Behavior | Verified Result | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **T01** | `test_01_health_check` | API & PostgreSQL | Returns HTTP 200, status `healthy`, engine `PostgreSQL 17`, author signature `24BCE0846`. | Verified live connectivity and signature | **PASSED** |
| **T02** | `test_02_auth_me_profile` | JWT Auth | Decodes bearer token, verifies user identity and role assignment. | Analyst email and role resolved | **PASSED** |
| **T03** | `test_03_invalid_password_rejected` | Security | Rejects invalid credentials with HTTP 401 Unauthorized. | Authentication failure enforced | **PASSED** |
| **T04** | `test_04_dataset_catalog_exploration` | Catalog Views | Verifies column inspection; ensures `mrn` is flagged as an identifier. | `is_identifier=True`, non-aggregatable | **PASSED** |
| **T05** | `test_05_analyst_active_grants` | Grant Service | Retrieves active grants and non-zero privacy budget balances. | Grant ID and balance retrieved | **PASSED** |
| **T06** | `test_06_query_validation_success` | Query Validation | Dry-run validation of a compliant query specification without spending budget. | Validated compliant without budget debit | **PASSED** |
| **T07** | `test_07_aggregate_identifier_forbidden` | Security | Rejects attempts to compute aggregate operations on identifier columns (`mrn`). | Returns HTTP 400 with critical risk flag | **PASSED** |
| **T08** | `test_08_execute_differential_privacy_count` | OpenDP Engine | Executes COUNT aggregate with OpenDP Laplace noise; debits 0.5 epsilon. | Released noisy count, budget decremented | **PASSED** |
| **T09** | `test_09_execute_differential_privacy_bounded_sum` | OpenDP Engine | Clamps individual treatment costs to $[100, 50000]$; releases noisy sum. | Correct sensitivity clamping and release | **PASSED** |
| **T10** | `test_10_differencing_attack_detection_and_block` | Risk Engine | Detects $Q_1 \setminus Q_2$ overlap restricting prior query by narrow attribute `age`. | HTTP 403 Forbidden with differencing alert | **PASSED** |
| **T11** | `test_11_budget_exhaustion_denial` | Budget Control | Rejects query submission when grant budget balance is depleted. | HTTP 403 Forbidden; zero overspend | **PASSED** |
| **T12** | `test_12_audit_trail_inspection` | Audit Service | Auditor retrieves immutable audit event log; verifies event recording. | Verified event stream with safe metadata | **PASSED** |
| **T13** | `test_concurrent_budget_overspending_prevention` | Database Stored Procedure | 10 concurrent threads attempt to reserve 0.5 epsilon against a 1.0 balance. | Exactly 2 succeed, 8 rejected, balance 0.0 | **PASSED** |
| **T14** | `test_sql_injection_immunity` | Database Security | Attempts tautologies and DDL drops in column names and filter values. | Injection strings treated as safe literals | **PASSED** |
| **T15** | `test_grant_revocation_enforcement` | Authorization | Revoked grant immediately blocks subsequent query submissions. | HTTP 403 Forbidden immediately on revoke | **PASSED** |
| **T16** | `test_restricted_runtime_role_cannot_access_raw_records` | Database Least Privilege | Restricted user `privacyvault_app` attempts `SELECT * FROM protected_patients`. | SQLSTATE 42501 (insufficient_privilege) | **PASSED** |
| **T17** | `test_append_only_ledger_trigger_blocks_update_and_delete` | Database Integrity Trigger | Attempts `UPDATE` or `DELETE` on `privacy_budget_ledger`. | Aborted by `tr_enforce_append_only_ledger` | **PASSED** |
| **T18** | `test_failure_recovery_and_budget_refund_stored_procedure` | Failure Recovery | Simulates execution failure; verifies compensating `REFUND` ledger entry. | Balance restored, `REFUND` transaction logged | **PASSED** |

---

## 4. In-Depth Concurrency Verification (T13)

- **Scenario:** Initial grant balance $= 1.0000$ epsilon.
- **Workload:** 10 simultaneous threads launched concurrently across a thread pool using independent PostgreSQL database connections.
- **Request:** Each thread calls `SELECT * FROM fn_reserve_privacy_budget(budget_id, 0.5000, req_id)`.
- **Observed Behavior:**
  - Thread 1: Reserved 0.5000 (Remaining: 0.5000) $\to$ **Success**
  - Thread 2: Reserved 0.5000 (Remaining: 0.0000) $\to$ **Success**
  - Threads 3 through 10: Denied (`Insufficient privacy budget remaining`) $\to$ **Rejected**
  - Final Database Balance: **`0.0000`**
  - Sum of `RESERVATION` Ledger Transactions: **`1.0000`**
- **Conclusion:** Zero budget overspending under high concurrency. PostgreSQL `FOR UPDATE` row lock guarantees strict serializability at the budget row level.

---

## 5. Security & Isolation Verification (T16 & T17)

1. **Table Isolation (`privacyvault_app`):**
   ```python
   # Execution output from T16:
   Database Isolation Verified: privacyvault_app direct SELECT denied on protected_patients.
   SQLSTATE: 42501
   Message: permission denied for table protected_patients
   ```
2. **Ledger Immutability Trigger:**
   ```python
   # Execution output from T17:
   Trigger Verified: UPDATE on privacy_budget_ledger blocked by tr_enforce_append_only_ledger.
   Trigger Verified: DELETE on privacy_budget_ledger blocked by tr_enforce_append_only_ledger.
   Message: LEDGER_IMMUTABILITY_ERROR: privacy_budget_ledger is an append-only audit table.
   ```

---

## 6. How to Reproduce Automated Tests

Execute the full automated test suite from the project root:
```bash
python -m pytest backend/tests/ -v -s
```

Execute the standalone live academic demonstration script (Scenarios A through H):
```bash
python database/scripts/run_demo_scenarios.py
```
