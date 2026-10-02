import type { PostgreSqlClientPort } from "../../identity/src/postgresql-pool.js";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import * as ai from "./index.js";
import type { AdvisoryPersistence, AdvisoryPromptRecord } from "./advisory-runtime-contracts.js";
const prompt:AdvisoryPromptRecord={promptId:"prompt-r3b6",promptVersion:"1",capabilityId:"AI-001",schemaId:"urn:ai-mls:schema:listing-parser-output:v0.1",contentFingerprint:"sha256:r3b6",status:"ACTIVE",createdAt:"2026-10-02T00:00:00.000Z"};
type AsyncStore={ [K in keyof AdvisoryPersistence]: (...args:Parameters<AdvisoryPersistence[K]>)=>Promise<ReturnType<AdvisoryPersistence[K]>> };
test("R3-B6 SQLite async prompt identity survives restart and rejected mutations preserve immutability",async()=>{
 const Constructor=(ai as unknown as Record<string,unknown>)["AsyncDurableAdvisoryStore"];assert.equal(typeof Constructor,"function");const Store=Constructor as new(options:{databasePath:string})=>AsyncStore;const directory=mkdtempSync(join(tmpdir(),"r3b6-sqlite-"));let store=new Store({databasePath:join(directory,"advisory.sqlite")});try{assert.deepEqual(await store.registerPrompt(prompt),prompt);await store.close();store=new Store({databasePath:join(directory,"advisory.sqlite")});assert.deepEqual(await store.findPrompt(prompt.promptId,prompt.promptVersion),prompt);await assert.rejects(store.registerPrompt({...prompt,contentFingerprint:"changed"}),{code:"PROMPT_IDENTITY_CONFLICT"});assert.deepEqual(await store.findPrompt(prompt.promptId,prompt.promptVersion),prompt);}finally{await store.close();rmSync(directory,{recursive:true,force:true});}
});
test("R3-B6 PostgreSQL prompt registration is immutable, uses one client, and does not close bootstrap pool",async()=>{
 const Constructor=(ai as unknown as Record<string,unknown>)["PostgreSqlAdvisoryStore"];assert.equal(typeof Constructor,"function");let closed=false;let releaseCount=0;const sql:string[]=[];const pool={connect:()=>Promise.resolve({query:<Row extends Record<string,unknown>>(text:string)=>{sql.push(text);return Promise.resolve({rows:(text.startsWith("SELECT")?[{prompt_id:prompt.promptId,prompt_version:prompt.promptVersion,capability_id:prompt.capabilityId,schema_id:prompt.schemaId,content_fingerprint:prompt.contentFingerprint,status:prompt.status,created_at:new Date(prompt.createdAt),payload_json:prompt}]:[]) as unknown as Row[],rowCount:1});},release:()=>{releaseCount++;}}),close:()=>{closed=true;return Promise.resolve();}};const store=new (Constructor as new(poolPort:typeof pool)=>AsyncStore)(pool);assert.deepEqual(await store.registerPrompt(prompt),prompt);assert.equal(sql[0],"BEGIN");assert.equal(sql.at(-1),"COMMIT");assert.equal(releaseCount,1);await store.close();assert.equal(closed,false);await assert.rejects(store.findPrompt(prompt.promptId,prompt.promptVersion),{code:"PERSISTENCE_UNAVAILABLE"});
});


 test("R3-B6 production composition accepts only the shared PostgreSQL boundary outside Test", async () => {
 const { createProductionAdvisoryRuntime } = await import("./advisory-production-composition.js");
 const pool = { connect: () => Promise.reject(new Error("unused")), close: () => Promise.resolve() };
 const graph = createProductionAdvisoryRuntime({ runtimeEnvironment: "STAGING", postgreSqlPool: pool, snapshotResolver: { resolve: () => undefined } } as never);
 await graph.close();
 assert.throws(() => createProductionAdvisoryRuntime({ runtimeEnvironment: "STAGING", databasePath: ":memory:", snapshotResolver: { resolve: () => undefined } }), /configuration is invalid/u);
 });

