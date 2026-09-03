import assert from "node:assert/strict";
import test from "node:test";

import type { PublicationExecutionContext, PublicationReconciliationRequest } from "./publication-application-contracts.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";
import { FixedClock } from "./publication-clock.js";
import type { PublicationBinding, PublicationIdentity, PublicationSnapshot } from "./publication-contracts.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { PublicationRecoveryExecutionPlanner } from "./publication-recovery-execution-planner.js";
import type { PublicationAuthorizedRecoveryCase, PublicationRecoveryAuthorizationReader, PublicationRecoveryCaseWriter } from "./publication-reconciliation-service.js";

const occurredAt = "2026-08-03T14:00:00.000Z";
const identity: PublicationIdentity = { publicationId: "publication-reconciliation-1", tenantScopeId: "team-a" };
const binding: PublicationBinding = {
  subjectId: "listing-1", subjectRevision: 3,
  representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5,
  channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
};
const correctionBinding: PublicationBinding = {
  ...binding,
  representationId: "representation-correction-1",
  representationVersion: 3,
  representationChecksum: "sha256:representation-correction-1-v3",
  approvalId: "approval-correction-1",
  approvalVersion: 1,
};

function execution(key: string, overrides: Partial<PublicationExecutionContext> = {}): PublicationExecutionContext {
  return {
    actorId: "forged-body-actor", sessionId: "executor-independent", correlationId: `correlation-${key}`,
    idempotencyKey: `idempotency-${key}`, intentFingerprint: `sha256:${key}`, ...overrides,
  };
}

function domain(key: string, reason = "Independent evidence-backed reconciliation") {
  return {
    actorId: "forged-command-actor", authorityContext: "PUBLICATION_EXECUTION",
    reason, correlationId: `correlation-${key}`, occurredAt,
  };
}

function infrastructure(options: {
  readonly approvalEffective?: boolean;
  readonly liveStatus?: "VERIFICATION_STALE" | "PERMISSION_STALE" | "SOD_CONFLICT" | "TARGET_INACTIVE" | "CHANNEL_INACTIVE";
  readonly authorizationReason?: "CAPABILITY_DENIED" | "REAUTHENTICATION_REQUIRED" | "REASON_REQUIRED";
  readonly onDispatch?: () => void;
  readonly connectorOutcome?: "CONFIRMED" | "REJECTED" | "UNKNOWN";
  readonly eventSourceVersion?: number;
  readonly recoveryAuthorizationReader?: PublicationRecoveryAuthorizationReader;
  readonly recoveryCaseWriter?: PublicationRecoveryCaseWriter;
} = {}) {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(occurredAt), "team-a", options.eventSourceVersion ?? 2);
  const recoveryCaseWriter = options.recoveryCaseWriter ?? (options.recoveryAuthorizationReader === undefined ? undefined : {
    createCase: () => Object.freeze({ recoveryCaseId: "test-child-recovery-case" }),
  });
  return createPublicationInfrastructure({
    ...base,
    ...(options.authorizationReason !== undefined ? {
      authorizationEvaluator: {
        evaluate: () => Object.freeze({
          effect: "DENY" as const, reasonCode: options.authorizationReason!, policyVersion: "test-authorization-v1",
          obligations: Object.freeze([]), assignmentIds: Object.freeze([]),
        }),
      },
    } : {}),
    ...(options.liveStatus === undefined ? {} : {
      liveContextResolver: {
        resolve(bindingInput: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[0], scope: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[1]) {
          const live = base.liveContextResolver!.resolve(bindingInput, scope);
          if (live === undefined) return undefined;
          if (options.liveStatus === "VERIFICATION_STALE") return { ...live, verification: { ...live.verification, status: "EXPIRED" as const } };
          if (options.liveStatus === "PERMISSION_STALE") return { ...live, permission: { ...live.permission, status: "REVOKED" as const } };
          if (options.liveStatus === "TARGET_INACTIVE") return { ...live, target: { ...live.target, status: "INACTIVE" as const } };
          if (options.liveStatus === "CHANNEL_INACTIVE") return { ...live, target: { ...live.target, channelStatus: "INACTIVE" as const } };
          return { ...live, approval: { ...live.approval, requesterActorId: "executor-independent" } };
        },
      },
    }),
    effectiveApprovalPort: {
      check(input) {
        return options.approvalEffective === false
          ? Object.freeze({ effective: false as const })
          : Object.freeze({
            effective: true as const, decisionReference: `decision:${input.approvalId}:${String(input.approvalVersion)}`,
            approvalId: input.approvalId, approvalVersion: input.approvalVersion, checkedAt: occurredAt,
            effectiveScope: Object.freeze({ targetId: input.targetId, channelId: input.channelId }),
            reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
          });
      },
    },
    ...(options.onDispatch === undefined ? {} : {
      connectorDispatcher: {
        dispatch: () => {
          options.onDispatch!();
          const outcome = options.connectorOutcome ?? "UNKNOWN";
          return Object.freeze({ outcome, evidenceRefs: Object.freeze(["recovery-provider-evidence"]), ...(outcome === "CONFIRMED" ? { externalObjectReference: "external-recovery-listing" } : {}) });
        },
      },
    }),
    ...(options.recoveryAuthorizationReader === undefined ? {} : { recoveryAuthorizationReader: options.recoveryAuthorizationReader }),
    ...(recoveryCaseWriter === undefined ? {} : { recoveryCaseWriter }),
  });
}

