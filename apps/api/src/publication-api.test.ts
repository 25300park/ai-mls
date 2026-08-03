import assert from "node:assert/strict";
import test from "node:test";

import type { AuthorizationDecision } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { PublicationAggregate } from "../../../modules/publication/src/publication-aggregate.js";
import { createTestPublicationAuthorizationConfiguration, createTestPublicationSession } from "../../../modules/publication/src/publication-authorization-test-support.test.js";
import { FixedClock } from "../../../modules/publication/src/publication-clock.js";
import type { PublicationBinding, PublicationIdentity, PublicationSnapshot } from "../../../modules/publication/src/publication-contracts.js";
import { createPublicationInfrastructure } from "../../../modules/publication/src/publication-infrastructure.js";
import type { PublicationInfrastructureConfigurationInput } from "../../../modules/publication/src/publication-infrastructure-configuration.js";
import { composeApiModules, composePublicationApiModule, type ApiModuleDependencies } from "./composition.js";
import { PublicationApi, type PublicationCommandRequest, type PublicationQueryRequest } from "./publication-api.js";

const now = "2026-08-03T15:00:00.000Z";
const identity: PublicationIdentity = Object.freeze({ publicationId: "publication-api-014", tenantScopeId: "team-a" });
const binding: PublicationBinding = Object.freeze({
  subjectId: "listing-1", subjectRevision: 3,
  representationId: "representation-1", representationVersion: 2, representationChecksum: "sha256:representation-1-v2",
  approvalId: "approval-1", approvalVersion: 4,
  targetId: "target-1", targetVersion: 5,
  channelId: "channel-1", channelPolicyVersion: "channel-policy-v3",
});

type InfrastructureOptions = Readonly<{
  session?: SessionContext | null;
  omitSessionResolver?: boolean;
  authorization?: (action: string) => AuthorizationDecision;
  liveTransform?: (live: NonNullable<ReturnType<NonNullable<PublicationInfrastructureConfigurationInput["liveContextResolver"]>["resolve"]>>) => NonNullable<ReturnType<NonNullable<PublicationInfrastructureConfigurationInput["liveContextResolver"]>["resolve"]>>;
  connectorOutcome?: "CONFIRMED" | "REJECTED" | "UNKNOWN";
  publicationPolicyVersion?: string;
}>;

function allow(): AuthorizationDecision {
  return Object.freeze({ effect: "ALLOW", reasonCode: "POLICY_ALLOWED", policyVersion: "test-v1", obligations: Object.freeze(["AUDIT", "MFA", "REASON"] as const), assignmentIds: Object.freeze(["assignment-1"]) });
}

function deny(reasonCode = "CAPABILITY_DENIED"): AuthorizationDecision {
  return Object.freeze({ effect: "DENY", reasonCode, policyVersion: "test-v1", obligations: Object.freeze([]), assignmentIds: Object.freeze([]) });
}

function infrastructure(options: InfrastructureOptions = {}) {
  const base = createTestPublicationAuthorizationConfiguration(new FixedClock(now));
  const resolvedSession = Object.hasOwn(options, "session") ? options.session ?? undefined : createTestPublicationSession("executor-independent", "session-valid");
  const withoutSessionResolver = { ...base };
  delete withoutSessionResolver.sessionResolver;
  return createPublicationInfrastructure({
    ...(options.omitSessionResolver === true ? withoutSessionResolver : base),
    ...(options.omitSessionResolver === true ? {} : { sessionResolver: { resolve: () => resolvedSession } }),
    authorizationEvaluator: { evaluate: ({ action }) => options.authorization?.(action) ?? allow() },
    ...(options.publicationPolicyVersion === undefined ? {} : { publicationPolicyVersion: options.publicationPolicyVersion }),
    ...(options.liveTransform === undefined ? {} : {
      liveContextResolver: {
        resolve(bindingInput, scope) {
          const live = base.liveContextResolver!.resolve(bindingInput, scope);
          return live === undefined ? undefined : options.liveTransform!(live);
        },
      },
    }),
    effectiveApprovalPort: {
      check: (input) => Object.freeze({
        effective: true as const,
        decisionReference: `decision:${input.approvalId}:${String(input.approvalVersion)}`,
        approvalId: input.approvalId,
        approvalVersion: input.approvalVersion,
        checkedAt: now,
        effectiveScope: Object.freeze({ targetId: input.targetId, channelId: input.channelId }),
        reasonCodes: Object.freeze(["APPROVAL_EFFECTIVE"]),
      }),
    },
    connectorDispatcher: {
      dispatch: () => options.connectorOutcome === "UNKNOWN"
        ? Object.freeze({ outcome: "UNKNOWN" as const, evidenceRefs: Object.freeze(["observation-unknown"]) })
        : options.connectorOutcome === "REJECTED"
          ? Object.freeze({ outcome: "REJECTED" as const, evidenceRefs: Object.freeze(["observation-rejected"]) })
          : Object.freeze({ outcome: "CONFIRMED" as const, evidenceRefs: Object.freeze(["connector-confirmed"]), externalObjectReference: "external-listing-1" }),
    },
  });
}

