import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import {
  createAdministrationBackedAuthorizationService,
  InMemoryAdministrationUnitOfWork,
  type AdministrationDecisionRecord,
  type AdministrationIdempotencyRecord,
  type AdministrationProposalRecord,
  type AdministrationTransactionIdentity,
  type AdministrationUnitOfWork,
  type RoleAssignmentPersistenceRecord,
  type RolePersistenceRecord,
} from "../../../modules/administration/src/index.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { AdministrationApiError, safeAdministrationApiError } from "./administration-api-contracts.js";
import { AdministrationGovernanceApplication } from "./administration-governance-api.js";
import { composeAdministrationApi015NodeHttpServer } from "./composition.js";
import { createAdministrationHttpRequestHandler } from "./administration-http-adapter.js";

const now = "2026-08-20T01:00:00.000Z";
const tenantId = "tenant-phase8";
const teamId = "team-phase8";
const evidence = (id: string) => ({ type: "AUDIT" as const, id, version: 1 });

function session(principalId: string, principalTeamId = teamId): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`, principalId, principalType: "HUMAN", roles: [] as const, teamId: principalTeamId,
    state: "ACTIVE", assurance: "MFA", isMfaVerified: true,
    authenticatedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T04:00:00.000Z",
    absoluteExpiresAt: "2026-08-21T00:00:00.000Z", familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

function activateSecurityAuthority(
  unitOfWork: InMemoryAdministrationUnitOfWork,
  principalId: string,
  overrides: Readonly<Partial<Pick<RoleAssignmentPersistenceRecord,
  "effectiveFrom" | "effectiveUntil" | "purposes" | "resourceTypes" | "roleId">>> = {},
  authorityTeamId = teamId,
): void {
  const suffix = principalId.replaceAll("-", "_");
  const identity: AdministrationTransactionIdentity = {
    tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: `assignment-${suffix}`,
  };
  const scope = { tenantId, scopeType: "TEAM" as const, scopeId: authorityTeamId };
  const proposalId = `proposal-authority-${suffix}`;
  const assignmentEvidence = evidence(`evidence-authority-${suffix}`);
  const decisionEvidence = evidence(`evidence-authority-decision-${suffix}`);
  const assignment = (version: number, status: RoleAssignmentPersistenceRecord["status"]): RoleAssignmentPersistenceRecord => ({
    recordType: "ROLE_ASSIGNMENT", tenantId, roleAssignmentId: identity.resourceId, proposalId,
    subjectPrincipalId: principalId, subjectPrincipalType: "HUMAN", roleId: "role-security-phase8",
    teamIds: [authorityTeamId], resourceTypes: [
      "Administration:POLICY:policy-scope-phase8",
      "Administration:SOURCE:source-scope-phase8",
      "Administration:TARGET:target-scope-phase8",
      `Administration:TEAM:${authorityTeamId}`,
    ], purposes: ["ACCESS_GOVERNANCE"], effectiveFrom: "2026-08-20T00:00:00.000Z",
    effectiveUntil: "2026-08-21T00:00:00.000Z", status, version,
    proposedBy: `authority-proposer-${suffix}`, ...(status === "ACTIVE" ? { approvedBy: `authority-approver-${suffix}` } : {}),
    reasonReference: `reason-authority-${suffix}`,
    evidenceReferences: status === "ACTIVE" ? [assignmentEvidence, decisionEvidence] : [assignmentEvidence],
    scope, ...overrides,
  });
  const proposal = (status: AdministrationProposalRecord["status"], version: number): AdministrationProposalRecord => ({
    proposalId, tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId, resourceVersion: 1,
    proposedBy: `authority-proposer-${suffix}`, proposedChangeReference: `change-authority-${suffix}`,
    policyReference: "policy-role-security-phase8", status, version,
    reasonReference: `reason-authority-${suffix}`, evidenceReferences: [assignmentEvidence], scope,
  });
  const idempotency = (overrides: Partial<AdministrationIdempotencyRecord>): AdministrationIdempotencyRecord => ({
    ...identity, idempotencyKey: `idem-authority-${suffix}`, operation: "APPROVE_ROLE_ASSIGNMENT",
    fingerprint: `fingerprint-authority-${suffix}`, resultReference: `decision-authority-${suffix}`,
    resultVersion: 2, recordedAt: now, ...overrides,
  });
  let transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.save(assignment(1, "PROPOSED"));
  transaction.proposals.save(proposal("PROPOSED", 1));
  transaction.idempotency.record(idempotency({
    idempotencyKey: `idem-authority-propose-${suffix}`, operation: "PROPOSE_ROLE_ASSIGNMENT",
    resultReference: proposalId, resultVersion: 1,
  }));
  transaction.commit();
  const decision: AdministrationDecisionRecord = {
    decisionId: `decision-authority-${suffix}`, proposalId, tenantId, operation: "APPROVE_ROLE_ASSIGNMENT",
    resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId, scope,
    proposerId: `authority-proposer-${suffix}`, decisionActorId: `authority-approver-${suffix}`,
    status: "APPROVED", reasonReference: `reason-authority-decision-${suffix}`,
    evidenceReferences: [decisionEvidence], version: 2, decidedAt: now,
  };
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(1, assignment(2, "ACTIVE"));
  transaction.proposals.update(1, proposal("APPROVED", 2));
  transaction.decisions.append(decision);
  transaction.idempotency.record(idempotency({}));
  transaction.commit();
}

function revokeSecurityAuthority(unitOfWork: InMemoryAdministrationUnitOfWork, principalId: string): void {
  const suffix = principalId.replaceAll("-", "_");
  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: `assignment-${suffix}` };
  const current = unitOfWork.roleAssignments.find(identity);
  assert.ok(current);
  const scope = current.scope;
  const proposalId = `proposal-authority-revoke-${suffix}`;
  const revokeEvidence = evidence(`evidence-authority-revoke-${suffix}`);
  const proposal: AdministrationProposalRecord = {
    proposalId, tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: identity.resourceId,
    resourceVersion: current.version, proposedBy: `authority-revoke-proposer-${suffix}`,
    proposedChangeReference: `change-authority-revoke-${suffix}`, policyReference: "policy-role-security-phase8",
    status: "PROPOSED", version: 1, reasonReference: `reason-authority-revoke-${suffix}`,
    evidenceReferences: [revokeEvidence], scope,
  };
  let transaction = unitOfWork.begin(identity);
  transaction.proposals.save(proposal);
  transaction.idempotency.record({
    ...identity, idempotencyKey: `idem-authority-revoke-proposal-${suffix}`, operation: "PROPOSE_ROLE_ASSIGNMENT",
    fingerprint: `fingerprint-authority-revoke-proposal-${suffix}`, resultReference: proposalId,
    resultVersion: 1, recordedAt: now,
  });
  transaction.commit();
  const decisionId = `decision-authority-revoke-${suffix}`;
  const decisionReference = evidence(decisionId);
  transaction = unitOfWork.begin(identity);
  transaction.roleAssignments.update(current.version, {
    ...current, status: "REVOKED", version: current.version + 1, revokedBy: `authority-revoker-${suffix}`,
    evidenceReferences: [...current.evidenceReferences, decisionReference],
  });
  transaction.proposals.update(1, {
    ...proposal, status: "REVOKED", version: 2,
    evidenceReferences: [...proposal.evidenceReferences, decisionReference],
  });
  transaction.decisions.append({
    decisionId, proposalId, tenantId, operation: "REVOKE_ROLE_ASSIGNMENT", resourceType: "ROLE_ASSIGNMENT",
    resourceId: identity.resourceId, scope, proposerId: proposal.proposedBy,
    decisionActorId: `authority-revoker-${suffix}`, status: "REVOKED",
    reasonReference: `reason-authority-revoke-decision-${suffix}`, evidenceReferences: [decisionReference],
    version: current.version + 1, decidedAt: now,
  });
  transaction.idempotency.record({
    ...identity, idempotencyKey: `idem-authority-revoke-${suffix}`, operation: "REVOKE_ROLE_ASSIGNMENT",
    fingerprint: `fingerprint-authority-revoke-${suffix}`, resultReference: decisionId,
    resultVersion: current.version + 1, recordedAt: now,
  });
  transaction.commit();
}

function fixture(
  wrapUnitOfWork?: (unitOfWork: InMemoryAdministrationUnitOfWork) => AdministrationUnitOfWork,
  additionalRoles: readonly RolePersistenceRecord[] = [],
) {
  const role: RolePersistenceRecord = {
    recordType: "ROLE", tenantId, roleId: "role-security-phase8", roleCode: "SEC",
    scope: { tenantId, scopeType: "TENANT", scopeId: tenantId }, status: "ACTIVE",
    policyReference: "policy-role-security-phase8", version: 1,
    evidenceReferences: [evidence("evidence-role-security-phase8")],
  };
  const governedRole: RolePersistenceRecord = {
    recordType: "ROLE", tenantId, roleId: "role-agent-phase9", roleCode: "AGT",
    scope: { tenantId, scopeType: "TENANT", scopeId: tenantId }, status: "ACTIVE",
    policyReference: "policy-role-agent-phase9", version: 1,
    evidenceReferences: [evidence("evidence-role-agent-phase9")],
  };
  const retiredRole: RolePersistenceRecord = {
    ...role, roleId: "role-security-retired-phase9", status: "RETIRED",
    evidenceReferences: [evidence("evidence-role-security-retired-phase9")],
  };
  const unitOfWork = InMemoryAdministrationUnitOfWork.rehydrate({ roles: [role, governedRole, retiredRole, ...additionalRoles] });
  activateSecurityAuthority(unitOfWork, "policy-proposer");
  activateSecurityAuthority(unitOfWork, "policy-approver");
  const sessions = new Map([
    ["session-policy-proposer", session("policy-proposer")],
    ["session-policy-approver", session("policy-approver")],
  ]);
  const clock = () => new Date(now);
  const authorizationService = createAdministrationBackedAuthorizationService({
    roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles,
    proposals: unitOfWork.proposals, decisions: unitOfWork.decisions,
    auditSink: new AuditLog({ clock, idFactory: (() => { let value = 0; return () => `audit-phase8-${++value}`; })() }),
    clock, policyVersion: "authorization-phase8-v1",
  });
  let id = 0;
  const application = new AdministrationGovernanceApplication({
    authorizationService, unitOfWork: wrapUnitOfWork?.(unitOfWork) ?? unitOfWork,
    roleAssignments: unitOfWork.roleAssignments, roles: unitOfWork.roles,
    policies: unitOfWork.policies, teamScopes: unitOfWork.teamScopes, sourceGovernance: unitOfWork.sourceGovernance,
    publicationTargets: unitOfWork.publicationTargets, proposals: unitOfWork.proposals,
    decisions: unitOfWork.decisions, idempotency: unitOfWork.idempotency,
    sessionResolver: { resolve: (sessionId) => sessions.get(sessionId) }, clock,
    idFactory: () => `phase8-${++id}`,
  });
  return { application, unitOfWork, sessions };
}

function command(operation: string, sessionId: string, payload: Record<string, unknown>) {
  return {
    requestId: `request-${operation.toLowerCase()}`, sessionId, tenantId,
    correlationId: `correlation-${operation.toLowerCase()}`, operation, payload,
  };
}

const policyScope = { tenantId, scopeType: "POLICY", scopeId: "policy-scope-phase8" } as const;
const sourceScope = { tenantId, scopeType: "SOURCE", scopeId: "source-scope-phase8" } as const;
const targetScope = { tenantId, scopeType: "TARGET", scopeId: "target-scope-phase8" } as const;
const roleAssignmentScope = { tenantId, scopeType: "TEAM", scopeId: teamId } as const;
const common = (scope: object, expectedVersion: number, idempotencyKey: string) => ({
  scope, expectedVersion, idempotencyKey, reason: "approved phase 8 governance reason",
  evidenceReferences: [evidence(`evidence-${idempotencyKey}`)],
});

function roleAssignmentProposal(idempotencyKey: string) {
  return {
    subjectPrincipalId: "principal-agent-phase9", subjectPrincipalType: "HUMAN", role: "AGT",
    teamIds: [teamId], resourceTypes: ["CandidateListing"], purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-08-20T00:00:00.000Z", effectiveUntil: "2026-08-21T00:00:00.000Z",
    ...common(roleAssignmentScope, 0, idempotencyKey),
  };
}

test("F16-PHASE-9 Role Assignment proposal and independent approval use the canonical UoW", () => {
  const { application, unitOfWork } = fixture();
  const proposedInput = command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-propose-phase9"));
  const proposed = application.execute(proposedInput);
  assert.equal(proposed.status, "PROPOSED");
  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: proposed.resourceId };
  assert.equal(unitOfWork.roleAssignments.find(identity)?.proposedBy, "policy-proposer");

  const approvedInput = command("APPROVE_ROLE_ASSIGNMENT", "session-policy-approver", {
    proposalId: proposed.proposalId, roleAssignmentId: proposed.resourceId,
    ...common(roleAssignmentScope, 1, "idem-role-approve-phase9"),
  });
  const approved = application.execute(approvedInput);
  assert.equal(approved.status, "ACTIVE");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.approvedBy, "policy-approver");
  assert.equal(unitOfWork.decisions.list(identity).length, 1);
  assert.deepEqual(application.execute(approvedInput), approved);
  assert.equal(unitOfWork.decisions.list(identity).length, 1);
});

test("F16-PHASE-9A ACTIVE Role Assignment successor proposal enables canonical revocation", () => {
  const { application, unitOfWork } = fixture();
  const initial = application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-initial-phase9a")));
  application.execute(command("APPROVE_ROLE_ASSIGNMENT", "session-policy-approver", {
    proposalId: initial.proposalId, roleAssignmentId: initial.resourceId,
    ...common(roleAssignmentScope, 1, "idem-role-activate-phase9a"),
  }));
  const successor = application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", {
    ...roleAssignmentProposal("idem-role-successor-phase9a"),
    roleAssignmentId: initial.resourceId, expectedVersion: 2,
  }));
  assert.equal(successor.resourceId, initial.resourceId);
  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: initial.resourceId };
  assert.equal(unitOfWork.roleAssignments.find(identity)?.status, "ACTIVE");

  const revokeInput = command("REVOKE_ROLE_ASSIGNMENT", "session-policy-approver", {
    proposalId: successor.proposalId, roleAssignmentId: initial.resourceId,
    ...common(roleAssignmentScope, 2, "idem-role-revoke-phase9a"),
  });
  const revoked = application.execute(revokeInput);
  assert.equal(revoked.status, "REVOKED");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.revokedBy, "policy-approver");
  assert.equal(unitOfWork.decisions.list(identity).length, 2);
  assert.deepEqual(application.execute(revokeInput), revoked);
  assert.equal(unitOfWork.decisions.list(identity).length, 2);
});

test("F16-PHASE-9 Role Assignment read and list are live-authorized and scope bounded", () => {
  const { application } = fixture();
  const proposed = application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-query-phase9")));
  const read = application.read(command("READ_ROLE_ASSIGNMENT", "session-policy-proposer", {
    roleAssignmentId: proposed.resourceId, scope: roleAssignmentScope,
  }));
  assert.equal("viewType" in read && read.viewType, "ROLE_ASSIGNMENT");
  const listed = application.list(command("LIST_ROLE_ASSIGNMENTS", "session-policy-proposer", {
    scope: roleAssignmentScope, status: "PROPOSED", pagination: { limit: 25 },
  }));
  assert.equal("items" in listed && listed.items.length, 1);
});

test("F16-PHASE-11A LIST_ROLES returns authorized scope-bounded selector views in canonical ID order", () => {
  const { application, unitOfWork, sessions } = fixture();
  activateSecurityAuthority(unitOfWork, "tenant-role-reader", {
    resourceTypes: [`Administration:TENANT:${tenantId}`],
  });
  sessions.set("session-tenant-role-reader", session("tenant-role-reader"));

  const listed = application.list(command("LIST_ROLES", "session-tenant-role-reader", {
    scope: { tenantId, scopeType: "TENANT", scopeId: tenantId },
    status: "ACTIVE",
    pagination: { limit: 10 },
  }));

  assert.deepEqual(listed.items.map((item) => "roleId" in item ? item.roleId : undefined), [
    "role-agent-phase9",
    "role-security-phase8",
  ]);
  assert.equal(listed.items.every((item) => item.viewType === "ROLE" && item.status === "ACTIVE"), true);
  assert.deepEqual(listed.items.map((item) => "roleCode" in item ? item.roleCode : undefined), ["AGT", "SEC"]);
  assert.equal(Object.isFrozen(listed), true);
  assert.equal(Object.isFrozen(listed.items), true);
});

test("F16-PHASE-11A selector lists expose deterministic bounded continuation without duplicate records", () => {
  const { application, unitOfWork, sessions } = fixture();
  activateSecurityAuthority(unitOfWork, "tenant-pagination-reader", {
    resourceTypes: [`Administration:TENANT:${tenantId}`],
  });
  sessions.set("session-tenant-pagination-reader", session("tenant-pagination-reader"));
  const scope = { tenantId, scopeType: "TENANT" as const, scopeId: tenantId };

  const first = application.list(command("LIST_ROLES", "session-tenant-pagination-reader", {
    scope, status: "ACTIVE", pagination: { limit: 1 },
  }));
  assert.deepEqual(first.items.map((item) => "roleId" in item ? item.roleId : undefined), ["role-agent-phase9"]);
  assert.equal(first.nextCursor, "role-agent-phase9");

  const second = application.list(command("LIST_ROLES", "session-tenant-pagination-reader", {
    scope, status: "ACTIVE", pagination: { limit: 1, cursor: first.nextCursor },
  }));
  assert.deepEqual(second.items.map((item) => "roleId" in item ? item.roleId : undefined), ["role-security-phase8"]);
  assert.equal(second.nextCursor, undefined);
});

test("F16-PHASE-11A selector pagination uses the same canonical comparator for cursor continuation", () => {
  const mixedCaseRole: RolePersistenceRecord = {
    recordType: "ROLE" as const,
    tenantId,
    roleId: "role-Z-phase11a",
    roleCode: "SEC",
    scope: { tenantId, scopeType: "TENANT" as const, scopeId: tenantId },
    status: "ACTIVE" as const,
    policyReference: "policy-role-mixed-case-phase11a",
    version: 1,
    evidenceReferences: [evidence("evidence-role-mixed-case-phase11a")],
  };
  const { application, unitOfWork, sessions } = fixture(undefined, [mixedCaseRole]);
  activateSecurityAuthority(unitOfWork, "tenant-pagination-reader", {
    resourceTypes: [`Administration:TENANT:${tenantId}`],
  });
  sessions.set("session-tenant-pagination-reader", session("tenant-pagination-reader"));

  const scope = { tenantId, scopeType: "TENANT" as const, scopeId: tenantId };
  const first = application.list(command("LIST_ROLES", "session-tenant-pagination-reader", {
    scope, status: "ACTIVE", pagination: { limit: 1 },
  }));
  const second = application.list(command("LIST_ROLES", "session-tenant-pagination-reader", {
    scope, status: "ACTIVE", pagination: { limit: 2, cursor: first.nextCursor },
  }));

  assert.deepEqual(first.items.map((item) => "roleId" in item ? item.roleId : undefined), ["role-agent-phase9"]);
  assert.deepEqual(second.items.map((item) => "roleId" in item ? item.roleId : undefined), [
    "role-security-phase8",
    "role-Z-phase11a",
  ]);
});

test("F16-PHASE-11A LIST_TEAM_SCOPES returns only canonical records in the authorized scope", () => {
  const { application, unitOfWork } = fixture();
  const scope = { tenantId, scopeType: "TEAM" as const, scopeId: teamId };
  const identity = { tenantId, resourceType: "TEAM_SCOPE" as const, resourceId: teamId };
  const transaction = unitOfWork.begin(identity);
  const teamEvidence = evidence("evidence-team-scope-phase11a");
  const proposalId = "proposal-team-scope-phase11a";
  transaction.teamScopes.save({
    recordType: "TEAM_SCOPE", tenantId, teamId, organizationId: "organization-phase11a",
    scope, status: "PROPOSED", version: 1, evidenceReferences: [teamEvidence],
  });
  transaction.proposals.save({
    proposalId, tenantId, resourceType: "TEAM_SCOPE", resourceId: teamId, resourceVersion: 1,
    proposedBy: "policy-proposer", proposedChangeReference: "change-team-scope-phase11a",
    policyReference: "policy-team-scope-phase11a", status: "PROPOSED", version: 1,
    reasonReference: "reason-team-scope-phase11a", evidenceReferences: [teamEvidence], scope,
  });
  transaction.idempotency.record({
    ...identity, idempotencyKey: "idem-team-scope-phase11a", operation: "PROPOSE_TEAM_SCOPE_CHANGE",
    fingerprint: "fingerprint-team-scope-phase11a", resultReference: proposalId,
    resultVersion: 1, recordedAt: now,
  });
  transaction.commit();

  const before = unitOfWork.teamScopes.find(identity);
  const listed = application.list(command("LIST_TEAM_SCOPES", "session-policy-proposer", {
    scope,
    status: "PROPOSED",
    pagination: { limit: 10 },
  }));

  assert.deepEqual(listed.items.map((item) => "teamId" in item ? item.teamId : undefined), [teamId]);
  assert.equal(listed.items[0]?.viewType, "TEAM_SCOPE");
  assert.deepEqual(unitOfWork.teamScopes.find(identity), before);
});

test("F16-PHASE-11A LIST_POLICIES returns authorized canonical IDs and versions without policy internals", () => {
  const { application } = fixture();
  application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-selector-phase11a", proposedChangeReference: "policy-selector-reference-phase11a",
    ...common(policyScope, 0, "idem-policy-selector-phase11a"),
  }));

  const listed = application.list(command("LIST_POLICIES", "session-policy-approver", {
    scope: policyScope,
    status: "PROPOSED",
    pagination: { limit: 10 },
  }));

  assert.deepEqual(listed.items.map((item) => "policyId" in item ? item.policyId : undefined), [
    "policy-selector-phase11a",
  ]);
  assert.equal(listed.items[0]?.viewType, "POLICY");
  assert.equal(listed.items[0]?.version, 1);
  assert.equal(JSON.stringify(listed).includes("proposedChangeReference"), false);
  assert.equal(JSON.stringify(listed).includes("reasonReference"), false);
});

test("F16-PHASE-11B LIST_ADMINISTRATION_PROPOSALS returns safe resource-bound pending proposals", () => {
  const { application } = fixture();
  const proposed = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-proposal-selector-phase11b",
    proposedChangeReference: "policy-change-selector-phase11b",
    ...common(policyScope, 0, "idem-policy-proposal-selector-phase11b"),
  }));

  const listed = application.list(command("LIST_ADMINISTRATION_PROPOSALS", "session-policy-approver", {
    scope: policyScope,
    status: "PROPOSED",
    pagination: { limit: 10 },
  }));

  assert.equal(listed.items.length, 1);
  assert.deepEqual(listed.items[0], {
    viewType: "ADMINISTRATION_PROPOSAL",
    proposalId: proposed.proposalId,
    resourceType: "POLICY",
    resourceId: "policy-proposal-selector-phase11b",
    proposerReference: "policy-proposer",
    proposedChangeReference: "policy-change-selector-phase11b",
    scope: policyScope,
    status: "PROPOSED",
    version: 1,
    evidenceReferences: [{ type: "AUDIT", id: "evidence-idem-policy-proposal-selector-phase11b", version: 1 }],
  });
  assert.equal(Object.isFrozen(listed.items[0]), true);
});

test("F16-PHASE-11A LIST_SOURCE_GOVERNANCE returns safe scoped metadata without source execution", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    name: "Selector Source Phase 11A", sourceType: "PUBLIC_WEBSITE",
    policyReference: "source-selector-policy-phase11a", allowedMethods: ["MANUAL_CAPTURE"],
    allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
    ...common(sourceScope, 0, "idem-source-selector-phase11a"),
  }));
  const identity = { tenantId, resourceType: "SOURCE_REGISTRY" as const, resourceId: proposed.resourceId };
  const before = unitOfWork.sourceGovernance.find(identity);

  const listed = application.list(command("LIST_SOURCE_GOVERNANCE", "session-policy-approver", {
    scope: sourceScope, status: "DRAFT", pagination: { limit: 10 },
  }));

  assert.deepEqual(listed.items.map((item) => "sourceRegistryEntryId" in item ? item.sourceRegistryEntryId : undefined), [proposed.resourceId]);
  assert.equal(listed.items[0]?.viewType, "SOURCE_GOVERNANCE");
  assert.equal(JSON.stringify(listed).includes("allowedMethods"), false);
  assert.equal(JSON.stringify(listed).includes("classification"), false);
  assert.deepEqual(unitOfWork.sourceGovernance.find(identity), before);
});

test("F16-PHASE-11A LIST_PUBLICATION_TARGET_GOVERNANCE returns safe scoped metadata without publication execution", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    name: "Selector Target Phase 11A", targetType: "MLS_PORTAL",
    channelReference: "channel-selector-phase11a", policyReference: "target-selector-policy-phase11a",
    allowedFieldReferences: ["field-selector-phase11a"],
    ...common(targetScope, 0, "idem-target-selector-phase11a"),
  }));
  const identity = { tenantId, resourceType: "PUBLICATION_TARGET" as const, resourceId: proposed.resourceId };
  const before = unitOfWork.publicationTargets.find(identity);

  const listed = application.list(command("LIST_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    scope: targetScope, status: "PROPOSED", pagination: { limit: 10 },
  }));

  assert.deepEqual(listed.items.map((item) => "publicationTargetId" in item ? item.publicationTargetId : undefined), [proposed.resourceId]);
  assert.equal(listed.items[0]?.viewType, "PUBLICATION_TARGET_GOVERNANCE");
  assert.equal(JSON.stringify(listed).includes("allowedFieldReferences"), false);
  assert.deepEqual(unitOfWork.publicationTargets.find(identity), before);
});

test("F16-PHASE-11A selector list fails closed when live authority does not cover the requested scope", () => {
  const { application } = fixture();
  assert.throws(() => application.list(command("LIST_SOURCE_GOVERNANCE", "session-policy-proposer", {
    scope: { tenantId, scopeType: "SOURCE", scopeId: "source-outside-authority-phase11a" },
    pagination: { limit: 10 },
  })), (error: unknown) => error instanceof AdministrationApiError && error.code === "AUTHORIZATION_DENIED");
});

test("F16-PHASE-9 Role Assignment self approval and stale version fail without persistence", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-denial-phase9")));
  const identity = { tenantId, resourceType: "ROLE_ASSIGNMENT" as const, resourceId: proposed.resourceId };
  assert.throws(() => application.execute(command("APPROVE_ROLE_ASSIGNMENT", "session-policy-proposer", {
    proposalId: proposed.proposalId, roleAssignmentId: proposed.resourceId,
    ...common(roleAssignmentScope, 1, "idem-role-self-approve-phase9"),
  })), (error: unknown) => error instanceof AdministrationApiError && error.code === "SELF_APPROVAL_FORBIDDEN");
  assert.throws(() => application.execute(command("APPROVE_ROLE_ASSIGNMENT", "session-policy-approver", {
    proposalId: proposed.proposalId, roleAssignmentId: proposed.resourceId,
    ...common(roleAssignmentScope, 2, "idem-role-stale-phase9"),
  })), (error: unknown) => error instanceof AdministrationApiError && error.code === "VERSION_CONFLICT");
  assert.equal(unitOfWork.roleAssignments.find(identity)?.status, "PROPOSED");
  assert.equal(unitOfWork.decisions.list(identity).length, 0);
});

test("F16-PHASE-9A successor lookup conceals an assignment outside the authorized scope", () => {
  const { application, unitOfWork, sessions } = fixture();
  const proposed = application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-scope-source-phase9")));
  activateSecurityAuthority(unitOfWork, "other-scope-actor", {}, "team-other-phase9");
  sessions.set("session-other-scope-actor", session("other-scope-actor", "team-other-phase9"));
  assert.throws(() => application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-other-scope-actor", {
    ...roleAssignmentProposal("idem-role-scope-probe-phase9"), roleAssignmentId: proposed.resourceId,
    scope: { tenantId, scopeType: "TEAM", scopeId: "team-other-phase9" }, expectedVersion: 1,
  })), (error: unknown) => error instanceof AdministrationApiError && error.code === "NOT_FOUND");
});

test("F16-PHASE-9 HTTP command route derives the Session and reaches the single application boundary", async () => {
  const { application, unitOfWork } = fixture();
  const handler = createAdministrationHttpRequestHandler(application);
  const response = await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", {
    tenantId, correlationId: "correlation-role-http-phase9", operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: roleAssignmentProposal("idem-role-http-phase9"),
  }));
  assert.equal(response.statusCode, 200);
  const body = response.body as { success: boolean; data: { resourceId: string; status: string } };
  assert.equal(body.success, true);
  assert.equal(body.data.status, "PROPOSED");
  assert.equal(unitOfWork.roleAssignments.find({
    tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: body.data.resourceId,
  })?.proposedBy, "policy-proposer");
});

test("F16-PHASE-9 HTTP query route is separated from commands and returns bounded Role Assignment views", async () => {
  const { application } = fixture();
  application.execute(command("PROPOSE_ROLE_ASSIGNMENT", "session-policy-proposer", roleAssignmentProposal("idem-role-http-query-phase9")));
  const handler = createAdministrationHttpRequestHandler(application);
  const response = await handler.handle(httpRequest("GET", "/administration/queries", "session-policy-proposer", {}, {
    tenantId, correlationId: "correlation-role-http-query-phase9", operation: "LIST_ROLE_ASSIGNMENTS",
    scopeType: "TEAM", scopeId: teamId, status: "PROPOSED", limit: "10",
  }));
  assert.equal(response.statusCode, 200);
  const body = response.body as { success: boolean; data: { items: readonly unknown[] } };
  assert.equal(body.success, true);
  assert.equal(body.data.items.length, 1);
  const wrongMethod = await handler.handle(httpRequest("POST", "/administration/queries", "session-policy-proposer", {}));
  assert.equal(wrongMethod.statusCode, 405);
});

test("F16-PHASE-11A HTTP query surface exposes only the approved selector list operations", async () => {
  const { application, unitOfWork, sessions } = fixture();
  activateSecurityAuthority(unitOfWork, "tenant-selector-reader", {
    resourceTypes: [`Administration:TENANT:${tenantId}`],
  });
  sessions.set("session-tenant-selector-reader", session("tenant-selector-reader"));
  const handler = createAdministrationHttpRequestHandler(application);
  const cases = [
    { operation: "LIST_ROLES", sessionId: "session-tenant-selector-reader", scopeType: "TENANT", scopeId: tenantId },
    { operation: "LIST_TEAM_SCOPES", sessionId: "session-policy-proposer", scopeType: "TEAM", scopeId: teamId },
    { operation: "LIST_POLICIES", sessionId: "session-policy-proposer", scopeType: "POLICY", scopeId: policyScope.scopeId },
    { operation: "LIST_SOURCE_GOVERNANCE", sessionId: "session-policy-proposer", scopeType: "SOURCE", scopeId: sourceScope.scopeId },
    { operation: "LIST_PUBLICATION_TARGET_GOVERNANCE", sessionId: "session-policy-proposer", scopeType: "TARGET", scopeId: targetScope.scopeId },
  ] as const;

  for (const entry of cases) {
    const response = await handler.handle(httpRequest("GET", "/administration/queries", entry.sessionId, {}, {
      tenantId, correlationId: `correlation-${entry.operation.toLowerCase()}-phase11a`, operation: entry.operation,
      scopeType: entry.scopeType, scopeId: entry.scopeId, limit: "25",
    }));
    assert.equal(response.statusCode, 200, entry.operation);
    assert.equal((response.body as { success?: boolean }).success, true, entry.operation);
  }

  const unknown = await handler.handle(httpRequest("GET", "/administration/queries", "session-policy-proposer", {}, {
    tenantId, correlationId: "correlation-unknown-query-phase11a", operation: "LIST_POLICIES",
    scopeType: "POLICY", scopeId: policyScope.scopeId, limit: "25", wildcard: "*",
  }));
  assert.equal(unknown.statusCode, 400);
});

test("F16-PHASE-9 HTTP boundary rejects body-authored Session and fails closed without a Session header", async () => {
  const { application, unitOfWork } = fixture();
  const handler = createAdministrationHttpRequestHandler(application);
  const body = {
    tenantId, correlationId: "correlation-role-http-auth-phase9", operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: roleAssignmentProposal("idem-role-http-auth-phase9"),
  };
  const missing = await handler.handle(httpRequest("POST", "/administration/commands", undefined, body));
  assert.equal(missing.statusCode, 401);
  const forged = await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", {
    ...body, sessionId: "session-policy-approver", actorId: "policy-approver", roles: ["SEC"],
  }));
  assert.equal(forged.statusCode, 400);
  assert.equal(unitOfWork.roleAssignments.listBySubject(tenantId, "principal-agent-phase9").length, 0);
});

test("F16-PHASE-9 HTTP routes reuse Policy, Source and Target application workflows without execution authority", async () => {
  const { application } = fixture();
  const handler = createAdministrationHttpRequestHandler(application);
  const cases = [
    {
      operation: "PROPOSE_POLICY_CHANGE",
      payload: { policyId: "policy-http-phase9", proposedChangeReference: "policy-http-reference-phase9", ...common(policyScope, 0, "idem-policy-http-phase9") },
    },
    {
      operation: "PROPOSE_SOURCE_GOVERNANCE",
      payload: {
        name: "HTTP Source Phase 9", sourceType: "PUBLIC_WEBSITE", policyReference: "source-policy-http-phase9",
        allowedMethods: ["MANUAL_CAPTURE"], allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
        ...common(sourceScope, 0, "idem-source-http-phase9"),
      },
    },
    {
      operation: "PROPOSE_PUBLICATION_TARGET_GOVERNANCE",
      payload: {
        name: "HTTP Target Phase 9", targetType: "MLS_PORTAL", channelReference: "channel-http-phase9",
        policyReference: "target-policy-http-phase9", allowedFieldReferences: ["field-title"],
        ...common(targetScope, 0, "idem-target-http-phase9"),
      },
    },
  ] as const;
  for (const item of cases) {
    const response = await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", {
      tenantId, correlationId: `correlation-${item.operation.toLowerCase()}`, operation: item.operation, payload: item.payload,
    }));
    assert.equal(response.statusCode, 200);
  }
  const forbidden = await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", {
    tenantId, correlationId: "correlation-forbidden-phase9", operation: "SET_LEGAL_HOLD", payload: {},
  }));
  assert.equal(forbidden.statusCode, 400);
});

test("F16-PHASE-9 HTTP preserves canonical idempotency conflicts and concealed live-authorization denials", async () => {
  const { application, sessions } = fixture();
  const handler = createAdministrationHttpRequestHandler(application);
  const firstBody = {
    tenantId, correlationId: "correlation-http-idempotency-phase9", operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: roleAssignmentProposal("idem-http-conflict-phase9"),
  };
  assert.equal((await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", firstBody))).statusCode, 200);
  const conflict = await handler.handle(httpRequest("POST", "/administration/commands", "session-policy-proposer", {
    ...firstBody, payload: { ...roleAssignmentProposal("idem-http-conflict-phase9"), subjectPrincipalId: "principal-other-phase9" },
  }));
  assert.equal(conflict.statusCode, 409);

  sessions.set("session-low-assurance-phase9", Object.freeze({
    ...session("policy-proposer"), id: "session-low-assurance-phase9", assurance: "SINGLE_FACTOR", isMfaVerified: false,
  }));
  const denied = await handler.handle(httpRequest("POST", "/administration/commands", "session-low-assurance-phase9", {
    tenantId, correlationId: "correlation-http-mfa-phase9", operation: "PROPOSE_ROLE_ASSIGNMENT",
    payload: roleAssignmentProposal("idem-http-mfa-phase9"),
  }));
  assert.equal(denied.statusCode, 403);
  assert.doesNotMatch(JSON.stringify(denied.body), /principal-agent-phase9|policy-role-agent-phase9|stack|at file:/i);
});

test("F16-PHASE-9 composed HTTP path fails closed for every mandatory live-authority rejection", async () => {
  const { application, unitOfWork, sessions } = fixture();
  sessions.set("session-no-assignment-phase9", session("no-assignment-phase9"));
  activateSecurityAuthority(unitOfWork, "expired-authority-phase9", {
    effectiveFrom: "2026-08-18T00:00:00.000Z", effectiveUntil: "2026-08-19T00:00:00.000Z",
  });
  sessions.set("session-expired-authority-phase9", session("expired-authority-phase9"));
  activateSecurityAuthority(unitOfWork, "wrong-purpose-phase9", { purposes: ["LISTING_DISCOVERY"] });
  sessions.set("session-wrong-purpose-phase9", session("wrong-purpose-phase9"));
  activateSecurityAuthority(unitOfWork, "revoked-authority-phase9");
  revokeSecurityAuthority(unitOfWork, "revoked-authority-phase9");
  sessions.set("session-revoked-authority-phase9", session("revoked-authority-phase9"));
  activateSecurityAuthority(unitOfWork, "retired-role-phase9", { roleId: "role-security-retired-phase9" });
  sessions.set("session-retired-role-phase9", session("retired-role-phase9"));
  const handler = createAdministrationHttpRequestHandler(application);
  const cases = [
    { sessionId: "session-no-assignment-phase9", tenant: tenantId, scope: roleAssignmentScope, suffix: "missing-capability" },
    { sessionId: "session-expired-authority-phase9", tenant: tenantId, scope: roleAssignmentScope, suffix: "expired-assignment" },
    { sessionId: "session-wrong-purpose-phase9", tenant: tenantId, scope: roleAssignmentScope, suffix: "purpose-mismatch" },
    { sessionId: "session-revoked-authority-phase9", tenant: tenantId, scope: roleAssignmentScope, suffix: "revoked-assignment" },
    { sessionId: "session-retired-role-phase9", tenant: tenantId, scope: roleAssignmentScope, suffix: "revoked-role" },
    { sessionId: "session-policy-proposer", tenant: "tenant-other-phase9", scope: { tenantId: "tenant-other-phase9", scopeType: "TEAM", scopeId: teamId }, suffix: "wrong-tenant" },
    { sessionId: "session-policy-proposer", tenant: tenantId, scope: { tenantId, scopeType: "TEAM", scopeId: "team-other-phase9" }, suffix: "wrong-scope" },
  ] as const;
  for (const item of cases) {
    const response = await handler.handle(httpRequest("POST", "/administration/commands", item.sessionId, {
      tenantId: item.tenant, correlationId: `correlation-${item.suffix}-phase9`, operation: "PROPOSE_ROLE_ASSIGNMENT",
      payload: { ...roleAssignmentProposal(`idem-${item.suffix}-phase9`), scope: item.scope },
    }));
    assert.equal(response.statusCode, 404, item.suffix);
    assert.deepEqual(response.body, {
      success: false, error: { code: "NOT_FOUND", message: "Resource not found." },
    }, item.suffix);
  }
  assert.equal(unitOfWork.roleAssignments.listBySubject(tenantId, "principal-agent-phase9").length, 0);
});

test("F16-PHASE-9 multiplexer preserves the existing HTTP handler for non-Administration routes", async () => {
  const { application } = fixture();
  let fallbackCalls = 0;
  const handler = createAdministrationHttpRequestHandler(application, {
    handle: (input: unknown) => {
      fallbackCalls += 1;
      const requestId = (input as { requestId: string }).requestId;
      return Promise.resolve({
        statusCode: 202, headers: { "content-type": "application/json" }, body: { success: true }, requestId,
      });
    },
  });
  const response = await handler.handle(httpRequest("POST", "/publications/commands/create", undefined, {}));
  assert.equal(response.statusCode, 202);
  assert.equal(fallbackCalls, 1);
});

test("F16-PHASE-9 existing Node HTTP server enforces bounded bodies and executes the composed API-015 route", async () => {
  const { application } = fixture();
  const server = composeAdministrationApi015NodeHttpServer({
    configuration: { host: "127.0.0.1", port: 0, maximumBodyBytes: 2_048, shutdownTimeout: 250 },
    application,
    requestIdFactory: () => "request-node-api015-phase9",
  });
  await server.start();
  try {
    assert.notEqual(server.diagnostics.boundPort, null);
    const base = `http://127.0.0.1:${server.diagnostics.boundPort!}`;
    const response = await fetch(`${base}/administration/commands`, {
      method: "POST", headers: {
        "content-type": "application/json", "x-request-id": "request-node-role-phase9",
        "x-session-id": "session-policy-proposer",
      },
      body: JSON.stringify({
        tenantId, correlationId: "correlation-node-role-phase9", operation: "PROPOSE_ROLE_ASSIGNMENT",
        payload: roleAssignmentProposal("idem-node-role-phase9"),
      }),
    });
    assert.equal(response.status, 200);
    const query = new URLSearchParams({
      tenantId, correlationId: "correlation-node-role-query-phase9", operation: "LIST_ROLE_ASSIGNMENTS",
      scopeType: "TEAM", scopeId: teamId, status: "PROPOSED", limit: "10",
    });
    const queryResponse = await fetch(`${base}/administration/queries?${query}`, {
      headers: { "x-request-id": "request-node-role-query-phase9", "x-session-id": "session-policy-proposer" },
    });
    assert.equal(queryResponse.status, 200);
    const queryBody = await queryResponse.json() as { success: boolean; data: { items: readonly unknown[] } };
    assert.equal(queryBody.success, true);
    assert.equal(queryBody.data.items.length, 1);
    const oversized = await fetch(`${base}/administration/commands`, {
      method: "POST", headers: { "content-type": "application/json", "x-request-id": "request-node-large-phase9" },
      body: JSON.stringify({ padding: "x".repeat(3_000) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await server.stop();
  }
});

function httpRequest(
  method: string,
  path: string,
  sessionId: string | undefined,
  body: object,
  query: Readonly<Record<string, string>> = {},
) {
  return {
    method, path, headers: sessionId === undefined ? {} : { "x-session-id": sessionId },
    query, pathParameters: {}, body, requestId: `request-http-${method.toLowerCase()}-${path.replaceAll("/", "-")}`,
  };
}

test("F16-PHASE-8 Policy proposal and independent approval persist one atomic authoritative result", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-phase8", proposedChangeReference: "policy-reference-v1",
    ...common(policyScope, 0, "idem-policy-propose-phase8"),
  }));
  assert.equal(proposed.status, "PROPOSED");
  assert.equal(proposed.version, 1);

  const approvedInput = command("APPROVE_POLICY_CHANGE", "session-policy-approver", {
    proposalId: proposed.proposalId, policyId: "policy-phase8",
    ...common(policyScope, 1, "idem-policy-approve-phase8"),
  });
  const approved = application.execute(approvedInput);
  assert.equal(approved.status, "ACTIVE");
  assert.equal(approved.version, 2);
  assert.equal(unitOfWork.policies.find({ tenantId, resourceType: "POLICY", resourceId: "policy-phase8" })?.status, "ACTIVE");
  assert.equal(unitOfWork.decisions.list({ tenantId, resourceType: "POLICY", resourceId: "policy-phase8" }).length, 1);
  assert.deepEqual(application.execute(approvedInput), approved);
  assert.equal(unitOfWork.decisions.list({ tenantId, resourceType: "POLICY", resourceId: "policy-phase8" }).length, 1);
});

