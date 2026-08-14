import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  ADMINISTRATION_API_COMMAND_OPERATIONS,
  ADMINISTRATION_API_QUERY_OPERATIONS,
  ADMINISTRATION_API_OPERATION_REGISTRY,
  AdministrationApiError,
  assertIndependentAdministrationApproval,
  createAdministrationCommandIdentity,
  createAdministrationCommandFingerprint,
  createAdministrationCollectionView,
  createAdministrationProposalResult,
  createAdministrationCommandResult,
  createAdministrationReadView,
  immutableAdministrationApiValue,
  parseAdministrationApiRequest,
  resolveAdministrationApiSession,
  safeAdministrationApiError,
  type AdministrationApiCommandRequest,
  type AdministrationApiCommandOperation,
  type AdministrationApiCommandResult,
  type AdministrationApiQueryRequest,
  type AdministrationApiQueryOperation,
  type AdministrationProposalEvidence,
  type AdministrationSessionResolver,
} from "./administration-api-contracts.js";

const activeHumanSession: SessionContext = Object.freeze({
  id: "session-admin-1",
  principalId: "principal-admin-1",
  principalType: "HUMAN",
  roles: ["ADM"] as const,
  teamId: "team-admin-1",
  state: "ACTIVE",
  assurance: "MFA",
  isMfaVerified: true,
  authenticatedAt: "2026-08-14T01:00:00.000Z",
  expiresAt: "2026-08-14T03:00:00.000Z",
  absoluteExpiresAt: "2026-08-15T01:00:00.000Z",
  familyId: "family-admin-1",
  refreshReference: "refresh-admin-1",
});

function resolver(session: SessionContext | undefined): AdministrationSessionResolver {
  return { resolve: (sessionId) => sessionId === session?.id ? session : undefined };
}

const clock = (): Date => new Date("2026-08-14T02:00:00.000Z");

function scope(): Readonly<Record<string, unknown>> {
  return { tenantId: "tenant-1", scopeType: "TENANT", scopeId: "tenant-1" };
}

function evidence(): readonly Readonly<Record<string, unknown>>[] {
  return [{ type: "DECISION", id: "decision-1", version: 1 }];
}

function command(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    requestId: "request-admin-1",
    sessionId: activeHumanSession.id,
    tenantId: "tenant-1",
    correlationId: "correlation-admin-1",
    operation: "APPROVE_POLICY_CHANGE",
    payload: {
      proposalId: "proposal-policy-1",
      policyId: "policy-1",
      scope: scope(),
      expectedVersion: 2,
      idempotencyKey: "fixture-fixture-0000",
      reason: "Approve the independently reviewed policy change.",
      evidenceReferences: evidence(),
    },
    ...overrides,
  };
}

function query(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    requestId: "request-query-1",
    sessionId: activeHumanSession.id,
    tenantId: "tenant-1",
    correlationId: "correlation-query-1",
    operation: "LIST_ROLE_ASSIGNMENTS",
    payload: {
      scope: scope(),
      pagination: { limit: 25, cursor: "cursor-1" },
    },
    ...overrides,
  };
}

function expectCode(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => error instanceof AdministrationApiError && error.code === code);
}

test("F16-PHASE-5 closed API-015 registry keeps command and query operations disjoint", () => {
  assert.equal(ADMINISTRATION_API_COMMAND_OPERATIONS.length > 0, true);
  assert.equal(ADMINISTRATION_API_QUERY_OPERATIONS.length > 0, true);
  assert.deepEqual(
    ADMINISTRATION_API_COMMAND_OPERATIONS.filter((operation) =>
      (ADMINISTRATION_API_QUERY_OPERATIONS as readonly string[]).includes(operation)),
    [],
  );
  assert.equal(ADMINISTRATION_API_COMMAND_OPERATIONS.includes("SET_LEGAL_HOLD" as never), false);
  assert.equal(ADMINISTRATION_API_COMMAND_OPERATIONS.includes("RUN_SOURCE_CRAWLER" as never), false);
  assert.equal(ADMINISTRATION_API_COMMAND_OPERATIONS.includes("PUBLISH_PUBLICATION" as never), false);
});

