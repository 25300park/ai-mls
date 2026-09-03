import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { SessionContext } from "../../identity/src/session-service.js";
import { DurableRecoveryOrchestrationStore } from "../../recovery/src/recovery-durable-persistence.js";
import { RecoveryOrchestrationApplication, type RecoveryTrustedContext } from "../../recovery/src/recovery-orchestration-service.js";
import * as sourceExports from "./index.js";
import { ExternalIntegrationEvidenceApplication, type ExternalIntegrationTrustedContext, type ExternalIntegrationUnresolvedConflictCaseWriter } from "./external-integration-application.js";
import { DurableExternalIntegrationStore, type ExternalIntegrationScope } from "./external-integration-durable-persistence.js";

const now="2026-09-03T01:00:00.000Z";
const scope=Object.freeze({tenantId:"tenant-f19-e",scopeType:"SOURCE",scopeId:"source-f19-e",connectorId:"connector-f19-e",sourceId:"source-f19-e"} satisfies ExternalIntegrationScope);
const scopeRef="source:source-f19-e";
const technicalSession:SessionContext=Object.freeze({id:"session-technical-f19-e",principalId:"api-019-service-f19-e",principalType:"SERVICE",roles:Object.freeze(["SVC"] as const),teamId:scope.scopeId,state:"ACTIVE",assurance:"WORKLOAD",isMfaVerified:false,authenticatedAt:"2026-09-03T00:00:00.000Z",expiresAt:"2026-09-03T02:00:00.000Z",absoluteExpiresAt:"2026-09-03T03:00:00.000Z",familyId:"family-technical-f19-e",refreshReference:"refresh-reference-f19-e"});
const resolverSession:SessionContext=Object.freeze({...technicalSession,id:"session-resolver-f19-e",principalId:"resolver-f19-e",principalType:"HUMAN",roles:Object.freeze(["OPS"] as const),assurance:"MFA",isMfaVerified:true,familyId:"family-resolver-f19-e"});
const technicalContext:ExternalIntegrationTrustedContext=Object.freeze({session:technicalSession,...scope,purpose:"EXTERNAL_EVIDENCE"});
const binding=Object.freeze({integrationContractId:"contract-f19-e",providerNamespace:"provider-f19-e",connectorId:scope.connectorId,sourceId:scope.sourceId,governedBindingRef:"governance:binding:f19-e",evidenceRef:"evidence:contract:f19-e"});
const register=Object.freeze({operation:"RegisterExternalMapping",integrationContractId:binding.integrationContractId,providerNamespace:binding.providerNamespace,externalObjectId:"external-f19-e",internalResourceType:"SOURCE",internalResourceId:"source-original-f19-e",idempotencyKey:"mapping-f19-e",evidenceRef:"evidence:mapping:f19-e"});

type LinkedCase=NonNullable<ReturnType<DurableRecoveryOrchestrationStore["findCase"]>>;

function exportedWriter(store:DurableRecoveryOrchestrationStore,onCreated:(record:LinkedCase)=>void):ExternalIntegrationUnresolvedConflictCaseWriter{
 const Constructor=Reflect.get(sourceExports,"ExternalIntegrationUnresolvedConflictCaseWriterAdapter");
 if(typeof Constructor!=="function")assert.fail("ExternalIntegrationUnresolvedConflictCaseWriterAdapter is not implemented");
 const boundary={createCase(input:Parameters<DurableRecoveryOrchestrationStore["createCase"]>[0]){const record=store.createCase(input);onCreated(record);return record;}};
 return Reflect.construct(Constructor,[boundary]) as ExternalIntegrationUnresolvedConflictCaseWriter;
}

function harness(){
 const directory=mkdtempSync(join(tmpdir(),"ai-mls-f19-e-"));
 const external=new DurableExternalIntegrationStore({databasePath:join(directory,"external.sqlite")});
 const recovery=new DurableRecoveryOrchestrationStore({databasePath:join(directory,"recovery.sqlite")});
 let linked:LinkedCase|undefined;
 const writer=exportedWriter(recovery,(record)=>{linked=record;});
 const dependencies={store:external,contextResolver:{resolve:()=>technicalContext},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>binding},clock:()=>now,unresolvedConflictCaseWriter:writer};
 const technical=new ExternalIntegrationEvidenceApplication(dependencies);
 const recoveryContext:RecoveryTrustedContext=Object.freeze({session:resolverSession,tenantId:scope.tenantId,scopeRef,purpose:"RECONCILIATION_RECOVERY"});
 let identityValidations=0;
 const recoveryApplication=new RecoveryOrchestrationApplication({store:recovery,contextResolver:{resolve:()=>recoveryContext},authorizer:{authorize:()=>true},executionIdentityValidator:{validate:()=>{identityValidations+=1;return true;}},clock:{now:()=>now}});
 return {directory,external,recovery,technical,recoveryApplication,identityValidations:()=>identityValidations,linked:()=>linked,close(){external.close();recovery.close();rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:20});}};
}

