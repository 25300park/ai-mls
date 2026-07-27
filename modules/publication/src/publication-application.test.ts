import assert from "node:assert/strict";
import test from "node:test";

import type {
  CreatePublicationApplicationCommand,
  ModifyPublicationApplicationCommand,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import { FixedClock } from "./publication-clock.js";
import { CreatePublicationHandler, ModifyPublicationHandler } from "./publication-command-handlers.js";
import { PublicationApplicationService } from "./publication-application-service.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationRepository } from "./publication-repository.js";
import { InMemoryPublicationUnitOfWork, type PublicationTransaction, type PublicationUnitOfWork } from "./publication-unit-of-work.js";

const applicationTime = "2026-07-27T12:00:00.000Z";
const identity = { publicationId: "publication-application-1", tenantScopeId: "team-a" } as const;
const binding = {
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
} as const;

function context(suffix: string, fingerprint = `sha256:${suffix}`): PublicationExecutionContext {
  return {
    actorId: `actor-${suffix}`,
    correlationId: `correlation-${suffix}`,
    idempotencyKey: `idempotency-${suffix}`,
    intentFingerprint: fingerprint,
  };
}

function domainContext(execution: PublicationExecutionContext, reason = "Approved application command") {
  return {
    actorId: execution.actorId,
    authorityContext: "PUBLICATION_EXECUTION",
    reason,
    correlationId: execution.correlationId,
    occurredAt: "2026-07-27T11:59:00.000Z",
  } as const;
}

function createCommand(execution: PublicationExecutionContext, publicationId = identity.publicationId): CreatePublicationApplicationCommand {
  return {
    kind: "CREATE_PUBLICATION",
    input: {
      identity: { publicationId, tenantScopeId: identity.tenantScopeId },
      binding,
      prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
      classification: "CONFIDENTIAL_BUSINESS",
      command: domainContext(execution),
    },
  };
}

function transitionCommand(execution: PublicationExecutionContext, expectedAggregateVersion = 1): ModifyPublicationApplicationCommand {
  return {
    kind: "MODIFY_PUBLICATION",
    identity,
    input: {
      type: "BEGIN_INITIAL_EXECUTION",
      expectedAggregateVersion,
      attempt: {
        id: `attempt-${execution.idempotencyKey}`,
        commandId: `command-${execution.idempotencyKey}`,
        operation: "INITIAL_PUBLISH",
        occurredAt: "2026-07-27T11:59:00.000Z",
        evidenceRefs: [],
      },
      command: domainContext(execution),
    },
  };
}

type TestUnitOfWork = PublicationUnitOfWork & {
  readonly repository: PublicationRepository;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
};

function application(unitOfWork: TestUnitOfWork = new InMemoryPublicationUnitOfWork()) {
  const dependencies = {
    unitOfWork,
    repository: unitOfWork.repository,
    idempotency: unitOfWork.idempotency,
    audit: unitOfWork.audit,
    clock: new FixedClock(applicationTime),
  };
  const create = new CreatePublicationHandler(dependencies);
  const modify = new ModifyPublicationHandler(dependencies);
  return { unitOfWork, create, modify, service: new PublicationApplicationService(create, modify) };
}

test("F15-TASK-004 create handler commits a new Publication and immutable audit evidence", () => {
  const execution = context("create");
  const { unitOfWork, create } = application();
  const result = create.execute(createCommand(execution), execution);

  assert.deepEqual(result, {
    ok: true,
    publicationId: identity.publicationId,
    aggregateVersion: 1,
    resultReference: '["publication-application-1",1]',
    replayed: false,
  });
  assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "READY");
  assert.deepEqual(unitOfWork.audit.list(identity).map((record) => ({ result: record.result, version: record.version, timestamp: record.timestamp })), [
    { result: "COMPLETED", version: 1, timestamp: applicationTime },
  ]);
  assert.equal(Object.isFrozen(unitOfWork.audit.list(identity)[0]), true);
});

test("F15-TASK-004 modify handler rehydrates the stored snapshot and persists the approved transition", () => {
  const created = context("create-transition");
  const transitioned = context("transition");
  const { unitOfWork, create, modify } = application();
  assert.equal(create.execute(createCommand(created), created).ok, true);

  const result = modify.execute(transitionCommand(transitioned), transitioned);

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.aggregateVersion, 2);
  assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
  assert.deepEqual(unitOfWork.repository.readHistory(identity).map((snapshot) => snapshot.aggregateVersion), [1, 2]);
});

