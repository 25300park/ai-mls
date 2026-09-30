import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { PublicationExecutionContext } from "./publication-application-contracts.js";
import { FixedClock } from "./publication-clock.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationLiveAuthorizationContext } from "./publication-authorization.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { createProductionPublicationInfrastructure, createPublicationInfrastructure } from "./publication-infrastructure.js";
import { Api013EffectiveApprovalAdapter } from "./publication-infrastructure-effective-approval-adapter.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationSession } from "./publication-authorization-test-support.test.js";
import { PublicationCoordinationService, type PublicationConnectorDispatcher, type PublicationConnectorDispatchResult } from "./publication-service.js";
import { DeterministicPublicationConnectorTestAdapter } from "./publication-provider-test-adapter.js";
import { PublicationApplicationService } from "./publication-application-service.js";
import { CreatePublicationHandler, ModifyPublicationHandler } from "./publication-command-handlers.js";
import { PublicationEventError } from "./publication-event-error.js";
import { PublicationExecutionEligibilityGate } from "./publication-execution-eligibility.js";
import { PublicationDurableRetryEligibility, type PublicationApprovedRetryPolicyResolver } from "./publication-durable-retry.js";
import { DurablePublicationUnitOfWork } from "./publication-durable-persistence.js";

const timestamp = "2026-08-03T12:00:00.000Z";

test("F17-F coordinated new attempt after provider rejection requires approved retry policy", async () => {
  let calls = 0;
  const infrastructure = createPublicationInfrastructure({
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    effectiveApprovalPort: { check: () => approvalDecision("approval-current") },
    connectorDispatcher: { dispatch: () => { calls++; return { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] }; } },
  });
  const initial = request(context("f17-f-first"));
  assert.equal((await coordinate(infrastructure, initial)).ok, false);
  const before = (await infrastructure.repository.find(identity))!;
  const retry = request(context("f17-f-second"));
  const result = await infrastructure.coordination.publish({ identity, context: retry.context, command: retry.create.input.command, attempt: { ...retry.attempt, id: "attempt-retry-new", commandId: "command-retry-new" }, expectedAggregateVersion: before.aggregateVersion });
  assert.equal(result.ok, false);
  assert.equal(calls, 1, "no approved retry policy means zero second dispatch");
  assert.deepEqual(await infrastructure.repository.find(identity), before);
});
const identity = { publicationId: "publication-coordination-1", tenantScopeId: "team-a" } as const;

test("F17-F approved new attempt preserves prior receipt and same attempt replay never redelivers", async () => {
  let calls = 0;
  const infrastructure = createPublicationInfrastructure({
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    effectiveApprovalPort: { check: () => approvalDecision("approval-current") },
    approvedRetryPolicy: { resolve: () => ({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "test-approved-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT"] }) },
    connectorDispatcher: { dispatch: () => { calls++; return calls === 1 ? { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] } : { outcome: "CONFIRMED", evidenceRefs: ["provider:confirmed"], externalObjectReference: "external-confirmed" }; } },
  });
  const initial = request(context("f17-f-initial"));
  assert.equal((await coordinate(infrastructure, initial)).ok, false);
  const prior = await infrastructure.unitOfWork.execution.findReceipt(identity, initial.attempt.commandId);
  const retry = request(context("f17-f-authorized-retry"));
  const input = { identity, context: retry.context, command: retry.create.input.command, attempt: { ...retry.attempt, id: "attempt-approved-retry", commandId: "command-approved-retry" }, expectedAggregateVersion: (await infrastructure.repository.find(identity))!.aggregateVersion };
  const result = await infrastructure.coordination.publish(input);
  assert.equal(result.ok, true);
  assert.equal(calls, 2);
  assert.equal((await infrastructure.coordination.publish(input)).ok, true);
  assert.equal(calls, 2);
  assert.equal((await infrastructure.repository.find(identity))?.attempts.length, 2);
  assert.deepEqual(await infrastructure.unitOfWork.execution.findReceipt(identity, initial.attempt.commandId), prior);
  assert.equal((await infrastructure.coordination.publish({ ...input, attempt: { ...input.attempt, id: "conflicting-id" } })).ok, false);
  assert.equal(calls, 2);
});

test("F17-F live authority changing after retry admission blocks the dispatch boundary", async () => {
  let calls = 0;
  let approvalChecks = 0;
  let authorityCurrent = true;
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp));
  const infrastructure = createPublicationInfrastructure({
    ...base,
    authorizationEvaluator: { evaluate: (input) => authorityCurrent ? base.authorizationEvaluator!.evaluate(input) : { effect: "DENY", reasonCode: "POLICY_DENIED", policyVersion: "current-policy", obligations: [], assignmentIds: [] } },
    effectiveApprovalPort: { check: () => { approvalChecks++; if (approvalChecks === 4) authorityCurrent = false; return approvalDecision("approval-current"); } },
    approvedRetryPolicy: { resolve: () => ({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "test-approved-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT"] }) },
    connectorDispatcher: { dispatch: () => { calls++; return { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] }; } },
  });
  assert.equal((await coordinate(infrastructure, request(context("f17-f-stale-first")))).ok, false);
  const retry = request(context("f17-f-stale-second"));
  const result = await infrastructure.coordination.publish({ identity, context: retry.context, command: retry.create.input.command, attempt: { ...retry.attempt, id: "stale-retry-attempt", commandId: "stale-retry-command" }, expectedAggregateVersion: (await infrastructure.repository.find(identity))!.aggregateVersion });
  assert.equal(result.ok, false);
  assert.equal(calls, 1, "fresh authority must be checked at dispatch, not only earlier admission");
});
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

function approvalDecision(decisionReference: string) {
  return Object.freeze({
    effective: true as const,
    decisionReference,
    approvalId: binding.approvalId,
    approvalVersion: binding.approvalVersion,
    checkedAt: timestamp,
    effectiveScope: Object.freeze({ targetId: binding.targetId, channelId: binding.channelId }),
    reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
  });
}

function context(suffix: string): PublicationExecutionContext {
  return {
    actorId: "forged-body-actor",
    sessionId: "executor-independent",
    correlationId: `correlation-${suffix}`,
    idempotencyKey: `idempotency-${suffix}`,
    intentFingerprint: `sha256:${suffix}`,
  };
}

function request(execution: PublicationExecutionContext) {
  return {
    context: execution,
    create: {
      kind: "CREATE_PUBLICATION" as const,
      input: {
        identity,
        binding,
        prerequisites: {
          immutableSnapshot: true,
          exactTargetChannel: true,
          provenancePresent: true,
        } as const,
        classification: "CONFIDENTIAL_BUSINESS" as const,
        command: {
          actorId: "forged-command-actor",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Approved create and publish coordination",
          correlationId: execution.correlationId,
          occurredAt: timestamp,
        },
      },
    },
    attempt: {
      id: "attempt-initial-1",
      commandId: "command-initial-1",
      operation: "INITIAL_PUBLISH" as const,
      occurredAt: timestamp,
      evidenceRefs: [] as readonly string[],
    },
  };
}

async function coordinate(
  infrastructure: Pick<ReturnType<typeof createPublicationInfrastructure>, "coordination">,
  coordinated: ReturnType<typeof request>,
) {
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  if (!created.ok) return created;
  return infrastructure.coordination.publish({
    context: coordinated.context,
    identity: coordinated.create.input.identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.aggregateVersion,
  });
}

