-- ============================================================================
-- PrivacyVault — Database Migration V005: Disallow Identifier Filters
-- Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
-- Course: BCSE302P Database Systems Lab (Slot L25+L26)
-- Faculty Guide: Dr. V. SIVAKUMAR
-- ============================================================================

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
    -- 1. Validate metric
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

    -- 2. Build parameterized WHERE clause from JSON filters
    FOR v_filter IN SELECT * FROM jsonb_array_elements(p_filters)
    LOOP
        v_col := v_filter->>'column';
        v_op  := v_filter->>'operator';
        v_val := v_filter->>'value';

        IF NOT EXISTS (SELECT 1 FROM dataset_columns WHERE column_name = v_col) THEN
            RAISE EXCEPTION 'Filter column % does not exist in dataset schema', v_col;
        END IF;

        IF EXISTS (SELECT 1 FROM dataset_columns WHERE column_name = v_col AND is_identifier = TRUE) THEN
            RAISE EXCEPTION 'Security Violation: Direct identifier % cannot be used in filter predicates', v_col;
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

    -- 3. Execute bounded aggregation securely
    v_sql := format('SELECT COALESCE(%s, 0)::numeric FROM protected_patients%s', v_agg_expr, v_where_clause);
    EXECUTE v_sql INTO v_result;

    RETURN COALESCE(v_result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION fn_execute_bounded_aggregation(VARCHAR, VARCHAR, JSONB, NUMERIC, NUMERIC) TO privacyvault_app;
