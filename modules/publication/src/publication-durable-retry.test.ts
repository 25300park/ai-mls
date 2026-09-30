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

test("F17-F production operations retry cannot use injected process-local history or caller count", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-production-"));
  const infrastructure = createProductionPublicationInfrastructure({ databasePath: join(directory, "publication.sqlite"), configuration: {
    operationsRetryStateResolver: { resolve: () => ({ externalEffectCompleted: false, subsystemStatus: "HEALTHY", authorityRevalidationRequired: false }) },
    operationsRetryAuthority: { revalidate: () => true },
  } });
  try {
    const result = await infrastructure.operationsRetry.decide({ tenantId: "team-a", operationIdentity: "unknown-operation", failureCode: "DEPENDENCY_TIMEOUT", attemptNumber: 1, maximumAttempts: 99, idempotencySafe: true, idempotencyKey: "caller-key", fingerprint: "caller-fingerprint", correlationId: "test-correlation", actorOrServiceReference: "body-actor" });
    assert.equal(result.decision, "NOT_ALLOWED");
    assert.equal(result.retryEligible, false);
  } finally { await infrastructure.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});
const identity = { tenantScopeId: "team-a", publicationId: "publication-retry" };
const command = { actorId: "body-not-authoritative", authorityContext: "PUBLICATION_EXECUTION", reason: "Approved retry test", correlationId: "retry-correlation", occurredAt: time };
const binding = { subjectId: "listing-1", subjectRevision: 3, representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2", approvalId: "approval-1", approvalVersion: 4, targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3" };
const policy = Object.freeze({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "test-approved-retry-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT", "PRE_DISPATCH"] });

async function seed(uow: DurablePublicationUnitOfWork, outcome: "NO_EFFECT" | "UNKNOWN" | "CONFIRMED" | "STARTED") {
  const ready = createPublication({ identity, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command }).snapshot;
  const pending = PublicationAggregate.rehydrate(ready).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: ready.aggregateVersion, attempt: { id: "prior-attempt", commandId: "prior-command", operation: "INITIAL_PUBLISH", occurredAt: time, evidenceRefs: [] }, command }).snapshot;
  const tx = await uow.begin(identity);
  await tx.repository.save(pending);
  await tx.execution.prepare({ ...identity, commandId: "prior-command", attemptId: "prior-attempt", dispatchFingerprint: "prior-fingerprint", providerIdempotencyKey: "prior-provider-identity", preparedAt: time });
  await tx.execution.markDispatchStarted(identity, "prior-command", time);
  if (outcome !== "STARTED") {
    const resolved = PublicationAggregate.rehydrate(pending).resolveExecution({ type: "RESOLVE_EXECUTION", expectedAggregateVersion: pending.aggregateVersion, outcome: outcome === "NO_EFFECT" ? "NO_EFFECT_CONFIRMED" : outcome === "CONFIRMED" ? "EFFECT_CONFIRMED" : "UNKNOWN", evidenceRefs: ["provider:safe-evidence"], ...(outcome === "UNKNOWN" ? { reconciliationCaseId: "reconciliation-prior" } : {}), ...(outcome === "CONFIRMED" ? { externalObjectReference: "external-safe" } : {}), command }).snapshot;
    await tx.repository.update(pending.aggregateVersion, resolved);
    await tx.execution.appendReceipt({ ...identity, receiptId: "prior-receipt", commandId: "prior-command", attemptId: "prior-attempt", outcome, evidenceRefs: ["provider:safe-evidence"], recordedAt: time });
  }
  await tx.commit();
}

async function request(uow: DurablePublicationUnitOfWork): Promise<PublishPublicationCoordinationRequest> {
  return { identity, command, context: { actorId: "body-not-authoritative", sessionId: "executor-independent", correlationId: command.correlationId, idempotencyKey: "retry-request", intentFingerprint: "retry-payload" }, attempt: { id: "next-attempt", commandId: "next-command", operation: "INITIAL_PUBLISH", occurredAt: time, evidenceRefs: [] }, expectedAggregateVersion: (await uow.repository.find(identity))!.aggregateVersion };
}

