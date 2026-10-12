import test from "node:test";
import assert from "node:assert/strict";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS, READINESS_QUERY, evaluateContracts } from "./child-root-postgresql-readiness.js";
import { publicationCompatibleRow, PUBLICATION_COMPATIBILITY_QUERY, withPublicationCatalogCompatibility } from "./publication-catalog-compatibility.js";
const contract=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[0]!;
const canonical=(major=17):Record<string,unknown>=>({artifact_sha256:contract.artifactSha256,table_count:8,schema_comment:contract.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false,...Object.fromEntries(["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"].map(k=>[k,0])),columns_hash:contract.columnsHash,indexes_hash:contract.indexesHash,runtime_acl_hash:contract.runtimeAclHash,trigger_hash:contract.triggerHash,function_hash:contract.functionHash,effective_acl_hash:contract.effectiveAclHash,schema_name:"app_publication",server_version_num:`${major}0011`,publication_inventory:["publication_audit","publication_dispatch_events","publication_events","publication_execution_intents","publication_execution_receipts","publication_idempotency","publication_schema","publication_scopes"],constraints_hash:major===17?"255e8c8df32fd9028dc98322da97a0b1":contract.constraintsHash});
test("PG17 bounded non-n component projection and PG18 historical exact",()=>{
 assert.equal(publicationCompatibleRow(canonical())["constraints_hash"],contract.constraintsHash);
 assert.deepEqual(publicationCompatibleRow(canonical(18)),canonical(18));
});
for(const [name,patch] of Object.entries({unknownMajor:{server_version_num:"160011"},constraints:{constraints_hash:"drift"},inventory:{publication_inventory:[]},missing:{schema_name:null}}))test(`${name} fails closed`,()=>assert.throws(()=>publicationCompatibleRow({...canonical(),...patch})));
test("query normalizes only Publication PG17 constraints and captures inventory in same snapshot",()=>{
 assert.match(PUBLICATION_COMPATIBILITY_QUERY,/expected.schema_name='app_publication'/);
 assert.match(PUBLICATION_COMPATIBILITY_QUERY,/c.contype <> 'n'/);
 assert.match(PUBLICATION_COMPATIBILITY_QUERY,/publication_inventory/);
});

for(const key of Object.keys(canonical()).filter(k=>!(["server_version_num","schema_name","publication_inventory","constraints_hash"].includes(k))))test(`exact component/authority drift: ${key}`,()=>assert.throws(()=>publicationCompatibleRow({...canonical(),[key]:"drift"})));

import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
test("forward adapter uses one snapshot; duplicate/malformed rows fail and lease releases",async()=>{
 let calls=0,releases=0;
 let rows:Record<string,unknown>[]=[canonical(),...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.slice(1).map(c=>({schema_name:c.schemaName}))];
 const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({release:()=>{releases++;},query:<R extends Record<string,unknown>>(sql:string)=>{calls++;assert.equal(sql,PUBLICATION_COMPATIBILITY_QUERY);return Promise.resolve({rows:rows as R[],rowCount:rows.length});}})};
 assert.equal((await evaluateContracts(withPublicationCatalogCompatibility(pool),[contract])).status,"READY");
 assert.equal(calls,1);assert.equal(releases,1);
 rows=[canonical(),canonical(),...rows.slice(2)];
 assert.equal((await evaluateContracts(withPublicationCatalogCompatibility(pool),[contract])).status,"NOT_READY");
 assert.equal(releases,2);
});
test("historical child-root query/constant and forward composition boundary unchanged",async()=>{
 const {readFile}=await import("node:fs/promises");
 assert.equal(contract.constraintsHash,"6ba8469f5859fb9e951e6f09872823d0");
 assert.doesNotMatch(READINESS_QUERY,/c.contype <> 'n'/);
 const source=await readFile("apps/api/src/r3c2-aggregate-readiness.ts","utf8");
 assert.match(source,/evaluateContracts\(withPublicationCatalogCompatibility\(pool\),contracts\)/);
});
