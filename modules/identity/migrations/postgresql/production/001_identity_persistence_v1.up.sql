CREATE SCHEMA app_identity;

CREATE TABLE app_identity.identity_schema_contracts (
  contract_id text NOT NULL,
  schema_version integer NOT NULL CONSTRAINT identity_schema_contracts_version_check CHECK (schema_version >= 1),
  database_engine text NOT NULL CONSTRAINT identity_schema_contracts_engine_check CHECK (database_engine = 'POSTGRESQL'),
  contract_fingerprint text NOT NULL,
  recorded_at timestamptz NOT NULL,
  CONSTRAINT identity_schema_contracts_pkey PRIMARY KEY (contract_id, schema_version, database_engine)
);

CREATE TABLE app_identity.identity_schema_migrations (
  migration_id text CONSTRAINT identity_schema_migrations_pkey PRIMARY KEY,
  artifact_checksum text NOT NULL,
  contract_id text NOT NULL,
  schema_version integer NOT NULL CONSTRAINT identity_schema_migrations_version_check CHECK (schema_version >= 1),
  database_engine text NOT NULL CONSTRAINT identity_schema_migrations_engine_check CHECK (database_engine = 'POSTGRESQL'),
  contract_fingerprint text NOT NULL,
  target_environment text NOT NULL CONSTRAINT identity_schema_migrations_environment_check CHECK (target_environment = 'PRODUCTION'),
  operator_evidence_ref text NOT NULL,
  backup_evidence_ref text NOT NULL,
  applied_at timestamptz NOT NULL,
  result text NOT NULL CONSTRAINT identity_schema_migrations_result_check CHECK (result = 'APPLIED'),
  CONSTRAINT identity_schema_migrations_contract_key UNIQUE (contract_id, schema_version, database_engine),
  CONSTRAINT identity_schema_migrations_contract_fkey FOREIGN KEY (contract_id, schema_version, database_engine)
    REFERENCES app_identity.identity_schema_contracts (contract_id, schema_version, database_engine)
);

CREATE TABLE app_identity.identity_sessions (
  session_id text CONSTRAINT identity_sessions_pkey PRIMARY KEY,
  session_version bigint NOT NULL CONSTRAINT identity_sessions_version_check CHECK (session_version BETWEEN 1 AND 9007199254740991),
  state text NOT NULL CONSTRAINT identity_sessions_state_check CHECK (state IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL CONSTRAINT identity_sessions_chronology_check CHECK (updated_at >= created_at)
);

CREATE INDEX identity_sessions_family_idx
  ON app_identity.identity_sessions (((payload_json ->> 'familyId')), session_id);

CREATE INDEX identity_sessions_state_updated_idx
  ON app_identity.identity_sessions (state, updated_at, session_id);

CREATE TABLE app_identity.identity_session_revocations (
  session_id text NOT NULL,
  session_version bigint NOT NULL CONSTRAINT identity_session_revocations_version_check CHECK (session_version BETWEEN 1 AND 9007199254740991),
  revoked_at timestamptz NOT NULL,
  reason text NOT NULL,
  identity_evidence_ref text NOT NULL,
  audit_evidence_ref text NOT NULL,
  CONSTRAINT identity_session_revocations_pkey PRIMARY KEY (session_id, session_version),
  CONSTRAINT identity_session_revocations_session_fkey FOREIGN KEY (session_id)
    REFERENCES app_identity.identity_sessions (session_id)
);

CREATE FUNCTION app_identity.reject_session_revocation_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only revocation'; END; $$;

CREATE TRIGGER identity_session_revocations_no_update
BEFORE UPDATE ON app_identity.identity_session_revocations
FOR EACH ROW EXECUTE FUNCTION app_identity.reject_session_revocation_mutation();

CREATE TRIGGER identity_session_revocations_no_delete
BEFORE DELETE ON app_identity.identity_session_revocations
FOR EACH ROW EXECUTE FUNCTION app_identity.reject_session_revocation_mutation();

CREATE TABLE app_identity.identity_registered_service_workloads (
  registration_id text CONSTRAINT identity_registered_service_workloads_pkey PRIMARY KEY,
  tenant_id text NOT NULL,
  principal_id text NOT NULL,
  principal_type text NOT NULL CONSTRAINT identity_registered_service_workloads_principal_type_check CHECK (principal_type = 'SERVICE'),
  assurance text NOT NULL CONSTRAINT identity_registered_service_workloads_assurance_check CHECK (assurance = 'WORKLOAD'),
  environment text NOT NULL CONSTRAINT identity_registered_service_workloads_environment_check CHECK (environment = 'PRODUCTION'),
  status text NOT NULL CONSTRAINT identity_registered_service_workloads_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  workload_purpose text NOT NULL,
  audience text NOT NULL,
  registration_version bigint NOT NULL CONSTRAINT identity_registered_service_workloads_version_check CHECK (registration_version BETWEEN 1 AND 9007199254740991),
  identity_evidence_ref text NOT NULL,
  audit_evidence_ref text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT identity_registered_service_workloads_tenant_principal_key UNIQUE (tenant_id, principal_id)
);

CREATE INDEX identity_registered_service_workloads_tenant_status_idx
  ON app_identity.identity_registered_service_workloads (tenant_id, status);

INSERT INTO app_identity.identity_schema_contracts
  (contract_id, schema_version, database_engine, contract_fingerprint, recorded_at)
VALUES
  ('identity.session', 1, 'POSTGRESQL', 'fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7', CURRENT_TIMESTAMP),
  ('identity.registered-service-workload', 1, 'POSTGRESQL', '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82', CURRENT_TIMESTAMP);
