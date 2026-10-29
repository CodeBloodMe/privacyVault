# PrivacyVault — Application & Database Security Architecture

**Student Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)  
**Course:** BCSE302P Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (School of Computer Science and Engineering, VIT)  
**Academic Year:** 2026  

---

## 1. Executive Summary & Security Philosophy

PrivacyVault operates as a controlled analytics gateway situated between untrusted data analysts and an authoritative PostgreSQL 17 database storing sensitive clinical microdata (`protected_patients`). The system enforces defense-in-depth across six distinct security tiers:

```
[Untrusted Client / Analyst]
          │
          ▼ [Tier 1: JWT Authentication & Server-Side RBAC]
[FastAPI Gateway Validation]
          │
          ▼ [Tier 2: Query-History Risk Engine (Differencing & Repetition Filter)]
[Atomic Budget Reservation]
          │
          ▼ [Tier 3: PostgreSQL Stored Procedure with FOR UPDATE Row Lock]
[Security-Definer Bounded Aggregation]
          │
          ▼ [Tier 4: Least-Privilege Role Isolation & Microdata Table Revocation]
[Differential Privacy Perturbation]
          │
          ▼ [Tier 5: OpenDP 0.16.0 Mathematical Noise Engine]
[Immutable Audit Logging]
          │
          ▼ [Tier 6: Append-Only Trigger Enforced Ledger & Event Table]
[Released Noisy Result + Cryptographic Verification Tokens]
```

---

## 2. PostgreSQL Role Architecture & Least Privilege

The gateway enforces separation between migration/administrative ownership and application runtime execution.

| Database Role | Privileges | Target Objects | Security Rationale |
| :--- | :--- | :--- | :--- |
| `privacyvault_admin` | Table Owner, DDL, Security Definer Owner | All schema objects | Executes migrations, creates procedures, owns `protected_patients`. |
| `privacyvault_app` | `USAGE`, `SELECT`, `INSERT`, `UPDATE` on non-sensitive tables | Catalog, budgets, queries, audit tables | Standard gateway runtime connection role. |
| `privacyvault_app` (Microdata) | **`REVOKE ALL`** (Explicit Denial) | `protected_patients` table | **Zero direct access:** Direct queries fail with `SQLSTATE 42501`. |

### Proof of Least-Privilege Enforcement
Direct microdata table queries executed by the application runtime role are rejected at the database engine level:
```sql
-- Executed as privacyvault_app:
SELECT patient_id, mrn, diagnosis_code, treatment_cost FROM protected_patients LIMIT 5;
-- Result:
-- ERROR: permission denied for table protected_patients (SQLSTATE 42501)
```

Aggregations on `protected_patients` can **only** be executed via the stored procedure `fn_execute_bounded_aggregation()`, which runs with `SECURITY DEFINER` semantics owned by `privacyvault_admin`, applies bounding clamps, and returns **only a single scalar aggregate number**.

---

## 3. Security-Definer Hardening

PostgreSQL `SECURITY DEFINER` functions execute with the privileges of the function's creator rather than the caller. If not properly configured, an attacker could manipulate the `search_path` to execute malicious shadow tables or functions.

PrivacyVault hardens all security-definer procedures (`fn_reserve_privacy_budget`, `fn_refund_privacy_budget`, `fn_execute_bounded_aggregation`):
1. **Explicit Search Path:** `SET search_path = public, pg_temp` is set on every procedure, preventing `search_path` hijacking.
2. **Identifier Validation:** Column names are vetted against `dataset_columns` and formatted with `%I`.
3. **Literal Parameter Binding:** Filter values and thresholds are bound with `%L`.
4. **Identifier Column Protection:** Any column flagged as `is_identifier = TRUE` (e.g., `mrn`, `patient_id`) is strictly prohibited from aggregation.

```sql
CREATE OR REPLACE FUNCTION fn_execute_bounded_aggregation(...)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
```

---

## 4. SQL Injection Immunity

PrivacyVault eliminates SQL injection vulnerabilities through structural query parameterization and strict schema whitelisting:
1. **Pydantic Validation:** Inputs are parsed into typed models (`AggregateQueryRequest`, `FilterCriterion`). Column names, operators, and metrics are validated against strict Python Enums.
2. **Schema Whitelist Checks:** Column names are cross-referenced with `dataset_columns` in the database. Unknown or non-existent columns are rejected with `400 Bad Request` before SQL compilation.
3. **No Raw String Concatenation:** All dynamic SQL inside PostgreSQL PL/pgSQL procedures uses `format('%I', col)` for identifiers and `format('%L', val)` for literals.
4. **Verified Injection Tests:** Automated tests (`test_sql_injection_immunity`) prove that payloads such as `diagnosis_code'; DROP TABLE users; --` and `' OR '1'='1` are safely rejected or treated strictly as literal strings without unintended SQL execution.