function command(
  operation: PublicationCommandRequest["operation"],
  payload: Readonly<Record<string, unknown>>,
  overrides: Partial<PublicationCommandRequest> = {},
): PublicationCommandRequest {
  return {
    requestId: `request-${operation}`,
    sessionId: "session-valid",
    operation,
    tenantId: identity.tenantScopeId,
    teamId: identity.tenantScopeId,
    purpose: "PUBLICATION_EXECUTION",
    correlationId: `correlation-${operation}`,
    publicationId: identity.publicationId,
    idempotencyKey: `idempotency-${operation}`,
    intentFingerprint: `sha256:${operation}`,
    documentedReason: `Approved ${operation}`,
    actorId: "forged-body-actor",
    payload,
    ...overrides,
  };
}

function createCommand(suffix = "default", overrides: Partial<PublicationCommandRequest> = {}): PublicationCommandRequest {
  return command("CREATE_PUBLICATION", {
    binding,
    prerequisites: { immutableSnapshot: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    occurredAt: now,
  }, {
    requestId: `request-create-${suffix}`,
    correlationId: `correlation-create-${suffix}`,
    idempotencyKey: `idempotency-create-${suffix}`,
    intentFingerprint: `sha256:create-${suffix}`,
    ...overrides,
  });
}

function publishCommand(version: number, suffix = "default", overrides: Partial<PublicationCommandRequest> = {}): PublicationCommandRequest {
  return command("PUBLISH_PUBLICATION", {
    expectedAggregateVersion: version,
    attempt: { id: `attempt-${suffix}`, commandId: `command-${suffix}`, operation: "INITIAL_PUBLISH", occurredAt: now, evidenceRefs: [] },
    occurredAt: now,
  }, {
    requestId: `request-publish-${suffix}`,
    correlationId: `correlation-publish-${suffix}`,
    idempotencyKey: `idempotency-publish-${suffix}`,
    intentFingerprint: `sha256:publish-${suffix}`,
    ...overrides,
  });
}

function query(
  operation: PublicationQueryRequest["operation"],
  overrides: Partial<PublicationQueryRequest> = {},
): PublicationQueryRequest {
  return {
    requestId: `request-${operation}`,
    sessionId: "session-valid",
    operation,
    tenantId: identity.tenantScopeId,
    teamId: identity.tenantScopeId,
    purpose: "PUBLICATION_EXECUTION",
    correlationId: `correlation-${operation}`,
    publicationId: identity.publicationId,
    maxEntries: 20,
    ...overrides,
  };
}

function createReady(api: PublicationApi, suffix = "ready"): number {
  const response = api.executeCommand(createCommand(suffix));
  assert.equal(response.success, true, JSON.stringify(response));
  if (!response.success) throw new Error("test setup failed");
  return response.result.aggregateVersion;
}

function createActive(api: PublicationApi, suffix = "active"): number {
  const readyVersion = createReady(api, suffix);
  const response = api.executeCommand(publishCommand(readyVersion, suffix));
  assert.equal(response.success, true, JSON.stringify(response));
  if (!response.success) throw new Error("test setup failed");
  return response.result.aggregateVersion;
}

function domainCommand(reason: string, correlationId: string) {
  return { actorId: "seed-actor", authorityContext: "PUBLICATION_EXECUTION", reason, correlationId, occurredAt: now } as const;
}

function unresolvedSnapshot(caseId = "case-api-1"): PublicationSnapshot {
  const created = PublicationAggregate.create({
    identity,
    binding,
    prerequisites: { immutableSnapshot: true, effectiveApproval: true, exactTargetChannel: true, provenancePresent: true },
    classification: "CONFIDENTIAL_BUSINESS",
    command: domainCommand("seed", "correlation-seed"),
  });
  const pending = created.beginInitialExecution({
    type: "BEGIN_INITIAL_EXECUTION",
    expectedAggregateVersion: created.snapshot.aggregateVersion,
    attempt: { id: "attempt-unknown", commandId: "command-unknown", operation: "INITIAL_PUBLISH", occurredAt: now, evidenceRefs: [] },
    command: domainCommand("begin", "correlation-begin"),
  });
  return pending.resolveExecution({
    type: "RESOLVE_EXECUTION",
    expectedAggregateVersion: pending.snapshot.aggregateVersion,
    outcome: "UNKNOWN",
    evidenceRefs: ["raw-provider-secret-must-not-leak"],
    reconciliationCaseId: caseId,
    command: domainCommand("unknown", "correlation-unknown"),
  }).snapshot;
}

test("F15-TASK-009 API-014 create uses the resolved Session Actor and ignores body Actor", () => {
  const app = infrastructure();
  const api = composePublicationApiModule(app);
  const response = api.executeCommand(createCommand("actor"));
  assert.equal(response.success, true);
  assert.equal(app.audit.list(identity).at(-1)?.actorId, "executor-independent");
  assert.equal(app.audit.list(identity).at(-1)?.version, 1);
  assert.equal(JSON.stringify(response).includes("forged-body-actor"), false);
});

test("F15-TASK-009 API-014 publish delegates to F15-TASK-006 and persists exactly one confirmed effect", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  const readyVersion = createReady(api, "publish");
  const response = api.executeCommand(publishCommand(readyVersion, "publish"));
  assert.equal(response.success, true);
  assert.equal(app.repository.find(identity)?.lifecycleState, "ACTIVE");
  assert.equal(app.repository.find(identity)?.aggregateVersion, readyVersion + 2);
  assert.equal(app.audit.list(identity).at(-1)?.actorId, "executor-independent");
});

