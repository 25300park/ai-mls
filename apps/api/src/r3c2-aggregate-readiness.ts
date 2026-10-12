import { withAdvisoryCatalogCompatibility } from "./advisory-catalog-compatibility.js";
import { assertR3C2BIdentityCatalogCompatibility } from "./r3c2b-identity-catalog-compatibility.js";
import { withExternalIntegrationCatalogCompatibility } from "./external-integration-catalog-compatibility.js";
import { withConnectorCatalogCompatibility } from "./connector-catalog-compatibility.js";
import { withAdministrationCatalogCompatibility } from "./administration-catalog-compatibility.js";
import { withPublicationCatalogCompatibility } from "./publication-catalog-compatibility.js";
import { registrationOperatorAclReady } from "../../../modules/identity/src/registration-operator-acl.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence } from "../../../modules/identity/src/registered-service-workload-postgresql-schema.js";
import { GovernancePersistenceError, newLeaseState, operate } from "../../../modules/organization/src/governance-persistence-support.js";
import { assertR3C1CatalogCompatibility } from "./r3c1-catalog-compatibility.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY, R3C2B_EVIDENCE_CONTRACTS } from "./r3c2b-postgresql-readiness.js";
import { assertR3C2CTeamPersistenceReady, R3C2C_TEAM_CATALOG_QUERY, R3C2C_TEAM_CONTRACTS } from "./r3c2c-postgresql-readiness.js";
import { evaluateContracts, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import { FIRST_PARTY_CREDENTIAL_CATALOG_QUERY, FIRST_PARTY_CREDENTIAL_FINGERPRINTS } from "./first-party-authentication-readiness.js";
import { PRODUCTION_SESSION_BINDING_CATALOG_QUERY, PRODUCTION_SESSION_BINDING_FINGERPRINT } from "./production-trusted-binding-readiness.js";
// Frozen 006 algorithm; only canonically verified later objects are projected out.
export const R3C2_HISTORICAL_COMPATIBILITY_QUERY = String.raw`WITH tables AS (
  SELECT md5(string_agg(rel.relname || ':' || rel.relkind::text, '|' ORDER BY rel.relname)) AS value
  FROM pg_catalog.pg_class rel
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relname NOT IN ('workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials') AND rel.relkind = 'r'
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
  WHERE nsp.nspname = 'app_identity' AND rel.relname NOT IN ('workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials') AND rel.relkind = 'r'
    AND attr.attnum > 0 AND NOT attr.attisdropped
    AND NOT (rel.relname='identity_sessions' AND attr.attname IN ('tenant_id','team_id','team_binding_origin'))
), constraints AS (
  SELECT md5(string_agg(
    rel.relname || ':' || con.conname || ':' || con.contype::text || ':'
      || pg_catalog.regexp_replace(replace(pg_catalog.pg_get_constraintdef(con.oid, true), '::text', ''), '\s+', '', 'g'),
    '|' ORDER BY rel.relname, con.conname
  )) AS value
  FROM pg_catalog.pg_constraint con
  JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
  JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'app_identity' AND rel.relname NOT IN ('workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials') AND con.contype <> 'n'
    AND NOT (rel.relname='identity_sessions' AND con.conname='identity_sessions_production_binding_check')
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
  WHERE nsp.nspname = 'app_identity' AND rel.relname NOT IN ('workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials')
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
  WHERE nsp.nspname = 'app_identity' AND rel.relname NOT IN ('workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials') AND NOT trg.tgisinternal
    AND NOT (rel.relname='identity_sessions' AND trg.tgname='identity_sessions_production_binding_guard')
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
FROM tables, columns, constraints, indexes, triggers, functions`;
const IDENTITY_EXTENSION_TABLES = new Set(['workload_startup_binding_versions','identity_workload_evidence','identity_human_principals','identity_human_credentials']);
const SESSION_BINDING_COLUMNS = new Set(['tenant_id','team_id','team_binding_origin']);

// AO-approved NOT NULL catalog normalization; attnotnull and every other root component remain exact.
// Canonical PG17 and PG18 disposable fixtures produce these same normalized hashes.
const NORMALIZED_EXTENSION_FINGERPRINTS: Readonly<Record<string, readonly [string,string]>> = {
 identity_workload_evidence: ['175b48a0962f684c34b6f9f5ad7a9956','88222856a373735336da52e4cae9f2c8'],
 workload_startup_binding_versions: ['474c1456def4862e43167f2777a94c23','be3dbce8569e67e89c43b75bb6e9abff'],
 identity_human_principals: ['52d7899a2a6f752d8209111a84f29bd7','795d6a7ddbee97e6cf6a864e165d36ac'],
 identity_human_credentials: ['e24eb0c46fdc2c153ae6f671c8daf92d','d2eb949c68dffafea5bc9a2f8617beb1'],
 identity_sessions: ['e1fd23401336202b52bd0c085473d041','6984ade20db3b0ba34a3e49d4526b568'],
};
export function normalizeIdentityExtensionCatalogQuery(query: string): string {
 return query.replaceAll('WHERE k.conrelid=c.oid)', "WHERE k.conrelid=c.oid AND k.contype <> 'n')");
}

async function validateIdentityExtensions(client: PostgreSqlClientPort): Promise<void> {
 const tables=await client.query("SELECT relname AS table_name, relkind AS kind FROM pg_catalog.pg_class WHERE relnamespace='app_identity'::regnamespace AND relkind IN ('r','p','v','m','f','S')");
 const present=new Set(tables.rows.map(r=>String(r['table_name'])));
 const baseTables=new Set(['identity_schema_contracts','identity_schema_migrations','identity_sessions','identity_session_revocations','identity_registered_service_workloads','identity_historical_migration_attestations']);
 if(tables.rows.some(r=>r['kind']!=='r' || (!baseTables.has(String(r['table_name'])) && !IDENTITY_EXTENSION_TABLES.has(String(r['table_name'])))))throw new GovernancePersistenceError('UNAVAILABLE');
 const check=async(query:string,contracts:readonly {schemaName:string;tableName:string;fingerprint:string}[]):Promise<void>=>{
  const result=await client.query(normalizeIdentityExtensionCatalogQuery(query));
  const projected=result.rows.map(row=>{
   const pair=row['schema_name']==='app_identity'?NORMALIZED_EXTENSION_FINGERPRINTS[String(row['table_name'])]:undefined;
   return pair && row['fingerprint']===pair[0]?{...row,fingerprint:pair[1]}:row;
  });
  for(const contract of contracts){const rows=projected.filter(r=>r['schema_name']===contract.schemaName && r['table_name']===contract.tableName);
   if(rows.length!==1 || rows[0]?.['fingerprint']!==contract.fingerprint || rows[0]?.['authority_ok']!==true)throw new GovernancePersistenceError('UNAVAILABLE');}
 };
 if(present.has('workload_startup_binding_versions'))await check(R3C2C_TEAM_CATALOG_QUERY,R3C2C_TEAM_CONTRACTS.filter(c=>c.schemaName==='app_identity'));
 if(present.has('identity_workload_evidence'))await check(R3C2B_EVIDENCE_CATALOG_QUERY,R3C2B_EVIDENCE_CONTRACTS.filter(c=>c.schemaName==='app_identity'));
 if(present.has('identity_human_principals') || present.has('identity_human_credentials')){
  const role=await client.query('SELECT current_user AS role');
  if(role.rows.length!==1 || role.rows[0]?.['role']!=='ai_mls_production_runtime')throw new GovernancePersistenceError('UNAVAILABLE');
  await check(FIRST_PARTY_CREDENTIAL_CATALOG_QUERY,Object.entries(FIRST_PARTY_CREDENTIAL_FINGERPRINTS).map(([tableName,fingerprint])=>({schemaName:'app_identity',tableName,fingerprint})));
 }
 const binding=await client.query("SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid=to_regclass('app_identity.identity_sessions') AND attname IN ('tenant_id','team_id','team_binding_origin') AND NOT attisdropped) OR EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid=to_regclass('app_identity.identity_sessions') AND conname='identity_sessions_production_binding_check') OR EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid=to_regclass('app_identity.identity_sessions') AND tgname='identity_sessions_production_binding_guard') AS present");
 if(binding.rows[0]?.['present']===true)await check(PRODUCTION_SESSION_BINDING_CATALOG_QUERY,[{schemaName:'app_identity',tableName:'identity_sessions',fingerprint:PRODUCTION_SESSION_BINDING_FINGERPRINT}]);
 const functions=new Set(['reject_session_revocation_mutation']);
 if(present.has('identity_historical_migration_attestations')){functions.add('reject_historical_migration_attestation_mutation');functions.add('identity_historical_attestation_schema_is_exact');}
 for(const table of IDENTITY_EXTENSION_TABLES)if(present.has(table))functions.add(table+'_guard');
 if(present.has('workload_startup_binding_versions'))functions.add('workload_startup_binding_versions_authorization_team_guard');
 if(binding.rows[0]?.['present']===true)functions.add('identity_sessions_production_binding_guard');
 const inventory=await client.query("SELECT proname AS name FROM pg_catalog.pg_proc WHERE pronamespace='app_identity'::regnamespace");
 if(inventory.rows.length!==functions.size || inventory.rows.some(r=>!functions.has(String(r['name']))) || new Set(inventory.rows.map(r=>r['name'])).size!==functions.size)throw new GovernancePersistenceError('UNAVAILABLE');
}

export async function assertR3C2IdentityBaseReady(pool:PostgreSqlPoolPort):Promise<NonNullable<Awaited<ReturnType<typeof inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence>>['provenance']>>{
 const projection:PostgreSqlPoolPort={connect:async()=>{const client=await pool.connect();let extensionsValidated=false;return {
  query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(!extensionsValidated && sql.startsWith('SELECT EXISTS')){await validateIdentityExtensions(client);extensionsValidated=true;}
   const result=await client.query<R>(sql,values);
   if(!sql.includes('pg_catalog')||!sql.includes('app_identity'))return result;
   const rows=result.rows.filter(row=>!IDENTITY_EXTENSION_TABLES.has(String(row['relation_name']??row['table_name'])) && !(row['table_name']==='identity_sessions' && (SESSION_BINDING_COLUMNS.has(String(row['column_name'])) || row['constraint_name']==='identity_sessions_production_binding_check' || row['trigger_name']==='identity_sessions_production_binding_guard')));
   const normalized=sql.includes('con.contype AS kind')?normalizeIdentityConstraintCatalog(rows):rows;
   return {...result,rows:normalized,rowCount:normalized.length};
  },release:destroy=>client.release(destroy)};},close:()=>Promise.reject(new GovernancePersistenceError('UNAVAILABLE'))};
 const result=await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(projection,{historicalCompatibilityQuery:R3C2_HISTORICAL_COMPATIBILITY_QUERY});
 if(result.readiness!=='READY'||result.provenance===null)throw new GovernancePersistenceError('UNAVAILABLE');
 return result.provenance;
}
// AO-approved equivalent catalog forms only. The unchanged base verifier checks nullability through pg_attribute first.
export function normalizeIdentityConstraintCatalog<R extends Record<string,unknown>>(rows:readonly R[]):readonly R[]{
 return rows.filter(row=>row["kind"]!=="n").map(row=>{
  const value:Record<string,unknown>={...row};
  const versions:Readonly<Record<string,string>>={identity_sessions_version_check:"session_version",identity_session_revocations_version_check:"session_version",identity_registered_service_workloads_version_check:"registration_version"};
  const column=versions[String(value["constraint_name"])];
  if(column&&value["columns"]===column&&value["check_expression"]===`((${column} >= 1) AND (${column} <= '9007199254740991'::bigint))`)value["check_expression"]=`${column} BETWEEN 1 AND 9007199254740991`;
  if(value["constraint_name"]==="identity_sessions_chronology_check"&&value["columns"]==="updated_at,created_at"&&value["check_expression"]==="(updated_at >= created_at)")value["columns"]="created_at,updated_at";
  return value as R;
 });
}
// Approved R3-B1 Administration migrations plus R3-C1 003_project_governance_v1; the historical R3-B1 fingerprint remains unchanged.
export const R3C2_ADMINISTRATION_SCHEMA_OVERLAY={tableCount:10,columnsHash:"1eb33dcc20c8b692372b6e2d1da8b878",constraintsHash:"8cf02a2621c0025cd9da20aa8067a6a0",indexesHash:"5141be628669fe760ab3bef0aaffd21f",runtimeAclHash:"fdbcb05ab9c63d6343a1031f9031d175",triggerHash:"8ed1639b6ba4ddfc9a5659d7883703bc",functionHash:"8c99d747ddbc1c55f45c51afe08ad382",effectiveAclHash:"5440826e79d6d01961f000d3a5cba88b"} as const;
export async function assertR3C2AggregateSchemasReady(pool:PostgreSqlPoolPort):Promise<void>{
 pool=withAdvisoryCatalogCompatibility(pool);
 pool=withExternalIntegrationCatalogCompatibility(pool);
 pool=withConnectorCatalogCompatibility(pool);
 pool=withAdministrationCatalogCompatibility(pool);
 await operate(pool,newLeaseState(),false,()=>Promise.resolve());
 const contracts=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>c.schemaName==="app_administration"?{...c,...R3C2_ADMINISTRATION_SCHEMA_OVERLAY}:c);
 if((await evaluateContracts(withPublicationCatalogCompatibility(pool),contracts)).status!=="READY")throw new GovernancePersistenceError("UNAVAILABLE");
 await assertR3C2IdentityBaseReady(pool);
 await operate(pool,newLeaseState(),"READ_ONLY",async client=>{
  await assertR3C1CatalogCompatibility(client,["app_administration","app_organization"]);
  await assertR3C2BIdentityCatalogCompatibility(client);
 });
 await assertR3C2CTeamPersistenceReady(pool);
}

/** Production operational readiness includes the separately approved one-shot operator boundary. */
export async function assertRegistrationAggregateSchemasReady(pool: PostgreSqlPoolPort): Promise<void> {
 await operate(pool,newLeaseState(),"READ_ONLY",async client=>{
  if(!await registrationOperatorAclReady(client))throw new GovernancePersistenceError("UNAVAILABLE");
 });
 await assertR3C2AggregateSchemasReady(pool);
}