function authorizedRecoveryCase(caseId: string, attemptId: string, commandId: string, overrides: Partial<PublicationAuthorizedRecoveryCase> = {}): PublicationAuthorizedRecoveryCase {
  return Object.freeze({
    recoveryCaseId: `recovery-${caseId}`,
    resourceType: "Publication",
    resourceId: identity.publicationId,
    tenantId: identity.tenantScopeId,
    scopeRef: identity.tenantScopeId,
    status: "RESOLVED",
    version: 3,
    createdBy: "evidence-submitter-independent",
    finding: Object.freeze({ finding: "CONFIRMED_NOT_EXECUTED", decidedBy: "resolver-independent" }),
    disposition: Object.freeze({ recoveryId: `recovery-id-${caseId}`, recoveryDisposition: "RECOVERY_AUTHORIZED", recoveryActionType: "PUBLICATION_RECOVERY", decidedBy: "authorizer-independent" }),
    recovery: Object.freeze({ recoveryId: `recovery-id-${caseId}`, recoveryCaseId: `recovery-${caseId}`, originalOriginIdentity: Object.freeze({ reconciliationCaseId: caseId, attemptId: `attempt-${caseId}` }), decisionVersion: 2, recoveryActionType: "PUBLICATION_RECOVERY", recoveryExecutionIdentity: Object.freeze({ attemptId, commandId }), evidenceRefs: Object.freeze(["evidence:authorization:recovery"]), authorizedBy: "authorizer-independent" }),
    ...overrides,
  });
}

function resolvedInitialNoEffect(caseId: string): PublicationSnapshot {
  const unknown = initialUnknown(caseId);
  return PublicationAggregate.rehydrate(unknown).resolveReconciliation({
    type: "RESOLVE_RECONCILIATION",
    expectedAggregateVersion: unknown.aggregateVersion,
    caseId,
    resolution: "INITIAL_NO_EFFECT",
    evidenceRefs: ["trusted-no-effect-evidence"],
    command: domain(`resolve-${caseId}`),
  }).snapshot;
}

function initialUnknown(caseId: string): PublicationSnapshot {
  const created = PublicationAggregate.create({
    identity, binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain(`seed-${caseId}`),
  });
  const pending = created.beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: created.snapshot.aggregateVersion,
    attempt: { id: `attempt-${caseId}`, commandId: `command-${caseId}`, operation: "INITIAL_PUBLISH", occurredAt, evidenceRefs: [] },
    command: domain(`begin-${caseId}`),
  });
  return pending.resolveExecution({
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: pending.snapshot.aggregateVersion,
    outcome: "UNKNOWN", evidenceRefs: [`observation-${caseId}`], reconciliationCaseId: caseId,
    command: domain(`unknown-${caseId}`),
  }).snapshot;
}

function activeCorrectionUnknown(caseId: string): PublicationSnapshot {
  const created = PublicationAggregate.create({
    identity, binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS", command: domain(`seed-${caseId}`),
  });
  const pending = created.beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION", expectedAggregateVersion: created.snapshot.aggregateVersion,
    attempt: { id: `attempt-initial-${caseId}`, commandId: `command-initial-${caseId}`, operation: "INITIAL_PUBLISH", occurredAt, evidenceRefs: [] },
    command: domain(`begin-${caseId}`),
  });
  const active = pending.resolveExecution({
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: pending.snapshot.aggregateVersion,
    outcome: "EFFECT_CONFIRMED", evidenceRefs: [`confirmed-${caseId}`], externalObjectReference: "external-listing-1",
    command: domain(`active-${caseId}`),
  });
  const correction = active.beginActiveOperation({
    type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: active.snapshot.aggregateVersion,
    operation: "CORRECTION", materiality: "NON_MATERIAL", nextBinding: correctionBinding,
    attempt: { id: `attempt-correction-${caseId}`, commandId: `command-correction-${caseId}`, operation: "CORRECTION", occurredAt, evidenceRefs: [] },
    command: domain(`correct-${caseId}`),
  });
  return correction.resolveExecution({
    type: "RESOLVE_EXECUTION", expectedAggregateVersion: correction.snapshot.aggregateVersion,
    outcome: "UNKNOWN", evidenceRefs: [`observation-${caseId}`], reconciliationCaseId: caseId,
    command: domain(`unknown-${caseId}`),
  }).snapshot;
}

function request(
  snapshot: PublicationSnapshot,
  key: string,
  overrides: Partial<PublicationReconciliationRequest> = {},
): PublicationReconciliationRequest {
  return {
    context: execution(key), identity,
    input: {
      expectedAggregateVersion: snapshot.aggregateVersion,
      caseId: snapshot.reconciliationCases.at(-1)!.id,
      category: "CONFIRMED_SUCCESS",
      resolution: "EFFECT_CONFIRMED",
      evidenceRefs: [`evidence-${key}`],
      externalObjectReference: "external-listing-1",
      command: domain(key),
    },
    ...overrides,
  };
}

