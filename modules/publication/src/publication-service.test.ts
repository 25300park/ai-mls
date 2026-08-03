import assert from "node:assert/strict";
import test from "node:test";

import type { PublicationExecutionContext } from "./publication-application-contracts.js";
import { FixedClock } from "./publication-clock.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationLiveAuthorizationContext } from "./publication-authorization.js";
import { composePublicationApplication } from "./publication-composition-root.js";
import { createPublicationInfrastructure } from "./publication-infrastructure.js";
import { Api013EffectiveApprovalAdapter } from "./publication-infrastructure-effective-approval-adapter.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationSession } from "./publication-authorization-test-support.test.js";
import type { PublicationConnectorDispatchResult } from "./publication-service.js";

const timestamp = "2026-08-03T12:00:00.000Z";
const identity = { publicationId: "publication-coordination-1", tenantScopeId: "team-a" } as const;
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

function coordinate(
  infrastructure: Pick<ReturnType<typeof createPublicationInfrastructure>, "coordination">,
  coordinated: ReturnType<typeof request>,
) {
  const created = infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  if (!created.ok) return created;
  return infrastructure.coordination.publish({
    context: coordinated.context,
    identity: coordinated.create.input.identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.aggregateVersion,
  });
}

test("F15-TASK-006 coordinates create, live Approval, connector confirmation and ACTIVE persistence", () => {
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
  const created = infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });

  assert.equal(created.ok, true);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "READY");
  assert.deepEqual(connectorDispatches, []);

  const result = created.ok ? infrastructure.coordination.publish({
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
  const persisted = infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "ACTIVE");
  assert.equal(persisted?.externalObjectReference, "external-listing-1");
  assert.deepEqual(persisted?.transitionHistory.map(({ transitionId }) => transitionId), ["PUB-TR-001", "PUB-TR-002", "PUB-TR-003"]);
  assert.deepEqual(infrastructure.audit.list(identity).map(({ result, version, actorId }) => ({ result, version, actorId })), [
    { result: "COMPLETED", version: 1, actorId: "executor-independent" },
    { result: "COMPLETED", version: 2, actorId: "executor-independent" },
    { result: "COMPLETED", version: 3, actorId: "executor-independent" },
  ]);
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
    readonly onDispatch?: () => void;
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
      dispatch() {
        dispatchCount += 1;
        options.onDispatch?.();
        return typeof outcome === "function" ? outcome() : outcome;
      },
    },
  });
  return { infrastructure, dispatchCount: () => dispatchCount };
}

test("F15-TASK-006 requires current API-013 effective Approval before mutation", () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, { approvalEffective: false });

  const result = coordinate(infrastructure, request(context("stale-approval")));

  assert.deepEqual(result, {
    ok: false,
    error: { code: "APPROVAL_NOT_EFFECTIVE", category: "DOMAIN_REJECTION", message: "Publication Approval is not effective." },
  });
  assert.equal(infrastructure.repository.find(identity), undefined);
  assert.equal(dispatchCount(), 0);
  assert.deepEqual(infrastructure.audit.list(identity).map(({ result, failureReason }) => ({ result, failureReason })), [
    { result: "FAILED", failureReason: "APPROVAL_NOT_EFFECTIVE" },
  ]);
});

