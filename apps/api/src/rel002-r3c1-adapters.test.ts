import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
const record = { organizationId: "org", organizationVersion: 1, tenantId: "tenant", status: "PROPOSED", evidenceReferences: [{ type: "AUDIT", id: "audit", version: 1 }], createdAt: "2026-10-02T00:00:00.000Z", updatedAt: "2026-10-02T00:00:00.000Z" };
interface Store { createProposed(record: unknown): Promise<unknown>; findVersion(id: string, version: number, tenant: string): Promise<unknown>; close(): Promise<void> }
async function loadStore(pool: PostgreSqlPoolPort): Promise<Store> {
  const path = "../../../modules/organization/src/organization-governance-postgresql.js";
  const module = await import(path) as { PostgreSqlOrganizationGovernanceStore: new (pool: PostgreSqlPoolPort) => Store };
  return new module.PostgreSqlOrganizationGovernanceStore(pool);
}
test("R3-C1 ambiguous COMMIT discards client and quarantines owning lease without closing shared pool", async () => {
  let connects = 0; let closes = 0; const released: boolean[] = [];
  const pool: PostgreSqlPoolPort = { connect: async () => { connects++; await Promise.resolve(); return {
    query: <Row extends Record<string,unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> => {
      if (sql === "COMMIT") return Promise.reject(new Error("ambiguous transport"));
      return Promise.resolve({ rows: sql.startsWith("SELECT current_user") ? [{ role: "ai_mls_production_runtime" } as unknown as Row] : [], rowCount: 0 });
    }, release: destroy => { released.push(destroy === true); }
  }; }, close: () => { closes++; return Promise.resolve(); } };
  const store = await loadStore(pool);
  await assert.rejects(() => store.createProposed(record), { code: "UNAVAILABLE" });
  assert.deepEqual(released,[true]);
  await assert.rejects(() => store.findVersion("org",1,"tenant"), { code: "UNAVAILABLE" });
  assert.equal(connects,1); await store.close(); assert.equal(closes,0);
});
test("R3-C1 injected migration-role client is rejected before write", async () => {
  const queries: string[] = []; let released = 0;
  const pool: PostgreSqlPoolPort = { connect: async () => await Promise.resolve({
    query: <Row extends Record<string,unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> => { queries.push(sql); return Promise.resolve({ rows: [{ role: "ai_mls_production_migration_operator" } as unknown as Row], rowCount: 1 }); }, release: () => { released++; }
  }), close: () => Promise.resolve() };
  const store = await loadStore(pool);
  await assert.rejects(() => store.createProposed(record), { code: "UNAVAILABLE" });
  assert.equal(queries.length,1); assert.equal(released,1);
});
test("R3-C1 failed BEGIN is rolled back and failed release reports unavailable while draining close", async () => {
  for (const failure of ["BEGIN","release"]) {
    const queries:string[]=[];let releases=0;
    const pool:PostgreSqlPoolPort={connect:()=>Promise.resolve({
      query:<Row extends Record<string,unknown>>(sql:string):Promise<PostgreSqlQueryResult<Row>>=>{
        queries.push(sql);if(sql===failure)return Promise.reject(new Error("transport failure"));
        return Promise.resolve({rows:sql.startsWith("SELECT current_user")?[{role:"ai_mls_production_runtime"} as unknown as Row]:[],rowCount:0});
      },release:()=>{releases++;if(failure==="release")throw new Error("release failure");}
    }),close:()=>Promise.resolve()};
    const store=await loadStore(pool);await assert.rejects(()=>store.createProposed(record),{code:"UNAVAILABLE"});
    if(failure==="BEGIN")assert.ok(queries.includes("ROLLBACK"));
    assert.equal(releases,1);await store.close();
  }
});
test("R3-C1 injected evidence/read-port failures permit only a replay lookup before mutation", async () => {
  let acquired=0;const queries:string[]=[];
  const pool:PostgreSqlPoolPort={connect:()=>{acquired++;return Promise.resolve({
    query:<Row extends Record<string,unknown>>(sql:string):Promise<PostgreSqlQueryResult<Row>>=>{queries.push(sql);return Promise.resolve({rows:[],rowCount:0});},
    release:()=>undefined,
  });},close:()=>Promise.resolve()};
  const projectPath="../../../modules/administration/src/project-governance-postgresql.js";
  const projectModule=await import(projectPath) as {PostgreSqlProjectGovernanceStore:new(pool:PostgreSqlPoolPort,reader:{findActive:()=>Promise<unknown>})=>Store};
  const project=new projectModule.PostgreSqlProjectGovernanceStore(pool,{findActive:()=>Promise.reject(new Error("private driver context"))});
  await assert.rejects(()=>project.createProposed({projectId:"project",projectVersion:1,organizationId:"org",tenantId:"tenant",status:"PROPOSED",containedScopes:[{scopeType:"TEAM",scopeId:"team"}],evidenceReferences:record.evidenceReferences,createdAt:record.createdAt,updatedAt:record.updatedAt}),{code:"UNAVAILABLE"});
  const bindingPath="../../../modules/identity/src/workload-startup-binding-postgresql.js";
  const bindingModule=await import(bindingPath) as {PostgreSqlWorkloadStartupBindingStore:new(pool:PostgreSqlPoolPort,verifier:{assertBindingReferences:()=>Promise<void>})=>Store};
  const binding=new bindingModule.PostgreSqlWorkloadStartupBindingStore(pool,{assertBindingReferences:()=>Promise.reject(new Error("private evidence context"))});
  await assert.rejects(()=>binding.createProposed({bindingId:"binding",bindingVersion:1,registrationId:"registration",registrationVersion:1,tenantId:"tenant",principalId:"principal",organizationId:"org",projectId:"project",scopeType:"TEAM",scopeId:"team",identityEvidenceRef:"identity",organizationEvidenceRef:"organization-governance:org:1",projectEvidenceRef:"project-governance:project:1",scopeEvidenceRef:"administration-scope:tenant:TEAM_SCOPE:team:1",status:"PROPOSED",auditEvidenceRef:"audit",createdAt:record.createdAt,updatedAt:record.updatedAt}),{code:"UNAVAILABLE"});
  assert.equal(acquired,2);
  assert.equal(queries.length,2);
  assert.ok(queries.every(query=>query.startsWith("SELECT ")));
  assert.ok(queries.every(query=>!query.includes("INSERT")&&!query.includes("UPDATE")&&!query.includes("BEGIN")));
  await project.close();await binding.close();
});