test("F16-PHASE-8 Source governance proposal and approval persist metadata without execution", () => {
  const { application, unitOfWork } = fixture();
  const proposedInput = command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    name: "Approved Source Phase 8", sourceType: "PUBLIC_WEBSITE",
    policyReference: "source-policy-phase8", allowedMethods: ["MANUAL_CAPTURE"],
    allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
    ...common(sourceScope, 0, "idem-source-propose-phase8"),
  });
  const proposed = application.execute(proposedInput);
  assert.equal(proposed.status, "PROPOSED");
  const approvedInput = command("APPROVE_SOURCE_GOVERNANCE", "session-policy-approver", {
    proposalId: proposed.proposalId, sourceRegistryEntryId: proposed.resourceId,
    ...common(sourceScope, 1, "idem-source-approve-phase8"),
  });
  const approved = application.execute(approvedInput);
  assert.equal(approved.status, "ACTIVE");
  assert.equal(approved.version, 2);
  assert.equal(unitOfWork.sourceGovernance.find({
    tenantId, resourceType: "SOURCE_REGISTRY", resourceId: proposed.resourceId,
  })?.status, "ACTIVE");
  assert.deepEqual(application.execute(proposedInput), proposed);
  assert.deepEqual(application.execute(approvedInput), approved);
});

