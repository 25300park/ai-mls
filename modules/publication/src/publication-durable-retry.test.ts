import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as publication from "./index.js";
import { createPublication } from "./publication-factory.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import { DurablePublicationUnitOfWork } from "./publication-durable-persistence.js";
import { FixedClock } from "./publication-clock.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationAuthorizationGuard, createTestPublicationSession } from "./publication-authorization-test-support.test.js";
import { PublicationAuthorizationGuard, InMemoryPublicationAuthorizationEvidenceStore } from "./publication-authorization.js";
import type { PublicationInfrastructureConfigurationInput } from "./publication-infrastructure-configuration.js";
import type { PublishPublicationCoordinationRequest } from "./publication-application-contracts.js";
import type { PublicationOperationsRetryDecision } from "./publication-operations-contracts.js";
import { createProductionPublicationInfrastructure } from "./publication-infrastructure.js";

const time = "2026-08-03T12:00:00.000Z";

test("F17-F production operations retry cannot use injected process-local history or caller count", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-production-"));
  const infrastructure = createProductionPublicationInfrastructure({ databasePath: join(directory, "publication.sqlite"), configuration: {
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "HEALTHY", authorityRevalidationRequired: false }) },
    operationsRetryAuthority: { revalidate: () => true },
  } });
  try {
    const result = infrastructure.operationsRetry.decide({ tenantId: "team-a", operationIdentity: "unknown-operation", failureCode: "DEPENDENCY_TIMEOUT", attemptNumber: 1, maximumAttempts: 99, idempotencySafe: true, idempotencyKey: "caller-key", fingerprint: "caller-fingerprint", correlationId: "test-correlation", actorOrServiceReference: "body-actor" });
    assert.equal(result.decision, "NOT_ALLOWED");
    assert.equal(result.retryEligible, false);
  } finally { infrastructure.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});
const identity = { tenantScopeId: "team-a", publicationId: "publication-retry" };
const command = { actorId: "body-not-authoritative", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved retry test", correlationId: "retry-correlation", occurredAt: time };
const binding = { subjectId: "listing-1", subjectRevision: 3, representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2", approvalId: "approval-1", approvalVersion: 4, targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3" };
const policy = Object.freeze({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "test-approved-retry-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT", "PRE_DISPATCH"] });

function seed(uow: DurablePublicationUnitOfWork, outcome: "NO_EFFECT" | "UNKNOWN" | "CONFIRMED" | "STARTED") {
  const ready = createPublication({ identity, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command }).snapshot;
  const pending = PublicationAggregate.rehydrate(ready).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: ready.aggregateVersion, attempt: { id: "prior-attempt", commandId: "prior-command", operation: "INITIAL_PUBLISH", occurredAt: time, evidenceRefs: [] }, command }).snapshot;
  const tx = uow.begin(identity);
  tx.repository.save(pending);
  tx.execution.prepare({ ...identity, commandId: "prior-command", attemptId: "prior-attempt", dispatchFingerprint: "prior-fingerprint", providerIdempotencyKey: "prior-provider-identity", preparedAt: time });
  tx.execution.markDispatchStarted(identity, "prior-command", time);
  if (outcome !== "STARTED") {
    const resolved = PublicationAggregate.rehydrate(pending).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: pending.aggregateVersion, outcome: outcome === "NO_EFFECT" ? "NO_EFFECT_CONFIRMED" : outcome === "CONFIRMED" ? "EFFECT_CONFIRMED" : "UNKNOWN", evidenceRefs: ["provider:safe-evidence"], ...(outcome === "UNKNOWN" ? { reconciliationCaseId: "reconciliation-prior" } : {}), ...(outcome === "CONFIRMED" ? { externalObjectReference: "external-safe" } : {}), command }).snapshot;
    tx.repository.update(pending.aggregateVersion, resolved);
    tx.execution.appendReceipt({ ...identity, receiptId: "prior-receipt", commandId: "prior-command", attemptId: "prior-attempt", outcome, evidenceRefs: ["provider:safe-evidence"], recordedAt: time });
  }
  tx.commit();
}

