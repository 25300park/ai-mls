import assert from "node:assert/strict";
import test from "node:test";

import { createPublication } from "./publication-factory.js";
import type { PublicationSnapshot } from "./publication-contracts.js";
import { InMemoryPublicationAuditStore } from "./publication-audit-store.js";
import { InMemoryIdempotencyStore } from "./publication-idempotency-store.js";
import { InMemoryPublicationRepository } from "./in-memory-publication-repository.js";
import { PublicationPersistenceError } from "./publication-persistence-error.js";
import { mapPersistenceToPublication, mapPublicationToPersistence } from "./publication-persistence-mapper.js";
import type { PublicationRepository } from "./publication-repository.js";
import { InMemoryPublicationUnitOfWork } from "./publication-unit-of-work.js";

const occurredAt = "2026-07-27T10:00:00.000Z";
const identity = { publicationId: "publication-persistence-1", tenantScopeId: "team-a" } as const;

function readySnapshot(id: string = identity.publicationId, tenantScopeId: string = identity.tenantScopeId): PublicationSnapshot {
  return createPublication({
    identity: { publicationId: id, tenantScopeId },
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
    prerequisites: {
      immutableSnapshot: true,
      effectiveApproval: true,
      exactTargetChannel: true,
      provenancePresent: true,
    },
    classification: "CONFIDENTIAL_BUSINESS",
    command: {
      actorId: "actor-create",
      authorityContext: "PUBLICATION_EXECUTION",
      reason: "Approved publication creation",
      correlationId: `correlation-${id}`,
      occurredAt,
    },
  }).snapshot;
}

function suspendedSnapshot(current: PublicationSnapshot): PublicationSnapshot {
  return createPublication({
    identity: { publicationId: current.publicationId, tenantScopeId: current.tenantScopeId },
    binding: current.binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: current.classification,
    command: { actorId: "actor-create", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved publication creation", correlationId: `correlation-${current.publicationId}`, occurredAt },
  }).setSuspension({
    type: "SET_SUSPENSION",
    expectedAggregateVersion: current.aggregateVersion,
    suspensionStatus: "SUSPENDED_OPERATIONAL",
    command: { actorId: "actor-suspend", authorityContext: "PUBLICATION_EXECUTION", reason: "Operational hold", correlationId: "correlation-suspend", occurredAt: "2026-07-27T10:01:00.000Z" },
  }).snapshot;
}

function assertPersistenceError(code: string): (error: unknown) => boolean {
  return (error: unknown) => error instanceof PublicationPersistenceError && error.code === code;
}

function exerciseRepositoryContract(repository: PublicationRepository): void {
  const initial = readySnapshot();
  repository.save(initial);
  assert.equal(repository.exists(identity), true);
  assert.equal(repository.checkVersion(identity, 1), true);
  assert.deepEqual(repository.find(identity), initial);
  assert.equal(repository.find({ ...identity, tenantScopeId: "team-b" }), undefined);

  const updated = suspendedSnapshot(initial);
  repository.update(initial.aggregateVersion, updated);
  assert.equal(repository.checkVersion(identity, 2), true);
  assert.deepEqual(repository.readHistory(identity).map((entry) => entry.aggregateVersion), [1, 2]);
}

test("F15-TASK-003 mapper preserves logical equality and deterministic persistence output", () => {
  const domain = suspendedSnapshot(readySnapshot());
  const first = mapPublicationToPersistence(domain);
  const second = mapPublicationToPersistence(domain);

  assert.notEqual(first, domain);
  assert.deepEqual(first, second);
  assert.equal(first.identity.publicationId, domain.publicationId);
  assert.deepEqual(mapPersistenceToPublication(first), domain);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(mapPersistenceToPublication(first)), true);
});

test("F15-TASK-003 in-memory adapter satisfies the tenant-scoped repository contract", () => {
  exerciseRepositoryContract(new InMemoryPublicationRepository());
});

test("F15-TASK-003 repository fails closed for duplicate create and optimistic version conflicts", () => {
  const repository = new InMemoryPublicationRepository();
  const initial = readySnapshot();
  repository.save(initial);
  assert.throws(() => repository.save(initial), assertPersistenceError("PUBLICATION_ALREADY_EXISTS"));

  const updated = suspendedSnapshot(initial);
  assert.throws(() => repository.update(99, updated), assertPersistenceError("PUBLICATION_VERSION_CONFLICT"));
  assert.throws(
    () => repository.update(initial.aggregateVersion, { ...updated, aggregateVersion: 3 }),
    assertPersistenceError("PUBLICATION_REVISION_INVALID"),
  );
  assert.deepEqual(repository.find(identity), initial);
  assert.deepEqual(repository.readHistory(identity).map((entry) => entry.aggregateVersion), [1]);
});

