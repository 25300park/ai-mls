import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "./audit-log.js";

const principal = {
  id: "user-security-1",
  type: "HUMAN",
  roles: ["SEC"],
  sessionId: "session-1",
} as const;

function createAuditLog(): AuditLog {
  let sequence = 0;
  return new AuditLog({
    clock: () => new Date("2026-07-19T00:00:00.000Z"),
    idFactory: () => `audit-${String(++sequence)}`,
  });
}

test("TEST-006 appends complete immutable audit evidence", () => {
  const auditLog = createAuditLog();

  const event = auditLog.append({
    eventType: "AUTHORIZATION_DECISION",
    principal,
    action: "authorization.evaluate",
    target: { type: "Role", id: "role-agent", version: 3 },
    purpose: "SECURITY_CONTROL",
    policyVersion: "policy-v1",
    classification: "RESTRICTED_SECURITY",
    decision: "DENY",
    outcome: "COMPLETED",
    reason: "SCOPE_DENIED",
    requestId: "request-1",
    correlationId: "correlation-1",
    details: { evaluatedScope: "team-a" },
  });

  assert.equal(event.id, "audit-1");
  assert.equal(event.occurredAt, "2026-07-19T00:00:00.000Z");
  assert.equal(event.correlationId, "correlation-1");
  assert.equal(event.target.version, 3);
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.target), true);
  assert.throws(() => {
    Object.assign(event, { outcome: "FAILED" });
  }, TypeError);
});

test("TEST-049 rejects sensitive audit detail keys", () => {
  const auditLog = createAuditLog();

  assert.throws(
    () =>
      auditLog.append({
        eventType: "LOGIN",
        principal,
        action: "session.create",
        target: { type: "User", id: "user-security-1" },
        purpose: "AUTHENTICATION",
        policyVersion: "identity-v1",
        classification: "RESTRICTED_SECURITY",
        decision: "DENY",
        outcome: "FAILED",
        reason: "INVALID_CREDENTIAL",
        correlationId: "correlation-2",
        details: { password: "not-a-real-password" },
      }),
    /SENSITIVE_AUDIT_DETAIL/,
  );
});

test("TEST-034 requires a purpose for audit queries", () => {
  const auditLog = createAuditLog();

  assert.throws(
    () => auditLog.query({ requesterId: principal.id, purpose: "" }),
    /AUDIT_PURPOSE_REQUIRED/,
  );
});

test("TEST-006 corrections append a linked event without replacing the original", () => {
  const auditLog = createAuditLog();
  const original = auditLog.append({
    eventType: "ROLE_ASSIGNMENT",
    principal,
    action: "role-assignment.activate",
    target: { type: "RoleAssignment", id: "assignment-1", version: 1 },
    purpose: "ACCESS_GOVERNANCE",
    policyVersion: "admin-v1",
    classification: "RESTRICTED_SECURITY",
    decision: "ALLOW",
    outcome: "COMPLETED",
    reason: "APPROVED",
    correlationId: "correlation-3",
  });

  const correction = auditLog.correct({
    originalEventId: original.id,
    principal,
    reason: "Correct target version reference",
    correlationId: "correlation-4",
    correctedDetails: { targetVersion: 2 },
  });

  assert.equal(correction.correctionOf, original.id);
  assert.equal(correction.eventType, "AUDIT_CORRECTION");
  assert.equal(auditLog.query({ requesterId: principal.id, purpose: "INVESTIGATION" }).length, 2);
  assert.equal(original.target.version, 1);
});
