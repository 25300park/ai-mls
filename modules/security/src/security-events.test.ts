import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { SecurityEventService } from "./security-events.js";

test("TEST-049 records privacy-safe immutable security event evidence", () => {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:00:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-security-${String(++sequence)}`,
  });
  const service = new SecurityEventService({
    auditSink: auditLog,
    policyVersion: "security-event-v1",
  });

  const event = service.record({
    eventType: "SUSPICIOUS_AUTHENTICATION",
    principal: {
      id: "user-agent-1",
      type: "HUMAN",
      roles: ["AGT"],
      sessionId: "session-security-1",
    },
    action: "authentication.evaluate-risk",
    target: { type: "User", id: "user-agent-1" },
    purpose: "SECURITY_MONITORING",
    classification: "RESTRICTED_SECURITY",
    decision: "DENY",
    outcome: "COMPLETED",
    severity: "HIGH",
    reason: "REPEATED_DENIAL",
    requestId: "request-security-2",
    correlationId: "correlation-security-2",
    controlIds: ["SEC-024", "SEC-025"],
    observedFacts: {
      denialCount: 5,
      sessionToken: "synthetic-session-value",
    },
    detectorInference: {
      ruleVersion: "rule-v1",
      isSuspicious: true,
    },
  });

  assert.equal(event.eventType, "SUSPICIOUS_AUTHENTICATION");
  assert.equal(event.correlationId, "correlation-security-2");
  assert.equal(JSON.stringify(event).includes("synthetic-session-value"), false);
  assert.equal(Object.isFrozen(event), true);
});

test("TEST-053 records governed change monitoring metadata", () => {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:00:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-change-${String(++sequence)}`,
  });
  const service = new SecurityEventService({
    auditSink: auditLog,
    policyVersion: "security-event-v1",
  });

  const event = service.record({
    eventType: "GOVERNED_CHANGE_VALIDATED",
    principal: {
      id: "user-admin-1",
      type: "HUMAN",
      roles: ["ADM"],
      sessionId: "session-change-1",
    },
    action: "change.validate",
    target: { type: "DecisionHistory", id: "decision-history-1", version: 1 },
    purpose: "CHANGE_GOVERNANCE",
    classification: "RESTRICTED_SECURITY",
    decision: "ALLOW",
    outcome: "COMPLETED",
    severity: "INFO",
    reason: "VALIDATION_PASSED",
    correlationId: "correlation-change-1",
    controlIds: ["SEC-021", "SEC-026", "SEC-033"],
    observedFacts: {
      changeReference: "SP-001",
      monitoringStatus: "READY",
      rollbackImpact: "CONFIG_ONLY",
    },
  });

  assert.deepEqual(event.details?.controlIds, [
    "SEC-021",
    "SEC-026",
    "SEC-033",
  ]);
  assert.equal(event.reason, "VALIDATION_PASSED");
});