test("F16-PHASE-5 closed schemas reject unknown envelope, payload, nested fields, and operations", () => {
  expectCode(() => parseAdministrationApiRequest(command({ actorId: "caller-actor" })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...(command() as { payload: object }).payload, roles: ["ADM"] } })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...(command() as { payload: object }).payload, scope: { ...scope(), wildcard: true } } })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ operation: "GRANT_SUPERUSER" })), "VALIDATION_FAILED");
  const inheritedOperation = Object.assign(Object.create({ operation: "APPROVE_POLICY_CHANGE" }) as object, command());
  delete (inheritedOperation as Record<string, unknown>)["operation"];
  expectCode(() => parseAdministrationApiRequest(inheritedOperation), "VALIDATION_FAILED");
});

test("F16-PHASE-5 parses separate closed command and query contracts", () => {
  const parsedCommand = parseAdministrationApiRequest(command());
  const parsedQuery = parseAdministrationApiRequest(query());
  assert.equal(parsedCommand.kind, "COMMAND");
  assert.equal(parsedCommand.operation, "APPROVE_POLICY_CHANGE");
  assert.equal(parsedQuery.kind, "QUERY");
  assert.equal(parsedQuery.operation, "LIST_ROLE_ASSIGNMENTS");
  assert.equal("idempotencyKey" in parsedQuery.payload, false);
});

test("F16-PHASE-5 source and target proposal schemas describe governance metadata only", () => {
  const source = parseAdministrationApiRequest(command({
    operation: "PROPOSE_SOURCE_GOVERNANCE",
    payload: {
      name: "Approved partner feed",
      sourceType: "PARTNER_FEED",
      policyReference: "source-policy-7",
      allowedMethods: ["MANUAL", "API_HANDOFF"],
      allowedPurposes: ["LISTING_INTAKE"],
      classification: "CONFIDENTIAL_BUSINESS",
      scope: { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-scope-1" },
      expectedVersion: 0,
      idempotencyKey: "idempotency-source-1",
      reason: "Register the reviewed source governance proposal.",
      evidenceReferences: evidence(),
    },
  })) as AdministrationApiCommandRequest;
  const target = parseAdministrationApiRequest(command({
    operation: "PROPOSE_PUBLICATION_TARGET_GOVERNANCE",
    payload: {
      name: "Approved portal target",
      targetType: "PARTNER_PORTAL",
      channelReference: "channel-public-web-1",
      policyReference: "target-policy-3",
      allowedFieldReferences: ["field-title", "field-price"],
      scope: { tenantId: "tenant-1", scopeType: "TARGET", scopeId: "target-scope-1" },
      expectedVersion: 0,
      idempotencyKey: "idempotency-target-1",
      reason: "Register the reviewed publication target governance proposal.",
      evidenceReferences: evidence(),
    },
  })) as AdministrationApiCommandRequest;
  assert.equal(source.payload["sourceType"], "PARTNER_FEED");
  assert.equal(target.payload["targetType"], "PARTNER_PORTAL");
  assert.equal("crawler" in source.payload, false);
  assert.equal("publish" in target.payload, false);
});

test("F16-PHASE-5 proposal operations require create version zero and cannot accept proposer identity", () => {
  const roleProposal = {
    subjectPrincipalId: "principal-agent-2",
    subjectPrincipalType: "HUMAN",
    role: "AGT",
    teamIds: ["team-admin-1"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-14T03:00:00.000Z",
    effectiveUntil: "2026-09-14T03:00:00.000Z",
    scope: scope(),
    expectedVersion: 0,
    idempotencyKey: "idempotency-role-1",
    reason: "Propose a bounded role assignment for review.",
    evidenceReferences: evidence(),
  };
  assert.equal((parseAdministrationApiRequest(command({ operation: "PROPOSE_ROLE_ASSIGNMENT", payload: roleProposal })) as AdministrationApiCommandRequest).kind, "COMMAND");
  expectCode(() => parseAdministrationApiRequest(command({ operation: "PROPOSE_ROLE_ASSIGNMENT", payload: { ...roleProposal, expectedVersion: 1 } })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ operation: "PROPOSE_ROLE_ASSIGNMENT", payload: { ...roleProposal, proposerId: "caller-proposer" } })), "VALIDATION_FAILED");
});

