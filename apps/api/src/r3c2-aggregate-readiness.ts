import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence } from "../../../modules/identity/src/registered-service-workload-postgresql-schema.js";
import { GovernancePersistenceError, newLeaseState, operate } from "../../../modules/organization/src/governance-persistence-support.js";
import { R3C1_CATALOG_QUERY, R3C1_PERSISTENCE_CONTRACTS } from "./r3c1-postgresql-readiness.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY, R3C2B_EVIDENCE_CONTRACTS } from "./r3c2b-postgresql-readiness.js";
import { assertR3C2CTeamPersistenceReady } from "./r3c2c-postgresql-readiness.js";
import { evaluateContracts, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import { assertFirstPartyCredentialPersistenceReady } from "./first-party-authentication-readiness.js";
// Root projection preserves the frozen Identity base verifier. Only separately verified canonical extension tables are excluded from its metadata inventory.
export async function assertR3C2IdentityBaseReady(pool:PostgreSqlPoolPort):Promise<NonNullable<Awaited<ReturnType<typeof inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence>>["provenance"]>>{
 const humanExtensions=new Set(["identity_human_principals","identity_human_credentials"]);
 let humanExtensionObserved=false;
 const extensions=new Set(["workload_startup_binding_versions","identity_workload_evidence",...humanExtensions]);
 const projection:PostgreSqlPoolPort={connect:async()=>{const client=await pool.connect();return {query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{const result=await client.query<R>(sql,values);if(!sql.includes("pg_catalog")||!sql.includes("app_identity"))return result;if(result.rows.some(row=>humanExtensions.has(String(row["relation_name"]??row["table_name"]))))humanExtensionObserved=true;const rows=result.rows.filter(row=>!extensions.has(String(row["relation_name"]??row["table_name"])));const normalized=sql.includes("con.contype AS kind")?normalizeIdentityConstraintCatalog(rows):rows;return {...result,rows:normalized,rowCount:normalized.length};},release:destroy=>client.release(destroy)};},close:()=>Promise.reject(new GovernancePersistenceError("UNAVAILABLE"))};
 const result=await inspectPostgreSqlRegisteredServiceWorkloadSchemaEvidence(projection);if(result.readiness!=="READY"||result.provenance===null)throw new GovernancePersistenceError("UNAVAILABLE");if(humanExtensionObserved)await assertFirstPartyCredentialPersistenceReady(pool);return result.provenance;
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
 await operate(pool,newLeaseState(),false,()=>Promise.resolve());
 const contracts=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map(c=>c.schemaName==="app_administration"?{...c,...R3C2_ADMINISTRATION_SCHEMA_OVERLAY}:c);
 if((await evaluateContracts(pool,contracts)).status!=="READY")throw new GovernancePersistenceError("UNAVAILABLE");
 await assertR3C2IdentityBaseReady(pool);
 await operate(pool,newLeaseState(),"READ_ONLY",async client=>{
  const c1=await client.query(R3C1_CATALOG_QUERY);const b=await client.query(R3C2B_EVIDENCE_CATALOG_QUERY);
  for(const contract of R3C1_PERSISTENCE_CONTRACTS.filter(c=>c.schemaName!=="app_identity")){
   const rows=c1.rows.filter(r=>r["schema_name"]===contract.schemaName&&r["table_name"]===contract.tableName);if(rows.length!==1||rows[0]?.["fingerprint"]!==contract.fingerprint||rows[0]?.["authority_ok"]!==true)throw new GovernancePersistenceError("UNAVAILABLE");
  }
  const proof=R3C2B_EVIDENCE_CONTRACTS.find(c=>c.schemaName==="app_identity")!;const rows=b.rows.filter(r=>r["schema_name"]===proof.schemaName&&r["table_name"]===proof.tableName);if(rows.length!==1||rows[0]?.["fingerprint"]!==proof.fingerprint||rows[0]?.["authority_ok"]!==true)throw new GovernancePersistenceError("UNAVAILABLE");
 });
 await assertR3C2CTeamPersistenceReady(pool);
}