test("F15-TASK-009 API-014 lifecycle command delegates to F15-TASK-007", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  const activeVersion = createActive(api, "lifecycle");
  const response = api.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "SET_SUSPENSION", expectedAggregateVersion: activeVersion, suspensionStatus: "SUSPENDED_SECURITY" },
    occurredAt: now,
  }));
  assert.equal(response.success, true);
  assert.equal(app.repository.find(identity)?.suspensionStatus, "SUSPENDED_SECURITY");
});

test("F15-TASK-009 API-014 reconciliation command delegates to F15-TASK-008", () => {
  const app = infrastructure();
  const snapshot = unresolvedSnapshot();
  app.repository.save(snapshot);
  const api = new PublicationApi(app);
  const response = api.executeCommand(command("RESOLVE_RECONCILIATION", {
    input: {
      expectedAggregateVersion: snapshot.aggregateVersion,
      caseId: "case-api-1",
      category: "CONFIRMED_SUCCESS",
      resolution: "EFFECT_CONFIRMED",
      evidenceRefs: ["safe-evidence-reference"],
      externalObjectReference: "external-listing-1",
    },
    occurredAt: now,
  }));
  assert.equal(response.success, true, JSON.stringify(response));
  assert.equal(response.success && response.result.reconciliationStatus, "CONFIRMED");
  assert.equal(app.repository.find(identity)?.reconciliationCases.at(-1)?.status, "RESOLVED");
});

test("F15-TASK-009 API-014 rejects missing, expired and revoked Sessions without Publication mutation", () => {
  const states = [null, "EXPIRED", "REVOKED"] as const;
  for (const state of states) {
    const session = state === null ? null : Object.freeze({ ...createTestPublicationSession("executor-independent", "session-valid"), state });
    const app = infrastructure({ session });
    const api = new PublicationApi(app);
    const response = api.executeCommand(createCommand(`session-${String(state)}`));
    assert.equal(response.success, false);
    assert.equal(!response.success && response.error.code, "AUTHENTICATION_REQUIRED");
    assert.equal(app.repository.find(identity), undefined);
    assert.equal(app.audit.list(identity).length, 0);
  }
  const missingResolverApp = infrastructure({ omitSessionResolver: true });
  const missingResolver = new PublicationApi(missingResolverApp).executeCommand(createCommand("missing-resolver"));
  assert.equal(missingResolver.success, false);
  assert.equal(!missingResolver.success && missingResolver.error.code, "AUTHENTICATION_REQUIRED");
  assert.equal(missingResolverApp.repository.find(identity), undefined);
});

test("F15-TASK-009 API request validation rejects missing reason, unknown operation, hostile accessor and body authority elevation", () => {
  const api = new PublicationApi(infrastructure());
  const missingReason = api.executeCommand(createCommand("missing-reason", { documentedReason: "" }));
  assert.equal(missingReason.success, false);
  assert.equal(!missingReason.success && missingReason.error.code, "REASON_REQUIRED");
  const unknown = api.executeCommand({ ...createCommand("unknown"), operation: "DELETE_PUBLICATION" });
  assert.equal(unknown.success, false);
  assert.equal(!unknown.success && unknown.error.code, "VALIDATION_ERROR");
  const elevated = api.executeCommand({ ...createCommand("elevated"), roles: ["OPS"], capabilities: ["publication.create"] });
  assert.equal(elevated.success, false);
  assert.equal(!elevated.success && elevated.error.code, "VALIDATION_ERROR");
  const hostile = createCommand("hostile") as unknown as Record<string, unknown>;
  Object.defineProperty(hostile, "payload", { enumerable: true, get() { throw new Error("hostile getter"); } });
  const hostileResponse = api.executeCommand(hostile);
  assert.equal(hostileResponse.success, false);
  assert.equal(!hostileResponse.success && hostileResponse.error.code, "VALIDATION_ERROR");
});

