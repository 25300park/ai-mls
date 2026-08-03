import assert from "node:assert/strict";
import test from "node:test";

import type { PublicationExecutionContext } from "./publication-application-contracts.js";
import { FixedClock } from "./publication-clock.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationBinding, PublicationIdentity } from "./publication-contracts.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { createTestPublicationAuthorizationConfiguration } from "./publication-authorization-test-support.test.js";

const occurredAt = "2026-08-03T12:00:00.000Z";
const identity: PublicationIdentity = { publicationId: "publication-lifecycle-1", tenantScopeId: "team-a" };
const binding: PublicationBinding = {
  subjectId: "listing-1", subjectRevision: 3,
  representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5,
  channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
};
const correctionBinding: PublicationBinding = {
  ...binding,
  representationId: "representation-2",
  representationVersion: 3,
  representationChecksum: "sha256:representation-2-v3",
  approvalId: "approval-correction-1",
  approvalVersion: 1,
};
const republishBinding: PublicationBinding = { ...binding, approvalId: "approval-republish-1", approvalVersion: 1 };

function context(key: string, overrides: Partial<PublicationExecutionContext> = {}): PublicationExecutionContext {
  return {
    actorId: "forged-body-actor", sessionId: "executor-independent", correlationId: `correlation-${key}`,
    idempotencyKey: `idempotency-${key}`, intentFingerprint: `sha256:${key}`, ...overrides,
  };
}

function command(reason = "Approved publication lifecycle operation") {
  return { actorId: "forged-command-actor", authorityContext: "PUBLICATION_EXECUTION", reason, correlationId: "", occurredAt };
}

function lifecycleInfrastructure(options: {
  readonly approvalEffective?: boolean;
  readonly liveStatus?: "VERIFICATION_STALE" | "PERMISSION_STALE" | "SOD_CONFLICT";
  readonly omitAuthentication?: boolean;
  readonly authorizationReason?: "CAPABILITY_DENIED" | "REAUTHENTICATION_REQUIRED" | "REASON_REQUIRED";
} = {}) {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(occurredAt));
  const configuration = options.omitAuthentication === true ? { clock: new FixedClock(occurredAt) } : {
    ...base,
    ...(options.authorizationReason === undefined ? {} : {
      authorizationEvaluator: {
        evaluate: () => Object.freeze({
          effect: "DENY" as const,
          reasonCode: options.authorizationReason!,
          policyVersion: "test-authorization-v1",
          obligations: Object.freeze([]),
          assignmentIds: Object.freeze([]),
        }),
      },
    }),
    ...(options.liveStatus === undefined ? {} : {
      liveContextResolver: {
        resolve(bindingInput: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[0], scope: Parameters<NonNullable<typeof base.liveContextResolver>["resolve"]>[1]) {
          const live = base.liveContextResolver!.resolve(bindingInput, scope);
          if (live === undefined) return undefined;
          if (options.liveStatus === "VERIFICATION_STALE") return { ...live, verification: { ...live.verification, status: "EXPIRED" as const } };
          if (options.liveStatus === "PERMISSION_STALE") return { ...live, permission: { ...live.permission, status: "REVOKED" as const } };
          return { ...live, approval: { ...live.approval, requesterActorId: "executor-independent" } };
        },
      },
    }),
  };
  return createPublicationInfrastructure({
    ...configuration,
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
    connectorDispatcher: {
      dispatch: () => Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["connector-evidence"]), externalObjectReference: "external-listing-1" }),
    },
  });
}

