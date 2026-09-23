-- One-time ledger remediation for an already-applied, separately verified
-- REL002-P2D0B-IDENTITY-PG-V1 schema. The controlled executor must provide
-- these three session settings in the same PostgreSQL session:
--   ai_mls.operator_evidence_ref
--   ai_mls.backup_evidence_ref
--   ai_mls.migration_applied_at
-- This artifact must never be used as a substitute for 001 verification.

DO $ledger_repair$
DECLARE
  mismatch_count integer;
  inserted_count integer;
  operator_evidence_ref_value text := current_setting('ai_mls.operator_evidence_ref', true);
  backup_evidence_ref_value text := current_setting('ai_mls.backup_evidence_ref', true);
  migration_applied_at_raw text := current_setting('ai_mls.migration_applied_at', true);
  migration_applied_at_value timestamptz;
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

  IF migration_applied_at_raw IS NULL OR btrim(migration_applied_at_raw) = '' THEN
    RAISE EXCEPTION 'migration applied_at is required';
  END IF;
  IF migration_applied_at_raw !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' THEN
    RAISE EXCEPTION 'migration applied_at is invalid';
  END IF;
  BEGIN
    migration_applied_at_value := migration_applied_at_raw::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'migration applied_at is invalid';
  END;
  IF NOT isfinite(migration_applied_at_value) THEN
    RAISE EXCEPTION 'migration applied_at is invalid';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_class rel
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r';
  IF mismatch_count <> 5 THEN
    RAISE EXCEPTION 'identity table inventory verification failed';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_class rel
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r' AND rel.relname IN (
    'identity_schema_contracts', 'identity_schema_migrations', 'identity_sessions',
    'identity_session_revocations', 'identity_registered_service_workloads');
  IF mismatch_count <> 5 THEN
    RAISE EXCEPTION 'identity required table verification failed';
  END IF;

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
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND con.contype = 'c';
  IF mismatch_count <> 15 THEN
    RAISE EXCEPTION 'identity check constraint inventory verification failed';
  END IF;

  WITH expected(table_name, name, expression) AS (VALUES
    ('identity_schema_contracts','identity_schema_contracts_version_check','SCHEMA_VERSION>=1'),('identity_schema_contracts','identity_schema_contracts_engine_check','DATABASE_ENGINE=''POSTGRESQL'''),
    ('identity_schema_migrations','identity_schema_migrations_version_check','SCHEMA_VERSION>=1'),('identity_schema_migrations','identity_schema_migrations_engine_check','DATABASE_ENGINE=''POSTGRESQL'''),
    ('identity_schema_migrations','identity_schema_migrations_environment_check','TARGET_ENVIRONMENT=''PRODUCTION'''),('identity_schema_migrations','identity_schema_migrations_result_check','RESULT=''APPLIED'''),
    ('identity_sessions','identity_sessions_version_check','SESSION_VERSION>=1ANDSESSION_VERSION<=''9007199254740991'''),('identity_sessions','identity_sessions_state_check','STATE=ANYARRAY[''ACTIVE'',''REVOKED'',''EXPIRED'']'),
    ('identity_sessions','identity_sessions_chronology_check','UPDATED_AT>=CREATED_AT'),('identity_session_revocations','identity_session_revocations_version_check','SESSION_VERSION>=1ANDSESSION_VERSION<=''9007199254740991'''),
    ('identity_registered_service_workloads','identity_registered_service_workloads_principal_type_check','PRINCIPAL_TYPE=''SERVICE'''),('identity_registered_service_workloads','identity_registered_service_workloads_assurance_check','ASSURANCE=''WORKLOAD'''),
    ('identity_registered_service_workloads','identity_registered_service_workloads_environment_check','ENVIRONMENT=''PRODUCTION'''),('identity_registered_service_workloads','identity_registered_service_workloads_status_check','STATUS=ANYARRAY[''ACTIVE'',''SUSPENDED'',''REVOKED'']'),
    ('identity_registered_service_workloads','identity_registered_service_workloads_version_check','REGISTRATION_VERSION>=1ANDREGISTRATION_VERSION<=''9007199254740991''')
  ), actual AS (
    SELECT rel.relname AS table_name, con.conname AS name,
      upper(regexp_replace(regexp_replace(pg_catalog.pg_get_expr(con.conbin, con.conrelid),'::(text|bigint|integer)','','g'),'[()[:space:]]','','g')) AS expression
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'app_identity' AND con.contype = 'c'
  )
  SELECT count(*) INTO mismatch_count
  FROM expected FULL JOIN actual USING (table_name, name)
  WHERE expected.name IS NULL OR actual.name IS NULL OR expected.expression <> actual.expression;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'identity check constraint verification failed';
  END IF;

  SELECT count(*) INTO mismatch_count
  FROM app_identity.identity_schema_migrations;
  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION 'migration ledger must be empty before repair';
  END IF;

  INSERT INTO app_identity.identity_schema_migrations (
    migration_id, artifact_checksum, contract_id, schema_version, database_engine,
    contract_fingerprint, target_environment, operator_evidence_ref,
    backup_evidence_ref, applied_at, result
  ) VALUES (
    'REL002-P2D0B-IDENTITY-PG-V1',
    'b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e',
    'identity.registered-service-workload', 1, 'POSTGRESQL',
    '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82',
    'PRODUCTION', operator_evidence_ref_value, backup_evidence_ref_value,
    migration_applied_at_value, 'APPLIED'
  );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  IF inserted_count <> 1 THEN
    RAISE EXCEPTION 'migration ledger repair did not insert exactly one row';
  END IF;
END;
$ledger_repair$ LANGUAGE plpgsql;
