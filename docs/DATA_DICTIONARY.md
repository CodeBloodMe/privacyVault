# PrivacyVault — Comprehensive Database Data Dictionary

**Document Version:** 1.0.0  
**Authors:** Student `24BCE0846` & `24BCE0870` (BCSE302P L25+L26)  
**Target RDBMS:** PostgreSQL 17  

---

## 1. Entity Catalog Summary

| # | Table Name | Cardinality / Scope | Description | Sensitive Microdata? |
| :-: | :--- | :--- | :--- | :-: |
| 1 | `users` | Core System Entities | Master identity table for all platform users. | No (hashes only) |
| 2 | `roles` | Reference Entity | Standard RBAC role definitions. | No |
| 3 | `user_roles` | Junction Entity | Maps users to roles (1:N or M:N). | No |
| 4 | `datasets` | Governance Entity | Registered datasets accessible for private queries. | No |
| 5 | `dataset_columns` | Metadata Entity | Column dictionary, data types, bounds & sensitivity. | No |
| 6 | `privacy_policies` | Governance Entity | Configured privacy parameters, clamping bounds & caps. | No |
| 7 | `dataset_grants` | Access Control | Time-bounded analyst authorization grants. | No |
| 8 | `privacy_budgets` | State Machine Entity | Current remaining $\epsilon, \delta$ allowance per grant. | No |
| 9 | `privacy_budget_ledger` | Accounting Entity | Append-only financial-grade transaction ledger. | No |
| 10 | `query_requests` | Gateway Entity | Incoming structured aggregate query specifications. | No |
| 11 | `query_releases` | Release Entity | Output differential privacy releases with metadata. | No |
| 12 | `audit_events` | Compliance Entity | Immutable security event log. | No |
| 13 | `protected_patients` | Protected Vault Microdata | Synthetic clinical research patient microdata. | **YES (Restricted)** |

---

## 2. Detailed Table Specifications

### 2.1 `users`
Master user identity table. Single Users table compliant with assignment criteria.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique user identifier |
| `email` | `VARCHAR(255)` | No | `UNIQUE, NOT NULL` | Login email address |
| `password_hash` | `VARCHAR(255)` | No | `NOT NULL` | Bcrypt password hash |
| `full_name` | `VARCHAR(150)` | No | `NOT NULL` | User's full display name |
| `is_active` | `BOOLEAN` | No | `DEFAULT TRUE` | Account status flag |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Account creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Last profile update timestamp |

**Indexes:**
- `idx_users_email`: `CREATE UNIQUE INDEX idx_users_email ON users(email);` (Fast authentication lookup)

---

### 2.2 `roles`
System access roles lookup table.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `name` | `VARCHAR(50)` | No | `PRIMARY KEY` | Role name (`ADMIN`, `DATA_OWNER`, `ANALYST`, `AUDITOR`) |
| `description` | `VARCHAR(255)` | Yes | `NULL` | Role purpose and scope |

---