test("F15-TASK-008 resolves unknown execution to confirmed success with immutable recovery evidence", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-confirmed");
  app.repository.save(snapshot);

  const result = app.reconciliation.reconcile(request(snapshot, "confirmed"));

  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.decision, "CONFIRMED");
  const persisted = app.repository.find(identity)!;
  assert.equal(persisted.lifecycleState, "ACTIVE");
  assert.equal(persisted.reconciliationCases.at(-1)?.status, "RESOLVED");
  assert.equal(app.audit.list(identity).at(-1)?.decision, "CONFIRMED");
  assert.equal(app.audit.list(identity).at(-1)?.reason, "Independent evidence-backed reconciliation");
  assert.equal(app.audit.list(identity).at(-1)?.actorId, "executor-independent");
  assert.equal(app.audit.list(identity).at(-1)?.correlationId, "correlation-confirmed");
  assert.equal(app.audit.list(identity).at(-1)?.checkedAt, occurredAt);
  assert.deepEqual(app.eventJournal.listByAggregate(identity.tenantScopeId, identity.publicationId).map((event) => event.eventType), ["EVT-006", "EVT-003"]);
});

test("F15-TASK-008 resolves unknown correction to the prior active state without redispatch", () => {
  let dispatchCount = 0;
  const app = infrastructure({ onDispatch: () => { dispatchCount += 1; }, eventSourceVersion: 3 });
  const snapshot = activeCorrectionUnknown("case-recovered");
  app.repository.save(snapshot);
  const recovery = request(snapshot, "recovered", { input: {
    expectedAggregateVersion: snapshot.aggregateVersion, caseId: "case-recovered", category: "CONFIRMED_FAILURE",
    resolution: "ACTIVE_ORIGIN_NO_EFFECT", evidenceRefs: ["negative-evidence"], command: domain("recovered"),
  } });

  const result = app.reconciliation.reconcile(recovery);

  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.decision, "RECOVERED");
  assert.equal(app.repository.find(identity)?.lifecycleState, "ACTIVE");
  assert.equal(app.repository.find(identity)?.attempts.at(-1)?.outcome, "UNKNOWN");
  assert.equal(dispatchCount, 0);
});

test("F19-C RECOVER_PUBLICATION fails closed without a durable F19 recovery authorization and does not resolve the case", () => {
  let dispatchCount = 0;
  const app = infrastructure({ onDispatch: () => { dispatchCount += 1; } });
  const snapshot = initialUnknown("case-recovery-authorization-required");
  app.repository.save(snapshot);
  const action = request(snapshot, "recovery-authorization-required", { input: {
    expectedAggregateVersion: snapshot.aggregateVersion,
    caseId: "case-recovery-authorization-required",
    category: "CONFIRMED_FAILURE",
    resolution: "INITIAL_NO_EFFECT",
    evidenceRefs: ["trusted-negative-evidence"],
    command: domain("recovery-authorization-required"),
  } });

  const result = app.reconciliation.recover(action);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "RECOVERY_AUTHORIZATION_REQUIRED");
  assert.equal(app.repository.find(identity)?.aggregateVersion, snapshot.aggregateVersion);
  assert.equal(app.repository.find(identity)?.reconciliationCases.at(-1)?.status, "OPEN");
  assert.equal(app.audit.list(identity).length, 0);
  assert.equal(dispatchCount, 0);
});

test("F19-C RECOVER_PUBLICATION consumes the durable new identity and executes through F17 without rewriting original history", () => {
  const caseId = "case-authorized-recovery";
  const unknown = initialUnknown(caseId);
  const planner = new PublicationRecoveryExecutionPlanner();
  const planned = planner.plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  const authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  let dispatchCount = 0;
  const app = infrastructure({
    recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized },
    connectorOutcome: "CONFIRMED",
    onDispatch: () => { dispatchCount += 1; },
  });
  app.repository.save(unknown);
  const resolved = app.reconciliation.reconcile(request(unknown, "resolve-before-authorized-recovery", { input: {
    expectedAggregateVersion: unknown.aggregateVersion,
    caseId,
    category: "CONFIRMED_FAILURE",
    resolution: "INITIAL_NO_EFFECT",
    evidenceRefs: ["trusted-no-effect-evidence"],
    command: domain("resolve-before-authorized-recovery"),
  } }));
  assert.equal(resolved.ok, true, JSON.stringify(resolved));
  const beforeRecovery = app.repository.find(identity)!;
  assert.equal(beforeRecovery.lifecycleState, "READY");

  const result = app.reconciliation.recover(request(beforeRecovery, "execute-authorized-recovery", { input: {
    expectedAggregateVersion: beforeRecovery.aggregateVersion,
    caseId,
    category: "CONFIRMED_FAILURE",
    evidenceRefs: ["caller-evidence-must-not-authorize"],
    command: domain("execute-authorized-recovery"),
  } }));

  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.decision, "RECOVERED");
  const persisted = app.repository.find(identity)!;
  assert.equal(persisted.lifecycleState, "ACTIVE");
  assert.equal(persisted.attempts[0]?.id, `attempt-${caseId}`);
  assert.equal(persisted.attempts[0]?.outcome, "UNKNOWN");
  assert.equal(persisted.attempts.at(-1)?.id, planned.attemptId);
  assert.equal(persisted.attempts.at(-1)?.commandId, planned.commandId);
  assert.equal(persisted.attempts.at(-1)?.outcome, "CONFIRMED");
  assert.equal(dispatchCount, 1);
});

