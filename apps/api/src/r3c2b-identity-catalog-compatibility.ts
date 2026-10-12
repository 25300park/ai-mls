import type { PostgreSqlClientPort } from "../../../modules/identity/src/postgresql-pool.js";
import { GovernancePersistenceError } from "../../../modules/organization/src/governance-persistence-support.js";
import { R3C2B_EVIDENCE_CATALOG_QUERY, R3C2B_EVIDENCE_CONTRACTS } from "./r3c2b-postgresql-readiness.js";

// Approved component proof: post-013 Identity root, PG17/PG18 non-n equivalence.
// Validated independently by both canonical disposable fixtures; no alternate-hash acceptance.
export const R3C2B_IDENTITY_COMPONENTS: Readonly<Record<string,string>> = {
 auditInventory:"37a6259cc0c1dae299a7866489dff0bd",columnAcl:"37a6259cc0c1dae299a7866489dff0bd",
 columns:"17136975044770a1b8510ec71b9faaf6",comment:"37a6259cc0c1dae299a7866489dff0bd",
 constraints:"19e82b178a1389d83b4cf52e04ae8e12",effectiveColumn:"63d43a0b4efc660018bdb5db86bfff38",
 effectiveTable:"b2dfbb6000d960fcce262d61b4fe2d78",forceRls:"68934a3e9455fa72420237eb05902327",
 function:"474a0cd416ae3696d6f78bc0050ec5e8",indexes:"dbd745fe34d235453345c0058f78c250",
 kind:"59e6c6fecfabc14c575c7bc8ba3371eb",options:"37a6259cc0c1dae299a7866489dff0bd",
 owner:"11ff993ec9b2b6d9d545eced47891648",rls:"68934a3e9455fa72420237eb05902327",
 schemaAcl:"3ad58c57ecb724a8ec740da7a7f383be",schemaEffective:"32c7903e9cfd327a6d7ff68d077d2246",
 schemaOwner:"11ff993ec9b2b6d9d545eced47891648",tableAcl:"d220d78f94bd87b2cf3368f89e95f480",
 triggers:"170ba718d6bd077959444b5ecf4b41bc",
};
function buildQuery():string {
 // Reuse the existing registration projection AND its mandatory authority gate.
 // Expose root material instead of the outer conditional fingerprint translation.
 const start=R3C2B_EVIDENCE_CATALOG_QUERY.indexOf(" FROM (WITH expected");
 const end=R3C2B_EVIDENCE_CATALOG_QUERY.lastIndexOf(") catalog WHERE ");
 if(start<0||end<=start)throw new Error("Unsupported Identity evidence catalog contract.");
 const raw=R3C2B_EVIDENCE_CATALOG_QUERY.slice(start+7,end);
 const material=raw
  .replace("(VALUES ('app_identity','identity_workload_evidence'),('app_audit','audit_evidence_read_records'))","(VALUES ('app_identity','identity_workload_evidence'))")
  .replace("md5(jsonb_build_object(","jsonb_build_object(")
  .replace(")::text) AS fingerprint",") AS root_json")
  .replace("WHERE k.conrelid=c.oid)","WHERE k.conrelid=c.oid AND (current_setting('server_version_num')::integer >= 180000 OR k.contype <> 'n'))");
 if(material===raw||!material.includes("AS root_json")||!material.includes("k.contype <> 'n'"))throw new Error("Unsupported Identity evidence catalog material.");
 return `WITH material AS (${material}) SELECT schema_name,table_name,md5(root_json::text) AS fingerprint,authority_ok,
 current_setting('server_version_num') AS server_version_num,
 (SELECT jsonb_object_agg(component,md5(value::text)) FROM jsonb_each(root_json) AS part(component,value)) AS component_hashes
 FROM material catalog WHERE ${R3C2B_EVIDENCE_CATALOG_QUERY.slice(end+16)}`;
}
export const R3C2B_IDENTITY_COMPATIBILITY_QUERY=buildQuery();
export function r3c2bIdentityCompatibleRowsReady(rows:readonly Record<string,unknown>[]):boolean {
 if(rows.length!==1)return false;
 const row=rows[0];if(!row||typeof row!=="object"||Array.isArray(row))return false;
 if(row["schema_name"]!=="app_identity"||row["table_name"]!=="identity_workload_evidence"||row["authority_ok"]!==true)return false;
 const version=row["server_version_num"],fingerprint=row["fingerprint"];
 if(typeof version!=="string"||!/^\d{6}$/.test(version)||typeof fingerprint!=="string"||!/^[a-f0-9]{32}$/.test(fingerprint))return false;
 const major=Math.floor(Number(version)/10000);
 if(major===18)return fingerprint===R3C2B_EVIDENCE_CONTRACTS.find(c=>c.schemaName==="app_identity")!.fingerprint;
 if(major!==17)return false;
 const components=row["component_hashes"];
 if(typeof components!=="object"||components===null||Array.isArray(components))return false;
 const actual=components as Record<string,unknown>;
 return Object.keys(actual).length===19&&Object.entries(R3C2B_IDENTITY_COMPONENTS).every(([key,expected])=>actual[key]===expected);
}
/** Current R3C2 forward post-child composition only; historical consumers remain exact. */
export async function assertR3C2BIdentityCatalogCompatibility(client:PostgreSqlClientPort):Promise<void>{
 if(!r3c2bIdentityCompatibleRowsReady((await client.query(R3C2B_IDENTITY_COMPATIBILITY_QUERY)).rows))throw new GovernancePersistenceError("UNAVAILABLE");
}
