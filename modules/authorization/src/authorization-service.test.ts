import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import {
  AuthorizationService,
  projectionRestrictionResourceType,
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

test("FCR-003 production authorization requires exact classified Projection assignment and privacy context", () => {
  const base = assignment({
    principalId: "projection-reader",
    role: "OPS",
    resourceTypes: ["ListingProjection"],
    purposes: ["PUBLICATION_EXECUTION"],
  });
  const projectionSession = session({ principalId: "projection-reader", roles: ["OPS"], teamId: "team-a" });
  const requestResource = {
    type: "ListingProjection",
    id: "publication-restricted",
    teamId: "team-a",
    classification: "RESTRICTED_SECURITY" as const,
    privacyScope: "privacy:approved-publication",
    purpose: "PUBLICATION_EXECUTION",
    consentOrLegalBasis: "permission:public-publication",
    audienceRestriction: "AUD_PUBLIC",
  };
  const exact = assignment({
    id: "assignment-projection-restricted",
    principalId: "projection-reader",
    role: "OPS",
    resourceTypes: [projectionRestrictionResourceType(requestResource)],
    purposes: ["PUBLICATION_EXECUTION"],
  });
  const request = {
    session: projectionSession,
    action: "resource.view",
    resource: requestResource,
    purpose: "PUBLICATION_EXECUTION",
    correlationId: "correlation-projection-restricted",
  };

  assert.equal(createService([base]).service.evaluate(request).reasonCode, "SCOPE_DENIED");
  assert.equal(createService([exact]).service.evaluate(request).effect, "ALLOW");
  for (const resource of [
    { ...request.resource, purpose: "AUDIT_EXPLORATION" },
    { ...request.resource, privacyScope: "" },
    { ...request.resource, privacyScope: "privacy:different" },
    { ...request.resource, consentOrLegalBasis: "" },
    { ...request.resource, consentOrLegalBasis: "permission:different" },
    { ...request.resource, audienceRestriction: "" },
    { ...request.resource, audienceRestriction: "AUD_INTERNAL" },
  ]) {
    assert.equal(createService([exact]).service.evaluate({ ...request, resource }).effect, "DENY");
  }
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

test("F15-TASK-005 grants only scoped OPS command capabilities with MFA and reason", () => {
  const opsAssignment = assignment({
    principalId: "publication-operator-1",
    role: "OPS",
    resourceTypes: ["Publication"],
    purposes: ["PUBLICATION_EXECUTION"],
  });
  const { service } = createService([opsAssignment]);
  const actions = [
    "publication.create",
    "publication.execution.begin",
    "publication.execution.resolve",
    "publication.withdraw.request",
    "publication.withdraw.resolve",
    "publication.active-operation.begin",
    "publication.republish.begin",
    "publication.reconciliation.resolve",
    "publication.supersede",
    "publication.terminate",
    "publication.suspension.set",
  ] as const;
  for (const action of actions) {
    const decision = service.evaluate({
      session: session({ principalId: "publication-operator-1", roles: ["OPS"] }),
      action,
      resource: { type: "Publication", id: "publication-1", teamId: "team-a" },
      purpose: "PUBLICATION_EXECUTION",
      reason: "Documented publication execution reason",
      correlationId: `correlation-${action}`,
    });
    assert.equal(decision.effect, "ALLOW", action);
    assert.deepEqual(decision.obligations, ["MFA", "REASON", "AUDIT"]);
  }
  assert.equal(service.evaluate({
    session: session({ principalId: "publication-operator-1", roles: ["OPS"], isMfaVerified: false }),
    action: "publication.execution.begin",
    resource: { type: "Publication", id: "publication-1", teamId: "team-a" },
    purpose: "PUBLICATION_EXECUTION",
    reason: "Documented reason",
    correlationId: "correlation-no-mfa",
  }).reasonCode, "REAUTHENTICATION_REQUIRED");
  assert.equal(service.evaluate({
    session: session({ principalId: "publication-operator-1", roles: ["OPS"] }),
    action: "publication.execution.begin",
    resource: { type: "Publication", id: "publication-1", teamId: "team-a" },
    purpose: "PUBLICATION_EXECUTION",
    reason: "",
    correlationId: "correlation-no-reason",
  }).reasonCode, "REASON_REQUIRED");
});

test("F15-TASK-005 Manager, Administrator, Security, AI and Connector roles cannot inherit Publication human authority", () => {
  const roles = ["MGR", "ADM", "SEC", "AIR", "EXT"] as const;
  const assignments = roles.map((role) => assignment({
    id: `assignment-${role}`,
    principalId: `actor-${role}`,
    role,
    resourceTypes: ["Publication"],
    purposes: ["PUBLICATION_EXECUTION"],
  }));
  assignments.push(assignment({
    id: "assignment-SVC",
    principalId: "actor-SVC",
    role: "SVC",
    resourceTypes: ["Publication"],
    purposes: ["PUBLICATION_EXECUTION"],
  }));
  const { service } = createService(assignments);
  for (const role of roles) {
    const decision = service.evaluate({
      session: session({ principalId: `actor-${role}`, roles: [role] }),
      action: "publication.execution.resolve",
      resource: { type: "Publication", id: "publication-1", teamId: "team-a" },
      purpose: "PUBLICATION_EXECUTION",
      reason: "Attempted role-name elevation",
      correlationId: `correlation-${role}`,
    });
    assert.equal(decision.reasonCode, "CAPABILITY_DENIED", role);
  }
  const serviceDecision = service.evaluate({
    session: session({ principalId: "actor-SVC", principalType: "SERVICE", roles: ["SVC"], assurance: "WORKLOAD", isMfaVerified: false }),
    action: "publication.execution.resolve",
    resource: { type: "Publication", id: "publication-1", teamId: "team-a" },
    purpose: "PUBLICATION_EXECUTION",
    reason: "Technical identity attempted business resolution",
    correlationId: "correlation-SVC",
  });
  assert.equal(serviceDecision.reasonCode, "HUMAN_AUTHORITY_REQUIRED");
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

test("SP-003 separates property, duplicate and AI review authority", () => {
  const cases = [
    { role: "DST", action: "property.decide", resourceType: "Property" },
    { role: "DUR", action: "duplicate.dispose", resourceType: "DuplicateGroup" },
    { role: "AIR", action: "ai.review", resourceType: "AiResult" },
  ] as const;

  for (const item of cases) {
    const principalId = `user-${item.role.toLowerCase()}-sp003`;
    const { service } = createService([assignment({
      principalId,
      role: item.role,
      resourceTypes: [item.resourceType],
      purposes: ["LISTING_GOVERNANCE"],
    })]);
    const decision = service.evaluate({
      session: session({ principalId, roles: [item.role] }),
      action: item.action,
      resource: { type: item.resourceType, id: "subject-1", teamId: "team-a" },
      purpose: "LISTING_GOVERNANCE",
      correlationId: `correlation-${item.action}`,
    });
    assert.equal(decision.effect, "ALLOW", item.action);
  }
});

test("SP-003 service principal cannot decide canonical, duplicate or AI review state", () => {
  const { service } = createService([assignment({
    principalId: "service-sp003",
    role: "SVC",
    resourceTypes: ["Property", "DuplicateGroup", "AiResult"],
    purposes: ["LISTING_GOVERNANCE"],
  })]);
  const actor = session({
    principalId: "service-sp003",
    principalType: "SERVICE",
    roles: ["SVC"],
    assurance: "WORKLOAD",
    isMfaVerified: false,
  });

  for (const [action, type] of [
    ["property.decide", "Property"],
    ["duplicate.dispose", "DuplicateGroup"],
    ["ai.review", "AiResult"],
  ] as const) {
    const decision = service.evaluate({
      session: actor,
      action,
      resource: { type, id: "subject-1", teamId: "team-a" },
      purpose: "LISTING_GOVERNANCE",
      correlationId: `correlation-service-${action}`,
    });
    assert.equal(decision.reasonCode, "HUMAN_AUTHORITY_REQUIRED", action);
  }
});

test("SP-004 grants agents purpose-scoped contact, client and requirement actions", () => {
  const principalId = "user-agent-sp004";
  const { service } = createService([assignment({
    principalId,
    role: "AGT",
    resourceTypes: ["Contact", "ContactChannel", "ContactCase", "Client", "Requirement"],
    purposes: ["CLIENT_SERVICE"],
  })]);
  const actor = session({ principalId, roles: ["AGT"] });

  for (const [action, type] of [
    ["contact.create", "Contact"],
    ["contact.read", "Contact"],
    ["contact.edit", "Contact"],
    ["contact.reveal", "ContactChannel"],
    ["contact.attempt", "ContactCase"],
    ["contact.dnc", "ContactCase"],
    ["client.create", "Client"],
    ["client.read", "Client"],
    ["requirement.create", "Requirement"],
    ["requirement.read", "Requirement"],
    ["requirement.revise", "Requirement"],
    ["requirement.activate", "Requirement"],
  ] as const) {
    const decision = service.evaluate({
      session: actor,
      action,
      resource: { type, id: "sp004-subject", teamId: "team-a" },
      purpose: "CLIENT_SERVICE",
      ...(action === "contact.reveal" ? { reason: "Authorized client communication" } : {}),
      correlationId: `correlation-${action}`,
    });
    assert.equal(decision.effect, "ALLOW", action);
  }
});

test("SP-004 reveal requires MFA and service principals cannot activate requirements", () => {
  const humanId = "user-agent-sp004";
  const serviceId = "service-sp004";
  const { service } = createService([
    assignment({ principalId: humanId, role: "AGT", resourceTypes: ["ContactChannel"], purposes: ["CLIENT_SERVICE"] }),
    assignment({ principalId: serviceId, role: "SVC", resourceTypes: ["Requirement"], purposes: ["CLIENT_SERVICE"] }),
  ]);

  const reveal = service.evaluate({
    session: session({ principalId: humanId, roles: ["AGT"], isMfaVerified: false }),
    action: "contact.reveal",
    resource: { type: "ContactChannel", id: "channel-1", teamId: "team-a" },
    purpose: "CLIENT_SERVICE",
    reason: "Authorized client communication",
    correlationId: "correlation-contact-reveal",
  });
  const activate = service.evaluate({
    session: session({ principalId: serviceId, principalType: "SERVICE", roles: ["SVC"], assurance: "WORKLOAD", isMfaVerified: false }),
    action: "requirement.activate",
    resource: { type: "Requirement", id: "requirement-1", teamId: "team-a" },
    purpose: "CLIENT_SERVICE",
    correlationId: "correlation-requirement-activate",
  });

  assert.equal(reveal.reasonCode, "REAUTHENTICATION_REQUIRED");
  assert.equal(activate.reasonCode, "HUMAN_AUTHORITY_REQUIRED");
});

test("TEST-032/047 SP-007 grants bounded Permission capabilities without senior-role inheritance", () => {
  const purpose = "PURPOSE_CLIENT_PRESENTATION";
  const roleCases = [
    { role: "PMR", action: "permission.decide", expected: "ALLOW" },
    { role: "REV", action: "permission.support", expected: "ALLOW" },
    { role: "AGT", action: "permission.read", expected: "ALLOW" },
    { role: "VER", action: "permission.read", expected: "ALLOW" },
    { role: "MGR", action: "permission.decide", expected: "DENY" },
    { role: "SEC", action: "permission.decide", expected: "DENY" },
    { role: "ADM", action: "permission.decide", expected: "DENY" },
  ] as const;

  for (const item of roleCases) {
    const principalId = `permission-${item.role.toLowerCase()}`;
    const { service } = createService([assignment({ principalId, role: item.role, resourceTypes: ["Permission"], purposes: [purpose] })]);
    const decision = service.evaluate({
      session: session({ principalId, roles: [item.role] }),
      action: item.action,
      resource: { type: "Permission", id: "permission-1", teamId: "team-a", createdBy: "requester" },
      purpose,
      reason: "Exact scope Permission review",
      correlationId: `correlation-permission-${item.role}`,
    });
    assert.equal(decision.effect, item.expected, `${item.role}:${item.action}`);
  }

  const serviceId = "permission-scheduler";
  const { service } = createService([assignment({ principalId: serviceId, role: "SVC", resourceTypes: ["Permission"], purposes: [purpose] })]);
  const worker = session({ principalId: serviceId, principalType: "SERVICE", roles: ["SVC"], assurance: "WORKLOAD", isMfaVerified: false });
  const expiry = service.evaluate({ session: worker, action: "permission.expire", resource: { type: "Permission", id: "permission-1", teamId: "team-a" }, purpose, correlationId: "correlation-permission-expiry" });
  const grant = service.evaluate({ session: worker, action: "permission.decide", resource: { type: "Permission", id: "permission-1", teamId: "team-a" }, purpose, reason: "Automated grant denied", correlationId: "correlation-permission-grant" });
  assert.equal(expiry.effect, "ALLOW");
  assert.equal(grant.reasonCode, "HUMAN_AUTHORITY_REQUIRED");

  const agentId = "permission-agent-request";
  const agentAuthorization = createService([assignment({ principalId: agentId, role: "AGT", resourceTypes: ["Permission"], purposes: [purpose] })]).service;
  const agentRequest = agentAuthorization.evaluate({ session: session({ principalId: agentId, roles: ["AGT"] }), action: "permission.request", resource: { type: "Permission", id: "new", teamId: "team-a" }, purpose, correlationId: "correlation-permission-agent-request" });
  assert.equal(agentRequest.reasonCode, "CAPABILITY_DENIED");
});
