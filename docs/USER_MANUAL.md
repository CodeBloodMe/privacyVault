# PrivacyVault User Manual

## 1. What PrivacyVault Does

PrivacyVault is a web application for requesting useful statistics from a
protected clinical dataset without exposing individual patient records. Users
sign in under role-based access control. Analysts create approved aggregate
queries; the backend checks their access grant, privacy budget, and query risk
before releasing a differentially private result.

The current demonstration dataset is synthetic and contains 10,000 patient
records. The application stores its data in PostgreSQL. In the configured
deployment, PostgreSQL is hosted by Supabase and the backend connects through
the Supabase session pooler. The application has its own user table and JWT
login; it does not use Supabase Auth for sign-in.

## 2. Open the Application

When the development servers are running, open:

- Website: `http://localhost:5173`
- Backend API documentation: `http://localhost:8001/docs`
- Backend health endpoint: `http://localhost:8001/api/v1/health`

The frontend sends API requests through its `/api` proxy to the backend on port
8001. A healthy API response should report `status: healthy`, a connected
database, and runtime user `privacyvault_app`.

To start the services manually, open two PowerShell terminals in the project
root (`research project 3\research project 3`):

```powershell
# Terminal 1: API
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001
```

```powershell
# Terminal 2: frontend
Set-Location .\frontend
npm run dev -- --host 127.0.0.1
```

The backend reads `DATABASE_URL` and `ADMIN_DATABASE_URL` from the ignored
project `.env` file. Do not copy that file into documentation, source control,
screenshots, or support requests. If credentials are rotated, update the local
environment configuration securely and restart the backend.

## 3. Sign In

1. Select **1-Click Persona Simulator** on the landing page or choose **Sign
   In** in the header.
2. Either select a demonstration persona or enter an email and password.
3. After successful authentication, the application receives a JWT and opens
   the screen associated with the account's role.
4. Use **Switch Role** in the header to change to another demonstration
   persona, or **Logout** to end the current session.

The seeded demonstration accounts are:

| Role | Email | Demo password |
|---|---|---|
| Analyst (Krish) | `krish.24bce0846@vitstudent.ac.in` | `AnalystPass2026!` |
| Analyst (Parv) | `parv.24bce0870@vitstudent.ac.in` | `AnalystPass2026!` |
| Data Owner | `dr.sivakumar@vit.ac.in` | `OwnerPass2026!` |
| Auditor | `compliance.auditor@vit.ac.in` | `AuditorPass2026!` |
| Administrator | `admin@privacyvault.local` | `AdminPass2026!` |

These are demo credentials, not suitable for real accounts or production.
Change them and review the demo persona controls before exposing the application
to other users.

## 4. Landing Page and Header

The landing page introduces the privacy-preserving analytics service and
provides buttons to open sign-in, inspect the schema, and run demonstration
scenarios. The header displays platform/database status and provides navigation
to features allowed for the signed-in role:

- **Analytics Gateway**: analyst query builder and result/history panels.
- **Dataset Catalog**: schema, dataset-column metadata, and privacy policy.
- **Data Governance**: owner grant and budget management.
- **Audit & Ledger**: audit events and append-only privacy-budget ledger.
- **Scenarios (A–H)**: interactive demonstration actions and their output.
- **Switch Role / Logout**: change demonstration account or end the session.

The visible menu is role-aware. A role may see only some sections; the backend
also checks authorization on protected API operations.

## 5. Analyst Workflow: Request a Private Aggregate

1. Sign in as an analyst. The **Analytics Gateway** opens automatically.
2. Check **Active Dataset Grant**. Select a grant if more than one is available.
   The grant shows the dataset, expiry, and remaining epsilon budget. If no
   grant is active, ask a Data Owner to issue one.
3. In **Structured Aggregate Builder**, either choose a clinical preset or
   configure a query:
   - Choose `COUNT`, `BOUNDED_SUM`, or `BOUNDED_AVG`.
   - For sum and average, select an approved aggregatable numeric column.
   - Add zero or more cohort filters using an allowed column, comparison
     operator, and value.
   - Set the requested privacy parameters where offered by the form.
4. Select **Validate Query** first. Review validation and query-history risk
   feedback. Validation is a preflight check; it does not mean a result has
   been released.
5. Select **Submit Query** to execute an accepted request.
6. Review the released noisy aggregate, mechanism/noise details, and epsilon
   spent. Review the privacy-budget meter and query history for updated status.

The query builder does not accept arbitrary SQL. Identifier columns such as
patient IDs and MRNs are not valid aggregate targets or filter predicates. The
backend checks the grant, filters, policy limits, query history, and available
budget. It reserves budget atomically and returns an aggregate with differential
privacy noise. Direct reads of the raw patient table are denied to the runtime
application role.

