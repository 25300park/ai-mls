-- Read-only provenance verifier. Exactly one provenance path may satisfy
-- readiness; native ledger evidence always takes precedence.

DO $historical_attestation_verify$
DECLARE
  native_count integer;
  attestation_count integer;
  exact_verifier_count integer;
BEGIN
  SELECT count(*) INTO exact_verifier_count
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
  JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
  WHERE nsp.nspname = 'app_identity'
    AND proc.proname = 'identity_historical_attestation_schema_is_exact'
    AND lang.lanname = 'sql' AND proc.prorettype = 'boolean'::regtype
    AND proc.pronargs = 0 AND proc.provolatile = 's' AND NOT proc.prosecdef
    AND md5(upper(pg_catalog.regexp_replace(btrim(proc.prosrc), '\s+', ' ', 'g')))
      = '392f0ab48d4de10de66923de4372c2d3';
  IF exact_verifier_count <> 1
    OR app_identity.identity_historical_attestation_schema_is_exact() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'historical attestation exact schema verification failed';
  END IF;

  SELECT count(*) INTO native_count
  FROM app_identity.identity_schema_migrations
  WHERE migration_id = 'REL002-P2D0B-IDENTITY-PG-V1'
    AND artifact_checksum = 'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e'
    AND contract_id = 'identity.registered-service-workload'
    AND schema_version = 1 AND database_engine = 'POSTGRESQL'
    AND contract_fingerprint = '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82'
    AND target_environment = 'PRODUCTION' AND result = 'APPLIED';

  SELECT count(*) INTO attestation_count
  FROM app_identity.identity_historical_migration_attestations
  WHERE migration_id = 'REL002-P2D0B-IDENTITY-PG-V1'
    AND artifact_checksum = 'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e'
    AND contract_id = 'identity.registered-service-workload'
    AND schema_version = 1 AND database_engine = 'POSTGRESQL'
    AND contract_fingerprint = '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82'
    AND target_environment = 'PRODUCTION'
    AND historical_applied_at IS NULL AND historical_applied_at_known = FALSE
    AND evidence_recorded_at IS NOT NULL
    AND length(operator_evidence_ref) BETWEEN 1 AND 512
    AND length(backup_evidence_ref) BETWEEN 1 AND 512
    AND length(schema_verification_evidence_ref) BETWEEN 1 AND 512
    AND reason = 'HISTORICAL_APPLIED_AT_UNRECOVERABLE'
    AND result = 'VERIFIED_EXISTING_SCHEMA';

  IF native_count > 0 AND EXISTS (SELECT 1 FROM app_identity.identity_historical_migration_attestations) THEN
    RAISE EXCEPTION 'native ledger and historical attestation conflict';
  END IF;
  IF native_count = 1 AND (SELECT count(*) FROM app_identity.identity_schema_migrations) = 1 THEN
    RETURN; -- NATIVE_MIGRATION_LEDGER_VERIFIED
  END IF;
  IF native_count = 0 AND attestation_count = 1
    AND (SELECT count(*) FROM app_identity.identity_schema_migrations) = 0
    AND (SELECT count(*) FROM app_identity.identity_historical_migration_attestations) = 1 THEN
    RETURN; -- HISTORICAL_MIGRATION_ATTESTATION_VERIFIED
  END IF;
  RAISE EXCEPTION 'historical attestation verification failed';
END;
$historical_attestation_verify$ LANGUAGE plpgsql;

SELECT CASE
  WHEN EXISTS (SELECT 1 FROM app_identity.identity_schema_migrations)
    THEN 'NATIVE_MIGRATION_LEDGER_VERIFIED'
  ELSE 'HISTORICAL_MIGRATION_ATTESTATION_VERIFIED'
END AS readiness_provenance;