function createReady(infrastructure: ReturnType<typeof lifecycleInfrastructure>, suffix: string, publicationIdentity = identity) {
  const execution = context(`create-${suffix}`);
  const result = infrastructure.coordination.create({
    context: execution,
    command: { kind: "CREATE_PUBLICATION", input: {
      identity: publicationIdentity, binding,
      prerequisites: { immutableSnapshot: true, exactTargetChannel: true, provenancePresent: true },
      classification: "CONFIDENTIAL_BUSINESS",
      command: { ...command(), correlationId: execution.correlationId },
    } },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  if (!result.ok) throw new Error("test setup failed");
  return result.aggregateVersion;
}

function seedReady(infrastructure: ReturnType<typeof lifecycleInfrastructure>, suffix: string, publicationIdentity = identity) {
  const snapshot = PublicationAggregate.create({
    identity: publicationIdentity,
    binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: { ...command(), correlationId: `correlation-seed-${suffix}` },
  }).snapshot;
  infrastructure.repository.save(snapshot);
  return snapshot.aggregateVersion;
}

function createActive(infrastructure: ReturnType<typeof lifecycleInfrastructure>, suffix: string, publicationIdentity = identity) {
  const version = createReady(infrastructure, suffix, publicationIdentity);
  const execution = context(`publish-${suffix}`);
  const result = infrastructure.coordination.publish({
    context: execution, identity: publicationIdentity, expectedAggregateVersion: version,
    command: { ...command(), correlationId: execution.correlationId },
    attempt: { id: `attempt-publish-${suffix}`, commandId: `command-publish-${suffix}`, operation: "INITIAL_PUBLISH", occurredAt, evidenceRefs: [] },
  });
  assert.equal(result.ok, true);
  return infrastructure.repository.find(publicationIdentity)!;
}

function operationContext(key: string) {
  const execution = context(key);
  return { execution, domain: { ...command(), correlationId: execution.correlationId } };
}

test("F15-TASK-007 coordinates non-material correction with authorization, persistence, audit and idempotent replay", () => {
  const infrastructure = lifecycleInfrastructure();
  const active = createActive(infrastructure, "correction");
  const { execution, domain } = operationContext("correction");
  const request = {
    context: execution, identity,
    input: { type: "BEGIN_ACTIVE_OPERATION" as const, expectedAggregateVersion: active.aggregateVersion, operation: "CORRECTION" as const,
      materiality: "NON_MATERIAL" as const, nextBinding: correctionBinding,
      attempt: { id: "attempt-correction-1", commandId: "command-correction-1", operation: "CORRECTION" as const, occurredAt, evidenceRefs: [] }, command: domain },
  };

  const first = infrastructure.lifecycle.correctPublication(request);
  const replay = infrastructure.lifecycle.correctPublication(request);

  assert.equal(first.ok, true, JSON.stringify(first));
  assert.deepEqual(replay, first.ok ? { ...first, replayed: true } : first);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
  assert.equal(infrastructure.repository.find(identity)?.pendingOperation?.operation, "CORRECTION");
  assert.equal(infrastructure.audit.list(identity).at(-1)?.command, "BEGIN_ACTIVE_OPERATION");
  assert.equal(infrastructure.audit.list(identity).at(-1)?.actorId, "executor-independent");
});

test("F15-TASK-007 coordinates withdrawal request and confirmed resolution with append-only persistence", () => {
  const infrastructure = lifecycleInfrastructure();
  const active = createActive(infrastructure, "withdrawal");
  const requestContext = operationContext("withdraw-request");
  const requested = infrastructure.lifecycle.requestWithdrawal({
    context: requestContext.execution, identity,
    input: { type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: active.aggregateVersion,
      attempt: { id: "attempt-withdrawal-1", commandId: "command-withdrawal-1", operation: "WITHDRAWAL", occurredAt, evidenceRefs: [] },
      command: requestContext.domain },
  });
  assert.equal(requested.ok, true);
  const pending = infrastructure.repository.find(identity)!;
  const resolveContext = operationContext("withdraw-resolve");
  const resolved = infrastructure.lifecycle.resolveWithdrawal({
    context: resolveContext.execution, identity,
    input: { type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: pending.aggregateVersion, outcome: "CONFIRMED",
      evidenceRefs: ["withdrawal-confirmation-1"], command: resolveContext.domain },
  });

  assert.equal(resolved.ok, true);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "WITHDRAWN");
  assert.deepEqual(infrastructure.repository.readHistory(identity).map(({ lifecycleState }) => lifecycleState).slice(-2), ["WITHDRAWAL_PENDING", "WITHDRAWN"]);
  assert.deepEqual(infrastructure.audit.list(identity).slice(-2).map(({ command, result }) => ({ command, result })), [
    { command: "REQUEST_WITHDRAWAL", result: "COMPLETED" },
    { command: "RESOLVE_WITHDRAWAL", result: "COMPLETED" },
  ]);
});

test("F15-TASK-007 preserves the material correction successor boundary without lifecycle mutation", () => {
  const infrastructure = lifecycleInfrastructure();
  const active = createActive(infrastructure, "material-correction");
  const action = operationContext("material-correction");

  const result = infrastructure.lifecycle.correctPublication({ context: action.execution, identity, input: {
    type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: active.aggregateVersion, operation: "CORRECTION",
    materiality: "MATERIAL", nextBinding: correctionBinding,
    attempt: { id: "attempt-material-correction", commandId: "command-material-correction", operation: "CORRECTION", occurredAt, evidenceRefs: [] },
    command: action.domain,
  } });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "PUBLICATION_MATERIAL_CHANGE_REQUIRES_SUCCESSOR");
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "ACTIVE");
  assert.equal(infrastructure.repository.find(identity)?.aggregateVersion, active.aggregateVersion);
  assert.equal(infrastructure.audit.list(identity).at(-1)?.result, "FAILED");
});

