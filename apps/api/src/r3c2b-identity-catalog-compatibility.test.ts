import assert from "node:assert/strict";
import test from "node:test";
import { R3C2B_IDENTITY_COMPONENTS, R3C2B_IDENTITY_COMPATIBILITY_QUERY, r3c2bIdentityCompatibleRowsReady } from "./r3c2b-identity-catalog-compatibility.js";
const row=():Record<string,unknown>=>({schema_name:"app_identity",table_name:"identity_workload_evidence",server_version_num:"170011",authority_ok:true,fingerprint:"175b48a0962f684c34b6f9f5ad7a9956",component_hashes:{...R3C2B_IDENTITY_COMPONENTS}});
test("PG17 validates every component independently of operator presence or alternate hash",()=>{
 for(const present of [false,true])assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),registration_operator_present:present}]),true);
 assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),component_hashes:{}}]),false);
});
test("PG18 historical exact and unsupported major fail closed",()=>{
 assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),server_version_num:"180004",fingerprint:"88222856a373735336da52e4cae9f2c8"}]),true);
 assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),server_version_num:"180004"}]),false);
 for(const version of ["160011","190000",170011,null,"17"])assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),server_version_num:version}]),false);
});
test("exact root cardinality and authority required",()=>{
 for(const rows of [[],[row(),row()],[{...row(),authority_ok:false}],[{...row(),schema_name:"app_audit"}],[{...row(),table_name:"other"}],[{...row(),fingerprint:null}],[null as unknown as Record<string,unknown>]])assert.equal(r3c2bIdentityCompatibleRowsReady(rows),false);
});
for(const component of Object.keys(row()["component_hashes"] as object))test(`${component} drift denied with canonical fingerprint`,()=>{
 assert.equal(r3c2bIdentityCompatibleRowsReady([{...row(),component_hashes:{...R3C2B_IDENTITY_COMPONENTS,[component]:"00000000000000000000000000000000"}}]),false);
});
test("query normalization is Identity-only and preserves attnotnull and registration gate",()=>{
 assert.match(R3C2B_IDENTITY_COMPATIBILITY_QUERY,/a\.attnotnull/);
 assert.match(R3C2B_IDENTITY_COMPATIBILITY_QUERY,/k\.contype <> 'n'/);
 assert.match(R3C2B_IDENTITY_COMPATIBILITY_QUERY,/server_version_num/);
 assert.match(R3C2B_IDENTITY_COMPATIBILITY_QUERY,/registration_operator/);
 assert.match(R3C2B_IDENTITY_COMPATIBILITY_QUERY,/^WITH material AS \(WITH expected\(schema_name,table_name\) AS \(VALUES \('app_identity','identity_workload_evidence'\)\)/);
});
