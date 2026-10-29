# PrivacyVault — Architecture Decision Records (ADR)

**Document Version:** 1.0.0  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  

---

## ADR-001: Selection of PostgreSQL 17 as Authoritative Database Engine
- **Status:** Accepted
- **Context:** The system requires atomic row-level locks (`SELECT ... FOR UPDATE`), procedural triggers for ledger immutability, stored procedures for atomic budget reservation, Row-Level Security (RLS), and support for 3NF normalization.
- **Decision:** Use PostgreSQL 17.
- **Consequences:** Provides true ACID transactional semantics, native JSONB support for query filters, and granular permission roles. Rejects SQLite (no true concurrent row locks, no RLS) and MongoDB (lacks relational integrity and SQL rubric requirements).

---

## ADR-002: Selection of OpenDP 0.16.0 for Differential Privacy Mechanism
- **Status:** Accepted
- **Context:** A vetted, mathematically sound DP library is required. We evaluated `opendp` 0.16.0 and IBM's `diffprivlib` 0.6.6 on Python 3.12.4.
- **Decision:** Adopt `opendp` 0.16.0.
- **Justification:**
  - `opendp` is developed and maintained by the Harvard Privacy Tools Project with formal proofs of correctness in Rust.
  - Interactive testing verified clean compilation and execution of `make_laplace` with `AtomDomain(T=f64, nan=False)` and `AbsoluteDistance(f64)`.
  - `diffprivlib` failed execution on Python 3.12 due to incompatible upstream Cython imports (`DOUBLE` from `sklearn.tree._tree`).
- **Consequences:** The differential privacy layer is mathematically verified, high performance, and fully supported on modern Python runtimes.

---

## ADR-003: Unified Single `users` Table with Junction `user_roles`
- **Status:** Accepted
- **Context:** The assessment brief states: *"Maintain all users in a single Users table. Do NOT create separate tables such as Admin, Student, Faculty... Use a Role or RoleID column to distinguish user permissions."*
- **Decision:** Implement a single `users` table holding core identity credentials (id, email, hashed_password, full_name, is_active), linked to a normalized `roles` table via `user_roles` junction table (supporting users with multiple roles, e.g. Data Owner + Analyst).
- **Consequences:** 100% compliant with DBMS evaluation guidelines; prevents schema redundancy and identity duplication.

---

## ADR-004: Atomic Budget Reservation via Stored Procedure & Append-Only Ledger Trigger
- **Status:** Accepted
- **Context:** Naive read-then-write budget deduction in application code suffers from concurrency race conditions where simultaneous queries overspend the grant's budget. Additionally, historical expenditures must be tamper-resistant.
- **Decision:**
  1. Implement PL/pgSQL stored procedure `fn_reserve_privacy_budget` that executes `SELECT ... FOR UPDATE` row locks inside an atomic transaction.
  2. Implement database trigger `tr_enforce_append_only_ledger` that rejects `UPDATE` and `DELETE` on `privacy_budget_ledger`.
- **Consequences:** Concurrent requests cannot exceed the remaining budget balance; ledger history is strictly append-only.

---

## ADR-005: Deterministic Query-History-Aware Risk Analysis Engine
- **Status:** Accepted
- **Context:** Differential privacy bounds risk per-query, but repeated overlapping queries (differencing attacks) can expose specific individuals if queries differ by a single record. Heuristic risk analysis must be explainable and deterministic.
- **Decision:** Implement a deterministic query-history inspection engine that checks predicate overlap between incoming queries and previously released queries. If the symmetric difference represents a dangerous isolation ($|S_1 \setminus S_2| \le 1$), the query is flagged as `CRITICAL` risk and rejected.
- **Consequences:** Provides explainable security warnings with clear remediation steps without relying on stochastic or hallucination-prone LLM calls in core authorization.

---

## ADR-006: Rejection of Arbitrary Analyst SQL in Favor of Typed Query Descriptors
- **Status:** Accepted
- **Context:** Allowing clients to submit arbitrary SQL strings creates severe SQL injection risks, bypasses contribution bounding, and complicates sensitivity analysis.
- **Decision:** All aggregate requests must use structured JSON specifications (`AggregateQueryRequest`). The gateway translates the validated specification into parameterized SQLAlchemy Core AST expressions.
- **Consequences:** Completely eliminates SQL injection attack surface by construction; guarantees that every executed aggregation has a known mathematical sensitivity.

---

## ADR-007: Dual Database Roles (`privacyvault_migrator` vs `privacyvault_app`)
- **Status:** Accepted
- **Context:** Running web applications with database superuser or table-owner privileges violates the principle of least privilege and allows malicious code to bypass Row-Level Security.
- **Decision:** Use two database roles:
  1. `privacyvault_migrator`: Table owner used only during deployment/migrations.
  2. `privacyvault_app`: Restricted runtime role used by FastAPI connection pool with granular `SELECT`, `INSERT`, `UPDATE` grants and no table-altering privileges.
- **Consequences:** True defense-in-depth at the database layer.
