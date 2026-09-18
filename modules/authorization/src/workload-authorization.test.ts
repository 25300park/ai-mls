import assert from "node:assert/strict";
import test from "node:test";

import type { AppendAuditEvent, AuditEvent, AuditSink } from "../../../packages/security-contracts/src/index.js";
import {
  AuthorizationService,
  type LiveRoleAssignment,
  type WorkloadAuthorizationSubject,
} from "./authorization-service.js";

const subject: WorkloadAuthorizationSubject = Object.freeze({
  registrationId: "registration-api-017", registrationVersion: 2, tenantId: "tenant-a",
  principalId: "service-jobs", principalType: "SERVICE", assurance: "WORKLOAD",
  identityEvidenceRef: "identity-evidence:registration-api-017:v2", auditEvidenceRef: "audit-evidence:registration-api-017:v2",
});

function assignment(status: LiveRoleAssignment["status"] = "ACTIVE"): LiveRoleAssignment {
  return Object.freeze({
    id: "assignment-service-jobs", principalId: subject.principalId, role: "SVC", teamIds: Object.freeze([]),
    resourceTypes: Object.freeze(["Job"]), purposes: Object.freeze(["JOB_EXECUTION"]),
    effectiveFrom: "2026-09-18T00:00:00.000Z", effectiveUntil: "2026-09-19T00:00:00.000Z",
    status, version: 3, tenantId: subject.tenantId, subjectPrincipalType: "SERVICE",
  });
}

function audit(events: AppendAuditEvent[]): AuditSink {
  return { append(input): AuditEvent { events.push(input); return Object.freeze({ ...input, id: `audit-${events.length}`, occurredAt: "2026-09-18T12:00:00.000Z" }); } };
}

test("evidence-backed workload subject uses the existing live assignment and policy engine without a Session", () => {
  const events: AppendAuditEvent[] = [];
  let current = Object.freeze([assignment()]);
  const service = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => current }, auditSink: audit(events),
    clock: () => new Date("2026-09-18T12:00:00.000Z"), policyVersion: "policy-v1",
  });
  const request = {
    subject, action: "service.execute", resource: { type: "Job", id: "job-1", tenantId: "tenant-a" },
    purpose: "JOB_EXECUTION", correlationId: "correlation-1",
  } as const;
  assert.equal(service.evaluateWorkload(request).effect, "ALLOW");
  assert.equal(events[0]?.principal.sessionId, undefined);
  assert.deepEqual(events[0]?.principal.roles, ["SVC"]);
  current = Object.freeze([assignment("REVOKED")]);
  assert.deepEqual(service.evaluateWorkload(request), {
    effect: "DENY", reasonCode: "NO_ACTIVE_ASSIGNMENT", policyVersion: "policy-v1",
    obligations: ["AUDIT"], assignmentIds: [],
  });
});

test("workload evaluation fails closed for tenant mismatch, static authority, malformed evidence or human-only action", () => {
  const live = new AuthorizationService({
    liveAssignmentResolver: { resolveCurrentAssignments: () => [assignment()] }, auditSink: audit([]),
    clock: () => new Date("2026-09-18T12:00:00.000Z"), policyVersion: "policy-v1",
  });
  const base = { subject, action: "service.execute", resource: { type: "Job", id: "job-1", tenantId: "tenant-a" }, purpose: "JOB_EXECUTION", correlationId: "correlation-1" } as const;
  assert.equal(live.evaluateWorkload({ ...base, resource: { ...base.resource, tenantId: "tenant-b" } }).reasonCode, "AUTHORITY_RESOLUTION_FAILED");
  assert.equal(live.evaluateWorkload({ ...base, subject: { ...subject, identityEvidenceRef: "" } }).reasonCode, "AUTHORITY_RESOLUTION_FAILED");
  assert.equal(live.evaluateWorkload({ ...base, action: "publication.approve" }).reasonCode, "HUMAN_AUTHORITY_REQUIRED");
  const compatibility = new AuthorizationService({
    assignments: [assignment()], authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit([]),
    clock: () => new Date("2026-09-18T12:00:00.000Z"), policyVersion: "policy-v1",
  });
  assert.equal(compatibility.evaluateWorkload(base).reasonCode, "AUTHORITY_RESOLUTION_FAILED");
});