function gate(uow: DurablePublicationUnitOfWork, approvedPolicy?: Readonly<Omit<typeof policy, "maximumAttempts"> & { maximumAttempts: number }>, configuration?: PublicationInfrastructureConfigurationInput) {
  const Constructor = (publication as unknown as Record<string, unknown>)["PublicationDurableRetryEligibility"];
  assert.equal(typeof Constructor, "function", "F17-F durable retry boundary must exist");
  return new (Constructor as new (input: unknown) => { evaluate(input: PublishPublicationCoordinationRequest): Promise<PublicationOperationsRetryDecision> })({
    unitOfWork: uow, clock: new FixedClock(time), authorization: configuration === undefined ? createTestPublicationAuthorizationGuard(new FixedClock(time)) : new PublicationAuthorizationGuard({ clock: new FixedClock(time), evidence: new InMemoryPublicationAuthorizationEvidenceStore(), publicationPolicyVersion: "publication-policy-v1", sessionResolver: configuration.sessionResolver!, authorizationEvaluator: configuration.authorizationEvaluator!, liveContextResolver: configuration.liveContextResolver! }),
    effectiveApproval: { check: () => ({ effective: true, decisionReference: "approval-current", approvalId: binding.approvalId, approvalVersion: binding.approvalVersion, checkedAt: time, effectiveScope: { targetId: binding.targetId, channelId: binding.channelId }, reasonCodes: ["APPROVAL_EFFECTIVE"] }) },
    ...(approvedPolicy === undefined ? {} : { policy: { resolve: () => approvedPolicy } }),
  });
}

test("F17-F durable retry defaults denied and caller claims cannot override persisted ambiguity", async () => {
  for (const outcome of ["NO_EFFECT", "UNKNOWN", "STARTED"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "f17-f-deny-"));
    const uow = new DurablePublicationUnitOfWork({ databasePath: join(directory, "publication.sqlite") });
    try {
      await seed(uow, outcome);
      const original = await uow.repository.find(identity);
      const forged = { ...await request(uow), retryCount: 0, maximumAttempts: 999, failureCode: "TEMPORARY_FAILURE", externalEffectCompleted: false };
      const decision = await gate(uow, outcome === "NO_EFFECT" ? undefined : policy).evaluate(forged);
      assert.equal(decision.decision, "NOT_ALLOWED", outcome);
      assert.equal(decision.retryEligible, false);
      assert.deepEqual(await uow.repository.find(identity), original);
    } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F retry revalidates session capability MFA SoD approval target representation scope and policy", async () => {
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
      await seed(uow, "NO_EFFECT");
      const before = await uow.repository.find(identity);
      const decision = await gate(uow, policy, configuration).evaluate(await request(uow));
      assert.equal(decision.decision, "STALE_AUTHORITY", label);
      assert.equal(decision.retryEligible, false, label);
      await uow.close();
      uow = new DurablePublicationUnitOfWork({ databasePath });
      assert.deepEqual(await uow.repository.find(identity), before, label);
      assert.equal((await uow.audit.list(identity)).length, 1, label);
      assert.equal((await uow.audit.list(identity))[0]?.result, "FAILED", label);
      assert.notEqual((await uow.audit.list(identity))[0]?.actorId, "body-not-authoritative", label);
      assert.equal(await uow.execution.findIntent(identity, "next-command"), undefined, label);
    } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F retry evidence and idempotency roll back atomically on storage failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-atomic-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    await seed(uow, "NO_EFFECT");
    const input = await request(uow);
    const before = await uow.repository.find(identity);
    const begin = uow.begin.bind(uow);
    Object.defineProperty(uow, "begin", { value: async (...args: Parameters<typeof begin>) => {
      const tx = await begin(...args);
      return { ...tx, idempotency: { ...tx.idempotency, find: tx.idempotency.find.bind(tx.idempotency), record: async () => {
        await Promise.resolve(); throw new Error("NON_SECRET_STORAGE_FAILURE"); } } };
    } });
    await assert.rejects(gate(uow, policy).evaluate(input), /NON_SECRET_STORAGE_FAILURE/);
    await uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(await uow.repository.find(identity), before);
    assert.equal((await uow.audit.list(identity)).length, 0);
    assert.equal(await uow.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: `retry-intent:${input.context.idempotencyKey}` }), undefined);
  } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F approved retry derives count from history and preserves decision evidence after reopen", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-reopen-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    await seed(uow, "NO_EFFECT");
    const input = await request(uow);
    const decision = await gate(uow, policy).evaluate(input);
    assert.equal(decision.decision, "ELIGIBLE");
    assert.equal(decision.attemptNumber, 1);
    assert.equal(decision.maximumAttempts, 2);
    const evidence = await uow.audit.list(identity);
    assert.equal(evidence.length, 1);
    assert.equal(evidence[0]?.actorId, "executor-independent");
    assert.equal(evidence[0]?.command, "RETRY_DECISION");
    await uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(await gate(uow, policy).evaluate(input), decision);
    assert.deepEqual(await uow.audit.list(identity), evidence);
    assert.equal((await uow.execution.findReceipt(identity, "prior-command"))?.outcome, "NO_EFFECT");
    assert.equal((await uow.repository.find(identity))?.attempts.length, 1);
    await assert.rejects(gate(uow, policy).evaluate({ ...input, attempt: { ...input.attempt, id: "conflicting-attempt" } }), /[Ii]dempotency|conflict/);
  } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F authoritative completed execution and exhausted policy are not eligible", async () => {
  for (const outcome of ["NO_EFFECT", "CONFIRMED"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "f17-f-terminal-"));
    const uow = new DurablePublicationUnitOfWork({ databasePath: join(directory, "publication.sqlite") });
    try {
      await seed(uow, outcome);
      const decision = await gate(uow, { ...policy, maximumAttempts: 1 }).evaluate(await request(uow));
      assert.equal(decision.decision, outcome === "CONFIRMED" ? "ALREADY_COMPLETED" : "EXHAUSTED");
      assert.equal(decision.retryEligible, false);
    } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
  }
});

