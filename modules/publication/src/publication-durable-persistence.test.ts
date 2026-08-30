import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationSnapshot } from "./publication-contracts.js";
import { DurablePublicationUnitOfWork } from "./publication-durable-persistence.js";
import { createPublication } from "./publication-factory.js";
import { createProductionPublicationInfrastructure } from "./publication-infrastructure.js";

const occurredAt = "2026-08-30T10:00:00.000Z";
const identity = Object.freeze({ publicationId: "publication-f17-c-1", tenantScopeId: "team-a" });
const command = Object.freeze({
  actorId: "publisher-1",
  authorityContext: "PUBLICATION_EXECUTION",
  reason: "Approved durable execution",
  correlationId: "correlation-f17-c-1",
  occurredAt,
});

function readySnapshot(): PublicationSnapshot {
  return createPublication({
    identity,
    binding: {
      subjectId: "listing-1",
      subjectRevision: 3,
      representationId: "representation-1",
      representationVersion: 2,
      representationChecksum: "sha256:representation-1-v2",
      approvalId: "approval-1",
      approvalVersion: 4,
      targetId: "target-1",
      targetVersion: 5,
      channelId: "channel-1",
      channelPolicyVersion: "channel-policy-v3",
    },
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command,
  }).snapshot;
}

function pendingSnapshot(): PublicationSnapshot {
  const ready = readySnapshot();
  return PublicationAggregate.rehydrate(ready).beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: ready.aggregateVersion,
    attempt: { id: "attempt-1", commandId: "command-1", operation: "INITIAL_PUBLISH", occurredAt, evidenceRefs: ["approval:approval-1@4"] },
    command,
  }).snapshot;
}