`COUNT` counts eligible rows. `BOUNDED_SUM` and `BOUNDED_AVG` work on approved
bounded numeric contributions. A released value is intentionally noisy; it is
not the exact database aggregate. Repeated and overlapping queries can be
blocked by the query-history risk checks, and insufficient budget prevents a
query from running.

## 6. Dataset Catalog

Open **Dataset Catalog** after signing in to inspect the registered dataset and
its relational design:

- **Interactive 3NF ER Diagram** presents the database entities and
  relationships; the Mermaid source can be copied.
- **Dataset Columns & Policies** shows dataset descriptions, column names and
  types, sensitivity/identifier tags, aggregation eligibility, physical
  bounds, and the active differential-privacy policy.
- **Refresh** reloads catalog metadata from PostgreSQL.

This is metadata, not a way to browse individual patient records.

## 7. Data Owner Workflow: Grant and Revoke Access

1. Sign in as the Data Owner and open **Data Governance**.
2. In **Issue Analyst Access Grant**, confirm the target dataset, enter the
   analyst's email, and set the grant duration and allocated epsilon budget.
3. Select **Authorize Grant & Allocate Budget**. The backend checks the user
   and records the grant and budget.
4. Review the **Active Analyst Grants & Real-time Privacy Budget Balances**
   table. It includes analyst, dataset, remaining/total epsilon, utilization,
   expiration, and status.
5. Use **Revoke** on an active grant when access should stop. The grant's
   inactive status prevents subsequent queries that rely on it.

The portal also summarizes the key governance controls: access-grant
validation, per-query and global epsilon limits, row-locked budget accounting,
identifier restrictions, and query-history risk analysis. The active policy
limits are enforced by the backend/database; the portal is not a policy editor.

## 8. Auditor Workflow: Inspect Ledger and Events

1. Sign in as the Auditor and open **Audit & Ledger**.
2. Choose a target budget to view its ledger entries.
3. Review each allocation, reservation, refund/commit if present, amount,
   resulting balance, request ID, timestamp, and append-only status.
4. Use the event-type and outcome filters to narrow the security/compliance
   event log. Select **Refresh Logs** to reload it.

The ledger is protected by a database trigger that rejects updates and
deletions. The event log includes actions such as login success/failure, query
release/rejection, budget exhaustion, and grant issue/revocation.

## 9. Interactive Demonstration Scenarios

Open **Scenarios (A–H)** from the header or landing page, then select **Run
Scenario**. The modal displays the result or error as JSON. The current modal
implementation has runnable scenarios **A, B, C, D, F, and H**:

- **A — Ordinary aggregate access**: submits a COUNT query and displays its
  differentially private release.
- **B — Raw-data access denial**: attempts an identifier aggregation and
  expects the backend to reject it.
- **C — Differencing defense**: submits related queries and expects the risk
  engine to block the risky follow-up.
- **D — Budget exhaustion**: spends the analyst's epsilon budget and verifies
  that further requests are denied.
- **F — Grant revocation**: creates and revokes a demonstration grant, then
  verifies that the analyst cannot use it.
- **H — Audit verification**: reads the audit events and shows recent entries.

The landing page also describes scenarios E and G, but they are not currently
implemented as runnable entries in the scenario modal. Scenarios A, C, D, F,
and H may create queries, consume privacy budget, change grants, or add audit
events in the connected Supabase database. Run these only when those
demonstration side effects are acceptable. Re-seeding the database resets demo
tables and budgets; do not reseed a database containing data you need to keep.

## 10. Sessions, Troubleshooting, and Safe Use

- **Database appears offline**: open the health endpoint above. If it reports
  `degraded` or `database.connected: false`, verify the Supabase project is
  available and the local `.env` values are current, then restart the backend.
- **Login returns an error**: confirm the database health check is healthy and
  use a seeded account with its matching password. The user must exist in the
  application's `users` table; this is separate from Supabase Auth users.
- **Analyst sees no grant**: sign in as the Data Owner and create a valid grant
  for that analyst.
- **Query is rejected**: review the displayed validation/risk feedback, use
  non-identifier fields, check grant expiry, stay within policy limits, and
  check remaining epsilon.
- **Frontend cannot reach API**: make sure the Vite server and backend are both
  running. The current Vite proxy targets `127.0.0.1:8001`.
- **Session expired**: sign in again. The frontend stores its JWT and cached
  profile in browser local storage and clears them on logout or unauthorized
  responses.

Use synthetic demo data for evaluation. This project is an academic
demonstration, not a certified clinical system. Do not upload real patient
records or treat the interface's HIPAA/ISO labels as a legal compliance
certification.