test("F15-TASK-004 missing aggregate returns a deterministic safe error and rolls back", () => {
  const execution = context("not-found");
  const { unitOfWork, modify } = application();
  const result = modify.execute(transitionCommand(execution), execution);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "PUBLICATION_NOT_FOUND", category: "NOT_FOUND", message: "Publication was not found." },
  });
  assert.equal(unitOfWork.repository.find(identity), undefined);
  assert.deepEqual(unitOfWork.audit.list(identity).map((record) => record.failureReason), ["PUBLICATION_NOT_FOUND"]);
});

test("F15-TASK-004 application context mismatch fails before idempotency or transaction state", () => {
  const commandContext = context("context-command");
  const executionContext = { ...commandContext, actorId: "actor-forged" };
  const { unitOfWork, service } = application();

  const result = service.execute(createCommand(commandContext), executionContext);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "APPLICATION_CONTEXT_INVALID", category: "VALIDATION", message: "Application execution context is invalid." },
  });
  assert.equal(unitOfWork.repository.find(identity), undefined);
  assert.equal(unitOfWork.audit.list(identity).length, 0);
  assert.equal(unitOfWork.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: executionContext.idempotencyKey }), undefined);
});

test("F15-TASK-004 domain rejection is mapped without changing persisted state", () => {
  const created = context("create-domain-rejection");
  const rejected = context("domain-rejection");
  const { unitOfWork, service } = application();
  assert.equal(service.execute(createCommand(created), created).ok, true);

  const result = service.execute({
    kind: "MODIFY_PUBLICATION",
    identity,
    input: { type: "TERMINATE", expectedAggregateVersion: 1, command: domainContext(rejected) },
  }, rejected);

  assert.equal(result.ok, true);
  const invalid = context("invalid-transition");
  const invalidResult = service.execute(transitionCommand(invalid, 2), invalid);
  assert.deepEqual(invalidResult, {
    ok: false,
    error: { code: "PUBLICATION_TRANSITION_INVALID", category: "DOMAIN_REJECTION", message: "Publication command was rejected." },
  });
  assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "TERMINATED");
  assert.deepEqual(unitOfWork.repository.readHistory(identity).map((snapshot) => snapshot.aggregateVersion), [1, 2]);
});

test("F15-TASK-004 version conflict is mapped separately and rolls back", () => {
  const created = context("create-version");
  const stale = context("stale-version");
  const { unitOfWork, service } = application();
  assert.equal(service.execute(createCommand(created), created).ok, true);

  const result = service.execute(transitionCommand(stale, 99), stale);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "PUBLICATION_VERSION_CONFLICT", category: "CONFLICT", message: "Publication version conflict." },
  });
  assert.equal(unitOfWork.repository.find(identity)?.aggregateVersion, 1);
});

test("F15-TASK-004 identical idempotency replay returns the original result without another transition or audit", () => {
  const execution = context("replay");
  const { unitOfWork, service } = application();
  const first = service.execute(createCommand(execution), execution);
  const second = service.execute(createCommand(execution), execution);

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ...first, replayed: true });
  assert.equal(unitOfWork.repository.readHistory(identity).length, 1);
  assert.equal(unitOfWork.audit.list(identity).length, 1);
});

test("F15-TASK-004 reused idempotency key with a different fingerprint fails before state change", () => {
  const firstContext = context("conflict", "sha256:first");
  const conflictContext = { ...firstContext, intentFingerprint: "sha256:second", correlationId: "correlation-conflict-second" };
  const { unitOfWork, service } = application();
  assert.equal(service.execute(createCommand(firstContext), firstContext).ok, true);

  const result = service.execute(createCommand(conflictContext), conflictContext);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "IDEMPOTENCY_CONFLICT", category: "CONFLICT", message: "Idempotency key conflicts with an earlier command." },
  });
  assert.equal(unitOfWork.repository.readHistory(identity).length, 1);
  assert.deepEqual(unitOfWork.audit.list(identity).map((record) => ({ result: record.result, failureReason: record.failureReason })), [
    { result: "COMPLETED", failureReason: undefined },
    { result: "FAILED", failureReason: "IDEMPOTENCY_CONFLICT" },
  ]);
});