test("F19-C RECOVER_PUBLICATION rejects invalid durable bindings with zero provider call and zero mutation", () => {
  const caseId = "case-invalid-binding";
  const snapshot = resolvedInitialNoEffect(caseId);
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  const valid = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  const invalidBindings: readonly [string, PublicationAuthorizedRecoveryCase][] = [
    ["unresolved finding", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { finding: { finding: "UNRESOLVED", decidedBy: "resolver-independent" } })],
    ["confirmed executed", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { finding: { finding: "CONFIRMED_EXECUTED", decidedBy: "resolver-independent" } })],
    ["no recovery required", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { disposition: { ...valid.disposition!, recoveryDisposition: "NO_RECOVERY_REQUIRED" } })],
    ["recovery rejected", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { disposition: { ...valid.disposition!, recoveryDisposition: "RECOVERY_REJECTED" } })],
    ["wrong action type", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { disposition: { ...valid.disposition!, recoveryActionType: "CONNECTOR_REEXECUTION" } })],
    ["stale authorization version", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { version: 4 })],
    ["original attempt reused", authorizedRecoveryCase(caseId, `attempt-${caseId}`, planned.commandId)],
    ["original command reused", authorizedRecoveryCase(caseId, planned.attemptId, `command-${caseId}`)],
    ["wrong Publication", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { resourceId: "publication-other" })],
    ["wrong tenant", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { tenantId: "tenant-other" })],
    ["wrong scope", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { scopeRef: "team-other" })],
    ["resolver is executor", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { finding: { finding: "CONFIRMED_NOT_EXECUTED", decidedBy: "executor-independent" } })],
    ["authorizer is executor", authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, { recovery: { ...valid.recovery!, authorizedBy: "executor-independent" } })],
  ];

  for (const [label, candidate] of invalidBindings) {
    let dispatchCount = 0;
    const app = infrastructure({ recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => candidate }, connectorOutcome: "CONFIRMED", onDispatch: () => { dispatchCount += 1; } });
    app.repository.save(snapshot);
    const result = app.reconciliation.recover(request(snapshot, `invalid-binding-${label}`, { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain(`invalid-binding-${label}`) } }));
    assert.equal(result.ok, false, `${label}: ${JSON.stringify(result)}`);
    if (!result.ok) assert.equal(result.error.code, "RECOVERY_AUTHORIZATION_INVALID", label);
    assert.deepEqual(app.repository.find(identity), snapshot, label);
    assert.equal(dispatchCount, 0, label);
  }
});

test("F19-C RECOVER_PUBLICATION revalidates live authority, MFA, SoD, approval and verification before provider execution", () => {
  const cases = [
    [{ authorizationReason: "CAPABILITY_DENIED" as const }, "AUTHORIZATION_DENIED"],
    [{ authorizationReason: "REAUTHENTICATION_REQUIRED" as const }, "MFA_REQUIRED"],
    [{ liveStatus: "SOD_CONFLICT" as const }, "SEPARATION_OF_DUTIES_DENIED"],
    [{ approvalEffective: false }, "APPROVAL_NOT_EFFECTIVE"],
    [{ liveStatus: "VERIFICATION_STALE" as const }, "VERIFICATION_NOT_EFFECTIVE"],
    [{ liveStatus: "PERMISSION_STALE" as const }, "PERMISSION_NOT_EFFECTIVE"],
    [{ liveStatus: "TARGET_INACTIVE" as const }, "BINDING_MISMATCH"],
    [{ liveStatus: "CHANNEL_INACTIVE" as const }, "BINDING_MISMATCH"],
  ] as const;

  for (const [restriction, expectedCode] of cases) {
    const caseId = `case-live-${expectedCode.toLowerCase()}`;
    const snapshot = resolvedInitialNoEffect(caseId);
    const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
    const authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
    let dispatchCount = 0;
    const app = infrastructure({ ...restriction, recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized }, connectorOutcome: "CONFIRMED", onDispatch: () => { dispatchCount += 1; } });
    app.repository.save(snapshot);

    const result = app.reconciliation.recover(request(snapshot, `live-${expectedCode}`, { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain(`live-${expectedCode}`) } }));

    assert.equal(result.ok, false, `${expectedCode}: ${JSON.stringify(result)}`);
    if (!result.ok) assert.equal(result.error.code, expectedCode);
    assert.deepEqual(app.repository.find(identity), snapshot);
    assert.equal(dispatchCount, 0);
  }
});