test("F16-PHASE-8 Publication Target governance approval changes no Publication execution state", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    name: "Approved Target Phase 8", targetType: "MLS_PORTAL", channelReference: "channel-phase8",
    policyReference: "target-policy-phase8", allowedFieldReferences: ["field-title", "field-price"],
    ...common(targetScope, 0, "idem-target-propose-phase8"),
  }));
  const approvedInput = command("APPROVE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    proposalId: proposed.proposalId, publicationTargetId: proposed.resourceId,
    ...common(targetScope, 1, "idem-target-approve-phase8"),
  });
  const approved = application.execute(approvedInput);
  assert.equal(approved.status, "ACTIVE");
  assert.equal(approved.version, 2);
  const stored = unitOfWork.publicationTargets.find({
    tenantId, resourceType: "PUBLICATION_TARGET", resourceId: proposed.resourceId,
  });
  assert.equal(stored?.status, "ACTIVE");
  assert.equal(stored?.channelReference, "channel-phase8");
  assert.equal(unitOfWork.decisions.list({
    tenantId, resourceType: "PUBLICATION_TARGET", resourceId: proposed.resourceId,
  }).length, 1);
  assert.deepEqual(application.execute(approvedInput), approved);
});

test("F16-PHASE-8 Source governance transition requires a current successor proposal", () => {
  const { application, unitOfWork } = fixture();
  const created = application.execute(command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    name: "Transition Source Phase 8", sourceType: "PUBLIC_WEBSITE",
    policyReference: "source-policy-phase8", allowedMethods: ["MANUAL_CAPTURE"],
    allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
    ...common(sourceScope, 0, "idem-source-create-transition-phase8"),
  }));
  application.execute(command("APPROVE_SOURCE_GOVERNANCE", "session-policy-approver", {
    proposalId: created.proposalId, sourceRegistryEntryId: created.resourceId,
    ...common(sourceScope, 1, "idem-source-activate-transition-phase8"),
  }));
  const successor = application.execute(command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    sourceRegistryEntryId: created.resourceId, name: "Transition Source Phase 8", sourceType: "PUBLIC_WEBSITE",
    policyReference: "source-policy-phase8-v2", allowedMethods: ["MANUAL_CAPTURE"],
    allowedPurposes: ["LISTING_DISCOVERY"], classification: "CONFIDENTIAL_BUSINESS",
    ...common(sourceScope, 2, "idem-source-successor-phase8"),
  }));
  const transitioned = application.execute(command("TRANSITION_SOURCE_GOVERNANCE", "session-policy-approver", {
    proposalId: successor.proposalId, sourceRegistryEntryId: created.resourceId, targetStatus: "PAUSED",
    ...common(sourceScope, 2, "idem-source-pause-phase8"),
  }));
  assert.equal(transitioned.status, "PAUSED");
  assert.equal(transitioned.version, 3);
  const replayed = application.execute(command("TRANSITION_SOURCE_GOVERNANCE", "session-policy-approver", {
    proposalId: successor.proposalId, sourceRegistryEntryId: created.resourceId, targetStatus: "PAUSED",
    ...common(sourceScope, 2, "idem-source-pause-phase8"),
  }));
  assert.deepEqual(replayed, transitioned);
  const stored = unitOfWork.sourceGovernance.find({
    tenantId, resourceType: "SOURCE_REGISTRY", resourceId: created.resourceId,
  });
  assert.equal(stored?.policyReference, "source-policy-phase8-v2");
  assert.equal(stored?.classification, "CONFIDENTIAL_BUSINESS");
});

