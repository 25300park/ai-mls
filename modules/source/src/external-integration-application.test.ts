import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SessionContext } from "../../identity/src/session-service.js";
import { ExternalIntegrationEvidenceApplication, type ExternalIntegrationTrustedContext } from "./external-integration-application.js";
import { DurableExternalIntegrationStore } from "./external-integration-durable-persistence.js";

const now="2026-09-02T00:00:00.000Z";
const session:SessionContext=Object.freeze({id:"session-1",principalId:"service-1",principalType:"SERVICE",roles:Object.freeze(["SVC"] as const),teamId:"team-1",state:"ACTIVE",assurance:"WORKLOAD",isMfaVerified:false,authenticatedAt:now,expiresAt:"2026-09-02T01:00:00.000Z",absoluteExpiresAt:"2026-09-02T02:00:00.000Z",familyId:"family-1",refreshReference:"non-sensitive-reference"});
const context:ExternalIntegrationTrustedContext=Object.freeze({session,tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"});
function fixture(options:Readonly<{authorized?:boolean;binding?:boolean;context?:ExternalIntegrationTrustedContext}>={}){
 const store=new DurableExternalIntegrationStore({databasePath:join(mkdtempSync(join(tmpdir(),"f18-e-app-")),"external.sqlite")});
 const unresolvedConflictLinks:unknown[]=[];
 const dependencies={store,contextResolver:{resolve:()=>options.context??context},authorizer:{authorize:()=>options.authorized??true},bindingResolver:{resolve:()=>options.binding===false?undefined:Object.freeze({integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"})},clock:()=>now,unresolvedConflictCaseWriter:{linkUnresolvedConflict:(input:unknown)=>{unresolvedConflictLinks.push(input);}}};
 const application=new ExternalIntegrationEvidenceApplication(dependencies);
 return {application,store,unresolvedConflictLinks,close:()=>store.close()};
}
const register={operation:"RegisterExternalMapping",integrationContractId:"contract-1",providerNamespace:"provider-1",externalObjectId:"external-1",internalResourceType:"SOURCE",internalResourceId:"source-1",idempotencyKey:"idem-map",evidenceRef:"evidence:mapping:1"};

test("F18-E uses trusted governed binding for mapping, observation, reconciliation, suspension, and safe reads",()=>{
 const f=fixture();try{
  const created=f.application.execute("COMMAND",register,"session-1");assert.equal(created.ok,true);
  const observed=f.application.execute("COMMAND",{operation:"SubmitProviderObservation",integrationContractId:"contract-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",connectorId:"connector-1",sourceId:"source-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:now,idempotencyKey:"idem-observation",expectedMappingVersion:1},"session-1");assert.equal(observed.ok,true);
  const mappingId=created.ok?String(created.data["mappingId"]):"";
  assert.equal(f.application.execute("COMMAND",{operation:"ReconcileIntegrationEvidence",integrationContractId:"contract-1",mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:mapping:1"],observationIds:["observation-1"],idempotencyKey:"idem-reconcile"},"session-1").ok,true);
  assert.equal(f.application.execute("QUERY",{operation:"ReadExternalMapping",mappingId},"session-1").ok,true);
  assert.equal(f.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1").ok,true);
  const contract=f.application.execute("QUERY",{operation:"ReadIntegrationContract",integrationContractId:"contract-1"},"session-1");assert.equal(contract.ok,true);if(contract.ok)assert.equal(contract.data["technicalStatus"],"SUSPENDED");
 }finally{f.close();}
});

test("F18-E fails closed without current session, authorization, or governed binding",()=>{
 for(const options of [{context:Object.freeze({...context,session:Object.freeze({...session,state:"REVOKED" as const})})},{authorized:false},{binding:false}]){
  const f=fixture(options);try{const result=f.application.execute("COMMAND",register,"session-1");assert.equal(result.ok,false);assert.equal(f.store.readContract({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},"contract-1"),undefined);}finally{f.close();}
 }
});

test("F18-E conceals cross-tenant mappings and suspended contracts reject further observation",()=>{
 const f=fixture();try{const created=f.application.execute("COMMAND",register,"session-1");assert.equal(created.ok,true);const mappingId=created.ok?String(created.data["mappingId"]):"";
  const other=fixture({context:Object.freeze({...context,tenantId:"tenant-2"})});try{assert.deepEqual(other.application.execute("QUERY",{operation:"ReadExternalMapping",mappingId},"session-1"),{ok:false,error:{code:"NOT_FOUND",message:"External integration resource is unavailable."}});}finally{other.close();}
  f.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1");
  const blocked=f.application.execute("COMMAND",{operation:"SubmitProviderObservation",integrationContractId:"contract-1",observationId:"observation-2",providerNamespace:"provider-1",externalObjectId:"external-1",connectorId:"connector-1",sourceId:"source-1",observationType:"STATUS",normalizedFields:{active:false},observedAt:now,idempotencyKey:"idem-o2",expectedMappingVersion:1},"session-1");assert.deepEqual(blocked,{ok:false,error:{code:"FORBIDDEN",message:"External integration operation is not permitted."}});
 }finally{f.close();}
});

test("F19-E links unresolved API-019 technical evidence to one trusted External Integration case without changing the mapping",()=>{
 const f=fixture();try{
  const created=f.application.execute("COMMAND",register,"session-1");assert.equal(created.ok,true);
  const mappingId=created.ok?String(created.data["mappingId"]):"";
  const beforeMapping=f.store.readMappingById({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},mappingId);
  const unresolved=f.application.execute("COMMAND",{operation:"ReconcileIntegrationEvidence",integrationContractId:"contract-1",mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:unproven:f19-e"],observationIds:[],idempotencyKey:"idem-reconcile-f19-e"},"session-1");
  assert.equal(unresolved.ok,true);if(unresolved.ok)assert.equal(unresolved.data["reconciliationStatus"],"UNRESOLVED_CONFLICT");
  const technicalEvidence=f.store.listEvidence({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},"contract-1").filter(item=>item.kind==="TECHNICAL_RECONCILIATION");
  assert.equal(technicalEvidence.length,1);
  assert.deepEqual(f.unresolvedConflictLinks,[{
   integrationContractId:"contract-1",mappingId,conflictEvidenceId:technicalEvidence[0]?.evidenceId,
   tenantId:"tenant-1",scopeRef:"source:source-1",evidenceRefs:[technicalEvidence[0]?.evidenceId],
   createdBy:"service-1",createdAt:now,
  }]);
  assert.deepEqual(f.store.readMappingById({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},mappingId),beforeMapping);
 }finally{f.close();}
});
