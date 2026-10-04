import { withRegistrationOperatorReadiness } from "./registration-readiness-compatibility.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { GovernancePersistenceError, newLeaseState, operate } from "../../../modules/organization/src/governance-persistence-support.js";
export const R3C1_PERSISTENCE_CONTRACTS = [
  {
    "schemaName": "app_administration",
    "tableName": "project_governance_versions",
    "fingerprint": "839ffbc031f9eff1ddd0268583c607ed",
    "artifactSha256": "e21b19777b1761edc786760eb05e58726122dced9840ca349f1ded2ac53fec53"
  },
  {
    "schemaName": "app_identity",
    "tableName": "workload_startup_binding_versions",
    "fingerprint": "ba7401b35bb4decd310dac7fe66523ae",
    "artifactSha256": "ab04135e3b1b312474110c3e86f4b26644487f0277336cc3be99be4f2db17b66"
  },
  {
    "schemaName": "app_organization",
    "tableName": "organization_governance_versions",
    "fingerprint": "e438ef418eb9503c9bdc79dbad332548",
    "artifactSha256": "0676ebbd256fe76162abc50533a9415be01809131242b641952d44e5d413d668"
  }
] as const;
export const R3C1_CATALOG_QUERY = withRegistrationOperatorReadiness("WITH expected(schema_name,table_name) AS (VALUES\n ('app_organization','organization_governance_versions'),\n ('app_administration','project_governance_versions'),\n ('app_identity','workload_startup_binding_versions'))\nSELECT e.schema_name,e.table_name,\n md5(jsonb_build_object(\n 'schemaOwner',pg_get_userbyid(n.nspowner),\n 'schemaAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a),\n 'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'options',c.reloptions,'comment',obj_description(c.oid,'pg_class'),\n 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid),co.collname) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),\n 'constraints',(SELECT jsonb_agg(jsonb_build_array(k.conname,k.contype,k.convalidated,k.condeferrable,k.condeferred,pg_get_constraintdef(k.oid,true)) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),\n 'indexes',(SELECT jsonb_agg(jsonb_build_array(ic.relname,i.indisvalid,i.indisready,i.indislive,pg_get_indexdef(i.indexrelid)) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),\n 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,t.tgenabled,t.tgtype,pg_get_triggerdef(t.oid,true)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),\n 'function',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),pg_get_function_result(p.oid),l.lanname,p.prosrc,p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner),(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a)) ORDER BY p.oid) FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=n.oid AND p.proname=e.table_name||'_guard'),\n 'tableAcl',(SELECT jsonb_agg(jsonb_build_array(coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),\n 'columnAcl',(SELECT jsonb_agg(jsonb_build_array(at.attname,coalesce(pg_get_userbyid(a.grantee),'PUBLIC'),a.privilege_type,a.is_grantable) ORDER BY at.attname,a.grantee=0,pg_get_userbyid(a.grantee),a.privilege_type) FROM pg_attribute at CROSS JOIN LATERAL aclexplode(at.attacl) a WHERE at.attrelid=c.oid AND at.attnum>0),\n 'effectiveTable',(SELECT jsonb_agg(jsonb_build_array(privilege,has_table_privilege('ai_mls_production_runtime',c.oid,privilege)) ORDER BY privilege) FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege),\n 'effectiveColumn',(SELECT jsonb_agg(jsonb_build_array(at.attname,has_column_privilege('ai_mls_production_runtime',c.oid,at.attnum,'UPDATE')) ORDER BY at.attname) FROM pg_attribute at WHERE at.attrelid=c.oid AND at.attnum>0 AND NOT at.attisdropped),\n 'schemaEffective',jsonb_build_array(has_schema_privilege('ai_mls_production_runtime',n.oid,'USAGE'),has_schema_privilege('ai_mls_production_runtime',n.oid,'CREATE')),\n 'organizationInventory',CASE WHEN e.schema_name='app_organization' THEN jsonb_build_array(\n  (SELECT jsonb_agg(jsonb_build_array(x.relname,x.relkind,pg_get_userbyid(x.relowner)) ORDER BY x.relname) FROM pg_class x WHERE x.relnamespace=n.oid),\n  (SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid)) ORDER BY p.proname,p.oid) FROM pg_proc p WHERE p.pronamespace=n.oid)) ELSE NULL END\n )::text) AS fingerprint,\n coalesce(n.nspowner=(SELECT oid FROM pg_roles WHERE rolname='ai_mls_production_migration_operator') AND c.relowner=n.nspowner AND c.relkind='r'\n AND (SELECT count(*)=2 AND bool_and(NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls AND NOT rolinherit) FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator'))\n AND NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')) OR roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('ai_mls_production_runtime','ai_mls_production_migration_operator')))\n AND NOT has_database_privilege('ai_mls_production_runtime',current_database(),'CREATE')\n AND NOT has_database_privilege('ai_mls_production_runtime',current_database(),'TEMPORARY'),false) AS authority_ok\nFROM expected e LEFT JOIN pg_namespace n ON n.nspname=e.schema_name\nLEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name\nORDER BY e.schema_name");
export interface R3C1Readiness { readonly status: "READY" | "NOT_READY"; readonly failingRoots: readonly string[]; readonly classification: "DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY" }
export async function evaluateR3C1Persistence(pool: PostgreSqlPoolPort): Promise<R3C1Readiness> {
  const all=R3C1_PERSISTENCE_CONTRACTS.map(c=>c.schemaName);
  try {
    return await operate(pool,newLeaseState(),"READ_ONLY",async client => {
      const result=await client.query(R3C1_CATALOG_QUERY);
      const failures=R3C1_PERSISTENCE_CONTRACTS.filter(contract=>{
        const matches=result.rows.filter(row=>row["schema_name"]===contract.schemaName);
        return matches.length!==1 || matches[0]?.["table_name"]!==contract.tableName || matches[0]?.["fingerprint"]!==contract.fingerprint || matches[0]?.["authority_ok"]!==true;
      }).map(c=>c.schemaName);
      if (result.rows.length!==all.length) return {status:"NOT_READY",failingRoots:all,classification:"DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY"};
      return {status:failures.length===0?"READY":"NOT_READY",failingRoots:failures,classification:"DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY"};
    });
  } catch { return {status:"NOT_READY",failingRoots:all,classification:"DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY"}; }
}
export async function assertR3C1PersistenceReady(pool: PostgreSqlPoolPort): Promise<void> {
  if ((await evaluateR3C1Persistence(pool)).status!=="READY") throw new GovernancePersistenceError("UNAVAILABLE");
}