test("F15-TASK-009 API operation cannot be redirected to a different Domain command", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  const version = createReady(api, "operation-mismatch");
  const response = api.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "TERMINATE", expectedAggregateVersion: version, suspensionStatus: "SUSPENDED_SECURITY" },
    occurredAt: now,
  }));
  assert.equal(response.success, false);
  assert.equal(!response.success && response.error.code, "VALIDATION_ERROR");
  assert.equal(app.repository.find(identity)?.lifecycleState, "READY");
  assert.equal(app.repository.find(identity)?.aggregateVersion, version);
});

test("F15-TASK-009 API-014 maps MFA, SoD, stale prerequisites and binding denial to stable safe errors", () => {
  const scenarios = [
    { name: "mfa", authorization: () => deny("REAUTHENTICATION_REQUIRED"), expected: "MFA_REQUIRED" },
    { name: "sod", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, approval: { ...live.approval, decisionActorId: "executor-independent" } }), expected: "SEPARATION_OF_DUTIES_DENIED" },
    { name: "verification-sod", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, verification: { ...live.verification, decisionActorId: "executor-independent" } }), expected: "SEPARATION_OF_DUTIES_DENIED" },
    { name: "permission-sod", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, permission: { ...live.permission, decisionActorId: "executor-independent" } }), expected: "SEPARATION_OF_DUTIES_DENIED" },
    { name: "approval", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, approval: { ...live.approval, status: "EXPIRED" as const } }), expected: "APPROVAL_NOT_EFFECTIVE" },
    { name: "verification", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, verification: { ...live.verification, status: "EXPIRED" } }), expected: "VERIFICATION_NOT_EFFECTIVE" },
    { name: "permission", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, permission: { ...live.permission, status: "REVOKED" } }), expected: "PERMISSION_NOT_EFFECTIVE" },
    { name: "binding", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, target: { ...live.target, channelPolicyVersion: "stale-policy" } }), expected: "BINDING_MISMATCH" },
    { name: "target", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, target: { ...live.target, id: "different-target" } }), expected: "BINDING_MISMATCH" },
    { name: "checksum", liveTransform: (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, representation: { ...live.representation, checksum: "sha256:different-representation" } }), expected: "BINDING_MISMATCH" },
  ] as const;
  for (const scenario of scenarios) {
    const api = new PublicationApi(infrastructure(scenario));
    const response = api.executeCommand(createCommand(scenario.name));
    assert.equal(response.success, false);
    assert.equal(!response.success && response.error.code, scenario.expected);
    assert.equal(JSON.stringify(response).match(/stack|PublicationAuthorizationError|executor-independent/gu), null);
  }
});

test("F15-TASK-009 API-014 preserves optimistic concurrency and idempotency conflicts", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  const version = createReady(api, "conflict");
  const stale = api.executeCommand(publishCommand(version + 1, "stale"));
  assert.equal(stale.success, false);
  assert.equal(!stale.success && stale.error.code, "VERSION_CONFLICT");
  const first = api.executeCommand(publishCommand(version, "idempotent"));
  assert.equal(first.success, true);
  const conflict = api.executeCommand(publishCommand(version, "idempotent", { intentFingerprint: "sha256:different" }));
  assert.equal(conflict.success, false);
  assert.equal(!conflict.success && conflict.error.code, "IDEMPOTENCY_CONFLICT");
});

test("F15-TASK-009 GET_PUBLICATION returns bounded immutable canonical data", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  createReady(api, "read");
  const response = api.executeQuery(query("GET_PUBLICATION"));
  assert.equal(response.success, true);
  if (response.success) {
    assert.equal(response.result.view.publicationId, identity.publicationId);
    assert.equal("attempts" in response.result.view, false);
    assert.equal(Object.isFrozen(response), true);
    assert.equal(Object.isFrozen(response.result.view), true);
  }
});

test("F15-TASK-009 UI-031 derives role-aware actions and suppresses read-only, service, manager and administrator authority", () => {
  const operatorApp = infrastructure();
  const operatorApi = new PublicationApi(operatorApp);
  createReady(operatorApi, "ui31");
  const operator = operatorApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.equal(operator.success, true);
  assert.equal(operator.success && "screenId" in operator.result.view && operator.result.view.screenId, "UI-031");
  assert.equal(operator.success && "availableActions" in operator.result.view && operator.result.view.availableActions.includes("PUBLISH_PUBLICATION"), true);
  for (const roles of [["REV"], ["MGR"], ["ADM"], ["SVC"]] as const) {
    const session = Object.freeze({ ...createTestPublicationSession("viewer", "session-valid"), principalType: roles[0] === "SVC" ? "SERVICE" as const : "HUMAN" as const, roles, assurance: roles[0] === "SVC" ? "WORKLOAD" as const : "MFA" as const });
    const app = infrastructure({ session, authorization: () => allow() });
    app.repository.save(operatorApp.repository.find(identity)!);
    const response = new PublicationApi(app).executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
    assert.deepEqual(response.success && "availableActions" in response.result.view ? response.result.view.availableActions : ["unexpected"], []);
  }
});

