import assert from "node:assert/strict";
import test from "node:test";

import type { DurableSessionRecord } from "./session-persistence.js";
import {
  PostgreSqlSessionUnitOfWork,
  type AsyncSessionRepository,
} from "./session-postgresql-persistence.js";
import {
  PostgreSqlPersistenceError,
  type PostgreSqlClientPort,
  type PostgreSqlPoolPort,
  type PostgreSqlQueryResult,
} from "./postgresql-pool.js";

function record(overrides: Partial<DurableSessionRecord> = {}): DurableSessionRecord {
  const base: DurableSessionRecord = {
    id: "session-1", principalId: "principal-1", principalType: "HUMAN", roles: Object.freeze(["ADM"]),
    state: "ACTIVE", assurance: "MFA", isMfaVerified: true, familyId: "family-1",
    refreshReference: "refresh:1", sessionVersion: 1, tenantBindingOrigin: "tenant:1",
    issuedAt: "2026-09-19T00:00:00.000Z", auditEvidenceRef: "audit:1",
    lastAccessedAt: "2026-09-19T00:01:00.000Z", lastMfaVerifiedAt: "2026-09-19T00:00:00.000Z",
  };
  return Object.freeze({ ...base, ...overrides });
}

function harness(
  respond: (text: string, values: readonly unknown[] | undefined) => PostgreSqlQueryResult | Promise<PostgreSqlQueryResult>,
): Readonly<{ events: string[]; pool: PostgreSqlPoolPort; client: PostgreSqlClientPort }> {
  const events: string[] = [];
  const client: PostgreSqlClientPort = {
    query: async <Row extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
      events.push(text.replace(/\s+/gu, " ").trim());
      return await respond(text, values) as PostgreSqlQueryResult<Row>;
    },
    release: (destroy = false) => { events.push(`RELEASE:${String(destroy)}`); },
  };
  const pool: PostgreSqlPoolPort = {
    connect: () => { events.push("CONNECT"); return Promise.resolve(client); },
    close: () => { events.push("POOL_CLOSE"); return Promise.resolve(); },
  };
  return Object.freeze({ events, pool, client });
}

test("uses one checked-out client for BEGIN, mutation, COMMIT, and release", async () => {
  const { events, pool } = harness((text) => {
    if (text.includes("SELECT session_version")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 1 };
  });
  const uow = new PostgreSqlSessionUnitOfWork(pool);

  const result = await uow.transaction({ sessionId: "session-1", expectedVersion: 0 }, async (sessions) => {
    await sessions.create(record());
    return "created";
  });

  assert.equal(result, "created");
  assert.equal(events[0], "CONNECT");
  assert.equal(events[1], "BEGIN");
  assert.match(events[2] ?? "", /SELECT session_version/u);
  assert.match(events[3] ?? "", /INSERT INTO app_identity\.identity_sessions/u);
  assert.equal(events[4], "COMMIT");
  assert.equal(events[5], "RELEASE:false");
});

test("rolls back and releases the same client when an operation fails", async () => {
  const stored = record();
  const { events, pool } = harness((text) => {
    if (text.includes("SELECT session_version")) return { rows: [{ session_version: "1" }], rowCount: 1 };
    if (text.includes("SELECT session_id")) {
      return {
        rows: [{
          session_id: stored.id,
          session_version: "1",
          state: stored.state,
          payload_json: stored,
        }],
        rowCount: 1,
      };
    }
    if (text.includes("UPDATE app_identity.identity_sessions")) {
      throw new Error("postgresql://runtime:secret@private-db SELECT stack");
    }
    return { rows: [], rowCount: 1 };
  });
  const uow = new PostgreSqlSessionUnitOfWork(pool);

  await assert.rejects(
    () => uow.transaction({ sessionId: "session-1", expectedVersion: 1 }, async (sessions) => {
      await sessions.update(1, record({ sessionVersion: 2, lastAccessedAt: "2026-09-19T00:02:00.000Z" }));
    }),
    (error: unknown) => error instanceof PostgreSqlPersistenceError
      && error.message === "PostgreSQL persistence is unavailable."
      && !error.message.includes("secret"),
  );
  assert.equal(events.includes("COMMIT"), false);
  assert.equal(events.at(-2), "ROLLBACK");
  assert.equal(events.at(-1), "RELEASE:true");
});

test("preserves optimistic concurrency and one mutation per transaction", async () => {
  const { pool } = harness((text) => text.includes("SELECT session_version")
    ? { rows: [{ session_version: "2" }], rowCount: 1 }
    : { rows: [], rowCount: 1 });
  const uow = new PostgreSqlSessionUnitOfWork(pool);

  await assert.rejects(
    () => uow.transaction({ sessionId: "session-1", expectedVersion: 1 }, () => Promise.resolve(undefined)),
    (error: unknown) => (error as { code?: string }).code === "SESSION_VERSION_CONFLICT",
  );
});

test("supports bounded reads through the transaction repository", async () => {
  const stored = record();
  const { pool } = harness((text) => {
    if (text.includes("SELECT session_version")) return { rows: [{ session_version: "1" }], rowCount: 1 };
    if (text.includes("SELECT session_id")) {
      return { rows: [{
        session_id: stored.id,
        session_version: "1",
        state: stored.state,
        payload_json: stored,
      }], rowCount: 1 };
    }
    return { rows: [], rowCount: 1 };
  });
  const uow = new PostgreSqlSessionUnitOfWork(pool);
  let repository: AsyncSessionRepository | undefined;
  const found = await uow.transaction({ sessionId: "session-1", expectedVersion: 1 }, async (sessions) => {
    repository = sessions;
    return await sessions.find("session-1");
  });
  assert.deepEqual(found, stored);
  assert.ok(repository !== undefined);
});

test("closing the UoW does not close its Bootstrap-owned shared pool", async () => {
  const { events, pool } = harness(() => ({ rows: [], rowCount: 0 }));
  const uow = new PostgreSqlSessionUnitOfWork(pool);
  await uow.close();
  await uow.close();
  assert.equal(events.includes("POOL_CLOSE"), false);
  await assert.rejects(
    () => uow.transaction({ sessionId: "session-1", expectedVersion: 0 }, () => Promise.resolve(undefined)),
    PostgreSqlPersistenceError,
  );
});