test("F15-TASK-006 coordinates create, live Approval, connector confirmation and ACTIVE persistence", async () => {
  const approvalChecks: string[] = [];
  const connectorDispatches: string[] = [];
  const infrastructure = createPublicationInfrastructure({
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    effectiveApprovalPort: {
      check(input) {
        approvalChecks.push(`${input.approvalId}:${String(input.approvalVersion)}:${input.actorId}`);
        return approvalDecision("approval-decision-1");
      },
    },
    connectorDispatcher: {
      dispatch(input) {
        connectorDispatches.push(input.commandId);
        return Object.freeze({
          outcome: "CONFIRMED" as const,
          evidenceRefs: Object.freeze(["connector-evidence-1"]),
          externalObjectReference: "external-listing-1",
        });
      },
    },
  });

  const coordinated = request(context("success"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });

  assert.equal(created.ok, true);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "READY");
  assert.deepEqual(connectorDispatches, []);

  const result = created.ok ? await infrastructure.coordination.publish({
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.aggregateVersion,
  }) : created;

  assert.deepEqual(result, {
    ok: true,
    publicationId: identity.publicationId,
    aggregateVersion: 3,
    lifecycleState: "ACTIVE",
    connectorOutcome: "CONFIRMED",
    replayed: false,
  });
  assert.equal(approvalChecks.length, 2);
  assert.equal(approvalChecks.every((value) => value.endsWith(":executor-independent")), true);
  assert.deepEqual(connectorDispatches, ["command-initial-1"]);
  const persisted = await infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "ACTIVE");
  assert.equal(persisted?.externalObjectReference, "external-listing-1");
  assert.deepEqual(persisted?.transitionHistory.map(({ transitionId }) => transitionId), ["PUB-TR-001", "PUB-TR-002", "PUB-TR-003"]);
  assert.deepEqual((await infrastructure.audit.list(identity)).map(({ result, version, actorId }) => ({ result, version, actorId })), [
    { result: "COMPLETED", version: 1, actorId: "executor-independent" },
    { result: "COMPLETED", version: 2, actorId: "executor-independent" },
    { result: "COMPLETED", version: 3, actorId: "executor-independent" },
    { result: "COMPLETED", version: 3, actorId: "executor-independent" },
  ]);
});

test("F17-C receipt persistence failure preserves the safe Event code and fails ambiguous without redispatch", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("event-append-retry"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  const dependencies = (infrastructure.coordination as unknown as {
    dependencies: { eventCoordinator: { appendAcceptedTransition(...input: readonly unknown[]): readonly unknown[] } };
  }).dependencies;
  const workingCoordinator = dependencies.eventCoordinator;
  Object.assign(dependencies, {
    eventCoordinator: {
      appendAcceptedTransition(): never {
        throw new PublicationEventError("EVENT_APPEND_FAILED", "simulated canonical Event append failure", {
          eventId: "evt_safe_failure",
          eventType: "EVT-003",
          eventSequence: 1,
          correlationId: coordinated.context.correlationId,
        });
      },
    },
  });
  const publishRequest = {
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.ok ? created.aggregateVersion : 1,
  };

  const failed = await infrastructure.coordination.publish(publishRequest);

  assert.equal(failed.ok, false);
  assert.equal(!failed.ok && failed.error.code, "EVENT_APPEND_FAILED");
  assert.equal(dispatchCount(), 1);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "EXECUTION_PENDING");
  assert.equal((await infrastructure.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId)).length, 0);
  assert.equal(await infrastructure.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: `${coordinated.context.idempotencyKey}:activation` }), undefined);
  const failureAudit = (await infrastructure.audit.list(identity)).find((record) => record.failureReason === "EVENT_APPEND_FAILED");
  assert.deepEqual(failureAudit === undefined ? undefined : {
    eventId: failureAudit.eventId,
    eventType: failureAudit.eventType,
    eventSequence: failureAudit.eventSequence,
    safeReasonCode: failureAudit.safeReasonCode,
  }, { eventId: "evt_safe_failure", eventType: "EVT-003", eventSequence: 1, safeReasonCode: "EVENT_APPEND_FAILED" });

  const attemptConflict = await infrastructure.coordination.publish({
    ...publishRequest,
    attempt: { ...publishRequest.attempt, id: `${publishRequest.attempt.id}-conflict` },
  });
  assert.deepEqual(attemptConflict, {
    ok: false,
    error: {
      code: "DISPATCH_EVIDENCE_IDENTITY_CONFLICT",
      category: "CONFLICT",
      message: "Publication connector dispatch identity conflicts with prior evidence.",
    },
  });
  assert.equal(dispatchCount(), 1);

  const effectiveApproval = (dependencies as unknown as { effectiveApproval: unknown }).effectiveApproval;
  const executionEligibility = (dependencies as unknown as { executionEligibility: unknown }).executionEligibility;
  const changedEffectiveApproval = { check: () => approvalDecision("approval-decision-changed") };
  Object.assign(dependencies, {
    effectiveApproval: changedEffectiveApproval,
    executionEligibility: new PublicationExecutionEligibilityGate({ effectiveApproval: changedEffectiveApproval }),
  });
  const fingerprintConflict = await infrastructure.coordination.publish(publishRequest);
  assert.deepEqual(fingerprintConflict, {
    ok: false,
    error: {
      code: "DISPATCH_EVIDENCE_IDENTITY_CONFLICT",
      category: "CONFLICT",
      message: "Publication connector dispatch identity conflicts with prior evidence.",
    },
  });
  assert.equal(dispatchCount(), 1);

  Object.assign(dependencies, { eventCoordinator: workingCoordinator, effectiveApproval, executionEligibility });
  const recovered = await infrastructure.coordination.publish(publishRequest);
  assert.equal(recovered.ok, false);
  assert.equal(!recovered.ok && recovered.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal(dispatchCount(), 1);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal((await infrastructure.unitOfWork.execution.recoveryDisposition(identity, coordinated.attempt.commandId)).providerInvocationPermitted, false);
  assert.deepEqual((await infrastructure.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId)).map((item) => item.eventType), []);
  assert.notEqual(await infrastructure.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: `${coordinated.context.idempotencyKey}:activation` }), undefined);
});