test("F15-TASK-009 UI-031 advertises only commands accepted by the canonical lifecycle state", () => {
  const readyApp = infrastructure();
  const readyApi = new PublicationApi(readyApp);
  createReady(readyApi, "ready-actions");
  const ready = readyApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(ready.success && "availableActions" in ready.result.view ? ready.result.view.availableActions : [], [
    "PUBLISH_PUBLICATION", "SUSPEND_PUBLICATION", "TERMINATE_PUBLICATION",
  ]);

  const activeApp = infrastructure();
  const activeApi = new PublicationApi(activeApp);
  const activeVersion = createActive(activeApi, "active-actions");
  const active = activeApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(active.success && "availableActions" in active.result.view ? active.result.view.availableActions : [], [
    "CORRECT_PUBLICATION", "REQUEST_WITHDRAWAL", "REPUBLISH_PUBLICATION", "SUSPEND_PUBLICATION", "SUPERSEDE_PUBLICATION",
  ]);

  const requested = activeApi.executeCommand(command("REQUEST_WITHDRAWAL", {
    input: {
      type: "REQUEST_WITHDRAWAL", expectedAggregateVersion: activeVersion,
      attempt: { id: "attempt-withdraw-actions", commandId: "command-withdraw-actions", operation: "WITHDRAWAL", occurredAt: now, evidenceRefs: [] },
    },
    occurredAt: now,
  }));
  assert.equal(requested.success, true, JSON.stringify(requested));
  const pendingVersion = activeApp.repository.find(identity)!.aggregateVersion;
  const resolved = activeApi.executeCommand(command("RESOLVE_WITHDRAWAL", {
    input: { type: "RESOLVE_WITHDRAWAL", expectedAggregateVersion: pendingVersion, outcome: "CONFIRMED", evidenceRefs: ["withdrawal-confirmed"] },
    occurredAt: now,
  }));
  assert.equal(resolved.success, true, JSON.stringify(resolved));
  const withdrawn = activeApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(withdrawn.success && "availableActions" in withdrawn.result.view ? withdrawn.result.view.availableActions : [], [
    "REPUBLISH_PUBLICATION", "SUSPEND_PUBLICATION",
  ]);
  const withdrawnVersion = activeApp.repository.find(identity)!.aggregateVersion;
  assert.equal(activeApi.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "SET_SUSPENSION", expectedAggregateVersion: withdrawnVersion, suspensionStatus: "SUSPENDED_SECURITY" }, occurredAt: now,
  })).success, true);
  const suspendedWithdrawn = activeApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(suspendedWithdrawn.success && "availableActions" in suspendedWithdrawn.result.view ? suspendedWithdrawn.result.view.availableActions : [], ["RESUME_PUBLICATION"]);
});

test("F15-TASK-009 UI-031 suppresses external-effect actions while Publication is suspended", () => {
  const readyApp = infrastructure();
  const readyApi = new PublicationApi(readyApp);
  const readyVersion = createReady(readyApi, "suspended-ready");
  assert.equal(readyApi.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "SET_SUSPENSION", expectedAggregateVersion: readyVersion, suspensionStatus: "SUSPENDED_SECURITY" }, occurredAt: now,
  })).success, true);
  const ready = readyApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(ready.success && "availableActions" in ready.result.view ? ready.result.view.availableActions : [], ["RESUME_PUBLICATION", "TERMINATE_PUBLICATION"]);

  const activeApp = infrastructure();
  const activeApi = new PublicationApi(activeApp);
  const activeVersion = createActive(activeApi, "suspended-active");
  assert.equal(activeApi.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "SET_SUSPENSION", expectedAggregateVersion: activeVersion, suspensionStatus: "SUSPENDED_SECURITY" }, occurredAt: now,
  })).success, true);
  const active = activeApi.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.deepEqual(active.success && "availableActions" in active.result.view ? active.result.view.availableActions : [], ["RESUME_PUBLICATION", "SUPERSEDE_PUBLICATION"]);
});

test("F15-TASK-009 UI action derivation uses the configured current policy version", () => {
  const app = infrastructure({
    publicationPolicyVersion: "publication-policy-v2",
    liveTransform: (live) => ({ ...live, policyVersion: "publication-policy-v2" }),
  });
  const api = new PublicationApi(app);
  createReady(api, "policy-v2");
  const response = api.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.equal(response.success, true);
  assert.equal(response.success && "stale" in response.result.view && response.result.view.stale, false);
  assert.equal(response.success && "availableActions" in response.result.view && response.result.view.availableActions.includes("PUBLISH_PUBLICATION"), true);
});

