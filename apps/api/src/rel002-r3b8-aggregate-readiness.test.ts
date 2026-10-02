import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import * as readiness from "./child-root-postgresql-readiness.js";
const { R3B1_CHILD_ROOT_SCHEMA_CONTRACTS } = readiness;
const evaluate = readiness.evaluateR3B1ChildRootSchemas;
function validRows(): Record<string, unknown>[] {
  return R3B1_CHILD_ROOT_SCHEMA_CONTRACTS.map((contract) => ({
    schema_name: contract.schemaName,
    artifact_sha256: contract.artifactSha256,
    table_count: contract.tableCount,
    schema_comment: contract.schemaComment,
    runtime_usage: true,
    runtime_create: false,
    public_acl_count: 0,
    runtime_grant_option_count: 0,
    columns_hash: contract.columnsHash,
    constraints_hash: contract.constraintsHash,
    indexes_hash: contract.indexesHash,
    runtime_acl_hash: contract.runtimeAclHash,
    owner_name: "ai_mls_production_migration_operator",
    public_schema_acl_count: 0,
    schema_grant_option_count: 0,
    function_acl_violation_count: 0,
    trigger_hash: contract.triggerHash,
    function_hash: contract.functionHash,
    effective_acl_hash: contract.effectiveAclHash,
    table_owner_violation_count: 0,
    function_owner_violation_count: 0,
    table_acl_violation_count: 0,
    unexpected_runtime_membership_count: 0,
    sequence_count: 0,
    unexpected_role_membership: false,
  }));
}
function harness(rows = validRows(), failure?: "connect" | "query" | "release") {
 const calls = { connects: 0, releases: 0, sql: [] as string[] };
 const pool: PostgreSqlPoolPort = { connect: async () => { await Promise.resolve(); calls.connects++; if(failure === "connect") throw new Error("unsafe-driver private-host stack"); return {
 query: async <Row extends Record<string, unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> => { await Promise.resolve(); calls.sql.push(sql); if(failure === "query") throw new Error("unsafe-driver private-host stack"); return { rows: rows as Row[], rowCount: rows.length }; },
 release: () => { calls.releases++; if(failure === "release") throw new Error("unsafe-driver private-host stack"); }
 }; }, close: () => Promise.resolve() };
 return {pool,calls};
}
test("R3-B8 all five exact schemas yield READY from one read-only lease", async () => {
 const {pool,calls}=harness(); const result=await evaluate(pool);
 assert.equal(result.status,"READY"); assert.equal(result.children.length,5); assert.deepEqual(result.failingSchemas,[]);
 assert.ok(result.children.every(c=>c.status==="PASS"&&c.reason===null)); assert.equal(calls.connects,1); assert.equal(calls.releases,1); assert.equal(calls.sql.length,1);
 assert.match(calls.sql[0]!,/^\s*WITH expected/u); assert.doesNotMatch(calls.sql[0]!,/\b(?:CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s+(?:TABLE|SCHEMA|ROLE|ON|INTO|FROM)/iu);
});
for(const contract of R3B1_CHILD_ROOT_SCHEMA_CONTRACTS) test("R3-B8 reports independent failure: "+contract.schemaName,async()=>{
 const rows=validRows(); rows.find(r=>r["schema_name"]===contract.schemaName)!["constraints_hash"]="drift";
 const result=await evaluate(harness(rows).pool); assert.equal(result.status,"NOT_READY"); assert.deepEqual(result.failingSchemas,[contract.schemaName]); assert.equal(result.children.filter(c=>c.status==="PASS").length,4);
 assert.equal(result.children.find(c=>c.schemaName===contract.schemaName)!.reason,"SCHEMA_CONTRACT_MISMATCH");
});
test("R3-B8 multiple failures and missing/duplicate rows are never masked",async()=>{
 const rows=validRows(); rows[0]!["table_count"]=0; rows[4]!["runtime_create"]=true;
 assert.deepEqual((await evaluate(harness(rows).pool)).failingSchemas,["app_publication","app_advisory"]);
 for(const malformed of [validRows().slice(1),[...validRows(),validRows()[0]!]]) assert.equal((await evaluate(harness(malformed).pool)).status,"NOT_READY");
});
for(const failure of ["connect","query","release"] as const) test("R3-B8 normalizes "+failure+" failure without secret evidence",async()=>{
 const {pool,calls}=harness(undefined,failure); const result=await evaluate(pool); assert.equal(result.status,"NOT_READY"); assert.equal(result.failingSchemas.length,5);
 assert.ok(result.children.every(c=>c.reason==="READINESS_UNAVAILABLE")); assert.doesNotMatch(JSON.stringify(result),/unsafe-driver|private-host|stack/u); assert.equal(calls.releases,failure==="connect"?0:1);
});
