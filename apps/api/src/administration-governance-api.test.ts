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

const now = "2026-08-20T01:00:00.000Z";
const tenantId = "tenant-phase8";
const teamId = "team-phase8";
const evidence = (id: string) => ({ type: "AUDIT" as const, id, version: 1 });

function session(principalId: string): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`, principalId, principalType: "HUMAN", roles: [] as const, teamId,
    state: "ACTIVE", assurance: "MFA", isMfaVerified: true,
    authenticatedAt: "2026-08-20T00:00:00.000Z", expiresAt: "2026-08-20T04:00:00.000Z",
    absoluteExpiresAt: "2026-08-21T00:00:00.000Z", familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

function activateSecurityAuthority(unitOfWork: InMemoryAdministrationUnitOfWork, principalId: string): void {
  const suffix = principalId.replaceAll("-", "_");
  const identity: AdministrationTransactionIdentity = {
    tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: `assignment-${suffix}`,
  };
  const scope = { tenantId, scopeType: "TEAM" as const, scopeId: teamId };
  const proposalId = `proposal-authority-${suffix}`;
  const assignmentEvidence = evidence(`evidence-authority-${suffix}`);
  const decisionEvidence = evidence(`evidence-authority-decision-${suffix}`);
  const assignment = (version: number, status: RoleAssignmentPersistenceRecord["status"]): RoleAssignmentPersistenceRecord => ({
    recordType: "ROLE_ASSIGNMENT", tenantId, roleAssignmentId: identity.resourceId, proposalId,
    subjectPrincipalId: principalId, subjectPrincipalType: "HUMAN", roleId: "role-security-phase8",
    teamIds: [teamId], resourceTypes: [
      "Administration:POLICY:policy-scope-phase8",
      "Administration:SOURCE:source-scope-phase8",
      "Administration:TARGET:target-scope-phase8",
    ], purposes: ["ACCESS_GOVERNANCE"], effectiveFrom: "2026-08-20T00:00:00.000Z",
    effectiveUntil: "2026-08-21T00:00:00.000Z", status, version,
    proposedBy: `authority-proposer-${suffix}`, ...(status === "ACTIVE" ? { approvedBy: `authority-approver-${suffix}` } : {}),
    reasonReference: `reason-authority-${suffix}`,
    evidenceReferences: status === "ACTIVE" ? [assignmentEvidence, decisionEvidence] : [assignmentEvidence],
    scope,
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

function fixture(wrapUnitOfWork?: (unitOfWork: InMemoryAdministrationUnitOfWork) => AdministrationUnitOfWork) {
  const role: RolePersistenceRecord = {
    recordType: "ROLE", tenantId, roleId: "role-security-phase8", roleCode: "SEC",
    scope: { tenantId, scopeType: "TENANT", scopeId: tenantId }, status: "ACTIVE",
    policyReference: "policy-role-security-phase8", version: 1,
    evidenceReferences: [evidence("evidence-role-security-phase8")],
  };
  const unitOfWork = InMemoryAdministrationUnitOfWork.rehydrate({ roles: [role] });
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
    policies: unitOfWork.policies, sourceGovernance: unitOfWork.sourceGovernance,
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
const common = (scope: object, expectedVersion: number, idempotencyKey: string) => ({
  scope, expectedVersion, idempotencyKey, reason: "approved phase 8 governance reason",
  evidenceReferences: [evidence(`evidence-${idempotencyKey}`)],
});

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