function createUnresolved(value:ReturnType<typeof harness>,withObservation=false){
 const created=value.technical.execute("COMMAND",register,technicalSession.id);assert.equal(created.ok,true);
 const mappingId=created.ok?String(created.data["mappingId"]):"";
 let observation:ReturnType<ExternalIntegrationEvidenceApplication["execute"]>|undefined;
 if(withObservation)observation=value.technical.execute("COMMAND",{operation:"SubmitProviderObservation",integrationContractId:binding.integrationContractId,observationId:"observation-f19-e",providerNamespace:binding.providerNamespace,externalObjectId:"external-f19-e",connectorId:scope.connectorId,sourceId:scope.sourceId,observationType:"STATUS",normalizedFields:{active:true},observedAt:now,idempotencyKey:"observation-f19-e",expectedMappingVersion:1},technicalSession.id);
 const command=Object.freeze({operation:"ReconcileIntegrationEvidence",integrationContractId:binding.integrationContractId,mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:Object.freeze(["evidence:unproven:f19-e"]),observationIds:Object.freeze(withObservation?["observation-f19-e"]:[]),idempotencyKey:"reconciliation-f19-e"});
 const reconciliation=value.technical.execute("COMMAND",command,technicalSession.id);assert.equal(reconciliation.ok,true);
 const linked=value.linked();assert.ok(linked);
 return {mappingId,observation,command,reconciliation,linked};
}

function externalSnapshot(value:ReturnType<typeof harness>,mappingId:string){
 return structuredClone({contract:value.external.readContract(scope,binding.integrationContractId),mapping:value.external.readMappingById(scope,mappingId),observations:value.external.listObservations(scope,binding.integrationContractId),evidence:value.external.listEvidence(scope,binding.integrationContractId)});
}

function recoverySnapshot(value:ReturnType<typeof harness>,recoveryCaseId:string){return structuredClone(value.recovery.findCase(recoveryCaseId));}

function withHarness(run:(value:ReturnType<typeof harness>)=>void):void{const value=harness();try{run(value);}finally{value.close();}}

test("F19-E durable adapter links exact contract, mapping, observation and conflict evidence lineage without duplication",()=>withHarness((value)=>{
 const result=createUnresolved(value,true);
 assert.equal(result.reconciliation.ok,true);if(result.reconciliation.ok)assert.equal(result.reconciliation.data["reconciliationStatus"],"UNRESOLVED_CONFLICT");
 if(result.reconciliation.ok)assert.equal(result.reconciliation.data["observationId"],"observation-f19-e");
 const technicalEvidence=value.external.listEvidence(scope,binding.integrationContractId).filter(item=>item.kind==="TECHNICAL_RECONCILIATION");
 assert.equal(technicalEvidence.length,1);
 assert.deepEqual(result.linked,{recoveryCaseId:result.linked.recoveryCaseId,resourceType:"ExternalIntegrationMapping",resourceId:result.mappingId,originDomain:"EXTERNAL_INTEGRATION",originIdentity:{integrationContractId:binding.integrationContractId,mappingId:result.mappingId,observationId:"observation-f19-e",conflictEvidenceId:technicalEvidence[0]?.evidenceId},tenantId:scope.tenantId,scopeRef,status:"OPEN",version:1,evidenceRefs:[technicalEvidence[0]?.evidenceId],createdBy:technicalSession.principalId,createdAt:now});
 const beforeExternal=externalSnapshot(value,result.mappingId);const beforeCase=recoverySnapshot(value,result.linked.recoveryCaseId);
 assert.deepEqual(value.technical.execute("COMMAND",result.command,technicalSession.id),result.reconciliation);
 assert.deepEqual(externalSnapshot(value,result.mappingId),beforeExternal);
 assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeCase);
}));

