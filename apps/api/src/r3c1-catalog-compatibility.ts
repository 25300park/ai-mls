import { R3C1_CATALOG_QUERY, R3C1_PERSISTENCE_CONTRACTS } from "./r3c1-postgresql-readiness.js";
import type { PostgreSqlClientPort } from "../../../modules/identity/src/postgresql-pool.js";
import { GovernancePersistenceError } from "../../../modules/organization/src/governance-persistence-support.js";

/** AO-approved post-grants/pre-014 component contract; all 19 components, not alternate root hashes. */
export const R3C1_PG17_COMPONENT_CONTRACTS: Readonly<Record<string, Readonly<Record<string,string>>>> = {
  "app_administration": {
    "columnAcl": "cbe65c4109b1aadef219ca6e1d00b67e",
    "columns": "e9c3c9e23a4da6eb6d51f74cee6629c7",
    "comment": "540fdf21d4ada7311be23c0a46a6a99d",
    "constraints": "f39b56585920018ffe7c17fd21572b3c",
    "effectiveColumn": "039f04657d6be755447719055a45d8db",
    "effectiveTable": "d438c302c9169a0a08eedf7908b6cb54",
    "forceRls": "68934a3e9455fa72420237eb05902327",
    "function": "388ef0cc7529a3a01ac4ce3b75326c7c",
    "indexes": "45262dd8d51eba0135ead25384dd6bf8",
    "kind": "59e6c6fecfabc14c575c7bc8ba3371eb",
    "options": "37a6259cc0c1dae299a7866489dff0bd",
    "organizationInventory": "37a6259cc0c1dae299a7866489dff0bd",
    "owner": "11ff993ec9b2b6d9d545eced47891648",
    "rls": "68934a3e9455fa72420237eb05902327",
    "schemaAcl": "3ad58c57ecb724a8ec740da7a7f383be",
    "schemaEffective": "32c7903e9cfd327a6d7ff68d077d2246",
    "schemaOwner": "11ff993ec9b2b6d9d545eced47891648",
    "tableAcl": "f57c8d1a502e32aa2424b924542e8c63",
    "triggers": "03ced400ec202d83230a5314e90c7b29"
  },
  "app_identity": {
    "columnAcl": "330bfe4987b6e3e3ea3f9efcce3457f2",
    "columns": "c616c99caa6c3bb4cc815bcdf0376448",
    "comment": "19749d116e9d41ce2e3f859e418f1c35",
    "constraints": "78e61e59bc9eece70d1597dde7997ea9",
    "effectiveColumn": "9076ddb65223537f4bccbb2a5562b47b",
    "effectiveTable": "d438c302c9169a0a08eedf7908b6cb54",
    "forceRls": "68934a3e9455fa72420237eb05902327",
    "function": "5b2d7170dc0fcb916d2a64ed9a342589",
    "indexes": "a5825ce5d26959906c2b85890dbe6068",
    "kind": "59e6c6fecfabc14c575c7bc8ba3371eb",
    "options": "37a6259cc0c1dae299a7866489dff0bd",
    "organizationInventory": "37a6259cc0c1dae299a7866489dff0bd",
    "owner": "11ff993ec9b2b6d9d545eced47891648",
    "rls": "68934a3e9455fa72420237eb05902327",
    "schemaAcl": "3ad58c57ecb724a8ec740da7a7f383be",
    "schemaEffective": "32c7903e9cfd327a6d7ff68d077d2246",
    "schemaOwner": "11ff993ec9b2b6d9d545eced47891648",
    "tableAcl": "f57c8d1a502e32aa2424b924542e8c63",
    "triggers": "f5672644a7bdb2692ae9ccdf673cb4c3"
  },
  "app_organization": {
    "columnAcl": "cbe65c4109b1aadef219ca6e1d00b67e",
    "columns": "2805ba6fcdb8dbbb24c6114c853908a5",
    "comment": "76ca764bc719305b4fc292a96f1c1db6",
    "constraints": "e498a7ef5e1612111718bc4f940181e5",
    "effectiveColumn": "b9e81d5a956ea544f221c2b609815fa3",
    "effectiveTable": "d438c302c9169a0a08eedf7908b6cb54",
    "forceRls": "68934a3e9455fa72420237eb05902327",
    "function": "88f6e375d3dced01762d2ebaf27110c2",
    "indexes": "db3278ef32cb723edb0730d126de7d7b",
    "kind": "59e6c6fecfabc14c575c7bc8ba3371eb",
    "options": "37a6259cc0c1dae299a7866489dff0bd",
    "organizationInventory": "3d5e4101528d5961a3a03b5a28ba9ecf",
    "owner": "11ff993ec9b2b6d9d545eced47891648",
    "rls": "68934a3e9455fa72420237eb05902327",
    "schemaAcl": "3ad58c57ecb724a8ec740da7a7f383be",
    "schemaEffective": "32c7903e9cfd327a6d7ff68d077d2246",
    "schemaOwner": "11ff993ec9b2b6d9d545eced47891648",
    "tableAcl": "f57c8d1a502e32aa2424b924542e8c63",
    "triggers": "26d91de7eec49b07b1c10e5453f57555"
  }
};

