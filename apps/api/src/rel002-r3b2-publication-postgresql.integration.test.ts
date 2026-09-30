import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { Client, Pool } from "pg";
import type { PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../../modules/identity/src/index.js";
import { createPublication } from "../../../modules/publication/src/publication-factory.js";
import { PostgreSqlPublicationUnitOfWork } from "../../../modules/publication/src/publication-postgresql-persistence.js";

const enabled = process.env["REL002_TEST_POSTGRES_DISPOSABLE"] === "CONFIRMED"
  && /^\d{4,5}$/u.test(process.env["REL002_TEST_POSTGRES_PORT"] ?? "");
const port = Number(process.env["REL002_TEST_POSTGRES_PORT"]);

async function artifact(name: string): Promise<string> {
  await Promise.resolve();
  return readFile(resolve("modules/publication/migrations/postgresql/production", name), "utf8");
}

test("R3-B2 Publication PostgreSQL persistence commits and rolls back through one runtime pool", { skip: !enabled }, async () => {
  const admin = new Client({ host: "127.0.0.1", port, user: "postgres", database: "postgres" });
  await admin.connect();
  const cleanup = async (): Promise<void> => {
    await admin.query("DROP SCHEMA IF EXISTS app_publication CASCADE");
    for (const role of ["ai_mls_production_runtime", "ai_mls_production_migration_operator"]) {
      const result = await admin.query<{ exists: boolean }>("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=$1) AS exists", [role]);
      if (result.rows[0]?.exists === true) {
        await admin.query(`DROP OWNED BY ${role}`);
        await admin.query(`DROP ROLE ${role}`);
      }
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
    } finally {
      await migration.end();
    }

    const nativePool = new Pool({ host: "127.0.0.1", port, user: "ai_mls_production_runtime", database: "postgres", max: 2 });
    const pool: PostgreSqlPoolPort = {
      connect: async () => {
        const client = await nativePool.connect();
        return {
          query: async <Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]) =>
            { await Promise.resolve(); return client.query(text, values === undefined ? undefined : [...values]) as unknown as Promise<PostgreSqlQueryResult<Row>>; },
          release: (destroy?: boolean) => client.release(destroy === true),
        };
      },
      close: () => nativePool.end(),
    };
    const snapshot = createPublication({
      identity: { tenantScopeId: "tenant-r3b2", publicationId: "publication-r3b2" },
      binding: { subjectId: "listing-r3b2", subjectRevision: 1, representationId: "representation-r3b2", representationVersion: 1, representationChecksum: "sha256:r3b2", approvalId: "approval-r3b2", approvalVersion: 1, targetId: "target-r3b2", targetVersion: 1, channelId: "channel-r3b2", channelPolicyVersion: "channel-policy-r3b2" },
      prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
      classification: "CONFIDENTIAL_BUSINESS",
      command: { actorId: "actor-r3b2", authorityContext: "PUBLICATION_EXECUTION", reason: "Disposable PostgreSQL verification", correlationId: "correlation-r3b2", occurredAt: "2026-09-30T00:00:00.000Z" },
    }).snapshot;
    const store = new PostgreSqlPublicationUnitOfWork(pool);
    try {
      const transaction = await store.begin(snapshot);
      await transaction.repository.save(snapshot);
      await transaction.audit.append({ id: "audit-r3b2", tenantScopeId: snapshot.tenantScopeId, aggregateId: snapshot.publicationId, command: "CREATE_PUBLICATION", actorId: "actor-r3b2", timestamp: "2026-09-30T00:00:00.000Z", version: 1, result: "COMPLETED" });
      await transaction.commit();
      assert.deepEqual(await store.repository.find(snapshot), snapshot);
      assert.equal((await store.audit.list(snapshot)).length, 1);

      const rollback = await store.begin(snapshot);
      await rollback.idempotency.record({ tenantScopeId: snapshot.tenantScopeId, aggregateId: snapshot.publicationId, commandKey: "rollback-r3b2", fingerprint: "sha256:rollback-r3b2", resultReference: "result-r3b2", recordedAt: "2026-09-30T00:00:01.000Z" });
      await rollback.rollback();
      assert.equal(await store.idempotency.find({ tenantScopeId: snapshot.tenantScopeId, aggregateId: snapshot.publicationId, commandKey: "rollback-r3b2" }), undefined);
    } finally {
      await store.close();
      await pool.close();
    }
  } finally {
    await cleanup();
    await admin.end();
  }
});
