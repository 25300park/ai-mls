-- R3-G1B: controlled administrative boundary only. No password or role membership.
-- Separate explicit approval required for Production execution.
BEGIN;
DO $$ BEGIN
  IF current_user <> 'postgres' OR session_user <> current_user
    OR current_database() <> 'postgres' THEN RAISE EXCEPTION 'REGISTRATION_ADMIN_BOUNDARY_REQUIRED'; END IF;
END $$;
CREATE ROLE ai_mls_production_registration_operator
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE postgres TO ai_mls_production_registration_operator;
COMMIT;
