import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { createProductionExternalIntegrationComposition } from "./external-integration-production-composition.js";
import { createProductionConnectorApi018Composition } from "./connector-production-composition.js";
import type { ConnectorTrustedRuntimeContext } from "../../../modules/source/src/connector-runtime-application.js";
const now="2026-09-02T00:00:00.000Z";
const session:SessionContext=Object.freeze({id:"session-1",principalId:"service-1",principalType:"SERVICE",roles:Object.freeze(["SVC"] as const),teamId:"team-1",state:"ACTIVE",assurance:"WORKLOAD",isMfaVerified:false,authenticatedAt:now,expiresAt:"2026-09-02T01:00:00.000Z",absoluteExpiresAt:"2026-09-02T02:00:00.000Z",familyId:"family-1",refreshReference:"non-sensitive-reference"});
function request(body:unknown,path="/api/external-integrations/queries"){return {method:"POST",path,headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"};}
test("F18-E Runtime Host HTTP exposes only the two approved safe queries",async()=>{
 const value=createProductionExternalIntegrationComposition({databasePath:join(mkdtempSync(join(tmpdir(),"f18-e-http-")),"external.sqlite"),contextResolver:{resolve:()=>({session,tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"})},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>({integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"})},clock:()=>now});
 try{
  const created=value.application.execute("COMMAND",{operation:"RegisterExternalMapping",integrationContractId:"contract-1",providerNamespace:"provider-1",externalObjectId:"external-1",internalResourceType:"SOURCE",internalResourceId:"source-1",idempotencyKey:"idem-1",evidenceRef:"evidence:mapping:1"},"session-1");assert.equal(created.ok,true);
  const mappingId=created.ok?created.data["mappingId"]:"";
  assert.equal((await value.http.handle(request({operation:"ReadExternalMapping",mappingId}))).statusCode,200);
  assert.equal((await value.http.handle(request({operation:"ReadIntegrationContract",integrationContractId:"contract-1"}))).statusCode,200);
  assert.equal((await value.http.handle(request({operation:"RegisterExternalMapping"},"/api/external-integrations/commands"))).statusCode,404);
 }finally{value.close();}
});

test("F18-E API-018 SubmitExternalObservation delegates to API-019 and suspension blocks before a second mutation",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"f18-e-composed-"));
 const externalContext={session,tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"};
 const binding={integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"};
 const external=createProductionExternalIntegrationComposition({databasePath:join(directory,"external.sqlite"),contextResolver:{resolve:()=>externalContext},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>binding},clock:()=>now});
 const connectorContext:ConnectorTrustedRuntimeContext=Object.freeze({session,tenantId:"tenant-1",scope:Object.freeze({scopeType:"SOURCE",scopeId:"source-1"}),sourceId:"source-1",connectorId:"connector-1",purpose:"EXTERNAL_EVIDENCE",sourcePolicyVersion:1,connectorVersion:1,correlationId:"correlation-1"});
 const connector=createProductionConnectorApi018Composition({databasePath:join(directory,"connector.sqlite"),contextResolver:{resolve:()=>connectorContext},authorizer:{authorize:()=>true},admission:{evaluate:()=>Object.freeze({status:"BLOCKED" as const,reasonCode:"ADMISSION_DENIED" as const})},clock:()=>now,externalObservationSink:{submit:(input,sessionId)=>external.application.execute("COMMAND",input,sessionId)}});
 const body={operation:"SubmitExternalObservation",integrationContractId:"contract-1",connectorId:"connector-1",sourceId:"source-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:now,expectedVersion:0,idempotencyKey:"idem-observation"};
 try{
  const accepted=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"});assert.equal(accepted.statusCode,200);
  const scope={tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"};assert.equal(external.store.listObservations(scope,"contract-1").length,1);
  external.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1");
  const blocked=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body:{...body,observationId:"observation-2",idempotencyKey:"test-obs-2"},requestId:"request-2"});assert.equal(blocked.statusCode,403);assert.equal(external.store.listObservations(scope,"contract-1").length,1);
 }finally{connector.close();external.close();}
});

test("F18-F suspended API-019 contract blocks API-018 observation ingress after both runtimes restart",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"f18-f-composed-restart-"));const externalPath=join(directory,"external.sqlite");const connectorPath=join(directory,"connector.sqlite");
 const externalContext={session,tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"};
 const binding={integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"};
 const connectorContext:ConnectorTrustedRuntimeContext=Object.freeze({session,tenantId:"tenant-1",scope:Object.freeze({scopeType:"SOURCE",scopeId:"source-1"}),sourceId:"source-1",connectorId:"connector-1",purpose:"EXTERNAL_EVIDENCE",sourcePolicyVersion:1,connectorVersion:1,correlationId:"correlation-1"});
 const createExternal=()=>createProductionExternalIntegrationComposition({databasePath:externalPath,contextResolver:{resolve:()=>externalContext},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>binding},clock:()=>now});
 const createConnector=(external:ReturnType<typeof createExternal>)=>createProductionConnectorApi018Composition({databasePath:connectorPath,contextResolver:{resolve:()=>connectorContext},authorizer:{authorize:()=>true},admission:{evaluate:()=>Object.freeze({status:"BLOCKED" as const,reasonCode:"ADMISSION_DENIED" as const})},clock:()=>now,externalObservationSink:{submit:(input,sessionId)=>external.application.execute("COMMAND",input,sessionId)}});
 const body={operation:"SubmitExternalObservation",integrationContractId:"contract-1",connectorId:"connector-1",sourceId:"source-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:now,expectedVersion:0,idempotencyKey:"idem-observation"};
 let external=createExternal();let connector=createConnector(external);
 try{
  assert.equal((await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"})).statusCode,200);
  assert.equal(external.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1").ok,true);
  connector.close();external.close();external=createExternal();connector=createConnector(external);
  const blocked=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body:{...body,observationId:"observation-2",idempotencyKey:"test-2"},requestId:"request-2"});
  assert.equal(blocked.statusCode,403);
  assert.equal(external.store.listObservations({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},"contract-1").length,1);
  const read=await external.http.handle(request({operation:"ReadIntegrationContract",integrationContractId:"contract-1"}));assert.equal(read.statusCode,200);assert.match(JSON.stringify(read.body),/SUSPENDED/u);
 }finally{connector.close();external.close();}
});
