# PrivacyVault — Functional & Non-Functional Requirements Specification

**Document Version:** 1.0.0  
**Project:** PrivacyVault — An Explainable, Privacy-Preserving Database Analytics Gateway  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  

---

## 1. System Overview & Problem Statement

Modern enterprise and healthcare environments possess high-value datasets containing sensitive personally identifiable information (PII) or protected health information (PHI). Analysts require population-level statistics (e.g., disease prevalence across demographic segments, average hospitalization costs, customer attrition rates) to make strategic decisions. However, granting direct SQL access or releasing naive aggregate queries exposes individuals to reconstruction attacks, linkage attacks, and differencing attacks (e.g., querying "Count patients with condition X" versus "Count patients with condition X excluding patient Alice").

**PrivacyVault** bridges this gap by acting as a hardened database analytics gateway backed by PostgreSQL. The gateway intercepts all analytic requests, enforces strict server-side authorization, binds analyst contributions, evaluates query overlap against past releases, applies calibrated mathematical noise via differential privacy (OpenDP), atomically debits privacy budgets, and logs complete audit trails—preventing any direct access to raw sensitive records.

---

## 2. User Roles & Access Hierarchy

The system enforces role-based access control (RBAC) across four distinct roles:

```
+---------------------------------------------------------------+
|                       SYSTEM ROLES                            |
+-------------------+--------------------+----------------------+
| Role              | Primary Scope      | Authorized Actions   |
+-------------------+--------------------+----------------------+
| ADMIN             | Global System      | Manage users, view   |
|                   | & Infrastructure   | system health/status |
+-------------------+--------------------+----------------------+
| DATA_OWNER        | Dataset & Policy   | Register datasets,   |
|                   | Governance         | set bounds/epsilon,  |
|                   |                    | grant/revoke access  |
+-------------------+--------------------+----------------------+
| ANALYST           | Privacy-Preserving | Submit aggregates,   |
|                   | Analytics          | view DP releases,    |
|                   |                    | inspect budget       |
+-------------------+--------------------+----------------------+
| AUDITOR           | Compliance &       | Inspect audit log,   |
|                   | Security Review    | query history,       |
|                   |                    | risk flags, budgets  |
+-------------------+--------------------+----------------------+
```

### Role Invariants:
1. All users are stored in a unified `users` table. User roles are assigned via a junction table `user_roles`.
2. Analysts cannot view raw records under any circumstances.
3. Analysts cannot specify arbitrary SQL; they submit typed query specifications.
4. Data Owners can only manage datasets they own or administer.
5. Auditors have read-only access to audit logs, query metadata, and budget ledgers, but zero access to raw records.

---

## 3. Functional Requirements (FR)

### FR-1: User Management & Authentication
- **FR-1.1:** Secure registration and login using JWT (JSON Web Tokens) with HS256 encryption.
- **FR-1.2:** Passwords hashed with `bcrypt` (work factor 12) with unique cryptographic salts.
- **FR-1.3:** Single `users` table architecture without fragmented tables for different user roles.
- **FR-1.4:** Session revocation and token invalidation on logout.

### FR-2: Dataset Governance & Schema Exploration
- **FR-2.1:** Data Owners can register datasets with protected backend tables.
- **FR-2.2:** Columns are cataloged in `dataset_columns` with semantic data types (`NUMERIC`, `CATEGORICAL`, `IDENTIFIER`) and sensitivity flags (`is_sensitive`, `is_identifier`).
- **FR-2.3:** Analysts can only inspect approved schema metadata for datasets they have active grants for.
- **FR-2.4:** Direct table reads (`SELECT * FROM protected_patients`) are blocked at both database layer (RLS / role privileges) and application gateway.

### FR-3: Access Grants & Time-Bounded Permissions
- **FR-3.1:** Data Owners can issue dataset access grants (`dataset_grants`) to analysts.
- **FR-3.2:** Grants include strict expiration timestamps (`expires_at`) and can be revoked on-demand (`is_active = FALSE`).
- **FR-3.3:** Expired or revoked grants immediately cause aggregate query submissions to be rejected.

### FR-4: Structured Aggregate Query Specification
- **FR-4.1:** The gateway strictly forbids arbitrary SQL strings from clients.
- **FR-4.2:** Queries are submitted via a strongly typed JSON specification:
  - `dataset_id`: UUID
  - `metric`: Approved aggregation (`COUNT`, `BOUNDED_SUM`, `BOUNDED_AVG`)
  - `target_column`: Target numerical or categorical column
  - `filters`: Array of approved categorical equality / range conditions
  - `requested_epsilon`: Requested privacy parameter $\epsilon$ (subject to policy bounds)
  - `requested_delta`: Requested privacy parameter $\delta$ (for Gaussian mechanism, default 0 for pure $\epsilon$-DP)
- **FR-4.3:** Server-side validation verifies that target columns and filter columns belong to the dataset and match permitted policies.

