import type { PostgreSqlClientPort } from "./postgresql-pool.js";
export const REGISTRATION_OPERATOR_ACL_QUERY = `
WITH operator AS (SELECT oid,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='ai_mls_production_registration_operator'),
expected(name) AS (VALUES ('app_identity.identity_registered_service_workloads'),('app_identity.identity_workload_evidence'),('app_audit.audit_evidence_read_records'))
SELECT EXISTS (SELECT 1 FROM operator WHERE rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls)
AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=(SELECT oid FROM operator) OR roleid=(SELECT oid FROM operator))
AND NOT has_database_privilege('ai_mls_production_registration_operator',current_database(),'CREATE,TEMPORARY')
AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspowner=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relowner=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_proc WHERE proowner=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_database WHERE datdba=(SELECT oid FROM operator))
AND (SELECT count(*)=3 AND bool_and(to_regclass(name) IS NOT NULL AND has_table_privilege('ai_mls_production_registration_operator',name,'SELECT') AND has_table_privilege('ai_mls_production_registration_operator',name,'INSERT') AND NOT has_table_privilege('ai_mls_production_registration_operator',name,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) FROM expected)
AND (SELECT count(*)=6 AND bool_and(NOT a.is_grantable AND a.privilege_type IN ('SELECT','INSERT') AND c.oid IN (SELECT to_regclass(name) FROM expected)) FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a WHERE a.grantee=(SELECT oid FROM operator))
AND (SELECT count(*)=2 AND bool_and(NOT a.is_grantable AND a.privilege_type='USAGE' AND n.nspname IN ('app_identity','app_audit')) FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a WHERE a.grantee=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE a.grantee=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE a.grantee=(SELECT oid FROM operator))
AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND has_schema_privilege('ai_mls_production_registration_operator',n.oid,'USAGE') AND has_function_privilege('ai_mls_production_registration_operator',p.oid,'EXECUTE'))
AND NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','S','f') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.oid NOT IN (SELECT to_regclass(name) FROM expected) AND has_table_privilege('ai_mls_production_registration_operator',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
AND NOT EXISTS (SELECT 1 FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND c.oid NOT IN (SELECT to_regclass(name) FROM expected) AND at.attnum>0 AND NOT at.attisdropped AND has_column_privilege('ai_mls_production_registration_operator',c.oid,at.attnum,'INSERT,UPDATE,REFERENCES'))
AND NOT EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname <> 'information_schema' AND has_schema_privilege('ai_mls_production_registration_operator',n.oid,'CREATE'))
AND NOT EXISTS (SELECT 1 FROM pg_attribute at JOIN pg_class c ON c.oid=at.attrelid WHERE c.oid IN (SELECT to_regclass(name) FROM expected) AND at.attnum>0 AND NOT at.attisdropped AND has_column_privilege('ai_mls_production_registration_operator',c.oid,at.attnum,'UPDATE,REFERENCES'))
AS ready`;
export async function registrationOperatorAclReady(client: PostgreSqlClientPort): Promise<boolean> {
  const result = await client.query(REGISTRATION_OPERATOR_ACL_QUERY);
  return result.rows.length === 1 && result.rows[0]?.["ready"] === true;
}
