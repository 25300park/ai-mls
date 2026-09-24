-- DEC-193 bounded schema amendment. This relation records only the explicitly
-- approved historical reconstruction for REL002-P2D0B-IDENTITY-PG-V1.
-- It does not replace app_identity.identity_schema_migrations.

CREATE TABLE app_identity.identity_historical_migration_attestations (
  migration_id text CONSTRAINT identity_historical_migration_attestations_pkey PRIMARY KEY,
  artifact_checksum text NOT NULL,
  contract_id text NOT NULL,
  schema_version integer NOT NULL
    CONSTRAINT identity_historical_migration_attestations_version_check CHECK (schema_version = 1),
  database_engine text NOT NULL
    CONSTRAINT identity_historical_migration_attestations_engine_check CHECK (database_engine = 'POSTGRESQL'),
  contract_fingerprint text NOT NULL,
  target_environment text NOT NULL
    CONSTRAINT identity_historical_migration_attestations_environment_check CHECK (target_environment = 'PRODUCTION'),
  historical_applied_at timestamptz,
  historical_applied_at_known boolean NOT NULL,
  evidence_recorded_at timestamptz NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  operator_evidence_ref text NOT NULL,
  backup_evidence_ref text NOT NULL,
  schema_verification_evidence_ref text NOT NULL,
  reason text NOT NULL
    CONSTRAINT identity_historical_migration_attestations_reason_check
      CHECK (reason = 'HISTORICAL_APPLIED_AT_UNRECOVERABLE'),
  result text NOT NULL
    CONSTRAINT identity_historical_migration_attestations_result_check
      CHECK (result = 'VERIFIED_EXISTING_SCHEMA'),
  CONSTRAINT identity_historical_attestations_exact_migration_check CHECK (
    migration_id = 'REL002-P2D0B-IDENTITY-PG-V1'
    AND artifact_checksum = 'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e'
    AND contract_id = 'identity.registered-service-workload'
    AND contract_fingerprint = '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82'
    AND historical_applied_at IS NULL
    AND NOT historical_applied_at_known
  ),
  CONSTRAINT identity_historical_migration_attestations_time_check CHECK (
    (historical_applied_at_known AND historical_applied_at IS NOT NULL)
    OR (NOT historical_applied_at_known AND historical_applied_at IS NULL)
  ),
  CONSTRAINT identity_historical_migration_attestations_operator_ref_check CHECK (
    length(operator_evidence_ref) BETWEEN 1 AND 512
    AND operator_evidence_ref = btrim(operator_evidence_ref)
    AND operator_evidence_ref !~ '[[:cntrl:]]'
  ),
  CONSTRAINT identity_historical_migration_attestations_backup_ref_check CHECK (
    length(backup_evidence_ref) BETWEEN 1 AND 512
    AND backup_evidence_ref = btrim(backup_evidence_ref)
    AND backup_evidence_ref !~ '[[:cntrl:]]'
  ),
  CONSTRAINT identity_historical_migration_attestations_schema_ref_check CHECK (
    length(schema_verification_evidence_ref) BETWEEN 1 AND 512
    AND schema_verification_evidence_ref = btrim(schema_verification_evidence_ref)
    AND schema_verification_evidence_ref !~ '[[:cntrl:]]'
  ),
  CONSTRAINT identity_historical_migration_attestations_contract_fkey
    FOREIGN KEY (contract_id, schema_version, database_engine)
    REFERENCES app_identity.identity_schema_contracts (contract_id, schema_version, database_engine)
);

CREATE FUNCTION app_identity.reject_historical_migration_attestation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'APPEND-ONLY HISTORICAL MIGRATION ATTESTATION';
END;
$$;

CREATE TRIGGER identity_historical_migration_attestations_no_update
BEFORE UPDATE ON app_identity.identity_historical_migration_attestations
FOR EACH STATEMENT EXECUTE FUNCTION app_identity.reject_historical_migration_attestation_mutation();

CREATE TRIGGER identity_historical_migration_attestations_no_delete
BEFORE DELETE ON app_identity.identity_historical_migration_attestations
FOR EACH STATEMENT EXECUTE FUNCTION app_identity.reject_historical_migration_attestation_mutation();

CREATE TRIGGER identity_historical_migration_attestations_no_truncate
BEFORE TRUNCATE ON app_identity.identity_historical_migration_attestations
FOR EACH STATEMENT EXECUTE FUNCTION app_identity.reject_historical_migration_attestation_mutation();

