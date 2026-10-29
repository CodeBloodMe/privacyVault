-- ============================================================================
-- PrivacyVault Migration V002: Relational Schema DDL (3NF)
-- Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
-- Course: BCSE302P Database Systems Lab (Slot L25+L26)
-- Faculty: Dr. V. SIVAKUMAR
-- ============================================================================

-- 1. USERS: Master identity table (Single Users table requirement)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. ROLES: Standard RBAC lookup table
CREATE TABLE IF NOT EXISTS roles (
    name VARCHAR(50) PRIMARY KEY,
    description VARCHAR(255)
);

-- 3. USER_ROLES: Junction table for RBAC
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL REFERENCES roles(name) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_name)
);

-- 4. DATASETS: Registry of protected datasets
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    target_table VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. DATASET_COLUMNS: Column metadata and sensitivity tags
CREATE TABLE IF NOT EXISTS dataset_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    column_name VARCHAR(100) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    is_sensitive BOOLEAN NOT NULL DEFAULT TRUE,
    is_identifier BOOLEAN NOT NULL DEFAULT FALSE,
    is_aggregatable BOOLEAN NOT NULL DEFAULT TRUE,
    min_bound NUMERIC(14,4),
    max_bound NUMERIC(14,4),
    CONSTRAINT uq_dataset_column UNIQUE (dataset_id, column_name)
);

-- 6. PRIVACY_POLICIES: Clamping limits and epsilon caps
CREATE TABLE IF NOT EXISTS privacy_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_epsilon_per_query NUMERIC(6,4) NOT NULL CHECK (max_epsilon_per_query > 0 AND max_epsilon_per_query <= 5.0),
    default_delta NUMERIC(10,8) NOT NULL DEFAULT 0.0 CHECK (default_delta >= 0),
    global_epsilon_cap NUMERIC(6,4) NOT NULL CHECK (global_epsilon_cap >= max_epsilon_per_query),
    sensitivity_clamp_low NUMERIC(14,4) NOT NULL,
    sensitivity_clamp_high NUMERIC(14,4) NOT NULL,
    approved_mechanisms VARCHAR(100) NOT NULL DEFAULT 'OPENDP_LAPLACE',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. DATASET_GRANTS: Time-bounded analyst authorization
CREATE TABLE IF NOT EXISTS dataset_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_dataset_analyst_grant UNIQUE (dataset_id, analyst_id)
);

-- 8. PRIVACY_BUDGETS: Real-time remaining balance
CREATE TABLE IF NOT EXISTS privacy_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID UNIQUE NOT NULL REFERENCES dataset_grants(id) ON DELETE CASCADE,
    total_epsilon NUMERIC(8,4) NOT NULL CHECK (total_epsilon > 0),
    remaining_epsilon NUMERIC(8,4) NOT NULL CHECK (remaining_epsilon >= 0),
    total_delta NUMERIC(10,8) NOT NULL DEFAULT 0.0 CHECK (total_delta >= 0),
    remaining_delta NUMERIC(10,8) NOT NULL DEFAULT 0.0 CHECK (remaining_delta >= 0),
    last_reset_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. QUERY_REQUESTS: Structured query requests
CREATE TABLE IF NOT EXISTS query_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id UUID NOT NULL REFERENCES dataset_grants(id) ON DELETE RESTRICT,
    analyst_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    metric VARCHAR(50) NOT NULL CHECK (metric IN ('COUNT', 'BOUNDED_SUM', 'BOUNDED_AVG')),
    target_column VARCHAR(100),
    filter_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    requested_epsilon NUMERIC(6,4) NOT NULL CHECK (requested_epsilon > 0),
    requested_delta NUMERIC(10,8) NOT NULL DEFAULT 0.0 CHECK (requested_delta >= 0),
    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'VALIDATED', 'RESERVED', 'EXECUTING', 'RELEASED', 'REJECTED', 'FAILED')),
    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    risk_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_requests_grant ON query_requests(grant_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_analyst ON query_requests(analyst_id);
CREATE INDEX IF NOT EXISTS idx_query_requests_created ON query_requests(created_at);

-- 10. PRIVACY_BUDGET_LEDGER: Append-only financial-grade accounting ledger
CREATE TABLE IF NOT EXISTS privacy_budget_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES privacy_budgets(id) ON DELETE RESTRICT,
    request_id UUID REFERENCES query_requests(id) ON DELETE SET NULL,
    amount NUMERIC(8,4) NOT NULL,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('ALLOCATION', 'RESERVATION', 'COMMIT', 'REFUND')),
    balance_after NUMERIC(8,4) NOT NULL CHECK (balance_after >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_budget_ledger_budget ON privacy_budget_ledger(budget_id);

-- 11. QUERY_RELEASES: Released noisy outputs with differential privacy parameters
CREATE TABLE IF NOT EXISTS query_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE NOT NULL REFERENCES query_requests(id) ON DELETE RESTRICT,
    noisy_result NUMERIC(18,6) NOT NULL,
    mechanism_used VARCHAR(50) NOT NULL,
    noise_scale NUMERIC(14,6) NOT NULL,
    sensitivity_applied NUMERIC(14,4) NOT NULL,
    epsilon_spent NUMERIC(6,4) NOT NULL,
    delta_spent NUMERIC(10,8) NOT NULL,
    released_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. AUDIT_EVENTS: Security and compliance event log
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'ERROR')),
    client_ip VARCHAR(45),
    details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_events_timestamp ON audit_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_user_id);

-- 13. PROTECTED_PATIENTS: Sensitive clinical research microdata
CREATE TABLE IF NOT EXISTS protected_patients (
    patient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50) UNIQUE NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 125),
    gender VARCHAR(20) NOT NULL,
    blood_group VARCHAR(5) NOT NULL,
    diagnosis_code VARCHAR(20) NOT NULL,
    admission_type VARCHAR(50) NOT NULL,
    treatment_cost NUMERIC(12,2) NOT NULL CHECK (treatment_cost >= 0),
    length_of_stay_days INTEGER NOT NULL CHECK (length_of_stay_days >= 0),
    readmitted BOOLEAN NOT NULL DEFAULT FALSE,
    admission_date TIMESTAMPTZ NOT NULL
);

-- Performance Indexes on Protected Table for aggregation queries
CREATE INDEX IF NOT EXISTS idx_patients_diagnosis ON protected_patients(diagnosis_code);
CREATE INDEX IF NOT EXISTS idx_patients_age ON protected_patients(age);
CREATE INDEX IF NOT EXISTS idx_patients_cost ON protected_patients(treatment_cost);
CREATE INDEX IF NOT EXISTS idx_patients_admission_type ON protected_patients(admission_type);
CREATE INDEX IF NOT EXISTS idx_patients_gender ON protected_patients(gender);

-- Grants to restricted application role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO privacyvault_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO privacyvault_app;

-- Principle of Least Privilege: Direct access to protected raw microdata is explicitly revoked
-- Direct queries by the restricted role will result in SQLSTATE 42501 (insufficient_privilege)
REVOKE ALL ON protected_patients FROM privacyvault_app;