test("F15-TASK-006 API-013 adapter supplies the canonical effective Approval contract", () => {
  const canonicalRequests: Record<string, unknown>[] = [];
  const adapter = new Api013EffectiveApprovalAdapter(
    {
      checkEffectiveApproval(input) {
        canonicalRequests.push(input as unknown as Record<string, unknown>);
        return Object.freeze({
          effective: true,
          approvalId: input.approvalId,
          approvalVersion: input.approvalVersion,
          checkedAt: timestamp,
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

  const result = coordinate(infrastructure, request(context("api-013-adapter")));

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
});

for (const prerequisite of ["verification", "permission"] as const) {
  test(`F15-TASK-006 requires current ${prerequisite} before create or connector dispatch`, () => {
    const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, {
      liveTransform(live) {
        return prerequisite === "verification"
          ? Object.freeze({ ...live, verification: Object.freeze({ ...live.verification, status: "REVOKED" as const }) })
          : Object.freeze({ ...live, permission: Object.freeze({ ...live.permission, status: "REVOKED" as const }) });
      },
    });

    const result = coordinate(infrastructure, request(context(`stale-${prerequisite}`)));

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, prerequisite === "verification" ? "VERIFICATION_NOT_EFFECTIVE" : "PERMISSION_NOT_EFFECTIVE");
    assert.equal(infrastructure.repository.find(identity), undefined);
    assert.equal(dispatchCount(), 0);
  });
}

test("F15-TASK-006 authorization failure stops before Approval, connector and persistence", () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure(undefined, { omitAuthentication: true });

  const result = coordinate(infrastructure, request(context("authentication-failure")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "AUTHENTICATION_REQUIRED");
  assert.equal(infrastructure.repository.find(identity), undefined);
  assert.equal(dispatchCount(), 0);
  assert.deepEqual(infrastructure.audit.list(identity), []);
});

for (const prerequisite of ["verification", "permission"] as const) {
  test(`F15-TASK-006 revalidates ${prerequisite} after create and before publish dispatch`, () => {
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
    const created = infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const result = infrastructure.coordination.publish({ context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: created.aggregateVersion });

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, prerequisite === "verification" ? "VERIFICATION_NOT_EFFECTIVE" : "PERMISSION_NOT_EFFECTIVE");
    assert.equal(dispatchCount, 0);
    assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "READY");
  });
}

test("F15-TASK-006 rejects a stale publish version before connector dispatch", () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("stale-publish-version"));
  const created = infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = infrastructure.coordination.publish({ context: coordinated.context, identity, command: coordinated.create.input.command, attempt: coordinated.attempt, expectedAggregateVersion: created.aggregateVersion + 1 });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "PUBLICATION_VERSION_CONFLICT");
  assert.equal(dispatchCount(), 0);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "READY");
});

test("F15-TASK-006 connector rejection returns READY with immutable no-effect evidence", () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "REJECTED",
    evidenceRefs: Object.freeze(["connector-rejection-1"]),
  }));

  const result = coordinate(infrastructure, request(context("connector-rejected")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_REJECTED");
  const persisted = infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "READY");
  assert.equal(persisted?.attempts[0]?.outcome, "NO_EFFECT");
  assert.deepEqual(persisted?.attempts[0]?.evidenceRefs, ["connector-rejection-1"]);
  assert.deepEqual(infrastructure.audit.list(identity).map(({ result }) => result), ["COMPLETED", "COMPLETED", "COMPLETED"]);
});

test("F15-TASK-006 unknown connector outcome fails closed in RECONCILIATION_REQUIRED", () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "UNKNOWN",
    evidenceRefs: Object.freeze(["connector-observation-unknown-1"]),
  }));

  const result = coordinate(infrastructure, request(context("connector-unknown")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  const persisted = infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(persisted?.attempts[0]?.outcome, "UNKNOWN");
  assert.equal(persisted?.reconciliationCases[0]?.status, "OPEN");
  assert.equal(persisted?.externalObjectReference, undefined);
});

test("F15-TASK-006 contains connector exceptions as unknown without claiming ACTIVE", () => {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(timestamp));
  const infrastructure = createPublicationInfrastructure({
    ...base,
    effectiveApprovalPort: { check: () => approvalDecision("approval-decision-exception") },
    connectorDispatcher: { dispatch(): never { throw new Error("restricted provider failure detail"); } },
  });

  const result = coordinate(infrastructure, request(context("connector-exception")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.equal(JSON.stringify(result).includes("restricted provider failure detail"), false);
});

test("F15-TASK-006 identical replay does not duplicate connector dispatch or persistence", () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const coordinated = request(context("idempotent-replay"));

  const first = coordinate(infrastructure, coordinated);
  const second = coordinate(infrastructure, coordinated);

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ...first, replayed: true });
  assert.equal(dispatchCount(), 1);
  assert.equal(infrastructure.repository.readHistory(identity).length, 3);
  assert.equal(infrastructure.audit.list(identity).length, 3);
});

test("F15-TASK-006 conflicting idempotency fingerprint is rejected without redispatch", () => {
  const { infrastructure, dispatchCount } = coordinationInfrastructure();
  const first = request(context("idempotency-conflict"));
  assert.equal(coordinate(infrastructure, first).ok, true);

  const result = coordinate(infrastructure, {
    ...first,
    context: { ...first.context, intentFingerprint: "sha256:conflicting-intent" },
  });

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "IDEMPOTENCY_CONFLICT");
  assert.equal(dispatchCount(), 1);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "ACTIVE");
});