function request(uow: DurablePublicationUnitOfWork): PublishPublicationCoordinationRequest {
  return { identity, command, context: { actorId: "body-not-authoritative", sessionId: "executor-independent", correlationId: command.correlationId, idempotencyKey: "retry-request", intentFingerprint: "retry-payload" }, attempt: { id: "next-attempt", commandId: "next-command", operation: "INITIAL_PUBLISH", occurredAt: time, evidenceRefs: [] }, expectedAggregateVersion: uow.repository.find(identity)!.aggregateVersion };
}

function gate(uow: DurablePublicationUnitOfWork, approvedPolicy?: Readonly<Omit<typeof policy, "maximumAttempts"> & { maximumAttempts: number }>, configuration?: PublicationInfrastructureConfigurationInput) {
  const Constructor = (publication as unknown as Record<string, unknown>)["PublicationDurableRetryEligibility"];
  assert.equal(typeof Constructor, "function", "F17-F durable retry boundary must exist");
  return new (Constructor as new (input: unknown) => { evaluate(input: PublishPublicationCoordinationRequest): PublicationOperationsRetryDecision })({
    unitOfWork: uow, clock: new FixedClock(time), authorization: configuration === undefined ? createTestPublicationAuthorizationGuard(new FixedClock(time)) : new PublicationAuthorizationGuard({ clock: new FixedClock(time), evidence: new InMemoryPublicationAuthorizationEvidenceStore(), publicationPolicyVersion: "publication-policy-v1", sessionResolver: configuration.sessionResolver!, authorizationEvaluator: configuration.authorizationEvaluator!, liveContextResolver: configuration.liveContextResolver! }),
    effectiveApproval: { check: () => ({ effective: true, decisionReference: "approval-current", approvalId: binding.approvalId, approvalVersion: binding.approvalVersion, checkedAt: time, effectiveScope: { targetId: binding.targetId, channelId: binding.channelId }, reasonCodes: ["APPROVAL_EFFECTIVE"] }) },
    ...(approvedPolicy === undefined ? {} : { policy: { resolve: () => approvedPolicy } }),
  });
}

