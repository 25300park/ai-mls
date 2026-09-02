import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DurableExternalIntegrationStore } from "./external-integration-durable-persistence.js";

const scope={tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"};
const binding={...scope,integrationContractId:"contract-1",providerNamespace:"provider-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1",provisionedAt:"2026-09-02T00:00:00.000Z"};
const mapping={...scope,integrationContractId:"contract-1",providerNamespace:"provider-1",externalObjectId:"external-1",internalResourceType:"SOURCE",internalResourceId:"source-1",expectedVersion:0,idempotencyKey:"idem-map-1",inputFingerprint:"fp-map-1",evidenceRef:"evidence:mapping:1",recordedAt:"2026-09-02T00:01:00.000Z"};
function path():string{return join(mkdtempSync(join(tmpdir(),"f18-e-")),"external.sqlite");}

test("F18-E provisions only a governed binding and preserves suspension across restart",()=>{
 const databasePath=path();let store=new DurableExternalIntegrationStore({databasePath});
 assert.throws(()=>store.provisionContract({...binding,governedBindingRef:""}),{code:"PERSISTENCE_INPUT_INVALID"});
 assert.equal(store.provisionContract(binding).status,"ACTIVE");
 assert.equal(store.suspendContract({...scope,integrationContractId:"contract-1",expectedVersion:1,idempotencyKey:"idem-suspend",inputFingerprint:"fp-suspend",reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",recordedAt:"2026-09-02T00:02:00.000Z"}).version,2);
 store.close();store=new DurableExternalIntegrationStore({databasePath});
 assert.equal(store.readContract(scope,"contract-1")?.status,"SUSPENDED");store.close();
});

test("F18-E rejects a different suspension request after the contract is already suspended",()=>{
 const store=new DurableExternalIntegrationStore({databasePath:path()});store.provisionContract(binding);
 store.suspendContract({...scope,integrationContractId:"contract-1",expectedVersion:1,idempotencyKey:"idem-suspend",inputFingerprint:"fp-suspend",reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",recordedAt:"2026-09-02T00:02:00.000Z"});
 assert.throws(()=>store.suspendContract({...scope,integrationContractId:"contract-1",expectedVersion:2,idempotencyKey:"idem-suspend-2",inputFingerprint:"fp-suspend-2",reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:2",recordedAt:"2026-09-02T00:03:00.000Z"}),{code:"CONFLICT"});
 assert.equal(store.readContract(scope,"contract-1")?.version,2);
 assert.equal(store.listEvidence(scope,"contract-1").filter(item=>item.kind==="CONTRACT_SUSPENDED").length,1);store.close();
});

test("F18-E keeps a stable mapping and appends conflict evidence without remapping",()=>{
 const store=new DurableExternalIntegrationStore({databasePath:path()});store.provisionContract(binding);
 const established=store.registerMapping(mapping);assert.equal(established.version,1);
 assert.throws(()=>store.registerMapping({...mapping,internalResourceId:"source-2",idempotencyKey:"idem-map-2",inputFingerprint:"fp-map-2",evidenceRef:"evidence:mapping:2"}),{code:"CONFLICT"});
 const current=store.readMappingByExternal(scope,"provider-1","external-1");
 assert.equal(current?.internalResourceId,"source-1");assert.equal(current?.state,"ACTIVE");
 assert.equal(store.listEvidence(scope,"contract-1").filter(item=>item.kind==="MAPPING_CONFLICT").length,1);store.close();
});

test("F18-E enforces mapping version and durable observation identity idempotency",()=>{
 const databasePath=path();let store=new DurableExternalIntegrationStore({databasePath});store.provisionContract(binding);store.registerMapping(mapping);
 assert.throws(()=>store.registerMapping({...mapping,expectedVersion:0,idempotencyKey:"idem-map-2",inputFingerprint:"fp-map-update"}),{code:"VERSION_CONFLICT"});
 const observation={...scope,integrationContractId:"contract-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:"2026-09-02T00:03:00.000Z",idempotencyKey:"idem-observation",inputFingerprint:"fp-observation",expectedMappingVersion:1};
 const first=store.submitObservation(observation);assert.equal(store.submitObservation(observation).observationId,first.observationId);store.close();
 store=new DurableExternalIntegrationStore({databasePath});assert.equal(store.submitObservation(observation).observationId,first.observationId);
 assert.throws(()=>store.submitObservation({...observation,inputFingerprint:"different",normalizedFields:{active:false}}),{code:"IDEMPOTENCY_CONFLICT"});assert.equal(store.listObservations(scope,"contract-1").length,1);store.close();
});

test("F18-E rejects reuse of an observation idempotency key for a different observation",()=>{
 const store=new DurableExternalIntegrationStore({databasePath:path()});store.provisionContract(binding);store.registerMapping(mapping);
 const first={...scope,integrationContractId:"contract-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:"2026-09-02T00:03:00.000Z",idempotencyKey:"test-shared",inputFingerprint:"fp-one",expectedMappingVersion:1};
 store.submitObservation(first);
 assert.throws(()=>store.submitObservation({...first,observationId:"observation-2",inputFingerprint:"fp-two"}),{code:"IDEMPOTENCY_CONFLICT"});
 assert.equal(store.listObservations(scope,"contract-1").length,1);store.close();
});

test("F18-E blocks every technical mutation after contract suspension while retaining reads",()=>{
 const store=new DurableExternalIntegrationStore({databasePath:path()});store.provisionContract(binding);const established=store.registerMapping(mapping);
 store.suspendContract({...scope,integrationContractId:"contract-1",expectedVersion:1,idempotencyKey:"idem-suspend",inputFingerprint:"fp-suspend",reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",recordedAt:"2026-09-02T00:02:00.000Z"});
 assert.throws(()=>store.registerMapping({...mapping,expectedVersion:1,idempotencyKey:"new",inputFingerprint:"new"}),{code:"FORBIDDEN"});
 assert.throws(()=>store.submitObservation({...scope,integrationContractId:"contract-1",observationId:"o-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:"2026-09-02T00:03:00.000Z",idempotencyKey:"o",inputFingerprint:"o",expectedMappingVersion:1}),{code:"FORBIDDEN"});
 assert.throws(()=>store.reconcileEvidence({...scope,integrationContractId:"contract-1",mappingId:established.mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:mapping:1"],observationIds:[],idempotencyKey:"r",inputFingerprint:"r",recordedAt:"2026-09-02T00:04:00.000Z"}),{code:"FORBIDDEN"});
 assert.equal(store.readMappingById(scope,established.mappingId)?.mappingId,established.mappingId);store.close();
});

test("F18-E reconciliation never changes the established business binding",()=>{
 const store=new DurableExternalIntegrationStore({databasePath:path()});store.provisionContract(binding);const established=store.registerMapping(mapping);
 const result=store.reconcileEvidence({...scope,integrationContractId:"contract-1",mappingId:established.mappingId,expectedVersion:1,proofType:"SAME_INTERNAL_BINDING",evidenceRefs:["evidence:mapping:1"],observationIds:[],idempotencyKey:"idem-reconcile",inputFingerprint:"fp-reconcile",recordedAt:"2026-09-02T00:04:00.000Z"});
 assert.equal(result.reconciliationStatus,"CONFIRMED_TECHNICAL_MATCH");assert.equal(store.readMappingById(scope,established.mappingId)?.internalResourceId,"source-1");store.close();
});

test("F18-F mapping identity and append-only conflict evidence survive restart",()=>{
 const databasePath=path();let store=new DurableExternalIntegrationStore({databasePath});store.provisionContract(binding);
 const established=store.registerMapping(mapping);
 assert.throws(()=>store.registerMapping({...mapping,internalResourceId:"source-2",idempotencyKey:"idem-map-conflict",inputFingerprint:"fp-map-conflict",evidenceRef:"evidence:mapping:conflict"}),{code:"CONFLICT"});
 store.close();store=new DurableExternalIntegrationStore({databasePath});
 assert.equal(store.readMappingByExternal(scope,"provider-1","external-1")?.mappingId,established.mappingId);
 assert.equal(store.readMappingByExternal(scope,"provider-1","external-1")?.internalResourceId,"source-1");
 assert.equal(store.registerMapping(mapping).version,1);
 assert.equal(store.listEvidence(scope,"contract-1").filter(item=>item.kind==="MAPPING_CONFLICT").length,1);
 store.close();
});

test("F18-F unresolved technical reconciliation survives restart without changing business binding",()=>{
 const databasePath=path();let store=new DurableExternalIntegrationStore({databasePath});store.provisionContract(binding);const established=store.registerMapping(mapping);
 const unresolved=store.reconcileEvidence({...scope,integrationContractId:"contract-1",mappingId:established.mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:unproven"],observationIds:[],idempotencyKey:"idem-unresolved",inputFingerprint:"fp-unresolved",recordedAt:"2026-09-02T00:05:00.000Z"});
 assert.equal(unresolved.reconciliationStatus,"UNRESOLVED_CONFLICT");assert.equal(unresolved.reasonCode,"F19_HANDOFF_REQUIRED");
 store.close();store=new DurableExternalIntegrationStore({databasePath});
 const replay=store.reconcileEvidence({...scope,integrationContractId:"contract-1",mappingId:established.mappingId,expectedVersion:1,proofType:"SAME_EXTERNAL_IDENTITY",evidenceRefs:["evidence:unproven"],observationIds:[],idempotencyKey:"idem-unresolved",inputFingerprint:"fp-unresolved",recordedAt:"2026-09-02T00:05:00.000Z"});
 assert.deepEqual(replay,unresolved);assert.equal(store.readMappingById(scope,established.mappingId)?.internalResourceId,"source-1");
 assert.equal(store.listEvidence(scope,"contract-1").filter(item=>item.kind==="TECHNICAL_RECONCILIATION").length,1);store.close();
});