test("F19-C RECOVER_PUBLICATION fails closed while the current Publication is suspended", () => {
  const caseId = "case-suspended-recovery";
  const base = resolvedInitialNoEffect(caseId);
  const snapshot: PublicationSnapshot = Object.freeze({ ...base, suspensionStatus: "SUSPENDED_SECURITY" });
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  const authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  let dispatchCount = 0;
  const app = infrastructure({ recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized }, connectorOutcome: "CONFIRMED", onDispatch: () => { dispatchCount += 1; } });
  app.repository.save(snapshot);

  const result = app.reconciliation.recover(request(snapshot, "suspended-recovery", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("suspended-recovery") } }));

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "PUBLICATION_STATE_INVALID");
  assert.deepEqual(app.repository.find(identity), snapshot);
  assert.equal(dispatchCount, 0);
});

test("F19-C exact recovery replay returns the prior F17 result without a second provider invocation", () => {
  const caseId = "case-exact-recovery-replay";
  const snapshot = resolvedInitialNoEffect(caseId);
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  let authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  let dispatchCount = 0;
  const app = infrastructure({ recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized }, connectorOutcome: "CONFIRMED", onDispatch: () => { dispatchCount += 1; } });
  app.repository.save(snapshot);
  const action = request(snapshot, "exact-recovery-replay", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("exact-recovery-replay") } });

  const first = app.reconciliation.recover(action);
  authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId, {
    recovery: { ...authorized.recovery!, recoveryExecutionIdentity: Object.freeze({ commandId: planned.commandId, attemptId: planned.attemptId }) },
  });
  const replay = app.reconciliation.recover(action);

  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(replay.ok, true, JSON.stringify(replay));
  if (first.ok && replay.ok) {
    assert.equal(replay.replayed, true);
    assert.equal(replay.resultReference, first.resultReference);
    assert.equal(replay.aggregateVersion, first.aggregateVersion);
  }
  assert.equal(dispatchCount, 1);
  assert.equal(app.repository.find(identity)?.attempts.length, 2);
});

test("F19-C conflicting identity for the same recoveryId is rejected without mutation or provider reinvocation", () => {
  const caseId = "case-recovery-identity-conflict";
  const snapshot = resolvedInitialNoEffect(caseId);
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  let candidate = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  let dispatchCount = 0;
  const app = infrastructure({ recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => candidate }, connectorOutcome: "CONFIRMED", onDispatch: () => { dispatchCount += 1; } });
  app.repository.save(snapshot);
  const action = request(snapshot, "recovery-identity-conflict", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("recovery-identity-conflict") } });
  const first = app.reconciliation.recover(action);
  assert.equal(first.ok, true, JSON.stringify(first));
  const priorRecord = app.idempotency.find({ tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId, commandKey: `${candidate.recovery!.recoveryId}:publish` });
  assert.notEqual(priorRecord, undefined);
  const committed = app.repository.find(identity)!;
  candidate = authorizedRecoveryCase(caseId, "attempt-conflicting-recovery", "command-conflicting-recovery");

  const conflict = app.reconciliation.recover(action);

  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(dispatchCount, 1);
  assert.deepEqual(app.repository.find(identity), committed);
});

test("F19-C UNKNOWN recovery creates one child recovery case and exact replay never resends or duplicates lineage", () => {
  const caseId = "case-nested-recovery-ambiguity";
  const snapshot = resolvedInitialNoEffect(caseId);
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  const authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  const created: Parameters<PublicationRecoveryCaseWriter["createCase"]>[0][] = [];
  let dispatchCount = 0;
  const app = infrastructure({
    recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized },
    recoveryCaseWriter: { createCase(input) {
      if (created.length > 0) throw Object.assign(new Error("child recovery already exists"), { code: "DUPLICATE_ORIGIN" });
      created.push(input);
      return Object.freeze({ recoveryCaseId: "child-recovery-case" });
    } },
    connectorOutcome: "UNKNOWN",
    onDispatch: () => { dispatchCount += 1; },
  });
  app.repository.save(snapshot);
  const action = request(snapshot, "nested-recovery-ambiguity", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("nested-recovery-ambiguity") } });

  const first = app.reconciliation.recover(action);
  const replay = app.reconciliation.recover(action);

  assert.equal(first.ok, false);
  assert.equal(replay.ok, false);
  if (!first.ok) assert.equal(first.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  if (!replay.ok) assert.equal(replay.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal(dispatchCount, 1);
  assert.equal(created.length, 1);
  assert.deepEqual(created[0], {
    resourceType: "Publication",
    resourceId: identity.publicationId,
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: `${identity.publicationId}:reconciliation:${planned.attemptId}`, attemptId: planned.attemptId },
    tenantId: identity.tenantScopeId,
    scopeRef: identity.tenantScopeId,
    parentRecoveryCaseId: authorized.recoveryCaseId,
    evidenceRefs: ["evidence:authorization:recovery", "recovery-provider-evidence"],
    createdBy: "executor-independent",
    createdAt: occurredAt,
  });
  assert.equal(app.repository.find(identity)?.attempts.find(({ id }) => id === planned.attemptId)?.outcome, "UNKNOWN");
});