test("F15-TASK-004 failure-path repository lookup cannot replace the original safe error", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const failingRepository: PublicationRepository = {
    save: backing.repository.save.bind(backing.repository),
    update: backing.repository.update.bind(backing.repository),
    find(): never { throw new Error("simulated diagnostic lookup failure"); },
    exists: backing.repository.exists.bind(backing.repository),
    checkVersion: backing.repository.checkVersion.bind(backing.repository),
    readHistory: backing.repository.readHistory.bind(backing.repository),
  };
  const conflictingIdempotency: PublicationIdempotencyStore = {
    find(): never { throw persistenceError("IDEMPOTENCY_CONFLICT", "simulated idempotency conflict"); },
    record: backing.idempotency.record.bind(backing.idempotency),
  };
  const failingUnitOfWork: TestUnitOfWork = {
    repository: failingRepository,
    idempotency: conflictingIdempotency,
    audit: backing.audit,
    begin(): never { throw new Error("transaction must not begin"); },
  };
  const execution = context("safe-original-error");
  const { service } = application(failingUnitOfWork);

  const result = service.execute(createCommand(execution), execution);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "IDEMPOTENCY_CONFLICT", category: "CONFLICT", message: "Idempotency key conflicts with an earlier command." },
  });
  assert.deepEqual(backing.audit.list(identity).map((record) => record.failureReason), ["IDEMPOTENCY_CONFLICT"]);
});

test("F15-TASK-004 commit failure rolls back state and appends only failure audit evidence", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const failingUnitOfWork: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: backing.idempotency,
    audit: backing.audit,
    begin(target): PublicationTransaction {
      const transaction = backing.begin(target);
      return {
        ...transaction,
        commit(): void { throw new Error("simulated commit failure"); },
      };
    },
  };
  const execution = context("commit-failure");
  const { service } = application(failingUnitOfWork);

  const result = service.execute(createCommand(execution), execution);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "APPLICATION_COMMIT_FAILED", category: "INFRASTRUCTURE", message: "Publication command could not be committed." },
  });
  assert.equal(backing.repository.find(identity), undefined);
  assert.deepEqual(backing.audit.list(identity).map((record) => record.result), ["FAILED"]);
  assert.equal(backing.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: execution.idempotencyKey }), undefined);
});

test("F15-TASK-004 commit-time optimistic conflict remains a deterministic version conflict", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const conflictingUnitOfWork: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: backing.idempotency,
    audit: backing.audit,
    begin(target): PublicationTransaction {
      const transaction = backing.begin(target);
      return {
        ...transaction,
        commit(): void { throw persistenceError("PUBLICATION_VERSION_CONFLICT", "simulated commit conflict"); },
      };
    },
  };
  const execution = context("commit-conflict");
  const { service } = application(conflictingUnitOfWork);

  const result = service.execute(createCommand(execution), execution);

  assert.deepEqual(result, {
    ok: false,
    error: { code: "PUBLICATION_VERSION_CONFLICT", category: "CONFLICT", message: "Publication version conflict." },
  });
  assert.equal(backing.repository.find(identity), undefined);
  assert.deepEqual(backing.audit.list(identity).map((record) => record.failureReason), ["PUBLICATION_VERSION_CONFLICT"]);
});

test("F15-TASK-004 committed audit evidence recovers replay when post-commit idempotency persistence fails", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const unavailableIdempotency: PublicationIdempotencyStore = {
    find: backing.idempotency.find.bind(backing.idempotency),
    record(): never { throw new Error("simulated idempotency persistence failure"); },
  };
  const recoveryUnitOfWork: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: unavailableIdempotency,
    audit: backing.audit,
    begin: backing.begin.bind(backing),
  };
  const execution = context("post-commit-idempotency");
  const { service } = application(recoveryUnitOfWork);

  const first = service.execute(createCommand(execution), execution);
  const replay = service.execute(createCommand(execution), execution);

  assert.equal(first.ok, true);
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(backing.repository.readHistory(identity).length, 1);
  assert.deepEqual(backing.audit.list(identity).map((record) => record.result), ["COMPLETED"]);
});

test("F15-TASK-004 committed audit evidence wins a post-commit idempotency race deterministically", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const racingIdempotency: PublicationIdempotencyStore = {
    find: backing.idempotency.find.bind(backing.idempotency),
    record(input): never {
      backing.idempotency.record({ ...input, fingerprint: "sha256:racing-command" });
      throw persistenceError("IDEMPOTENCY_CONFLICT", "simulated post-commit race");
    },
  };
  const racingUnitOfWork: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: racingIdempotency,
    audit: backing.audit,
    begin: backing.begin.bind(backing),
  };
  const execution = context("post-commit-race", "sha256:committed-command");
  const { service } = application(racingUnitOfWork);

  const first = service.execute(createCommand(execution), execution);
  const replay = service.execute(createCommand(execution), execution);
  const conflicting = service.execute(createCommand({ ...execution, intentFingerprint: "sha256:racing-command" }), { ...execution, intentFingerprint: "sha256:racing-command" });

  assert.equal(first.ok, true);
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(conflicting.ok, false);
  assert.equal(!conflicting.ok && conflicting.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(backing.repository.readHistory(identity).length, 1);
});