test("F15-TASK-007 coordinates withdrawn republish using a fresh command and attempt", () => {
  const infrastructure = lifecycleInfrastructure();
  const active = createActive(infrastructure, "republish");
  const withdraw = operationContext("republish-withdraw");
  assert.equal(infrastructure.lifecycle.requestWithdrawal({ context: withdraw.execution, identity, input: {
    type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: active.aggregateVersion,
    attempt: { id: "attempt-withdrawal-republish", commandId: "command-withdrawal-republish", operation: "WITHDRAWAL", occurredAt, evidenceRefs: [] }, command: withdraw.domain,
  } }).ok, true);
  const pending = infrastructure.repository.find(identity)!;
  const resolution = operationContext("republish-resolve");
  assert.equal(infrastructure.lifecycle.resolveWithdrawal({ context: resolution.execution, identity, input: {
    type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: pending.aggregateVersion, outcome: "CONFIRMED", evidenceRefs: ["withdrawn"], command: resolution.domain,
  } }).ok, true);
  const withdrawn = infrastructure.repository.find(identity)!;
  const republish = operationContext("republish-start");
  const result = infrastructure.lifecycle.republishPublication({ context: republish.execution, identity, input: {
    type: "BEGIN_WITHDRAWN_REPUBLISH", expectedAggregateVersion: withdrawn.aggregateVersion, nextBinding: republishBinding,
    attempt: { id: "attempt-republish-1", commandId: "command-republish-1", operation: "REPUBLISH", occurredAt, evidenceRefs: [] }, command: republish.domain,
  } });

  assert.equal(result.ok, true, JSON.stringify(result));
  const current = infrastructure.repository.find(identity)!;
  assert.equal(current.lifecycleState, "EXECUTION_PENDING");
  assert.equal(current.republishStatus, "EXECUTION_PENDING");
  assert.equal(current.attempts.at(-1)?.commandId, "command-republish-1");
  assert.equal(current.binding.targetId, binding.targetId);
  assert.equal(current.binding.channelId, binding.channelId);
  assert.equal(current.binding.approvalId, "approval-republish-1");
  assert.equal(infrastructure.audit.list(identity).at(-1)?.command, "BEGIN_WITHDRAWN_REPUBLISH");
  assert.equal(infrastructure.audit.list(identity).at(-1)?.result, "COMPLETED");
});

