-- REL-002 Phase 2D-0F artifact only. Never expose this role to the Railway runtime.
ALTER ROLE ai_mls_production_migration_operator
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

REVOKE ALL ON DATABASE postgres FROM ai_mls_production_migration_operator;
GRANT CONNECT ON DATABASE postgres TO ai_mls_production_migration_operator;
GRANT CREATE ON DATABASE postgres TO ai_mls_production_migration_operator;