test("F15-TASK-006 records confirmed external effect after a concurrent aggregate version change", () => {
  const holder: { current?: ReturnType<typeof createPublicationInfrastructure> } = {};
  const configured = coordinationInfrastructure(undefined, {
    onDispatch() {
      const infrastructure = holder.current!;
      const current = infrastructure.repository.find(identity)!;
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
      infrastructure.repository.update(current.aggregateVersion, changed);
    },
  });
  const infrastructure = configured.infrastructure;
  holder.current = infrastructure;

  const result = coordinate(infrastructure, request(context("version-conflict")));

  assert.equal(result.ok, true);
  assert.equal(result.ok && result.aggregateVersion, 4);
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "ACTIVE");
  assert.equal(infrastructure.repository.find(identity)?.suspensionStatus, "SUSPENDED_SECURITY");
});

test("F15-TASK-006 dispatches only the persisted exact binding and approval decision evidence", () => {
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
  const created = infrastructure.coordination.create({ context: coordinated.context, command: coordinated.create });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const result = infrastructure.coordination.publish({
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
  }]);
});

test("F15-TASK-006 converts an inconsistent connector result to UNKNOWN reconciliation", () => {
  const { infrastructure } = coordinationInfrastructure(Object.freeze({
    outcome: "REJECTED",
    evidenceRefs: Object.freeze(["contradictory-result"]),
    externalObjectReference: "unexpected-external-effect",
  }));

  const result = coordinate(infrastructure, request(context("invalid-connector-result")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_UNKNOWN");
  const persisted = infrastructure.repository.find(identity);
  assert.equal(persisted?.lifecycleState, "RECONCILIATION_REQUIRED");
  assert.deepEqual(persisted?.attempts[0]?.evidenceRefs, ["connector-observation:attempt-initial-1:invalid-result"]);
});

test("F15-TASK-006 preserves failure audit when connector outcome persistence fails", () => {
  const { infrastructure } = coordinationInfrastructure();
  const originalBegin = infrastructure.unitOfWork.begin.bind(infrastructure.unitOfWork);
  let beginCount = 0;
  Object.defineProperty(infrastructure.unitOfWork, "begin", {
    configurable: true,
    value: (scope: typeof identity) => {
      beginCount += 1;
      const transaction = originalBegin(scope);
      if (beginCount !== 3) return transaction;
      return {
        ...transaction,
        commit(): never {
          transaction.rollback();
          throw new Error("simulated outcome commit failure");
        },
      };
    },
  });

  const result = coordinate(infrastructure, request(context("outcome-persistence-failure")));

  assert.equal(result.ok, false);
  assert.equal(!result.ok && result.error.code, "CONNECTOR_OUTCOME_PERSISTENCE_FAILED");
  assert.equal(infrastructure.repository.find(identity)?.lifecycleState, "EXECUTION_PENDING");
  assert.deepEqual(infrastructure.audit.list(identity).map(({ result: auditResult, failureReason }) => ({ auditResult, failureReason })), [
    { auditResult: "COMPLETED", failureReason: undefined },
    { auditResult: "COMPLETED", failureReason: undefined },
    { auditResult: "FAILED", failureReason: "CONNECTOR_OUTCOME_PERSISTENCE_FAILED:CONFIRMED" },
  ]);
});

test("F15-TASK-006 registers coordination and connector ports through Runtime and Composition", () => {
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
  const created = graph.runtime.execute({
    operation: "COORDINATE_CREATE_PUBLICATION",
    context: coordinated.context,
    command: coordinated.create,
  });
  assert.equal(created.operationResult, "SUCCEEDED");
  if (created.operationResult !== "SUCCEEDED") return;
  assert.equal(graph.runtime.services.repository.find(identity)?.lifecycleState, "READY");
  const published = graph.runtime.execute({
    operation: "COORDINATE_PUBLISH_PUBLICATION",
    context: coordinated.context,
    identity,
    command: coordinated.create.input.command,
    attempt: coordinated.attempt,
    expectedAggregateVersion: created.version,
  });
  assert.equal(published.operationResult, "SUCCEEDED");
  assert.equal(graph.runtime.services.repository.find(identity)?.lifecycleState, "ACTIVE");
});

test("F15-TASK-006 Runtime rejects malformed coordination input before service mutation", () => {
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

  const result = graph.runtime.execute(malformed as never);

  assert.deepEqual(result, { operationResult: "FAILED", failureCode: "INTERFACE_REQUEST_INVALID" });
  assert.equal(graph.runtime.services.repository.find(identity), undefined);
});