test("F16-PHASE-8 rejects self-approval, stale version and conflicting idempotency without false success", () => {
  const { application, unitOfWork } = fixture();
  const proposedInput = command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-negative-phase8", proposedChangeReference: "policy-negative-v1",
    ...common(policyScope, 0, "idem-policy-negative-phase8"),
  });
  const proposed = application.execute(proposedInput);
  assert.throws(() => application.execute(command("APPROVE_POLICY_CHANGE", "session-policy-proposer", {
    proposalId: proposed.proposalId, policyId: "policy-negative-phase8",
    ...common(policyScope, 1, "idem-policy-self-approve-phase8"),
  })), (error: unknown) => error instanceof Error && error.message === "SELF_APPROVAL_FORBIDDEN");
  assert.throws(() => application.execute(command("APPROVE_POLICY_CHANGE", "session-policy-approver", {
    proposalId: proposed.proposalId, policyId: "policy-negative-phase8",
    ...common(policyScope, 2, "idem-policy-stale-phase8"),
  })), (error: unknown) => error instanceof Error && error.message === "VERSION_CONFLICT");
  assert.throws(() => application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-negative-phase8", proposedChangeReference: "different-policy-intent",
    ...common(policyScope, 1, "idem-policy-negative-phase8"),
  })), (error: unknown) => error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT");
  assert.equal(unitOfWork.policies.find({ tenantId, resourceType: "POLICY", resourceId: "policy-negative-phase8" })?.status, "PROPOSED");
  assert.equal(unitOfWork.decisions.list({ tenantId, resourceType: "POLICY", resourceId: "policy-negative-phase8" }).length, 0);
});

