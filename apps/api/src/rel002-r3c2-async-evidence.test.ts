import assert from "node:assert/strict";
import test from "node:test";
import type {ProductionPinnedServiceIdentityReference,ProductionServiceIdentityBinding} from "./production-service-identity-resolver.js";
test("R3-C2 final collective pin validation rejects an earlier pin changed while resolving a later workload",async()=>{
 const path="./production-startup-preparation.js";const {resolveStartupPins}=await import(path) as {resolveStartupPins:(resolver:{resolve:(pin:ProductionPinnedServiceIdentityReference)=>Promise<{status:"PASS";identity:ProductionServiceIdentityBinding;fingerprint:string}>},pins:readonly ProductionPinnedServiceIdentityReference[])=>Promise<unknown>};
 const pins=[{registrationId:"first",registrationVersion:1},{registrationId:"second",registrationVersion:1}];let firstRevoked=false;
 const resolver={resolve:(pin:ProductionPinnedServiceIdentityReference):Promise<{status:"PASS";identity:ProductionServiceIdentityBinding;fingerprint:string}>=>{
  if(pin.registrationId==="second")firstRevoked=true;
  if(pin.registrationId==="first"&&firstRevoked)return Promise.reject(Error("revoked"));
  return Promise.resolve({status:"PASS",identity:{registrationId:pin.registrationId} as ProductionServiceIdentityBinding,fingerprint:pin.registrationId});
 }};
 await assert.rejects(resolveStartupPins(resolver,pins));
});
import { PostgreSqlRegisteredServiceWorkloadStore } from "../../../modules/identity/src/registered-service-workload-postgresql.js";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
test("R3-C2 durable async workload evidence runs after releasing the registration client and is awaited",async()=>{
 let leased=false,observed:boolean|undefined,completed=false,unblock!:()=>void;
 const pending=new Promise<void>(resolve=>{unblock=resolve;});
 const row={registration_id:"r",tenant_id:"t",principal_id:"p",principal_type:"SERVICE",assurance:"WORKLOAD",environment:"PRODUCTION",status:"ACTIVE",workload_purpose:"startup",audience:"api",registration_version:1,identity_evidence_ref:"i",audit_evidence_ref:"a",created_at:"2026-10-02T00:00:00.000Z",updated_at:"2026-10-02T00:00:00.000Z"};
 const pool:PostgreSqlPoolPort={connect:()=>{leased=true;return Promise.resolve({query:<R extends Record<string,unknown>>(_sql:string)=>Promise.resolve({rows:[row] as unknown as readonly R[],rowCount:1}),release:()=>{leased=false;}});},close:()=>Promise.reject(Error("global close forbidden"))};
 const store=new PostgreSqlRegisteredServiceWorkloadStore(pool,{async assertRegisteredWorkloadEvidence(){observed=leased;await pending;completed=true;}});
 let settled=false;const operation=store.findByRegistrationId("r").then(record=>{settled=true;return record;});
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 try{assert.equal(observed,false);assert.equal(settled,false);}finally{unblock();await operation;await store.close();}
 assert.equal(completed,true);assert.equal(leased,false);
});
test("R3-C2 preparation failure releases clients, closes children and never closes the injected global pool",async()=>{
 const path="./production-startup-preparation.js";const {createProductionStartupPreparation}=await import(path) as {createProductionStartupPreparation:(pool:PostgreSqlPoolPort,config:unknown)=>{resolveRequired:()=>Promise<unknown>;close:()=>Promise<void>}};
 let leases=0,releases=0,globalClosed=0;const pool:PostgreSqlPoolPort={connect:()=>{leases++;return Promise.resolve({query:<R extends Record<string,unknown>>(_sql:string)=>Promise.resolve({rows:[] as readonly R[],rowCount:0}),release:()=>{releases++;}});},close:()=>{globalClosed++;return Promise.resolve();}};
 const preparation=createProductionStartupPreparation(pool,{requiredServiceWorkloadPins:[{registrationId:"r",registrationVersion:1}],startupWorkloadPurpose:"startup",startupWorkloadAudience:"api"});
 await assert.rejects(preparation.resolveRequired());await preparation.close();assert.equal(leases,releases);assert.equal(globalClosed,0);
});