test("F15-TASK-009 UI actions suppress approver, verifier and Permission decision actor conflicts", () => {
  const source = infrastructure();
  const sourceApi = new PublicationApi(source);
  createReady(sourceApi, "view-sod-source");
  const snapshot = source.repository.find(identity)!;
  const transforms = [
    (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, approval: { ...live.approval, decisionActorId: "executor-independent" } }),
    (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, verification: { ...live.verification, decisionActorId: "executor-independent" } }),
    (live: Parameters<NonNullable<InfrastructureOptions["liveTransform"]>>[0]) => ({ ...live, permission: { ...live.permission, decisionActorId: "executor-independent" } }),
  ];
  for (const liveTransform of transforms) {
    const app = infrastructure({ liveTransform });
    app.repository.save(snapshot);
    const response = new PublicationApi(app).executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
    assert.deepEqual(response.success && "availableActions" in response.result.view ? response.result.view.availableActions : ["unexpected"], []);
  }
});

test("F15-TASK-009 UI-032 reports stale prerequisite health without mutation or reactivation", () => {
  let stale = false;
  const app = infrastructure({ liveTransform: (live) => stale ? ({ ...live, verification: { ...live.verification, status: "EXPIRED" } }) : live });
  const api = new PublicationApi(app);
  createReady(api, "ui32");
  stale = true;
  const before = app.repository.find(identity)!;
  const audits = app.audit.list(identity).length;
  const response = api.executeQuery(query("GET_PUBLICATION_REVALIDATION_VIEW"));
  assert.equal(response.success, true);
  assert.equal(response.success && "screenId" in response.result.view && response.result.view.screenId, "UI-032");
  assert.equal(response.success && "verificationStatus" in response.result.view && response.result.view.verificationStatus, "EXPIRED");
  assert.equal(response.success && "revalidationRequired" in response.result.view && response.result.view.revalidationRequired, true);
  assert.deepEqual(app.repository.find(identity), before);
  assert.equal(app.audit.list(identity).length, audits);
});

test("F15-TASK-009 UI-033 exposes bounded unresolved recovery context without raw evidence or side effects", () => {
  const app = infrastructure();
  const snapshot = unresolvedSnapshot();
  app.repository.save(snapshot);
  const before = structuredClone(snapshot);
  const response = new PublicationApi(app).executeQuery(query("GET_PUBLICATION_RECOVERY_VIEW"));
  assert.equal(response.success, true);
  assert.equal(response.success && "screenId" in response.result.view && response.result.view.screenId, "UI-033");
  assert.equal(response.success && "manualReviewRequired" in response.result.view && response.result.view.manualReviewRequired, true);
  assert.equal(JSON.stringify(response).includes("raw-provider-secret-must-not-leak"), false);
  assert.deepEqual(app.repository.find(identity), before);
});

test("F15-TASK-009 UI-035 returns append-only, bounded, immutable and redacted Publication/Audit history", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  createActive(api, "ui35");
  const rawAuditId = JSON.stringify({ tenant: identity.tenantScopeId, publication: identity.publicationId, idempotencyKey: "secret-idempotency", intentFingerprint: "secret-fingerprint" });
  app.audit.append({
    id: rawAuditId, tenantScopeId: identity.tenantScopeId, aggregateId: identity.publicationId,
    command: "INTERNAL_FAILURE", actorId: "internal-actor", timestamp: now, version: 99,
    result: "FAILED", failureReason: "database-password-and-internal-stack",
  });
  const response = api.executeQuery(query("GET_PUBLICATION_AUDIT_VIEW", { maxEntries: 1 }));
  assert.equal(response.success, true);
  assert.equal(response.success && "screenId" in response.result.view && response.result.view.screenId, "UI-035");
  assert.equal(response.success && "auditEntries" in response.result.view && response.result.view.auditEntries.length, 1);
  assert.equal(response.success && "historyKind" in response.result.view && response.result.view.historyKind, "PUBLICATION_AUDIT_HISTORY");
  assert.equal(JSON.stringify(response).match(/refreshReference|familyId|connector-confirmed|external-listing-1|secret-idempotency|secret-fingerprint|database-password|internal-stack/gu), null);
  assert.equal(response.success && "auditEntries" in response.result.view && response.result.view.auditEntries[0]?.failureCode, "COMMAND_FAILED");
  assert.notEqual(response.success && "auditEntries" in response.result.view && response.result.view.auditEntries[0]?.id, rawAuditId);
  assert.equal(response.success && "auditEntries" in response.result.view && Object.isFrozen(response.result.view.auditEntries), true);
});

