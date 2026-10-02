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
const unresolvedConflictCaseWriter=Object.freeze({linkUnresolvedConflict(){void 0;}});
function request(body:unknown,path="/api/external-integrations/queries"){return {method:"POST",path,headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"};}
test("F18-E Runtime Host HTTP exposes only the two approved safe queries",async()=>{
 const value=createProductionExternalIntegrationComposition({runtimeEnvironment:"TEST",databasePath:join(mkdtempSync(join(tmpdir(),"f18-e-http-")),"external.sqlite"),contextResolver:{resolve:()=>({session,tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"})},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>({integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"})},clock:()=>now,unresolvedConflictCaseWriter});
 try{
  const created=(await value.application.execute("COMMAND",{operation:"RegisterExternalMapping",integrationContractId:"contract-1",providerNamespace:"provider-1",externalObjectId:"external-1",internalResourceType:"SOURCE",internalResourceId:"source-1",idempotencyKey:"idem-1",evidenceRef:"evidence:mapping:1"},"session-1"));assert.equal(created.ok,true);
  const mappingId=created.ok?created.data["mappingId"]:"";
  assert.equal((await value.http.handle(request({operation:"ReadExternalMapping",mappingId}))).statusCode,200);
  assert.equal((await value.http.handle(request({operation:"ReadIntegrationContract",integrationContractId:"contract-1"}))).statusCode,200);
  assert.equal((await value.http.handle(request({operation:"RegisterExternalMapping"},"/api/external-integrations/commands"))).statusCode,404);
 }finally{(await value.close());}
});

test("F18-E API-018 SubmitExternalObservation delegates to API-019 and suspension blocks before a second mutation",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"f18-e-composed-"));
 const externalContext={session,tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"};
 const binding={integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"};
 const external=createProductionExternalIntegrationComposition({runtimeEnvironment:"TEST",databasePath:join(directory,"external.sqlite"),contextResolver:{resolve:()=>externalContext},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>binding},clock:()=>now,unresolvedConflictCaseWriter});
 const connectorContext:ConnectorTrustedRuntimeContext=Object.freeze({session,tenantId:"tenant-1",scope:Object.freeze({scopeType:"SOURCE",scopeId:"source-1"}),sourceId:"source-1",connectorId:"connector-1",purpose:"EXTERNAL_EVIDENCE",sourcePolicyVersion:1,connectorVersion:1,correlationId:"correlation-1"});
 const connector=createProductionConnectorApi018Composition({runtimeEnvironment:"TEST",databasePath:join(directory,"connector.sqlite"),contextResolver:{resolve:()=>connectorContext},authorizer:{authorize:()=>true},admission:{evaluate:()=>Object.freeze({status:"BLOCKED" as const,reasonCode:"ADMISSION_DENIED" as const})},clock:()=>now,externalObservationSink:{submit:async (input,sessionId)=>(await external.application.execute("COMMAND",input,sessionId))},ambiguityCaseWriter:{linkAmbiguousInvocation(){void 0;}}});
 const body={operation:"SubmitExternalObservation",integrationContractId:"contract-1",connectorId:"connector-1",sourceId:"source-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:now,expectedVersion:0,idempotencyKey:"idem-observation"};
 try{
  const accepted=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"});assert.equal(accepted.statusCode,200);
  const scope={tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"};assert.equal((await external.store.listObservations(scope,"contract-1")).length,1);
  (await external.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1"));
  const blocked=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body:{...body,observationId:"observation-2",idempotencyKey:"test-obs-2"},requestId:"request-2"});assert.equal(blocked.statusCode,403);assert.equal((await external.store.listObservations(scope,"contract-1")).length,1);
 }finally{connector.close();(await external.close());}
});

test("F18-F suspended API-019 contract blocks API-018 observation ingress after both runtimes restart",async()=>{
 const directory=mkdtempSync(join(tmpdir(),"f18-f-composed-restart-"));const externalPath=join(directory,"external.sqlite");const connectorPath=join(directory,"connector.sqlite");
 const externalContext={session,tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"};
 const binding={integrationContractId:"contract-1",providerNamespace:"provider-1",connectorId:"connector-1",sourceId:"source-1",governedBindingRef:"governance:binding:1",evidenceRef:"evidence:contract:1"};
 const connectorContext:ConnectorTrustedRuntimeContext=Object.freeze({session,tenantId:"tenant-1",scope:Object.freeze({scopeType:"SOURCE",scopeId:"source-1"}),sourceId:"source-1",connectorId:"connector-1",purpose:"EXTERNAL_EVIDENCE",sourcePolicyVersion:1,connectorVersion:1,correlationId:"correlation-1"});
 const createExternal=()=>createProductionExternalIntegrationComposition({runtimeEnvironment:"TEST",databasePath:externalPath,contextResolver:{resolve:()=>externalContext},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>binding},clock:()=>now,unresolvedConflictCaseWriter});
 const createConnector=(external:ReturnType<typeof createExternal>)=>createProductionConnectorApi018Composition({runtimeEnvironment:"TEST",databasePath:connectorPath,contextResolver:{resolve:()=>connectorContext},authorizer:{authorize:()=>true},admission:{evaluate:()=>Object.freeze({status:"BLOCKED" as const,reasonCode:"ADMISSION_DENIED" as const})},clock:()=>now,externalObservationSink:{submit:async (input,sessionId)=>(await external.application.execute("COMMAND",input,sessionId))},ambiguityCaseWriter:{linkAmbiguousInvocation(){void 0;}}});
 const body={operation:"SubmitExternalObservation",integrationContractId:"contract-1",connectorId:"connector-1",sourceId:"source-1",observationId:"observation-1",providerNamespace:"provider-1",externalObjectId:"external-1",observationType:"STATUS",normalizedFields:{active:true},observedAt:now,expectedVersion:0,idempotencyKey:"idem-observation"};
 let external=createExternal();let connector=createConnector(external);
 try{
  assert.equal((await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body,requestId:"request-1"})).statusCode,200);
  assert.equal((await external.application.execute("COMMAND",{operation:"SuspendIntegrationContract",integrationContractId:"contract-1",expectedVersion:1,reasonCode:"TECHNICAL_SUSPENSION",evidenceRef:"evidence:suspend:1",idempotencyKey:"idem-suspend"},"session-1")).ok,true);
  connector.close();(await external.close());external=createExternal();connector=createConnector(external);
  const blocked=await connector.http.handle({method:"POST",path:"/api/connectors/commands",headers:{"x-session-id":"session-1"},query:{},pathParameters:{},body:{...body,observationId:"observation-2",idempotencyKey:"test-2"},requestId:"request-2"});
  assert.equal(blocked.statusCode,403);
  assert.equal((await external.store.listObservations({tenantId:"tenant-1",scopeType:"SOURCE",scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1"},"contract-1")).length,1);
  const read=await external.http.handle(request({operation:"ReadIntegrationContract",integrationContractId:"contract-1"}));assert.equal(read.statusCode,200);assert.match(JSON.stringify(read.body),/SUSPENDED/u);
 }finally{connector.close();(await external.close());}
});

test("R3-B5 HTTP returns safe INTERNAL_ERROR for delayed host execution rejection",async()=>{
 const {createExternalIntegrationHttpHandler}=await import("./external-integration-http-adapter.js");const handler=createExternalIntegrationHttpHandler({execute:()=>Promise.reject(new Error("private PostgreSQL detail"))});const result=await handler.handle(request({operation:"ReadIntegrationContract",integrationContractId:"contract-1"}));assert.equal(result.statusCode,500);assert.deepEqual(result.body,{success:false,error:{code:"INTERNAL_ERROR",message:"External integration operation could not be completed."}});
});

test("R3-B5 External composition uses the supplied PostgreSQL pool and rejects SQLite in Staging",async()=>{
 let poolClosed=false;const statements:string[]=[];const pool={connect:()=>Promise.resolve({query:<Row extends Record<string,unknown>>(text:string)=>{statements.push(text);return Promise.resolve({rows:[] as Row[],rowCount:0});},release:()=>{void 0;}}),close:()=>{poolClosed=true;return Promise.resolve();}};
 const options={runtimeEnvironment:"STAGING" as const,postgreSqlPool:pool,contextResolver:{resolve:()=>({session,tenantId:"tenant-1",scopeType:"SOURCE" as const,scopeId:"source-1",connectorId:"connector-1",sourceId:"source-1",purpose:"EXTERNAL_EVIDENCE"})},authorizer:{authorize:()=>true},bindingResolver:{resolve:()=>undefined},clock:()=>now,unresolvedConflictCaseWriter};
 assert.throws(()=>createProductionExternalIntegrationComposition({...options,databasePath:"forbidden.sqlite"}),/PostgreSQL persistence is required/u);
 assert.throws(()=>createProductionExternalIntegrationComposition({...options,runtimeEnvironment:"TEST",databasePath:"forbidden.sqlite"}),/SQLite persistence is required/u);
 const root=createProductionExternalIntegrationComposition(options);try{const response=await root.http.handle(request({operation:"ReadIntegrationContract",integrationContractId:"absent"}));assert.equal(response.statusCode,404);assert.equal(statements.length,1);assert.match(statements[0]??"",/app_external_integration\.ext_contracts/u);}finally{await root.close();}assert.equal(poolClosed,false);
});