test("F17-F last permitted prepared retry resumes after reopen without counting its reservation twice", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-prepared-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    await seed(uow, "NO_EFFECT");
    const input = await request(uow);
    assert.equal((await gate(uow, policy).evaluate(input)).decision, "ELIGIBLE");
    const current = (await uow.repository.find(identity))!;
    const pending = PublicationAggregate.rehydrate(current).beginInitialExecution({ type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: current.aggregateVersion, attempt: input.attempt, command }).snapshot;
    const tx = await uow.begin(identity);
    await tx.repository.update(current.aggregateVersion, pending);
    await tx.execution.prepare({ ...identity, commandId: input.attempt.commandId, attemptId: input.attempt.id, dispatchFingerprint: "next-fingerprint", providerIdempotencyKey: "next-provider", preparedAt: time });
    await tx.commit();
    await uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    const decision = await gate(uow, policy).evaluate({ ...input, expectedAggregateVersion: pending.aggregateVersion });
    assert.equal(decision.decision, "ELIGIBLE");
    assert.equal(decision.attemptNumber, 1);
    assert.equal((await uow.execution.recoveryDisposition(identity, input.attempt.commandId)).condition, "PRE_DISPATCH");
    assert.equal((await uow.repository.find(identity))?.attempts.length, 2);
    assert.equal((await uow.execution.findReceipt(identity, "prior-command"))?.outcome, "NO_EFFECT");
  } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F stale authority denial and decision evidence survive reopen without business mutation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-denial-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  try {
    await seed(uow, "NO_EFFECT");
    const original = await uow.repository.find(identity);
    const input = await request(uow);
    const denial = await gate(uow, policy).evaluate({ ...input, expectedAggregateVersion: 0 });
    assert.equal(denial.decision, "STALE_AUTHORITY");
    await uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.deepEqual(await uow.repository.find(identity), original);
    const audit = await uow.audit.list(identity);
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.result, "FAILED");
    assert.equal(audit[0]?.failureReason, "PUBLICATION_VERSION_CONFLICT");
    assert.equal(audit[0]?.actorId, "executor-independent");
    assert.equal(await uow.execution.findReceipt(identity, input.attempt.commandId), undefined);
  } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F denial audit identities are isolated across aggregates sharing caller keys", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-denial-identity-"));
  const databasePath = join(directory, "publication.sqlite");
  let uow = new DurablePublicationUnitOfWork({ databasePath });
  const scopes = [identity, { ...identity, publicationId: "publication-other" }];
  try {
    const denied = { ...createTestPublicationAuthorizationConfiguration(new FixedClock(time)), sessionResolver: { resolve: () => undefined } };
    for (const scope of scopes) {
      const tx = await uow.begin(scope);
      await tx.repository.save(createPublication({ identity: scope, binding, prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS", command }).snapshot);
      await tx.commit();
      assert.equal((await gate(uow, policy, denied).evaluate({ ...await request(uow), identity: scope })).decision, "STALE_AUTHORITY");
    }
    await uow.close();
    uow = new DurablePublicationUnitOfWork({ databasePath });
    assert.equal((await uow.audit.list(scopes[0]!)).length, 1);
    assert.equal((await uow.audit.list(scopes[1]!)).length, 1);
    assert.notEqual((await uow.audit.list(scopes[0]!))[0]?.id, (await uow.audit.list(scopes[1]!))[0]?.id);
  } finally { await uow.close(); rmSync(directory, { recursive: true, force: true }); }
});