test("F17-F durable retry defaults denied and caller claims cannot override persisted ambiguity", () => {
  for (const outcome of ["NO_EFFECT", "UNKNOWN", "STARTED"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "f17-f-deny-"));
    const uow = new DurablePublicationUnitOfWork({ databasePath: join(directory, "publication.sqlite") });
    try {
      seed(uow, outcome);
      const original = uow.repository.find(identity);
      const forged = { ...request(uow), retryCount: 0, maximumAttempts: 999, failureCode: "TEMPORARY_FAILURE", externalEffectCompleted: false };
      const decision = gate(uow, outcome === "NO_EFFECT" ? undefined : policy).evaluate(forged);
      assert.equal(decision.decision, "NOT_ALLOWED", outcome);
      assert.equal(decision.retryEligible, false);
      assert.deepEqual(uow.repository.find(identity), original);
    } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F retry revalidates session capability MFA SoD approval target representation scope and policy", () => {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(time));
  const scenarios: readonly (readonly [string, PublicationInfrastructureConfigurationInput])[] = [
    ["missing-session", { ...base, sessionResolver: { resolve: () => undefined } }],
    ["revoked-session", { ...base, sessionResolver: { resolve: id => ({ ...createTestPublicationSession(id, id), state: "REVOKED" }) } }],
    ["expired-session", { ...base, sessionResolver: { resolve: id => ({ ...createTestPublicationSession(id, id), expiresAt: "2020-01-01T00:00:00.000Z" }) } }],
    ["MFA", { ...base, sessionResolver: { resolve: id => ({ ...createTestPublicationSession(id, id), assurance: "SINGLE_FACTOR", isMfaVerified: false }) } }],
    ["capability", { ...base, authorizationEvaluator: { evaluate: () => ({ effect: "DENY", reasonCode: "POLICY_DENIED", policyVersion: "policy", assignmentIds: [], obligations: [] }) } }],
    ["scope", { ...base, sessionResolver: { resolve: id => createTestPublicationSession(id, id, "team-other") } }],
    ...(["SoD", "approval", "target", "representation", "tenant", "policy"] as const).map(kind => [kind, { ...base, liveContextResolver: { resolve: (binding, scope) => {
      const live = base.liveContextResolver!.resolve(binding, scope)!;
      switch (kind) {
        case "SoD": return { ...live, evidenceSubmitterActorIds: ["executor-independent"] };
        case "approval": return { ...live, approval: { ...live.approval, expiresAt: "2020-01-01T00:00:00.000Z" } };
        case "target": return { ...live, target: { ...live.target, status: "INACTIVE" } };
        case "representation": return { ...live, representation: { ...live.representation, checksum: "different-checksum" } };
        case "tenant": return { ...live, tenantId: "other-tenant" };
        case "policy": return { ...live, policyVersion: "policy-changed" };
      }
    } } } satisfies PublicationInfrastructureConfigurationInput] as const),
  ];
  for (const [label, configuration] of scenarios) {
    const directory = mkdtempSync(join(tmpdir(), "f17-f-live-"));
    const databasePath = join(directory, "publication.sqlite");
    let uow = new DurablePublicationUnitOfWork({ databasePath });
    try {
      seed(uow, "NO_EFFECT");
      const before = uow.repository.find(identity);
      const decision = gate(uow, policy, configuration).evaluate(request(uow));
      assert.equal(decision.decision, "STALE_AUTHORITY", label);
      assert.equal(decision.retryEligible, false, label);
      uow.close();
      uow = new DurablePublicationUnitOfWork({ databasePath });
      assert.deepEqual(uow.repository.find(identity), before, label);
      assert.equal(uow.audit.list(identity).length, 1, label);
      assert.equal(uow.audit.list(identity)[0]?.result, "FAILED", label);
      assert.notEqual(uow.audit.list(identity)[0]?.actorId, "body-not-authoritative", label);
      assert.equal(uow.execution.findIntent(identity, "next-command"), undefined, label);
    } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F retry evidence and idempotency roll back atomically on storage failure", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-atomic-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    seed(uow, "NO_EFFECT");
    const input = request(uow);
    const before = uow.repository.find(identity);
    const begin = uow.begin.bind(uow);
    Object.defineProperty(uow, "begin", { value: (...args: Parameters<typeof begin>) => {
      const tx = begin(...args);
      return { ...tx, idempotency: { ...tx.idempotency, find: tx.idempotency.find.bind(tx.idempotency), record: () => { throw new Error("NON_SECRET_STORAGE_FAILURE"); } } };
    } });
    assert.throws(() => gate(uow, policy).evaluate(input), /NON_SECRET_STORAGE_FAILURE/);
    uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(uow.repository.find(identity), before);
    assert.equal(uow.audit.list(identity).length, 0);
    assert.equal(uow.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: `retry-intent:${input.context.idempotencyKey}` }), undefined);
  } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F approved retry derives count from history and preserves decision evidence after reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-reopen-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    seed(uow, "NO_EFFECT");
    const input = request(uow);
    const decision = gate(uow, policy).evaluate(input);
    assert.equal(decision.decision, "ELIGIBLE");
    assert.equal(decision.attemptNumber, 1);
    assert.equal(decision.maximumAttempts, 2);
    const evidence = uow.audit.list(identity);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]?.actorId, "executor-independent");
    assert.equal(evidence[0]?.command, "RETRY_DECISION");
    uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(gate(uow, policy).evaluate(input), decision);
    assert.deepEqual(uow.audit.list(identity), evidence);
    assert.equal(uow.execution.findReceipt(identity, "prior-command")?.outcome, "NO_EFFECT");
    assert.equal(uow.repository.find(identity)?.attempts.length, 1);
    assert.throws(() => gate(uow, policy).evaluate({ ...input, attempt: { ...input.attempt, id: "conflicting-attempt" } }), /[Ii]dempotency|conflict/);
  } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F authoritative completed execution and exhausted policy are not eligible", () => {
  for (const outcome of ["NO_EFFECT", "CONFIRMED"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "f17-f-terminal-"));
    const uow = new DurablePublicationUnitOfWork({ databasePath: join(directory, "publication.sqlite") });
    try {
      seed(uow, outcome);
      const decision = gate(uow, { ...policy, maximumAttempts: 1 }).evaluate(request(uow));
      assert.equal(decision.decision, outcome === "CONFIRMED" ? "ALREADY_COMPLETED" : "EXHAUSTED");
      assert.equal(decision.retryEligible, false);
    } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F last permitted prepared retry resumes after reopen without counting its reservation twice", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-prepared-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    seed(uow, "NO_EFFECT");
    const input = request(uow);
    assert.equal(gate(uow, policy).evaluate(input).decision, "ELIGIBLE");
    const current = uow.repository.find(identity)!;
    const pending = PublicationAggregate.rehydrate(current).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: current.aggregateVersion, attempt: input.attempt, command }).snapshot;
    const tx = uow.begin(identity);
    tx.repository.update(current.aggregateVersion, pending);
    tx.execution.prepare({ ...identity, commandId: input.attempt.commandId, attemptId: input.attempt.id, dispatchFingerprint: "next-fingerprint", providerIdempotencyKey: "next-provider", preparedAt: time });
    tx.commit();
    uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    const decision = gate(uow, policy).evaluate({ ...input, expectedAggregateVersion: pending.aggregateVersion });
    assert.equal(decision.decision, "ELIGIBLE");
    assert.equal(decision.attemptNumber, 1);
    assert.equal(uow.execution.recoveryDisposition(identity, input.attempt.commandId).condition, "PRE_DISPATCH");
    assert.equal(uow.repository.find(identity)?.attempts.length, 2);
    assert.equal(uow.execution.findReceipt(identity, "prior-command")?.outcome, "NO_EFFECT");
  } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F stale authority denial and decision evidence survive reopen without business mutation", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-denial-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    seed(uow, "NO_EFFECT");
    const original = uow.repository.find(identity);
    const input = request(uow);
    const denial = gate(uow, policy).evaluate({ ...input, expectedAggregateVersion: 0 });
    assert.equal(denial.decision, "STALE_AUTHORITY");
    uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(uow.repository.find(identity), original);
    const audit = uow.audit.list(identity);
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.result, "FAILED");
    assert.equal(audit[0]?.failureReason, "PUBLICATION_VERSION_CONFLICT");
    assert.equal(audit[0]?.actorId, "executor-independent");
    assert.equal(uow.execution.findReceipt(identity, input.attempt.commandId), undefined);
  } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F denial audit identities are isolated across aggregates sharing caller keys", () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-denial-identity-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  const scopes = [identity, { ...identity, publicationId: "publication-other" }];
  try {
    const denied = { ...createTestPublicationAuthorizationConfiguration(new FixedClock(time)), sessionResolver: { resolve: () => undefined } };
    for (const scope of scopes) {
      const tx = uow.begin(scope);
      tx.repository.save(createPublication({ identity: scope, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command }).snapshot);
      tx.commit();
      assert.equal(gate(uow, policy, denied).evaluate({ ...request(uow), identity: scope }).decision, "STALE_AUTHORITY");
    }
    uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal(uow.audit.list(scopes[0]!).length, 1);
    assert.equal(uow.audit.list(scopes[1]!).length, 1);
    assert.notEqual(uow.audit.list(scopes[0]!)[0]?.id, uow.audit.list(scopes[1]!)[0]?.id);
  } finally { uow.close(); rmSync(directory, { recursive: true, force: true }); }
});