### 2.3 `user_roles`
Junction table mapping users to roles.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `user_id` | `UUID` | No | `FK -> users(id) ON DELETE CASCADE` | Assigned user |
| `role_name` | `VARCHAR(50)` | No | `FK -> roles(name) ON DELETE RESTRICT` | Assigned role |
| `assigned_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Assignment timestamp |

**Primary Key:** `(user_id, role_name)`

---

### 2.4 `datasets`
Registry of protected relational datasets managed by Data Owners.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique dataset identifier |
| `name` | `VARCHAR(100)` | No | `UNIQUE, NOT NULL` | Human-readable dataset name |
| `description` | `TEXT` | Yes | `NULL` | Detailed dataset description |
| `target_table` | `VARCHAR(100)` | No | `NOT NULL` | Underlying protected table name in vault |
| `owner_id` | `UUID` | No | `FK -> users(id) ON DELETE RESTRICT` | Data Owner managing this dataset |
| `is_active` | `BOOLEAN` | No | `DEFAULT TRUE` | Global availability flag |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Registration timestamp |

---

### 2.5 `dataset_columns`
Metadata dictionary defining permissible operations per dataset column.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique column definition ID |
| `dataset_id` | `UUID` | No | `FK -> datasets(id) ON DELETE CASCADE` | Associated dataset |
| `column_name` | `VARCHAR(100)` | No | `NOT NULL` | Physical column name in target table |
| `data_type` | `VARCHAR(50)` | No | `NOT NULL` | Data type (`NUMERIC`, `CATEGORICAL`, `DATE`) |
| `is_sensitive` | `BOOLEAN` | No | `DEFAULT TRUE` | Whether column contains sensitive attributes |
| `is_identifier`| `BOOLEAN` | No | `DEFAULT FALSE` | Direct identifier (e.g., MRN, SSN) |
| `is_aggregatable` | `BOOLEAN` | No | `DEFAULT TRUE` | Permissible as aggregate target |
| `min_bound` | `NUMERIC(14,4)`| Yes | `NULL` | Global physical lower bound |
| `max_bound` | `NUMERIC(14,4)`| Yes | `NULL` | Global physical upper bound |

**Constraints:** `UNIQUE (dataset_id, column_name)`

---

### 2.6 `privacy_policies`
Policy configurations governing privacy budgets and clamping parameters.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique policy ID |
| `dataset_id` | `UUID` | No | `FK -> datasets(id) ON DELETE CASCADE` | Target dataset |
| `name` | `VARCHAR(100)` | No | `NOT NULL` | Policy label |
| `max_epsilon_per_query` | `NUMERIC(6,4)` | No | `CHECK (max_epsilon_per_query > 0 AND max_epsilon_per_query <= 5.0)` | Per-query $\epsilon$ ceiling |
| `default_delta` | `NUMERIC(10,8)` | No | `DEFAULT 0.0 CHECK (default_delta >= 0)` | Per-query $\delta$ parameter |
| `global_epsilon_cap` | `NUMERIC(6,4)` | No | `CHECK (global_epsilon_cap >= max_epsilon_per_query)` | Maximum lifetime $\epsilon$ for a grant |
| `sensitivity_clamp_low` | `NUMERIC(14,4)`| No | `NOT NULL` | Lower bound $L$ for contribution clamp |
| `sensitivity_clamp_high`| `NUMERIC(14,4)`| No | `NOT NULL` | Upper bound $U$ for contribution clamp |
| `approved_mechanisms` | `VARCHAR(100)` | No | `DEFAULT 'LAPLACE'` | Permitted mechanism (`LAPLACE`, `GAUSSIAN`) |
| `is_active` | `BOOLEAN` | No | `DEFAULT TRUE` | Active policy flag |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Policy timestamp |

---

### 2.7 `dataset_grants`
Access authorization grants issued by Data Owners to Analysts.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique grant identifier |
| `dataset_id` | `UUID` | No | `FK -> datasets(id) ON DELETE RESTRICT` | Authorized dataset |
| `analyst_id` | `UUID` | No | `FK -> users(id) ON DELETE RESTRICT` | Authorized analyst |
| `granted_by` | `UUID` | No | `FK -> users(id) ON DELETE RESTRICT` | Data owner granting permission |
| `granted_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Grant timestamp |
| `expires_at` | `TIMESTAMPTZ` | No | `NOT NULL` | Expiration deadline |
| `is_active` | `BOOLEAN` | No | `DEFAULT TRUE` | Revocation status flag |

**Constraints:** `UNIQUE (dataset_id, analyst_id)`

---

### 2.8 `privacy_budgets`
Tracks the current remaining privacy budget for an active grant.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique budget record ID |
| `grant_id` | `UUID` | No | `UNIQUE, FK -> dataset_grants(id) ON DELETE CASCADE` | Associated grant |
| `total_epsilon` | `NUMERIC(8,4)` | No | `CHECK (total_epsilon > 0)` | Initial total $\epsilon$ allocated |
| `remaining_epsilon` | `NUMERIC(8,4)` | No | `CHECK (remaining_epsilon >= 0)` | Real-time remaining $\epsilon$ balance |
| `total_delta` | `NUMERIC(10,8)`| No | `DEFAULT 0.0 CHECK (total_delta >= 0)` | Initial total $\delta$ allocated |
| `remaining_delta` | `NUMERIC(10,8)`| No | `DEFAULT 0.0 CHECK (remaining_delta >= 0)` | Real-time remaining $\delta$ balance |
| `last_reset_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Last balance modification |
| `updated_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Real-time update timestamp |

---

### 2.9 `privacy_budget_ledger`
Append-only transaction ledger recording every reservation, release debit, and failure refund.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique transaction ID |
| `budget_id` | `UUID` | No | `FK -> privacy_budgets(id) ON DELETE RESTRICT` | Target budget |
| `request_id` | `UUID` | Yes | `FK -> query_requests(id) ON DELETE SET NULL` | Triggering query request |
| `amount` | `NUMERIC(8,4)` | No | `NOT NULL` | Epsilon amount (+ or -) |
| `transaction_type` | `VARCHAR(30)` | No | `CHECK (transaction_type IN ('ALLOCATION', 'RESERVATION', 'COMMIT', 'REFUND'))` | Transaction category |
| `balance_after` | `NUMERIC(8,4)` | No | `NOT NULL` | Remaining balance after operation |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Transaction timestamp |

**Enforcement:** Protected by trigger `tr_enforce_append_only_ledger` (blocks UPDATE/DELETE).

---