test("R3-B6 ambiguous COMMIT and failed rollback quarantine the adapter and destroy its client", async () => {
 for (const fault of ["COMMIT", "ROLLBACK"] as const) {
  let destroyed = false; let connects = 0;
  const pool = { connect: () => { connects++; return Promise.resolve({ query: <Row extends Record<string, unknown>>(sql: string) => {
   if (sql === fault || (fault === "ROLLBACK" && sql.startsWith("INSERT"))) return Promise.reject(new Error("unsafe injected diagnostic"));
   const rows = sql.startsWith("SELECT") ? [{ prompt_id: prompt.promptId, prompt_version: prompt.promptVersion, capability_id: prompt.capabilityId, schema_id: prompt.schemaId, content_fingerprint: prompt.contentFingerprint, status: prompt.status, created_at: new Date(prompt.createdAt), payload_json: prompt }] : [];
   return Promise.resolve({ rows: rows as unknown as Row[], rowCount: 1 });
  }, release: (destroy?: boolean) => { destroyed = destroy === true; } }); }, close: () => Promise.resolve() };
  const store = new ai.PostgreSqlAdvisoryStore(pool);
  await assert.rejects(store.registerPrompt(prompt), (error: unknown) => error instanceof ai.AdvisoryPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && !error.message.includes("unsafe"));
  assert.equal(destroyed, true);
  await assert.rejects(store.findPrompt(prompt.promptId, prompt.promptVersion), { code: "PERSISTENCE_UNAVAILABLE" });
  assert.equal(connects, 1); await store.close();
 }
});
test("R3-B6 close drains admitted work and prevents new work without ending the shared pool", async () => {
 let resolveConnect!: (client: PostgreSqlClientPort) => void;
 const connected = new Promise<PostgreSqlClientPort>((resolve) => { resolveConnect = resolve; });
 let released = false; let closed = false;
 const store = new ai.PostgreSqlAdvisoryStore({ connect: () => connected, close: () => { closed = true; return Promise.resolve(); } });
 const read = store.findPrompt(prompt.promptId, prompt.promptVersion);
 let drained = false; const closing = store.close().then(() => { drained = true; });
 await assert.rejects(store.findPrompt(prompt.promptId, prompt.promptVersion), { code: "PERSISTENCE_UNAVAILABLE" });
 assert.equal(drained, false);
 resolveConnect({ query: () => Promise.resolve({ rows: [], rowCount: 0 }), release: () => { released = true; } });
 assert.equal(await read, undefined); await closing; assert.equal(drained, true); assert.equal(released, true); assert.equal(closed, false);
});
test("R3-B6 relational/payload divergence fails closed", async () => {
 const store = new ai.PostgreSqlAdvisoryStore({ connect: () => Promise.resolve({ query: <Row extends Record<string, unknown>>() => Promise.resolve({ rows: [{ prompt_id: "wrong", payload_json: prompt }] as unknown as Row[], rowCount: 1 }), release: () => undefined }), close: () => Promise.resolve() });
 await assert.rejects(store.findPrompt(prompt.promptId, prompt.promptVersion), { code: "PERSISTENCE_UNAVAILABLE" }); await store.close();
});

test("R3-B6 PostgreSQL snapshots validated accepted input before awaiting connect", async () => {
 const { acceptedAdvisoryFixture, advisoryTestPrompt } = await import("./advisory-persistence.test-fixtures.js");
 const record = structuredClone(acceptedAdvisoryFixture()); const original = structuredClone(record);
 let resolve!: (client: PostgreSqlClientPort) => void;
 const connected = new Promise<PostgreSqlClientPort>(r => { resolve = r; }); let payload: unknown;
 const store = new ai.PostgreSqlAdvisoryStore({ connect: () => connected, close: () => Promise.resolve() });
 const pending = store.recordAccepted(record, "mutable");
 (record as unknown as Record<string, unknown>)["authority"] = "HUMAN_APPROVED";
 resolve({ query: <Row extends Record<string, unknown>>(sql: string, args?: readonly unknown[]) => {
  if (sql.startsWith("INSERT INTO app_advisory.advisory_records")) payload = JSON.parse(String(args?.[6])) as unknown;
  const rows = sql.includes("FROM app_advisory.advisory_prompts") ? [{ prompt_id: advisoryTestPrompt.promptId, prompt_version: advisoryTestPrompt.promptVersion, capability_id: advisoryTestPrompt.capabilityId, schema_id: advisoryTestPrompt.schemaId, content_fingerprint: advisoryTestPrompt.contentFingerprint, status: advisoryTestPrompt.status, created_at: new Date(advisoryTestPrompt.createdAt), payload_json: advisoryTestPrompt }] : [];
  return Promise.resolve({ rows: rows as unknown as Row[], rowCount: sql.startsWith("INSERT") ? 1 : rows.length });
 }, release: () => undefined });
 assert.deepEqual(await pending, original); assert.deepEqual(payload, original); await store.close();
});