test("F15-TASK-010R unknown connector-outcome persistence failure remains sanitized", async () => {
  const { infrastructure } = coordinationInfrastructure();
  const coordinated = request(context("unknown-event-failure"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  const dependencies = (infrastructure.coordination as unknown as { dependencies: { eventCoordinator: unknown } }).dependencies;
  Object.assign(dependencies, { eventCoordinator: { appendAcceptedTransition(): never { throw new Error("sensitive journal internals"); } } });
  const result = await infrastructure.coordination.publish({ context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: created.ok ? created.aggregateVersion : 1 });

  assert.deepEqual(result, { ok: false, error: { code: "CONNECTOR_OUTCOME_PERSISTENCE_FAILED", category: "INFRASTRUCTURE", message: "Publication connector outcome could not be recorded." } });
  assert.equal(JSON.stringify(result).includes("sensitive journal internals"), false);
});

function coordinationInfrastructure(
  outcome: PublicationConnectorDispatchResult | (() => PublicationConnectorDispatchResult) = Object.freeze({
    outcome: "CONFIRMED" as const,
    evidenceRefs: Object.freeze(["connector-evidence-default"]),
    externalObjectReference: "external-listing-default",
  }),
  options: {
    readonly approvalEffective?: boolean;
    readonly omitAuthentication?: boolean;
    readonly liveTransform?: (live: PublicationLiveAuthorizationContext) => PublicationLiveAuthorizationContext;
    readonly onDispatch?: () => void | Promise<void>;
  } = {},
) {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp));
  const configuration = options.omitAuthentication === true ? { clock: new FixedClock(timestamp) } : {
    ...base,
    ...(options.liveTransform === undefined ? {} : {
      liveContextResolver: {
        resolve(bindingInput: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[0], scope: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[1]) {
          const live = base.liveContextResolver!.resolve(bindingInput, scope);
          return live === undefined ? undefined : options.liveTransform!(live);
        },
      },
    }),
  };
  let dispatchCount = 0;
  const infrastructure = createPublicationInfrastructure({
    ...configuration,
    effectiveApprovalPort: {
      check: () => Object.freeze(options.approvalEffective === false
        ? { effective: false as const }
        : approvalDecision("approval-decision-default")),
    },
    connectorDispatcher: {
      async dispatch() {
        dispatchCount += 1;
        await options.onDispatch?.();
        return typeof outcome === "function" ? outcome() : outcome;
      },
    },
  });
  return { infrastructure, dispatchCount: () => dispatchCount };
}

test("F15-TASK-006 requires current API-013 effective Approval before mutation", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, { approvalEffective: false });

  const result = await coordinate(infrastructure, request(context("stale-approval")));

  assert.deepEqual(result, {
    ok: false,
    error: { code: "APPROVAL_NOT_EFFECTIVE", category: "DOMAIN_REJECTION", message: "Publication Approval is not effective." },
  });
  assert.equal(await infrastructure.repository.find(identity), undefined);
  assert.equal(dispatchCount(), 0);
  assert.deepEqual((await infrastructure.audit.list(identity)).map(({ result, failureReason }) => ({ result, failureReason })), [
    { result: "FAILED", failureReason: "APPROVAL_NOT_EFFECTIVE" },
  ]);
});

test("F17-B coordination consumes the explicit BLOCKED eligibility result before provider dispatch or state mutation", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("eligibility-blocked"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  const before = await infrastructure.repository.find(identity);
  assert.equal(before?.lifecycleState, "READY");

  const dependencies = (infrastructure.coordination as unknown as {
    dependencies: { executionEligibility: typeof infrastructure.executionEligibility };
  }).dependencies;
  assert.equal(dependencies.executionEligibility, infrastructure.executionEligibility);
  Object.assign(dependencies, {
    executionEligibility: Object.freeze({
      evaluate: () => Object.freeze({ status: "BLOCKED" as const, reasonCode: "APPROVAL_NOT_EFFECTIVE" as const }),
    }),
  });

  const result = await infrastructure.coordination.publish({
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.ok ? created.aggregateVersion : 1,
  });

  assert.deepEqual(result, {
    ok: false,
    error: { code: "APPROVAL_NOT_EFFECTIVE", category: "DOMAIN_REJECTION", message: "Publication Approval is not effective." },
  });
  assert.deepEqual(await infrastructure.repository.find(identity), before);
  assert.equal(dispatchCount(), 0);
});

test("F15-TASK-006 API-013 adapter supplies the canonical effective Approval contract", async () => {
  const canonicalRequests: Record<string, unknown>[] = [];
  const adapter = new Api013EffectiveApprovalAdapter(
    {
      checkEffectiveApproval(input) {
        canonicalRequests.push(input as unknown as Record<string, unknown>);
        return Object.freeze({
          effective: true,
          approvalId: input.approvalId,
          approvalVersion: input.approvalVersion,
          checkedAt: canonicalRequests.length % 2 === 0 ? "2026-08-03T12:00:01.000Z" : timestamp,
          effectiveScope: Object.freeze({ targetId: input.targetId, channelId: input.channelId, fieldScope: input.fieldScope, mediaScope: input.mediaScope, audience: input.audience, language: input.language }),
          expiresAt: "2030-08-03T12:00:00.000Z",
          reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
        });
      },
    },
    { resolve: (sessionId) => createTestPublicationSession(sessionId, sessionId) },
    {
      resolve: () => Object.freeze({
        subjectRef: Object.freeze({ entityType: "Listing", entityId: binding.subjectId, version: binding.subjectRevision }),
        fieldScope: Object.freeze(["AVAILABILITY" as const, "PRICE" as const]),
        mediaScope: Object.freeze(["PRIMARY_PHOTO"]),
        audience: Object.freeze({ code: "AUD_PUBLIC" as const }),
        language: "en",
        verificationId: "verification-test",
        verificationVersion: 1,
        permissionId: "permission-test",
        permissionVersion: 1,
        targetPolicyVersion: "target-policy-v1",
      }),
    },
  );
  const infrastructure = createPublicationInfrastructure({
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    effectiveApprovalPort: adapter,
    connectorDispatcher: { dispatch: () => Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["api-013-adapter-evidence"]), externalObjectReference: "external-api-013" }) },
  });

  const result = await coordinate(infrastructure, request(context("api-013-adapter")));

  assert.equal(result.ok, true);
  assert.equal(canonicalRequests.length, 2);
  assert.deepEqual(canonicalRequests[1], {
    actor: createTestPublicationSession("executor-independent", "executor-independent"),
    purpose: "PURPOSE_PUBLICATION_APPROVAL",
    correlationId: "correlation-api-013-adapter",
    approvalId: binding.approvalId,
    approvalVersion: binding.approvalVersion,
    representationId: binding.representationId,
    representationVersion: binding.representationVersion,
    representationChecksum: binding.representationChecksum,
    subjectRef: { entityType: "Listing", entityId: binding.subjectId, version: binding.subjectRevision },
    targetId: binding.targetId,
    channelId: binding.channelId,
    fieldScope: ["AVAILABILITY", "PRICE"],
    mediaScope: ["PRIMARY_PHOTO"],
    audience: { code: "AUD_PUBLIC" },
    language: "en",
    verificationId: "verification-test",
    verificationVersion: 1,
    permissionId: "permission-test",
    permissionVersion: 1,
    targetPolicyVersion: "target-policy-v1",
    channelPolicyVersion: binding.channelPolicyVersion,
    consumerDuty: "EXECUTION",
  });
  const approvalInput = {
    ...binding,
    actorId: "executor-independent",
    sessionId: "executor-independent",
    correlationId: "correlation-api-013-stable-reference",
    tenantScopeId: "team-a",
    purpose: "PUBLICATION_EXECUTION" as const,
    consumerDuty: "EXECUTION" as const,
  };
  const firstDecision = adapter.check(approvalInput);
  const secondDecision = adapter.check(approvalInput);
  assert.equal(firstDecision.effective, true);
  assert.equal(secondDecision.effective, true);
  if (!firstDecision.effective || !secondDecision.effective) throw new Error("API-013 decision unexpectedly ineffective.");
  assert.notEqual(firstDecision.checkedAt, secondDecision.checkedAt);
  assert.equal(firstDecision.decisionReference, secondDecision.decisionReference);
});