// Reuse the wrapped historical material, including its mandatory registration ACL gate.
// PG18 retains every historical constraint row; only PG17 uses the approved non-n comparison.
const material = R3C1_CATALOG_QUERY
 .replace("md5(jsonb_build_object(", "jsonb_build_object(")
 .replace(")::text) AS fingerprint", ") AS root_json")
 .replace("WHERE k.conrelid=c.oid)", "WHERE k.conrelid=c.oid AND (current_setting('server_version_num')::integer >= 180000 OR k.contype <> 'n'))");
export const R3C1_COMPATIBILITY_QUERY = `WITH material AS (${material})
SELECT schema_name,table_name,md5(root_json::text) AS fingerprint,authority_ok,
 current_setting('server_version_num') AS server_version_num,
 (SELECT jsonb_object_agg(component,md5(value::text)) FROM jsonb_each(root_json) AS part(component,value)) AS component_hashes
FROM material ORDER BY schema_name`;

export function r3c1CompatibleRowsReady(rows: readonly Record<string,unknown>[], requiredSchemas: readonly string[] = R3C1_PERSISTENCE_CONTRACTS.map(c=>c.schemaName)): boolean {
 if(rows.some(row=>typeof row!=="object" || row===null || Array.isArray(row)))return false;
 if(rows.length!==3 || requiredSchemas.length===0 || new Set(requiredSchemas).size!==requiredSchemas.length || requiredSchemas.some(s=>!R3C1_PERSISTENCE_CONTRACTS.some(c=>c.schemaName===s)))return false;
 const version=rows[0]?.["server_version_num"];
 if(typeof version!=="string" || !/^\d{6}$/.test(version))return false;
 const major=Math.floor(Number(version)/10000);
 if(major!==17 && major!==18)return false;
 for(const contract of R3C1_PERSISTENCE_CONTRACTS){
  const matches=rows.filter(r=>r["schema_name"]===contract.schemaName && r["table_name"]===contract.tableName);
  if(matches.length!==1 || matches[0]?.["server_version_num"]!==version)return false;
  const row=matches[0];
  if(!requiredSchemas.includes(contract.schemaName))continue; // R3C2 validates the post-014 Identity root separately.
  if(row["authority_ok"]!==true)return false;
  if(major===18){if(row["fingerprint"]!==contract.fingerprint)return false;continue;}
  const components=row["component_hashes"];
  if(typeof components!=="object" || components===null || Array.isArray(components))return false;
  const expected=R3C1_PG17_COMPONENT_CONTRACTS[contract.schemaName]!;
  const actual=components as Record<string,unknown>;
  if(Object.keys(actual).length!==19 || Object.entries(expected).some(([key,hash])=>actual[key]!==hash))return false;
 }
 return true;
}

/** Forward composition only; historical R3C1 callers retain their exact contract. */
export async function assertR3C1CatalogCompatibility(client: PostgreSqlClientPort, requiredSchemas?: readonly string[]): Promise<void> {
 if(!r3c1CompatibleRowsReady((await client.query(R3C1_COMPATIBILITY_QUERY)).rows,requiredSchemas))throw new GovernancePersistenceError("UNAVAILABLE");
}
