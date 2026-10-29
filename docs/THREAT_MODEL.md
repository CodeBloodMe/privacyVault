# PrivacyVault — Threat Model & Security Architecture

**Document Version:** 1.0.0  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  
**Methodology:** STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)  

---

## 1. Protected Assets & Security Goals

| Asset Identifier | Asset Description | Security Objective | Primary Enforcement Layer |
| :--- | :--- | :--- | :--- |
| **AST-01: Microdata** | Raw sensitive records (e.g., patient identity, diagnoses, test results). | Confidentiality: Never exposed to analyst endpoints or direct SQL. | PostgreSQL RLS + Role Grants + Gateway mediator |
| **AST-02: Privacy Budget** | Remaining $\epsilon, \delta$ allowance for analysts and datasets. | Integrity: Exactly accounted, race-condition free, strictly non-negative. | PostgreSQL Stored Procedure + Row-Locks (`FOR UPDATE`) |
| **AST-03: Budget Ledger** | Immutable historical record of every privacy expenditure. | Integrity & Non-Repudiation: Append-only, resistant to deletion/updates. | PostgreSQL Database Trigger (`tr_enforce_append_only`) |
| **AST-04: Audit Events** | System access, query decisions, risk warnings, administrative actions. | Auditability: Comprehensive, tamper-evident security history. | Gateway Audit Service + Dedicated audit table |
| **AST-05: System Secrets** | Database credentials, JWT signing keys, admin passwords. | Confidentiality: Never committed to git, excluded via `.env`. | `.gitignore` + Environment variable injection |

---

## 2. Threat Actors & Capabilities

1. **Curious / Semi-Honest Analyst:**
   - Possesses valid credentials and authorized dataset grants.
   - Submits seemingly valid statistical queries with malicious intent to re-identify specific individuals using auxiliary knowledge (differencing attacks, overlapping filters).
2. **Malicious Insider / Compromised Account:**
   - Attempts SQL injection to bypass application gates, read arbitrary tables, or manipulate budget balances.
   - Attempts to issue simultaneous concurrent queries to exceed allocated privacy limits.
3. **Unauthorized External Entity:**
   - Attempts brute force on authentication endpoints, token forgery, or privilege escalation across tenant datasets.
4. **Privileged Database Operator (DBA):**
   - Out-of-scope for standard software controls: a root superuser can bypass RLS by design in PostgreSQL. However, the application uses a restricted runtime role (`privacyvault_app`) that cannot drop tables or alter security definers.

---

## 3. Threat Analysis & Defensive Mitigations (STRIDE)

### 3.1 Information Disclosure (Microdata Leakage)
- **Threat ID:** `TH-ID-01: Direct Raw Data Access`
  - *Attack:* Analyst attempts `GET /api/v1/datasets/{id}/raw` or crafts payload requesting individual records.
  - *Mitigation:* The gateway exposes **no** raw record retrieval endpoints. Raw tables are isolated in a restricted PostgreSQL schema where `privacyvault_app` has no direct `SELECT` on microdata tables except through vetted aggregation views and security-definer procedures.
- **Threat ID:** `TH-ID-02: Differencing Attack ($Q_1 \setminus Q_2$)`
  - *Attack:* Analyst submits $Q_1$: "Sum of salaries for Engineering department" (returns $N$ employees), followed by $Q_2$: "Sum of salaries for Engineering department excluding Bob" (returns $N-1$ employees). Differencing $Q_1 - Q_2$ reveals Bob's exact salary in traditional databases.
  - *Mitigation:*
    1. **Differential Privacy (OpenDP):** Calibrated Laplace noise added to both $Q_1$ and $Q_2$ bounds the mutual information leak to $e^\epsilon$.
    2. **Query-History-Aware Risk Engine:** Intercepts $Q_2$, detects predicate overlap with $Q_1$ with a Hamming distance of 1 record, flags as `HIGH_RISK_DIFFERENCING`, and halts or requires explicit Data Owner signoff.
- **Threat ID:** `TH-ID-03: Reconstruction via Repeated Queries (Noise Averaging)`
  - *Attack:* Under Laplace mechanism with mean 0, an attacker issues $M$ identical queries: $S_i = \text{TrueVal} + \text{Laplace}(0, b)$. By law of large numbers, $\frac{1}{M}\sum S_i \to \text{TrueVal}$.
  - *Mitigation:*
    1. **Strict Composition Accounting:** Each query deducts $\epsilon$ from the grant's budget.
    2. **Budget Exhaustion:** Once $\sum \epsilon_i = \epsilon_{total}$, all subsequent queries are blocked.
    3. **Query Deduplication / History Warning:** The history engine identifies identical repeated queries and flags noise-averaging exploitation.

### 3.2 Tampering & Race Conditions
- **Threat ID:** `TH-TMP-01: Concurrent Budget Overspending Race`
  - *Attack:* Attacker sends 10 concurrent HTTP requests with $\epsilon = 0.5$ when only $\epsilon = 0.8$ remains.
  - *Mitigation:* PostgreSQL Stored Procedure `fn_reserve_privacy_budget` executes with `SELECT ... FOR UPDATE` row locks. Only the first transaction succeeds; the remaining transactions receive `403 Insufficient Budget` upon lock acquisition.
- **Threat ID:** `TH-TMP-02: Ledger Balance Manipulation`
  - *Attack:* Rogue update query attempting `UPDATE privacy_budget_ledger SET amount = 0`.
  - *Mitigation:* PostgreSQL Trigger `tr_enforce_append_only_ledger` raises exception `LEDGER_IMMUTABILITY_VIOLATION` on any `UPDATE` or `DELETE` statement.

### 3.3 Elevation of Privilege & Injection
- **Threat ID:** `TH-EOP-01: SQL Injection via Dynamic Predicates`
  - *Attack:* Attacker injects `' OR 1=1; DROP TABLE users; --` into filter value.
  - *Mitigation:*
    1. Zero raw SQL assembly via string formatting.
    2. Pydantic v2 strictly validates filter column name against whitelist of known columns from `dataset_columns`.
    3. SQLAlchemy parameterized query compiler binds values safely as typed parameters.
- **Threat ID:** `TH-EOP-02: Cross-Tenant Dataset Access`
  - *Attack:* Analyst granted access to Dataset A attempts to query Dataset B.
  - *Mitigation:* Server-side authorization check verifies active, non-expired grant in `dataset_grants` before entering query pipeline.

---

## 4. Trust Boundaries & Verification Summary

```
[ UNTRUSTED ZONE: Browser / API Client ]
       |
=== TRUST BOUNDARY 1: HTTPS + JWT Auth + Strict Pydantic Schemas ===
       v
[ APPLICATION GATEWAY: FastAPI + OpenDP + Risk Engine ]
       |
=== TRUST BOUNDARY 2: PostgreSQL Restricted Role (privacyvault_app) ===
       v
[ DATABASE ENGINE: PostgreSQL 17 + RLS + Triggers + Stored Procedures ]
       |
=== ISOLATED VAULT SCHEMA: Protected Sensitive Microdata ===
```

Every threat scenario identified above is covered by an automated test in `backend/tests/test_security_threats.py`.
