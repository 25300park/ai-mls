-- REL-002 Phase 2D-0F artifact only. Execute only through a separately approved operator gate.
ALTER ROLE ai_mls_production_runtime
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON DATABASE postgres FROM ai_mls_production_runtime;
GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime;

REVOKE ALL ON SCHEMA app_identity FROM ai_mls_production_runtime;
REVOKE CREATE ON SCHEMA app_identity FROM ai_mls_production_runtime;
GRANT USAGE ON SCHEMA app_identity TO ai_mls_production_runtime;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA app_identity
FROM ai_mls_production_runtime;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app_identity
FROM ai_mls_production_runtime;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app_identity
FROM ai_mls_production_runtime;

GRANT SELECT ON TABLE
  app_identity.identity_schema_contracts,
  app_identity.identity_schema_migrations,
  app_identity.identity_registered_service_workloads
TO ai_mls_production_runtime;

GRANT SELECT, INSERT, UPDATE ON TABLE app_identity.identity_sessions
TO ai_mls_production_runtime;

GRANT INSERT ON TABLE app_identity.identity_session_revocations
TO ai_mls_production_runtime;