test("F16-PHASE-5 requires bounded reasons, safe evidence references, versions, and idempotency", () => {
  const base = (command() as { payload: Record<string, unknown> }).payload;
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...base, reason: " " } })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...base, reason: `token=${"x".repeat(40)}` } })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...base, evidenceReferences: [{ type: "DECISION", id: "C:\\secret.txt", version: 1 }] } })), "VALIDATION_FAILED");
  const withoutVersion = { ...base };
  delete withoutVersion["expectedVersion"];
  expectCode(() => parseAdministrationApiRequest(command({ payload: withoutVersion })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...base, expectedVersion: 1.5 } })), "VALIDATION_FAILED");
  const withoutKey = { ...base };
  delete withoutKey["idempotencyKey"];
  expectCode(() => parseAdministrationApiRequest(command({ payload: withoutKey })), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...base, idempotencyKey: "*" } })), "VALIDATION_FAILED");
});

test("F16-PHASE-5 derives the authoritative actor only from the current Session", () => {
  const parsed = parseAdministrationApiRequest(command()) as AdministrationApiCommandRequest;
  const resolved = resolveAdministrationApiSession(parsed, resolver(activeHumanSession), clock);
  assert.equal(resolved.actor.principalId, activeHumanSession.principalId);
  assert.equal(resolved.actor.roles.includes("ADM"), true);
  assert.equal(Object.isFrozen(resolved.actor), true);
});

