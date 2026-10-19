import { childRootFailure, rootRequirement } from './child-root-diagnostics.js';
import { READINESS_QUERY, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
import type { PostgreSqlPoolPort, PostgreSqlClientPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
const publication=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[0]!;
export const PUBLICATION_TABLES=Object.freeze(["publication_audit","publication_dispatch_events","publication_events","publication_execution_intents","publication_execution_receipts","publication_idempotency","publication_schema","publication_scopes"]);
// Same catalog snapshot as every historical child-root component. No other schema is normalized.
const material=READINESS_QUERY.replace("WHERE cn.nspname=expected.schema_name) AS constraints_hash", "WHERE cn.nspname=expected.schema_name AND (NOT (expected.schema_name='app_publication' AND current_setting('server_version_num')::integer BETWEEN 170000 AND 179999) OR c.contype <> 'n')) AS constraints_hash");
export const PUBLICATION_COMPATIBILITY_QUERY=`WITH historical AS (${material})
SELECT historical.*,current_setting('server_version_num') AS server_version_num,
 CASE WHEN schema_name='app_publication' THEN (SELECT array_agg(tablename::text ORDER BY tablename) FROM pg_tables WHERE schemaname='app_publication') ELSE NULL END AS publication_inventory
FROM historical ORDER BY schema_name`;
const hashes={columns_hash:publication.columnsHash,indexes_hash:publication.indexesHash,runtime_acl_hash:publication.runtimeAclHash,trigger_hash:publication.triggerHash,function_hash:publication.functionHash,effective_acl_hash:publication.effectiveAclHash};
export function publicationCompatibleRow(row:Record<string,unknown>):Record<string,unknown>{
 const version=row["server_version_num"];
 if(typeof version!=="string"|| !/^\d{6}$/.test(version))throw childRootFailure('PUBLICATION','SERVER_VERSION');
 const major=Math.floor(Number(version)/10000);
 if(major!==17&&major!==18)throw childRootFailure('PUBLICATION','SERVER_VERSION');
 if(row["schema_name"]!=="app_publication")throw childRootFailure('PUBLICATION','ROOT_CARDINALITY');
 const inventory=row["publication_inventory"];
 if(!Array.isArray(inventory)||inventory.length!==8||inventory.some((name,i)=>name!==PUBLICATION_TABLES[i]))throw childRootFailure('PUBLICATION','INVENTORY');
 // This semantic constraints component is never sufficient on its own.
 // Nullable state, all six remaining components, artifact and every existing authority gate stay exact.
 const exact:Record<string,unknown>={...hashes,artifact_sha256:publication.artifactSha256,table_count:8,schema_comment:publication.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false};
 for(const key of ["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"])exact[key]=0;
 const mismatch=Object.entries(exact).find(([key,value])=>row[key]!==value);
 if(mismatch)throw childRootFailure('PUBLICATION',rootRequirement(mismatch[0]));
 if(row["constraints_hash"]!==(major===17?"255e8c8df32fd9028dc98322da97a0b1":publication.constraintsHash))throw childRootFailure('PUBLICATION','CONSTRAINTS');
 return major===17?{...row,constraints_hash:publication.constraintsHash}:row;
}
/** Only the forward R3C2 composition uses this adapter; historical consumers stay exact. */
export function withPublicationCatalogCompatibility(pool:PostgreSqlPoolPort):PostgreSqlPoolPort{
 return {close:():Promise<void>=>pool.close(),connect:async():Promise<PostgreSqlClientPort>=>{const client=await pool.connect();return {
  query:async<R extends Record<string,unknown>>(sql:string,values?:readonly unknown[]):Promise<PostgreSqlQueryResult<R>>=>{
   if(sql!==READINESS_QUERY)return client.query<R>(sql,values);
   const result=await client.query<R>(PUBLICATION_COMPATIBILITY_QUERY,values);
   if(result.rowCount!==5||result.rows.length!==5||new Set(result.rows.map(r=>r["schema_name"])).size!==5||result.rows.filter(r=>r["schema_name"]==="app_publication").length!==1)throw childRootFailure('PUBLICATION','ROOT_CARDINALITY');
   return {...result,rows:result.rows.map(row=>row["schema_name"]==="app_publication"?publicationCompatibleRow(row) as R:row)};
  },release:():void=>client.release()
 };}};
}
