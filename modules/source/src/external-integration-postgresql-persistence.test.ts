import assert from "node:assert/strict";
import test from "node:test";
import * as source from "./index.js";
import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import type { DurableExternalIntegrationStore } from "./external-integration-durable-persistence.js";
type Store = { [K in keyof DurableExternalIntegrationStore]: (...args: Parameters<DurableExternalIntegrationStore[K]>) => Promise<ReturnType<DurableExternalIntegrationStore[K]>> };
const scope = {tenantId:"t",scopeType:"TEAM" as const,scopeId:"s",connectorId:"c"};
const binding = {...scope,integrationContractId:"contract",providerNamespace:"provider",governedBindingRef:"binding",evidenceRef:"evidence",provisionedAt:"2026-10-02T00:00:00Z"};
function harness(fail?: string) {
 const sql: string[]=[];let released=false;let destroyed=false;let closed=false;
 let contract:unknown;
 const client:PostgreSqlClientPort={query:<Row extends Record<string,unknown>>(text:string,args?:readonly unknown[])=>{sql.push(text);if(text===fail)return Promise.reject(new Error("sensitive database detail"));if(text.startsWith("INSERT INTO app_external_integration.ext_contracts"))contract=args?.at(-1);return Promise.resolve({rows:(text.startsWith("SELECT payload_json FROM app_external_integration.ext_contracts")&&contract!==undefined?[{payload_json:contract}]:[]) as unknown as Row[],rowCount:text.startsWith("INSERT")?1:0});},release:(destroy)=>{released=true;destroyed=destroy===true;}};
 const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve(client),close:()=>{closed=true;return Promise.resolve();}};
 const constructor=(source as unknown as Record<string,unknown>)["PostgreSqlExternalIntegrationStore"];
 assert.equal(typeof constructor,"function");
 const store=new (constructor as new(pool:PostgreSqlPoolPort)=>Store)(pool);
 return {store,sql,state:()=>({released,destroyed,closed})};
}
test("R3-B5 contract provisioning commits one transaction and leaves bootstrap pool ownership intact",async()=>{const h=harness();assert.equal((await h.store.provisionContract(binding)).version,1);assert.equal(h.sql[0],"BEGIN");assert.equal(h.sql.at(-1),"COMMIT");assert.equal(h.state().released,true);await h.store.close();assert.equal(h.state().closed,false);await assert.rejects(h.store.readContract(scope,"contract"),{code:"PERSISTENCE_UNAVAILABLE"});});
test("R3-B5 ambiguous commit quarantines External persistence, destroys client, and projects safe error",async()=>{const h=harness("COMMIT");await assert.rejects(h.store.provisionContract(binding),{code:"PERSISTENCE_UNAVAILABLE",message:"External integration persistence is unavailable."});assert.equal(h.state().destroyed,true);assert.equal(h.sql.includes("ROLLBACK"),false);await assert.rejects(h.store.provisionContract(binding),{code:"PERSISTENCE_UNAVAILABLE"});});
test("R3-B5 missing parent mutation rolls back without inserting evidence or idempotency",async()=>{const h=harness();await assert.rejects(h.store.registerMapping({...scope,integrationContractId:"absent",providerNamespace:"provider",externalObjectId:"object",internalResourceType:"SOURCE",internalResourceId:"id",expectedVersion:0,idempotencyKey:"key",inputFingerprint:"fp",evidenceRef:"evidence",recordedAt:binding.provisionedAt}),{code:"NOT_FOUND"});assert.equal(h.sql.at(-1),"ROLLBACK");assert.equal(h.sql.some(sql=>sql.startsWith("INSERT INTO app_external_integration.ext_evidence")),false);assert.equal(h.state().released,true);});

test("R3-B5 close drains an admitted External read before returning without closing the shared pool",async()=>{
 let finish:()=>void=()=>{void 0;};const barrier=new Promise<void>(resolve=>{finish=resolve;});let started:()=>void=()=>{void 0;};const admission=new Promise<void>(resolve=>{started=resolve;});let released=false;
 const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:async<Row extends Record<string,unknown>>(_text:string)=>{started();await barrier;return Promise.resolve({rows:[] as Row[],rowCount:0});},release:()=>{released=true;}}),close:()=>{assert.fail("child repository must not close shared pool");}};
 const constructor=(source as unknown as Record<string,unknown>)["PostgreSqlExternalIntegrationStore"] as new(pool:PostgreSqlPoolPort)=>Store;
 const store=new constructor(pool);const read=store.readContract(scope,"contract");await admission;let drained=false;const close=store.close().then(()=>{drained=true;});
 try{await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(drained,false,"close must await admitted work");}
 finally{finish();await read;await close;}
 assert.equal(released,true);await assert.rejects(store.readContract(scope,"contract"),{code:"PERSISTENCE_UNAVAILABLE"});
});

test("R3-B5 requests waiting for a pool client cannot execute after an ambiguous commit quarantine",async()=>{
 const contract={...binding,status:"ACTIVE",version:1,createdAt:binding.provisionedAt,updatedAt:binding.provisionedAt};let connects=0;let queuedQueries=0;let finish:()=>void=()=>{void 0;};const barrier=new Promise<void>(resolve=>{finish=resolve;});
 const first:PostgreSqlClientPort={query:async<Row extends Record<string,unknown>>(text:string)=>{if(text==="COMMIT")return Promise.reject(new Error("private commit detail"));return Promise.resolve({rows:(text.startsWith("SELECT payload_json")?[{payload_json:JSON.stringify(contract)}]:[]) as unknown as Row[],rowCount:1});},release:()=>{void 0;}};
 const queued:PostgreSqlClientPort={query:async<Row extends Record<string,unknown>>()=>{queuedQueries++;return Promise.resolve({rows:[] as Row[],rowCount:0});},release:()=>{void 0;}};
 const pool:PostgreSqlPoolPort={connect:async()=>{if(++connects===1)return first;await barrier;return queued;},close:()=>Promise.resolve()};
 const Constructor=(source as unknown as Record<string,unknown>)["PostgreSqlExternalIntegrationStore"] as new(pool:PostgreSqlPoolPort)=>Store;const store=new Constructor(pool);
 const failed=store.provisionContract(binding);const waiting=store.readContract(scope,"contract");await assert.rejects(failed,{code:"PERSISTENCE_UNAVAILABLE"});finish();await assert.rejects(waiting,{code:"PERSISTENCE_UNAVAILABLE"});assert.equal(queuedQueries,0);await store.close();
});