test("F16-PHASE-5 fails closed for missing, inactive, non-human, or contradictory privileged Sessions", () => {
  const parsed = parseAdministrationApiRequest(command()) as AdministrationApiCommandRequest;
  expectCode(() => resolveAdministrationApiSession(parsed, undefined, clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver(undefined), clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, { resolve: () => { throw new Error("SESSION_STORE_FAILED"); } }, clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver({ ...activeHumanSession, state: "REVOKED" }), clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver({ ...activeHumanSession, expiresAt: "2026-08-14T01:59:59.000Z" }), clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver({ ...activeHumanSession, absoluteExpiresAt: "2026-08-14T01:59:59.000Z" }), clock), "AUTHENTICATION_REQUIRED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver({ ...activeHumanSession, principalType: "SERVICE", roles: ["SVC"], assurance: "WORKLOAD", isMfaVerified: false }), clock), "AUTHORIZATION_DENIED");
  expectCode(() => resolveAdministrationApiSession(parsed, resolver({ ...activeHumanSession, assurance: "SINGLE_FACTOR", isMfaVerified: true }), clock), "MFA_REQUIRED");
});

test("F16-PHASE-5 caller actor, role, capability, and MFA claims cannot elevate authority", () => {
  for (const field of ["actorId", "roles", "capabilities", "isMfaVerified", "assurance"] as const) {
    expectCode(() => parseAdministrationApiRequest(command({ [field]: field === "isMfaVerified" ? true : "caller-value" })), "VALIDATION_FAILED");
  }
});

test("F16-PHASE-5 two-person approval uses server-controlled proposer evidence", () => {
  const parsed = parseAdministrationApiRequest(command()) as AdministrationApiCommandRequest;
  const resolved = resolveAdministrationApiSession(parsed, resolver(activeHumanSession), clock);
  const proposal: AdministrationProposalEvidence = Object.freeze({
    proposalId: "proposal-policy-1",
    proposerId: "principal-proposer-1",
    resourceType: "POLICY",
    resourceId: "policy-1",
    scope: { tenantId: "tenant-1", scopeType: "TEAM" as const, scopeId: "team-admin-1" },
    proposedChangeReference: "policy-change-1",
    policyReference: "administration-policy-1",
    version: 2,
    reasonReference: "reason-1",
    evidenceReferences: [{ type: "DECISION" as const, id: "decision-1", version: 1 }],
  });
  assert.doesNotThrow(() => assertIndependentAdministrationApproval(resolved.actor, proposal));
  expectCode(
    () => assertIndependentAdministrationApproval(resolved.actor, { ...proposal, proposerId: resolved.actor.principalId }),
    "SELF_APPROVAL_FORBIDDEN",
  );
  assert.equal("proposerId" in parsed.payload, false);
});

test("F16-PHASE-5 proposal success is an immutable review item and never active authority", () => {
  const result = createAdministrationProposalResult({
    operation: "PROPOSE_POLICY_CHANGE",
    proposalId: "proposal-policy-1",
    resourceType: "POLICY",
    resourceId: "policy-1",
    status: "PROPOSED",
    version: 1,
    decisionReferences: [],
    evidenceReferences: [{ type: "DECISION", id: "decision-1", version: 1 }],
  });
  assert.equal(result.status, "PROPOSED");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(JSON.stringify(result).includes("ACTIVE"), false);
  assert.equal("roles" in result, false);
  assert.equal("capabilities" in result, false);
  const activated: AdministrationApiCommandResult = immutableAdministrationApiValue({ ...result, status: "ACTIVE" as const, version: 2 });
  assert.equal(activated.status, "ACTIVE");
});

test("F16-PHASE-5 revocation preserves proposal evidence and approval represents atomic activation", () => {
  const revoke = parseAdministrationApiRequest(command({
    operation: "REVOKE_ROLE_ASSIGNMENT",
    payload: {
      proposalId: "proposal-revoke-1",
      roleAssignmentId: "assignment-1",
      scope: scope(),
      expectedVersion: 4,
      idempotencyKey: "fixture-fixture-1111",
      reason: "Revoke the independently reviewed role assignment.",
      evidenceReferences: evidence(),
    },
  })) as AdministrationApiCommandRequest;
  const activated = createAdministrationCommandResult({
    operation: "APPROVE_SOURCE_GOVERNANCE", proposalId: "proposal-source-activate-1",
    resourceType: "SOURCE_REGISTRY", resourceId: "source-1", status: "ACTIVE", version: 3,
    decisionReferences: ["decision-source-1"], evidenceReferences: evidence(),
  });
  assert.equal(revoke.payload["proposalId"], "proposal-revoke-1");
  assert.equal(activated.status, "ACTIVE");
  expectCode(() => parseAdministrationApiRequest(command({
    operation: "TRANSITION_SOURCE_GOVERNANCE",
    payload: {
      proposalId: "proposal-source-activate-1", sourceRegistryEntryId: "source-1", targetStatus: "ACTIVE",
      scope: { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-1" }, expectedVersion: 2,
      idempotencyKey: "idempotency-source-activate-1", reason: "Attempt a separate activation transition.", evidenceReferences: evidence(),
    },
  })), "VALIDATION_FAILED");
});

test("F16-PHASE-5 command fingerprint is deterministic and intent-sensitive", () => {
  const first = parseAdministrationApiRequest(command()) as AdministrationApiCommandRequest;
  const reordered = parseAdministrationApiRequest({
    correlationId: "correlation-admin-1",
    payload: {
      evidenceReferences: evidence(),
      reason: "Approve the independently reviewed policy change.",
      idempotencyKey: "fixture-fixture-0000",
      expectedVersion: 2,
      scope: { scopeId: "tenant-1", scopeType: "TENANT", tenantId: "tenant-1" },
      policyId: "policy-1",
      proposalId: "proposal-policy-1",
    },
    tenantId: "tenant-1",
    operation: "APPROVE_POLICY_CHANGE",
    sessionId: activeHumanSession.id,
    requestId: "request-admin-1",
  }) as AdministrationApiCommandRequest;
  const changed = parseAdministrationApiRequest(command({ payload: { ...(command() as { payload: object }).payload, expectedVersion: 3 } })) as AdministrationApiCommandRequest;
  assert.equal(createAdministrationCommandFingerprint(first), createAdministrationCommandFingerprint(reordered));
  assert.notEqual(createAdministrationCommandFingerprint(first), createAdministrationCommandFingerprint(changed));
  const setsReordered = parseAdministrationApiRequest({
    ...(command() as Record<string, unknown>),
    operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: {
      subjectPrincipalId: "principal-agent-2", subjectPrincipalType: "HUMAN", role: "AGT",
      teamIds: ["team-2", "team-1"], resourceTypes: ["Property", "CandidateListing"], purposes: ["REVIEW", "CLIENT_SERVICE"],
      effectiveFrom: "2026-08-14T03:00:00.000Z", effectiveUntil: "2026-09-14T03:00:00.000Z",
      scope: scope(), expectedVersion: 0, idempotencyKey: "idempotency-set-1",
      reason: "Propose an independently reviewed bounded assignment.", evidenceReferences: [{ type: "AUDIT", id: "audit-2", version: 1 }, { type: "DECISION", id: "decision-1", version: 1 }],
    },
  }) as AdministrationApiCommandRequest;
  const setsCanonical = parseAdministrationApiRequest({
    ...(command() as Record<string, unknown>),
    operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: {
      subjectPrincipalId: "principal-agent-2", subjectPrincipalType: "HUMAN", role: "AGT",
      teamIds: ["team-1", "team-2"], resourceTypes: ["CandidateListing", "Property"], purposes: ["CLIENT_SERVICE", "REVIEW"],
      effectiveFrom: "2026-08-14T03:00:00.000Z", effectiveUntil: "2026-09-14T03:00:00.000Z",
      scope: scope(), expectedVersion: 0, idempotencyKey: "idempotency-set-1",
      reason: "Propose an independently reviewed bounded assignment.", evidenceReferences: [{ type: "DECISION", id: "decision-1", version: 1 }, { type: "AUDIT", id: "audit-2", version: 1 }],
    },
  }) as AdministrationApiCommandRequest;
  assert.equal(createAdministrationCommandFingerprint(setsReordered), createAdministrationCommandFingerprint(setsCanonical));
  const resolved = resolveAdministrationApiSession(first, resolver(activeHumanSession), clock);
  assert.deepEqual(createAdministrationCommandIdentity(resolved), {
    tenantId: "tenant-1",
    actorId: activeHumanSession.principalId,
    operation: "APPROVE_POLICY_CHANGE",
    resourceIdentity: "policy-1",
    idempotencyKey: "fixture-fixture-0000",
  });
  const anotherActor = resolveAdministrationApiSession(first, resolver({
    ...activeHumanSession,
    principalId: "principal-admin-2",
  }), clock);
  assert.notEqual(
    createAdministrationCommandIdentity(resolved).actorId,
    createAdministrationCommandIdentity(anotherActor).actorId,
  );
});

test("F16-PHASE-5 every registered operation has one valid closed request contract", () => {
  for (const operation of ADMINISTRATION_API_COMMAND_OPERATIONS) {
    const parsed = parseAdministrationApiRequest(command({ operation, payload: validCommandPayload(operation) }));
    assert.equal(parsed.operation, operation);
    assert.equal(parsed.kind, "COMMAND");
  }
  for (const operation of ADMINISTRATION_API_QUERY_OPERATIONS) {
    const parsed = parseAdministrationApiRequest({ ...(query() as Record<string, unknown>), operation, payload: validQueryPayload(operation) });
    assert.equal(parsed.operation, operation);
    assert.equal(parsed.kind, "QUERY");
  }
});

test("F16-PHASE-5 query sessions are authenticated without consuming mutation metadata", () => {
  const parsed = parseAdministrationApiRequest(query()) as AdministrationApiQueryRequest;
  const resolved = resolveAdministrationApiSession(parsed, resolver(activeHumanSession), clock);
  assert.equal(resolved.actor.principalId, activeHumanSession.principalId);
  assert.equal("idempotencyKey" in resolved.request.payload, false);
});

test("F16-PHASE-5 query filters are operation-specific closed vocabularies", () => {
  expectCode(() => parseAdministrationApiRequest({
    ...(query() as Record<string, unknown>),
    operation: "READ_ROLE_ASSIGNMENT",
    payload: { scope: scope(), roleAssignmentId: "assignment-1", pagination: { limit: 10 } },
  }), "VALIDATION_FAILED");
  expectCode(() => parseAdministrationApiRequest({
    ...(query() as Record<string, unknown>),
    operation: "LIST_ROLE_ASSIGNMENTS",
    payload: { scope: scope(), status: "ARBITRARY_STATUS" },
  }), "VALIDATION_FAILED");
  const active = parseAdministrationApiRequest({
    ...(query() as Record<string, unknown>),
    operation: "LIST_ROLE_ASSIGNMENTS",
    payload: { scope: scope(), status: "ACTIVE", pagination: { limit: 10 } },
  }) as AdministrationApiQueryRequest;
  assert.equal(active.payload["status"], "ACTIVE");
});

test("F16-PHASE-5 safe errors redact internal paths, stacks, secrets, and conceal inaccessible resources", () => {
  const concealed = safeAdministrationApiError(new AdministrationApiError("NOT_FOUND", "C:\\internal\\db.sql token=secret"));
  const internal = safeAdministrationApiError(new Error("C:\\source\\private.ts token=secret"));
  assert.deepEqual(concealed, { code: "NOT_FOUND", message: "Resource not found." });
  assert.deepEqual(safeAdministrationApiError(new AdministrationApiError("AUTHORIZATION_DENIED")), concealed);
  assert.deepEqual(internal, { code: "INTERNAL_ERROR", message: "Request could not be completed." });
  assert.equal(JSON.stringify([concealed, internal]).includes("secret"), false);
  assert.equal(JSON.stringify([concealed, internal]).includes("C:\\"), false);
  assert.equal("stack" in concealed, false);
  assert.deepEqual(safeAdministrationApiError(new Error("VERSION_CONFLICT")), {
    code: "VERSION_CONFLICT",
    message: "Request could not be completed.",
  });
  assert.deepEqual(safeAdministrationApiError(new Error("SEPARATION_OF_DUTIES_DENIED")), {
    code: "SELF_APPROVAL_FORBIDDEN",
    message: "Request could not be completed.",
  });
});

test("F16-PHASE-5 operation descriptors encode exact authority and scope preconditions", () => {
  assert.equal(Object.keys(ADMINISTRATION_API_OPERATION_REGISTRY).length, ADMINISTRATION_API_COMMAND_OPERATIONS.length + ADMINISTRATION_API_QUERY_OPERATIONS.length);
  for (const operation of ADMINISTRATION_API_COMMAND_OPERATIONS) {
    const descriptor = ADMINISTRATION_API_OPERATION_REGISTRY[operation];
    assert.equal(descriptor.kind, "COMMAND");
    assert.equal(descriptor.requiresHumanActor, true);
    assert.equal(descriptor.requiresMfa, true);
    assert.equal(descriptor.requiresExpectedVersion, true);
    assert.equal(descriptor.requiresIdempotency, true);
    assert.equal(descriptor.requiresLiveAuthorization, true);
    assert.equal(descriptor.requiresIndependentProposal, !operation.startsWith("PROPOSE_"));
  }
  assert.deepEqual(ADMINISTRATION_API_OPERATION_REGISTRY.PROPOSE_SOURCE_GOVERNANCE.allowedScopeTypes, ["SOURCE"]);
  assert.deepEqual(ADMINISTRATION_API_OPERATION_REGISTRY.PROPOSE_PUBLICATION_TARGET_GOVERNANCE.allowedScopeTypes, ["TARGET"]);
  expectCode(() => parseAdministrationApiRequest(command({ payload: { ...(command() as { payload: object }).payload, scope: { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-1" } } })), "VALIDATION_FAILED");
});

test("F16-PHASE-5 creates every required closed immutable administration read view", () => {
  const cases: readonly Readonly<Record<string, unknown>>[] = [
    { viewType: "ROLE_ASSIGNMENT", roleAssignmentId: "assignment-1", subjectPrincipalReference: "principal-1", roleId: "role-1", status: "ACTIVE" },
    { viewType: "ROLE", roleId: "role-1", status: "ACTIVE" },
    { viewType: "POLICY", policyId: "policy-1", status: "ACTIVE" },
    { viewType: "TEAM_SCOPE", teamId: "team-1", status: "ACTIVE" },
    { viewType: "SOURCE_GOVERNANCE", sourceRegistryEntryId: "source-1", policyReference: "policy-source-1", status: "PAUSED" },
    { viewType: "PUBLICATION_TARGET_GOVERNANCE", publicationTargetId: "target-1", policyReference: "policy-target-1", channelReference: "channel-1", status: "ACTIVE" },
    { viewType: "ADMINISTRATION_PROPOSAL", proposalId: "proposal-1", proposerReference: "principal-1", proposedChangeReference: "change-1", status: "PROPOSED" },
    { viewType: "ADMINISTRATION_DECISION", decisionId: "decision-1", proposalId: "proposal-1", decisionActorReference: "principal-2", status: "APPROVED" },
  ];
  for (const item of cases) {
    const itemScope = item["viewType"] === "TEAM_SCOPE"
      ? { tenantId: "tenant-1", scopeType: "TEAM", scopeId: "team-1" }
      : item["viewType"] === "SOURCE_GOVERNANCE"
      ? { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-1" }
      : item["viewType"] === "PUBLICATION_TARGET_GOVERNANCE"
        ? { tenantId: "tenant-1", scopeType: "TARGET", scopeId: "target-1" }
        : scope();
    const view = createAdministrationReadView({ ...item, scope: itemScope, version: 1, evidenceReferences: evidence() });
    assert.equal(Object.isFrozen(view), true);
  }
  expectCode(() => createAdministrationReadView({ ...cases[0], scope: scope(), version: 1, evidenceReferences: evidence(), internalAuthorizationGraph: {} }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationReadView({ ...cases[4], scope: scope(), version: 1, evidenceReferences: evidence() }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ operation: "APPROVE_POLICY_CHANGE", resourceType: "POLICY", resourceId: "policy-1", status: "ACTIVE", version: 2, decisionReferences: [], evidenceReferences: [], secret: "leak" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ operation: "REJECT_POLICY_CHANGE", resourceType: "POLICY", resourceId: "policy-1", status: "ACTIVE", version: 2, decisionReferences: [], evidenceReferences: [] }), "VALIDATION_FAILED");
});

test("F16-PHASE-5 closes command success semantics by operation", () => {
  const base = {
    proposalId: "proposal-policy-1", resourceType: "POLICY", resourceId: "policy-1",
    version: 2, decisionReferences: ["decision-policy-1"], evidenceReferences: evidence(),
  };
  assert.equal(createAdministrationCommandResult({ ...base, operation: "APPROVE_POLICY_CHANGE", status: "ACTIVE" }).status, "ACTIVE");
  expectCode(() => createAdministrationCommandResult({ ...base, proposalId: undefined, operation: "APPROVE_POLICY_CHANGE", status: "ACTIVE" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ ...base, operation: "APPROVE_POLICY_CHANGE", resourceType: "SOURCE_REGISTRY", status: "ACTIVE" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ ...base, operation: "REJECT_POLICY_CHANGE", status: "ACTIVE" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ ...base, operation: "REVOKE_ROLE_ASSIGNMENT", resourceType: "ROLE_ASSIGNMENT", status: "PROPOSED" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCommandResult({ ...base, operation: "PROPOSE_POLICY_CHANGE", status: "ACTIVE" }), "VALIDATION_FAILED");
});

test("F16-PHASE-5 validates and deeply freezes closed collection responses", () => {
  const item = {
    viewType: "POLICY", policyId: "policy-1", scope: scope(), status: "ACTIVE", version: 1,
    evidenceReferences: evidence(),
  };
  const source = { items: [item], nextCursor: "cursor-policy-2" };
  const collection = createAdministrationCollectionView(source);
  source.items[0]!.status = "REVOKED";
  assert.equal(collection.items[0]!.status, "ACTIVE");
  assert.equal(Object.isFrozen(collection), true);
  assert.equal(Object.isFrozen(collection.items), true);
  assert.equal(Object.isFrozen(collection.items[0]), true);
  expectCode(() => createAdministrationCollectionView({ ...source, internal: "leak" }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCollectionView({ items: [{ ...item, status: "UNKNOWN" }] }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCollectionView({ items: [{ ...item, scope: { tenantId: "tenant-1", scopeType: "SOURCE", scopeId: "source-1" } }] }), "VALIDATION_FAILED");
  expectCode(() => createAdministrationCollectionView({ items: [{ ...item, secret: "leak" }] }), "VALIDATION_FAILED");
});

test("F16-PHASE-5 rejects calendar-invalid timestamps", () => {
  expectCode(() => parseAdministrationApiRequest(command({
    operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: {
      ...validCommandPayload("PROPOSE_ROLE_ASSIGNMENT"),
      effectiveFrom: "2026-02-30T00:00:00.000Z",
    },
  })), "VALIDATION_FAILED");
});

test("F16-PHASE-5 immutable API views do not share nested mutable state", () => {
  const source = { items: [{ id: "assignment-1", scope: { teamIds: ["team-1"] } }] };
  const view = immutableAdministrationApiValue(source);
  source.items[0]!.scope.teamIds.push("team-source-mutation");
  assert.deepEqual(view, { items: [{ id: "assignment-1", scope: { teamIds: ["team-1"] } }] });
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.items[0]!.scope.teamIds), true);
  assert.throws(() => view.items[0]!.scope.teamIds.push("team-view-mutation"));
});

function operationScope(operation: AdministrationApiCommandOperation | AdministrationApiQueryOperation): Record<string, unknown> {
  const scopeType = ADMINISTRATION_API_OPERATION_REGISTRY[operation].allowedScopeTypes[0]!;
  return { tenantId: "tenant-1", scopeType, scopeId: scopeType === "TENANT" ? "tenant-1" : `${scopeType.toLowerCase()}-1` };
}

function validCommandPayload(operation: AdministrationApiCommandOperation): Record<string, unknown> {
  const common: Record<string, unknown> = {
    scope: operationScope(operation), expectedVersion: 1, idempotencyKey: `idempotency-${operation.toLowerCase()}`,
    reason: "Perform the independently reviewed governed administration change.", evidenceReferences: evidence(),
  };
  if (operation === "PROPOSE_ROLE_ASSIGNMENT") return {
    ...common, expectedVersion: 0, subjectPrincipalId: "principal-2", subjectPrincipalType: "HUMAN", role: "AGT",
    teamIds: ["team-1"], resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-14T03:00:00.000Z", effectiveUntil: "2026-09-14T03:00:00.000Z",
  };
  if (operation === "PROPOSE_SOURCE_GOVERNANCE") return {
    ...common, expectedVersion: 0, name: "Governed source", sourceType: "PARTNER_FEED", policyReference: "source-policy-1",
    allowedMethods: ["MANUAL"], allowedPurposes: ["LISTING_INTAKE"], classification: "CONFIDENTIAL_BUSINESS",
  };
  if (operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE") return {
    ...common, expectedVersion: 0, name: "Governed target", targetType: "PARTNER_PORTAL", channelReference: "channel-1",
    policyReference: "target-policy-1", allowedFieldReferences: ["field-title"],
  };
  if (operation.includes("ROLE_ASSIGNMENT")) return { ...common, proposalId: "proposal-1", roleAssignmentId: "assignment-1" };
  if (operation.includes("ROLE_CHANGE")) return { ...common, roleId: "role-1", ...(operation.startsWith("PROPOSE_") ? { proposedChangeReference: "change-1" } : { proposalId: "proposal-1" }) };
  if (operation.includes("POLICY_CHANGE")) return { ...common, policyId: "policy-1", ...(operation.startsWith("PROPOSE_") ? { proposedChangeReference: "change-1" } : { proposalId: "proposal-1" }) };
  if (operation.includes("TEAM_SCOPE_CHANGE")) return { ...common, teamId: "team-1", ...(operation.startsWith("PROPOSE_") ? { proposedChangeReference: "change-1" } : { proposalId: "proposal-1" }) };
  if (operation.includes("SOURCE_GOVERNANCE")) return { ...common, proposalId: "proposal-1", sourceRegistryEntryId: "source-1", ...(operation.startsWith("TRANSITION_") ? { targetStatus: "PAUSED" } : {}) };
  return { ...common, proposalId: "proposal-1", publicationTargetId: "target-1", ...(operation.startsWith("TRANSITION_") ? { targetStatus: "PAUSED" } : {}) };
}

function validQueryPayload(operation: AdministrationApiQueryOperation): Record<string, unknown> {
  const payload: Record<string, unknown> = { scope: operationScope(operation) };
  const identity: Partial<Record<AdministrationApiQueryOperation, readonly [string, string]>> = {
    READ_ROLE_ASSIGNMENT: ["roleAssignmentId", "assignment-1"], READ_ROLE: ["roleId", "role-1"], READ_POLICY: ["policyId", "policy-1"],
    READ_TEAM_SCOPE: ["teamId", "team-1"], READ_SOURCE_GOVERNANCE: ["sourceRegistryEntryId", "source-1"],
    READ_PUBLICATION_TARGET_GOVERNANCE: ["publicationTargetId", "target-1"], READ_ADMINISTRATION_DECISION: ["decisionId", "decision-1"],
  };
  const pair = identity[operation];
  if (pair !== undefined) payload[pair[0]] = pair[1]; else payload["pagination"] = { limit: 25 };
  return payload;
}
