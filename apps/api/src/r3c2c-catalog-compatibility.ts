import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { GovernancePersistenceError, newLeaseState, operate } from "../../../modules/organization/src/governance-persistence-support.js";
import { R3C2C_TEAM_CATALOG_QUERY, R3C2C_TEAM_CONTRACTS } from "./r3c2c-postgresql-readiness.js";

// Approved paired post-Identity014/Audit002 component proof; no alternate-root-hash acceptance.
export const R3C2C_COMPONENTS: Readonly<Record<string,Readonly<Record<string,string>>>> = {
  "app_audit": {
    "rls": "68934a3e9455fa72420237eb05902327",
    "kind": "59e6c6fecfabc14c575c7bc8ba3371eb",
    "owner": "11ff993ec9b2b6d9d545eced47891648",
    "columns": "95442108f00e119c76dab8913e126c5d",
    "comment": "37a6259cc0c1dae299a7866489dff0bd",
    "indexes": "2c44f82417d0fdadde4a9a9c1d5830c4",
    "options": "37a6259cc0c1dae299a7866489dff0bd",
    "forceRls": "68934a3e9455fa72420237eb05902327",
    "function": "3a86eb8a062b53d6d3489b3dc56f8064",
    "tableAcl": "f57c8d1a502e32aa2424b924542e8c63",
    "triggers": "27156147ebf76373e99644e0be166705",
    "columnAcl": "37a6259cc0c1dae299a7866489dff0bd",
    "schemaAcl": "3ad58c57ecb724a8ec740da7a7f383be",
    "constraints": "060757647bb3a4df344265302f23d38a",
    "schemaOwner": "11ff993ec9b2b6d9d545eced47891648",
    "auditInventory": "d38005acb2952645317c05560f799ac6",
    "effectiveTable": "d438c302c9169a0a08eedf7908b6cb54",
    "effectiveColumn": "05b384603bc096929a7bddb05bbff80b",
    "schemaEffective": "32c7903e9cfd327a6d7ff68d077d2246"
  },
  "app_identity": {
    "rls": "68934a3e9455fa72420237eb05902327",
    "kind": "59e6c6fecfabc14c575c7bc8ba3371eb",
    "owner": "11ff993ec9b2b6d9d545eced47891648",
    "columns": "24fbff48554844bd13148200139a6fe0",
    "comment": "19749d116e9d41ce2e3f859e418f1c35",
    "indexes": "a5825ce5d26959906c2b85890dbe6068",
    "options": "37a6259cc0c1dae299a7866489dff0bd",
    "forceRls": "68934a3e9455fa72420237eb05902327",
    "function": "8ae671201455326826b934bf34afcb3d",
    "tableAcl": "f57c8d1a502e32aa2424b924542e8c63",
    "triggers": "6c04c2f4033fe3a10b2941d7ed469bee",
    "columnAcl": "330bfe4987b6e3e3ea3f9efcce3457f2",
    "schemaAcl": "3ad58c57ecb724a8ec740da7a7f383be",
    "constraints": "69e7768b4e84242fd3dd6d7bef17b2ca",
    "schemaOwner": "11ff993ec9b2b6d9d545eced47891648",
    "auditInventory": "37a6259cc0c1dae299a7866489dff0bd",
    "effectiveTable": "d438c302c9169a0a08eedf7908b6cb54",
    "effectiveColumn": "308502f5845bef06fa7d36534ae75da1",
    "schemaEffective": "32c7903e9cfd327a6d7ff68d077d2246"
  }
};
function buildQuery():string {
 // Reuse the existing registration projection AND its mandatory authority gate.
 // Expose root material instead of the outer conditional fingerprint translation.
 const start=R3C2C_TEAM_CATALOG_QUERY.indexOf(" FROM (WITH expected");
 const end=R3C2C_TEAM_CATALOG_QUERY.lastIndexOf(") catalog WHERE ");
 if(start<0||end<=start)throw new Error("Unsupported R3C2C team catalog contract.");
 const raw=R3C2C_TEAM_CATALOG_QUERY.slice(start+7,end);
 const material=raw
  .replace("md5(jsonb_build_object(","jsonb_build_object(")
  .replace(")::text) AS fingerprint",") AS root_json")
  .replace("WHERE k.conrelid=c.oid)","WHERE k.conrelid=c.oid AND (current_setting('server_version_num')::integer >= 180000 OR k.contype <> 'n'))");
 if(material===raw||!material.includes("AS root_json")||!material.includes("k.contype <> 'n'"))throw new Error("Unsupported R3C2C team catalog material.");
 return `WITH material AS (${material}) SELECT schema_name,table_name,md5(root_json::text) AS fingerprint,authority_ok,
 current_setting('server_version_num') AS server_version_num,
 (SELECT jsonb_object_agg(component,md5(value::text)) FROM jsonb_each(root_json) AS part(component,value)) AS component_hashes
 FROM material catalog WHERE ${R3C2C_TEAM_CATALOG_QUERY.slice(end+16)}`;
}
export const R3C2C_COMPATIBILITY_QUERY=buildQuery();
export function r3c2cCompatibleRowsReady(rows:readonly Record<string,unknown>[]):boolean {
 if(rows.length!==2)return false;
 return R3C2C_TEAM_CONTRACTS.every(contract=>{
 const matches=rows.filter(row=>row&&typeof row==='object'&&!Array.isArray(row)&&row['schema_name']===contract.schemaName&&row['table_name']===contract.tableName);
 if(matches.length!==1)return false;
 const row=matches[0]!;
 if(row['authority_ok']!==true)return false;
 const version=row['server_version_num'],fingerprint=row['fingerprint'];
 if(typeof version!=='string'||!/^\d{6}$/.test(version)||typeof fingerprint!=='string'||!/^[a-f0-9]{32}$/.test(fingerprint))return false;
 const major=Math.floor(Number(version)/10000);
 if(major===18)return fingerprint===contract.fingerprint;
 if(major!==17)return false;
 const components=row['component_hashes'];
 if(typeof components!=='object'||components===null||Array.isArray(components))return false;
 const actual=components as Record<string,unknown>;
 return Object.keys(actual).length===19&&Object.entries(R3C2C_COMPONENTS[contract.schemaName]!).every(([key,expected])=>actual[key]===expected);
 });
}
/** Current R3C2 forward composition only; historical team-persistence consumers remain exact. */
export async function assertR3C2CCatalogCompatibility(pool:PostgreSqlPoolPort):Promise<void>{
 await operate(pool,newLeaseState(),'READ_ONLY',async client=>{
 if(!r3c2cCompatibleRowsReady((await client.query(R3C2C_COMPATIBILITY_QUERY)).rows))throw new GovernancePersistenceError('UNAVAILABLE');
 });
}