test("F15-TASK-004 audit replay rejects an idempotency key reused by a different command", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const unavailableIdempotency: PublicationIdempotencyStore = {
    find: backing.idempotency.find.bind(backing.idempotency),
    record(): never { throw new Error("simulated idempotency persistence failure"); },
  };
  const recoveryUnitOfWork: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: unavailableIdempotency,
    audit: backing.audit,
    begin: backing.begin.bind(backing),
  };
  const execution = context("cross-command-key");
  const { service } = application(recoveryUnitOfWork);
  assert.equal(service.execute(createCommand(execution), execution).ok, true);

  const result = service.execute(transitionCommand(execution), execution);

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(backing.repository.readHistory(identity).length, 1);
});

test("F15-TASK-004 rollback removes staged repository and success audit changes after persistence conflict", () => {
  const backing = new InMemoryPublicationUnitOfWork();
  const created = context("create-rollback");
  const { service } = application(backing);
  assert.equal(service.execute(createCommand(created), created).ok, true);
  const original = backing.repository.find(identity);
  const conflictUow: TestUnitOfWork = {
    repository: backing.repository,
    idempotency: backing.idempotency,
    audit: backing.audit,
    begin(target): PublicationTransaction {
      const transaction = backing.begin(target);
      return {
        ...transaction,
        repository: {
          ...transaction.repository,
          save: transaction.repository.save.bind(transaction.repository),
          find: transaction.repository.find.bind(transaction.repository),
          exists: transaction.repository.exists.bind(transaction.repository),
          checkVersion: transaction.repository.checkVersion.bind(transaction.repository),
          readHistory: transaction.repository.readHistory.bind(transaction.repository),
          update(): void { throw persistenceError("PUBLICATION_VERSION_CONFLICT", "simulated persistence conflict"); },
        },
      };
    },
  };
  const transition = context("rollback-transition");
  const failedApplication = application(conflictUow);

  const result = failedApplication.service.execute(transitionCommand(transition), transition);

  assert.equal(result.ok, false);
  assert.deepEqual(backing.repository.find(identity), original);
  assert.equal(backing.repository.readHistory(identity).length, 1);
  assert.deepEqual(backing.audit.list(identity).map((record) => record.result), ["COMPLETED", "FAILED"]);
});

test("F15-TASK-004 clock controls every application audit timestamp deterministically", () => {
  const created = context("clock-create");
  const transitioned = context("clock-transition");
  const { unitOfWork, service } = application();
  assert.equal(service.execute(createCommand(created), created).ok, true);
  assert.equal(service.execute(transitionCommand(transitioned), transitioned).ok, true);

  assert.deepEqual(unitOfWork.audit.list(identity).map((record) => record.timestamp), [applicationTime, applicationTime]);
});

test("F15-TASK-004 distinct commands sharing a correlation ID retain distinct audit identities", () => {
  const sharedCorrelationId = "correlation-shared-workflow";
  const created = { ...context("shared-create"), correlationId: sharedCorrelationId };
  const transitioned = { ...context("shared-transition"), correlationId: sharedCorrelationId };
  const { unitOfWork, service } = application();

  assert.equal(service.execute(createCommand(created), created).ok, true);
  assert.equal(service.execute(transitionCommand(transitioned), transitioned).ok, true);
  assert.equal(unitOfWork.audit.list(identity).length, 2);
});

test("F15-TASK-004 dispatcher preserves independent create and modify handler boundaries", () => {
  const { unitOfWork, service } = application();
  const createExecution = context("independent-create");
  const modifyExecution = context("independent-modify");

  assert.equal(service.execute(createCommand(createExecution), createExecution).ok, true);
  assert.equal(service.execute(transitionCommand(modifyExecution), modifyExecution).ok, true);

  assert.equal(unitOfWork.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
  assert.deepEqual(unitOfWork.repository.readHistory(identity).map((snapshot) => snapshot.aggregateVersion), [1, 2]);
});
