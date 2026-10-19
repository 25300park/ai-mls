import { childRootFailure, rootRequirement } from './child-root-diagnostics.js';
import { READINESS_QUERY, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import type { PostgreSqlPoolPort, PostgreSqlClientPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY } from "./administration-catalog-compatibility.js";
const connector=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[2]!;
export const CONNECTOR_TABLES=Object.freeze(["connector_checkpoints","connector_evidence","connector_idempotency","connector_invocations","connector_leases","connector_results","connector_schema","connector_scopes","connector_technical_evidence","connector_technical_idempotency","connector_technical_records"]);
// Same catalog snapshot as every historical child-root component. No other schema is normalized.
const normalized=(query:string):string=>query.replace("WHERE cn.nspname=expected.schema_name", "WHERE cn.nspname=expected.schema_name AND (NOT (expected.schema_name='app_connector' AND current_setting('server_version_num')::integer BETWEEN 170000 AND 179999) OR c.contype <> 'n')");
const capture=(query:string):string=>`WITH historical AS (${normalized(query)})
SELECT historical.*,current_setting('server_version_num') AS server_version_num,
 CASE WHEN schema_name='app_connector' THEN (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_tables WHERE schemaname='app_connector') ELSE NULL END AS connector_inventory
FROM historical ORDER BY schema_name`;
export const CONNECTOR_COMPATIBILITY_QUERY=capture(READINESS_QUERY);
export const CONNECTOR_FORWARD_COMPATIBILITY_QUERY=capture(ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY);
const hashes={columns_hash:connector.columnsHash,indexes_hash:connector.indexesHash,runtime_acl_hash:connector.runtimeAclHash,trigger_hash:connector.triggerHash,function_hash:connector.functionHash,effective_acl_hash:connector.effectiveAclHash};
export function connectorCompatibleRow(row:Record<string,unknown>):Record<string,unknown>{
 const version=row["server_version_num"];
 if(typeof version!=="string"|| !/^\d{6}$/.test(version))throw childRootFailure('CONNECTOR','SERVER_VERSION');
 const major=Math.floor(Number(version)/10000);
 if(major!==17&&major!==18)throw childRootFailure('CONNECTOR','SERVER_VERSION');
 if(row["schema_name"]!=="app_connector")throw childRootFailure('CONNECTOR','ROOT_CARDINALITY');
 const inventory=row["connector_inventory"];
 if(!Array.isArray(inventory)||inventory.length!==11||inventory.some((name,i)=>name!==CONNECTOR_TABLES[i]))throw childRootFailure('CONNECTOR','INVENTORY');
 // This semantic constraints component is never sufficient on its own.
 // Nullable state, all six remaining components, artifact and every existing authority gate stay exact.
 const exact:Record<string,unknown>={...hashes,artifact_sha256:connector.artifactSha256,table_count:11,schema_comment:connector.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false};
 for(const key of ["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"])exact[key]=0;
 const mismatch=Object.entries(exact).find(([key,value])=>row[key]!==value);
 if(mismatch)throw childRootFailure('CONNECTOR',rootRequirement(mismatch[0]));
 if(row["constraints_hash"]!==(major===17?"462926ec173263014727594215d20d8c":connector.constraintsHash))throw childRootFailure('CONNECTOR','CONSTRAINTS');
 return major===17?{...row,constraints_hash:connector.constraintsHash}:row;
}
/** Only the forward R3C2 composition uses this adapter; historical consumers stay exact. */
export function withConnectorCatalogCompatibility(pool:PostgreSqlPoolPort):PostgreSqlPoolPort{
 return {close:():Promise<void>=>pool.close(),connect:async():Promise<PostgreSqlClientPort>=>{const client=await pool.connect();return {
  query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(sql!==READINESS_QUERY&&sql!==ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY)return client.query<R>(sql,values);
   const result=await client.query<R>(sql===READINESS_QUERY?CONNECTOR_COMPATIBILITY_QUERY:CONNECTOR_FORWARD_COMPATIBILITY_QUERY,values);
   if(result.rowCount!==5||result.rows.length!==5||new Set(result.rows.map(r=>r["schema_name"])).size!==5||result.rows.filter(r=>r["schema_name"]==="app_connector").length!==1)throw childRootFailure('CONNECTOR','ROOT_CARDINALITY');
   return {...result,rows:result.rows.map(row=>row["schema_name"]==="app_connector"?connectorCompatibleRow(row) as R:row)};
  },release:():void=>client.release()
 };}};
}