test("F16-PHASE-8 fails closed for forged authority, insufficient MFA, scope mismatch and revoked live authority", () => {
  const { application, unitOfWork, sessions } = fixture();
  sessions.set("session-low-assurance", session("policy-proposer"));
  sessions.set("session-low-assurance", Object.freeze({
    ...session("policy-proposer"), id: "session-low-assurance", assurance: "SINGLE_FACTOR", isMfaVerified: false,
  }));
  const validPayload = {
    policyId: "policy-security-phase8", proposedChangeReference: "policy-security-v1",
    ...common(policyScope, 0, "idem-policy-security-phase8"),
  };
  assert.throws(() => application.execute({
    ...command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", validPayload), actorId: "forged-actor",
  }), (error: unknown) => error instanceof Error && error.message === "VALIDATION_FAILED");
  assert.throws(() => application.execute(command("PROPOSE_POLICY_CHANGE", "session-low-assurance", validPayload)),
    (error: unknown) => error instanceof Error && error.message === "MFA_REQUIRED");
  assert.throws(() => application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    ...validPayload, policyId: "policy-wrong-scope-phase8",
    ...common({ tenantId, scopeType: "POLICY", scopeId: "other-policy-scope" }, 0, "idem-policy-wrong-scope-phase8"),
  })), (error: unknown) => error instanceof Error && error.message === "AUTHORIZATION_DENIED");
  revokeSecurityAuthority(unitOfWork, "policy-proposer");
  assert.throws(() => application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    ...validPayload, policyId: "policy-after-revoke-phase8",
    ...common(policyScope, 0, "idem-policy-after-revoke-phase8"),
  })), (error: unknown) => error instanceof Error && error.message === "AUTHORIZATION_DENIED");
  assert.equal(unitOfWork.policies.find({ tenantId, resourceType: "POLICY", resourceId: "policy-after-revoke-phase8" }), undefined);
});