test("F17-C durable intent, aggregate, idempotency and audit survive close/reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-durable-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    let unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    const pending = pendingSnapshot();
    transaction.repository.save(pending);
    transaction.execution.prepare({
      ...identity,
      commandId: "command-1",
      attemptId: "attempt-1",
      dispatchFingerprint: "sha256:dispatch-1",
      providerIdempotencyKey: "provider:publication-f17-c-1:command-1:attempt-1",
      preparedAt: occurredAt,
    });
    transaction.idempotency.record({ ...identity, aggregateId: identity.publicationId, commandKey: "test-key", fingerprint: "sha256:intent-1", resultReference: "publication-f17-c-1@2", recordedAt: occurredAt });
    transaction.audit.append({ id: "audit-f17-c-1", ...identity, aggregateId: identity.publicationId, command: "BEGIN_INITIAL_EXECUTION", actorId: "publisher-1", timestamp: occurredAt, version: 2, result: "COMPLETED" });
    transaction.commit();
    unitOfWork.close();

    unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
    assert.equal(unitOfWork.execution.findIntent(identity, "command-1")?.attemptId, "attempt-1");
    assert.equal(unitOfWork.idempotency.find({ ...identity, aggregateId: identity.publicationId, commandKey: "test-key" })?.fingerprint, "sha256:intent-1");
    assert.deepEqual(unitOfWork.audit.list(identity).map((record) => record.id), ["audit-f17-c-1"]);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C production composition selects durable persistence and fails closed without a file database", () => {
  assert.throws(() => createProductionPublicationInfrastructure({ databasePath: "" }), /database configuration is invalid/u);
  assert.throws(() => createProductionPublicationInfrastructure({ databasePath: ":memory:" }), /database configuration is invalid/u);
  const directory = mkdtempSync(join(tmpdir(), "f17-c-production-"));
  try {
    const infrastructure = createProductionPublicationInfrastructure({ databasePath: join(directory, "publication.sqlite") });
    assert.equal(infrastructure.unitOfWork instanceof DurablePublicationUnitOfWork, true);
    infrastructure.unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C restart treats DISPATCH_STARTED without receipt as RECONCILIATION_REQUIRED and never permits blind resend", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-ambiguous-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    let unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    transaction.repository.save(pendingSnapshot());
    transaction.execution.prepare({ ...identity, commandId: "command-1", attemptId: "attempt-1", dispatchFingerprint: "sha256:dispatch-1", providerIdempotencyKey: "provider-key-1", preparedAt: occurredAt });
    assert.equal(transaction.execution.markDispatchStarted(identity, "command-1", "2026-08-30T10:00:01.000Z"), "STARTED");
    transaction.commit();
    unitOfWork.close();

    unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(unitOfWork.execution.recoveryDisposition(identity, "command-1"), {
      condition: "RECONCILIATION_REQUIRED",
      providerInvocationPermitted: false,
      attemptId: "attempt-1",
    });
    assert.equal(unitOfWork.execution.markDispatchStarted(identity, "command-1", "2026-08-30T10:00:02.000Z"), "ALREADY_STARTED");
    assert.equal(unitOfWork.execution.findReceipt(identity, "command-1"), undefined);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C normalized outcome, receipt, resulting state and evidence commit atomically", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-outcome-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    const unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    let transaction = unitOfWork.begin(identity);
    transaction.repository.save(pendingSnapshot());
    transaction.execution.prepare({ ...identity, commandId: "command-1", attemptId: "attempt-1", dispatchFingerprint: "sha256:dispatch-1", providerIdempotencyKey: "provider-key-1", preparedAt: occurredAt });
    transaction.execution.markDispatchStarted(identity, "command-1", "2026-08-30T10:00:01.000Z");
    transaction.commit();

    transaction = unitOfWork.begin(identity);
    const pending = transaction.repository.find(identity)!;
    const reconciled = PublicationAggregate.rehydrate(pending).resolveExecution({
      type: "RESOLVE_EXECUTION",
      expectedAggregateVersion: pending.aggregateVersion,
      outcome: "UNKNOWN",
      evidenceRefs: ["provider-observation:timeout"],
      reconciliationCaseId: "case-1",
      command: { ...command, occurredAt: "2026-08-30T10:00:02.000Z" },
    }).snapshot;
    transaction.repository.update(pending.aggregateVersion, reconciled);
    transaction.execution.appendReceipt({ ...identity, receiptId: "receipt-1", commandId: "command-1", attemptId: "attempt-1", outcome: "UNKNOWN", evidenceRefs: ["provider-observation:timeout"], recordedAt: "2026-08-30T10:00:02.000Z" });
    transaction.audit.append({ id: "audit-outcome-1", ...identity, aggregateId: identity.publicationId, command: "RESOLVE_EXECUTION", actorId: "publisher-1", timestamp: "2026-08-30T10:00:02.000Z", version: reconciled.aggregateVersion, result: "COMPLETED" });
    transaction.commit();

    assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal(unitOfWork.execution.findReceipt(identity, "command-1")?.outcome, "UNKNOWN");
    assert.equal(unitOfWork.execution.recoveryDisposition(identity, "command-1").providerInvocationPermitted, false);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C rollback leaves aggregate, intent, idempotency and audit absent", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-rollback-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    let unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    transaction.repository.save(pendingSnapshot());
    transaction.execution.prepare({ ...identity, commandId: "command-1", attemptId: "attempt-1", dispatchFingerprint: "sha256:dispatch-1", providerIdempotencyKey: "provider-key-1", preparedAt: occurredAt });
    transaction.idempotency.record({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "rollback", fingerprint: "sha256:rollback", resultReference: "result-rollback", recordedAt: occurredAt });
    transaction.audit.append({ id: "audit-rollback-f17-c", tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, command: "BEGIN_INITIAL_EXECUTION", actorId: "publisher-1", timestamp: occurredAt, version: 2, result: "COMPLETED" });
    transaction.rollback();
    unitOfWork.close();

    unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal(unitOfWork.repository.find(identity), undefined);
    assert.equal(unitOfWork.execution.findIntent(identity, "command-1"), undefined);
    assert.equal(unitOfWork.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "rollback" }), undefined);
    assert.deepEqual(unitOfWork.audit.list(identity), []);
    unitOfWork.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C database revision rejects stale concurrent commit atomically", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-concurrency-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    const first = new DurablePublicationUnitOfWork({ databasePath });
    const second = new DurablePublicationUnitOfWork({ databasePath });
    const left = first.begin(identity);
    const right = second.begin(identity);
    left.repository.save(readySnapshot());
    right.repository.save(readySnapshot());
    left.commit();
    assert.throws(() => right.commit(), (error: unknown) => error instanceof Error && "code" in error && error.code === "PUBLICATION_VERSION_CONFLICT");
    first.close();
    second.close();
    const reopened = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal(reopened.repository.find(identity)?.aggregateVersion, 1);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C idempotency replays after restart, rejects conflicting payload and evidence tables are append-only", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-append-only-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    let unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    let transaction = unitOfWork.begin(identity);
    transaction.repository.save(pendingSnapshot());
    transaction.execution.prepare({ ...identity, commandId: "command-1", attemptId: "attempt-1", dispatchFingerprint: "sha256:dispatch-1", providerIdempotencyKey: "provider-key-1", preparedAt: occurredAt });
    transaction.execution.markDispatchStarted(identity, "command-1", occurredAt);
    assert.throws(() => transaction.execution.appendReceipt({ ...identity, receiptId: "unsafe-receipt", commandId: "command-1", attemptId: "attempt-1", outcome: "UNKNOWN", evidenceRefs: ["evidence:unknown"], recordedAt: occurredAt, rawProviderResponse: "secret-token" } as unknown as Parameters<typeof transaction.execution.appendReceipt>[0]), (error: unknown) => error instanceof Error && "code" in error && error.code === "EXECUTION_EVIDENCE_INVALID");
    transaction.execution.appendReceipt({ ...identity, receiptId: "receipt-append-only", commandId: "command-1", attemptId: "attempt-1", outcome: "UNKNOWN", evidenceRefs: ["evidence:unknown"], recordedAt: occurredAt });
    transaction.idempotency.record({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "idem-restart", fingerprint: "sha256:same", resultReference: "result-1", recordedAt: occurredAt });
    transaction.commit();
    unitOfWork.close();

    unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    transaction = unitOfWork.begin(identity);
    assert.equal(transaction.idempotency.record({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "idem-restart", fingerprint: "sha256:same", resultReference: "result-1", recordedAt: occurredAt }).status, "REPLAYED");
    assert.throws(() => transaction.idempotency.record({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "idem-restart", fingerprint: "sha256:other", resultReference: "result-2", recordedAt: occurredAt }), (error: unknown) => error instanceof Error && "code" in error && error.code === "IDEMPOTENCY_CONFLICT");
    transaction.rollback();
    unitOfWork.close();

    const database = new DatabaseSync(databasePath);
    assert.throws(() => database.prepare("UPDATE publication_execution_receipts SET payload_json = '{}' WHERE receipt_id = ?").run("receipt-append-only"), /append-only/u);
    assert.throws(() => database.prepare("DELETE FROM publication_execution_intents WHERE command_id = ?").run("command-1"), /append-only/u);
    database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F17-C reopen fails closed for structurally corrupted canonical aggregate payload", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-c-corrupt-"));
  const databasePath = join(directory, "publication.sqlite");
  try {
    const unitOfWork = new DurablePublicationUnitOfWork({ databasePath });
    const transaction = unitOfWork.begin(identity);
    transaction.repository.save(readySnapshot());
    transaction.commit();
    unitOfWork.close();
    const database = new DatabaseSync(databasePath);
    database.prepare("UPDATE publication_scopes SET record_json = '{}' WHERE tenant_scope_id = ? AND publication_id = ?").run(identity.tenantScopeId, identity.publicationId);
    database.close();
    assert.throws(() => new DurablePublicationUnitOfWork({ databasePath }), (error: unknown) => error instanceof Error && "code" in error && error.code === "PERSISTENCE_WRITE_FAILED");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