test("F15-TASK-009 API-014 maps canonical Publication state conflicts without misreporting a version conflict", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  const activeVersion = createActive(api, "state-error");
  const suspended = api.executeCommand(command("SUSPEND_PUBLICATION", {
    input: { type: "SET_SUSPENSION", expectedAggregateVersion: activeVersion, suspensionStatus: "SUSPENDED_SECURITY" },
    occurredAt: now,
  }));
  assert.equal(suspended.success, true, JSON.stringify(suspended));
  const suspendedVersion = app.repository.find(identity)!.aggregateVersion;
  const response = api.executeCommand(command("REPUBLISH_PUBLICATION", {
    input: {
      type: "BEGIN_ACTIVE_OPERATION", expectedAggregateVersion: suspendedVersion, operation: "REPUBLISH", materiality: "SAME_INTENT",
      nextBinding: { ...binding, approvalId: "approval-republish-state", approvalVersion: 1 },
      attempt: { id: "attempt-republish-state", commandId: "command-republish-state", operation: "REPUBLISH", occurredAt: now, evidenceRefs: [] },
    },
    occurredAt: now,
  }));
  assert.equal(response.success, false);
  assert.equal(!response.success && response.error.code, "INVALID_PUBLICATION_STATE");
});

test("F15-TASK-009 inaccessible cross-tenant, cross-team, wrong-purpose and unauthorized queries conceal existence", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  createReady(api, "conceal");
  const requests = [
    query("GET_PUBLICATION", { tenantId: "other-tenant" }),
    query("GET_PUBLICATION", { teamId: "other-team" }),
    { ...query("GET_PUBLICATION"), purpose: "AUDIT_EXPLORATION" } as never,
  ];
  for (const request of requests) {
    const response = api.executeQuery(request);
    assert.equal(response.success, false);
    assert.equal(!response.success && response.error.code, "NOT_FOUND");
    assert.equal(JSON.stringify(response).includes(identity.publicationId), false);
  }
  const deniedApp = infrastructure({ authorization: () => deny() });
  deniedApp.repository.save(app.repository.find(identity)!);
  const deniedApi = new PublicationApi(deniedApp);
  const denied = deniedApi.executeQuery(query("GET_PUBLICATION"));
  assert.equal(denied.success, false);
  assert.equal(!denied.success && denied.error.code, "NOT_FOUND");
});

test("F15-TASK-009 query path rejects missing, expired and revoked Sessions before reading Publication state", () => {
  const source = infrastructure();
  const sourceApi = new PublicationApi(source);
  createReady(sourceApi, "query-session-source");
  const snapshot = source.repository.find(identity)!;
  for (const state of [null, "EXPIRED", "REVOKED"] as const) {
    const session = state === null ? null : Object.freeze({ ...createTestPublicationSession("viewer", "session-valid"), state });
    const app = infrastructure({ session });
    app.repository.save(snapshot);
    const response = new PublicationApi(app).executeQuery(query("GET_PUBLICATION"));
    assert.equal(response.success, false);
    assert.equal(!response.success && response.error.code, "AUTHENTICATION_REQUIRED");
  }
});

test("F15-TASK-009 UI-035 requires current audit.query authority and uses policy rather than role labels", () => {
  let auditAllowed = false;
  const app = infrastructure({ authorization: (action) => action === "audit.query" && !auditAllowed ? deny() : allow() });
  const api = new PublicationApi(app);
  createReady(api, "audit-authority");
  const denied = api.executeQuery(query("GET_PUBLICATION_AUDIT_VIEW"));
  assert.equal(denied.success, false);
  assert.equal(!denied.success && denied.error.code, "NOT_FOUND");

  auditAllowed = true;
  const allowed = api.executeQuery(query("GET_PUBLICATION_AUDIT_VIEW"));
  assert.equal(allowed.success, true);
  assert.equal(allowed.success && "auditEntries" in allowed.result.view && allowed.result.view.auditEntries.at(-1)?.actorId, "executor-independent");
});

test("F15-TASK-009 query path cannot invoke commands and leaves Publication, audit and idempotency unchanged", () => {
  const app = infrastructure();
  const api = new PublicationApi(app);
  createReady(api, "non-mutation");
  const before = app.repository.find(identity)!;
  const historyCount = app.repository.readHistory(identity).length;
  const auditCount = app.audit.list(identity).length;
  for (const operation of ["GET_PUBLICATION", "GET_PUBLICATION_OPERATIONS_VIEW", "GET_PUBLICATION_REVALIDATION_VIEW", "GET_PUBLICATION_RECOVERY_VIEW", "GET_PUBLICATION_AUDIT_VIEW"] as const) {
    api.executeQuery(query(operation));
  }
  assert.deepEqual(app.repository.find(identity), before);
  assert.equal(app.repository.readHistory(identity).length, historyCount);
  assert.equal(app.audit.list(identity).length, auditCount);
});