test("F16-PHASE-8 Policy rejection persists decision evidence without activating authority", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-reject-phase8", proposedChangeReference: "policy-reject-v1",
    ...common(policyScope, 0, "idem-policy-reject-propose-phase8"),
  }));
  const rejected = application.execute(command("REJECT_POLICY_CHANGE", "session-policy-approver", {
    proposalId: proposed.proposalId, policyId: "policy-reject-phase8",
    ...common(policyScope, 1, "idem-policy-reject-decision-phase8"),
  }));
  assert.equal(rejected.status, "REJECTED");
  assert.equal(unitOfWork.policies.find({ tenantId, resourceType: "POLICY", resourceId: "policy-reject-phase8" })?.status, "PROPOSED");
  assert.equal(unitOfWork.decisions.list({ tenantId, resourceType: "POLICY", resourceId: "policy-reject-phase8" })[0]?.status, "REJECTED");
  assert.throws(() => application.execute(command("APPROVE_POLICY_CHANGE", "session-policy-approver", {
    proposalId: proposed.proposalId, policyId: "policy-reject-phase8",
    ...common(policyScope, 1, "idem-policy-rejected-reuse-phase8"),
  })), (error: unknown) => error instanceof AdministrationApiError && error.code === "INVALID_STATE");
  assert.equal(unitOfWork.decisions.list({ tenantId, resourceType: "POLICY", resourceId: "policy-reject-phase8" }).length, 1);
});