test("F15-TASK-003 repository snapshots and append-only history reject external mutation", () => {
  const repository = new InMemoryPublicationRepository();
  repository.save(readySnapshot());
  const found = repository.find(identity);
  const history = repository.readHistory(identity);

  assert.notEqual(found, undefined);
  assert.equal(Object.isFrozen(found), true);
  assert.equal(Object.isFrozen(history), true);
  assert.throws(() => { (found as { aggregateVersion: number }).aggregateVersion = 99; }, TypeError);
  assert.throws(() => { (history as PublicationSnapshot[]).push(readySnapshot("other")); }, TypeError);
});

test("F15-TASK-003 composite keys cannot alias across tenant or aggregate identity boundaries", () => {
  const repository = new InMemoryPublicationRepository();
  const victim = readySnapshot("tail", "tenant-a\u0000publication-x");
  repository.save(victim);
  const alias = { tenantScopeId: "tenant-a", publicationId: "publication-x\u0000tail" } as const;

  assert.equal(repository.find(alias), undefined);

  const idempotency = new InMemoryIdempotencyStore();
  idempotency.record({ tenantScopeId: victim.tenantScopeId, aggregateId: victim.publicationId, commandKey: "command", fingerprint: "sha256:victim", resultReference: "victim", recordedAt: occurredAt });
  assert.equal(idempotency.find({ tenantScopeId: alias.tenantScopeId, aggregateId: alias.publicationId, commandKey: "command" }), undefined);
});

test("F15-TASK-003 idempotency store replays identical intent and rejects conflicting intent", () => {
  const store = new InMemoryIdempotencyStore();
  const input = { tenantScopeId: "team-a", aggregateId: "publication-persistence-1", commandKey: "command-1", fingerprint: "sha256:intent-1", resultReference: "result-1", recordedAt: occurredAt } as const;
  const stored = store.record(input);
  const replayed = store.record({ ...input });

  assert.equal(stored.status, "STORED");
  assert.equal(replayed.status, "REPLAYED");
  assert.deepEqual(replayed.record, stored.record);
  assert.throws(() => store.record({ ...input, fingerprint: "sha256:different" }), assertPersistenceError("IDEMPOTENCY_CONFLICT"));
  assert.equal(Object.isFrozen(store.find({ tenantScopeId: input.tenantScopeId, aggregateId: input.aggregateId, commandKey: input.commandKey })), true);
});

test("F15-TASK-003 audit store appends immutable success and failure evidence", () => {
  const store = new InMemoryPublicationAuditStore();
  const completed = store.append({ id: "audit-1", tenantScopeId: "team-a", aggregateId: "publication-persistence-1", command: "CREATE", actorId: "actor-1", timestamp: occurredAt, version: 1, result: "COMPLETED" });
  const failed = store.append({ id: "audit-2", tenantScopeId: "team-a", aggregateId: "publication-persistence-1", command: "UPDATE", actorId: "actor-2", timestamp: "2026-07-27T10:02:00.000Z", version: 1, result: "FAILED", failureReason: "PUBLICATION_VERSION_CONFLICT" });

  assert.equal(Object.isFrozen(completed), true);
  assert.equal(failed.failureReason, "PUBLICATION_VERSION_CONFLICT");
  assert.deepEqual(store.list(identity).map((entry) => entry.id), ["audit-1", "audit-2"]);
  assert.throws(() => store.append({ ...completed }), assertPersistenceError("AUDIT_RECORD_DUPLICATE"));
  assert.throws(
    () => store.append({ ...completed, id: "audit-invalid", result: "FAILED" }),
    assertPersistenceError("AUDIT_RECORD_INVALID"),
  );
  assert.throws(() => { (store.list(identity) as unknown[]).pop(); }, TypeError);
});

test("F15-TASK-003 logical unit of work atomically commits repository, idempotency and audit", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  const snapshot = readySnapshot();
  transaction.repository.save(snapshot);
  transaction.idempotency.record({ tenantScopeId: "team-a", aggregateId: identity.publicationId, commandKey: "command-uow-1", fingerprint: "sha256:uow-1", resultReference: "result-uow-1", recordedAt: occurredAt });
  transaction.audit.append({ id: "audit-uow-1", tenantScopeId: "team-a", aggregateId: identity.publicationId, command: "CREATE", actorId: "actor-uow", timestamp: occurredAt, version: 1, result: "COMPLETED" });
  assert.throws(
    () => transaction.repository.save(readySnapshot("publication-outside-transaction")),
    assertPersistenceError("PERSISTENCE_SCOPE_VIOLATION"),
  );

  assert.equal(unitOfWork.repository.find(identity), undefined);
  transaction.commit();
  assert.deepEqual(unitOfWork.repository.find(identity), snapshot);
  assert.notEqual(unitOfWork.idempotency.find({ tenantScopeId: "team-a", aggregateId: identity.publicationId, commandKey: "command-uow-1" }), undefined);
  assert.deepEqual(unitOfWork.audit.list(identity).map((entry) => entry.id), ["audit-uow-1"]);
});

