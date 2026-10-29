-- ============================================================================
-- PrivacyVault Migration V003: Stored Procedures, Triggers & Views
-- Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
-- Course: BCSE302P Database Systems Lab (Slot L25+L26)
-- Faculty: Dr. V. SIVAKUMAR
-- ============================================================================

-- 1. STORED PROCEDURE: fn_reserve_privacy_budget
CREATE OR REPLACE FUNCTION fn_reserve_privacy_budget(
    p_budget_id UUID,
    p_requested_epsilon NUMERIC,
    p_request_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    remaining NUMERIC,
    error_message TEXT,
    author_signature TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_remaining NUMERIC;
    v_signature CONSTANT TEXT := 'REG_24BCE0846_24BCE0870_KRISH_PARV';
BEGIN
    IF p_requested_epsilon <= 0 THEN
        RETURN QUERY SELECT FALSE, 0.0::NUMERIC, 'Requested epsilon must be strictly positive'::TEXT, v_signature;
        RETURN;
    END IF;

    -- Prevent duplicate reservation for the exact same query request ID
    IF p_request_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM privacy_budget_ledger 
        WHERE request_id = p_request_id AND transaction_type = 'RESERVATION'
    ) THEN
        SELECT remaining_epsilon INTO v_current_remaining FROM privacy_budgets WHERE id = p_budget_id;
        RETURN QUERY SELECT FALSE, COALESCE(v_current_remaining, 0.0::NUMERIC), 'Duplicate reservation: query request has already reserved budget'::TEXT, v_signature;
        RETURN;
    END IF;

    SELECT remaining_epsilon 
    INTO v_current_remaining
    FROM privacy_budgets
    WHERE id = p_budget_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.0::NUMERIC, 'Budget record not found'::TEXT, v_signature;
        RETURN;
    END IF;

    IF v_current_remaining < p_requested_epsilon THEN
        RETURN QUERY SELECT FALSE, v_current_remaining, 'Insufficient privacy budget remaining'::TEXT, v_signature;
        RETURN;
    END IF;

    UPDATE privacy_budgets
    SET remaining_epsilon = remaining_epsilon - p_requested_epsilon,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_budget_id;

    INSERT INTO privacy_budget_ledger (
        id, budget_id, request_id, amount, transaction_type, balance_after, created_at
    ) VALUES (
        gen_random_uuid(), p_budget_id, p_request_id, p_requested_epsilon, 'RESERVATION', 
        v_current_remaining - p_requested_epsilon, CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT TRUE, (v_current_remaining - p_requested_epsilon), NULL::TEXT, v_signature;
END;
$$;

-- 2. STORED PROCEDURE: fn_refund_privacy_budget
CREATE OR REPLACE FUNCTION fn_refund_privacy_budget(
    p_budget_id UUID,
    p_refund_epsilon NUMERIC,
    p_request_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    new_balance NUMERIC,
    error_message TEXT,
    author_signature TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_remaining NUMERIC;
    v_total_epsilon NUMERIC;
    v_signature CONSTANT TEXT := 'REG_24BCE0846_24BCE0870_KRISH_PARV';
BEGIN
    IF p_refund_epsilon <= 0 THEN
        RETURN QUERY SELECT FALSE, 0.0::NUMERIC, 'Refund epsilon must be strictly positive'::TEXT, v_signature;
        RETURN;
    END IF;

    -- Invariant 1: Cannot refund if query result has already been released
    IF p_request_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM query_releases WHERE request_id = p_request_id) 
           OR EXISTS (SELECT 1 FROM query_requests WHERE id = p_request_id AND status = 'RELEASED') THEN
            SELECT remaining_epsilon INTO v_current_remaining FROM privacy_budgets WHERE id = p_budget_id;
            RETURN QUERY SELECT FALSE, COALESCE(v_current_remaining, 0.0::NUMERIC), 'REFUND_DENIED: Cannot refund privacy budget after query result has already been released'::TEXT, v_signature;
            RETURN;
        END IF;

        -- Invariant 2: Cannot issue duplicate refund for the same query request
        IF EXISTS (
            SELECT 1 FROM privacy_budget_ledger 
            WHERE request_id = p_request_id AND transaction_type = 'REFUND'
        ) THEN
            SELECT remaining_epsilon INTO v_current_remaining FROM privacy_budgets WHERE id = p_budget_id;
            RETURN QUERY SELECT FALSE, COALESCE(v_current_remaining, 0.0::NUMERIC), 'REFUND_DENIED: Privacy budget for this query request has already been refunded'::TEXT, v_signature;
            RETURN;
        END IF;

        -- Invariant 3: Verify that an active reservation actually exists for this request
        IF NOT EXISTS (
            SELECT 1 FROM privacy_budget_ledger 
            WHERE request_id = p_request_id AND transaction_type = 'RESERVATION'
        ) THEN
            SELECT remaining_epsilon INTO v_current_remaining FROM privacy_budgets WHERE id = p_budget_id;
            RETURN QUERY SELECT FALSE, COALESCE(v_current_remaining, 0.0::NUMERIC), 'REFUND_DENIED: No reservation record found for this query request'::TEXT, v_signature;
            RETURN;
        END IF;
    END IF;

    SELECT remaining_epsilon, total_epsilon
    INTO v_current_remaining, v_total_epsilon
    FROM privacy_budgets
    WHERE id = p_budget_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0.0::NUMERIC, 'Budget record not found'::TEXT, v_signature;
        RETURN;
    END IF;

    UPDATE privacy_budgets
    SET remaining_epsilon = LEAST(v_total_epsilon, remaining_epsilon + p_refund_epsilon),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_budget_id;

    INSERT INTO privacy_budget_ledger (
        id, budget_id, request_id, amount, transaction_type, balance_after, created_at
    ) VALUES (
        gen_random_uuid(), p_budget_id, p_request_id, p_refund_epsilon, 'REFUND', 
        LEAST(v_total_epsilon, v_current_remaining + p_refund_epsilon), CURRENT_TIMESTAMP
    );

    RETURN QUERY SELECT TRUE, LEAST(v_total_epsilon, v_current_remaining + p_refund_epsilon), NULL::TEXT, v_signature;
END;
$$;

-- 3. TRIGGER: tr_enforce_append_only_ledger
CREATE OR REPLACE FUNCTION fn_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'LEDGER_IMMUTABILITY_ERROR: privacy_budget_ledger is an append-only audit table. Modifying or deleting records is strictly forbidden [Verified by: 24BCE0846 & 24BCE0870]';
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_enforce_append_only_ledger ON privacy_budget_ledger;
CREATE TRIGGER tr_enforce_append_only_ledger
BEFORE UPDATE OR DELETE ON privacy_budget_ledger
FOR EACH ROW
EXECUTE FUNCTION fn_prevent_ledger_mutation();

-- 4. ANALYTICAL VIEWS
DROP VIEW IF EXISTS v_dataset_metadata_catalog CASCADE;
CREATE VIEW v_dataset_metadata_catalog AS
SELECT 
    d.id AS dataset_id,
    d.name AS dataset_name,
    d.description AS dataset_description,
    u.full_name AS owner_name,
    u.email AS owner_email,
    c.column_name,
    c.data_type,
    c.is_sensitive,
    c.is_identifier,
    c.is_aggregatable,
    c.min_bound,
    c.max_bound,
    p.max_epsilon_per_query,
    p.global_epsilon_cap,
    p.sensitivity_clamp_low,
    p.sensitivity_clamp_high,
    p.approved_mechanisms
FROM datasets d
JOIN users u ON d.owner_id = u.id
JOIN dataset_columns c ON d.id = c.dataset_id
JOIN privacy_policies p ON d.id = p.dataset_id
WHERE d.is_active = TRUE AND p.is_active = TRUE;

DROP VIEW IF EXISTS v_analyst_budget_summary CASCADE;
CREATE VIEW v_analyst_budget_summary AS
SELECT 
    g.id AS grant_id,
    u.id AS analyst_id,
    u.full_name AS analyst_name,
    u.email AS analyst_email,
    d.id AS dataset_id,
    d.name AS dataset_name,
    g.expires_at,
    g.is_active AS grant_active,
    b.id AS budget_id,
    b.total_epsilon,
    b.remaining_epsilon,
    (b.total_epsilon - b.remaining_epsilon) AS spent_epsilon,
    ROUND(((b.total_epsilon - b.remaining_epsilon) / NULLIF(b.total_epsilon, 0)) * 100, 2) AS budget_utilization_pct,
    b.updated_at AS last_budget_activity
FROM dataset_grants g
JOIN users u ON g.analyst_id = u.id
JOIN datasets d ON g.dataset_id = d.id
JOIN privacy_budgets b ON g.id = b.grant_id;

DROP VIEW IF EXISTS v_audit_summary_log CASCADE;
CREATE VIEW v_audit_summary_log AS

SELECT 
    a.id AS event_id,
    a.event_timestamp,
    a.event_type,
    a.outcome,
    u.email AS actor_email,
    u.full_name AS actor_name,
    a.resource_type,
    a.resource_id,
    a.client_ip,
    a.details
FROM audit_events a
LEFT JOIN users u ON a.actor_user_id = u.id
ORDER BY a.event_timestamp DESC;

-- 5. STORED PROCEDURE: fn_execute_bounded_aggregation
CREATE OR REPLACE FUNCTION fn_execute_bounded_aggregation(
    p_metric VARCHAR,
    p_column VARCHAR DEFAULT NULL,
    p_filters JSONB DEFAULT '[]'::jsonb,
    p_clamp_low NUMERIC DEFAULT 0,
    p_clamp_high NUMERIC DEFAULT 1000000000
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_agg_expr TEXT;
    v_where_clause TEXT := ' WHERE 1=1';
    v_filter JSONB;
    v_col TEXT;
    v_op TEXT;
    v_val TEXT;
    v_sql TEXT;
    v_result NUMERIC;
BEGIN
    IF p_metric = 'COUNT' THEN
        v_agg_expr := 'COUNT(*)';
    ELSIF p_metric = 'BOUNDED_SUM' THEN
        IF p_column IS NULL OR length(trim(p_column)) = 0 THEN
            RAISE EXCEPTION 'Column parameter is required for BOUNDED_SUM';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM dataset_columns 
            WHERE column_name = p_column AND is_identifier = FALSE AND is_aggregatable = TRUE
        ) THEN
            RAISE EXCEPTION 'Column % is invalid, non-aggregatable, or an identifier', p_column;
        END IF;
        v_agg_expr := format('SUM(LEAST(GREATEST(%I, %L::numeric), %L::numeric))', p_column, p_clamp_low, p_clamp_high);
    ELSIF p_metric = 'BOUNDED_AVG' THEN
        IF p_column IS NULL OR length(trim(p_column)) = 0 THEN
            RAISE EXCEPTION 'Column parameter is required for BOUNDED_AVG';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM dataset_columns 
            WHERE column_name = p_column AND is_identifier = FALSE AND is_aggregatable = TRUE
        ) THEN
            RAISE EXCEPTION 'Column % is invalid, non-aggregatable, or an identifier', p_column;
        END IF;
        v_agg_expr := format('AVG(LEAST(GREATEST(%I, %L::numeric), %L::numeric))', p_column, p_clamp_low, p_clamp_high);
    ELSE
        RAISE EXCEPTION 'Unsupported metric: %', p_metric;
    END IF;

    FOR v_filter IN SELECT * FROM jsonb_array_elements(p_filters)
    LOOP
        v_col := v_filter->>'column';
        v_op  := v_filter->>'operator';
        v_val := v_filter->>'value';

        IF NOT EXISTS (SELECT 1 FROM dataset_columns WHERE column_name = v_col) THEN
            RAISE EXCEPTION 'Filter column % does not exist in dataset schema', v_col;
        END IF;

        IF v_op = 'EQ' THEN
            v_where_clause := v_where_clause || format(' AND %I = %L', v_col, v_val);
        ELSIF v_op = 'NEQ' THEN
            v_where_clause := v_where_clause || format(' AND %I <> %L', v_col, v_val);
        ELSIF v_op = 'GT' THEN
            v_where_clause := v_where_clause || format(' AND %I > %L::numeric', v_col, v_val);
        ELSIF v_op = 'GTE' THEN
            v_where_clause := v_where_clause || format(' AND %I >= %L::numeric', v_col, v_val);
        ELSIF v_op = 'LT' THEN
            v_where_clause := v_where_clause || format(' AND %I < %L::numeric', v_col, v_val);
        ELSIF v_op = 'LTE' THEN
            v_where_clause := v_where_clause || format(' AND %I <= %L::numeric', v_col, v_val);
        END IF;
    END LOOP;

    v_sql := format('SELECT COALESCE(%s, 0)::numeric FROM protected_patients%s', v_agg_expr, v_where_clause);
    EXECUTE v_sql INTO v_result;

    RETURN COALESCE(v_result, 0);
END;
$$;

-- Grants to restricted app role
GRANT EXECUTE ON FUNCTION fn_reserve_privacy_budget(UUID, NUMERIC, UUID) TO privacyvault_app;
GRANT EXECUTE ON FUNCTION fn_refund_privacy_budget(UUID, NUMERIC, UUID) TO privacyvault_app;
GRANT EXECUTE ON FUNCTION fn_execute_bounded_aggregation(VARCHAR, VARCHAR, JSONB, NUMERIC, NUMERIC) TO privacyvault_app;
GRANT SELECT ON v_dataset_metadata_catalog TO privacyvault_app;
GRANT SELECT ON v_analyst_budget_summary TO privacyvault_app;
GRANT SELECT ON v_audit_summary_log TO privacyvault_app;