for (const prerequisite of ["verification", "permission"] as const) {
  test(`F15-TASK-006 requires current ${prerequisite} before create or connector dispatch`, async () => {
    const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, {
      liveTransform(live) {
        return prerequisite === "verification"
          ? Object.freeze({ ...live, verification: Object.freeze({ ...live.verification, status: "REVOKED" as const }) })
          : Object.freeze({ ...live, permission: Object.freeze({ ...live.permission, status: "REVOKED" as const }) });
      },
    });

    const result = await coordinate(infrastructure, request(context(`stale-${prerequisite}`)));

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, prerequisite === "verification" ? "VERIFICATION_NOT_EFFECTIVE" : "PERMISSION_NOT_EFFECTIVE");
    assert.equal(await infrastructure.repository.find(identity), undefined);
    assert.equal(dispatchCount(), 0);
  });
}

test("F15-TASK-006 authorization failure stops before Approval, connector and persistence", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, { omitAuthentication: true });

  const result = await coordinate(infrastructure, request(context("authentication-failure")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "AUTHENTICATION_REQUIRED");
  assert.equal(await infrastructure.repository.find(identity), undefined);
  assert.equal(dispatchCount(), 0);
  assert.deepEqual(await infrastructure.audit.list(identity), []);
});

for (const prerequisite of ["verification", "permission"] as const) {
  test(`F15-TASK-006 revalidates ${prerequisite} after create and before publish dispatch`, async () => {
    const base = createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp));
    let liveChecks = 0;
    let dispatchCount = 0;
    const infrastructure = createPublicationInfrastructure({
      ...base,
      liveContextResolver: {
        resolve(bindingInput, scope) {
          const live = base.liveContextResolver!.resolve(bindingInput, scope)!;
          liveChecks += 1;
          if (liveChecks === 1) return live;
          return prerequisite === "verification"
            ? Object.freeze({ ...live, verification: Object.freeze({ ...live.verification, status: "REVOKED" as const }) })
            : Object.freeze({ ...live, permission: Object.freeze({ ...live.permission, status: "REVOKED" as const }) });
        },
      },
      effectiveApprovalPort: { check: () => approvalDecision("approval-current-before-publish") },
      connectorDispatcher: { dispatch: () => { dispatchCount += 1; return Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["unexpected"]), externalObjectReference: "unexpected" }); } },
    });
    const coordinated = request(context(`publish-stale-${prerequisite}`));
    const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = await infrastructure.coordination.publish({ context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: created.aggregateVersion });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, prerequisite === "verification" ? "VERIFICATION_NOT_EFFECTIVE" : "PERMISSION_NOT_EFFECTIVE");
    assert.equal(dispatchCount, 0);
    assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "READY");
  });
}

test("F15-TASK-006 rejects a stale publish version before connector dispatch", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("stale-publish-version"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await infrastructure.coordination.publish({ context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: created.aggregateVersion + 1 });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "PUBLICATION_VERSION_CONFLICT");
  assert.equal(dispatchCount(), 0);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "READY");
});

test("F15-TASK-006 connector rejection returns READY with immutable no-effect evidence", async () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "REJECTED",
    evidenceRefs: Object.freeze(["connector-rejection-1"]),
  }));

  const result = await coordinate(infrastructure, request(context("connector-rejected")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_REJECTED");
  const persisted = await infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "READY");
  assert.equal(persisted?.attempts[0]?.outcome, "NO_EFFECT");
  assert.deepEqual(persisted?.attempts[0]?.evidenceRefs, ["connector-rejection-1"]);
  assert.deepEqual((await infrastructure.audit.list(identity)).map(({ result }) => result), ["COMPLETED", "COMPLETED", "COMPLETED"]);
});

test("F15-TASK-006 unknown connector outcome fails closed in RECONCILIATION_REQUIRED", async () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "UNKNOWN",
    evidenceRefs: Object.freeze(["connector-observation-unknown-1"]),
  }));

  const result = await coordinate(infrastructure, request(context("connector-unknown")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  const persisted = await infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(persisted?.attempts[0]?.outcome, "UNKNOWN");
  assert.equal(persisted?.reconciliationCases[0]?.status, "OPEN");
  assert.equal(persisted?.externalObjectReference, undefined);
});

test("F15-TASK-006 contains connector exceptions as unknown without claiming ACTIVE", async () => {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp));
  const infrastructure = createPublicationInfrastructure({
    ...base,
    effectiveApprovalPort: { check: () => approvalDecision("approval-decision-exception") },
    connectorDispatcher: { dispatch(): never { throw new Error("restricted provider failure detail"); } },
  });

  const result = await coordinate(infrastructure, request(context("connector-exception")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(JSON.stringify(result).includes("restricted provider failure detail"), false);
  assert.equal(infrastructure.operationsMetrics.snapshot().connectorFailures, 1);
  assert.equal(infrastructure.operationsEvidence.list({ component: "CONNECTOR_ATTEMPT" }).filter(({ result }) => result === "FAILED").length, 1);
});

test("F15-TASK-006 identical replay does not duplicate connector dispatch or persistence", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("idempotent-replay"));

  const first = await coordinate(infrastructure, coordinated);
  const second = await coordinate(infrastructure, coordinated);

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ...first, replayed: true });
  assert.equal(dispatchCount(), 1);
  assert.equal((await infrastructure.repository.readHistory(identity)).length, 3);
  assert.equal((await infrastructure.audit.list(identity)).length, 4);
});

test("F15-TASK-006 conflicting idempotency fingerprint is rejected without redispatch", async () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const first = request(context("idempotency-conflict"));
  assert.equal((await coordinate(infrastructure, first)).ok, true);

  const result = await coordinate(infrastructure, {
    ...first,
    context: { ...first.context, intentFingerprint: "sha256:conflicting-intent" },
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(dispatchCount(), 1);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "ACTIVE");
});

test("F15-TASK-006 records confirmed external effect after a concurrent aggregate version change", async () => {
  const holder: { current?: ReturnType<typeof createPublicationInfrastructure> } = {};
  const configured = coordinationInfrastructure(undefined, {
    async onDispatch() {
      const infrastructure = holder.current!;
      const current = (await infrastructure.repository.find(identity))!;
      const changed = PublicationAggregate.rehydrate(current).setSuspension({
        type: "SET_SUSPENSION",
        expectedAggregateVersion: current.aggregateVersion,
        suspensionStatus: "SUSPENDED_SECURITY",
        command: {
          actorId: "concurrent-security-actor",
          authorityContext: "PUBLICATION_EXECUTION",
          reason: "Concurrent security hold",
          correlationId: "correlation-concurrent-hold",
          occurredAt: timestamp,
        },
      }).snapshot;
      await infrastructure.repository.update(current.aggregateVersion, changed);
    },
  });
  const infrastructure = configured.infrastructure;
  holder.current = infrastructure;

  const result = await coordinate(infrastructure, request(context("version-conflict")));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.aggregateVersion, 4);
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "ACTIVE");
  assert.equal((await infrastructure.repository.find(identity))?.suspensionStatus, "SUSPENDED_SECURITY");
});

