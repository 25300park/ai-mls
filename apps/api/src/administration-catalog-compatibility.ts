import { READINESS_QUERY, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import type { PostgreSqlPoolPort, PostgreSqlClientPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { PUBLICATION_COMPATIBILITY_QUERY } from "./publication-catalog-compatibility.js";
const administration={...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[1]!,tableCount:10,columnsHash:"1eb33dcc20c8b692372b6e2d1da8b878",constraintsHash:"8cf02a2621c0025cd9da20aa8067a6a0",indexesHash:"5141be628669fe760ab3bef0aaffd21f",runtimeAclHash:"fdbcb05ab9c63d6343a1031f9031d175",triggerHash:"8ed1639b6ba4ddfc9a5659d7883703bc",functionHash:"8c99d747ddbc1c55f45c51afe08ad382",effectiveAclHash:"5440826e79d6d01961f000d3a5cba88b"};
export const ADMINISTRATION_TABLES=Object.freeze(["administration_decision_evidence","administration_decisions","administration_idempotency","administration_proposal_evidence","administration_proposals","administration_resource_evidence","administration_resources","administration_revisions","administration_schema","project_governance_versions"]);
// Same catalog snapshot as every historical child-root component. No other schema is normalized.
const normalized=(query:string):string=>query.replace("WHERE cn.nspname=expected.schema_name", "WHERE cn.nspname=expected.schema_name AND (NOT (expected.schema_name='app_administration' AND current_setting('server_version_num')::integer BETWEEN 170000 AND 179999) OR c.contype <> 'n')");
const capture=(query:string):string=>`WITH historical AS (${normalized(query)})
SELECT historical.*,current_setting('server_version_num') AS server_version_num,
 CASE WHEN schema_name='app_administration' THEN (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_tables WHERE schemaname='app_administration') ELSE NULL END AS administration_inventory
FROM historical ORDER BY schema_name`;
export const ADMINISTRATION_COMPATIBILITY_QUERY=capture(READINESS_QUERY);
export const ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY=capture(PUBLICATION_COMPATIBILITY_QUERY);
const hashes={columns_hash:administration.columnsHash,indexes_hash:administration.indexesHash,runtime_acl_hash:administration.runtimeAclHash,trigger_hash:administration.triggerHash,function_hash:administration.functionHash,effective_acl_hash:administration.effectiveAclHash};
export function administrationCompatibleRow(row:Record<string,unknown>):Record<string,unknown>{
 const version=row["server_version_num"];
 if(typeof version!=="string"|| !/^\d{6}$/.test(version))throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 const major=Math.floor(Number(version)/10000);
 if(major!==17&&major!==18)throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 if(row["schema_name"]!=="app_administration")throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 const inventory=row["administration_inventory"];
 if(!Array.isArray(inventory)||inventory.length!==10||inventory.some((name,i)=>name!==ADMINISTRATION_TABLES[i]))throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 // This semantic constraints component is never sufficient on its own.
 // Nullable state, all six remaining components, artifact and every existing authority gate stay exact.
 const exact:Record<string,unknown>={...hashes,artifact_sha256:administration.artifactSha256,table_count:10,schema_comment:administration.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false};
 for(const key of ["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"])exact[key]=0;
 if(Object.entries(exact).some(([key,value])=>row[key]!==value))throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 if(row["constraints_hash"]!==(major===17?"deca8e7e11e48e84be3e2155bf3e9c3b":administration.constraintsHash))throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
 return major===17?{...row,constraints_hash:administration.constraintsHash}:row;
}
/** Only the forward R3C2 composition uses this adapter; historical consumers stay exact. */
export function withAdministrationCatalogCompatibility(pool:PostgreSqlPoolPort):PostgreSqlPoolPort{
 return {close:():Promise<void>=>pool.close(),connect:async():Promise<PostgreSqlClientPort>=>{const client=await pool.connect();return {
  query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(sql!==READINESS_QUERY&&sql!==PUBLICATION_COMPATIBILITY_QUERY)return client.query<R>(sql,values);
   const result=await client.query<R>(sql===READINESS_QUERY?ADMINISTRATION_COMPATIBILITY_QUERY:ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY,values);
   if(result.rowCount!==5||result.rows.length!==5||new Set(result.rows.map(r=>r["schema_name"])).size!==5||result.rows.filter(r=>r["schema_name"]==="app_administration").length!==1)throw new Error("ADMINISTRATION_CATALOG_UNAVAILABLE");
   return {...result,rows:result.rows.map(row=>row["schema_name"]==="app_administration"?administrationCompatibleRow(row) as R:row)};
  },release:():void=>client.release()
 };}};
}
