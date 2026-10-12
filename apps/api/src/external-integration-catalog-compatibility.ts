import { READINESS_QUERY, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import type { PostgreSqlPoolPort, PostgreSqlClientPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { CONNECTOR_FORWARD_COMPATIBILITY_QUERY } from "./connector-catalog-compatibility.js";
const externalIntegration=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[3]!;
export const EXTERNAL_INTEGRATION_TABLES=Object.freeze(["ext_contracts","ext_evidence","ext_idempotency","ext_mappings","ext_observations"]);
// Same catalog snapshot as every historical child-root component. No other schema is normalized.
const normalized=(query:string):string=>query.replace("WHERE cn.nspname=expected.schema_name", "WHERE cn.nspname=expected.schema_name AND (NOT (expected.schema_name='app_external_integration' AND current_setting('server_version_num')::integer BETWEEN 170000 AND 179999) OR c.contype <> 'n')");
const capture=(query:string):string=>`WITH historical AS (${normalized(query)})
SELECT historical.*,current_setting('server_version_num') AS server_version_num,
 CASE WHEN schema_name='app_external_integration' THEN (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_tables WHERE schemaname='app_external_integration') ELSE NULL END AS external_integration_inventory
FROM historical ORDER BY schema_name`;
export const EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY=capture(READINESS_QUERY);
export const EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY=capture(CONNECTOR_FORWARD_COMPATIBILITY_QUERY);
const hashes={columns_hash:externalIntegration.columnsHash,indexes_hash:externalIntegration.indexesHash,runtime_acl_hash:externalIntegration.runtimeAclHash,trigger_hash:externalIntegration.triggerHash,function_hash:externalIntegration.functionHash,effective_acl_hash:externalIntegration.effectiveAclHash};
export function externalIntegrationCompatibleRow(row:Record<string,unknown>):Record<string,unknown>{
 const version=row["server_version_num"];
 if(typeof version!=="string"|| !/^\d{6}$/.test(version))throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 const major=Math.floor(Number(version)/10000);
 if(major!==17&&major!==18)throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 if(row["schema_name"]!=="app_external_integration")throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 const inventory=row["external_integration_inventory"];
 if(!Array.isArray(inventory)||inventory.length!==5||inventory.some((name,i)=>name!==EXTERNAL_INTEGRATION_TABLES[i]))throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 // This semantic constraints component is never sufficient on its own.
 // Nullable state, all six remaining components, artifact and every existing authority gate stay exact.
 const exact:Record<string,unknown>={...hashes,artifact_sha256:externalIntegration.artifactSha256,table_count:5,schema_comment:externalIntegration.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false};
 for(const key of ["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"])exact[key]=0;
 if(Object.entries(exact).some(([key,value])=>row[key]!==value))throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 if(row["constraints_hash"]!==(major===17?"18486b92d120924d8f23a6a8b6c1b31f":externalIntegration.constraintsHash))throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
 return major===17?{...row,constraints_hash:externalIntegration.constraintsHash}:row;
}
/** Only the forward R3C2 composition uses this adapter; historical consumers stay exact. */
export function withExternalIntegrationCatalogCompatibility(pool:PostgreSqlPoolPort):PostgreSqlPoolPort{
 return {close:():Promise<void>=>pool.close(),connect:async():Promise<PostgreSqlClientPort>=>{const client=await pool.connect();return {
  query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(sql!==READINESS_QUERY&&sql!==CONNECTOR_FORWARD_COMPATIBILITY_QUERY)return client.query<R>(sql,values);
   const result=await client.query<R>(sql===READINESS_QUERY?EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY:EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,values);
   if(result.rowCount!==5||result.rows.length!==5||new Set(result.rows.map(r=>r["schema_name"])).size!==5||result.rows.filter(r=>r["schema_name"]==="app_external_integration").length!==1)throw new Error("EXTERNAL_INTEGRATION_CATALOG_UNAVAILABLE");
   return {...result,rows:result.rows.map(row=>row["schema_name"]==="app_external_integration"?externalIntegrationCompatibleRow(row) as R:row)};
  },release:():void=>client.release()
 };}};
}
