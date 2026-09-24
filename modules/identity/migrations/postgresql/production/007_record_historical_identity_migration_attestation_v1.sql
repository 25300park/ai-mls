-- DEC-193 one-time historical reconstruction. The controlled executor must
-- provide all three evidence references in this same PostgreSQL session.
-- No historical migration completion timestamp is accepted or manufactured.

DO $historical_attestation$
DECLARE
  operator_evidence_ref_value text := current_setting('ai_mls.operator_evidence_ref', true);
  backup_evidence_ref_value text := current_setting('ai_mls.backup_evidence_ref', true);
  schema_verification_evidence_ref_value text := current_setting('ai_mls.schema_verification_evidence_ref', true);
  mismatch_count integer;
  inserted_count integer;
BEGIN
  IF operator_evidence_ref_value IS NULL OR btrim(operator_evidence_ref_value) = ''
    OR length(operator_evidence_ref_value) > 512
    OR operator_evidence_ref_value <> btrim(operator_evidence_ref_value)
    OR operator_evidence_ref_value ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'operator evidence reference is required and must be well formed';
  END IF;
  IF backup_evidence_ref_value IS NULL OR btrim(backup_evidence_ref_value) = ''
    OR length(backup_evidence_ref_value) > 512
    OR backup_evidence_ref_value <> btrim(backup_evidence_ref_value)
    OR backup_evidence_ref_value ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'backup evidence reference is required and must be well formed';
  END IF;
  IF schema_verification_evidence_ref_value IS NULL OR btrim(schema_verification_evidence_ref_value) = ''
    OR length(schema_verification_evidence_ref_value) > 512
    OR schema_verification_evidence_ref_value <> btrim(schema_verification_evidence_ref_value)
    OR schema_verification_evidence_ref_value ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'schema verification evidence reference is required and must be well formed';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM app_identity.identity_schema_migrations
  WHERE migration_id = 'REL002-P2D0B-IDENTITY-PG-V1'
     OR (contract_id = 'identity.registered-service-workload' AND schema_version = 1 AND database_engine = 'POSTGRESQL');
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'historical migration attestation requires absent native ledger evidence';
  END IF;

  SELECT count(*) INTO mismatch_count FROM app_identity.identity_historical_migration_attestations;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'historical migration attestation ledger must be empty';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_class rel
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r'
    AND rel.relname IN (
      'identity_schema_contracts', 'identity_schema_migrations', 'identity_sessions',
      'identity_session_revocations', 'identity_registered_service_workloads',
      'identity_historical_migration_attestations'
    );
  IF mismatch_count <> 6 THEN RAISE EXCEPTION 'identity exact table verification failed'; END IF;

  SELECT count(*) INTO mismatch_count
  FROM app_identity.identity_schema_contracts
  WHERE (contract_id = 'identity.session' AND schema_version = 1 AND database_engine = 'POSTGRESQL'
      AND contract_fingerprint = 'fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7')
     OR (contract_id = 'identity.registered-service-workload' AND schema_version = 1 AND database_engine = 'POSTGRESQL'
      AND contract_fingerprint = '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82');
  IF mismatch_count <> 2 OR (SELECT count(*) FROM app_identity.identity_schema_contracts) <> 2 THEN
    RAISE EXCEPTION 'identity exact contract verification failed';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
  JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
  WHERE nsp.nspname = 'app_identity'
    AND proc.proname = 'identity_historical_attestation_schema_is_exact'
    AND lang.lanname = 'sql' AND proc.prorettype = 'boolean'::regtype
    AND proc.pronargs = 0 AND proc.provolatile = 's' AND NOT proc.prosecdef
    AND md5(upper(pg_catalog.regexp_replace(btrim(proc.prosrc), '\s+', ' ', 'g')))
      = '392f0ab48d4de10de66923de4372c2d3';
  IF mismatch_count <> 1
    OR app_identity.identity_historical_attestation_schema_is_exact() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'identity exact schema verification failed';
  END IF;

  INSERT INTO app_identity.identity_historical_migration_attestations (
    migration_id, artifact_checksum, contract_id, schema_version, database_engine,
    contract_fingerprint, target_environment, historical_applied_at,
    historical_applied_at_known, operator_evidence_ref, backup_evidence_ref,
    schema_verification_evidence_ref, reason, result
  ) VALUES (
    'REL002-P2D0B-IDENTITY-PG-V1',
    'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e',
    'identity.registered-service-workload', 1, 'POSTGRESQL',
    '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82',
    'PRODUCTION', NULL, FALSE, operator_evidence_ref_value, backup_evidence_ref_value,
    schema_verification_evidence_ref_value,
    'HISTORICAL_APPLIED_AT_UNRECOVERABLE', 'VERIFIED_EXISTING_SCHEMA'
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN RAISE EXCEPTION 'historical migration attestation insert count invalid'; END IF;
END;
$historical_attestation$ LANGUAGE plpgsql;
