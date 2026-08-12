import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import {
  AuthenticationError,
  SessionService,
  type AuthenticatedIdentity,
  type AuthenticationAdapter,
  type AuthenticationEvidence,
} from "./session-service.js";

class StubAuthenticationAdapter implements AuthenticationAdapter {
  public constructor(private readonly identity: AuthenticatedIdentity | null) {}

  public verify(_evidence: AuthenticationEvidence): AuthenticatedIdentity | null {
    return this.identity;
  }
}

function createFixture(identity: AuthenticatedIdentity | null = {
  principalId: "user-agent-1",
  principalType: "HUMAN",
  roles: ["AGT"],
  teamId: "team-a",
  assurance: "MFA",
  isMfaVerified: true,
  status: "ACTIVE",
}): {
  readonly service: SessionService;
  readonly auditLog: AuditLog;
  advance(minutes: number): void;
} {
  let now = new Date("2026-07-19T00:00:00.000Z");
  let sequence = 0;
  const clock = (): Date => new Date(now);
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `audit-${String(++sequence)}`,
  });
  const service = new SessionService({
    authenticationAdapter: new StubAuthenticationAdapter(identity),
    auditSink: auditLog,
    clock,
    idFactory: () => `identity-${String(++sequence)}`,
    accessLifetimeMs: 15 * 60 * 1000,
    absoluteLifetimeMs: 60 * 60 * 1000,
  });

  return {
    service,
    auditLog,
    advance(minutes: number): void {
      now = new Date(now.getTime() + minutes * 60 * 1000);
    },
  };
}

const evidence: AuthenticationEvidence = {
  credentialReference: "credential-reference-1",
  requestedScope: "internal",
};

test("TEST-026 returns a generic authentication failure", () => {
  const { service } = createFixture(null);

  assert.throws(
    () =>
      service.createSession({
        evidence,
        requestId: "request-identity-1",
        correlationId: "correlation-identity-1",
      }),
    (error: unknown) =>
      error instanceof AuthenticationError &&
      error.code === "INVALID_CREDENTIAL" &&
      error.publicMessage === "Authentication failed.",
  );
});

test("TEST-026 creates a bounded session without auditing credential evidence", () => {
  const { service, auditLog } = createFixture();

  const session = service.createSession({
    evidence,
    requestId: "request-identity-2",
    correlationId: "correlation-identity-2",
  });

  assert.equal(session.state, "ACTIVE");
  assert.equal(session.principalId, "user-agent-1");
  assert.equal(session.expiresAt, "2026-07-19T00:15:00.000Z");
  assert.equal(session.absoluteExpiresAt, "2026-07-19T01:00:00.000Z");
  assert.equal(Object.isFrozen(session), true);
  const events = auditLog.query({
    requesterId: "user-security-1",
    purpose: "TEST",
    correlationId: "correlation-identity-2",
  });
  assert.equal(events.length, 1);
  assert.equal(JSON.stringify(events).includes("credential-reference-1"), false);
});

test("FCR-008 rejects contradictory authentication assurance before creating a Session", () => {
  const { service, auditLog } = createFixture({
    principalId: "user-agent-contradictory",
    principalType: "HUMAN",
    roles: ["AGT"],
    teamId: "team-a",
    assurance: "SINGLE_FACTOR",
    isMfaVerified: true,
    status: "ACTIVE",
  });

  assert.throws(
    () => service.createSession({ evidence, correlationId: "correlation-fcr-008" }),
    (error: unknown) => error instanceof AuthenticationError
      && error.code === "INVALID_CREDENTIAL"
      && error.publicMessage === "Authentication failed.",
  );
  assert.equal(auditLog.query({ requesterId: "user-security-1", purpose: "TEST", correlationId: "correlation-fcr-008" }).some(({ decision }) => decision === "ALLOW"), false);
});

test("TEST-046 expires stale sessions fail closed", () => {
  const { service, advance } = createFixture();
  const session = service.createSession({
    evidence,
    correlationId: "correlation-identity-3",
  });
  advance(16);

  assert.throws(() => service.readSession(session.id), /SESSION_EXPIRED/);
});

test("TEST-046 rejects human roles for a service principal", () => {
  const { service } = createFixture({
    principalId: "service-worker-1",
    principalType: "SERVICE",
    roles: ["AGT"],
    assurance: "WORKLOAD",
    isMfaVerified: false,
    status: "ACTIVE",
  });

  assert.throws(
    () =>
      service.createSession({
        evidence,
        correlationId: "correlation-identity-4",
      }),
    /SERVICE_ROLE_PROHIBITED/,
  );
});

test("TEST-046 rotates refresh references and revokes the family on replay", () => {
  const { service } = createFixture();
  const original = service.createSession({
    evidence,
    correlationId: "correlation-identity-5",
  });
  const successor = service.refreshSession({
    sessionId: original.id,
    refreshReference: original.refreshReference,
    correlationId: "correlation-identity-6",
  });

  assert.equal(successor.state, "ACTIVE");
  assert.notEqual(successor.refreshReference, original.refreshReference);
  assert.throws(() => service.readSession(original.id), /SESSION_REVOKED/);

  assert.throws(
    () =>
      service.refreshSession({
        sessionId: original.id,
        refreshReference: original.refreshReference,
        correlationId: "correlation-identity-7",
      }),
    /SESSION_REVOKED/,
  );
  assert.throws(() => service.readSession(successor.id), /SESSION_REVOKED/);
});
