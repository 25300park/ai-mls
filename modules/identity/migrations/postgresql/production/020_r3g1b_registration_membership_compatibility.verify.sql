-- R3-G1B 020 supersedes immutable 019: SELECT-only; post-013/Audit001, PRE-018.
-- AO exact registration managed-membership compatibility; all other checks unchanged.
-- Historical root fingerprints are unchanged; DEC-192 database and membership
-- authority is checked independently. Both rows must have ready=true.
WITH root AS (
WITH expected(schema_name,table_name) AS (VALUES ('app_identity','identity_workload_evidence'),('app_audit','audit_evidence_read_records'))
SELECT e.schema_name,e.table_name,
 md5(jsonb_build_object(
 'schemaOwner',pg_get_userbyid(n.nspowner),
 'schemaAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a),
 'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'options',c.reloptions,'comment',obj_description(c.oid,'pg_class'),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),co.collname) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,true)) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(ic.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,t.tgtype,pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
 'function',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.prosrc,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner),(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.oid) FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=n.oid AND p.proname=e.table_name||'_guard'),
 'tableAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),
 'columnAcl',(SELECT jsonb_agg(jsonb_build_array(at.attname,coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY at.attname,a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE at.attrelid=c.oid AND at.attnum>0),
 'effectiveTable',(SELECT jsonb_agg(jsonb_build_array(privilege,has_table_privilege('ai_mls_production_runtime',c.oid,privilege)) ORDER BY privilege) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege),
 'effectiveColumn',(SELECT jsonb_agg(jsonb_build_array(at.attname,has_column_privilege('ai_mls_production_runtime',c.oid,at.attnum,'UPDATE')) ORDER BY at.attname) FROM pg_attribute at WHERE at.attrelid=c.oid AND at.attnum>0 AND NOT at.attisdropped),
 'schemaEffective',jsonb_build_array(has_schema_privilege('ai_mls_production_runtime',n.oid,'USAGE'),has_schema_privilege('ai_mls_production_runtime',n.oid,'CREATE')),
 'auditInventory',CASE WHEN e.schema_name='app_audit' THEN jsonb_build_array(
  (SELECT jsonb_agg(jsonb_build_array(x.relname,x.relkind,pg_get_userbyid(x.relowner)) ORDER BY x.relname) FROM pg_class x WHERE x.relnamespace=n.oid),
  (SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,p.oid) FROM pg_proc p WHERE p.pronamespace=n.oid)) ELSE NULL END
 )::text) AS fingerprint
FROM expected e LEFT JOIN pg_namespace n ON n.nspname=e.schema_name
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name
), role_names(role_name, can_create) AS (VALUES
 ('ai_mls_production_runtime',false),
 ('ai_mls_production_migration_operator',true),
 ('ai_mls_production_registration_operator',false)
), database_acl AS (
 SELECT a.* FROM pg_database d
 CROSS JOIN LATERAL aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) a
 WHERE d.datname=current_database()
), memberships AS (
 SELECT granted.rolname::text AS granted_role, member.rolname::text AS member_role,
        grantor.rolname::text AS grantor_role,
        m.admin_option,m.inherit_option,m.set_option
 FROM pg_auth_members m
 JOIN pg_roles granted ON granted.oid=m.roleid
 JOIN pg_roles member ON member.oid=m.member
 JOIN pg_roles grantor ON grantor.oid=m.grantor
 WHERE granted.rolname IN (SELECT role_name FROM role_names)
    OR member.rolname IN (SELECT role_name FROM role_names)
), expected_memberships(granted_role,member_role,grantor_role,admin_option,inherit_option,set_option) AS (VALUES
 ('ai_mls_production_migration_operator','postgres','supabase_admin',true,false,false),
 ('ai_mls_production_runtime','postgres','supabase_admin',true,false,false),
 ('ai_mls_production_registration_operator','postgres','supabase_admin',true,false,false)
), role_check AS (
 SELECT count(r.oid)=3 AND coalesce(bool_and(
 r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolcreatedb AND NOT r.rolcreaterole
 AND NOT r.rolreplication AND NOT r.rolbypassrls AND NOT r.rolinherit
 AND has_database_privilege(r.oid,current_database(),'CONNECT')
 AND has_database_privilege(r.oid,current_database(),'CREATE')=names.can_create
 AND EXISTS (SELECT 1 FROM database_acl a WHERE a.grantee=r.oid AND a.privilege_type='CONNECT')
 AND EXISTS (SELECT 1 FROM database_acl a WHERE a.grantee=r.oid AND a.privilege_type='CREATE')=names.can_create
 AND NOT EXISTS (SELECT 1 FROM database_acl a WHERE a.grantee=r.oid
   AND (a.is_grantable OR a.privilege_type NOT IN ('CONNECT','CREATE')
        OR (a.privilege_type='CREATE' AND NOT names.can_create)))
 AND has_database_privilege(r.oid,current_database(),'TEMPORARY')=
   EXISTS (SELECT 1 FROM database_acl a WHERE a.grantee=0 AND a.privilege_type='TEMPORARY')
 ),false) AS role_acl_ok
 FROM role_names names LEFT JOIN pg_roles r ON r.rolname=names.role_name
), membership_check AS (
 SELECT (SELECT count(*) FROM memberships)=3 AND NOT EXISTS (
 (SELECT * FROM memberships EXCEPT SELECT * FROM expected_memberships)
 UNION ALL
 (SELECT * FROM expected_memberships EXCEPT SELECT * FROM memberships)
 ) AS membership_ok
), ownership_check AS (
 SELECT NOT EXISTS (
 SELECT 1 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner
 WHERE r.rolname IN ('ai_mls_production_runtime','ai_mls_production_registration_operator')
 UNION ALL
 SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner
 WHERE r.rolname IN ('ai_mls_production_runtime','ai_mls_production_registration_operator')
 UNION ALL
 SELECT 1 FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
 WHERE r.rolname IN ('ai_mls_production_runtime','ai_mls_production_registration_operator')
 UNION ALL
 SELECT 1 FROM pg_type t JOIN pg_roles r ON r.oid=t.typowner
 WHERE r.rolname IN ('ai_mls_production_runtime','ai_mls_production_registration_operator')
 UNION ALL
 SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba
 WHERE r.rolname IN ('ai_mls_production_runtime','ai_mls_production_registration_operator')
 ) AS ownership_ok
)
SELECT root.schema_name,root.table_name,root.fingerprint,
       role_acl_ok,membership_ok,ownership_ok,
       coalesce(root.fingerprint=CASE root.schema_name
         WHEN 'app_identity' THEN '88222856a373735336da52e4cae9f2c8'
         WHEN 'app_audit' THEN '5cb4da03f37cfb0623fd3ef5262ca474'
       END AND role_acl_ok AND membership_ok AND ownership_ok,false) AS ready
FROM root CROSS JOIN role_check CROSS JOIN membership_check CROSS JOIN ownership_check
ORDER BY root.schema_name;