test("F19-E rejects missing and cross-mapping observations before technical evidence or case mutation",()=>{
 for(const scenario of ["missing","cross-mapping"] as const)withHarness((value)=>{
  const first=value.technical.execute("COMMAND",register,technicalSession.id);assert.equal(first.ok,true);const mappingId=first.ok?String(first.data["mappingId"]):"";
  let observationId="observation-missing-f19-e";
  if(scenario==="cross-mapping"){
   const second=value.technical.execute("COMMAND",{...register,externalObjectId:"external-other-f19-e",internalResourceId:"source-other-f19-e",idempotencyKey:"mapping-other-f19-e",evidenceRef:"evidence:mapping:other:f19-e"},technicalSession.id);assert.equal(second.ok,true);
   observationId="observation-other-f19-e";
   assert.equal(value.technical.execute("COMMAND",{operation:"SubmitProviderObservation",integrationContractId:binding.integrationContractId,observationId,providerNamespace:binding.providerNamespace,externalObjectId:"external-other-f19-e",connectorId:scope.connectorId,sourceId:scope.sourceId,observationType:"STATUS",normalizedFields:{active:true},observedAt:now,idempotencyKey:"observation-other-f19-e",expectedMappingVersion:1},technicalSession.id).ok,true);
  }
  const before=externalSnapshot(value,mappingId);
  const denied=value.technical.execute("COMMAND",{operation:"ReconcileIntegrationEvidence",integrationContractId:binding.integrationContractId,mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:unproven:f19-e"],observationIds:[observationId],idempotencyKey:`reconciliation-${scenario}-f19-e`},technicalSession.id);
  assert.equal(denied.ok,false);if(!denied.ok)assert.equal(denied.error.code,scenario==="missing"?"NOT_FOUND":"CONFLICT");
  assert.deepEqual(externalSnapshot(value,mappingId),before);assert.equal(value.linked(),undefined);
 });
});

test("F19-E rejects terminal findings for External Integration after allowed UNRESOLVED review with zero domain mutation",()=>{
 for(const finding of ["CONFIRMED_EXECUTED","CONFIRMED_NOT_EXECUTED"] as const)withHarness((value)=>{
  const result=createUnresolved(value,true);
  const technicalEvidenceId=String(result.reconciliation.ok?result.reconciliation.data["technicalEvidenceId"]:"");
  assert.equal(value.recoveryApplication.execute("COMMAND",{operation:"RESOLVE_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:1,finding:"UNRESOLVED",reasonCode:"BUSINESS_JUDGMENT_REQUIRED",evidenceRefs:[technicalEvidenceId],idempotencyKey:"unresolved-review-f19-e"},resolverSession.id).ok,true);
  const beforeExternal=externalSnapshot(value,result.mappingId);const beforeCase=recoverySnapshot(value,result.linked.recoveryCaseId);
  const denied=value.recoveryApplication.execute("COMMAND",{operation:"RESOLVE_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:2,finding,reasonCode:"FORGED_TERMINAL_TECHNICAL_TRUTH",evidenceRefs:[technicalEvidenceId],idempotencyKey:`terminal-${finding}-f19-e`},resolverSession.id);
  assert.deepEqual(denied,{ok:false,error:{code:"INVALID_STATE",message:"Recovery operation could not be completed."}});
  assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeCase);assert.deepEqual(externalSnapshot(value,result.mappingId),beforeExternal);
  const current=value.recovery.findCase(result.linked.recoveryCaseId);assert.equal(current?.status,"OPEN");assert.equal(current?.finding?.finding,"UNRESOLVED");assert.equal(current?.disposition,undefined);assert.equal(current?.recovery,undefined);
 });
});

test("F19-E rejects executable disposition for a legacy terminal External Integration case before identity validation",()=>withHarness((value)=>{
 const result=createUnresolved(value,true);
 value.recovery.recordFinding({recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:1,finding:"CONFIRMED_NOT_EXECUTED",reasonCode:"LEGACY_TERMINAL_EXTERNAL_FINDING",evidenceRefs:[String(result.reconciliation.ok?result.reconciliation.data["technicalEvidenceId"]:"")],decidedBy:resolverSession.principalId,decidedAt:now,idempotencyKey:"legacy-terminal-f19-e",fingerprint:"legacy-terminal-f19-e"});
 const beforeExternal=externalSnapshot(value,result.mappingId);const beforeCase=recoverySnapshot(value,result.linked.recoveryCaseId);
 const denied=value.recoveryApplication.execute("COMMAND",{operation:"AUTHORIZE_RECOVERY",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:2,recoveryDisposition:"RECOVERY_AUTHORIZED",recoveryActionType:"CONNECTOR_REEXECUTION",recoveryExecutionIdentity:{invocationId:"connector-recovery:forged-f19-e"},evidenceRefs:["evidence:forged:recovery:f19-e"],idempotencyKey:"forged-recovery-f19-e"},resolverSession.id);
 assert.deepEqual(denied,{ok:false,error:{code:"INVALID_STATE",message:"Recovery operation could not be completed."}});assert.equal(value.identityValidations(),0);
 assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeCase);assert.deepEqual(externalSnapshot(value,result.mappingId),beforeExternal);
 assert.equal(value.recovery.findCase(result.linked.recoveryCaseId)?.disposition,undefined);assert.equal(value.recovery.findCase(result.linked.recoveryCaseId)?.recovery,undefined);
}));

test("F19-E business review appends UNRESOLVED lineage only and rejects every direct API-019 mutation with zero side effects",()=>withHarness((value)=>{
 const result=createUnresolved(value,true);
 const beforeDecision=externalSnapshot(value,result.mappingId);
 const decision=value.recoveryApplication.execute("COMMAND",{operation:"RESOLVE_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:1,finding:"UNRESOLVED",reasonCode:"BUSINESS_JUDGMENT_REQUIRED",evidenceRefs:[String(result.reconciliation.ok?result.reconciliation.data["technicalEvidenceId"]:"")],idempotencyKey:"unresolved-decision-f19-e"},resolverSession.id);
 assert.equal(decision.ok,true);
 assert.deepEqual(externalSnapshot(value,result.mappingId),beforeDecision);
 const afterDecision=value.recovery.findCase(result.linked.recoveryCaseId);assert.equal(afterDecision?.finding?.finding,"UNRESOLVED");assert.equal(afterDecision?.status,"OPEN");assert.equal(afterDecision?.disposition,undefined);assert.equal(afterDecision?.recovery,undefined);
 const forbiddenFields=Object.freeze([
  ["targetInternalResourceId","source-overwrite-f19-e"],
  ["remapInternalResourceId","source-remap-f19-e"],
  ["deleteConflictEvidenceId",String(result.reconciliation.ok?result.reconciliation.data["technicalEvidenceId"]:"")],
  ["businessTruth","VERIFIED"],
  ["reactivateIntegrationContract",true],
  ["verifiedObservationId","observation-f19-e"],
  ["api019RepositoryMutation",Object.freeze({operation:"UPDATE_MAPPING"})],
 ] as const);
 const beforeForbiddenExternal=externalSnapshot(value,result.mappingId);const beforeForbiddenCase=recoverySnapshot(value,result.linked.recoveryCaseId);
 for(const [field,forged] of forbiddenFields){
  const denied=value.recoveryApplication.execute("COMMAND",{operation:"RESOLVE_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:2,finding:"CONFIRMED_EXECUTED",reasonCode:"FORGED_API_019_MUTATION",evidenceRefs:["evidence:forged:f19-e"],idempotencyKey:`forged-${field}`,[field]:forged},resolverSession.id);
  assert.deepEqual(denied,{ok:false,error:{code:"VALIDATION_FAILED",message:"Recovery operation could not be completed."}},field);
  assert.deepEqual(externalSnapshot(value,result.mappingId),beforeForbiddenExternal,field);
  assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeForbiddenCase,field);
 }
}));

test("F19-E conceals the case across tenant and scope and API-019 technical identity has no recovery authority",()=>withHarness((value)=>{
 const result=createUnresolved(value,true);
 assert.equal(result.observation?.ok,true);if(result.observation?.ok){assert.equal(result.observation.data["technicalAcceptanceStatus"],"ACCEPTED");assert.equal("verifiedBusinessState" in result.observation.data,false);}
 assert.equal(result.linked.finding,undefined);assert.equal(result.linked.disposition,undefined);assert.equal(result.linked.recovery,undefined);
 const beforeCase=recoverySnapshot(value,result.linked.recoveryCaseId);const beforeExternal=externalSnapshot(value,result.mappingId);
 for(const context of [Object.freeze({session:resolverSession,tenantId:"tenant-other",scopeRef,purpose:"RECONCILIATION_RECOVERY"}),Object.freeze({session:resolverSession,tenantId:scope.tenantId,scopeRef:"source:other",purpose:"RECONCILIATION_RECOVERY"})]){
  const app=new RecoveryOrchestrationApplication({store:value.recovery,contextResolver:{resolve:()=>context},authorizer:{authorize:()=>true},executionIdentityValidator:{validate:()=>true},clock:{now:()=>now}});
  assert.deepEqual(app.execute("QUERY",{operation:"READ_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId},resolverSession.id),{ok:false,error:{code:"NOT_FOUND",message:"Recovery operation could not be completed."}});
 }
 const technicalRecoveryContext:RecoveryTrustedContext=Object.freeze({session:technicalSession,tenantId:scope.tenantId,scopeRef,purpose:"RECONCILIATION_RECOVERY"});
 const technicalAuthority=new RecoveryOrchestrationApplication({store:value.recovery,contextResolver:{resolve:()=>technicalRecoveryContext},authorizer:{authorize:()=>true},executionIdentityValidator:{validate:()=>true},clock:{now:()=>now}});
 const denied=technicalAuthority.execute("COMMAND",{operation:"AUTHORIZE_RECOVERY",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:1,recoveryDisposition:"RECOVERY_AUTHORIZED",recoveryActionType:"CONNECTOR_REEXECUTION",recoveryExecutionIdentity:{invocationId:"forged-api-019-recovery"},evidenceRefs:["evidence:forged:authority"],idempotencyKey:"forged-api-019-authority"},technicalSession.id);
 assert.deepEqual(denied,{ok:false,error:{code:"NOT_AUTHORIZED",message:"Recovery operation could not be completed."}});
 assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeCase);assert.deepEqual(externalSnapshot(value,result.mappingId),beforeExternal);
}));

test("F19-E suspended contract preserves reads and review while all new API-019 mutations and reactivation remain blocked",()=>withHarness((value)=>{
 const result=createUnresolved(value);
 assert.equal(value.technical.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:binding.integrationContractId,expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspension:f19-e",idempotencyKey:"suspension-f19-e"},technicalSession.id).ok,true);
 const before=externalSnapshot(value,result.mappingId);const beforeCase=recoverySnapshot(value,result.linked.recoveryCaseId);
 const read=value.technical.execute("QUERY",{operation:"ReadIntegrationContract",integrationContractId:binding.integrationContractId},technicalSession.id);assert.equal(read.ok,true);if(read.ok)assert.equal(read.data["technicalStatus"],"SUSPENDED");
 const mutations=[
  {...register,internalResourceId:"source-remap-f19-e",expectedVersion:1,idempotencyKey:"mapping-after-suspension"},
  {operation:"SubmitProviderObservation",integrationContractId:binding.integrationContractId,observationId:"observation-after-suspension",providerNamespace:binding.providerNamespace,externalObjectId:"external-f19-e",connectorId:scope.connectorId,sourceId:scope.sourceId,observationType:"STATUS",normalizedFields:{active:false},observedAt:now,idempotencyKey:"observation-after-suspension",expectedMappingVersion:1},
  {...result.command,idempotencyKey:"reconciliation-after-suspension"},
 ] as const;
 for(const mutation of mutations){const denied=value.technical.execute("COMMAND",mutation,technicalSession.id);assert.equal(denied.ok,false);}
 assert.equal(value.external.provisionContract({...scope,...binding,provisionedAt:now}).status,"SUSPENDED");
 const forged=value.recoveryApplication.execute("COMMAND",{operation:"RESOLVE_RECOVERY_CASE",recoveryCaseId:result.linked.recoveryCaseId,expectedVersion:1,finding:"UNRESOLVED",reasonCode:"FORGED_REACTIVATION",evidenceRefs:["evidence:forged:reactivation"],idempotencyKey:"forged-reactivation",reactivateIntegrationContract:true},resolverSession.id);
 assert.deepEqual(forged,{ok:false,error:{code:"VALIDATION_FAILED",message:"Recovery operation could not be completed."}});
 assert.deepEqual(externalSnapshot(value,result.mappingId),before);assert.deepEqual(recoverySnapshot(value,result.linked.recoveryCaseId),beforeCase);
}));
