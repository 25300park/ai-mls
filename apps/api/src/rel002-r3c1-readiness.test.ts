import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
test("R3-C1 aggregate readiness fails closed without all three roots and performs no repair", async () => {
  const path = "./r3c1-postgresql-readiness.js";
  const module = await import(path) as { evaluateR3C1Persistence: (pool: PostgreSqlPoolPort) => Promise<{ status: string; failingRoots: readonly string[] }> };
  const queries: string[] = []; let released=0;
  const pool: PostgreSqlPoolPort = { connect: async () => await Promise.resolve({
    query: <Row extends Record<string,unknown>>(sql: string): Promise<PostgreSqlQueryResult<Row>> => { queries.push(sql); return Promise.resolve({ rows: sql.startsWith("SELECT current_user") ? [{ role: "ai_mls_production_runtime" } as unknown as Row] : [], rowCount: 0 }); },
    release: () => { released++; }
  }), close: () => Promise.resolve() };
  const result=await module.evaluateR3C1Persistence(pool);
  assert.equal(result.status,"NOT_READY"); assert.deepEqual([...result.failingRoots].sort(),["app_administration","app_identity","app_organization"]);
  assert.equal(released,1); assert.ok(queries.every(q => !/^\s*(?:CREATE|ALTER|GRANT|INSERT|UPDATE|DELETE)\b/iu.test(q)));
});