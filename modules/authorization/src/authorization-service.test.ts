import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "./authorization-service.js";

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({
    id: "session-authorization-1",
    principalId: "user-agent-1",
    principalType: "HUMAN",
    roles: ["AGT"] as const,
    teamId: "team-a",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-19T00:15:00.000Z",
    absoluteExpiresAt: "2026-07-19T01:00:00.000Z",
    familyId: "family-1",
    refreshReference: "refresh-reference-1",
    ...overrides,
  });
}

function assignment(overrides: Partial<RoleAssignment> = {}): RoleAssignment {
  return Object.freeze({
    id: "assignment-authorization-1",
    principalId: "user-agent-1",
    role: "AGT",
    teamIds: ["team-a"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
    ...overrides,
  });
}

function createService(assignments: readonly RoleAssignment[]): {
  readonly service: AuthorizationService;
  readonly auditLog: AuditLog;
} {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-authorization-${String(++sequence)}`,
  });
  return {
    service: new AuthorizationService({
      assignments,
      auditSink: auditLog,
      clock,
      policyVersion: "authorization-v1",
    }),
    auditLog,
  };
}

test("TEST-009 defaults to deny without an active assignment", () => {
  const { service } = createService([]);

  const decision = service.evaluate({
    session: session(),
    action: "resource.view",
    resource: { type: "CandidateListing", id: "candidate-1", teamId: "team-a" },
    purpose: "CLIENT_SERVICE",
    correlationId: "correlation-authorization-1",
  });

  assert.equal(decision.effect, "DENY");
  assert.equal(decision.reasonCode, "NO_ACTIVE_ASSIGNMENT");
});

test("TEST-009 enforces team, resource and purpose scope", () => {
  const { service } = createService([assignment()]);

  const allowed = service.evaluate({
    session: session(),
    action: "resource.view",
    resource: { type: "CandidateListing", id: "candidate-1", teamId: "team-a" },
    purpose: "CLIENT_SERVICE",
    correlationId: "correlation-authorization-2",
  });
  const denied = service.evaluate({
    session: session(),
    action: "resource.view",
    resource: { type: "CandidateListing", id: "candidate-2", teamId: "team-b" },
    purpose: "CLIENT_SERVICE",
    correlationId: "correlation-authorization-3",
  });

  assert.equal(allowed.effect, "ALLOW");
  assert.equal(denied.effect, "DENY");
  assert.equal(denied.reasonCode, "SCOPE_DENIED");
});

test("TEST-047 requires MFA and reason for privileged actions", () => {
  const adminAssignment = assignment({
    principalId: "user-admin-1",
    role: "ADM",
    resourceTypes: ["RoleAssignment"],
    purposes: ["ACCESS_GOVERNANCE"],
  });
  const { service } = createService([adminAssignment]);
  const adminSession = session({
    principalId: "user-admin-1",
    roles: ["ADM"],
    isMfaVerified: false,
  });

  const noMfa = service.evaluate({
    session: adminSession,
    action: "admin.role.propose",
    resource: { type: "RoleAssignment", id: "assignment-2", teamId: "team-a" },
    purpose: "ACCESS_GOVERNANCE",
    reason: "Business role request",
    correlationId: "correlation-authorization-4",
  });
  const noReason = service.evaluate({
    session: session({
      principalId: "user-admin-1",
      roles: ["ADM"],
      isMfaVerified: true,
    }),
    action: "admin.role.propose",
    resource: { type: "RoleAssignment", id: "assignment-2", teamId: "team-a" },
    purpose: "ACCESS_GOVERNANCE",
    reason: "",
    correlationId: "correlation-authorization-5",
  });

  assert.equal(noMfa.reasonCode, "REAUTHENTICATION_REQUIRED");
  assert.deepEqual(noMfa.obligations, ["MFA", "REASON", "AUDIT"]);
  assert.equal(noReason.reasonCode, "REASON_REQUIRED");
});

test("TEST-047 manager and administrator roles do not inherit publication approval", () => {
  const assignments = [
    assignment({
      principalId: "user-admin-1",
      role: "ADM",
      resourceTypes: ["PublicationApproval"],
      purposes: ["PUBLICATION"],
    }),
    assignment({
      principalId: "user-manager-1",
      role: "MGR",
      resourceTypes: ["PublicationApproval"],
      purposes: ["PUBLICATION"],
    }),
  ];
  const { service } = createService(assignments);

  for (const [principalId, role] of [
    ["user-admin-1", "ADM"],
    ["user-manager-1", "MGR"],
  ] as const) {
    const decision = service.evaluate({
      session: session({ principalId, roles: [role] }),
      action: "publication.approve",
      resource: { type: "PublicationApproval", id: "approval-1", teamId: "team-a" },
      purpose: "PUBLICATION",
      reason: "Review exact representation",
      correlationId: `correlation-${role}`,
    });
    assert.equal(decision.effect, "DENY");
    assert.equal(decision.reasonCode, "CAPABILITY_DENIED");
  }
});

test("TEST-047 service principals cannot receive human approval authority", () => {
  const { service } = createService([
    assignment({
      principalId: "service-worker-1",
      role: "SVC",
      resourceTypes: ["PublicationApproval"],
      purposes: ["PUBLICATION"],
    }),
  ]);

  const decision = service.evaluate({
    session: session({
      principalId: "service-worker-1",
      principalType: "SERVICE",
      roles: ["SVC"],
      isMfaVerified: false,
    }),
    action: "publication.approve",
    resource: { type: "PublicationApproval", id: "approval-2", teamId: "team-a" },
    purpose: "PUBLICATION",
    reason: "Automated attempt",
    correlationId: "correlation-authorization-6",
  });

  assert.equal(decision.effect, "DENY");
  assert.equal(decision.reasonCode, "HUMAN_AUTHORITY_REQUIRED");
});

test("TEST-047 rejects creator approval and allows an independent PUA", () => {
  const { service, auditLog } = createService([
    assignment({
      principalId: "user-approver-1",
      role: "PUA",
      resourceTypes: ["PublicationApproval"],
      purposes: ["PUBLICATION"],
    }),
  ]);
  const approverSession = session({
    principalId: "user-approver-1",
    roles: ["PUA"],
  });

  const selfApproval = service.evaluate({
    session: approverSession,
    action: "publication.approve",
    resource: {
      type: "PublicationApproval",
      id: "approval-3",
      teamId: "team-a",
      createdBy: "user-approver-1",
    },
    purpose: "PUBLICATION",
    reason: "Review exact representation",
    correlationId: "correlation-authorization-7",
  });
  const independentApproval = service.evaluate({
    session: approverSession,
    action: "publication.approve",
    resource: {
      type: "PublicationApproval",
      id: "approval-4",
      teamId: "team-a",
      createdBy: "user-agent-2",
    },
    purpose: "PUBLICATION",
    reason: "Review exact representation",
    correlationId: "correlation-authorization-8",
  });

  assert.equal(selfApproval.reasonCode, "SEPARATION_OF_DUTIES_DENIED");
  assert.equal(independentApproval.effect, "ALLOW");
  assert.equal(independentApproval.policyVersion, "authorization-v1");
  assert.equal(
    auditLog.query({ requesterId: "user-security-1", purpose: "TEST" }).length,
    2,
  );
});

test("TEST-027 grants collectors only scoped source and intake actions", () => {
  const { service } = createService([
    assignment({
      principalId: "user-collector-1",
      role: "COL",
      resourceTypes: ["SourceRegistry", "Intake", "BackgroundJob"],
      purposes: ["SOURCE_INTAKE"],
    }),
  ]);
  const collector = session({
    principalId: "user-collector-1",
    roles: ["COL"],
  });

  for (const [action, resourceType] of [
    ["source.read", "SourceRegistry"],
    ["source.propose", "SourceRegistry"],
    ["intake.create", "Intake"],
    ["intake.read", "Intake"],
    ["intake.validate", "Intake"],
    ["intake.request-ai", "Intake"],
    ["job.submit", "BackgroundJob"],
    ["job.read", "BackgroundJob"],
  ] as const) {
    const decision = service.evaluate({
      session: collector,
      action,
      resource: { type: resourceType, id: "sp002-resource-1", teamId: "team-a" },
      purpose: "SOURCE_INTAKE",
      correlationId: `correlation-${action}`,
    });
    assert.equal(decision.effect, "ALLOW", action);
  }

  const review = service.evaluate({
    session: collector,
    action: "intake.review",
    resource: { type: "Intake", id: "intake-1", teamId: "team-a" },
    purpose: "SOURCE_INTAKE",
    correlationId: "correlation-intake-review-deny",
  });
  assert.equal(review.reasonCode, "CAPABILITY_DENIED");
});

test("TEST-036 service principals execute bounded work but cannot review intake", () => {
  const { service } = createService([
    assignment({
      principalId: "service-worker-1",
      role: "SVC",
      resourceTypes: ["SourceRegistry", "Intake", "BackgroundJob"],
      purposes: ["SOURCE_INTAKE"],
    }),
  ]);
  const worker = session({
    principalId: "service-worker-1",
    principalType: "SERVICE",
    roles: ["SVC"],
    assurance: "WORKLOAD",
    isMfaVerified: false,
  });

  const execute = service.evaluate({
    session: worker,
    action: "job.execute",
    resource: { type: "BackgroundJob", id: "job-1", teamId: "team-a" },
    purpose: "SOURCE_INTAKE",
    correlationId: "correlation-job-execute",
  });
  const review = service.evaluate({
    session: worker,
    action: "intake.review",
    resource: { type: "Intake", id: "intake-1", teamId: "team-a" },
    purpose: "SOURCE_INTAKE",
    correlationId: "correlation-service-review-deny",
  });

  assert.equal(execute.effect, "ALLOW");
  assert.equal(review.reasonCode, "HUMAN_AUTHORITY_REQUIRED");
});

test("TEST-027 grants governed source view without proposal authority", () => {
  for (const role of ["SAG", "SEC"] as const) {
    const principalId = `user-${role.toLowerCase()}-source-view`;
    const { service } = createService([assignment({
      principalId,
      role,
      resourceTypes: ["SourceRegistry"],
      purposes: ["SOURCE_INTAKE"],
    })]);
    const actor = session({ principalId, roles: [role] });
    const read = service.evaluate({
      session: actor, action: "source.read",
      resource: { type: "SourceRegistry", id: "source-1", teamId: "team-a" },
      purpose: "SOURCE_INTAKE", correlationId: `correlation-source-read-${role}`,
    });
    const propose = service.evaluate({
      session: actor, action: "source.propose",
      resource: { type: "SourceRegistry", id: "source-2", teamId: "team-a" },
      purpose: "SOURCE_INTAKE", correlationId: `correlation-source-propose-${role}`,
    });
    assert.equal(read.effect, "ALLOW", role);
    assert.equal(propose.effect, "DENY", role);
  }
});

test("TEST-035 grants operations bounded job control", () => {
  const { service } = createService([
    assignment({
      principalId: "user-operations-1",
      role: "OPS",
      resourceTypes: ["BackgroundJob"],
      purposes: ["JOB_OPERATIONS"],
    }),
  ]);
  const operations = session({
    principalId: "user-operations-1",
    roles: ["OPS"],
  });

  for (const action of ["job.submit", "job.read", "job.execute", "job.cancel", "job.retry"]) {
    const decision = service.evaluate({
      session: operations,
      action,
      resource: { type: "BackgroundJob", id: "job-1", teamId: "team-a" },
      purpose: "JOB_OPERATIONS",
      correlationId: `correlation-${action}`,
    });
    assert.equal(decision.effect, "ALLOW", action);
  }
});