test("F15-TASK-003 logical unit of work rollback discards every staged persistence component", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  transaction.repository.save(readySnapshot());
  transaction.idempotency.record({ tenantScopeId: "team-a", aggregateId: identity.publicationId, commandKey: "command-rollback", fingerprint: "sha256:rollback", resultReference: "result-rollback", recordedAt: occurredAt });
  transaction.audit.append({ id: "audit-rollback", tenantScopeId: "team-a", aggregateId: identity.publicationId, command: "CREATE", actorId: "actor-uow", timestamp: occurredAt, version: 1, result: "COMPLETED" });
  transaction.rollback();

  assert.equal(unitOfWork.repository.find(identity), undefined);
  assert.equal(unitOfWork.idempotency.find({ tenantScopeId: "team-a", aggregateId: identity.publicationId, commandKey: "command-rollback" }), undefined);
  assert.deepEqual(unitOfWork.audit.list(identity), []);
});

test("F15-TASK-003 logical unit of work commit preserves state outside its aggregate scope", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  transaction.repository.save(readySnapshot());
  const otherIdentity = { publicationId: "publication-other", tenantScopeId: "team-b" } as const;
  unitOfWork.audit.append({ id: "audit-other", tenantScopeId: otherIdentity.tenantScopeId, aggregateId: otherIdentity.publicationId, command: "CREATE", actorId: "actor-other", timestamp: occurredAt, version: 1, result: "COMPLETED" });

  transaction.commit();

  assert.deepEqual(unitOfWork.audit.list(otherIdentity).map((entry) => entry.id), ["audit-other"]);
  assert.notEqual(unitOfWork.repository.find(identity), undefined);
});

test("F15-TASK-003 logical unit of work rejects a concurrent change to its aggregate scope", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  transaction.repository.save(readySnapshot());
  unitOfWork.audit.append({ id: "audit-concurrent", tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, command: "CREATE", actorId: "actor-concurrent", timestamp: occurredAt, version: 1, result: "COMPLETED" });

  assert.throws(() => transaction.commit(), assertPersistenceError("PUBLICATION_VERSION_CONFLICT"));
  assert.deepEqual(unitOfWork.audit.list(identity).map((entry) => entry.id), ["audit-concurrent"]);
  assert.equal(unitOfWork.repository.find(identity), undefined);
});

test("F15-TASK-003 logical unit of work never overwrites another aggregate audit identity", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  const sharedAuditId = "audit-shared-identity";
  transaction.audit.append({ id: sharedAuditId, tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, command: "CREATE", actorId: "actor-transaction", timestamp: occurredAt, version: 1, result: "COMPLETED" });
  const otherIdentity = { publicationId: "publication-other", tenantScopeId: "team-b" } as const;
  unitOfWork.audit.append({ id: sharedAuditId, tenantScopeId: otherIdentity.tenantScopeId, aggregateId: otherIdentity.publicationId, command: "CREATE", actorId: "actor-other", timestamp: occurredAt, version: 1, result: "COMPLETED" });

  assert.throws(() => transaction.commit(), assertPersistenceError("AUDIT_RECORD_DUPLICATE"));
  assert.deepEqual(unitOfWork.audit.list(otherIdentity).map((entry) => entry.id), [sharedAuditId]);
  assert.deepEqual(unitOfWork.audit.list(identity), []);
});

test("F15-TASK-003 logical unit of work rejects overlapping and repeated transaction completion", () => {
  const unitOfWork = new InMemoryPublicationUnitOfWork();
  const transaction = unitOfWork.begin(identity);
  assert.throws(() => unitOfWork.begin(identity), assertPersistenceError("TRANSACTION_ALREADY_ACTIVE"));
  transaction.rollback();
  assert.throws(() => transaction.commit(), assertPersistenceError("TRANSACTION_ALREADY_COMPLETED"));
  assert.throws(() => transaction.repository.find(identity), assertPersistenceError("TRANSACTION_ALREADY_COMPLETED"));
  assert.throws(() => transaction.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: "after-rollback" }), assertPersistenceError("TRANSACTION_ALREADY_COMPLETED"));
  assert.throws(() => transaction.audit.list(identity), assertPersistenceError("TRANSACTION_ALREADY_COMPLETED"));
});
