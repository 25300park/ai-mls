import assert from "node:assert/strict";
import test from "node:test";

import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/index.js";
import { createPublication } from "./publication-factory.js";
import { PublicationPersistenceError } from "./publication-persistence-error.js";
import { createPostgreSqlProductionPublicationInfrastructure } from "./publication-infrastructure.js";
import { PostgreSqlPublicationUnitOfWork } from "./publication-postgresql-persistence.js";

const identity = Object.freeze({ tenantScopeId: "tenant-1", publicationId: "publication-1" });

function snapshot() {
  return createPublication({
    identity,
    binding: {
      subjectId: "listing-1", subjectRevision: 1, representationId: "representation-1", representationVersion: 1,
      representationChecksum: "sha256:representation-1", approvalId: "approval-1", approvalVersion: 1,
      targetId: "target-1", targetVersion: 1, channelId: "channel-1", channelPolicyVersion: "channel-policy-v1",
    },
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: { actorId: "actor-1", authorityContext: "PUBLICATION_EXECUTION", reason: "R3-B2 test", correlationId: "correlation-1", occurredAt: "2026-09-30T00:00:00.000Z" },
  }).snapshot;
}

test("PostgreSQL Publication UoW uses one checked-out client and an atomic transaction", async () => {
  const queries: string[] = [];
  let released = 0;
  const client: PostgreSqlClientPort = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      await Promise.resolve();
      queries.push(text.replace(/\s+/gu, " ").trim());
      return { rows: [], rowCount: 0 };
    },
    release(): void { released += 1; },
  };
  const pool: PostgreSqlPoolPort = { connect: async () => { await Promise.resolve(); return client; }, close: async () => { await Promise.resolve(); return undefined; } };
  const unitOfWork = new PostgreSqlPublicationUnitOfWork(pool);

  const transaction = await unitOfWork.begin(identity);
  assert.equal(await transaction.repository.find(identity), undefined);
  await transaction.repository.save(snapshot());
  await transaction.commit();

  assert.equal(queries[0], "BEGIN");
  assert.equal(queries.at(-1), "COMMIT");
  assert.equal(queries.filter((query) => query === "BEGIN").length, 1);
  assert.equal(queries.filter((query) => query === "COMMIT").length, 1);
  assert.equal(queries.some((query) => query.startsWith("INSERT INTO app_publication.publication_scopes")), true);
  assert.equal(released, 1);
});

test("PostgreSQL Publication UoW rolls back and releases the same client", async () => {
  const queries: string[] = [];
  let released = 0;
  const client: PostgreSqlClientPort = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      await Promise.resolve();
      queries.push(text.replace(/\s+/gu, " ").trim());
      return { rows: [], rowCount: 0 };
    },
    release(): void { released += 1; },
  };
  const pool: PostgreSqlPoolPort = { connect: async () => { await Promise.resolve(); return client; }, close: async () => { await Promise.resolve(); return undefined; } };
  const transaction = await new PostgreSqlPublicationUnitOfWork(pool).begin({ tenantScopeId: "tenant-1", publicationId: "publication-1" });

  await transaction.rollback();

  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(released, 1);
});

test("PostgreSQL Publication UoW rolls back, destroys an uncertain client, and maps a create race deterministically", async () => {
  const queries: string[] = [];
  const releases: boolean[] = [];
  const client: PostgreSqlClientPort = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      await Promise.resolve();
      const normalized = text.replace(/\s+/gu, " ").trim();
      queries.push(normalized);
      if (normalized.startsWith("INSERT INTO app_publication.publication_scopes")) {
        throw Object.assign(new Error("unsafe database detail"), { code: "23505" });
      }
      return { rows: [], rowCount: 0 };
    },
    release(destroy?: boolean): void { releases.push(destroy === true); },
  };
  const pool: PostgreSqlPoolPort = { connect: async () => { await Promise.resolve(); return client; }, close: async () => { await Promise.resolve(); return undefined; } };
  const transaction = await new PostgreSqlPublicationUnitOfWork(pool).begin(identity);
  await transaction.repository.save(snapshot());

  await assert.rejects(transaction.commit(), (error: unknown) => error instanceof PublicationPersistenceError
    && error.code === "PUBLICATION_ALREADY_EXISTS" && !error.message.includes("unsafe"));

  assert.equal(queries.includes("ROLLBACK"), true);
  assert.deepEqual(releases, [true]);
});

test("PostgreSQL Publication UoW quarantines an ambiguous COMMIT outcome without appending contradictory evidence", async () => {
  const queries: string[] = [];
  const releases: boolean[] = [];
  const client: PostgreSqlClientPort = {
    async query<Row extends Record<string, unknown>>(text: string): Promise<PostgreSqlQueryResult<Row>> {
      await Promise.resolve();
      const normalized = text.replace(/\s+/gu, " ").trim();
      queries.push(normalized);
      if (normalized === "COMMIT") throw new Error("commit response lost");
      return { rows: [], rowCount: 0 };
    },
    release(destroy?: boolean): void { releases.push(destroy === true); },
  };
  let connections = 0;
  const pool: PostgreSqlPoolPort = { connect: async () => { await Promise.resolve(); connections += 1; return client; }, close: async () => { await Promise.resolve(); } };
  const unitOfWork = new PostgreSqlPublicationUnitOfWork(pool);
  const transaction = await unitOfWork.begin(identity);
  await transaction.repository.save(snapshot());

  await assert.rejects(transaction.commit(), (error: unknown) => error instanceof PublicationPersistenceError && error.code === "PERSISTENCE_WRITE_FAILED");
  await assert.rejects(unitOfWork.audit.append({ id: "failed-audit", tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, command: "CREATE_PUBLICATION", actorId: "actor-1", timestamp: "2026-09-30T00:00:00.000Z", version: 1, result: "FAILED" }), (error: unknown) => error instanceof PublicationPersistenceError && error.code === "PERSISTENCE_WRITE_FAILED");

  assert.equal(queries.includes("ROLLBACK"), false);
  assert.equal(connections, 1);
  assert.deepEqual(releases, [true]);
});

test("PostgreSQL Production Publication routes operations retry through the durable gate", async () => {
  let connections = 0;
  const pool: PostgreSqlPoolPort = {
    connect: async () => { await Promise.resolve(); connections += 1; throw new Error("durable gate must reject the mismatched identity before DB access"); },
    close: async () => { await Promise.resolve(); },
  };
  const infrastructure = createPostgreSqlProductionPublicationInfrastructure({ pool, configuration: {
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "HEALTHY", authorityRevalidationRequired: false }) },
    operationsRetryAuthority: { revalidate: () => true },
  } });

  const result = await infrastructure.operationsRetry.decide({ tenantId: "tenant-1", operationIdentity: "publication-other", failureCode: "DEPENDENCY_TIMEOUT", attemptNumber: 1, maximumAttempts: 99, idempotencySafe: true, idempotencyKey: "caller-key", fingerprint: "caller-fingerprint", correlationId: "correlation-1", actorOrServiceReference: "caller" });

  assert.equal(result.decision, "NOT_ALLOWED");
  assert.equal(connections, 0);
});
