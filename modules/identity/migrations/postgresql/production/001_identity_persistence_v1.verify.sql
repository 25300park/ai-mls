DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_class rel JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r';
  IF mismatch_count <> 5 THEN RAISE EXCEPTION 'identity table inventory verification failed'; END IF;

  SELECT count(*) INTO mismatch_count
  FROM pg_catalog.pg_class rel JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r' AND rel.relname IN (
    'identity_schema_contracts', 'identity_schema_migrations', 'identity_sessions',
    'identity_session_revocations', 'identity_registered_service_workloads');
  IF mismatch_count <> 5 THEN RAISE EXCEPTION 'identity required table verification failed'; END IF;

  WITH expected(table_name, ordinal_position, column_name, data_type) AS (VALUES
    ('identity_schema_contracts',1,'contract_id','text'),('identity_schema_contracts',2,'schema_version','integer'),('identity_schema_contracts',3,'database_engine','text'),('identity_schema_contracts',4,'contract_fingerprint','text'),('identity_schema_contracts',5,'recorded_at','timestamp with time zone'),
    ('identity_schema_migrations',1,'migration_id','text'),('identity_schema_migrations',2,'artifact_checksum','text'),('identity_schema_migrations',3,'contract_id','text'),('identity_schema_migrations',4,'schema_version','integer'),('identity_schema_migrations',5,'database_engine','text'),('identity_schema_migrations',6,'contract_fingerprint','text'),('identity_schema_migrations',7,'target_environment','text'),('identity_schema_migrations',8,'operator_evidence_ref','text'),('identity_schema_migrations',9,'backup_evidence_ref','text'),('identity_schema_migrations',10,'applied_at','timestamp with time zone'),('identity_schema_migrations',11,'result','text'),
    ('identity_sessions',1,'session_id','text'),('identity_sessions',2,'session_version','bigint'),('identity_sessions',3,'state','text'),('identity_sessions',4,'payload_json','jsonb'),('identity_sessions',5,'created_at','timestamp with time zone'),('identity_sessions',6,'updated_at','timestamp with time zone'),
    ('identity_session_revocations',1,'session_id','text'),('identity_session_revocations',2,'session_version','bigint'),('identity_session_revocations',3,'revoked_at','timestamp with time zone'),('identity_session_revocations',4,'reason','text'),('identity_session_revocations',5,'identity_evidence_ref','text'),('identity_session_revocations',6,'audit_evidence_ref','text'),
    ('identity_registered_service_workloads',1,'registration_id','text'),('identity_registered_service_workloads',2,'tenant_id','text'),('identity_registered_service_workloads',3,'principal_id','text'),('identity_registered_service_workloads',4,'principal_type','text'),('identity_registered_service_workloads',5,'assurance','text'),('identity_registered_service_workloads',6,'environment','text'),('identity_registered_service_workloads',7,'status','text'),('identity_registered_service_workloads',8,'workload_purpose','text'),('identity_registered_service_workloads',9,'audience','text'),('identity_registered_service_workloads',10,'registration_version','bigint'),('identity_registered_service_workloads',11,'identity_evidence_ref','text'),('identity_registered_service_workloads',12,'audit_evidence_ref','text'),('identity_registered_service_workloads',13,'created_at','timestamp with time zone'),('identity_registered_service_workloads',14,'updated_at','timestamp with time zone')
  ), actual AS (
    SELECT rel.relname AS table_name, attr.attnum::integer AS ordinal_position, attr.attname AS column_name,
      pg_catalog.format_type(attr.atttypid, attr.atttypmod) AS data_type, attr.attnotnull,
      attr.attgenerated, pg_catalog.pg_get_expr(def.adbin, def.adrelid) AS default_expression
    FROM pg_catalog.pg_attribute attr JOIN pg_catalog.pg_class rel ON rel.oid = attr.attrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef def ON def.adrelid = attr.attrelid AND def.adnum = attr.attnum
    WHERE nsp.nspname = 'app_identity' AND rel.relkind = 'r' AND attr.attnum > 0 AND NOT attr.attisdropped
  )
  SELECT count(*) INTO mismatch_count FROM expected FULL JOIN actual USING (table_name, ordinal_position)
  WHERE expected.table_name IS NULL OR actual.table_name IS NULL OR expected.column_name <> actual.column_name
    OR expected.data_type <> actual.data_type OR NOT actual.attnotnull OR actual.attgenerated <> '' OR actual.default_expression IS NOT NULL;
  IF mismatch_count <> 0 THEN RAISE EXCEPTION 'identity exact column verification failed'; END IF;

  SELECT count(*) INTO mismatch_count FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity';
  IF mismatch_count <> 24 THEN RAISE EXCEPTION 'identity constraint inventory verification failed'; END IF;

  WITH expected(table_name, name, definition) AS (VALUES
    ('identity_schema_contracts','identity_schema_contracts_pkey','PRIMARY KEY (contract_id, schema_version, database_engine)'),
    ('identity_schema_migrations','identity_schema_migrations_pkey','PRIMARY KEY (migration_id)'),
    ('identity_schema_migrations','identity_schema_migrations_contract_key','UNIQUE (contract_id, schema_version, database_engine)'),
    ('identity_schema_migrations','identity_schema_migrations_contract_fkey','FOREIGN KEY (contract_id, schema_version, database_engine) REFERENCES app_identity.identity_schema_contracts(contract_id, schema_version, database_engine)'),
    ('identity_sessions','identity_sessions_pkey','PRIMARY KEY (session_id)'),
    ('identity_session_revocations','identity_session_revocations_pkey','PRIMARY KEY (session_id, session_version)'),
    ('identity_session_revocations','identity_session_revocations_session_fkey','FOREIGN KEY (session_id) REFERENCES app_identity.identity_sessions(session_id)'),
    ('identity_registered_service_workloads','identity_registered_service_workloads_pkey','PRIMARY KEY (registration_id)'),
    ('identity_registered_service_workloads','identity_registered_service_workloads_tenant_principal_key','UNIQUE (tenant_id, principal_id)')
  ), actual AS (
    SELECT rel.relname AS table_name, con.conname AS name, pg_catalog.pg_get_constraintdef(con.oid, true) AS definition
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace WHERE nsp.nspname = 'app_identity' AND con.contype IN ('p','u','f')
      AND (con.contype <> 'f' OR (con.confdeltype = 'a' AND con.confupdtype = 'a' AND con.confmatchtype = 's'))
  )
  SELECT count(*) INTO mismatch_count FROM expected FULL JOIN actual USING (table_name, name)
  WHERE expected.name IS NULL OR actual.name IS NULL OR expected.definition <> actual.definition;
  IF mismatch_count <> 0 THEN RAISE EXCEPTION 'identity key constraint verification failed'; END IF;

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
    SELECT rel.relname AS table_name, con.conname AS name, upper(regexp_replace(regexp_replace(pg_catalog.pg_get_expr(con.conbin, con.conrelid),'::(text|bigint|integer)','','g'),'[()[:space:]]','','g')) AS expression
    FROM pg_catalog.pg_constraint con JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace WHERE nsp.nspname = 'app_identity' AND con.contype = 'c'
  )
  SELECT count(*) INTO mismatch_count FROM expected FULL JOIN actual USING (table_name, name)
  WHERE expected.name IS NULL OR actual.name IS NULL OR expected.expression <> actual.expression;
  IF mismatch_count <> 0 THEN RAISE EXCEPTION 'identity check constraint verification failed'; END IF;

  WITH expected(table_name, name, is_unique, is_primary, keys) AS (VALUES
    ('identity_schema_contracts','identity_schema_contracts_pkey',true,true,'CONTRACT_ID|SCHEMA_VERSION|DATABASE_ENGINE'),('identity_schema_migrations','identity_schema_migrations_pkey',true,true,'MIGRATION_ID'),
    ('identity_schema_migrations','identity_schema_migrations_contract_key',true,false,'CONTRACT_ID|SCHEMA_VERSION|DATABASE_ENGINE'),('identity_sessions','identity_sessions_pkey',true,true,'SESSION_ID'),
    ('identity_sessions','identity_sessions_family_idx',false,false,'PAYLOAD_JSON->>''FAMILYID''|SESSION_ID'),('identity_sessions','identity_sessions_state_updated_idx',false,false,'STATE|UPDATED_AT|SESSION_ID'),
    ('identity_session_revocations','identity_session_revocations_pkey',true,true,'SESSION_ID|SESSION_VERSION'),('identity_registered_service_workloads','identity_registered_service_workloads_pkey',true,true,'REGISTRATION_ID'),
    ('identity_registered_service_workloads','identity_registered_service_workloads_tenant_principal_key',true,false,'TENANT_ID|PRINCIPAL_ID'),('identity_registered_service_workloads','identity_registered_service_workloads_tenant_status_idx',false,false,'TENANT_ID|STATUS')
  ), actual AS (
    SELECT rel.relname AS table_name, idx.relname AS name, ind.indisunique AS is_unique, ind.indisprimary AS is_primary,
      upper(regexp_replace(regexp_replace(pg_catalog.string_agg(pg_catalog.pg_get_indexdef(ind.indexrelid, pos, true),'|' ORDER BY pos),'::text','','g'),'[()[:space:]]','','g')) AS keys,
      ind.indisvalid, ind.indpred IS NOT NULL AS is_partial
    FROM pg_catalog.pg_index ind JOIN pg_catalog.pg_class idx ON idx.oid = ind.indexrelid
    JOIN pg_catalog.pg_class rel ON rel.oid = ind.indrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
    CROSS JOIN LATERAL pg_catalog.generate_series(1, ind.indnkeyatts) pos
    WHERE nsp.nspname = 'app_identity' GROUP BY rel.relname, idx.relname, ind.indisunique, ind.indisprimary, ind.indisvalid, ind.indpred
  )
  SELECT count(*) INTO mismatch_count FROM expected FULL JOIN actual USING (table_name, name)
  WHERE expected.name IS NULL OR actual.name IS NULL OR expected.is_unique <> actual.is_unique OR expected.is_primary <> actual.is_primary
    OR expected.keys <> actual.keys OR NOT actual.indisvalid OR actual.is_partial;
  IF mismatch_count <> 0 THEN RAISE EXCEPTION 'identity exact index verification failed'; END IF;

  SELECT count(*) INTO mismatch_count FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class rel ON rel.oid = trg.tgrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND NOT trg.tgisinternal;
  IF mismatch_count <> 2 THEN RAISE EXCEPTION 'identity trigger inventory verification failed'; END IF;

  SELECT count(*) INTO mismatch_count FROM pg_catalog.pg_trigger trg
  JOIN pg_catalog.pg_class rel ON rel.oid = trg.tgrelid JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_catalog.pg_proc proc ON proc.oid = trg.tgfoid JOIN pg_catalog.pg_namespace proc_nsp ON proc_nsp.oid = proc.pronamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relname = 'identity_session_revocations' AND NOT trg.tgisinternal AND trg.tgenabled = 'O'
    AND proc_nsp.nspname = 'app_identity' AND proc.proname = 'reject_session_revocation_mutation'
    AND ((trg.tgname = 'identity_session_revocations_no_delete' AND trg.tgtype = 11)
      OR (trg.tgname = 'identity_session_revocations_no_update' AND trg.tgtype = 19));
  IF mismatch_count <> 2 THEN RAISE EXCEPTION 'identity exact trigger verification failed'; END IF;

  SELECT count(*) INTO mismatch_count FROM pg_catalog.pg_proc proc JOIN pg_catalog.pg_namespace nsp ON nsp.oid = proc.pronamespace
  JOIN pg_catalog.pg_language lang ON lang.oid = proc.prolang
  WHERE nsp.nspname = 'app_identity' AND proc.proname = 'reject_session_revocation_mutation'
    AND lang.lanname = 'plpgsql' AND pg_catalog.format_type(proc.prorettype, NULL) = 'trigger'
    AND proc.pronargs = 0 AND proc.provolatile = 'v' AND NOT proc.prosecdef
    AND upper(regexp_replace(btrim(proc.prosrc),'[[:space:]]+',' ','g')) = 'BEGIN RAISE EXCEPTION ''APPEND-ONLY REVOCATION''; END;';
  IF mismatch_count <> 1 THEN RAISE EXCEPTION 'identity trigger function verification failed'; END IF;

  SELECT count(*) INTO mismatch_count FROM app_identity.identity_schema_contracts
  WHERE (contract_id = 'identity.session' AND schema_version = 1 AND database_engine = 'POSTGRESQL' AND contract_fingerprint = 'fec5fa2740d514615bf2050ae72591b1a917054cebd8631454dc00d28f4496f7')
     OR (contract_id = 'identity.registered-service-workload' AND schema_version = 1 AND database_engine = 'POSTGRESQL' AND contract_fingerprint = '33456be7c009748461ba123dc02de46adcbbfe8b64edeac94588c8c820d01c82');
  IF mismatch_count <> 2 OR (SELECT count(*) FROM app_identity.identity_schema_contracts) <> 2 THEN
    RAISE EXCEPTION 'identity exact contract verification failed';
  END IF;
END;
$$ LANGUAGE plpgsql;