test("F16-PHASE-8 Policy successor proposal preserves current state until independently approved", () => {
  const { application, unitOfWork } = fixture();
  const first = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-successor-phase8", proposedChangeReference: "policy-successor-v1",
    ...common(policyScope, 0, "idem-policy-successor-v1-phase8"),
  }));
  application.execute(command("APPROVE_POLICY_CHANGE", "session-policy-approver", {
    proposalId: first.proposalId, policyId: "policy-successor-phase8",
    ...common(policyScope, 1, "idem-policy-successor-v1-approve-phase8"),
  }));
  const successor = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-successor-phase8", proposedChangeReference: "policy-successor-v2",
    ...common(policyScope, 2, "idem-policy-successor-v2-phase8"),
  }));
  assert.equal(unitOfWork.policies.find({
    tenantId, resourceType: "POLICY", resourceId: "policy-successor-phase8",
  })?.policyReference, "policy-successor-v1");
  const approved = application.execute(command("APPROVE_POLICY_CHANGE", "session-policy-approver", {
    proposalId: successor.proposalId, policyId: "policy-successor-phase8",
    ...common(policyScope, 2, "idem-policy-successor-v2-approve-phase8"),
  }));
  assert.equal(approved.version, 3);
  assert.equal(unitOfWork.policies.find({
    tenantId, resourceType: "POLICY", resourceId: "policy-successor-phase8",
  })?.policyReference, "policy-successor-v2");
});

