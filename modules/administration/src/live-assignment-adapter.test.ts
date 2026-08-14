import assert from "node:assert/strict";
import test from "node:test";

import type {
  AdministrationDecisionReadRepository,
  AdministrationDecisionRecord,
  AdministrationProposalReadRepository,
  AdministrationProposalRecord,
  RoleAssignmentPersistenceRecord,
  RoleAssignmentReadRepository,
  RolePersistenceRecord,
  RoleReadRepository,
} from "./administration-persistence.js";
import { AdministrationLiveAssignmentAdapter } from "./live-assignment-adapter.js";

const tenantId = "tenant-live-adapter";
const scope = Object.freeze({ tenantId, scopeType: "TEAM" as const, scopeId: "team-live-adapter" });
const evidence = Object.freeze({ type: "APPROVAL" as const, id: "approval-evidence-live", version: 1 });

function assignment(overrides: Record<string, unknown> = {}): RoleAssignmentPersistenceRecord {
  return {
    recordType: "ROLE_ASSIGNMENT", tenantId, roleAssignmentId: "assignment-live-adapter",
    proposalId: "proposal-live-adapter", scope, subjectPrincipalId: "principal-live-adapter",
    subjectPrincipalType: "HUMAN", roleId: "role-live-adapter",
    teamIds: [scope.scopeId], resourceTypes: ["Publication"], purposes: ["PUBLICATION_EXECUTION"],
    effectiveFrom: "2026-08-14T00:00:00.000Z", effectiveUntil: "2026-08-16T00:00:00.000Z",
    status: "ACTIVE", version: 2, proposedBy: "principal-proposer-live", approvedBy: "principal-approver-live",
    reasonReference: "reason-live-adapter", evidenceReferences: [evidence], ...overrides,
  } as unknown as RoleAssignmentPersistenceRecord;
}

function role(overrides: Record<string, unknown> = {}): RolePersistenceRecord {
  return {
    recordType: "ROLE", tenantId, roleId: "role-live-adapter", roleCode: "OPS", scope,
    status: "ACTIVE", policyReference: "policy-live-adapter", version: 3,
    evidenceReferences: [evidence], ...overrides,
  } as unknown as RolePersistenceRecord;
}

function proposal(overrides: Partial<AdministrationProposalRecord> = {}): AdministrationProposalRecord {
  return {
    proposalId: "proposal-live-adapter", tenantId, resourceType: "ROLE_ASSIGNMENT",
    resourceId: "assignment-live-adapter", resourceVersion: 1, scope,
    proposedBy: "principal-proposer-live", proposedChangeReference: "change-live-adapter",
    policyReference: "policy-live-adapter", status: "APPROVED", version: 2,
    reasonReference: "reason-live-adapter", evidenceReferences: [evidence], ...overrides,
  };
}

function decision(overrides: Partial<AdministrationDecisionRecord> = {}): AdministrationDecisionRecord {
  return {
    decisionId: "decision-live-adapter", proposalId: "proposal-live-adapter", tenantId,
    operation: "APPROVE_ROLE_ASSIGNMENT", resourceType: "ROLE_ASSIGNMENT",
    resourceId: "assignment-live-adapter", scope, proposerId: "principal-proposer-live",
    decisionActorId: "principal-approver-live", status: "APPROVED",
    reasonReference: "decision-reason-live-adapter", evidenceReferences: [evidence],
    version: 2, decidedAt: "2026-08-14T01:00:00.000Z", ...overrides,
  };
}

function repositories(overrides: {
  readonly assignment?: RoleAssignmentPersistenceRecord;
  readonly role?: RolePersistenceRecord | undefined;
  readonly proposal?: AdministrationProposalRecord;
  readonly decisions?: readonly AdministrationDecisionRecord[];
} = {}) {
  const assignmentRecord = overrides.assignment ?? assignment();
  const roleRecord = Object.hasOwn(overrides, "role") ? overrides.role : role();
  const proposalRecord = Object.hasOwn(overrides, "proposal") ? overrides.proposal : proposal();
  const decisionRecords = overrides.decisions ?? [decision()];
  const roleAssignments: RoleAssignmentReadRepository = {
    find: () => assignmentRecord,
    listByScope: () => [assignmentRecord],
    listBySubject: () => [assignmentRecord],
  };
  const roles: RoleReadRepository = {
    find: () => roleRecord,
    listByScope: () => roleRecord === undefined ? [] : [roleRecord],
  };
  const proposals: AdministrationProposalReadRepository = {
    findById: () => proposalRecord,
    listPending: () => [],
  };
  const decisions: AdministrationDecisionReadRepository = { list: () => decisionRecords };
  return { roleAssignments, roles, proposals, decisions };
}

