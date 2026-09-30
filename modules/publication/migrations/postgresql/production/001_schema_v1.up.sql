BEGIN;

DO $$
BEGIN
  IF current_user <> 'ai_mls_production_migration_operator' THEN
    RAISE EXCEPTION 'REL002_R3B1_MIGRATION_OPERATOR_REQUIRED';
  END IF;
  IF to_regnamespace('app_publication') IS NOT NULL THEN
    RAISE EXCEPTION 'REL002_R3B1_PUBLICATION_SCHEMA_ALREADY_EXISTS';
  END IF;
END $$;

CREATE SCHEMA app_publication AUTHORIZATION ai_mls_production_migration_operator;
COMMENT ON SCHEMA app_publication IS 'REL002-R3B1-PUBLICATION-V1|schema_version=1|contract_fingerprint=pub-v1-8-tables';
CREATE TABLE app_publication.publication_schema (singleton_id integer PRIMARY KEY CHECK (singleton_id = 1), schema_version bigint NOT NULL CHECK (schema_version = 1), contract_fingerprint text NOT NULL CHECK (contract_fingerprint = 'pub-v1-8-tables'));
CREATE TABLE app_publication.publication_scopes (tenant_scope_id text NOT NULL, publication_id text NOT NULL, revision bigint NOT NULL CHECK (revision >= 0 AND revision <= 9007199254740991), record_json jsonb, history_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, publication_id));
CREATE TABLE app_publication.publication_idempotency (tenant_scope_id text NOT NULL, publication_id text NOT NULL, command_key text NOT NULL, payload_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, publication_id, command_key), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES app_publication.publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE app_publication.publication_audit (id text PRIMARY KEY, tenant_scope_id text NOT NULL, publication_id text NOT NULL, payload_json jsonb NOT NULL, FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES app_publication.publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE app_publication.publication_events (tenant_scope_id text NOT NULL, publication_id text NOT NULL, event_id text NOT NULL, payload_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, event_id), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES app_publication.publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE app_publication.publication_execution_intents (tenant_scope_id text NOT NULL, publication_id text NOT NULL, command_id text NOT NULL, payload_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, publication_id, command_id), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES app_publication.publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE app_publication.publication_dispatch_events (tenant_scope_id text NOT NULL, publication_id text NOT NULL, command_id text NOT NULL, sequence bigint NOT NULL CHECK (sequence > 0 AND sequence <= 9007199254740991), payload_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, publication_id, command_id, sequence), FOREIGN KEY (tenant_scope_id, publication_id, command_id) REFERENCES app_publication.publication_execution_intents (tenant_scope_id, publication_id, command_id));
CREATE TABLE app_publication.publication_execution_receipts (tenant_scope_id text NOT NULL, publication_id text NOT NULL, command_id text NOT NULL, receipt_id text NOT NULL UNIQUE, payload_json jsonb NOT NULL, PRIMARY KEY (tenant_scope_id, publication_id, command_id), FOREIGN KEY (tenant_scope_id, publication_id, command_id) REFERENCES app_publication.publication_execution_intents (tenant_scope_id, publication_id, command_id));
CREATE FUNCTION app_publication.reject_append_only_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only' USING ERRCODE='55000'; END $$;
CREATE TRIGGER publication_idempotency_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_idempotency FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
CREATE TRIGGER publication_audit_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_audit FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
CREATE TRIGGER publication_events_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_events FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
CREATE TRIGGER publication_execution_intents_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_execution_intents FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
CREATE TRIGGER publication_dispatch_events_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_dispatch_events FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
CREATE TRIGGER publication_execution_receipts_append_only BEFORE UPDATE OR DELETE ON app_publication.publication_execution_receipts FOR EACH ROW EXECUTE FUNCTION app_publication.reject_append_only_mutation();
INSERT INTO app_publication.publication_schema VALUES (1, 1, 'pub-v1-8-tables');
COMMIT;
