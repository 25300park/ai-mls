-- REL-002 Phase 2D-0K artifact. Execute only through the approved operator gate.
-- Authentication material is bound separately through an interactive secure channel.
CREATE ROLE ai_mls_production_runtime
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE ROLE ai_mls_production_migration_operator
  LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