### 2.10 `query_requests`
Incoming structured aggregate query specifications.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique query request ID |
| `grant_id` | `UUID` | No | `FK -> dataset_grants(id) ON DELETE RESTRICT` | Grant authorizing query |
| `analyst_id` | `UUID` | No | `FK -> users(id) ON DELETE RESTRICT` | Submitting analyst |
| `metric` | `VARCHAR(50)` | No | `CHECK (metric IN ('COUNT', 'BOUNDED_SUM', 'BOUNDED_AVG'))` | Approved aggregate operation |
| `target_column` | `VARCHAR(100)` | Yes | `NULL` | Column aggregated |
| `filter_criteria` | `JSONB` | No | `DEFAULT '[]'::jsonb` | Strongly validated filter array |
| `requested_epsilon`| `NUMERIC(6,4)` | No | `CHECK (requested_epsilon > 0)` | Requested privacy cost |
| `requested_delta` | `NUMERIC(10,8)`| No | `DEFAULT 0.0 CHECK (requested_delta >= 0)` | Requested delta |
| `status` | `VARCHAR(30)` | No | `DEFAULT 'RECEIVED'` | State (`RECEIVED`, `VALIDATED`, `RESERVED`, `EXECUTING`, `RELEASED`, `REJECTED`, `FAILED`) |
| `risk_level` | `VARCHAR(20)` | No | `DEFAULT 'LOW'` | Evaluation (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| `risk_summary` | `TEXT` | Yes | `NULL` | Explainable warning details |
| `created_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Submission timestamp |

---

### 2.11 `query_releases`
Released noisy query outputs with differential privacy guarantees and audit metadata.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique release ID |
| `request_id` | `UUID` | No | `UNIQUE, FK -> query_requests(id) ON DELETE RESTRICT` | Associated request |
| `noisy_result` | `NUMERIC(18,6)`| No | `NOT NULL` | Calibrated perturbed aggregate |
| `mechanism_used`| `VARCHAR(50)` | No | `NOT NULL` | Mechanism (`OPENDP_LAPLACE`, `OPENDP_GAUSSIAN`) |
| `noise_scale` | `NUMERIC(14,6)`| No | `NOT NULL` | Scale parameter $b = \Delta f / \epsilon$ |
| `sensitivity_applied`| `NUMERIC(14,4)`| No | `NOT NULL` | Global sensitivity $\Delta f$ |
| `epsilon_spent` | `NUMERIC(6,4)` | No | `NOT NULL` | Final $\epsilon$ charged |
| `delta_spent` | `NUMERIC(10,8)`| No | `NOT NULL` | Final $\delta$ charged |
| `released_at` | `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Release timestamp |

---

### 2.12 `audit_events`
Immutable security and governance event log.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique audit event ID |
| `event_timestamp`| `TIMESTAMPTZ` | No | `DEFAULT CURRENT_TIMESTAMP` | Exact occurrence time |
| `actor_user_id` | `UUID` | Yes | `FK -> users(id) ON DELETE SET NULL` | Performing user ID |
| `event_type` | `VARCHAR(100)` | No | `NOT NULL` | Type (`AUTH_LOGIN`, `GRANT_REVOKED`, `QUERY_REJECTED_DIFFERENCING`, etc.) |
| `resource_type` | `VARCHAR(50)` | Yes | `NULL` | Entity class affected |
| `resource_id` | `VARCHAR(100)` | Yes | `NULL` | ID of affected entity |
| `outcome` | `VARCHAR(20)` | No | `CHECK (outcome IN ('SUCCESS', 'DENIED', 'ERROR'))` | Result status |
| `client_ip` | `VARCHAR(45)` | Yes | `NULL` | Source IP address |
| `details` | `JSONB` | Yes | `DEFAULT '{}'::jsonb` | Safe contextual details (no raw secrets) |

---

### 2.13 `protected_patients`
Demonstration clinical research dataset containing private individual records.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `patient_id` | `UUID` | No | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique patient key |
| `mrn` | `VARCHAR(50)` | No | `UNIQUE, NOT NULL` | Medical Record Number (Identifier) |
| `age` | `INTEGER` | No | `CHECK (age >= 0 AND age <= 125)` | Patient age |
| `gender` | `VARCHAR(20)` | No | `NOT NULL` | Patient gender |
| `blood_group` | `VARCHAR(5)` | No | `NOT NULL` | Blood type (`A+`, `O-`, etc.) |
| `diagnosis_code`| `VARCHAR(20)` | No | `NOT NULL` | ICD-10 diagnosis code |
| `admission_type`| `VARCHAR(50)` | No | `NOT NULL` | Type (`EMERGENCY`, `ELECTIVE`, `URGENT`) |
| `treatment_cost`| `NUMERIC(12,2)`| No | `CHECK (treatment_cost >= 0)` | Total hospitalization bill ($) |
| `length_of_stay_days`| `INTEGER` | No | `CHECK (length_of_stay_days >= 0)` | Duration of stay |
| `readmitted` | `BOOLEAN` | No | `DEFAULT FALSE` | 30-day readmission status |
| `admission_date`| `TIMESTAMPTZ` | No | `NOT NULL` | Admission timestamp |

**Indexes:**
- `idx_patients_diagnosis`: `CREATE INDEX idx_patients_diagnosis ON protected_patients(diagnosis_code);`
- `idx_patients_age`: `CREATE INDEX idx_patients_age ON protected_patients(age);`
- `idx_patients_cost`: `CREATE INDEX idx_patients_cost ON protected_patients(treatment_cost);`
- `idx_patients_admission_type`: `CREATE INDEX idx_patients_admission_type ON protected_patients(admission_type);`
