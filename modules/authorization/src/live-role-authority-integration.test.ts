import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import {
  createAdministrationBackedAuthorizationService,
} from "../../administration/src/live-assignment-adapter.js";
import {
  InMemoryAdministrationUnitOfWork,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyRecord,
  type AdministrationProposalRecord,
  type AdministrationTransactionIdentity,
  type RoleAssignmentPersistenceRecord,
  type RolePersistenceRecord,
} from "../../administration/src/administration-persistence.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { AuthorizationService } from "./authorization-service.js";

const identity: AdministrationTransactionIdentity = Object.freeze({
  tenantId: "tenant-live-1",
  resourceType: "ROLE_ASSIGNMENT",
  resourceId: "assignment-live-1",
});
const scope = Object.freeze({ tenantId: "tenant-live-1", scopeType: "TEAM" as const, scopeId: "team-live-a" });
const evidence = (id: string) => Object.freeze({ type: "AUDIT" as const, id, version: 1 });

function assignment(version = 1, status: RoleAssignmentPersistenceRecord["status"] = "PROPOSED"): RoleAssignmentPersistenceRecord {
  return {
    recordType: "ROLE_ASSIGNMENT", tenantId: identity.tenantId, roleAssignmentId: identity.resourceId,
    proposalId: "proposal-live-1", scope, subjectPrincipalId: "principal-live-1", subjectPrincipalType: "HUMAN",
    roleId: "role-agent-live", teamIds: ["team-live-a"], resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-14T00:00:00.000Z", effectiveUntil: "2026-08-16T00:00:00.000Z",
    status, version, proposedBy: "principal-admin-1", ...(status === "ACTIVE" ? { approvedBy: "principal-admin-2" } : {}),
    ...(status === "REVOKED" ? { approvedBy: "principal-admin-2", revokedBy: "principal-admin-3" } : {}),
    reasonReference: "reason-live-1", evidenceReferences: status === "PROPOSED"
      ? [evidence("evidence-live-1")]
      : [evidence("evidence-live-1"), evidence("evidence-decision-live-1")],
  };
}

function proposal(status: AdministrationProposalRecord["status"] = "PROPOSED", version = 1, overrides: Partial<AdministrationProposalRecord> = {}): AdministrationProposalRecord {
  return {
    proposalId: "proposal-live-1", tenantId: identity.tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId,
    resourceVersion: 1, scope, proposedBy: "principal-admin-1", proposedChangeReference: "change-live-1",
    policyReference: "policy-live-1", status, version, reasonReference: "reason-live-1",
    evidenceReferences: [evidence("evidence-proposal-live-1")], ...overrides,
  };
}

function decision(overrides: Partial<AdministrationDecisionRecord> = {}): AdministrationDecisionRecord {
  return {
    decisionId: "decision-live-1", proposalId: "proposal-live-1", tenantId: identity.tenantId,
    operation: "APPROVE_ROLE_ASSIGNMENT", resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId, scope,
    proposerId: "principal-admin-1", decisionActorId: "principal-admin-2", status: "APPROVED",
    reasonReference: "reason-decision-live-1", evidenceReferences: [evidence("evidence-decision-live-1")],
    version: 2, decidedAt: "2026-08-14T01:00:00.000Z", ...overrides,
  };
}

function idempotency(overrides: Partial<AdministrationIdempotencyRecord> = {}): AdministrationIdempotencyRecord {
  return {
    ...identity, idempotencyKey: "fixture-live-authority-0001", operation: "APPROVE_ROLE_ASSIGNMENT",
    fingerprint: "fingerprint-live-1", resultReference: "decision-live-1", resultVersion: 2,
    recordedAt: "2026-08-14T01:00:00.000Z", ...overrides,
  };
}

function stageProposal(unitOfWork: InMemoryAdministrationUnitOfWork): void {
  const transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(assignment());
  transaction.proposals.save(proposal());
  transaction.idempotency.record(idempotency({
    idempotencyKey: "fixture-live-authority-proposal-0001", operation: "PROPOSE_ROLE_ASSIGNMENT",
    resultReference: "proposal-live-1", resultVersion: 1,
  }));
  transaction.commit();
}

function stageApproval(unitOfWork: InMemoryAdministrationUnitOfWork): void {
  const transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision());
  transaction.idempotency.record(idempotency());
  transaction.commit();
}

