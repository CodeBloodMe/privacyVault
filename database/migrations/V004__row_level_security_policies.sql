-- ============================================================================
-- PrivacyVault Migration V004: Row-Level Security (RLS) Policies
-- Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
-- Course: BCSE302P Database Systems Lab (Slot L25+L26)
-- Faculty: Dr. V. SIVAKUMAR
-- ============================================================================

-- 1. ROW-LEVEL SECURITY ON PROTECTED CLINICAL MICRODATA
ALTER TABLE protected_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE protected_patients FORCE ROW LEVEL SECURITY;

-- Policy A: Explicit Denial for Application Runtime Role
DROP POLICY IF EXISTS pol_protected_patients_runtime_deny ON protected_patients;
CREATE POLICY pol_protected_patients_runtime_deny ON protected_patients
    FOR ALL
    TO privacyvault_app
    USING (false)
    WITH CHECK (false);

-- Policy B: Administrative Owner & Security Definer Procedures Access
DROP POLICY IF EXISTS pol_protected_patients_admin_access ON protected_patients;
CREATE POLICY pol_protected_patients_admin_access ON protected_patients
    FOR ALL
    TO privacyvault_admin
    USING (true)
    WITH CHECK (true);

-- 2. ROW-LEVEL SECURITY ON QUERY REQUESTS
ALTER TABLE query_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pol_query_requests_admin ON query_requests;
CREATE POLICY pol_query_requests_admin ON query_requests
    FOR ALL
    TO privacyvault_admin
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS pol_query_requests_app ON query_requests;
CREATE POLICY pol_query_requests_app ON query_requests
    FOR ALL
    TO privacyvault_app
    USING (true)
    WITH CHECK (true);

COMMENT ON POLICY pol_protected_patients_runtime_deny ON protected_patients IS 
'Defense-in-depth: Prevents direct row inspection by privacyvault_app even if SELECT is granted [24BCE0846 & 24BCE0870]';