test("F15-TASK-007 coordinates suspension, resume, supersession and termination", () => {
  const infrastructure = lifecycleInfrastructure();
  let current = createActive(infrastructure, "state-actions");
  let action = operationContext("suspend");
  assert.equal(infrastructure.lifecycle.suspendPublication({ context: action.execution, identity, input: {
    type: "SET_SUSPENSION", expectedAggregateVersion: current.aggregateVersion, suspensionStatus: "SUSPENDED_SECURITY", command: action.domain,
  } }).ok, true);
  current = infrastructure.repository.find(identity)!;
  assert.equal(current.suspensionStatus, "SUSPENDED_SECURITY");
  action = operationContext("resume");
  assert.equal(infrastructure.lifecycle.resumePublication({ context: action.execution, identity, input: {
    type: "SET_SUSPENSION", expectedAggregateVersion: current.aggregateVersion, suspensionStatus: "NOT_SUSPENDED", command: action.domain,
  } }).ok, true);
  current = infrastructure.repository.find(identity)!;
  assert.equal(current.suspensionStatus, "NOT_SUSPENDED");
  action = operationContext("supersede");
  assert.equal(infrastructure.lifecycle.supersedePublication({ context: action.execution, identity, input: {
    type: "SUPERSEDE", expectedAggregateVersion: current.aggregateVersion, successorPublicationId: "publication-successor-1", evidenceRefs: ["successor-evidence"], command: action.domain,
  } }).ok, true);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "SUPERSEDED");

  const readyIdentity = { publicationId: "publication-terminate-1", tenantScopeId: "team-a" } as const;
  const readyVersion = createReady(infrastructure, "terminate", readyIdentity);
  action = operationContext("terminate");
  assert.equal(infrastructure.lifecycle.terminatePublication({ context: action.execution, identity: readyIdentity, input: {
    type: "TERMINATE", expectedAggregateVersion: readyVersion, command: action.domain,
  } }).ok, true);
  assert.equal(infrastructure.repository.find(readyIdentity)?.lifecycleState, "TERMINATED");
});