function stageRevocation(unitOfWork: InMemoryAdministrationUnitOfWork): void {
  const revokeProposal = proposal("PROPOSED", 1, {
    proposalId: "proposal-live-revoke", resourceVersion: 2, proposedChangeReference: "change-live-revoke",
  });
  let transaction = unitOfWork.begin(identity);
  transaction.proposals.save(revokeProposal);
  transaction.idempotency.record(idempotency({
    idempotencyKey: "fixture-live-authority-revoke-proposal-0001", operation: "PROPOSE_ROLE_ASSIGNMENT",
    resultReference: revokeProposal.proposalId, resultVersion: 1,
  }));
  transaction.commit();
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(2, {
    ...assignment(3, "REVOKED"), proposalId: "proposal-live-1",
    evidenceReferences: [...assignment(2, "ACTIVE").evidenceReferences, evidence("evidence-live-revoke")],
  });
  transaction.proposals.update(1, {
    ...revokeProposal, status: "REVOKED", version: 2,
    evidenceReferences: [...revokeProposal.evidenceReferences, evidence("evidence-live-revoke")],
  });
  transaction.decisions.append(decision({
    decisionId: "decision-live-revoke", proposalId: revokeProposal.proposalId,
    operation: "REVOKE_ROLE_ASSIGNMENT", status: "REVOKED", decisionActorId: "principal-admin-3", version: 3,
  }));
  transaction.idempotency.record(idempotency({
    idempotencyKey: "fixture-live-authority-revoke-0001", operation: "REVOKE_ROLE_ASSIGNMENT",
    resultReference: "decision-live-revoke", resultVersion: 3,
  }));
  transaction.commit();
}

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({
    id: "session-live-1", principalId: "principal-live-1", principalType: "HUMAN", roles: ["ADM"] as const,
    teamId: "team-live-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true,
    authenticatedAt: "2026-08-14T00:00:00.000Z", expiresAt: "2026-08-14T04:00:00.000Z",
    absoluteExpiresAt: "2026-08-15T00:00:00.000Z", familyId: "family-live-1", refreshReference: "refresh-live-1",
    ...overrides,
  });
}

function request(actor = session(), overrides: Record<string, unknown> = {}) {
  return {
    session: actor, action: "resource.view", resource: {
      type: "CandidateListing", id: "candidate-live-1", tenantId: "tenant-live-1", teamId: "team-live-a",
    }, purpose: "CLIENT_SERVICE", correlationId: "correlation-live-1", ...overrides,
  } as const;
}

