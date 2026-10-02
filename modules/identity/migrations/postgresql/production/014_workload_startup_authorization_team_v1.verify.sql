-- R3-C2C exact catalog verifier; read-only, no repair.
DO $$ DECLARE observed record; BEGIN
 IF current_user<>'ai_mls_production_migration_operator' THEN RAISE EXCEPTION 'C2C_MIGRATION_OPERATOR_REQUIRED'; END IF;
 FOR observed IN SELECT * FROM (WITH expected(schema_name,table_name) AS (VALUES ('app_identity','workload_startup_binding_versions'),('app_audit','audit_evidence_read_records'))
SELECT e.schema_name,e.table_name,
 md5(jsonb_build_object(
 'schemaOwner',pg_get_userbyid(n.nspowner),
 'schemaAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a),
 'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'options',c.reloptions,'comment',obj_description(c.oid,'pg_class'),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),co.collname) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,true)) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(ic.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,t.tgtype,pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'function',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.prosrc,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner),(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.oid) FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=n.oid AND p.proname IN (e.table_name||'_guard',e.table_name||'_authorization_team_guard')),
 'tableAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),
 'columnAcl',(SELECT jsonb_agg(jsonb_build_array(at.attname,coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY at.attname,a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE at.attrelid=c.oid AND at.attnum>0),
 'effectiveTable',(SELECT jsonb_agg(jsonb_build_array(privilege,has_table_privilege('ai_mls_production_runtime',c.oid,privilege)) ORDER BY privilege) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege),
 'effectiveColumn',(SELECT jsonb_agg(jsonb_build_array(at.attname,has_column_privilege('ai_mls_production_runtime',c.oid,at.attnum,'UPDATE')) ORDER BY at.attname) FROM pg_attribute at WHERE at.attrelid=c.oid AND at.attnum>0 AND NOT at.attisdropped),
 'schemaEffective',jsonb_build_array(has_schema_privilege('ai_mls_production_runtime',n.oid,'USAGE'),has_schema_privilege('ai_mls_production_runtime',n.oid,'CREATE')),
 'auditInventory',CASE WHEN e.schema_name='app_audit' THEN jsonb_build_array(
  (SELECT jsonb_agg(jsonb_build_array(x.relname,x.relkind,pg_get_userbyid(x.relowner)) ORDER BY x.relname) FROM pg_class x WHERE x.relnamespace=n.oid),
  (SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,p.oid) FROM pg_proc p WHERE p.pronamespace=n.oid)) ELSE NULL END
 )::text) AS fingerprint,
 coalesce(n.nspowner=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_migration_operator') AND c.relowner=n.nspowner AND c.relkind='r'
 AND (SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit) FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator'))
 AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')) OR roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')))
 AND NOT has_database_privilege('ai_mls_production_runtime',current_database(),'CREATE')
 AND NOT has_database_privilege('ai_mls_production_runtime',current_database(),'TEMPORARY'),false) AS authority_ok
FROM expected e LEFT JOIN pg_namespace n ON n.nspname=e.schema_name
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name
ORDER BY e.schema_name) roots WHERE schema_name='app_identity' LOOP
 IF observed.table_name IS DISTINCT FROM 'workload_startup_binding_versions' OR observed.fingerprint IS DISTINCT FROM 'be3dbce8569e67e89c43b75bb6e9abff' OR observed.authority_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'C2C_SCHEMA_NOT_READY'; END IF;
 END LOOP;
END $$;
