import assert from "node:assert/strict";
import test from "node:test";

import { AdministrationService } from "../../../modules/administration/src/administration-service.js";
import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import { AdminAuditApi } from "./admin-audit-api.js";

function adminSession(principalId = "user-admin-1"): SessionContext {
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

function fixture(): { readonly api: AdminAuditApi; readonly session: SessionContext } {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const auditLog = new AuditLog({ clock, idFactory: () => `audit-boundary-${String(++sequence)}` });
  const session = adminSession();
  const assignments: readonly RoleAssignment[] = [{
    id: "assignment-admin-1",
    principalId: session.principalId,
    role: "ADM",
    teamIds: ["team-a"],
    resourceTypes: ["RoleAssignment", "AuditEvent"],
    purposes: ["ACCESS_GOVERNANCE", "AUDIT_INVESTIGATION"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
  }];
  const authorizationService = new AuthorizationService({
    assignments,
    authoritySource: "STATIC_TEST_COMPATIBILITY",
    auditSink: auditLog,
    clock,
    policyVersion: "authorization-v1",
  });
  const administrationService = new AdministrationService({
    authorizationService,
    auditSink: auditLog,
    clock,
    idFactory: () => `assignment-boundary-${String(++sequence)}`,
    policyVersion: "administration-v1",
  });
  return {
    session,
    api: new AdminAuditApi({
      administrationService,
      authorizationService,
      auditLog,
      sessionReader: (sessionId) => {
        if (sessionId !== session.id) throw new Error("SESSION_REVOKED");
        return session;
      },
    }),
  };
}

test("TEST-034 API-015 ignores a body actor and uses the authenticated session", () => {
  const { api, session } = fixture();
  const response = api.proposeAssignment({
    context: { sessionId: session.id, requestId: "request-admin-1", correlationId: "correlation-admin-1" },
    subjectPrincipalId: "user-agent-2",
    subjectPrincipalType: "HUMAN",
    role: "AGT",
    teamIds: ["team-a"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-07-19T01:00:00.000Z",
    effectiveUntil: "2026-08-19T01:00:00.000Z",
    reason: "Approved role governance request",
    actor: { principalId: "body-admin" },
  } as Parameters<AdminAuditApi["proposeAssignment"]>[0] & { actor: unknown });

  assert.equal(response.ok, true);
  if (response.ok) assert.equal(response.data.proposedBy, session.principalId);
});

test("TEST-006 API-016 authorizes an audit query and preserves correlation metadata", () => {
  const { api, session } = fixture();
  const response = api.queryAudit({
    context: { sessionId: session.id, requestId: "request-audit-1", correlationId: "correlation-audit-1" },
    purpose: "AUDIT_INVESTIGATION",
    eventType: "AUTHORIZATION_DECISION",
  });

  assert.equal(response.ok, true);
  if (response.ok) assert.equal(response.data.length, 1);
  assert.deepEqual(response.meta, {
    requestId: "request-audit-1",
    correlationId: "correlation-audit-1",
  });
});
