import assert from "node:assert/strict";
import test from "node:test";
import { FORWARD_REGISTRATION_CONTRACT_ID, FORWARD_REGISTRATION_AUTHORITY_QUERY, assertForwardRegistrationContract, projectForwardRegistrationQuery, forwardRegistrationIdentityReady, validateForwardRegistrationAuthority } from "./forward-registration-readiness.js";
import type { PostgreSqlClientPort } from "../../../modules/identity/src/postgresql-pool.js";
import { R3C2C_COMPATIBILITY_QUERY } from "./r3c2c-catalog-compatibility.js";
import { REGISTRATION_OPERATOR_ACL_QUERY } from "../../../modules/identity/src/registration-operator-acl.js";

test("forward identity is explicit and rejects unknown contracts",()=>{
 assert.doesNotThrow(()=>assertForwardRegistrationContract(FORWARD_REGISTRATION_CONTRACT_ID));
 assert.throws(()=>assertForwardRegistrationContract("legacy"));
});

for(const major of ['170011','180004'])test(`supported PG ${major} authority identity`,()=>{
 assert.equal(forwardRegistrationIdentityReady([{current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',database:'postgres',server_version_num:major}], 'ai_mls_production_registration_operator'),true);
});
for(const changes of [{current_user:'postgres'},{session_user:'postgres'},{database:'other'},{server_version_num:'190000'},{server_version_num:'160000'}])test(`identity fails closed ${JSON.stringify(changes)}`,()=>{
 assert.equal(forwardRegistrationIdentityReady([{current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',database:'postgres',server_version_num:'170011',...changes}], 'ai_mls_production_registration_operator'),false);
});
for(const result of [[{ready:true}],[{ready:false}],[],[{ready:'true'}],[{ready:true},{ready:true}]])test(`authority cardinality and boolean ${JSON.stringify(result)}`,async()=>{
 const queries:string[]=[];
 const client:PostgreSqlClientPort={release(){ /* Caller owns the lease. */ },query:async<R extends Record<string,unknown>>(sql:string)=>{
  await Promise.resolve();
  queries.push(sql);const rows=queries.length===1?[{current_user:'ai_mls_production_registration_operator',session_user:'ai_mls_production_registration_operator',database:'postgres',server_version_num:'170011'}]:result;
  return {rows:rows as unknown as R[],rowCount:rows.length};
 }};
 if(result.length===1&&result[0]?.ready===true)await validateForwardRegistrationAuthority(client,FORWARD_REGISTRATION_CONTRACT_ID);
 else await assert.rejects(validateForwardRegistrationAuthority(client,FORWARD_REGISTRATION_CONTRACT_ID));
 assert.equal(queries[1],FORWARD_REGISTRATION_AUTHORITY_QUERY);
 assert.ok(queries.every(sql=>!/^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|GRANT|REVOKE|SET ROLE)/i.test(sql)));
});
test("authority is independent of historical Audit001 fingerprints",()=>{
 assert.ok(FORWARD_REGISTRATION_AUTHORITY_QUERY.includes("expected_memberships"));
 assert.ok(FORWARD_REGISTRATION_AUTHORITY_QUERY.includes("registration_acl_ok"));
 assert.ok(!FORWARD_REGISTRATION_AUTHORITY_QUERY.includes("cc5cf188"));
 assert.ok(!FORWARD_REGISTRATION_AUTHORITY_QUERY.includes("root.fingerprint"));
 assert.ok(FORWARD_REGISTRATION_AUTHORITY_QUERY.includes("rolconnlimit=-1"));
});
test("only exact current catalog queries receive an independent structural gate",()=>{
 const projected=projectForwardRegistrationQuery(R3C2C_COMPATIBILITY_QUERY);
 assert.ok(!projected.includes(REGISTRATION_OPERATOR_ACL_QUERY));
 assert.ok(!projected.includes(FORWARD_REGISTRATION_AUTHORITY_QUERY));
 assert.ok(!projected.includes("rolconnlimit"));
 assert.ok(!projected.includes("expected_memberships"));
 assert.ok(projected.includes("root_json"));
 assert.equal(projectForwardRegistrationQuery(REGISTRATION_OPERATOR_ACL_QUERY),REGISTRATION_OPERATOR_ACL_QUERY);
 assert.equal(projectForwardRegistrationQuery(R3C2C_COMPATIBILITY_QUERY+" "),R3C2C_COMPATIBILITY_QUERY+" ");
});
