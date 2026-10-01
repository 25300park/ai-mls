import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client, Pool } from "pg";
import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import { ConnectorPersistenceError } from "../../../modules/source/src/connector-durable-persistence.js";
import { PostgreSqlConnectorExecutionUnitOfWork } from "../../../modules/source/src/connector-postgresql-persistence.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);
const scope = Object.freeze({ tenantId: "tenant-r3b4", scopeType: "TEAM" as const, scopeId: "team-r3b4", sourceId: "source-r3b4", connectorId: "connector-r3b4" });

async function artifact(name: string): Promise<string> {
  return readFile(resolve("modules/source/connector/migrations/postgresql/production", name), "utf8");
}

test("R3-B4 Connector PostgreSQL persistence preserves atomic lifecycle, replay, and version semantics", { skip: !enabled }, async () => {
  const admin = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await admin.connect();
  const cleanup = async (): Promise<void> => {
    await admin.query("DROP SCHEMA IF EXISTS app_connector CASCADE");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      const found = await admin.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists", [role]);
      if (found.rows[0]?.exists === true) { await admin.query(`DROP OWNED BY ${role}`); await admin.query(`DROP ROLE ${role}`); }
    }
  };
  try {
    await cleanup();
    await admin.query("CREATE ROLE ai_mls_production_migration_operator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("CREATE ROLE ai_mls_production_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS");
    await admin.query("GRANT CONNECT,CREATE ON DATABASE postgres TO ai_mls_production_migration_operator");
    await admin.query("GRANT CONNECT ON DATABASE postgres TO ai_mls_production_runtime");
    const migration = new Client({ host: "127.0.0.1", port, user: "ai_mls_production_migration_operator", database: "postgres" });
    await migration.connect();
    try {
      await migration.query(await artifact("001_schema_v1.up.sql"));
      await migration.query(await artifact("002_runtime_role_grants.sql"));
    }
    finally { await migration.end(); }

    const nativePool = new Pool({ host: "127.0.0.1", port, user: "ai_mls_production_runtime", database: "postgres", max: 5 });
    const pool = poolPort(nativePool);
    const store = new PostgreSqlConnectorExecutionUnitOfWork(pool);
    try {
      await store.acquireLease({ ...scope, leaseId: "lease-r3b4", ownerId: "worker-r3b4", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:05:00.000Z", expectedScopeRevision: 0 });
      const intent = { ...scope, invocationId: "invocation-r3b4", leaseId: "lease-r3b4", idempotencyKey: "test-r3b4-1", inputFingerprint: "fingerprint-r3b4", inputReference: "input:r3b4", inputVersion: 1, sourcePolicyVersion: 1, connectorVersion: 1, expectedCheckpointVersion: 0, preparedAt: "2026-09-30T00:00:01.000Z" } as const;
      const concurrentReplay = await Promise.all([store.prepareInvocation(intent), store.prepareInvocation(intent)]);
      assert.equal(concurrentReplay[0].state, "PREPARED");
      assert.deepEqual(concurrentReplay[0], concurrentReplay[1]);
      assert.deepEqual(concurrentReplay[0], await store.findInvocation(scope, intent.invocationId));
      await store.markExecutionStarted(scope, intent.invocationId, "2026-09-30T00:00:02.000Z");
      await store.completeInvocation({ ...scope, invocationId: intent.invocationId, resultId: "result-r3b4", outcome: "SUCCEEDED", reasonCode: "CONFIRMED", safeEvidenceReference: "evidence:r3b4", checkpointReference: "checkpoint:r3b4", completedAt: "2026-09-30T00:00:03.000Z" });
      assert.equal((await store.findCheckpoint(scope))?.version, 1);
      assert.deepEqual((await store.listEvidence(scope)).map((item) => item.kind), ["INTENT_PREPARED", "EXECUTION_STARTED", "RESULT_RECORDED"]);

      const attempts = await Promise.allSettled([
        store.recordTechnicalState({ ...scope, recordType: "HEALTH_SIGNAL", recordId: "health-r3b4", status: "HEALTHY", expectedVersion: 0, idempotencyKey: "health-a", inputFingerprint: "fingerprint-health-a", safeEvidenceReference: "evidence:health:a", recordedAt: "2026-09-30T00:00:04.000Z" }),
        store.recordTechnicalState({ ...scope, recordType: "HEALTH_SIGNAL", recordId: "health-r3b4", status: "DEGRADED", expectedVersion: 0, idempotencyKey: "health-b", inputFingerprint: "fingerprint-health-b", safeEvidenceReference: "evidence:health:b", recordedAt: "2026-09-30T00:00:04.000Z" }),
      ]);
      assert.equal(attempts.filter((item) => item.status === "fulfilled").length, 1);
      assert.equal(attempts.filter((item) => item.status === "rejected" && item.reason instanceof ConnectorPersistenceError && item.reason.code === "TECHNICAL_VERSION_CONFLICT").length, 1);

      const exactTechnical = { ...scope, recordType: "CONNECTOR_INSTANCE" as const, recordId: "instance-r3b4", status: "ACTIVE", expectedVersion: 0, idempotencyKey: "instance-exact", inputFingerprint: "fingerprint-instance-exact", safeEvidenceReference: "evidence:instance:exact", recordedAt: "2026-09-30T00:00:05.000Z" };
      const technicalReplay = await Promise.all([store.recordTechnicalState(exactTechnical), store.recordTechnicalState(exactTechnical)]);
      assert.deepEqual(technicalReplay[0], technicalReplay[1]);
      assert.equal((await store.listTechnicalEvidence(scope, "CONNECTOR_INSTANCE", "instance-r3b4")).length, 1);

      const leaseScope = { ...scope, scopeId: "team-r3b4-expired" };
      await store.acquireLease({ ...leaseScope, leaseId: "lease-expired", ownerId: "worker-old", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:01:00.000Z", expectedScopeRevision: 0 });
      const replacement = await store.acquireLease({ ...leaseScope, leaseId: "lease-replacement", ownerId: "worker-new", acquiredAt: "2026-09-30T00:02:00.000Z", expiresAt: "2026-09-30T00:03:00.000Z", expectedScopeRevision: 1 });
      assert.equal(replacement.leaseId, "lease-replacement");

      const releaseRaceScope = { ...scope, scopeId: "team-r3b4-release-race" };
      await store.acquireLease({ ...releaseRaceScope, leaseId: "lease-release-race", ownerId: "worker-old", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:10:00.000Z", expectedScopeRevision: 0 });
      const releaseRace = await Promise.allSettled([
        store.releaseLease(releaseRaceScope, "lease-release-race", 1, "2026-09-30T00:01:00.000Z"),
        store.acquireLease({ ...releaseRaceScope, leaseId: "lease-after-release", ownerId: "worker-new", acquiredAt: "2026-09-30T00:02:00.000Z", expiresAt: "2026-09-30T00:12:00.000Z", expectedScopeRevision: 1 }),
      ]);
      assert.equal(releaseRace[0].status, "fulfilled");
      assert.equal(releaseRace.some((item) => item.status === "rejected" && item.reason instanceof ConnectorPersistenceError && item.reason.code === "PERSISTENCE_UNAVAILABLE"), false);

      const expiryRaceScope = { ...scope, scopeId: "team-r3b4-expiry-race" };
      await store.acquireLease({ ...expiryRaceScope, leaseId: "lease-expiry-race", ownerId: "worker-old", acquiredAt: "2026-09-30T00:00:00.000Z", expiresAt: "2026-09-30T00:01:00.000Z", expectedScopeRevision: 0 });
      const expiryRace = await Promise.allSettled([
        store.expireLeases("2026-09-30T00:02:00.000Z"),
        store.acquireLease({ ...expiryRaceScope, leaseId: "lease-after-expiry", ownerId: "worker-new", acquiredAt: "2026-09-30T00:02:00.000Z", expiresAt: "2026-09-30T00:12:00.000Z", expectedScopeRevision: 1 }),
      ]);
      assert.equal(expiryRace[0].status, "fulfilled");
      assert.equal(expiryRace.some((item) => item.status === "rejected" && item.reason instanceof ConnectorPersistenceError && item.reason.code === "PERSISTENCE_UNAVAILABLE"), false);
    } finally {
      await store.close();
      await pool.close();
    }
  } finally {
    await cleanup();
    await admin.end();
  }
});

function poolPort(nativePool: Pool): PostgreSqlPoolPort {
  return {
    connect: async (): Promise<PostgreSqlClientPort> => {
      const client = await nativePool.connect();
      return {
        query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) =>
          client.query(text, values === undefined ? undefined : [...values]) as unknown as Promise<PostgreSqlQueryResult<Row>>,
        release: (destroy?: boolean) => client.release(destroy === true),
      };
    },
    close: () => nativePool.end(),
  };
}