const context = Object.freeze({
  subjectPrincipalId: "principal-live-adapter", subjectPrincipalType: "HUMAN" as const,
  tenantId, resourceType: "Publication", teamId: scope.scopeId, purpose: "PUBLICATION_EXECUTION",
});

test("F16-PHASE-7R resolves RoleAssignment.roleId through the current ACTIVE Role", () => {
  const resolved = new AdministrationLiveAssignmentAdapter(repositories()).resolveCurrentAssignments(context);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.role, "OPS");
  assert.equal(resolved[0]?.version, 2);
});

test("F16-PHASE-7R missing, retired, mismatched and unknown Roles fail closed", () => {
  const invalidRoles = [
    repositories({ role: undefined }),
    repositories({ role: role({ status: "RETIRED" }) }),
    repositories({ role: role({ roleId: "role-other" }) }),
    repositories({ role: role({ roleCode: "UNKNOWN_ROLE" }) }),
    repositories({ role: role({ version: 0 }) }),
    repositories({ role: role({ policyReference: " " }) }),
    repositories({ role: role({ scope: { ...scope, scopeId: "team-other" } }) }),
    repositories({ role: role({ evidenceReferences: [{ type: "AUDIT", id: " ", version: 0 }] }) }),
  ];
  for (const dependency of invalidRoles) {
    assert.throws(() => new AdministrationLiveAssignmentAdapter(dependency).resolveCurrentAssignments(context));
  }
});

test("F16-PHASE-7R current Role retirement is visible without rebuilding the adapter", () => {
  let currentRole: RolePersistenceRecord | undefined = role();
  const dependency = repositories();
  const adapter = new AdministrationLiveAssignmentAdapter({
    ...dependency,
    roles: { find: () => currentRole, listByScope: () => currentRole === undefined ? [] : [currentRole] },
  });
  assert.equal(adapter.resolveCurrentAssignments(context)[0]?.role, "OPS");
  currentRole = role({ status: "RETIRED", version: 4 });
  assert.throws(() => adapter.resolveCurrentAssignments(context));
});

test("F16-PHASE-7R ACTIVE authority requires exact independent approved evidence linkage", () => {
  const invalid = [
    repositories({ assignment: assignment({ approvedBy: undefined }) }),
    repositories({ assignment: assignment({ effectiveFrom: "2026-08-14" }) }),
    repositories({ assignment: assignment({ approvedBy: "principal-proposer-live" }), decisions: [decision({ decisionActorId: "principal-proposer-live" })] }),
    repositories({ proposal: proposal({ status: "REJECTED" }) }),
    repositories({ proposal: proposal({ proposalId: "proposal-other" }) }),
    repositories({ proposal: proposal({ version: 1 }) }),
    repositories({ proposal: proposal({ version: 99 }) }),
    repositories({ proposal: proposal({ resourceVersion: 0 }) }),
    repositories({ proposal: proposal({ proposedChangeReference: " " }) }),
    repositories({ proposal: proposal({ policyReference: " " }) }),
    repositories({ proposal: proposal({ reasonReference: " " }) }),
    repositories({ decisions: [decision({ status: "REJECTED" })] }),
    repositories({ decisions: [decision({ proposalId: "proposal-other" })] }),
    repositories({ decisions: [decision({ version: 0 })] }),
    repositories({ decisions: [decision({ reasonReference: " " })] }),
    repositories({ decisions: [decision({ evidenceReferences: [{ type: "AUDIT", id: "unrelated", version: 1 }] })] }),
    repositories({ assignment: assignment({ evidenceReferences: [{ type: "AUDIT", id: " ", version: 0 }] }), decisions: [decision({ evidenceReferences: [{ type: "AUDIT", id: " ", version: 0 }] })] }),
    repositories({ proposal: proposal({ evidenceReferences: [{ type: "AUDIT", id: " ", version: 0 }] }) }),
    repositories({ decisions: [decision({ decidedAt: "not-a-timestamp" })] }),
    repositories({ decisions: [decision(), decision({
      decisionId: "decision-revoke-live-adapter", proposalId: "proposal-revoke-live-adapter",
      operation: "REVOKE_ROLE_ASSIGNMENT", status: "REVOKED", version: 3,
    })] }),
  ];
  for (const dependency of invalid) {
    assert.throws(() => new AdministrationLiveAssignmentAdapter(dependency).resolveCurrentAssignments(context));
  }
});

test("F16-PHASE-7R revoked assignments never revive historical approval authority", () => {
  const resolved = new AdministrationLiveAssignmentAdapter(repositories({
    assignment: assignment({ status: "REVOKED", version: 3, revokedBy: "principal-revoker-live" }),
  })).resolveCurrentAssignments(context);
  assert.deepEqual(resolved, []);
});