### FR-5: Differential Privacy Engine (OpenDP)
- **FR-5.1:** Execution of differential privacy mechanisms via official `opendp` 0.16.0.
- **FR-5.2:** Enforce contribution bounding at data processing layer: each individual record contributes at most $1$ to count, or is clamped to $[L, U]$ for bounded sums/means.
- **FR-5.3:** Calibrated noise addition:
  - Laplace Mechanism for pure $\epsilon$-differential privacy: Scale $b = \frac{\Delta f}{\epsilon}$.
  - Gaussian Mechanism for $(\epsilon, \delta)$-differential privacy where requested.
- **FR-5.4:** Releases must contain full metadata: mechanism name, sensitivity $\Delta f$, clamping bounds, requested $\epsilon$, actual noise scale, and timestamp.
- **FR-5.5:** Raw database aggregates and noise samples must never be revealed in the release payload or error messages.

### FR-6: Privacy Budget Management & Atomic Concurrency
- **FR-6.1:** Each active dataset grant has an associated privacy budget record (`privacy_budgets`) with total allowed $\epsilon$ (`total_epsilon`) and remaining balance (`remaining_epsilon`).
- **FR-6.2:** All budget transactions are immutably recorded in `privacy_budget_ledger`.
- **FR-6.3:** Atomic State Machine:
  $$\text{RECEIVED} \longrightarrow \text{VALIDATED} \longrightarrow \text{RESERVED} \longrightarrow \text{EXECUTING} \longrightarrow \text{RELEASED}$$
  With failure paths: $\text{RESERVED} \longrightarrow \text{FAILED / REFUNDED}$.
- **FR-6.4:** Database-enforced atomic reservation: Budget reservation must execute inside a PostgreSQL transaction using `SELECT ... FOR UPDATE` row-level locks on `privacy_budgets`.
- **FR-6.5:** Overspending prevention: If $\text{remaining\_epsilon} < \text{requested\_epsilon}$, the transaction rolls back with a `403 Insufficient Privacy Budget` error.
- **FR-6.6:** Append-only ledger invariant: Ledger rows can only be `INSERT`ed; `UPDATE` and `DELETE` operations are forbidden by database triggers.

### FR-7: Query-History-Aware Risk Analysis Engine
- **FR-7.1:** Before executing an aggregate query, the gateway inspects the analyst's historical query releases on the same dataset.
- **FR-7.2:** **Differencing Attack Detection:** Identifies pairs of queries where the filter condition differs by a narrow predicate (e.g., $N$ records vs $N-1$ records, or isolated unique attributes) that would enable reconstructing an individual's target value.
- **FR-7.3:** **Correlation & Repetition Warning:** Flags repeated execution of identical or near-identical aggregates designed to average out differential privacy noise.
- **FR-7.4:** **Explainability:** When a risk is detected, the engine outputs:
  - Risk Level: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - Warning explanation detailing the overlapping prior query IDs
  - Actionable recommendation for safer aggregation (e.g., "Broaden filter predicate", "Increase grouping granularity", or "Request approved synthetic summary")
  - System action: `ALLOW_WITH_AUDIT`, `REQUIRE_ADDITIONAL_EPSILON`, or `REJECT`
- **FR-7.5:** Risk evaluation is deterministic and documented; core gateway logic does not rely on nondeterministic black-box LLMs.

### FR-8: Audit Logging & Compliance
- **FR-8.1:** Security-critical events (login, failed auth, grant creation/revocation, query validation failure, budget exhaustion, differencing risk detected, query release) generate immutable records in `audit_events`.
- **FR-8.2:** Audit records store: timestamp, actor `user_id`, event type, client IP, resource ID, outcome (`SUCCESS`, `DENIED`, `ERROR`), and structured JSON context (excluding plaintext secrets or raw sensitive data).

---

## 4. Non-Functional Requirements (NFR)

- **NFR-1 (Relational Integrity):** PostgreSQL database schema normalized to 3NF. Explicit primary keys, foreign keys with appropriate `ON DELETE RESTRICT` or `CASCADE`, check constraints (`CHECK (remaining_epsilon >= 0)`), and unique constraints.
- **NFR-2 (Concurrency & Acid Properties):** Atomic isolation levels ensuring no double-spending under concurrent requests. Verified under multi-threaded connection tests.
- **NFR-3 (Defense in Depth):** Dual-layer security: (1) Application gateway authorization; (2) PostgreSQL database level roles and Row-Level Security (RLS) denying the application runtime user direct `SELECT` on private raw patient/user rows.
- **NFR-4 (Performance):** Aggregate query planning and noise execution under 250ms for 100,000 synthetic patient records. Explored via `EXPLAIN ANALYZE` and optimized with B-tree indexes.
- **NFR-5 (Reproducibility):** Containerized via Docker Compose. Single command initialization, automated migrations via Alembic, deterministic synthetic seed generation with documented test harness.
- **NFR-6 (Auditability):** Every released statistic is mathematically traceable to its privacy parameters, mechanism version, and budget ledger entry.
