import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import {assertR3C2IdentityBaseReady,normalizeIdentityConstraintCatalog,normalizeIdentityExtensionCatalogQuery} from "./r3c2-aggregate-readiness.js";
import { readFile } from "node:fs/promises";
test("historical compatibility preserves frozen hash algorithm with bounded extension projection", async () => {
 const adapter = await import("./r3c2-aggregate-readiness.js") as unknown as Record<string, unknown>;
 assert.equal(typeof adapter["R3C2_HISTORICAL_COMPATIBILITY_QUERY"], "string");
 const query=String(adapter["R3C2_HISTORICAL_COMPATIBILITY_QUERY"]);
 const historical=await readFile("modules/identity/migrations/postgresql/production/006_historical_migration_attestation_schema_v1.sql","utf8");
 for(const hash of historical.matchAll(/value = '([a-f0-9]{32})'/gu))assert.ok(query.includes(hash[1]!));
 assert.ok(query.includes("attr.attnotnull"));
 assert.doesNotMatch(query,/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b/iu);
 assert.ok(query.includes("identity_sessions_production_binding_check"));
 assert.ok(query.includes("identity_sessions_production_binding_guard"));
 assert.ok(!query.includes("rel.relname <> 'identity_historical_migration_attestations'"));
});
test("extension catalog normalization preserves NOT NULL column semantics and non-NOT-NULL constraints",()=>{
 const query="SELECT attr.attnotnull, k.contype FROM pg_attribute attr, pg_constraint k WHERE k.conrelid=c.oid)";
 assert.equal(normalizeIdentityExtensionCatalogQuery(query),query.replace("WHERE k.conrelid=c.oid)","WHERE k.conrelid=c.oid AND k.contype <> 'n')"));
});
test("extension read failure rolls back and releases the single inspector lease",async()=>{
 const queries:string[]=[];let leases=0,releases=0;
 const pool:PostgreSqlPoolPort={connect:async()=>{await Promise.resolve();leases++;return {
  query:async<R extends Record<string,unknown>>(sql:string)=>{await Promise.resolve();queries.push(sql);if(sql.startsWith("SELECT relname AS table_name"))throw Error("fixture extension read unavailable");return {rows:[] as R[],rowCount:0};},
  release:()=>{releases++;}
 };},close:()=>Promise.reject(Error("shared pool close forbidden"))};
 await assert.rejects(assertR3C2IdentityBaseReady(pool));
 assert.equal(queries[0],"BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");assert.equal(queries.at(-1),"ROLLBACK");
 assert.equal(leases,1);assert.equal(releases,1);
});
test("R3-C2 catalog normalization accepts only approved equivalent Identity CHECK forms",()=>{
 const row={constraint_name:"identity_sessions_version_check",kind:"c",columns:"session_version",check_expression:"((session_version >= 1) AND (session_version <= '9007199254740991'::bigint))"};
 assert.equal(normalizeIdentityConstraintCatalog([row])[0]?.check_expression,"session_version BETWEEN 1 AND 9007199254740991");
 const changed={...row,check_expression:row.check_expression.replace(" >= 1"," >= 0")};assert.deepEqual(normalizeIdentityConstraintCatalog([changed]),[changed]);
 const chronology={constraint_name:"identity_sessions_chronology_check",kind:"c",columns:"updated_at,created_at",check_expression:"(updated_at >= created_at)"};
 assert.equal(normalizeIdentityConstraintCatalog([chronology])[0]?.columns,"created_at,updated_at");
 const reversed={...chronology,check_expression:"(created_at >= updated_at)"};assert.deepEqual(normalizeIdentityConstraintCatalog([reversed]),[reversed]);
 assert.deepEqual(normalizeIdentityConstraintCatalog([{kind:"n"},{kind:"u",constraint_name:"unexpected"}]),[{kind:"u",constraint_name:"unexpected"}]);
 assert.equal(row.check_expression.includes("BETWEEN"),false);
});
test("R3-C2 aggregate readiness fails closed with missing roots and excludes migration-role clients",async()=>{
 const path="./r3c2-aggregate-readiness.js";const {assertR3C2AggregateSchemasReady}=await import(path) as {assertR3C2AggregateSchemasReady:(pool:PostgreSqlPoolPort)=>Promise<void>};
 for(const role of ["ai_mls_production_runtime","ai_mls_production_migration_operator"]){let releases=0;const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:<R extends Record<string,unknown>>(sql:string)=>Promise.resolve({rows:(sql==="SELECT current_user AS role"?[{role}]:[]) as unknown as readonly R[],rowCount:sql==="SELECT current_user AS role"?1:0}),release:()=>{releases++;}}),close:()=>Promise.reject(Error("shared pool close forbidden"))};await assert.rejects(assertR3C2AggregateSchemasReady(pool));assert.ok(releases>0);}
});

 test('initial Identity diagnostic identifies bounded extension stage without raw data',async()=>{
 const {assertInitialProductionIdentityReady}=await import('./production-initial-identity-diagnostics.js');
 const events:unknown[]=[];let leases=0,releases=0;const queries:string[]=[];
 const pool:PostgreSqlPoolPort={connect:async()=>{await Promise.resolve();leases++;return {query:async<R extends Record<string,unknown>>(sql:string)=>{await Promise.resolve();queries.push(sql);if(sql.includes('current_setting'))return {rows:[{binding0:true,binding1:true,binding2:true,binding3:true,binding4:true}] as unknown as R[],rowCount:1};if(sql.startsWith('SELECT relname'))throw Object.assign(Error('DO_NOT_LOG'),{code:'42501'});return {rows:[] as R[],rowCount:0};},release:()=>{releases++;}};},close:()=>Promise.reject(Error('must not close borrowed pool'))};
 await assert.rejects(assertInitialProductionIdentityReady(pool,event=>events.push(event)));
 assert.equal(leases,1);assert.equal(releases,1);assert.equal(queries.at(-1),'ROLLBACK');
 const serialized=JSON.stringify(events);assert.match(serialized,/IDENTITY_EXTENSION_INVENTORY/u);assert.match(serialized,/42501/u);assert.doesNotMatch(serialized,/DO_NOT_LOG|SELECT |ROLLBACK/u);
 assert.equal(events.filter(e=>Reflect.get(e as object,'stage')==='ARTIFACT_BINDING').length,5);
 });

