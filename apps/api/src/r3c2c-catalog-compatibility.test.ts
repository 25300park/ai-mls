import assert from "node:assert/strict";
import test from "node:test";
import { R3C2C_COMPONENTS, R3C2C_COMPATIBILITY_QUERY, r3c2cCompatibleRowsReady } from "./r3c2c-catalog-compatibility.js";
import { R3C2C_TEAM_CONTRACTS } from "./r3c2c-postgresql-readiness.js";
const rows=():Record<string,unknown>[]=>R3C2C_TEAM_CONTRACTS.map(c=>({schema_name:c.schemaName,table_name:c.tableName,authority_ok:true,server_version_num:"170011",fingerprint:"00000000000000000000000000000000",component_hashes:{...R3C2C_COMPONENTS[c.schemaName]}}));
test("PG17 exact two roots, independent of alternate fingerprint and registration absence",()=>{assert.equal(r3c2cCompatibleRowsReady(rows()),true);});
test("PG18 historical exact per root; unknown major denied",()=>{
 const canonical:Record<string,unknown>[]=rows().map((r,i)=>({...r,server_version_num:"180004",fingerprint:R3C2C_TEAM_CONTRACTS[i]!.fingerprint}));assert.equal(r3c2cCompatibleRowsReady(canonical),true);
 for(const i of [0,1]){const changed=canonical.map(r=>({...r}));changed[i]!["fingerprint"]="00000000000000000000000000000000";assert.equal(r3c2cCompatibleRowsReady(changed),false);}
 for(const v of ["160011","190000","17",170011,null])assert.equal(r3c2cCompatibleRowsReady(rows().map(r=>({...r,server_version_num:v}))),false);
});
test("matching rows, authority and malformed inputs fail closed per root",()=>{
 for(const r of [[],[rows()[0]!],[...rows(),rows()[0]!],[rows()[0]!,rows()[0]!],[null as unknown as Record<string,unknown>,rows()[1]!]])assert.equal(r3c2cCompatibleRowsReady(r),false);
 for(const i of [0,1])for(const patch of [{authority_ok:false},{table_name:"other"},{component_hashes:null},{component_hashes:[]},{component_hashes:{}},{fingerprint:null}]){const changed=rows();changed[i]={...changed[i],...patch};assert.equal(r3c2cCompatibleRowsReady(changed),false);}
});
for(const schema of ["app_audit","app_identity"] as const)for(const component of Object.keys(R3C2C_COMPONENTS[schema]!))test(`${schema}.${component} drift denied`,()=>{
 const changed=rows();const i=schema==="app_audit"?0:1;changed[i]={...changed[i],component_hashes:{...R3C2C_COMPONENTS[schema],[component]:"00000000000000000000000000000000"}};assert.equal(r3c2cCompatibleRowsReady(changed),false);
});
test("only constraints normalized; columns attnotnull, guard selection and mandatory wrapper retained",()=>{
 assert.match(R3C2C_COMPATIBILITY_QUERY,/a\.attnotnull/);assert.match(R3C2C_COMPATIBILITY_QUERY,/k\.contype <> 'n'/);assert.match(R3C2C_COMPATIBILITY_QUERY,/_authorization_team_guard/);assert.match(R3C2C_COMPATIBILITY_QUERY,/ORDER BY p\.oid/);assert.match(R3C2C_COMPATIBILITY_QUERY,/registration_operator/);
});
