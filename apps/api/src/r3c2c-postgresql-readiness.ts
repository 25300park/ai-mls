import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY } from "./r3c2b-postgresql-readiness.js";
import { GovernancePersistenceError, newLeaseState, operate } from "../../../modules/organization/src/governance-persistence-support.js";
export const R3C2C_TEAM_CONTRACTS=[{schemaName:"app_audit",tableName:"audit_evidence_read_records",fingerprint:"08339b2e6b771fce35d7d60b49a97b02"},{schemaName:"app_identity",tableName:"workload_startup_binding_versions",fingerprint:"be3dbce8569e67e89c43b75bb6e9abff"}] as const;
export const R3C2C_TEAM_CATALOG_QUERY=R3C2B_EVIDENCE_CATALOG_QUERY.replace("('app_identity','identity_workload_evidence')","('app_identity','workload_startup_binding_versions')").replace("p.proname=e.table_name||'_guard'","p.proname IN (e.table_name||'_guard',e.table_name||'_authorization_team_guard')");
export async function evaluateR3C2CTeamPersistence(pool:PostgreSqlPoolPort):Promise<{status:"READY"|"NOT_READY";classification:"DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY"}> {
 const classification="DISPOSABLE_OR_CALLER_SUPPLIED_DATABASE_ONLY" as const;
 try{return await operate(pool,newLeaseState(),"READ_ONLY",async client=>{
  const result=await client.query(R3C2C_TEAM_CATALOG_QUERY);
  const ready=result.rows.length===R3C2C_TEAM_CONTRACTS.length && R3C2C_TEAM_CONTRACTS.every(contract=>{
   const rows=result.rows.filter(row=>row["schema_name"]===contract.schemaName && row["table_name"]===contract.tableName);
   return rows.length===1 && rows[0]?.["fingerprint"]===contract.fingerprint && rows[0]?.["authority_ok"]===true;
  });return {status:ready?"READY":"NOT_READY",classification};
 });}catch{return {status:"NOT_READY",classification};}
}
export async function assertR3C2CTeamPersistenceReady(pool:PostgreSqlPoolPort):Promise<void>{if((await evaluateR3C2CTeamPersistence(pool)).status!=="READY")throw new GovernancePersistenceError("UNAVAILABLE");}
