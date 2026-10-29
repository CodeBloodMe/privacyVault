# PrivacyVault — Project Audit & Workspace Assessment

**Audit Date:** October 24, 2026  
**Auditor / Lead Engineer:** PrivacyVault Engineering Team (Student Reg: `24BCE0846` & `24BCE0870`, BCSE302P L25+L26)  
**Target Environment:** Windows 11, PowerShell, Docker Engine 29.9.1, Python 3.12.4, Node.js v22.19.0, PostgreSQL 17  

---

## 1. Initial State of the Workspace

| Dimension | Inspection Finding | Verification Status |
| :--- | :--- | :--- |
| **Workspace Path** | `c:\Users\Admin\Downloads\VIT Downloads\SEM 5\DBMS\research project 3` | Verified (was empty directory upon session start) |
| **Git Repository** | Not initialized previously; initialized clean git repo on `main` branch with `.gitignore`. | Verified |
| **Existing Codebase** | Clean greenfield slate inside workspace. No legacy technical debt or broken mock abstractions. | Verified |
| **Assessment Brief / Rubric** | Located `../DBMS Assessment 8, 9  10 Project QP.pdf` (BCSE302P Database Systems Lab, Fall 2026-27, Dr. V. SIVAKUMAR). | Fully Extracted & Analyzed (30 marks + 3 bonus marks) |
| **Related Sibling Work** | Examined prior coursework in `../dbms project` (`24BCE0846_24BCE0870_L25_IA9&10_Proj_KRISH_PARV.pdf`). Identified team identifiers `24BCE0846`, `24BCE0870`. | Verified |
| **Installed Runtimes** | Python 3.12.4, Node v22.19.0, npm 10.9.3, Docker 29.9.1. | Verified |

---

## 2. Differential Privacy Library Evaluation & Audit

In accordance with Section 4 of the Master Directive, we conducted a verified empirical audit of candidate differential privacy libraries on Python 3.12.4:

1. **`opendp` (v0.16.0)**:
   - **Origin:** Official Harvard Privacy Tools Project / OpenDP Team.
   - **Language Core:** High-performance, memory-safe Rust core with first-class Python C-ABI bindings.
   - **Verification:** Successfully installed wheel `opendp-0.16.0-cp310-abi3-win_amd64.whl`. Tested interactive creation of `AtomDomain(T=f64)`, `AbsoluteDistance(f64)`, and `make_laplace` with `MaxDivergence`. Successfully verified mathematical noise generation over float inputs with zero errors.
   - **Verdict:** **ACCEPTED & SELECTED as authoritative DP engine**.

2. **`diffprivlib` (v0.6.6)**:
   - **Origin:** IBM Differential Privacy Library.
   - **Verification:** Failed execution on Python 3.12 with modern `scikit-learn 1.9+`: raised `ImportError: cannot import name 'DOUBLE' from 'sklearn.tree._tree'`.
   - **Verdict:** **REJECTED** due to upstream unmaintained Cython bindings in Scikit-Learn 1.9+.

---

## 3. DBMS Assessment Rubric & Alignment Matrix

From `DBMS Assessment 8, 9  10 Project QP.pdf`, the evaluation criteria are mapped directly to PrivacyVault components:

| Rubric Section | Marks | Academic Requirement | PrivacyVault Architectural Mapping | Verification Test |
| :--- | :---: | :--- | :--- | :--- |
| **1. Problem & Planning** | 2 | Problem statement, objectives, tech stack, deliverables, Gantt chart. | `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, `README.md`. | Document review & timeline audit. |
| **2. Database Design** | 4 | ER Diagram, min 4 primary entities, min 3 relationships, relational schema, normalization (3NF+), keys & constraints. | 10 normalized tables: `users`, `roles`, `user_roles`, `datasets`, `dataset_columns`, `dataset_grants`, `privacy_policies`, `privacy_budgets`, `privacy_budget_ledger`, `query_requests`, `query_releases`, `audit_events`. | Schema validation, ER diagram, foreign key & check constraint integration tests. |
| **3. Database Implementation** | 7 | Table design, CRUD, joins, views, aggregate queries, transactions, at least 1 Stored Procedure, at least 1 Trigger, ORM integration. | SQLAlchemy 2.0 ORM + PostgreSQL 17. Stored Procedure for atomic budget reservation; Trigger for budget balance integrity & append-only ledger enforcement; Analytical Views for safe schema exploration. | `pytest` database integration tests executing real SQL transactions against PostgreSQL container. |
| **4. Application Dev** | 4 | Framework-based app, dashboard, search/filter, validation, exception handling, responsive UI. | FastAPI backend (Pydantic v2 validation) + React TypeScript Vite frontend with responsive glassmorphic dark theme. | End-to-end API tests + frontend build validation. |
| **5. Auth & Security** | 5 | OAuth/JWT, single Users table (no separate user type tables), RBAC, password hashing (bcrypt), SQL injection prevention, secrets management. | Single `users` table with junction `user_roles` (ADMIN, DATA_OWNER, ANALYST, AUDITOR), Bcrypt hashing, strict parameterized queries via SQLAlchemy, `.env` exclusion. PostgreSQL Row-Level Security (RLS) & dedicated restricted runtime role. | Authentication suite, RBAC access denial tests, SQL injection immunity suite, RLS bypass denial tests. |
| **6. Professional Dev** | 5 | GitHub (progressive commits, branching `main`/`dev`), backup/restore (`pg_dump`/`pg_restore`), Docker Compose. | Git version control, Docker Compose multi-service architecture, backup & restore scripts in `database/scripts/`. | Docker container health check, pg_dump & pg_restore execution test. |
| **7. Bonus Marks** | +3 | CI/CD (GitHub Actions) (+1), Cloud DB compatibility (+1), Industry practice: Automated Testing, Audit Logging, Differential Privacy (+1). | GitHub Actions CI workflow, immutable audit event log, automated test suite with coverage, OpenDP integration. | CI workflow definition & full test suite execution. |

---

## 4. Key Engineering Decisions & Audit Findings

1. **Clean Greenfield Implementation:** Since the workspace is empty, we build a clean, disciplined, modular vertical stack following modern software engineering best practices without legacy encumbrance.
2. **Student Identity Integration:** In compliance with instruction 7 ("In between the code use your Registerno & name as variable name, method name, class name and while printing the values (Mandatory)"), student registration tokens `REG_24BCE0846` and `REG_24BCE0870` and author names `KRISH` and `PARV` are embedded in core security definers, seed data signatures, and diagnostic outputs.
3. **Authoritative PostgreSQL Engine:** All state, constraints, atomic row-locks, ledger balances, and security definers reside in PostgreSQL. SQLite is strictly rejected because it lacks Row-Level Security, concurrent row-level locking (`FOR UPDATE`), and PostgreSQL procedural triggers.
4. **No Mock Fallbacks in Production Paths:** All analytical results will be computed against real protected tables using real mathematical noise from OpenDP.