test("F19-C retries UNKNOWN recovery child linkage after its writer fails without redispatching or mutating existing history", () => {
  const caseId = "case-nested-recovery-writer-retry";
  const snapshot = resolvedInitialNoEffect(caseId);
  const planned = new PublicationRecoveryExecutionPlanner().plan({ identity, recoveryCaseId: `recovery-${caseId}`, reconciliationCaseId: caseId, originalAttemptId: `attempt-${caseId}`, originalCommandId: `command-${caseId}` });
  const authorized = authorizedRecoveryCase(caseId, planned.attemptId, planned.commandId);
  const created: Parameters<PublicationRecoveryCaseWriter["createCase"]>[0][] = [];
  let writerCalls = 0;
  let dispatchCount = 0;
  const app = infrastructure({
    recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => authorized },
    recoveryCaseWriter: { createCase(input) {
      writerCalls += 1;
      if (writerCalls === 1) throw new Error("child recovery persistence unavailable");
      created.push(input);
      return Object.freeze({ recoveryCaseId: "child-recovery-case" });
    } },
    connectorOutcome: "UNKNOWN",
    onDispatch: () => { dispatchCount += 1; },
  });
  app.repository.save(snapshot);
  const action = request(snapshot, "nested-recovery-writer-retry", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("nested-recovery-writer-retry") } });

  const first = app.reconciliation.recover(action);
  const historyAfterWriterFailure = app.repository.find(identity)!;
  const retry = app.reconciliation.recover(action);

  assert.equal(first.ok, false);
  if (!first.ok) assert.equal(first.error.code, "APPLICATION_EXECUTION_FAILED");
  assert.equal(retry.ok, false);
  if (!retry.ok) assert.equal(retry.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal(dispatchCount, 1);
  assert.equal(writerCalls, 2);
  assert.equal(created.length, 1);
  assert.deepEqual(app.repository.find(identity), historyAfterWriterFailure);
  assert.equal(historyAfterWriterFailure.attempts.filter(({ id }) => id === planned.attemptId).length, 1);
  assert.equal(historyAfterWriterFailure.reconciliationCases.filter(({ attemptId }) => attemptId === planned.attemptId).length, 1);
  assert.deepEqual(created[0], {
    resourceType: "Publication",
    resourceId: identity.publicationId,
    originDomain: "PUBLICATION",
    originIdentity: { reconciliationCaseId: `${identity.publicationId}:reconciliation:${planned.attemptId}`, attemptId: planned.attemptId },
    tenantId: identity.tenantScopeId,
    scopeRef: identity.tenantScopeId,
    parentRecoveryCaseId: authorized.recoveryCaseId,
    evidenceRefs: ["evidence:authorization:recovery", "recovery-provider-evidence"],
    createdBy: "executor-independent",
    createdAt: occurredAt,
  });
});

test("F19-C recovery handoff rejects a durable Publication identity not created by its trusted planner", () => {
  const caseId = "case-forged-durable-recovery-identity";
  const snapshot = resolvedInitialNoEffect(caseId);
  const forged = authorizedRecoveryCase(caseId, "caller-authored-attempt", "caller-authored-command");
  let dispatchCount = 0;
  const app = infrastructure({
    recoveryAuthorizationReader: { findAuthorizedPublicationRecovery: () => forged },
    connectorOutcome: "CONFIRMED",
    onDispatch: () => { dispatchCount += 1; },
  });
  app.repository.save(snapshot);
  const action = request(snapshot, "forged-durable-recovery-identity", { input: { expectedAggregateVersion: snapshot.aggregateVersion, caseId, category: "CONFIRMED_FAILURE", evidenceRefs: ["caller-evidence"], command: domain("forged-durable-recovery-identity") } });

  const result = app.reconciliation.recover(action);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "RECOVERY_AUTHORIZATION_INVALID");
  assert.equal(dispatchCount, 0);
  assert.deepEqual(app.repository.find(identity), snapshot);
});

test("F15-TASK-008 completes a partial outcome only with an explicit canonical resolution", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-partial");
  app.repository.save(snapshot);
  const partial = request(snapshot, "partial", { input: {
    expectedAggregateVersion: snapshot.aggregateVersion, caseId: "case-partial", category: "PARTIAL_COMPLETION",
    resolution: "EFFECT_CONFIRMED", evidenceRefs: ["partial-evidence", "completion-evidence"],
    externalObjectReference: "external-listing-partial", command: domain("partial"),
  } });

  const result = app.reconciliation.reconcile(partial);

  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.decision, "CONFIRMED");
  assert.equal(app.repository.find(identity)?.lifecycleState, "ACTIVE");
});