test("R3-B6 close during loser rollback waits for the committed replay winner on the admitted client", async () => {
 const { acceptedAdvisoryFixture, advisoryTestPrompt } = await import("./advisory-persistence.test-fixtures.js");const record = acceptedAdvisoryFixture();let rolledBack = false;let drained = false;let connects = 0;let closing: Promise<void> | undefined;
 const store = new ai.PostgreSqlAdvisoryStore({ connect: () => { connects++;return Promise.resolve({ query: <Row extends Record<string, unknown>>(sql: string) => {
  if (sql === "ROLLBACK") { rolledBack = true;closing = store.close().then(() => { drained = true; }); }
  let rows: Record<string, unknown>[] = [];
  if (sql.includes("FROM app_advisory.advisory_prompts")) rows = [{ prompt_id: advisoryTestPrompt.promptId, prompt_version: advisoryTestPrompt.promptVersion, capability_id: advisoryTestPrompt.capabilityId, schema_id: advisoryTestPrompt.schemaId, content_fingerprint: advisoryTestPrompt.contentFingerprint, status: advisoryTestPrompt.status, created_at: new Date(advisoryTestPrompt.createdAt), payload_json: advisoryTestPrompt }];
  if (rolledBack && sql.includes("FROM app_advisory.advisory_idempotency")) { assert.equal(drained, false); rows = [{execution_fingerprint:record.executionFingerprint,advisory_id:record.advisoryId}]; }
  if (sql.includes("FROM app_advisory.advisory_records")) rows = [{ advisory_id: record.advisoryId, tenant_id: record.tenantId, scope_ref: record.scopeRef, capability_id: record.capabilityId, schema_id: record.schemaId, execution_fingerprint: record.executionFingerprint, payload_json: record }];
  return Promise.resolve({rows:rows as unknown as Row[],rowCount:sql.startsWith("INSERT INTO app_advisory.advisory_records")?1:rows.length});
 }, release: () => undefined }); },close: () => Promise.resolve() });
 assert.deepEqual(await store.recordAccepted({...record,advisoryId:"loser"},"race-close"),record);await closing;assert.equal(drained,true);assert.equal(connects,1);
});

test("R3-B6 async SQLite accepted record rollback, concurrent replay, evidence and restart parity", async () => {
 const { acceptedAdvisoryFixture, advisoryTestPrompt } = await import("./advisory-persistence.test-fixtures.js");const record = acceptedAdvisoryFixture();const directory = mkdtempSync(join(tmpdir(),"r3b6-sqlite-record-"));const databasePath = join(directory,"advisory.sqlite");let fail = true;let store = new ai.AsyncDurableAdvisoryStore({databasePath,beforeIdempotencyWrite:()=>{if(fail)throw new Error("injected");}});
 try { await store.registerPrompt(advisoryTestPrompt);await assert.rejects(store.recordAccepted(record,"atomic"),{code:"PERSISTENCE_UNAVAILABLE"});assert.equal(await store.findAdvisory(record.tenantId,record.scopeRef,record.advisoryId),undefined);fail=false;const saved=await Promise.all(Array.from({length:8},()=>store.recordAccepted(record,"atomic")));assert.equal(saved.every(item=>item.reviewRequired&&item.authority==="ADVISORY"),true);assert.deepEqual(saved[0],record);await assert.rejects(store.recordAccepted({...record,executionFingerprint:"changed"},"atomic"),{code:"IDEMPOTENCY_CONFLICT"});await store.close();store=new ai.AsyncDurableAdvisoryStore({databasePath});assert.deepEqual(await store.findReplay(record.tenantId,record.scopeRef,"atomic",record.executionFingerprint),record);assert.equal(await store.findAdvisory("other",record.scopeRef,record.advisoryId),undefined); } finally {await store.close();rmSync(directory,{recursive:true,force:true});}
});