CREATE FUNCTION app_identity.identity_historical_attestation_schema_is_exact()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
WITH tables AS (
  SELECT md5(string_agg(rel.relname || ':' || rel.relkind::text, '|' ORDER BY rel.relname)) AS value
  FROM pg_catalog.pg_class rel
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r'
), columns AS (
  SELECT md5(string_agg(
    rel.relname || ':' || attr.attnum::text || ':' || attr.attname || ':'
      || pg_catalog.format_type(attr.atttypid, attr.atttypmod) || ':' || attr.attnotnull::text || ':'
      || coalesce(pg_catalog.pg_get_expr(def.adbin, def.adrelid), ''),
    '|' ORDER BY rel.relname, attr.attnum
  )) AS value
  FROM pg_catalog.pg_attribute attr
  JOIN pg_catalog.pg_class rel ON rel.oid = attr.attrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  LEFT JOIN pg_catalog.pg_attrdef def ON def.adrelid = attr.attrelid AND def.adnum = attr.attnum
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r'
    AND attr.attnum > 0 AND NOT attr.attisdropped
), constraints AS (
  SELECT md5(string_agg(
    rel.relname || ':' || con.conname || ':' || con.contype::text || ':'
      || pg_catalog.regexp_replace(replace(pg_catalog.pg_get_constraintdef(con.oid, true), '::text', ''), '\s+', '', 'g'),
    '|' ORDER BY rel.relname, con.conname
  )) AS value
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND con.contype <> 'n'
), indexes AS (
  SELECT md5(string_agg(
    rel.relname || ':' || idx.relname || ':'
      || pg_catalog.regexp_replace(pg_catalog.pg_get_indexdef(idx.oid), '\s+', ' ', 'g'),
    '|' ORDER BY rel.relname, idx.relname
  )) AS value
  FROM pg_catalog.pg_index ind
  JOIN pg_catalog.pg_class idx ON idx.oid = ind.indexrelid
  JOIN pg_catalog.pg_class rel ON rel.oid = ind.indrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity'
), triggers AS (
  SELECT md5(string_agg(
    rel.relname || ':' || trg.tgname || ':' || trg.tgtype::text || ':' || trg.tgenabled::text
      || ':' || proc_nsp.nspname || '.' || proc.proname,
    '|' ORDER BY rel.relname, trg.tgname
  )) AS value
  FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class rel ON rel.oid = trg.tgrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_catalog.pg_proc proc ON proc.oid = trg.tgfoid
  JOIN pg_catalog.pg_namespace proc_nsp ON proc_nsp.oid = proc.pronamespace
  WHERE nsp.nspname = 'app_identity' AND NOT trg.tgisinternal
), functions AS (
  SELECT md5(string_agg(
    proc.proname || ':' || lang.lanname || ':' || pg_catalog.format_type(proc.prorettype, NULL)
      || ':' || proc.pronargs::text || ':' || proc.provolatile::text || ':' || proc.prosecdef::text || ':'
      || upper(pg_catalog.regexp_replace(btrim(proc.prosrc), '\s+', ' ', 'g')),
    '|' ORDER BY proc.proname
  )) AS value
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
  JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
  WHERE nsp.nspname = 'app_identity'
    AND proc.proname IN ('reject_session_revocation_mutation', 'reject_historical_migration_attestation_mutation')
)
SELECT tables.value = '29f45b2248dc9c69757e35b221f5f134'
  AND columns.value = 'a87c5ded2c8c3e0aef14ddf6dfc4b523'
  AND constraints.value = 'b2ceba6a5cf499f47575b97a8fa367ba'
  AND indexes.value = '143fdde92a3fb952c09428419dc2299e'
  AND triggers.value = '3d85fd88c3455788678ab1219030a79a'
  AND functions.value = 'cbd4898686e28208299fdee08bfbf2fd'
FROM tables, columns, constraints, indexes, triggers, functions;
$$;

REVOKE ALL ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_identity.identity_historical_attestation_schema_is_exact()
TO ai_mls_production_runtime;

REVOKE ALL ON TABLE app_identity.identity_historical_migration_attestations
FROM ai_mls_production_runtime;
GRANT SELECT ON TABLE app_identity.identity_historical_migration_attestations
TO ai_mls_production_runtime;
