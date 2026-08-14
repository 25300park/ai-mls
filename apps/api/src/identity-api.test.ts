import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../../modules/audit/src/audit-log.js";
import {
  AuthorizationService,
  type RoleAssignment,
} from "../../../modules/authorization/src/authorization-service.js";
import {
  SessionService,
  type AuthenticatedIdentity,
  type AuthenticationAdapter,
  type AuthenticationEvidence,
} from "../../../modules/identity/src/session-service.js";
import { IdentityApi } from "./identity-api.js";

class StubAuthenticationAdapter implements AuthenticationAdapter {
  public constructor(private readonly identity: AuthenticatedIdentity | null) {}

  public verify(_evidence: AuthenticationEvidence): AuthenticatedIdentity | null {
    return this.identity;
  }
}

function fixture(identity: AuthenticatedIdentity | null = {
  principalId: "user-agent-1",
  principalType: "HUMAN",
  roles: ["AGT"],
  teamId: "team-a",
  assurance: "MFA",
  isMfaVerified: true,
  status: "ACTIVE",
}): IdentityApi {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:00:00.000Z");
  const auditLog = new AuditLog({ clock, idFactory: () => `audit-api-${String(++sequence)}` });
  const sessionService = new SessionService({
    authenticationAdapter: new StubAuthenticationAdapter(identity),
    auditSink: auditLog,
    clock,
    idFactory: () => `identity-api-${String(++sequence)}`,
    accessLifetimeMs: 15 * 60 * 1000,
    absoluteLifetimeMs: 60 * 60 * 1000,
  });
  const assignments: readonly RoleAssignment[] = [{
    id: "assignment-agent-1",
    principalId: "user-agent-1",
    role: "AGT",
    teamIds: ["team-a"],
    resourceTypes: ["CandidateListing"],
    purposes: ["CLIENT_SERVICE"],
    effectiveFrom: "2026-07-18T00:00:00.000Z",
    effectiveUntil: "2026-07-20T00:00:00.000Z",
    status: "ACTIVE",
  }];
  return new IdentityApi({
    sessionService,
    authorizationService: new AuthorizationService({
      assignments,
      authoritySource: "STATIC_TEST_COMPATIBILITY",
      auditSink: auditLog,
      clock,
      policyVersion: "authorization-v1",
    }),
  });
}

test("TEST-026 API-001 returns a stable generic authentication error", () => {
  const response = fixture(null).createSession({
    context: { requestId: "request-api-1", correlationId: "correlation-api-1" },
    evidence: { credentialReference: "fixture-reference", requestedScope: "internal" },
  });

  assert.deepEqual(response, {
    ok: false,
    error: { code: "INVALID_CREDENTIAL", message: "Authentication failed." },
    meta: { requestId: "request-api-1", correlationId: "correlation-api-1" },
  });
  assert.equal(JSON.stringify(response).includes("stack"), false);
});

test("TEST-009 API-002 derives the actor from the bounded session context", () => {
  const api = fixture();
  const created = api.createSession({
    context: { requestId: "request-api-2", correlationId: "correlation-api-2" },
    evidence: { credentialReference: "fixture-reference", requestedScope: "internal" },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const response = api.evaluateAuthorization({
    context: {
      sessionId: created.data.id,
      requestId: "request-api-3",
      correlationId: "correlation-api-3",
    },
    action: "resource.edit",
    resource: { type: "CandidateListing", id: "listing-1", teamId: "team-a" },
    purpose: "CLIENT_SERVICE",
    actor: { principalId: "body-admin" },
  } as Parameters<IdentityApi["evaluateAuthorization"]>[0] & { actor: unknown });

  assert.equal(response.ok, true);
  if (response.ok) assert.equal(response.data.effect, "ALLOW");
  assert.equal(response.meta.correlationId, "correlation-api-3");
});