function fixture() {
  const role: RolePersistenceRecord = {
    recordType: "ROLE", tenantId: identity.tenantId, roleId: "role-agent-live", roleCode: "AGT",
    scope: { tenantId: identity.tenantId, scopeType: "TENANT", scopeId: identity.tenantId },
    status: "ACTIVE", policyReference: "policy-role-agent-live", version: 1,
    evidenceReferences: [evidence("evidence-role-agent-live")],
  };
  const unitOfWork = InMemoryAdministrationUnitOfWork.rehydrate({ roles: [role] });
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: (() => { let sequence = 0; return () => `audit-live-${String(++sequence)}`; })() });
  const service = createAdministrationBackedAuthorizationService({
    roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles,
    proposals: unitOfWork.proposals, decisions: unitOfWork.decisions,
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  return { unitOfWork, service };
}

test("F16-PHASE-7 proposal is not authority and activation/revocation are visible without reconstruction", () => {
  const { unitOfWork, service } = fixture();
  assert.equal(service.evaluate(request()).reasonCode, "NO_ACTIVE_ASSIGNMENT");
  stageProposal(unitOfWork);
  assert.equal(service.evaluate(request()).reasonCode, "NO_ACTIVE_ASSIGNMENT");
  stageApproval(unitOfWork);
  const stateBeforeEvaluation = unitOfWork.roleAssignments.find(identity);
  const allowed = service.evaluate(request());
  assert.equal(allowed.effect, "ALLOW");
  assert.deepEqual(allowed.assignmentIds, [identity.resourceId]);
  assert.deepEqual(unitOfWork.roleAssignments.find(identity), stateBeforeEvaluation);
  stageRevocation(unitOfWork);
  assert.equal(service.evaluate(request()).reasonCode, "NO_ACTIVE_ASSIGNMENT");
});

test("F16-PHASE-7 ignores stale Session roles and enforces tenant and team scope", () => {
  const { unitOfWork, service } = fixture();
  stageProposal(unitOfWork); stageApproval(unitOfWork);
  assert.equal(service.evaluate(request(session({ roles: [] }))).effect, "ALLOW");
  assert.equal(service.evaluate(request(session({ roles: ["ADM"] }))).effect, "ALLOW");
  assert.equal(service.evaluate(request(session(), { resource: { type: "CandidateListing", id: "candidate-live-2", tenantId: "tenant-live-2", teamId: "team-live-a" } })).reasonCode, "NO_ACTIVE_ASSIGNMENT");
  assert.equal(service.evaluate(request(session(), { resource: { type: "CandidateListing", id: "candidate-live-3", tenantId: "tenant-live-1", teamId: "team-live-b" } })).reasonCode, "NO_ACTIVE_ASSIGNMENT");
});

test("F16-PHASE-7R Session Role and caller claims cannot replace missing canonical Role resolution", () => {
  const unitOfWork = new InMemoryAdministrationUnitOfWork();
  stageProposal(unitOfWork); stageApproval(unitOfWork);
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => "audit-live-no-role" });
  const service = createAdministrationBackedAuthorizationService({
    roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles,
    proposals: unitOfWork.proposals, decisions: unitOfWork.decisions,
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  const result = service.evaluate(request(session({ roles: ["AGT", "ADM"] }), {
    claimedRole: "AGT", claimedCapabilities: ["resource.view"],
  }));
  assert.equal(result.effect, "DENY");
  assert.equal(result.reasonCode, "AUTHORITY_RESOLUTION_FAILED");
});

test("F16-PHASE-7 preserves MFA, human actor and SoD boundaries", () => {
  const assignmentResolver = { resolveCurrentAssignments: () => [{
    id: "assignment-admin-live", principalId: "principal-admin-live", role: "ADM" as const,
    teamIds: ["team-live-a"], resourceTypes: ["RoleAssignment"], purposes: ["SECURITY_ADMINISTRATION"],
    effectiveFrom: "2026-08-14T00:00:00.000Z", effectiveUntil: "2026-08-16T00:00:00.000Z", status: "ACTIVE" as const,
    version: 1, tenantId: "tenant-live-1", subjectPrincipalType: "HUMAN" as const,
  }] };
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => "audit-live-admin" });
  const service = new AuthorizationService({ liveAssignmentResolver: assignmentResolver, auditSink: audit, clock, policyVersion: "authorization-live-v1" });
  const privileged = {
    session: session({ principalId: "principal-admin-live", roles: [], assurance: "SINGLE_FACTOR", isMfaVerified: false }),
    action: "admin.role.approve", resource: { type: "RoleAssignment", id: "assignment-target", tenantId: "tenant-live-1", teamId: "team-live-a" },
    purpose: "SECURITY_ADMINISTRATION", reason: "approved reason", correlationId: "correlation-admin-live",
  } as const;
  assert.equal(service.evaluate(privileged).reasonCode, "REAUTHENTICATION_REQUIRED");
  assert.equal(service.evaluate({ ...privileged, session: session({ principalId: "principal-admin-live", roles: [], principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false }) }).reasonCode, "HUMAN_AUTHORITY_REQUIRED");
  assert.equal(service.evaluate({ ...privileged, session: session({ principalId: "principal-admin-live", roles: [] }), resource: { ...privileged.resource, createdBy: "principal-admin-live" } }).reasonCode, "SEPARATION_OF_DUTIES_DENIED");
});

test("F16-PHASE-7 expiry, multiple assignments and administrator boundary remain fail closed", () => {
  const now = new Date("2026-08-14T01:30:00.000Z");
  const clock = (): Date => new Date(now);
  const audit = new AuditLog({ clock, idFactory: (() => { let sequence = 0; return () => `audit-live-extra-${String(++sequence)}`; })() });
  const service = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => [{
      id: "assignment-expired", principalId: "principal-live-1", role: "AGT", teamIds: ["team-live-a"],
      resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"], effectiveFrom: "2026-08-13T00:00:00.000Z",
      effectiveUntil: "2026-08-14T01:00:00.000Z", status: "ACTIVE", version: 4,
      tenantId: "tenant-live-1", subjectPrincipalType: "HUMAN",
    }, {
      id: "assignment-admin", principalId: "principal-live-1", role: "ADM", teamIds: ["team-live-a"],
      resourceTypes: ["Publication"], purposes: ["PUBLICATION_EXECUTION"], effectiveFrom: "2026-08-13T00:00:00.000Z",
      effectiveUntil: "2026-08-16T00:00:00.000Z", status: "ACTIVE", version: 2,
      tenantId: "tenant-live-1", subjectPrincipalType: "HUMAN",
    }] },
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  assert.equal(service.evaluate(request()).reasonCode, "SCOPE_DENIED");
  const publicationDecision = service.evaluate({
    session: session({ roles: ["OPS", "ADM"] }), action: "publication.create",
    resource: { type: "Publication", id: "publication-live-1", tenantId: "tenant-live-1", teamId: "team-live-a" },
    purpose: "PUBLICATION_EXECUTION", reason: "approved reason", correlationId: "correlation-live-publication",
  });
  assert.equal(publicationDecision.effect, "DENY");
  assert.equal(publicationDecision.reasonCode, "CAPABILITY_DENIED");
});