test("F15-TASK-006 dispatches only the persisted exact binding and approval decision evidence", async () => {
  const dispatches: unknown[] = [];
  const infrastructure = createPublicationInfrastructure({
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
    effectiveApprovalPort: { check: () => approvalDecision("approval-decision-exact") },
    connectorDispatcher: {
      dispatch(input) {
        dispatches.push(input);
        return Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["exact-binding-evidence"]), externalObjectReference: "external-exact" });
      },
    },
  });
  const coordinated = request(context("exact-binding"));
  const created = await infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = await infrastructure.coordination.publish({
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.aggregateVersion,
    binding: { ...binding, targetId: "forged-target" },
  } as unknown as Parameters<typeof infrastructure.coordination.publish>[0] & { readonly binding: typeof binding });

  assert.equal(result.ok, true);
  assert.deepEqual(dispatches, [{
    publicationId: identity.publicationId,
    tenantScopeId: identity.tenantScopeId,
    commandId: coordinated.attempt.commandId,
    attemptId: coordinated.attempt.id,
    targetId: binding.targetId,
    targetVersion: binding.targetVersion,
    channelId: binding.channelId,
    channelPolicyVersion: binding.channelPolicyVersion,
    representationId: binding.representationId,
    representationVersion: binding.representationVersion,
    representationChecksum: binding.representationChecksum,
    approvalDecisionReference: "approval-decision-exact",
    providerIdempotencyKey: `publication:${identity.tenantScopeId}:${identity.publicationId}:${coordinated.attempt.commandId}:${coordinated.attempt.id}`,
  }]);
});

test("F15-TASK-006 converts an inconsistent connector result to UNKNOWN reconciliation", async () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "REJECTED",
    evidenceRefs: Object.freeze(["contradictory-result"]),
    externalObjectReference: "unexpected-external-effect",
  }));

  const result = await coordinate(infrastructure, request(context("invalid-connector-result")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  const persisted = await infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.deepEqual(persisted?.attempts[0]?.evidenceRefs, ["connector-observation:attempt-initial-1:invalid-result"]);
});

test("F17-E reconstructs only approved provider result fields without evaluating raw extra fields", async () => {
  const providerResult = {
    outcome: "CONFIRMED" as const,
    evidenceRefs: ["provider-safe-evidence"],
    externalObjectReference: "external-safe-e",
    rawPayload: "NON_SECRET_RAW_RESPONSE_FIXTURE",
    authorization: "NON_SECRET_AUTH_HEADER_FIXTURE",
    get rawException(): never { throw new Error("NON_SECRET_EXTRA_GETTER_FIXTURE"); },
    toJSON(): never { throw new Error("NON_SECRET_RAW_SERIALIZER_FIXTURE"); },
  };
  const { infrastructure } = coordinationInfrastructure(() => providerResult);
  const result = await coordinate(infrastructure, request(context("safe-provider-normalization")));
  assert.equal(result.ok, true);
  const evidence = infrastructure.dispatchEvidence.find(identity, "command-initial-1");
  assert.deepEqual(evidence?.result, {
    outcome: "CONFIRMED", evidenceRefs: ["provider-safe-evidence"], externalObjectReference: "external-safe-e",
  });
  assert.equal(Object.isFrozen(evidence?.result), true);
  assert.equal(Object.isFrozen(evidence?.result.evidenceRefs), true);
  providerResult.evidenceRefs[0] = "changed-after-dispatch";
  const receipt = await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1");
  assert.deepEqual(receipt?.evidenceRefs, ["provider-safe-evidence"]);
  assert.equal(receipt?.outcome, "CONFIRMED");
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "ACTIVE");
  assert.equal(JSON.stringify([result, evidence, receipt, await infrastructure.audit.list(identity), await infrastructure.repository.find(identity)]).includes("NON_SECRET"), false);
});

test("F17-E unsafe provider references fail closed and never enter receipt audit or result", async () => {
  const unsafeReferences = [
    "Authorization: Bearer NON_SECRET_TEST_VALUE", "token:NON_SECRET_TEST_VALUE",
    "https://invalid.example/private?password=NON_SECRET_TEST_VALUE", "C:\\private\\provider.log",
    "cookie=NON_SECRET_TEST_VALUE", "secret-header-fixture", "x".repeat(513), "line\nbreak",
  ];
  for (const [index, unsafe] of unsafeReferences.entries()) {
    for (const field of ["evidenceRefs", "externalObjectReference"] as const) {
      const candidate = {
        outcome: "CONFIRMED" as const, evidenceRefs: ["safe-provider-evidence"], externalObjectReference: "safe-external-reference",
        ...(field === "evidenceRefs" ? { evidenceRefs: [unsafe] } : { externalObjectReference: unsafe }),
      };
      const { infrastructure } = coordinationInfrastructure(candidate);
      const result = await coordinate(infrastructure, request(context(`unsafe-provider-${index}-${field}`)));
      assert.equal(result.ok, false, `${index}:${field}`);
      assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
      assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
      const receipt = await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1");
      assert.equal(receipt?.outcome, "UNKNOWN");
      assert.equal(receipt?.externalObjectReference, undefined);
      const serialized = JSON.stringify([result, receipt, infrastructure.dispatchEvidence.find(identity, "command-initial-1"), await infrastructure.audit.list(identity), await infrastructure.repository.find(identity)]);
      assert.equal(serialized.includes(unsafe), false);
      assert.equal(serialized.includes("NON_SECRET"), false);
    }
  }
});

