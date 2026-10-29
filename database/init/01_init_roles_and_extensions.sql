-- ============================================================================
-- PrivacyVault — Database Initialization Script 01: Extensions & Roles
-- Student Authors: KRISH (24BCE0846) & PARV (24BCE0870)
-- Course: BCSE302P Database Systems Lab (Slot L25+L26)
-- Faculty: Dr. V. SIVAKUMAR
-- ============================================================================

-- Enable required cryptographic and UUID generation extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create restricted runtime application role if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'privacyvault_app') THEN
      CREATE ROLE privacyvault_app WITH LOGIN PASSWORD 'AppRuntimeSecurePass2026!';
   END IF;
END
$do$;

-- Revoke default public schema creation privileges from public
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO privacyvault_app;

COMMENT ON ROLE privacyvault_app IS 'Restricted runtime application role for PrivacyVault backend gateway [Authors: KRISH (24BCE0846) & PARV (24BCE0870)]';