test("F16-PHASE-8 Publication Target transition uses a successor proposal and remains execution-isolated", () => {
  const { application, unitOfWork } = fixture();
  const created = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    name: "Transition Target Phase 8", targetType: "MLS_PORTAL", channelReference: "channel-phase8",
    policyReference: "target-policy-phase8", allowedFieldReferences: ["field-title"],
    ...common(targetScope, 0, "idem-target-create-transition-phase8"),
  }));
  application.execute(command("APPROVE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    proposalId: created.proposalId, publicationTargetId: created.resourceId,
    ...common(targetScope, 1, "idem-target-activate-transition-phase8"),
  }));
  const successor = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    publicationTargetId: created.resourceId, name: "Transition Target Phase 8", targetType: "MLS_PORTAL",
    channelReference: "channel-phase8-v2", policyReference: "target-policy-phase8-v2",
    allowedFieldReferences: ["field-title"],
    ...common(targetScope, 2, "idem-target-successor-phase8"),
  }));
  const transitioned = application.execute(command("TRANSITION_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    proposalId: successor.proposalId, publicationTargetId: created.resourceId, targetStatus: "PAUSED",
    ...common(targetScope, 2, "idem-target-pause-phase8"),
  }));
  assert.equal(transitioned.status, "PAUSED");
  assert.equal(transitioned.version, 3);
  assert.deepEqual(application.execute(command("TRANSITION_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    proposalId: successor.proposalId, publicationTargetId: created.resourceId, targetStatus: "PAUSED",
    ...common(targetScope, 2, "idem-target-pause-phase8"),
  })), transitioned);
  const stored = unitOfWork.publicationTargets.find({
    tenantId, resourceType: "PUBLICATION_TARGET", resourceId: created.resourceId,
  });
  assert.equal(stored?.channelReference, "channel-phase8-v2");
  assert.equal(stored?.policyReference, "target-policy-phase8-v2");
});

test("F16-PHASE-8 Publication Target rejection replay preserves the rejected outcome without duplicate evidence", () => {
  const { application, unitOfWork } = fixture();
  const proposed = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    name: "Rejected Target Phase 8", targetType: "MLS_PORTAL", channelReference: "channel-rejected-phase8",
    policyReference: "target-policy-rejected-phase8", allowedFieldReferences: ["field-title"],
    ...common(targetScope, 0, "idem-target-rejected-propose-phase8"),
  }));
  const rejectionInput = command("REJECT_PUBLICATION_TARGET_GOVERNANCE", "session-policy-approver", {
    proposalId: proposed.proposalId, publicationTargetId: proposed.resourceId,
    ...common(targetScope, 1, "idem-target-rejected-decision-phase8"),
  });
  const rejected = application.execute(rejectionInput);
  assert.equal(rejected.status, "REJECTED");
  assert.deepEqual(application.execute(rejectionInput), rejected);
  assert.equal(unitOfWork.decisions.list({
    tenantId, resourceType: "PUBLICATION_TARGET", resourceId: proposed.resourceId,
  }).length, 1);
  assert.equal(unitOfWork.publicationTargets.find({
    tenantId, resourceType: "PUBLICATION_TARGET", resourceId: proposed.resourceId,
  })?.status, "PROPOSED");
});

test("F16-PHASE-8 bounded Policy, Source and Target reads are live-authorized and immutable", () => {
  const { application } = fixture();
  const policy = application.execute(command("PROPOSE_POLICY_CHANGE", "session-policy-proposer", {
    policyId: "policy-read-phase8", proposedChangeReference: "policy-read-v1",
    ...common(policyScope, 0, "idem-policy-read-phase8"),
  }));
  const policyView = application.read({
    requestId: "request-read-policy-phase8", sessionId: "session-policy-approver", tenantId,
    correlationId: "correlation-read-policy-phase8", operation: "READ_POLICY",
    payload: { scope: policyScope, policyId: policy.resourceId },
  });
  assert.equal(policyView.viewType, "POLICY");
  assert.equal(policyView.status, "PROPOSED");
  assert.equal(Object.isFrozen(policyView), true);

  const source = application.execute(command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    name: "Read Source Phase 8", sourceType: "PUBLIC_WEBSITE", policyReference: "source-read-policy",
    allowedMethods: ["MANUAL_CAPTURE"], allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
    ...common(sourceScope, 0, "idem-source-read-phase8"),
  }));
  const sourceView = application.read({
    requestId: "request-read-source-phase8", sessionId: "session-policy-approver", tenantId,
    correlationId: "correlation-read-source-phase8", operation: "READ_SOURCE_GOVERNANCE",
    payload: { scope: sourceScope, sourceRegistryEntryId: source.resourceId },
  });
  assert.equal(sourceView.viewType, "SOURCE_GOVERNANCE");
  assert.equal(sourceView.status, "DRAFT");

  const target = application.execute(command("PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "session-policy-proposer", {
    name: "Read Target Phase 8", targetType: "MLS_PORTAL", channelReference: "channel-read-phase8",
    policyReference: "target-read-policy", allowedFieldReferences: ["field-title"],
    ...common(targetScope, 0, "idem-target-read-phase8"),
  }));
  const targetView = application.read({
    requestId: "request-read-target-phase8", sessionId: "session-policy-approver", tenantId,
    correlationId: "correlation-read-target-phase8", operation: "READ_PUBLICATION_TARGET_GOVERNANCE",
    payload: { scope: targetScope, publicationTargetId: target.resourceId },
  });
  assert.equal(targetView.viewType, "PUBLICATION_TARGET_GOVERNANCE");
  assert.equal(targetView.status, "PROPOSED");
});

test("F16-PHASE-8 repository commit failure rolls back without state, evidence or idempotency success", () => {
  let failCommit = true;
  const { application, unitOfWork } = fixture((delegate) => ({
    begin: (identity) => {
      const transaction = delegate.begin(identity);
      return {
        ...transaction,
        commit: () => {
          if (failCommit) throw new Error("fixture repository unavailable");
          transaction.commit();
        },
      };
    },
  }));
  const input = command("PROPOSE_SOURCE_GOVERNANCE", "session-policy-proposer", {
    name: "Rollback Source Phase 8", sourceType: "PUBLIC_WEBSITE",
    policyReference: "source-policy-rollback-phase8", allowedMethods: ["MANUAL_CAPTURE"],
    allowedPurposes: ["LISTING_DISCOVERY"], classification: "INTERNAL",
    ...common(sourceScope, 0, "idem-source-rollback-phase8"),
  });
  assert.throws(() => application.execute(input), (error: unknown) => {
    assert.ok(error instanceof AdministrationApiError);
    assert.deepEqual(safeAdministrationApiError(error), Object.freeze({ code: "INTERNAL_ERROR", message: "Request could not be completed." }));
    return true;
  });
  assert.equal(unitOfWork.sourceGovernance.listByScope(sourceScope).length, 0);
  assert.equal(unitOfWork.proposals.listPending(sourceScope).length, 0);
  failCommit = false;
  const retry = application.execute(input);
  assert.equal(retry.status, "PROPOSED");
  assert.equal(unitOfWork.sourceGovernance.listByScope(sourceScope).length, 1);
});
