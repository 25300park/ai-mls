import assert from "node:assert/strict";
import test from "node:test";

import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/postgresql-pool.js";
import { PostgreSqlConnectorExecutionUnitOfWork } from "./connector-postgresql-persistence.js";

test("R3-B4 PostgreSQL lease acquisition uses one atomic checked-out client", async () => {
  const commands: string[] = [];
  let releases = 0;
  let connections = 0;
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      commands.push(text);
      if (text.startsWith("SELECT revision")) return Promise.resolve(result([{ revision: 0 }]) as unknown as PostgreSqlQueryResult<Row>);
      if (text.startsWith("SELECT payload_json FROM app_connector.connector_leases")) return Promise.resolve(result<Row>([]));
      return Promise.resolve(result<Row>([], 1));
    },
    release(): void { releases += 1; },
  };
  const pool: PostgreSqlPoolPort = {
    connect(): Promise<PostgreSqlClientPort> { connections += 1; return Promise.resolve(client); },
    close(): Promise<void> { return Promise.resolve(); },
  };
  const persistence = new PostgreSqlConnectorExecutionUnitOfWork(pool);

  const lease = await persistence.acquireLease({
    tenantId: "tenant-r3b4",
    scopeType: "TEAM",
    scopeId: "team-r3b4",
    sourceId: "source-r3b4",
    connectorId: "connector-r3b4",
    leaseId: "lease-r3b4",
    ownerId: "worker-r3b4",
    acquiredAt: "2026-09-30T00:00:00.000Z",
    expiresAt: "2026-09-30T00:05:00.000Z",
    expectedScopeRevision: 0,
  });

  assert.equal(lease.status, "ACTIVE");
  assert.equal(connections, 1);
  assert.equal(commands[0], "BEGIN");
  assert.equal(commands.at(-1), "COMMIT");
  assert.equal(commands.filter((command) => command === "BEGIN").length, 1);
  assert.equal(commands.filter((command) => command === "COMMIT").length, 1);
  assert.equal(releases, 1);
});

test("R3-B4 PostgreSQL invocation replay does not require UPDATE on append-only results", async () => {
  const commands: string[] = [];
  const scope = Object.freeze({ tenantId: "tenant-r3b4", scopeType: "TEAM" as const, scopeId: "team-r3b4", sourceId: "source-r3b4", connectorId: "connector-r3b4" });
  const intent = Object.freeze({ ...scope, invocationId: "invocation-r3b4", leaseId: "lease-r3b4", idempotencyKey: "test-r3b4-1", inputFingerprint: "fingerprint-r3b4", inputReference: "input:r3b4", inputVersion: 1, sourcePolicyVersion: 1, connectorVersion: 1, expectedCheckpointVersion: 0, preparedAt: "2026-09-30T00:00:01.000Z" });
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      commands.push(text);
      if (text.includes("FROM app_connector.connector_idempotency")) return Promise.resolve(result([{ payload_json: { ...scope, idempotencyKey: intent.idempotencyKey, invocationId: intent.invocationId, inputFingerprint: intent.inputFingerprint } }]) as unknown as PostgreSqlQueryResult<Row>);
      if (text.includes("FROM app_connector.connector_invocations")) return Promise.resolve(result([{ raw_state: "PREPARED", payload_json: { ...intent, state: "PREPARED" } }]) as unknown as PostgreSqlQueryResult<Row>);
      if (text.includes("FROM app_connector.connector_results")) return Promise.resolve(result<Row>([]));
      return Promise.resolve(result<Row>([], 1));
    },
    release(destroy?: boolean): void { void destroy; },
  };
  const persistence = new PostgreSqlConnectorExecutionUnitOfWork({ connect: () => Promise.resolve(client), close: () => Promise.resolve() });

  assert.equal((await persistence.prepareInvocation(intent)).state, "PREPARED");
  assert.equal(commands.some((command) => command.includes("connector_results") && command.includes("FOR UPDATE")), false);
});

test("R3-B4 PostgreSQL ambiguous COMMIT quarantines the persistence boundary", async () => {
  const commands: string[] = [];
  const releases: boolean[] = [];
  let connections = 0;
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      commands.push(text);
      if (text === "COMMIT") return Promise.reject(new Error("connection lost"));
      if (text.startsWith("SELECT revision")) return Promise.resolve(result([{ revision: 0 }]) as unknown as PostgreSqlQueryResult<Row>);
      if (text.startsWith("SELECT payload_json FROM app_connector.connector_leases")) return Promise.resolve(result<Row>([]));
      return Promise.resolve(result<Row>([], 1));
    },
    release(destroy?: boolean): void { releases.push(destroy === true); },
  };
  const persistence = new PostgreSqlConnectorExecutionUnitOfWork({
    connect(): Promise<PostgreSqlClientPort> { connections += 1; return Promise.resolve(client); },
    close(): Promise<void> { return Promise.resolve(); },
  });
  const lease = {
    tenantId: "tenant-r3b4", scopeType: "TEAM" as const, scopeId: "team-r3b4", sourceId: "source-r3b4", connectorId: "connector-r3b4",
    leaseId: "lease-r3b4", ownerId: "worker-r3b4", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:05:00.000Z", expectedScopeRevision: 0,
  };

  await assert.rejects(persistence.acquireLease(lease), { code: "PERSISTENCE_UNAVAILABLE" });
  await assert.rejects(persistence.findLease(lease), { code: "PERSISTENCE_UNAVAILABLE" });
  assert.equal(commands.includes("ROLLBACK"), false);
  assert.deepEqual(releases, [true]);
  assert.equal(connections, 1);
});

test("R3-B4 PostgreSQL command failure rolls back on the same client", async () => {
  const commands: string[] = [];
  const releases: boolean[] = [];
  const client: PostgreSqlClientPort = {
    query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      commands.push(text);
      if (text.startsWith("SELECT revision")) return Promise.resolve(result([{ revision: 1 }]) as unknown as PostgreSqlQueryResult<Row>);
      return Promise.resolve(result<Row>([], 1));
    },
    release(destroy?: boolean): void { releases.push(destroy === true); },
  };
  const persistence = new PostgreSqlConnectorExecutionUnitOfWork({ connect: () => Promise.resolve(client), close: () => Promise.resolve() });

  await assert.rejects(persistence.acquireLease({
    tenantId: "tenant-r3b4", scopeType: "TEAM", scopeId: "team-r3b4", sourceId: "source-r3b4", connectorId: "connector-r3b4",
    leaseId: "lease-r3b4", ownerId: "worker-r3b4", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:05:00.000Z", expectedScopeRevision: 0,
  }), { code: "LEASE_VERSION_CONFLICT" });
  assert.equal(commands[0], "BEGIN");
  assert.equal(commands.at(-1), "ROLLBACK");
  assert.equal(commands.includes("COMMIT"), false);
  assert.deepEqual(releases, [true]);
});

function result<Row extends Record<string, unknown>>(rows: readonly Row[], rowCount = rows.length): PostgreSqlQueryResult<Row> {
  return Object.freeze({ rows, rowCount });
}