test("F15-TASK-007 fails closed for authorization, live prerequisite, version, idempotency and transition rejection", () => {
  const cases = [
    { name: "authentication", infrastructure: lifecycleInfrastructure({ omitAuthentication: true }), expected: "AUTHENTICATION_REQUIRED" },
    { name: "approval", infrastructure: lifecycleInfrastructure({ approvalEffective: false }), expected: "APPROVAL_NOT_EFFECTIVE" },
    { name: "verification", infrastructure: lifecycleInfrastructure({ liveStatus: "VERIFICATION_STALE" }), expected: "VERIFICATION_NOT_EFFECTIVE" },
    { name: "permission", infrastructure: lifecycleInfrastructure({ liveStatus: "PERMISSION_STALE" }), expected: "PERMISSION_NOT_EFFECTIVE" },
    { name: "authorization", infrastructure: lifecycleInfrastructure({ authorizationReason: "CAPABILITY_DENIED" }), expected: "AUTHORIZATION_DENIED" },
    { name: "sod", infrastructure: lifecycleInfrastructure({ liveStatus: "SOD_CONFLICT" }), expected: "SEPARATION_OF_DUTIES_DENIED" },
    { name: "mfa", infrastructure: lifecycleInfrastructure({ authorizationReason: "REAUTHENTICATION_REQUIRED" }), expected: "MFA_REQUIRED" },
    { name: "reason", infrastructure: lifecycleInfrastructure({ authorizationReason: "REASON_REQUIRED" }), expected: "REASON_REQUIRED" },
  ] as const;
  for (const item of cases) {
    const version = seedReady(item.infrastructure, item.name);
    const action = operationContext(`reject-${item.name}`);
    const result = item.infrastructure.lifecycle.terminatePublication({ context: action.execution, identity, input: {
      type: "TERMINATE", expectedAggregateVersion: version, command: action.domain,
    } });
    assert.equal(result.ok, false, item.name);
    if (!result.ok) assert.equal(result.error.code, item.expected, item.name);
    assert.equal(item.infrastructure.repository.find(identity)?.lifecycleState, "READY", item.name);
    assert.equal(item.infrastructure.audit.list(identity).some(({ result: auditResult }) => auditResult === "COMPLETED"), false, item.name);
  }

  const infrastructure = lifecycleInfrastructure();
  const active = createActive(infrastructure, "conflicts");
  let action = operationContext("version-conflict");
  const versionConflict = infrastructure.lifecycle.requestWithdrawal({ context: action.execution, identity, input: {
    type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: active.aggregateVersion - 1,
    attempt: { id: "attempt-stale", commandId: "command-stale", operation: "WITHDRAWAL", occurredAt, evidenceRefs: [] }, command: action.domain,
  } });
  assert.equal(versionConflict.ok, false);
  if (!versionConflict.ok) assert.equal(versionConflict.error.code, "PUBLICATION_VERSION_CONFLICT");

  action = operationContext("invalid-transition");
  const invalid = infrastructure.lifecycle.terminatePublication({ context: action.execution, identity, input: {
    type: "TERMINATE", expectedAggregateVersion: active.aggregateVersion, command: action.domain,
  } });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, "PUBLICATION_TRANSITION_INVALID");

  action = operationContext("idempotency-conflict");
  const first = infrastructure.lifecycle.suspendPublication({ context: action.execution, identity, input: {
    type: "SET_SUSPENSION", expectedAggregateVersion: active.aggregateVersion, suspensionStatus: "SUSPENDED_SECURITY", command: action.domain,
  } });
  assert.equal(first.ok, true);
  const conflictingContext = { ...action.execution, intentFingerprint: "sha256:different-intent" };
  const suspendedVersion = infrastructure.repository.find(identity)!.aggregateVersion;
  const conflict = infrastructure.lifecycle.suspendPublication({ context: conflictingContext, identity, input: {
    type: "SET_SUSPENSION", expectedAggregateVersion: suspendedVersion, suspensionStatus: "SUSPENDED_COMPLIANCE", command: action.domain,
  } });
  assert.equal(conflict.ok, false);
  if (!conflict.ok) assert.equal(conflict.error.code, "IDEMPOTENCY_CONFLICT");
});

test("F15-TASK-007 lifecycle operation traverses Composition Root and Runtime without a parallel path", () => {
  const infrastructureOptions = {
    ...createTestPublicationAuthorizationConfiguration(new FixedClock(occurredAt)),
    effectiveApprovalPort: { check: (input: typeof binding & { actorId: string }) => Object.freeze({
      effective: true as const, decisionReference: "decision-composed", approvalId: input.approvalId,
      approvalVersion: input.approvalVersion, checkedAt: occurredAt,
      effectiveScope: Object.freeze({ targetId: input.targetId, channelId: input.channelId }), reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
    }) },
  };
  const composed = composePublicationApplication({ runtimeOptions: { infrastructureConfiguration: infrastructureOptions } });
  assert.equal(typeof composed.runtime.services.lifecycle.execute, "function");
  const execution = context("composed-create");
  const created = composed.runtime.execute({ operation: "COORDINATE_CREATE_PUBLICATION",
    context: execution, command: { kind: "CREATE_PUBLICATION", input: { identity, binding,
        prerequisites: { immutableSnapshot: true, exactTargetChannel: true, provenancePresent: true }, classification: "CONFIDENTIAL_BUSINESS",
        command: { ...command(), correlationId: execution.correlationId },
      } },
  });
  assert.equal(created.operationResult, "SUCCEEDED");
  const action = operationContext("composed-terminate");
  const result = composed.runtime.execute({ operation: "COORDINATE_PUBLICATION_LIFECYCLE",
    action: "TERMINATE", context: action.execution, identity,
    input: { type: "TERMINATE", expectedAggregateVersion: 1, command: action.domain },
  });

  assert.equal(result.operationResult, "SUCCEEDED");
  assert.equal(result.operationResult === "SUCCEEDED" ? result.version : 0, 2);
  composed.runtime.stop();
  composed.runtime.dispose();
});
