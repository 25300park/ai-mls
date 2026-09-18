-- REL002-P2A-IDENTITY-RSW-V1
-- Execute only through the controlled Production migration process.
-- The executor must append the matching identity_schema_migrations record in
-- the same transaction after this artifact succeeds. This artifact seeds no
-- registered identity and contains no runtime auto-create path.

CREATE TABLE IF NOT EXISTS identity_schema_contracts (
  contract_id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  contract_fingerprint TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identity_schema_migrations (
  migration_id TEXT PRIMARY KEY NOT NULL,
  artifact_checksum TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  contract_fingerprint TEXT NOT NULL,
  target_environment TEXT NOT NULL CHECK (target_environment = 'PRODUCTION'),
  change_evidence_ref TEXT NOT NULL,
  operator_evidence_ref TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result = 'APPLIED'),
  UNIQUE (contract_id, schema_version)
);

CREATE TABLE identity_registered_service_workloads (
  registration_id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  principal_type TEXT NOT NULL CHECK (principal_type = 'SERVICE'),
  assurance TEXT NOT NULL CHECK (assurance = 'WORKLOAD'),
  environment TEXT NOT NULL CHECK (environment = 'PRODUCTION'),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  workload_purpose TEXT NOT NULL,
  audience TEXT NOT NULL,
  registration_version INTEGER NOT NULL CHECK (registration_version >= 1),
  identity_evidence_ref TEXT NOT NULL,
  audit_evidence_ref TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, principal_id)
);

CREATE INDEX identity_registered_service_workloads_tenant_status_idx
  ON identity_registered_service_workloads (tenant_id, status);

INSERT INTO identity_schema_contracts (
  contract_id,
  schema_version,
  contract_fingerprint
)
SELECT
  'identity.registered-service-workload',
  1,
  '6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b'
WHERE NOT EXISTS (
  SELECT 1
  FROM identity_schema_contracts
  WHERE contract_id = 'identity.registered-service-workload'
);