for(const mode of ['missing','mismatch','unavailable','sink-failure'] as const)test(`initial Identity diagnostic preserves failure and cleanup with ${mode} observation`,async()=>{
 const {assertInitialProductionIdentityReady}=await import('./production-initial-identity-diagnostics.js');
 const events:unknown[]=[];let released=0;
 const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:async<R extends Record<string,unknown>>(sql:string)=>{
  await Promise.resolve();
  if(sql.includes('current_setting')){if(mode==='unavailable')throw Error('DO_NOT_LOG_CA');return {rows:[Object.fromEntries(Array.from({length:5},(_,i)=>[[`present${i}`,mode!=='missing'],[`binding${i}`,false]]).flat())] as unknown as R[],rowCount:1};}
  if(sql.startsWith('SELECT relname'))throw Error('DO_NOT_LOG_CREDENTIAL');
  return {rows:[] as R[],rowCount:0};},release:()=>{released++;}}),close:()=>Promise.reject(Error('must not close'))};
 await assert.rejects(assertInitialProductionIdentityReady(pool,event=>{if(mode==='sink-failure')throw Error('DO_NOT_LOG');events.push(event);}));
 assert.equal(released,1);
 if(mode!=='sink-failure'){
  assert.equal(Reflect.get(events[0] as object,'code'),mode==='missing'?'MISSING':mode==='mismatch'?'MISMATCH':'UNRESOLVED');
  assert.equal(Reflect.get(events.at(-1) as object,'stage'),'IDENTITY_EXTENSION_INVENTORY');
  assert.doesNotMatch(JSON.stringify(events),/DO_NOT_LOG|SELECT |password|postgresql:\/\//u);
 }
});

 test('team requirement diagnostic reports cardinality fingerprint and authority independently',async()=>{
 const {assertInitialProductionIdentityReady}=await import('./production-initial-identity-diagnostics.js');
 for(const mode of ['missing','fingerprint','authority'] as const){
  const events:unknown[]=[];
  const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({query:async<R extends Record<string,unknown>>(sql:string)=>{
   await Promise.resolve();let rows:Record<string,unknown>[]=[];
   if(sql.startsWith('SELECT relname'))rows=[{table_name:'workload_startup_binding_versions',kind:'r'}];
   else if(sql.includes('AS fingerprint')&&sql.includes('workload_startup_binding_versions'))rows=mode==='missing'?[]:[{schema_name:'app_identity',table_name:'workload_startup_binding_versions',fingerprint:mode==='fingerprint'?'DO_NOT_LOG_FINGERPRINT':'474c1456def4862e43167f2777a94c23',authority_ok:mode!=='authority'}];
   return {rows:rows as R[],rowCount:rows.length};
  },release:()=>undefined}),close:()=>Promise.resolve()};
  await assert.rejects(assertInitialProductionIdentityReady(pool,e=>events.push(e)));
  const checks=events.filter(e=>Reflect.get(e as object,'requirement')!==undefined);
  assert.equal(checks.length,3);
  const expected=mode==='missing'?'ROOT_CARDINALITY':mode==='fingerprint'?'FINGERPRINT_CONTRACT':'AUTHORITY_CONTRACT';
  assert.equal(checks.some(e=>Reflect.get(e as object,'requirement')===expected&&Reflect.get(e as object,'result')==='FAIL'),true);
  assert.doesNotMatch(JSON.stringify(events),/DO_NOT_LOG|474c1456|be3dbce8/u);
 }
 });

for(const role of ['ai_mls_production_runtime','wrong-role'])test('aggregate child diagnostics preserve rejection and release: '+role,async()=>{
 const {assertR3C2AggregateSchemasReady}=await import('./r3c2-aggregate-readiness.js');
 const events:unknown[]=[];let releases=0,queries=0;
 const pool:PostgreSqlPoolPort={connect:async()=>{await Promise.resolve();return {query:async<R extends Record<string,unknown>>(sql:string)=>{await Promise.resolve();queries++;return {rows:(sql==='SELECT current_user AS role'?[{role}]:[]) as unknown as R[],rowCount:sql==='SELECT current_user AS role'?1:0};},release:()=>{releases++;}};},close:()=>Promise.reject(Error('borrowed pool'))};
 await assert.rejects(assertR3C2AggregateSchemasReady(pool,event=>events.push(event)));
 const children=events as {child:string,result:string}[];
 assert.deepEqual(children,role==='wrong-role'?[{child:'RUNTIME_ACCESS',result:'FAIL'}]:[{child:'RUNTIME_ACCESS',result:'PASS'},...['PUBLICATION','ADMINISTRATION','CONNECTOR','EXTERNAL_INTEGRATION','ADVISORY'].map(child=>({child,result:'FAIL'}))]);
 assert.equal(releases,role==='wrong-role'?1:2);assert.equal(queries,role==='wrong-role'?1:2);
 await assert.rejects(assertR3C2AggregateSchemasReady(pool,()=>{throw Error('DO_NOT_LOG');}));
});