test("F15-TASK-008 returns no action for an already resolved case and preserves the version", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-no-action");
  app.repository.save(snapshot);
  const first = app.reconciliation.reconcile(request(snapshot, "no-action-first"));
  assert.equal(first.ok, true);
  const resolved = app.repository.find(identity)!;

  const result = app.reconciliation.reconcile(request(resolved, "no-action-second", { input: {
    expectedAggregateVersion: resolved.aggregateVersion, caseId: "case-no-action", category: "CONFIRMED_SUCCESS",
    resolution: "EFFECT_CONFIRMED", evidenceRefs: ["duplicate-confirmation"], externalObjectReference: "external-listing-1",
    command: domain("no-action-second"),
  } }));

  assert.equal(result.ok, true, JSON.stringify(result));
  if (result.ok) assert.equal(result.decision, "NO_ACTION_REQUIRED");
  assert.equal(app.repository.find(identity)?.aggregateVersion, resolved.aggregateVersion);
  assert.equal(app.audit.list(identity).at(-1)?.decision, "NO_ACTION_REQUIRED");
});

test("F15-TASK-008 contains unknown, timeout and unresolved partial outcomes for manual review", () => {
  for (const category of ["UNKNOWN", "EXTERNAL_TIMEOUT", "MANUAL_REVIEW_REQUIRED", "PARTIAL_COMPLETION"] as const) {
    const app = infrastructure();
    const caseId = `case-${category.toLowerCase()}`;
    const snapshot = initialUnknown(caseId);
    app.repository.save(snapshot);
    const key = `manual-${category.toLowerCase()}`;
    const manual = request(snapshot, key, { input: {
      expectedAggregateVersion: snapshot.aggregateVersion, caseId, category,
      evidenceRefs: [`evidence-${category.toLowerCase()}`], command: domain(key),
    } });

    const result = app.reconciliation.reconcile(manual);

    assert.equal(result.ok, true, `${category}: ${JSON.stringify(result)}`);
    if (result.ok) assert.equal(result.decision, "MANUAL_REVIEW_REQUIRED");
    assert.equal(app.repository.find(identity)?.aggregateVersion, snapshot.aggregateVersion);
    assert.equal(app.repository.find(identity)?.lifecycleState, "RECONCILIATION_REQUIRED");
    assert.equal(app.audit.list(identity).at(-1)?.decision, "MANUAL_REVIEW_REQUIRED");
    assert.deepEqual(app.audit.list(identity).at(-1)?.evidenceRefs, [`evidence-${category.toLowerCase()}`]);
  }
});

test("F15-TASK-008 preserves idempotency, optimistic versioning and append-only recovery audit", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-idempotent");
  app.repository.save(snapshot);
  const action = request(snapshot, "idempotent");

  const first = app.reconciliation.reconcile(action);
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("reconciliation setup failed");
  const resolved = app.repository.find(identity)!;
  const advanced = PublicationAggregate.rehydrate(resolved).setSuspension({
    type: "SET_SUSPENSION",
    expectedAggregateVersion: resolved.aggregateVersion,
    suspensionStatus: "SUSPENDED_OPERATIONAL",
    command: domain("advance-after-reconciliation"),
  }).snapshot;
  app.repository.update(resolved.aggregateVersion, advanced);
  const replay = app.reconciliation.reconcile(action);

  assert.equal(replay.ok, true);
  if (replay.ok) {
    assert.equal(replay.replayed, true);
    assert.equal(replay.aggregateVersion, first.aggregateVersion);
    assert.equal(replay.resultReference, first.resultReference);
  }
  assert.equal(app.repository.readHistory(identity).length, 3);
  assert.equal(app.audit.list(identity).filter(({ decision }) => decision === "CONFIRMED").length, 1);

  const conflict = app.reconciliation.reconcile({
    ...action,
    context: { ...action.context, intentFingerprint: "sha256:different-idempotent-intent" },
    input: { ...action.input, evidenceRefs: ["different-evidence"] },
  });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");

  const stale = app.reconciliation.reconcile(request(app.repository.find(identity)!, "stale", { input: {
    ...action.input, expectedAggregateVersion: snapshot.aggregateVersion, command: domain("stale"),
  } }));
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "PUBLICATION_VERSION_CONFLICT");
});

test("F15-TASK-008 rejects an idempotency collision with a different completed command", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-command-collision");
  app.repository.save(snapshot);
  const action = request(snapshot, "command-collision");
  app.audit.append({
    id: JSON.stringify([
      identity.tenantScopeId,
      identity.publicationId,
      action.context.correlationId,
      action.context.idempotencyKey,
      "SET_SUSPENSION",
      action.context.intentFingerprint,
      "completed",
    ]),
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    command: "SET_SUSPENSION",
    actorId: "executor-independent",
    timestamp: occurredAt,
    version: snapshot.aggregateVersion,
    result: "COMPLETED",
  });

  const result = app.reconciliation.reconcile(action);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(app.repository.find(identity)?.aggregateVersion, snapshot.aggregateVersion);
});

