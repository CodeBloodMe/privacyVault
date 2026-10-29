# PrivacyVault — Technical Limitations & Threat Model Boundaries

**Student Authors:** KRISH (`24BCE0846`) & PARV (`24BCE0870`)  
**Course:** BCSE302P Database Systems Lab (Slot L25+L26)  
**Faculty Guide:** Dr. V. SIVAKUMAR (School of Computer Science and Engineering, VIT)  
**Academic Year:** 2026  

---

## 1. Scope & Academic Transparency

In accordance with scientific and engineering integrity principles (Section 17 of the Project Directive), PrivacyVault does not claim to have invented differential privacy, row-level locking, or database auditing. The system is an applied database gateway that bridges relational database engineering (PostgreSQL 17) with mathematical differential privacy (OpenDP 0.16.0).

This document outlines the known technical boundaries, mathematical assumptions, and operational trade-offs of the current implementation.

---

## 2. Differential Privacy Mathematical Limitations

### 2.1 Bounded Domain Requirement
- **Bounded Sum & Mean:** The sensitivity of a summation over an unbounded domain is infinite ($\Delta f = \infty$). Therefore, PrivacyVault strictly requires pre-configured lower and upper clamping bounds ($[L, U]$) defined in the active `privacy_policies` record.
- **Clamping Bias:** Clamping introduces systematic mathematical bias for values that fall outside $[L, U]$. The system optimizes for privacy preservation over tail-end outlier fidelity.

### 2.2 Composition & Utility Degradation
- **Linear Composition:** Under standard sequential composition, the total privacy cost of $k$ independent queries is $\sum_{i=1}^k \epsilon_i$. As the analyst executes more queries, their remaining budget shrinks until exhaustion.
- **Utility vs. Budget Trade-off:** With smaller $\epsilon$ (e.g. $\epsilon = 0.1$), privacy is high, but noise scale $b = \Delta f / \epsilon$ is large ($b = 10.0$ for COUNT). For small sub-cohorts (e.g., $N < 20$), the added noise can substantially distort aggregate ratios.

### 2.3 Floating-Point Vulnerabilities (Mironov Sniffing)
- Standard IEEE 754 floating-point operations can occasionally leak privacy through the lowest-order mantissa bits when generating continuous Laplace random variables (Mironov, 2012).
- **Mitigation:** PrivacyVault delegates all noise sampling to official OpenDP 0.16.0 primitives (`make_laplace`), which implement vetted discrete-Laplace / snapping mechanisms designed to prevent floating-point side-channel leakage.

---

## 3. Query Engine Scope Limitations

1. **Restricted Relational Operators:**
   - To eliminate arbitrary SQL injection and maintain strict sensitivity calculations, PrivacyVault does not permit free-form SQL text from clients.
   - Supported aggregations are intentionally restricted to:
     - `COUNT`: Global sensitivity $\Delta f = 1$.
     - `BOUNDED_SUM`: Global sensitivity $\Delta f = U - L$.
     - `BOUNDED_AVG`: Global sensitivity bounded using matching record count $N$ as $\Delta f = (U - L) / \max(1, N)$.
   - Arbitrary multi-table `JOIN` syntax, recursive common table expressions (`WITH RECURSIVE`), and arbitrary nested subqueries are prohibited for untrusted analysts.
2. **Filter Predicate Complexity:**
   - The query specification supports conjunctive (`AND`) filtering across approved dataset columns using comparison operators (`EQ`, `NEQ`, `GT`, `GTE`, `LT`, `LTE`, `IN`).
   - Arbitrary disjunctive normal form (`OR` trees across multiple attributes) is restricted to avoid complex sensitivity inflation.

---

## 4. Query-History Risk Engine Boundaries

1. **Heuristic Nature:**
   - The `QueryHistoryRiskEngine` is an explainable defense-in-depth policy layer designed to detect obvious differencing attacks ($Q_1 \setminus Q_2$) and repeated noise-averaging requests.
   - **Critical Distinction:** The query-history risk monitor is **not** a mathematical substitute for differential privacy composition. Differential privacy provides mathematical guarantees regardless of query patterns; the risk monitor prevents analysts from wasting their allocated budget on unconstructive or suspicious differencing attempts.
2. **Rolling Window Bound:**
   - Query history is inspected over a rolling window of the last 50 released queries per grant to maintain sub-millisecond gateway latency.

---

## 5. Database & Infrastructure Assumptions

1. **Superuser / Table Owner Assumption:**
   - Append-only triggers (`tr_enforce_append_only_ledger`) and database permissions protect against application-level exploits and unauthorized runtime roles (`privacyvault_app`).
   - **PostgreSQL Privilege Reality:** An authoritative PostgreSQL superuser or root system administrator with raw access to the database storage engine could bypass triggers or alter records directly. Cryptographic append-only ledgers within a standard RDBMS do not constitute a distributed blockchain.
2. **Single-Node Transaction Throughput:**
   - Atomic row-locking (`FOR UPDATE`) on the `privacy_budgets` table serializes concurrent queries against the **same** grant ID.
   - While queries across *different* analysts execute in full parallel concurrency, simultaneous bursts of queries targeting the *same* grant ID will queue sequentially at the database lock, capping throughput per single budget to approximately 500 queries/second.

---

## 6. Security & Threat Model Exclusions

The following attack vectors fall outside PrivacyVault's target threat model:
- Physical hardware compromise of the host server.
- Operating system level memory inspection of the PostgreSQL process.
- Compromised developer workstations holding valid administrative database credentials.
- Network eavesdropping when TLS/HTTPS is terminated outside the local environment.
