import assert from "node:assert/strict";
import test from "node:test";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "./postgresql-pool.js";

import { PostgreSqlSessionReader } from "./session-postgresql-persistence.js";
function harness(fail = false, rows: readonly Record<string, unknown>[] = [], releaseFailure = false) {
  const events: string[] = [];
  const pool: PostgreSqlPoolPort = {
    connect: () => Promise.resolve({
      query: <R extends Record<string, unknown>>(sql: string): Promise<PostgreSqlQueryResult<R>> => {
        events.push(sql);
        return fail ? Promise.reject(new Error("private connection detail")) : Promise.resolve({ rows: rows as readonly R[], rowCount: rows.length });
      },
      release: destroy => { events.push(`release:${String(destroy)}`); if (releaseFailure) throw new Error("private lease detail"); },
    }),
    close: () => { events.push("pool-close"); return Promise.resolve(); },
  };
  return { pool, events };
}
test("read-only Session foundation accepts zero rows without mutations or arbitrary session lookup", async () => {
  const { pool, events } = harness();
  const reader = new PostgreSqlSessionReader(pool);
  await reader.assertReadPathReady();
  assert.equal(events.length, 2);
  assert.match(events[0]!, /FROM app_identity.identity_sessions LIMIT 0/u);
  assert.equal(events[1], "release:false");
  assert.equal(await reader.find("explicit-request-session"), undefined);
  assert.equal(events.some(value => /INSERT|UPDATE|DELETE|FOR UPDATE|identity_session_revocations|pool-close/u.test(value)), false);
});

test("lease cleanup failure is normalized on both successful and failed reads", async () => {
  for (const queryFailure of [false, true]) {
    const { pool } = harness(queryFailure, [], true);
    await assert.rejects(new PostgreSqlSessionReader(pool).assertReadPathReady(), /PostgreSQL persistence is unavailable/u);
  }
});

test("effective revocation and expiry use canonical Session state and mismatched persisted state fails closed", async () => {
  const base = {
    id: "session-1", principalId: "human-1", principalType: "HUMAN", roles: ["ADM"],
    state: "ACTIVE", assurance: "SINGLE_FACTOR", isMfaVerified: false, familyId: "family-1",
    refreshReference: "refresh:1", sessionVersion: 1, tenantBindingOrigin: "tenant:1",
    issuedAt: "2026-10-03T00:00:00.000Z", lastAccessedAt: "2026-10-03T00:00:00.000Z", auditEvidenceRef: "audit:1",
  };
  for (const state of ["ACTIVE", "EXPIRED", "REVOKED"]) {
    const payload = { ...base, state, ...(state === "REVOKED" ? { revokedAt: "2026-10-03T00:01:00.000Z", revocationEvidenceRef: "revoke:1" } : {}) };
    const row = { session_id: "session-1", session_version: 1, state, payload_json: payload };
    const { pool } = harness(false, [row]);
    assert.equal((await new PostgreSqlSessionReader(pool).find("session-1"))?.state, state);
    const mismatch = harness(false, [{ ...row, state: "UNKNOWN" }]);
    await assert.rejects(new PostgreSqlSessionReader(mismatch.pool).find("session-1"), /PostgreSQL persistence is unavailable/u);
  }
});
test("read failure is normalized and the shared pool client is discarded", async () => {
  const { pool, events } = harness(true);
  const reader = new PostgreSqlSessionReader(pool);
  await assert.rejects(reader.assertReadPathReady(), /PostgreSQL persistence is unavailable/u);
  assert.equal(events.at(-1), "release:true");
});
