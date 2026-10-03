import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/postgresql-pool.js";
import { PostgreSqlSessionReader } from "../../../modules/identity/src/session-postgresql-persistence.js";
import { assertR3C2IdentityBaseReady } from "./r3c2-aggregate-readiness.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && process.env["REL002_TEST_POSTGRES_PORT"] === "55441";
test("B1 disposable approved runtime reads empty durable Session state without revocation ledger SELECT", { skip: !enabled }, async () => {
  const native = new Pool({ host: "127.0.0.1", port: 55441, database: "postgres", user: "ai_mls_production_runtime", max: 1 });
  const pool: PostgreSqlPoolPort = {
    connect: async () => {
      const client = await native.connect();
      return {
        query: async <R extends Record<string, unknown>>(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<R>> => {
          const result = await client.query<R>(sql, values === undefined ? undefined : [...values]);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
        release: destroy => client.release(destroy),
      };
    },
    close: () => native.end(),
  };
  try {
    await assertR3C2IdentityBaseReady(pool);
    const acl = await native.query<{ role: string; session_read: boolean; ledger_read: boolean; count: string }>("SELECT current_user AS role, has_table_privilege(current_user,'app_identity.identity_sessions','SELECT') AS session_read, has_table_privilege(current_user,'app_identity.identity_session_revocations','SELECT') AS ledger_read, (SELECT count(*) FROM app_identity.identity_sessions) AS count");
    const row = acl.rows[0]; assert.ok(row);
    assert.equal(row.role, "ai_mls_production_runtime");
    assert.equal(row.session_read, true);
    assert.equal(row.ledger_read, false);
    assert.equal(Number(row.count), 0);
    for (let restart = 0; restart < 2; restart++) await new PostgreSqlSessionReader(pool).assertReadPathReady();
    assert.equal(native.totalCount, 1);
    assert.equal(native.idleCount, 1);
  } finally { await native.end(); }
});
