import test from "node:test";
import assert from "node:assert/strict";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS, READINESS_QUERY, evaluateContracts } from "./child-root-postgresql-readiness.js";
import { externalIntegrationCompatibleRow, EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY, withExternalIntegrationCatalogCompatibility } from "./external-integration-catalog-compatibility.js";
const contract=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[3]!;
const canonical=(major=17):Record<string,unknown>=>({artifact_sha256:contract.artifactSha256,table_count:5,schema_comment:contract.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false,...Object.fromEntries(["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"].map(k=>[k,0])),columns_hash:contract.columnsHash,indexes_hash:contract.indexesHash,runtime_acl_hash:contract.runtimeAclHash,trigger_hash:contract.triggerHash,function_hash:contract.functionHash,effective_acl_hash:contract.effectiveAclHash,schema_name:"app_external_integration",server_version_num:`${major}0011`,external_integration_inventory:["ext_contracts","ext_evidence","ext_idempotency","ext_mappings","ext_observations"],constraints_hash:major===17?"18486b92d120924d8f23a6a8b6c1b31f":contract.constraintsHash});
test("PG17 bounded non-n component projection and PG18 historical exact",()=>{
 assert.equal(externalIntegrationCompatibleRow(canonical())["constraints_hash"],contract.constraintsHash);
 assert.deepEqual(externalIntegrationCompatibleRow(canonical(18)),canonical(18));
});
for(const [name,patch] of Object.entries({unknownMajor:{server_version_num:"160011"},constraints:{constraints_hash:"drift"},inventory:{external_integration_inventory:[]},missing:{schema_name:null}}))test(`${name} fails closed`,()=>assert.throws(()=>externalIntegrationCompatibleRow({...canonical(),...patch})));
test("query normalizes only ExternalIntegration PG17 constraints and captures inventory in same snapshot",()=>{
 assert.match(EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY,/expected.schema_name='app_external_integration'/);
 assert.match(EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY,/c.contype <> 'n'/);
 assert.match(EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY,/external_integration_inventory/);
});

for(const key of Object.keys(canonical()).filter(k=>!(["server_version_num","schema_name","external_integration_inventory","constraints_hash"].includes(k))))test(`exact component/authority drift: ${key}`,()=>assert.throws(()=>externalIntegrationCompatibleRow({...canonical(),[key]:"drift"})));

import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
test("forward adapter uses one snapshot; duplicate/malformed rows fail and lease releases",async()=>{
 let calls=0,releases=0;
 let rows:Record<string,unknown>[]=[canonical(),...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter(c=>c.schemaName!=="app_external_integration").map(c=>({schema_name:c.schemaName}))];
 const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({release:()=>{releases++;},query:<R extends Record<string,unknown>>(sql:string)=>{calls++;assert.equal(sql,EXTERNAL_INTEGRATION_COMPATIBILITY_QUERY);return Promise.resolve({rows:rows as R[],rowCount:rows.length});}})};
 assert.equal((await evaluateContracts(withExternalIntegrationCatalogCompatibility(pool),[contract])).status,"READY");
 assert.equal(calls,1);assert.equal(releases,1);
 rows=[canonical(),canonical(),...rows.slice(2)];
 assert.equal((await evaluateContracts(withExternalIntegrationCatalogCompatibility(pool),[contract])).status,"NOT_READY");
 assert.equal(releases,2);
});
test("historical child-root query/constant and forward composition boundary unchanged",async()=>{
 const {readFile}=await import("node:fs/promises");
 assert.equal(contract.constraintsHash,"33533b7e20fa31f87ef1d3b38f740f4e");
 assert.doesNotMatch(READINESS_QUERY,/c.contype <> 'n'/);
 const source=await readFile("apps/api/src/r3c2-aggregate-readiness.ts","utf8");
 assert.match(source,/pool=withExternalIntegrationCatalogCompatibility\(pool\)/);
});



import { EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY } from "./external-integration-catalog-compatibility.js";
test("combined query preserves Publication and applies ExternalIntegration in one snapshot",()=>{
 assert.match(EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,/expected.schema_name='app_external_integration'/);
 assert.match(EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,/expected.schema_name='app_publication'/);
 assert.match(EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,/expected.schema_name='app_administration'/);
 assert.match(EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,/external_integration_inventory/);
 assert.match(EXTERNAL_INTEGRATION_FORWARD_COMPATIBILITY_QUERY,/publication_inventory/);
});
test("PG18 does not whitelist the PG17 constraints hash",()=>assert.throws(()=>externalIntegrationCompatibleRow({...canonical(18),constraints_hash:canonical()["constraints_hash"]})));
test("incomplete result fails closed and unrelated queries pass through",async()=>{
 let releases=0;let lastSql="";
 const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({release:()=>{releases++;},query:<R extends Record<string,unknown>>(sql:string)=>{lastSql=sql;return Promise.resolve({rows:[canonical()] as R[],rowCount:1});}})};
 assert.equal((await evaluateContracts(withExternalIntegrationCatalogCompatibility(pool),[contract])).status,"NOT_READY");
 assert.equal(releases,1);
 const client=await withExternalIntegrationCatalogCompatibility(pool).connect();
 await client.query("SELECT current_user AS role");
 assert.equal(lastSql,"SELECT current_user AS role");client.release();
});
