import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import {
  AdministrationService,
  type ProposeAssignmentRequest,
} from "./administration-service.js";

function adminSession(principalId: string): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`,
    principalId,
    principalType: "HUMAN",
    roles: ["ADM"] as const,
    teamId: "team-a",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-19T00:30:00.000Z",
    absoluteExpiresAt: "2026-07-19T01:00:00.000Z",
    familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
  });
}

function createFixture(): {
  readonly service: AdministrationService;
  readonly auditLog: AuditLog;
} {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-administration-${String(++sequence)}`,
  });
  const adminAssignments: readonly RoleAssignment[] = [
    "user-admin-proposer",
    "user-admin-approver",
  ].map((principalId, index) => ({
    id: `admin-assignment-${String(index + 1)}`,
    principalId,
    role: "ADM",
    teamIds: ["team-a"],
    resourceTypes: ["RoleAssignment"],
    purposes: ["ACCESS_GOVERNANCE"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
  }));
  const authorizationService = new AuthorizationService({
    assignments: adminAssignments,
    authoritySource: "STATIC_TEST_COMPATIBILITY",
    auditSink: auditLog,
    clock,
    policyVersion: "authorization-v1",
  });

  return {
    service: new AdministrationService({
      authorizationService,
      auditSink: auditLog,
      clock,
      idFactory: () => `role-assignment-${String(++sequence)}`,
      policyVersion: "administration-v1",
    }),
    auditLog,
  };
}

function proposalRequest(
  overrides: Partial<ProposeAssignmentRequest> = {},
): ProposeAssignmentRequest {
  return {
    actor: adminSession("user-admin-proposer"),
    subjectPrincipalId: "user-agent-1",
    subjectPrincipalType: "HUMAN",
    role: "AGT",
    teamIds: ["team-a"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-07-19T01:00:00.000Z",
    effectiveUntil: "2026-08-19T01:00:00.000Z",
    reason: "Assign client service responsibilities",
    correlationId: "correlation-administration-1",
    ...overrides,
  };
}

test("TEST-034 prohibits self-assignment", () => {
  const { service } = createFixture();

  assert.throws(
    () =>
      service.proposeAssignment(
        proposalRequest({ subjectPrincipalId: "user-admin-proposer" }),
      ),
    /SELF_ASSIGNMENT_PROHIBITED/,
  );
});

test("TEST-047 separates assignment proposer and approver", () => {
  const { service } = createFixture();
  const proposed = service.proposeAssignment(proposalRequest());

  assert.throws(
    () =>
      service.approveAssignment({
        actor: adminSession("user-admin-proposer"),
        assignmentId: proposed.id,
        expectedVersion: proposed.version,
        reason: "Attempt self approval",
        correlationId: "correlation-administration-2",
      }),
    /SEPARATION_OF_DUTIES_DENIED/,
  );
});

test("TEST-034 rejects stale versions and invalid effective periods", () => {
  const { service } = createFixture();

  assert.throws(
    () =>
      service.proposeAssignment(
        proposalRequest({
          effectiveFrom: "2026-08-19T01:00:00.000Z",
          effectiveUntil: "2026-07-19T01:00:00.000Z",
        }),
      ),
    /ASSIGNMENT_PERIOD_INVALID/,
  );

  const proposed = service.proposeAssignment(proposalRequest());
  assert.throws(
    () =>
      service.approveAssignment({
        actor: adminSession("user-admin-approver"),
        assignmentId: proposed.id,
        expectedVersion: proposed.version + 1,
        reason: "Approve valid scoped role",
        correlationId: "correlation-administration-3",
      }),
    /VERSION_CONFLICT/,
  );
});

test("TEST-048 rejects human authority roles for service principals", () => {
  const { service } = createFixture();

  assert.throws(
    () =>
      service.proposeAssignment(
        proposalRequest({
          subjectPrincipalId: "service-worker-1",
          subjectPrincipalType: "SERVICE",
          role: "AGT",
        }),
      ),
    /SERVICE_ROLE_PROHIBITED/,
  );
});

test("TEST-005 activates and revokes an independently approved assignment with audit evidence", () => {
  const { service, auditLog } = createFixture();
  const proposed = service.proposeAssignment(proposalRequest());
  const active = service.approveAssignment({
    actor: adminSession("user-admin-approver"),
    assignmentId: proposed.id,
    expectedVersion: proposed.version,
    reason: "Approve valid scoped role",
    correlationId: "correlation-administration-4",
  });
  const revoked = service.revokeAssignment({
    actor: adminSession("user-admin-approver"),
    assignmentId: active.id,
    expectedVersion: active.version,
    reason: "Assignment no longer required",
    correlationId: "correlation-administration-5",
  });

  assert.equal(active.status, "ACTIVE");
  assert.equal(active.approvedBy, "user-admin-approver");
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.version, 3);
  assert.equal(
    auditLog.query({
      requesterId: "user-security-1",
      purpose: "TEST",
      eventType: "ROLE_ASSIGNMENT_ACTIVATED",
    }).length,
    1,
  );
  assert.equal(
    auditLog.query({
      requesterId: "user-security-1",
      purpose: "TEST",
      eventType: "ROLE_ASSIGNMENT_REVOKED",
    }).length,
    1,
  );
});