test("F16-PHASE-7R explicit SoD deny takes precedence over a stacked capability allow", () => {
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => "audit-live-stacking" });
  const base = {
    principalId: "principal-live-1", teamIds: ["team-live-a"], resourceTypes: ["Publication"],
    purposes: ["PUBLICATION_EXECUTION"], effectiveFrom: "2026-08-14T00:00:00.000Z",
    effectiveUntil: "2026-08-16T00:00:00.000Z", status: "ACTIVE" as const,
    tenantId: "tenant-live-1", subjectPrincipalType: "HUMAN" as const,
  };
  const service = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => [
      { ...base, id: "assignment-approver", role: "PUA" as const, version: 2 },
      { ...base, id: "assignment-executor", role: "OPS" as const, version: 4 },
    ] },
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  const result = service.evaluate({
    session: session({ roles: [] }), action: "publication.approve",
    resource: { type: "Publication", id: "publication-live-stacked", tenantId: "tenant-live-1", teamId: "team-live-a" },
    purpose: "PUBLICATION_EXECUTION", reason: "independent approval", correlationId: "correlation-live-stacked",
  });
  assert.equal(result.effect, "DENY");
  assert.equal(result.reasonCode, "SEPARATION_OF_DUTIES_DENIED");
  const execution = service.evaluate({
    session: session({ roles: [] }), action: "publication.create",
    resource: { type: "Publication", id: "publication-live-execution", tenantId: "tenant-live-1", teamId: "team-live-a" },
    purpose: "PUBLICATION_EXECUTION", reason: "independent execution", correlationId: "correlation-live-execution",
  });
  assert.equal(execution.reasonCode, "SEPARATION_OF_DUTIES_DENIED");
  const boundedRead = service.evaluate({
    session: session({ roles: [] }), action: "publication.approval.read",
    resource: { type: "Publication", id: "publication-live-read", tenantId: "tenant-live-1", teamId: "team-live-a" },
    purpose: "PUBLICATION_EXECUTION", correlationId: "correlation-live-read",
  });
  assert.equal(boundedRead.effect, "ALLOW");
});

test("F16-PHASE-7R unrelated live assignments do not contribute and wrong purpose defaults to deny", () => {
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: (() => { let sequence = 0; return () => `audit-live-scope-${String(++sequence)}`; })() });
  const common = {
    principalId: "principal-live-1", effectiveFrom: "2026-08-14T00:00:00.000Z",
    effectiveUntil: "2026-08-16T00:00:00.000Z", status: "ACTIVE" as const,
    tenantId: "tenant-live-1", subjectPrincipalType: "HUMAN" as const,
  };
  const service = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => [
      { ...common, id: "assignment-applicable", role: "AGT" as const, version: 2,
        teamIds: ["team-live-a"], resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"] },
      { ...common, id: "assignment-unrelated", role: "OPS" as const, version: 5,
        teamIds: ["team-live-b"], resourceTypes: ["Publication"], purposes: ["PUBLICATION_EXECUTION"] },
    ] },
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  assert.equal(service.evaluate(request(session({ roles: [] }))).effect, "ALLOW");
  assert.equal(service.evaluate(request(session({ roles: [] }), { purpose: "UNRELATED_PURPOSE" })).reasonCode, "SCOPE_DENIED");
});

test("F16-PHASE-7 resolver failure and corrupt authority fail closed without mutating inputs", () => {
  const clock = (): Date => new Date("2026-08-14T01:30:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => "audit-live-failure" });
  const actor = session({ roles: ["AGT"] });
  const authorizationRequest = request(actor);
  const before = structuredClone(authorizationRequest);
  const service = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => { throw new Error("internal repository path D:\\private"); } },
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  const decision = service.evaluate(authorizationRequest);
  assert.equal(decision.effect, "DENY");
  assert.equal(decision.reasonCode, "AUTHORITY_RESOLUTION_FAILED");
  assert.deepEqual(authorizationRequest, before);
  assert.equal(JSON.stringify(decision).includes("repository"), false);
  assert.equal(JSON.stringify(decision).includes("private"), false);

  const inconsistent = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => [{
      id: "assignment-wrong-tenant", principalId: actor.principalId, subjectPrincipalType: "HUMAN",
      tenantId: "tenant-other", version: 1, role: "AGT", teamIds: ["team-live-a"],
      resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"],
      effectiveFrom: "2026-08-14T00:00:00.000Z", effectiveUntil: "2026-08-16T00:00:00.000Z", status: "ACTIVE",
    }] },
    auditSink: audit, clock, policyVersion: "authorization-live-v1",
  });
  assert.equal(inconsistent.evaluate(authorizationRequest).reasonCode, "AUTHORITY_RESOLUTION_FAILED");
});
