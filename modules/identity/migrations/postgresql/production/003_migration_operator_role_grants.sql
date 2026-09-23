-- REL-002 Phase 2D-0F grant-only artifact. Role attributes are owned by 000_production_role_creation.sql.
-- Never expose this role to the Railway runtime.

REVOKE ALL ON DATABASE postgres FROM ai_mls_production_migration_operator;
GRANT CONNECT ON DATABASE postgres TO ai_mls_production_migration_operator;
GRANT CREATE ON DATABASE postgres TO ai_mls_production_migration_operator;
