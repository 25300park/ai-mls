import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort } from "../../../modules/identity/src/postgresql-pool.js";
import { evaluateR3C2BEvidencePersistence, R3C2B_EVIDENCE_CONTRACTS, R3C2B_EVIDENCE_CATALOG_QUERY } from "./r3c2b-postgresql-readiness.js";
test("C2B evidence readiness fails closed on missing duplicate fingerprint and role drift", async () => {
  const valid = R3C2B_EVIDENCE_CONTRACTS.map(contract => ({ schema_name: contract.schemaName, table_name: contract.tableName, fingerprint: contract.fingerprint, authority_ok: true }));
  const pool = (rows: readonly Record<string, unknown>[], role = "ai_mls_production_runtime"): PostgreSqlPoolPort => ({ connect() { return Promise.resolve({ query<Row extends Record<string, unknown>>(sql: string) { return Promise.resolve({ rows: (sql === "SELECT current_user AS role" ? [{ role }] : sql === R3C2B_EVIDENCE_CATALOG_QUERY ? rows : []) as readonly Row[], rowCount: rows.length }); }, release() { return; } }); }, close() { return Promise.resolve(); } });
  assert.equal((await evaluateR3C2BEvidencePersistence(pool(valid))).status, "READY");
  for (const rows of [[], valid.slice(1), [...valid, valid[0]!], valid.map(row => ({ ...row, fingerprint: "wrong" })), valid.map(row => ({ ...row, authority_ok: false }))]) assert.equal((await evaluateR3C2BEvidencePersistence(pool(rows))).status, "NOT_READY");
  assert.equal((await evaluateR3C2BEvidencePersistence(pool(valid, "ai_mls_production_migration_operator"))).status, "NOT_READY");
});