test("F15-TASK-008 fails closed for authorization, live prerequisites and invalid recovery requests", () => {
  const cases = [
    [infrastructure({ authorizationReason: "CAPABILITY_DENIED" }), "AUTHORIZATION_DENIED", {}],
    [infrastructure({ authorizationReason: "REAUTHENTICATION_REQUIRED" }), "MFA_REQUIRED", {}],
    [infrastructure({ authorizationReason: "REASON_REQUIRED" }), "REASON_REQUIRED", {}],
    [infrastructure({ liveStatus: "SOD_CONFLICT" }), "SEPARATION_OF_DUTIES_DENIED", {}],
    [infrastructure({ approvalEffective: false }), "APPROVAL_NOT_EFFECTIVE", {}],
    [infrastructure({ liveStatus: "VERIFICATION_STALE" }), "VERIFICATION_NOT_EFFECTIVE", {}],
    [infrastructure({ liveStatus: "PERMISSION_STALE" }), "PERMISSION_NOT_EFFECTIVE", {}],
    [infrastructure(), "AUTHENTICATION_REQUIRED", { sessionId: undefined }],
    [infrastructure(), "PURPOSE_SCOPE_DENIED", { authorityContext: "UNAPPROVED_PURPOSE" }],
  ] as const;
  for (const [app, expected, requestOverride] of cases) {
    const snapshot = initialUnknown(`case-${expected.toLowerCase()}`);
    app.repository.save(snapshot);
    const key = expected.toLowerCase();
    const baseRequest = request(snapshot, key);
    const requestContext = "sessionId" in requestOverride
      ? {
        actorId: baseRequest.context.actorId,
        correlationId: baseRequest.context.correlationId,
        idempotencyKey: baseRequest.context.idempotencyKey,
        intentFingerprint: baseRequest.context.intentFingerprint,
      }
      : baseRequest.context;
    const result = app.reconciliation.reconcile({
      ...baseRequest,
      context: requestContext,
      input: {
        ...baseRequest.input,
        command: { ...baseRequest.input.command, ...("authorityContext" in requestOverride ? { authorityContext: requestOverride.authorityContext } : {}) },
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, expected);
    assert.equal(app.repository.find(identity)?.aggregateVersion, snapshot.aggregateVersion);
    assert.equal(app.audit.list(identity).some(({ result: outcome }) => outcome === "COMPLETED"), false);
  }

  const app = infrastructure();
  const snapshot = initialUnknown("case-invalid");
  app.repository.save(snapshot);
  const invalid = app.reconciliation.reconcile(request(snapshot, "invalid", { input: {
    expectedAggregateVersion: snapshot.aggregateVersion, caseId: "case-invalid", category: "CONFIRMED_SUCCESS",
    evidenceRefs: ["evidence-without-resolution"], command: domain("invalid"),
  } }));
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "RECOVERY_REQUEST_INVALID");
  assert.equal(app.repository.find(identity)?.aggregateVersion, snapshot.aggregateVersion);

  const valid = app.reconciliation.reconcile(request(snapshot, "resolve-before-bogus"));
  assert.equal(valid.ok, true);
  const resolved = app.repository.find(identity)!;
  const bogus = app.reconciliation.reconcile({
    ...request(resolved, "bogus-resolved-case"),
    input: {
      expectedAggregateVersion: resolved.aggregateVersion,
      caseId: "case-invalid",
      category: "PARTIAL_COMPLETION",
      resolution: "BOGUS_RESOLUTION",
      evidenceRefs: ["bogus-evidence"],
      command: domain("bogus-resolved-case"),
    },
  } as unknown as PublicationReconciliationRequest);
  assert.equal(bogus.ok, false);
  if (!bogus.ok) assert.equal(bogus.error.code, "RECOVERY_REQUEST_INVALID");
});

test("F15-TASK-008 is registered once as a trusted internal port and caller evidence is rejected at the outer boundary", () => {
  const app = infrastructure();
  const snapshot = initialUnknown("case-composed");
  app.repository.save(snapshot);
  const graph = composePublicationApplication({ runtimeOptions: { infrastructureFactory: () => app } });
  assert.equal(graph.runtime.services.reconciliation, app.reconciliation);

  const external = graph.runtime.execute({
    operation: "COORDINATE_PUBLICATION_RECONCILIATION",
    ...request(snapshot, "composed"),
  });

  assert.deepEqual(external, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.equal(app.repository.find(identity)?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(app.audit.list(identity).some(({ decision }) => decision === "CONFIRMED"), false);

  const result = app.reconciliation.execute(request(snapshot, "trusted-internal"));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(app.repository.find(identity)?.lifecycleState, "ACTIVE");
  assert.equal(app.audit.list(identity).at(-1)?.decision, "CONFIRMED");
});

test("F15-TASK-008 rejects incomplete recovery audit evidence", () => {
  const app = infrastructure();

  assert.throws(() => app.audit.append({
    id: "incomplete-recovery-audit",
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    command: "RESOLVE_RECONCILIATION",
    actorId: "executor-independent",
    timestamp: occurredAt,
    version: 1,
    result: "COMPLETED",
    decision: "CONFIRMED",
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "AUDIT_RECORD_INVALID");

  assert.throws(() => app.audit.append({
    id: "missing-recovery-audit",
    tenantScopeId: identity.tenantScopeId,
    aggregateId: identity.publicationId,
    command: "RESOLVE_RECONCILIATION",
    actorId: "executor-independent",
    timestamp: occurredAt,
    version: 1,
    result: "COMPLETED",
  }), (error: unknown) => error instanceof Error && "code" in error && error.code === "AUDIT_RECORD_INVALID");
});