test("F17-E malformed sparse or oversized provider evidence cannot become confirmed", async () => {
  const sparse: string[] = [];
  sparse.length = 1;
  for (const candidate of [null, undefined, {}, { outcome: "SUCCESS", evidenceRefs: ["safe"] },
    { outcome: "CONFIRMED", evidenceRefs: sparse, externalObjectReference: "safe" },
    { outcome: "CONFIRMED", evidenceRefs: Array.from({ length: 65 }, () => "safe"), externalObjectReference: "safe" },
  ]) {
    const { infrastructure } = coordinationInfrastructure(() => candidate as PublicationConnectorDispatchResult);
    const result = await coordinate(infrastructure, request(context("malformed-provider")));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
    assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal((await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1"))?.outcome, "UNKNOWN");
  }
});

test("F17-E provider-controlled iterators cannot replace or expand bounded evidence", async () => {
  for (const yielded of [[], Array.from({ length: 65 }, () => "forged-evidence")]) {
    let iteratorCalls = 0;
    const evidenceRefs = ["safe-indexed-evidence"];
    Object.defineProperty(evidenceRefs, Symbol.iterator, { value: function* () { iteratorCalls += 1; yield* yielded; } });
    const { infrastructure } = coordinationInfrastructure({ outcome: "CONFIRMED", evidenceRefs, externalObjectReference: "safe-external" });
    const result = await coordinate(infrastructure, request(context("hostile-provider-iterator")));
    assert.equal(result.ok, true);
    assert.equal(iteratorCalls, 0);
    assert.deepEqual((await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1"))?.evidenceRefs, ["safe-indexed-evidence"]);
  }
});

test("F17-E provider evidence accessors fail closed without evaluating provider code", async () => {
  let accessorCalls = 0;
  const evidenceRefs = ["safe"];
  Object.defineProperty(evidenceRefs, "0", { get() { accessorCalls += 1; return "untrusted-getter-evidence"; } });
  const { infrastructure } = coordinationInfrastructure({ outcome: "CONFIRMED", evidenceRefs, externalObjectReference: "safe-external" });
  const result = await coordinate(infrastructure, request(context("hostile-provider-accessor")));
  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal(accessorCalls, 0);
  assert.equal((await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1"))?.outcome, "UNKNOWN");
});

test("F17-E timeout and connection errors preserve safe UNKNOWN categories without raw exception leakage", async () => {
  for (const [code, category] of [["ETIMEDOUT", "timeout"], ["ECONNRESET", "connection-failure"], ["ECONNREFUSED", "connection-failure"], ["UNRECOGNIZED", "unavailable"]] as const) {
    const { infrastructure, dispatchCount } = coordinationInfrastructure(() => {
      throw Object.assign(new Error("Authorization: NON_SECRET_PROVIDER_EXCEPTION_FIXTURE"), { code });
    });
    const coordinated = request(context(`provider-error-${code}`));
    const first = await coordinate(infrastructure, coordinated);
    const repeated = await coordinate(infrastructure, coordinated);
    assert.equal(first.ok, false);
    assert.deepEqual(repeated, first);
    assert.equal(dispatchCount(), 1);
    const receipt = await infrastructure.unitOfWork.execution.findReceipt(identity, "command-initial-1");
    assert.equal(receipt?.outcome, "UNKNOWN");
    assert.deepEqual(receipt?.evidenceRefs, [`connector-observation:attempt-initial-1:${category}`]);
    assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal(JSON.stringify([first, receipt, await infrastructure.audit.list(identity), infrastructure.operationsEvidence.list({ component: "CONNECTOR_ATTEMPT" })]).includes("NON_SECRET"), false);
  }
});

function durableProviderTestGraph(databasePath: string, connector: PublicationConnectorDispatcher, approvedRetryPolicy?: PublicationApprovedRetryPolicyResolver) {
  const effectiveApproval = { check: () => approvalDecision("approval-durable-provider-e") };
  const infrastructure = createProductionPublicationInfrastructure({
    databasePath,
    configuration: { ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)), effectiveApprovalPort: effectiveApproval },
  });
  // Explicit test-only service assembly: production factory itself still exposes only unavailable dispatch.
  const application = new PublicationApplicationService(new CreatePublicationHandler(infrastructure), new ModifyPublicationHandler(infrastructure));
  const coordination = new PublicationCoordinationService({
    application, repository: infrastructure.repository, effectiveApproval,
    executionEligibility: infrastructure.executionEligibility, executionJournal: infrastructure.unitOfWork.execution,
    retryEligibility: new PublicationDurableRetryEligibility({ unitOfWork: infrastructure.unitOfWork, authorization: infrastructure.authorization, effectiveApproval, clock: infrastructure.clock, ...(approvedRetryPolicy === undefined ? {} : { policy: approvedRetryPolicy }) }),
    connector, unitOfWork: infrastructure.unitOfWork, audit: infrastructure.audit, clock: infrastructure.clock,
    eventCoordinator: infrastructure.eventCoordinator, dispatchEvidence: infrastructure.dispatchEvidence,
  });
  return { ...infrastructure, coordination };
}

test("F17-H actual process exit inside provider invocation leaves durable ambiguity and prevents restart resend", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-h-crash-"));
  const databasePath = join(directory, "publication.sqlite");
  const coordinated = request(context("actual-process-crash"));
  // Only the child exits. No provider network or production adapter is enabled.
  const childSource = `
    import { createProductionPublicationInfrastructure } from ${JSON.stringify(new URL("./publication-infrastructure.js", import.meta.url).href)};
    import { createTestPublicationAuthorizationConfiguration } from ${JSON.stringify(new URL("./publication-authorization-test-support.test.js", import.meta.url).href)};
    import { FixedClock } from ${JSON.stringify(new URL("./publication-clock.js", import.meta.url).href)};
    import { PublicationCoordinationService } from ${JSON.stringify(new URL("./publication-service.js", import.meta.url).href)};
    import { PublicationApplicationService } from ${JSON.stringify(new URL("./publication-application-service.js", import.meta.url).href)};
    import { CreatePublicationHandler, ModifyPublicationHandler } from ${JSON.stringify(new URL("./publication-command-handlers.js", import.meta.url).href)};
    const input = ${JSON.stringify(coordinated)};
    const effectiveApproval = { check: () => (${JSON.stringify(approvalDecision("approval-crash-test"))}) };
    const graph = createProductionPublicationInfrastructure({ databasePath: ${JSON.stringify(databasePath)}, configuration: { ...createTestPublicationAuthorizationConfiguration(new FixedClock(${JSON.stringify(timestamp)})), effectiveApprovalPort: effectiveApproval } });
    const service = new PublicationCoordinationService({
      application: new PublicationApplicationService(new CreatePublicationHandler(graph), new ModifyPublicationHandler(graph)), repository: graph.repository, effectiveApproval,
      executionEligibility: graph.executionEligibility, executionJournal: graph.unitOfWork.execution,
      connector: { dispatch: async () => {
        if ((await graph.unitOfWork.execution.recoveryDisposition(input.create.input.identity, input.attempt.commandId)).condition !== "RECONCILIATION_REQUIRED") process.exit(82);
        process.stdout.write("TEST_PROVIDER_INVOKED");
        process.exit(81);
      } },
      unitOfWork: graph.unitOfWork, audit: graph.audit, clock: graph.clock,
      eventCoordinator: graph.eventCoordinator, dispatchEvidence: graph.dispatchEvidence,
    });
    const created = await service.create({ context: input.context, command: input.create });
    if (!created.ok) throw new Error("Child creation failed");
    await service.publish({ context: input.context, identity: input.create.input.identity, command: input.create.input.command, attempt: input.attempt, expectedAggregateVersion: created.aggregateVersion });
    throw new Error("Expected process exit within provider");
  `;
  let graph: ReturnType<typeof durableProviderTestGraph> | undefined;
  try {
    const child = spawnSync(process.execPath, ["--input-type=module", "--eval", childSource], { encoding: "utf8", timeout: 20_000 });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 81, child.stderr);
    assert.equal(child.stdout, "TEST_PROVIDER_INVOKED");
    let calls = 0;
    graph = durableProviderTestGraph(databasePath, { dispatch: () => { calls++; return { outcome: "CONFIRMED", evidenceRefs: ["test:should-not-dispatch"], externalObjectReference: "test-object" }; } });
    assert.equal((await graph.repository.find(identity))?.lifecycleState, "EXECUTION_PENDING");
    assert.equal(await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId), undefined);
    assert.equal((await graph.unitOfWork.execution.recoveryDisposition(identity, coordinated.attempt.commandId)).condition, "RECONCILIATION_REQUIRED");
    const intent = await graph.unitOfWork.execution.findIntent(identity, coordinated.attempt.commandId);
    const priorAudit = await graph.audit.list(identity);
    const result = await graph.coordination.publish({ identity, context: coordinated.context, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: 1 });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
    assert.equal(calls, 0);
    assert.equal((await graph.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.deepEqual(await graph.unitOfWork.execution.findIntent(identity, coordinated.attempt.commandId), intent);
    assert.deepEqual((await graph.audit.list(identity)).slice(0, priorAudit.length), priorAudit);
    assert.equal((await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId))?.outcome, "UNKNOWN");
  } finally { await graph?.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F durable coordinated retry preserves both receipts and replays after restart without delivery", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-delivery-"));
  const databasePath = join(directory, "publication.sqlite");
  const policy: PublicationApprovedRetryPolicyResolver = { resolve: () => ({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "test-approved-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT"] }) };
  let calls = 0;
  const connector: PublicationConnectorDispatcher = { dispatch: () => { calls++; return calls === 1 ? { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] } : { outcome: "CONFIRMED", evidenceRefs: ["provider:confirmed"], externalObjectReference: "external-confirmed" }; } };
  let graph = durableProviderTestGraph(databasePath, connector, policy);
  try {
    const initial = request(context("durable-retry-initial"));
    assert.equal((await coordinate(graph, initial)).ok, false);
    const originalReceipt = await graph.unitOfWork.execution.findReceipt(identity, initial.attempt.commandId);
    await graph.unitOfWork.close();
    graph = durableProviderTestGraph(databasePath, connector, policy);
    const retry = request(context("durable-retry-next"));
    const input = { identity, context: retry.context, command: retry.create.input.command, attempt: { ...retry.attempt, id: "durable-attempt-next", commandId: "durable-command-next" }, expectedAggregateVersion: (await graph.repository.find(identity))!.aggregateVersion };
    assert.equal((await graph.coordination.publish(input)).ok, true);
    assert.equal(calls, 2);
    const completed = await graph.repository.find(identity);
    const receipt = await graph.unitOfWork.execution.findReceipt(identity, input.attempt.commandId);
    const evidence = await graph.audit.list(identity);
    assert.equal(receipt?.outcome, "CONFIRMED");
    assert.equal(completed?.attempts.length, 2);
    assert.equal(evidence.filter(record => record.command === "RETRY_DECISION").length, 2);
    await graph.unitOfWork.close();
    graph = durableProviderTestGraph(databasePath, connector, policy);
    assert.equal((await graph.coordination.publish(input)).ok, true);
    assert.equal(calls, 2);
    assert.deepEqual(await graph.repository.find(identity), completed);
    assert.deepEqual(await graph.audit.list(identity), evidence);
    assert.deepEqual(await graph.unitOfWork.execution.findReceipt(identity, input.attempt.commandId), receipt);
    assert.deepEqual(await graph.unitOfWork.execution.findReceipt(identity, initial.attempt.commandId), originalReceipt);
  } finally { await graph.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F concurrent durable dispatch claim never invokes provider after another claim started", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-claim-"));
  let calls = 0;
  const graph = durableProviderTestGraph(join(directory, "publication.sqlite"), { dispatch: () => { calls++; return { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] }; } });
  try {
    const journal = graph.unitOfWork.execution;
    const read = journal.recoveryDisposition.bind(journal);
    let claimed = false;
    Object.defineProperty(journal, "recoveryDisposition", { value: async (...args: Parameters<typeof read>) => {
      const prior = await read(...args);
      if (!claimed && prior.condition === "PRE_DISPATCH") {
        claimed = true;
        const other = await graph.unitOfWork.begin(identity);
        await other.execution.markDispatchStarted(identity, args[1], timestamp);
        await other.commit();
      }
      return prior;
    } });
    const result = await coordinate(graph, request(context("concurrent-claim")));
    assert.equal(result.ok, false);
    assert.equal(claimed, true);
    assert.equal(calls, 0);
    assert.equal((await graph.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal((await journal.findReceipt(identity, "command-initial-1"))?.outcome, "UNKNOWN");
  } finally { await graph.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-F concurrent suspension after retry eligibility prevents dispatch claim", async () => {
  const directory = mkdtempSync(join(tmpdir(), "f17-f-suspension-race-"));
  const databasePath = join(directory, "publication.sqlite");
  let calls = 0;
  const graph = durableProviderTestGraph(databasePath, { dispatch: () => { calls++; return { outcome: "REJECTED", evidenceRefs: ["provider:rejected"] }; } }, { resolve: () => ({ tenantScopeId: "team-a", targetId: "target-1", targetVersion: 5, channelId: "channel-1", channelPolicyVersion: "channel-policy-v3", reference: "approved-test-policy", maximumAttempts: 2, allowedOutcomes: ["NO_EFFECT"] }) });
  const other = new DurablePublicationUnitOfWork({ databasePath });
  try {
    assert.equal((await coordinate(graph, request(context("race-initial")))).ok, false);
    const begin = graph.unitOfWork.begin.bind(graph.unitOfWork);
    let suspended = false;
    Object.defineProperty(graph.unitOfWork, "begin", { value: async (...args: Parameters<typeof begin>) => {
      if (!suspended && (await graph.audit.list(identity)).filter(record => record.command === "RETRY_DECISION").length === 2) {
        suspended = true;
        const tx = await other.begin(identity);
        const current = (await tx.repository.find(identity))!;
        const updated = PublicationAggregate.rehydrate(current).setSuspension({ type: "SET_SUSPENSION", expectedAggregateVersion: current.aggregateVersion, suspensionStatus: "SUSPENDED_SECURITY", command: request(context("race-suspend")).create.input.command }).snapshot;
        await tx.repository.update(current.aggregateVersion, updated);
        await tx.commit();
      }
      return begin(...args);
    } });
    const retry = request(context("race-retry"));
    const input = { identity, context: retry.context, command: retry.create.input.command, attempt: { ...retry.attempt, id: "race-next-attempt", commandId: "race-next-command" }, expectedAggregateVersion: (await graph.repository.find(identity))!.aggregateVersion };
    assert.equal((await graph.coordination.publish(input)).ok, false);
    assert.equal(suspended, true);
    assert.equal(calls, 1);
    assert.equal((await graph.unitOfWork.execution.recoveryDisposition(identity, input.attempt.commandId)).condition, "PRE_DISPATCH");
    assert.equal(await graph.unitOfWork.execution.findReceipt(identity, input.attempt.commandId), undefined);
    assert.equal((await graph.repository.find(identity))?.suspensionStatus, "SUSPENDED_SECURITY");
  } finally { await other.close(); await graph.unitOfWork.close(); rmSync(directory, { recursive: true, force: true }); }
});

test("F17-E normalized provider outcomes and atomic evidence survive durable reopen without redispatch", async () => {
  for (const outcome of ["CONFIRMED", "REJECTED", "UNKNOWN"] as const) {
    const directory = mkdtempSync(join(tmpdir(), "ai-mls-f17-e-reopen-"));
    const databasePath = join(directory, "publication.sqlite");
    const adapter = new DeterministicPublicationConnectorTestAdapter(outcome);
    let calls = 0;
    const connector: PublicationConnectorDispatcher = { dispatch: (input) => { calls += 1; return adapter.dispatch(input); } };
    let graph = durableProviderTestGraph(databasePath, connector);
    try {
      const coordinated = request(context(`durable-provider-${outcome}`));
      const first = await coordinate(graph, coordinated);
      assert.equal(first.ok, outcome === "CONFIRMED");
      const priorReceipt = await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId);
      const priorAudit = await graph.audit.list(identity);
      const priorVersion = (await graph.repository.find(identity))?.aggregateVersion;
      assert.equal(priorReceipt?.outcome, outcome === "REJECTED" ? "NO_EFFECT" : outcome);
      assert.equal(priorAudit.length, outcome === "CONFIRMED" ? 4 : 3);
      assert.notEqual(await graph.idempotency.find({ ...identity, aggregateId: identity.publicationId, commandKey: `${coordinated.context.idempotencyKey}:activation` }), undefined);
      await graph.unitOfWork.close();
      graph = durableProviderTestGraph(databasePath, connector);
      assert.deepEqual(await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId), priorReceipt);
      assert.deepEqual(await graph.audit.list(identity), priorAudit);
      assert.equal((await graph.repository.find(identity))?.aggregateVersion, priorVersion);
      assert.equal((await graph.repository.find(identity))?.lifecycleState, outcome === "CONFIRMED" ? "ACTIVE" : outcome === "REJECTED" ? "READY" : "RECONCILIATION_REQUIRED");
      const replay = await coordinate(graph, coordinated);
      assert.equal(replay.ok, first.ok);
      assert.equal(calls, 1);
      assert.deepEqual(await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId), priorReceipt);
      assert.deepEqual(await graph.audit.list(identity), priorAudit);
    } finally {
      await graph.unitOfWork.close();
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

test("F17-E receipt commit failure after confirmed provider effect reopens ambiguous with zero resend", async () => {
  const directory = mkdtempSync(join(tmpdir(), "ai-mls-f17-e-receipt-failure-"));
  const databasePath = join(directory, "publication.sqlite");
  const adapter = new DeterministicPublicationConnectorTestAdapter("CONFIRMED");
  let calls = 0;
  const connector: PublicationConnectorDispatcher = { dispatch: (input) => { calls += 1; return adapter.dispatch(input); } };
  let graph = durableProviderTestGraph(databasePath, connector);
  try {
    const coordinated = request(context("durable-receipt-failure"));
    assert.equal((await graph.coordination.create({ context: coordinated.context, command: coordinated.create })).ok, true);
    const original = graph.eventCoordinator.appendAcceptedTransition.bind(graph.eventCoordinator);
    Object.defineProperty(graph.eventCoordinator, "appendAcceptedTransition", {
      value: (...args: Parameters<typeof original>) => {
        if (args[1]?.lifecycleState === "EXECUTION_PENDING") throw new Error("NON_SECRET_RECEIPT_FAILURE_FIXTURE");
        return original(...args);
      },
    });
    const publish = { context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: 1 };
    const failed = await graph.coordination.publish(publish);
    assert.equal(failed.ok, false);
    assert.equal(!failed.ok && failed.error.code, "CONNECTOR_OUTCOME_PERSISTENCE_FAILED");
    assert.equal(calls, 1);
    assert.equal(await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId), undefined);
    assert.equal((await graph.repository.find(identity))?.lifecycleState, "EXECUTION_PENDING");
    assert.equal(await graph.idempotency.find({ ...identity, aggregateId: identity.publicationId, commandKey: `${coordinated.context.idempotencyKey}:activation` }), undefined);
    await graph.unitOfWork.close();
    graph = durableProviderTestGraph(databasePath, connector);
    assert.equal((await graph.unitOfWork.execution.recoveryDisposition(identity, coordinated.attempt.commandId)).condition, "RECONCILIATION_REQUIRED");
    const recovered = await graph.coordination.publish(publish);
    assert.equal(recovered.ok, false);
    assert.equal(!recovered.ok && recovered.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
    assert.equal(calls, 1);
    assert.equal((await graph.repository.find(identity))?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.deepEqual((await graph.unitOfWork.execution.findReceipt(identity, coordinated.attempt.commandId))?.evidenceRefs, ["durable-execution:attempt-initial-1:outcome-unproven"]);
    assert.equal(JSON.stringify(await graph.audit.list(identity)).includes("NON_SECRET"), false);
  } finally {
    await graph.unitOfWork.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("F15-TASK-006 preserves failure audit when connector outcome persistence fails", async () => {
  const { infrastructure } = coordinationInfrastructure();
  const originalBegin = infrastructure.unitOfWork.begin.bind(infrastructure.unitOfWork);
  let beginCount = 0;
  Object.defineProperty(infrastructure.unitOfWork, "begin", {
    configurable: true,
    value: async (scope: typeof identity) => {
      beginCount += 1;
      const transaction = await originalBegin(scope);
      if (beginCount !== 4) return transaction;
      return {
        ...transaction,
        async commit(): Promise<never> {
          await transaction.rollback();
          throw new Error("simulated outcome commit failure");
        },
      };
    },
  });

  const result = await coordinate(infrastructure, request(context("outcome-persistence-failure")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_PERSISTENCE_FAILED");
  assert.equal((await infrastructure.repository.find(identity))?.lifecycleState, "EXECUTION_PENDING");
  assert.deepEqual((await infrastructure.audit.list(identity)).map(({ result: auditResult, failureReason }) => ({ auditResult, failureReason })), [
    { auditResult: "COMPLETED", failureReason: undefined },
    { auditResult: "COMPLETED", failureReason: undefined },
    { auditResult: "FAILED", failureReason: "CONNECTOR_OUTCOME_PERSISTENCE_FAILED:CONFIRMED" },
  ]);
});

test("F15-TASK-006 registers coordination and connector ports through Runtime and Composition", async () => {
  const graph = composePublicationApplication({
    runtimeOptions: {
      infrastructureConfiguration: {
        ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
        effectiveApprovalPort: { check: () => approvalDecision("approval-composed") },
        connectorDispatcher: { dispatch: () => Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["evidence-composed"]), externalObjectReference: "external-composed" }) },
      },
    },
  });

  assert.equal(graph.runtime.services.coordination instanceof Object, true);
  assert.equal(typeof graph.runtime.services.coordination.create, "function");
  assert.equal(typeof graph.runtime.services.coordination.publish, "function");
  assert.equal(typeof graph.runtime.services.connectorDispatcher.dispatch, "function");
  const coordinated = request(context("composed"));
  const created = await graph.runtime.execute({
    operation: "COORDINATE_CREATE_PUBLICATION",
    context: coordinated.context,
    command: coordinated.create,
  });
  assert.equal(created.operationResult, "SUCCEEDED");
  if (created.operationResult !== "SUCCEEDED") return;
  assert.equal((await graph.runtime.services.repository.find(identity))?.lifecycleState, "READY");
  const published = await graph.runtime.execute({
    operation: "COORDINATE_PUBLISH_PUBLICATION",
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.version,
  });
  assert.equal(published.operationResult, "SUCCEEDED");
  assert.equal((await graph.runtime.services.repository.find(identity))?.lifecycleState, "ACTIVE");
});

test("F15-TASK-006 Runtime rejects malformed coordination input before service mutation", async () => {
  const graph = composePublicationApplication({
    runtimeOptions: {
      infrastructureConfiguration: {
        ...createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp)),
        effectiveApprovalPort: { check: () => approvalDecision("approval-validation") },
        connectorDispatcher: { dispatch: () => Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["unexpected"]), externalObjectReference: "unexpected" }) },
      },
    },
  });
  const coordinated = request(context("invalid-outer-request"));
  const malformed = {
    operation: "COORDINATE_CREATE_PUBLICATION",
    context: coordinated.context,
    command: {
      ...coordinated.create,
      input: {
        ...coordinated.create.input,
        prerequisites: { ...coordinated.create.input.prerequisites, effectiveApproval: true },
      },
    },
  };

  const result = await graph.runtime.execute(malformed as never);

  assert.deepEqual(result, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.equal(await graph.runtime.services.repository.find(identity), undefined);
});
