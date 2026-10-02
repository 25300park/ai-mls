import assert from "node:assert/strict";
import test from "node:test";
import { AsyncProductionServiceIdentityResolver } from "./production-service-identity-resolver.js";
import type { AsyncRegisteredServiceWorkloadAuthorityLease } from "../../../modules/identity/src/registered-service-workload-postgresql.js";
import type { RegisteredServiceWorkloadRecord } from "../../../modules/identity/src/registered-service-workload.js";
const record: RegisteredServiceWorkloadRecord={registrationId:"registered",registrationVersion:3,tenantId:"tenant",principalId:"service",principalType:"SERVICE",assurance:"WORKLOAD",environment:"PRODUCTION",status:"ACTIVE",workloadPurpose:"startup",audience:"api",identityEvidenceRef:"proof",auditEvidenceRef:"audit",createdAt:"2026-10-02T00:00:00.000Z",updatedAt:"2026-10-02T00:00:00.000Z"};
function fixture(current: RegisteredServiceWorkloadRecord | undefined=record) {
  const reads: string[]=[];
  const authority: AsyncRegisteredServiceWorkloadAuthorityLease={ findByRegistrationId(id){reads.push(id);return Promise.resolve(current);},assertSchemaReady(){return Promise.reject(new Error("schema gate must remain separate"));},close(){return Promise.reject(new Error("child resolver must not close authority"));} };
  return {reads,resolver:new AsyncProductionServiceIdentityResolver({authority,expectedWorkloadPurpose:"startup",expectedAudience:"api"})};
}
test("R3-C2 async resolver pins exact registration/version and preserves service principal tuple",async()=>{
  const {resolver,reads}=fixture();const identity=await resolver.resolve({registrationId:"registered",registrationVersion:3});
  assert.equal(identity.principalId,"service");assert.equal(identity.tenantId,"tenant");assert.equal(identity.registrationVersion,3);assert.equal(Object.isFrozen(identity),true);
  await resolver.assertStillActive(identity);assert.deepEqual(reads,["registered","registered"]);
});
test("R3-C2 missing malformed or unpinned reference fails before any lookup",async()=>{
  const {resolver,reads}=fixture();
  for(const ref of [{registrationId:"registered"},{registrationId:"registered",registrationVersion:0},{registrationId:"registered",registrationVersion:Number.MAX_SAFE_INTEGER+1},{registrationId:"registered",registrationVersion:3,latest:true}]) await assert.rejects(resolver.resolve(ref as {registrationId:string;registrationVersion:number}),{code:"PRODUCTION_SERVICE_IDENTITY_UNAVAILABLE"});
  assert.deepEqual(reads,[]);
});
test("R3-C2 wrong version or registration never falls back to latest/default/alternate workload",async()=>{
  const {resolver,reads}=fixture();await assert.rejects(resolver.resolve({registrationId:"registered",registrationVersion:2}));await assert.rejects(resolver.resolve({registrationId:"other",registrationVersion:3}));assert.deepEqual(reads,["registered","other"]);
});
test("R3-C2 ineligible classification lifecycle purpose or audience fail closed",async()=>{
  for(const patch of [{status:"SUSPENDED"},{status:"REVOKED"},{principalType:"HUMAN"},{assurance:"SESSION"},{environment:"TEST"},{workloadPurpose:"different"},{audience:"different"}]){
    const {resolver}=fixture({...record,...patch} as RegisteredServiceWorkloadRecord);await assert.rejects(resolver.resolve({registrationId:"registered",registrationVersion:3}));
  }
});
test("R3-C2 revalidation rejects changed captured registration without selecting a newer version",async()=>{
  const prior=await fixture().resolver.resolve({registrationId:"registered",registrationVersion:3});
  for(const patch of [{registrationVersion:4},{principalId:"different"},{identityEvidenceRef:"different"},{tenantId:"different"}])await assert.rejects(fixture({...record,...patch}).resolver.assertStillActive(prior));
});