test("F15-TASK-009 view visibility never bypasses command-time authorization revalidation", () => {
  let commandAllowed = true;
  const app = infrastructure({ authorization: (action) => action === "resource.view" || commandAllowed ? allow() : deny() });
  const api = new PublicationApi(app);
  const version = createReady(api, "revalidation");
  const view = api.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.equal(view.success && "availableActions" in view.result.view && view.result.view.availableActions.includes("PUBLISH_PUBLICATION"), true);
  commandAllowed = false;
  const denied = api.executeCommand(publishCommand(version, "revalidation"));
  assert.equal(denied.success, false);
  assert.equal(!denied.success && denied.error.code, "AUTHORIZATION_DENIED");
  assert.equal(app.repository.find(identity)?.aggregateVersion, version);
});

test("F15-TASK-009 unknown internal failures are sanitized", () => {
  const app = infrastructure();
  const api = new PublicationApi({ ...app, repository: { ...app.repository, find: () => { throw new Error("internal class and stack secret"); } } });
  const response = api.executeQuery(query("GET_PUBLICATION"));
  assert.equal(response.success, false);
  assert.equal(!response.success && response.error.code, "INTERNAL_API_ERROR");
  assert.equal(JSON.stringify(response).match(/internal class|stack secret|Error/gu), null);
});

test("F15-TASK-009 closed schema rejects sparse arrays and prototype-pollution-shaped payloads", () => {
  const api = new PublicationApi(infrastructure());
  const sparseEvidence = new Array<string>(2);
  const sparse = publishCommand(1, "sparse");
  const sparseResponse = api.executeCommand({
    ...sparse,
    payload: {
      ...sparse.payload,
      attempt: { id: "attempt-sparse", commandId: "command-sparse", operation: "INITIAL_PUBLISH", occurredAt: now, evidenceRefs: sparseEvidence },
    },
  });
  assert.equal(sparseResponse.success, false);
  assert.equal(!sparseResponse.success && sparseResponse.error.code, "VALIDATION_ERROR");
  const pollutedPayload = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(pollutedPayload, "__proto__", { enumerable: true, value: "polluted" });
  const polluted = api.executeCommand({ ...createCommand("polluted"), payload: pollutedPayload });
  assert.equal(polluted.success, false);
  assert.equal(!polluted.success && polluted.error.code, "VALIDATION_ERROR");
});

test("F15-TASK-009 main API composition registers API-014 with the same PublicationInfrastructure", () => {
  const app = infrastructure();
  const composed = composeApiModules({
    publicationInfrastructure: app,
    sessionService: {}, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {}, matchingService: {}, matchingInputResolver: {}, verificationService: {}, permissionService: {}, proposalService: {}, publicationApprovalService: {},
  } as unknown as ApiModuleDependencies);
  assert.equal(composed.publication instanceof PublicationApi, true);
  if (composed.publication === undefined) throw new Error("test setup failed");
  const response = composed.publication.executeCommand(createCommand("main-composition"));
  assert.equal(response.success, true);
  assert.equal(app.repository.find(identity)?.aggregateVersion, 1);
  const missing = {
    sessionService: {}, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {}, matchingService: {}, matchingInputResolver: {}, verificationService: {}, permissionService: {}, proposalService: {}, publicationApprovalService: {},
  } as unknown as ApiModuleDependencies;
  assert.throws(() => composeApiModules(missing), /PublicationInfrastructure/u);
});

test("F15-TASK-009 composed E2E proves authoritative Actor, exact mutation, audit, bounded read and denial containment", () => {
  let commandAllowed = true;
  let readAllowed = true;
  const app = infrastructure({ authorization: (action) => action === "resource.view" || action === "audit.query" ? (readAllowed ? allow() : deny()) : (commandAllowed ? allow() : deny()) });
  const api = composePublicationApiModule(app);
  const created = api.executeCommand(createCommand("e2e"));
  assert.equal(created.success, true);
  assert.equal(app.repository.find(identity)?.aggregateVersion, 1);
  assert.equal(app.audit.list(identity).at(-1)?.actorId, "executor-independent");
  assert.equal(app.audit.list(identity).at(-1)?.result, "COMPLETED");
  const read = api.executeQuery(query("GET_PUBLICATION_OPERATIONS_VIEW"));
  assert.equal(read.success && "lifecycle" in read.result.view && read.result.view.lifecycle, "READY");
  assert.equal(read.success && read.result.sourceVersion, 1);
  commandAllowed = false;
  const beforeDenied = app.repository.find(identity)!;
  const denied = api.executeCommand(command("TERMINATE_PUBLICATION", { input: { type: "TERMINATE", expectedAggregateVersion: 1 }, occurredAt: now }));
  assert.equal(denied.success, false);
  assert.deepEqual(app.repository.find(identity), beforeDenied);
  readAllowed = false;
  const concealed = api.executeQuery(query("GET_PUBLICATION"));
  assert.equal(concealed.success, false);
  assert.equal(!concealed.success && concealed.error.code, "NOT_FOUND");
  assert.equal(JSON.stringify({ created, read, denied, concealed }).match(/forged-body-actor|session-valid|approval-1|connector-confirmed|executor-independent/gu), null);
});