---

## 5. Authentication & Credential Storage

1. **Password Hashing:** System credentials are encrypted using Bcrypt with work factor 12 (`rounds=12`) and unique cryptographic salts. Plaintext passwords are never stored, logged, or returned in API responses.
2. **JWT Tokens:** Session identity is governed by HMAC-SHA256 (HS256) signed JSON Web Tokens containing:
   - `sub`: User UUID
   - `roles`: Role list (`ADMIN`, `DATA_OWNER`, `ANALYST`, `AUDITOR`)
   - `iat`: Issue timestamp (UTC)
   - `exp`: Expiration timestamp (12 hours)
   - `iss`: Gateway issuer identifier
   - `author_reg`: Academic verification token (`24BCE0846_24BCE0870`)
3. **Server-Side Authorization:** Every protected API endpoint inspects the decoded token claims and verifies role membership server-side. Route guards in the frontend UI are usability features, not security perimeters.

---

## 6. Concurrency & Overspending Prevention

In differential privacy, spending budget beyond the configured limit constitutes an irreversible privacy violation. If two requests execute concurrently, an uncoordinated read-then-write sequence could allow both requests to reserve budget simultaneously, spending twice the remaining balance.

### PostgreSQL Row-Level Lock Solution:
In `fn_reserve_privacy_budget`, the budget row is locked exclusively:
```sql
SELECT remaining_epsilon 
INTO v_current_remaining
FROM privacy_budgets
WHERE id = p_budget_id
FOR UPDATE; -- Exclusive row lock blocks concurrent transactions
```
1. Any concurrent transaction attempting to read or modify the same budget row must wait until the first transaction commits.
2. If remaining epsilon is insufficient, the procedure aborts atomically and returns `success = FALSE`.
3. Verified via automated test `test_concurrent_budget_overspending_prevention`: 10 simultaneous threads attempting to spend 0.5 epsilon when 1.0 remains result in **exactly 2 successes, 8 rejections, 0.0000 final balance, and zero overspend**.

---

## 7. Append-Only Ledger Immutability

The privacy accounting ledger (`privacy_budget_ledger`) tracks all financial-grade transactions (`ALLOCATION`, `RESERVATION`, `COMMIT`, `REFUND`).

To guarantee ledger integrity against accidental or malicious administrative tampering, a PostgreSQL trigger is enforced:
```sql
CREATE OR REPLACE FUNCTION fn_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEDGER_IMMUTABILITY_ERROR: privacy_budget_ledger is an append-only audit table. Modifying or deleting records is strictly forbidden [Verified by: 24BCE0846 & 24BCE0870]';
    RETURN NULL;
END;
$$;

CREATE TRIGGER tr_enforce_append_only_ledger
BEFORE UPDATE OR DELETE ON privacy_budget_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_ledger_mutation();
```

Any `UPDATE` or `DELETE` statement executed against `privacy_budget_ledger` is aborted by the PostgreSQL execution engine.

---

## 8. Query-History Risk Analysis (Reconstruction Attack Defense)

Differential privacy mathematically bounds the influence of any single record in an aggregate release. However, adversaries may attempt differencing attacks ($Q_1 \setminus Q_2$) by constructing overlapping queries that isolate an individual through narrow attribute exclusion.

PrivacyVault implements a deterministic query-history evaluation layer (`QueryHistoryRiskEngine`):
1. **Overlap Inspection:** Maintains a rolling window of prior released queries under the same active grant.
2. **Differencing Detection:** Detects when candidate query $Q_c$ shares identical baseline filters with prior query $Q_p$, but adds an exclusionary predicate on a narrow attribute (e.g. `age > 75`, `readmitted = TRUE`).
3. **Proactive Denial:** Rejects the candidate query before budget is reserved or aggregate values are calculated.
4. **Repetition Tracking:** Flags high-frequency repeated queries designed to average out Laplace noise.

---

## 9. Comprehensive Audit Trail

All security-sensitive operations are recorded in the `audit_events` table:
- `AUTH_LOGIN_SUCCESS` / `AUTH_LOGIN_FAILED`
- `QUERY_VALIDATED` / `QUERY_REJECTED`
- `QUERY_RELEASED` / `QUERY_EXECUTION_FAILED`
- `GRANT_ISSUED` / `GRANT_REVOKED`
- `BUDGET_EXHAUSTION_DENIED`

Auditors review historical events via the read-only analytical view `v_audit_summary_log`. Audit logs disclose only safe operational metadata (request ID, epsilon spent, noise scale, metric, client IP, outcome) and **never expose raw clinical patient records or secret values**.
