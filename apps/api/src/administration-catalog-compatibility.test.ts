import test from "node:test";
import assert from "node:assert/strict";
import { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS, READINESS_QUERY, evaluateContracts } from "./child-root-postgresql-readiness.js";
import { administrationCompatibleRow, ADMINISTRATION_COMPATIBILITY_QUERY, withAdministrationCatalogCompatibility } from "./administration-catalog-compatibility.js";
import { R3C2_ADMINISTRATION_SCHEMA_OVERLAY } from "./r3c2-aggregate-readiness.js";
const contract={...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS[1]!,...R3C2_ADMINISTRATION_SCHEMA_OVERLAY};
const canonical=(major=17):Record<string,unknown>=>({artifact_sha256:contract.artifactSha256,table_count:10,schema_comment:contract.schemaComment,owner_name:"ai_mls_production_migration_operator",runtime_usage:true,runtime_create:false,unexpected_role_membership:false,...Object.fromEntries(["public_acl_count","runtime_grant_option_count","table_owner_violation_count","function_owner_violation_count","table_acl_violation_count","unexpected_runtime_membership_count","public_schema_acl_count","schema_grant_option_count","function_acl_violation_count","sequence_count"].map(k=>[k,0])),columns_hash:contract.columnsHash,indexes_hash:contract.indexesHash,runtime_acl_hash:contract.runtimeAclHash,trigger_hash:contract.triggerHash,function_hash:contract.functionHash,effective_acl_hash:contract.effectiveAclHash,schema_name:"app_administration",server_version_num:`${major}0011`,administration_inventory:["administration_decision_evidence","administration_decisions","administration_idempotency","administration_proposal_evidence","administration_proposals","administration_resource_evidence","administration_resources","administration_revisions","administration_schema","project_governance_versions"],constraints_hash:major===17?"deca8e7e11e48e84be3e2155bf3e9c3b":contract.constraintsHash});
test("PG17 bounded non-n component projection and PG18 historical exact",()=>{
 assert.equal(administrationCompatibleRow(canonical())["constraints_hash"],contract.constraintsHash);
 assert.deepEqual(administrationCompatibleRow(canonical(18)),canonical(18));
});
for(const [name,patch] of Object.entries({unknownMajor:{server_version_num:"160011"},constraints:{constraints_hash:"drift"},inventory:{administration_inventory:[]},missing:{schema_name:null}}))test(`${name} fails closed`,()=>assert.throws(()=>administrationCompatibleRow({...canonical(),...patch})));
test("query normalizes only Administration PG17 constraints and captures inventory in same snapshot",()=>{
 assert.match(ADMINISTRATION_COMPATIBILITY_QUERY,/expected.schema_name='app_administration'/);
 assert.match(ADMINISTRATION_COMPATIBILITY_QUERY,/c.contype <> 'n'/);
 assert.match(ADMINISTRATION_COMPATIBILITY_QUERY,/administration_inventory/);
});

for(const key of Object.keys(canonical()).filter(k=>!(["server_version_num","schema_name","administration_inventory","constraints_hash"].includes(k))))test(`exact component/authority drift: ${key}`,()=>assert.throws(()=>administrationCompatibleRow({...canonical(),[key]:"drift"})));

import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
test("forward adapter uses one snapshot; duplicate/malformed rows fail and lease releases",async()=>{
 let calls=0,releases=0;
 let rows:Record<string,unknown>[]=[canonical(),...R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.filter(c=>c.schemaName!=="app_administration").map(c=>({schema_name:c.schemaName}))];
 const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({release:()=>{releases++;},query:<R extends Record<string,unknown>>(sql:string)=>{calls++;assert.equal(sql,ADMINISTRATION_COMPATIBILITY_QUERY);return Promise.resolve({rows:rows as R[],rowCount:rows.length});}})};
 assert.equal((await evaluateContracts(withAdministrationCatalogCompatibility(pool),[contract])).status,"READY");
 assert.equal(calls,1);assert.equal(releases,1);
 rows=[canonical(),canonical(),...rows.slice(2)];
 assert.equal((await evaluateContracts(withAdministrationCatalogCompatibility(pool),[contract])).status,"NOT_READY");
 assert.equal(releases,2);
});
test("historical child-root query/constant and forward composition boundary unchanged",async()=>{
 const {readFile}=await import("node:fs/promises");
 assert.equal(contract.constraintsHash,"8cf02a2621c0025cd9da20aa8067a6a0");
 assert.doesNotMatch(READINESS_QUERY,/c.contype <> 'n'/);
 const source=await readFile("apps/api/src/r3c2-aggregate-readiness.ts","utf8");
 assert.match(source,/pool=withAdministrationCatalogCompatibility\(pool\)/);
});



import { ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY } from "./administration-catalog-compatibility.js";
test("combined query preserves Publication and applies Administration in one snapshot",()=>{
 assert.match(ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY,/expected.schema_name='app_administration'/);
 assert.match(ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY,/expected.schema_name='app_publication'/);
 assert.match(ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY,/administration_inventory/);
 assert.match(ADMINISTRATION_PUBLICATION_COMPATIBILITY_QUERY,/publication_inventory/);
});
test("PG18 does not whitelist the PG17 constraints hash",()=>assert.throws(()=>administrationCompatibleRow({...canonical(18),constraints_hash:canonical()["constraints_hash"]})));
test("incomplete result fails closed and unrelated queries pass through",async()=>{
 let releases=0;let lastSql="";
 const pool:PostgreSqlPoolPort={close:()=>Promise.resolve(),connect:()=>Promise.resolve({release:()=>{releases++;},query:<R extends Record<string,unknown>>(sql:string)=>{lastSql=sql;return Promise.resolve({rows:[canonical()] as R[],rowCount:1});}})};
 assert.equal((await evaluateContracts(withAdministrationCatalogCompatibility(pool),[contract])).status,"NOT_READY");
 assert.equal(releases,1);
 const client=await withAdministrationCatalogCompatibility(pool).connect();
 await client.query("SELECT current_user AS role");
 assert.equal(lastSql,"SELECT current_user AS role");client.release();
});
