import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { Client, Pool } from "pg";
import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const enabled=process.env["REL002_TEST_POSTGRES_DISPOSABLE"]==="CONFIRMED"&&/^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"]??"");
const port=Number(process.env["REL002_TEST_POSTGRES_PORT"]);
function poolPort(pool:Pool):PostgreSqlPoolPort{return {connect:async():Promise<PostgreSqlClientPort>=>{const c=await pool.connect();return {query:async<Row extends Record<string,unknown>>(text:string,values?:readonly unknown[])=>c.query(text,values===undefined?undefined:[...values]) as unknown as Promise<PostgreSqlQueryResult<Row>>,release:(destroy)=>c.release(destroy===true)};},close:()=>pool.end()};}
import { PostgreSqlAdvisoryStore } from "../../../modules/ai/src/advisory-postgresql-persistence.js";
import { AsyncDurableAdvisoryStore } from "../../../modules/ai/src/advisory-async-persistence.js";
import { advisoryTestPrompt as prompt, acceptedAdvisoryFixture } from "../../../modules/ai/src/advisory-persistence.test-fixtures.js";
import { assertR3B1AdvisorySchemaReady, R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } from "./child-root-postgresql-readiness.js";
async function artifact(name:string):Promise<string>{return readFile(resolve("modules/ai/advisory/migrations/postgresql/production",name),"utf8");}
test("R3-B6 disposable PostgreSQL Advisory preserves async SQLite parity, JSONB, atomicity, replay and ACL",{skip:!enabled},async()=>{
 const admin=new Client({host:"127.0.0.1",port,user:"postgres",database:"postgres"});await admin.connect();
 const directory=mkdtempSync(join(tmpdir(),"r3b6-parity-"));const sqlite=new AsyncDurableAdvisoryStore({databasePath:join(directory,"advisory.sqlite")});
 const cleanup=async()=>{await admin.query("DROP SCHEMA IF EXISTS app_advisory CASCADE");for(const role of ["ai_mls_production_runtime","ai_mls_production_migration_operator"]){const found=await admin.query("SELECT 1 FROM pg_roles WHERE rolname=$1",[role]);if(found.rowCount!==0){await admin.query(`DROP OWNED BY ${role}`);await admin.query(`DROP ROLE ${role}`);}}};
 try{
 await cleanup();
 for(const role of ["ai_mls_production_migration_operator","ai_mls_production_runtime"])await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
 await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
 const migration=new Client({host:"127.0.0.1",port,user:"ai_mls_production_migration_operator",database:"postgres"});await migration.connect();try{for(const name of ["001_schema_v1.up.sql","002_runtime_role_grants.sql","001_schema_v1.verify.sql"])await migration.query(await artifact(name));}finally{await migration.end();}
 const hash=R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.find(c=>c.schemaName==="app_advisory")!.artifactSha256;
 const native=new Pool({host:"127.0.0.1",port,user:"ai_mls_production_runtime",database:"postgres",max:5,options:`-c ai_mls.r3b1_advisory_artifact_sha256=${hash}`});const pool=poolPort(native);let store=new PostgreSqlAdvisoryStore(pool);
 try{
 await assertR3B1AdvisorySchemaReady(pool);
 const registered=await Promise.all([store.registerPrompt(prompt),store.registerPrompt({...prompt})]);assert.deepEqual(registered[0],await sqlite.registerPrompt(prompt));assert.deepEqual(registered[1],prompt);
 const reordered=Object.fromEntries(Object.entries(prompt).reverse()) as unknown as typeof prompt;assert.deepEqual(await store.registerPrompt(reordered),prompt);
 await assert.rejects(store.registerPrompt({...prompt,contentFingerprint:"changed"}),{code:"PROMPT_IDENTITY_CONFLICT"});
 const record=acceptedAdvisoryFixture();assert.deepEqual(await store.recordAccepted(record,"first"),await sqlite.recordAccepted(record,"first"));
 assert.deepEqual(await store.recordAccepted({...record,generatedAt:"2026-09-10T01:00:00.000Z"},"first"),record);
 assert.deepEqual(await store.recordAccepted(Object.fromEntries(Object.entries(record).reverse()) as unknown as typeof record,"alias"),await sqlite.recordAccepted(record,"alias"));
 await assert.rejects(store.recordAccepted({...record,executionFingerprint:"changed"},"first"),{code:"IDEMPOTENCY_CONFLICT"});
 assert.equal(await store.findAdvisory("other",record.scopeRef,record.advisoryId),undefined);
 // Different advisory identities collide on one idempotency key: only the committed winner survives.
 const racers=Array.from({length:12},(_,i)=>({...record,advisoryId:`race-${i}`}));const winners=await Promise.all(racers.map(r=>store.recordAccepted(r,"race")));assert.equal(new Set(winners.map(r=>r.advisoryId)).size,1);
 const raceCount=await admin.query<{count:number}>("SELECT count(*)::int AS count FROM app_advisory.advisory_records WHERE advisory_id LIKE 'race-%'");assert.equal(raceCount.rows[0]?.count,1);
 const sameId={...record,advisoryId:"same-id"};const same=await Promise.all([store.recordAccepted(sameId,"same-key"),store.recordAccepted({...sameId,generatedAt:"2026-09-11T01:00:00.000Z"},"same-key")]);assert.deepEqual(same[0],same[1]);
 const different=await Promise.allSettled([store.recordAccepted({...record,advisoryId:"fp-one",executionFingerprint:"fp-one"},"fp-race"),store.recordAccepted({...record,advisoryId:"fp-two",executionFingerprint:"fp-two"},"fp-race")]);assert.equal(different.filter(r=>r.status==="fulfilled").length,1);const loser=different.find(r=>r.status==="rejected");assert.equal(loser?.status,"rejected");if(loser?.status==="rejected")assert.equal((loser.reason as {code:string}).code,"IDEMPOTENCY_CONFLICT");
 const faultPool:PostgreSqlPoolPort={connect:async()=>{const c=await pool.connect();return {query:async<Row extends Record<string,unknown>>(text:string,args?:readonly unknown[])=>{if(text.startsWith("INSERT INTO app_advisory.advisory_idempotency"))throw new Error("injected");return c.query<Row>(text,args);},release:destroy=>c.release(destroy)};},close:()=>Promise.reject(new Error("bootstrap-owned"))};const fault=new PostgreSqlAdvisoryStore(faultPool);try{await assert.rejects(fault.recordAccepted({...record,advisoryId:"rolled-back"},"rolled-back"),{code:"PERSISTENCE_UNAVAILABLE"});assert.equal(await store.findAdvisory(record.tenantId,record.scopeRef,"rolled-back"),undefined);}finally{await fault.close();}
 await store.close();store=new PostgreSqlAdvisoryStore(pool);assert.deepEqual(await store.findReplay(record.tenantId,record.scopeRef,"first",record.executionFingerprint),record);
 const raw=await admin.query<{payload_json:unknown;type:string}>("SELECT payload_json,pg_typeof(payload_json)::text AS type FROM app_advisory.advisory_records WHERE advisory_id=$1",[record.advisoryId]);assert.equal(raw.rows[0]?.type,"jsonb");assert.deepEqual(raw.rows[0]?.payload_json,record);assert.equal(Object.isFrozen((await store.findAdvisory(record.tenantId,record.scopeRef,record.advisoryId))?.envelope),true);
 const c=await pool.connect();try{assert.equal((await c.query("SELECT current_user AS role")).rows[0]?.["role"],"ai_mls_production_runtime");for(const sql of ["UPDATE app_advisory.advisory_records SET execution_fingerprint='changed'","DELETE FROM app_advisory.advisory_records","CREATE TABLE app_advisory.forbidden(id int)","SET ROLE ai_mls_production_migration_operator"])await assert.rejects(c.query(sql),{code:"42501"});}finally{c.release();}
 await admin.query("GRANT UPDATE ON app_advisory.advisory_records TO ai_mls_production_runtime");await assert.rejects(assertR3B1AdvisorySchemaReady(pool),/R3B1_CHILD_ROOT_SCHEMA_NOT_READY/u);await admin.query("REVOKE UPDATE ON app_advisory.advisory_records FROM ai_mls_production_runtime");await assertR3B1AdvisorySchemaReady(pool);
 await admin.query("ALTER TABLE app_advisory.advisory_records ALTER COLUMN payload_json TYPE text USING payload_json::text");await assert.rejects(assertR3B1AdvisorySchemaReady(pool),/R3B1_CHILD_ROOT_SCHEMA_NOT_READY/u);
 }finally{await store.close();await pool.close();}
 }finally{await sqlite.close();rmSync(directory,{recursive:true,force:true});await cleanup();await admin.end();}
});
