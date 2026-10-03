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
import {
  InMemorySessionUnitOfWork,
  SessionPersistenceError,
  type SessionUnitOfWork,
} from "./session-persistence.js";

class StubAuthenticationAdapter implements AuthenticationAdapter {
  public constructor(private readonly identity: AuthenticatedIdentity | null) {}

  public verify(_evidence: AuthenticationEvidence): Promise<AuthenticatedIdentity | null> {
    return Promise.resolve(this.identity);
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

test("TEST-026 returns a generic authentication failure", async () => {
  const { service } = createFixture(null);

  await assert.rejects(
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

test("TEST-026 creates a bounded session without auditing credential evidence", async () => {
  const { service, auditLog } = createFixture();

  const session = await service.createSession({
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
  assert.equal(events.some((event) => event.principal.sessionId === session.id), false);
  assert.equal(events.some((event) => event.target.id === session.id), false);
  assert.equal(events.some((event) => JSON.stringify(event.details ?? {}).includes(session.id)), false);
  assert.equal(JSON.stringify(events).includes(session.refreshReference), false);
  assert.equal(events[0]?.outcome, "ACCEPTED");
});

test("persistence failure leaves no false completed Session audit evidence", async () => {
  let sequence = 0;
  const clock = (): Date => new Date("2026-09-13T00:00:00.000Z");
  const auditLog = new AuditLog({
    clock,
    idFactory: () => `atomic-failure-audit-${String(++sequence)}`,
  });
  const failingUnit: SessionUnitOfWork = {
    sessions: new InMemorySessionUnitOfWork().sessions,
    transaction: () => { throw new SessionPersistenceError("SESSION_VERSION_CONFLICT"); },
  };
  const service = new SessionService({
    authenticationAdapter: new StubAuthenticationAdapter({
      principalId: "atomic-failure-user",
      principalType: "HUMAN",
      roles: ["AGT"],
      teamId: "team-atomic-failure",
      assurance: "MFA",
      isMfaVerified: true,
      status: "ACTIVE",
    }),
    auditSink: auditLog,
    clock,
    idFactory: () => `atomic-failure-identity-${String(++sequence)}`,
    accessLifetimeMs: 30 * 60 * 1000,
    absoluteLifetimeMs: 12 * 60 * 60 * 1000,
    unitOfWork: failingUnit,
    tenantBindingOrigin: "assignment:atomic-failure-user:v1",
  });
  await assert.rejects(
    () => service.createSession({ evidence, correlationId: "correlation-session-atomic-failure" }),
    /SESSION_VERSION_CONFLICT/,
  );
  const events = auditLog.query({ requesterId: "security-review", purpose: "TEST" });
  assert.equal(events.some((event) => event.outcome === "COMPLETED"), false);
});

test("FCR-008 rejects contradictory authentication assurance before creating a Session", async () => {
  const { service, auditLog } = createFixture({
    principalId: "user-agent-contradictory",
    principalType: "HUMAN",
    roles: ["AGT"],
    teamId: "team-a",
    assurance: "SINGLE_FACTOR",
    isMfaVerified: true,
    status: "ACTIVE",
  });

  await assert.rejects(
    () => service.createSession({ evidence, correlationId: "correlation-fcr-008" }),
    (error: unknown) => error instanceof AuthenticationError
      && error.code === "INVALID_CREDENTIAL"
      && error.publicMessage === "Authentication failed.",
  );
  assert.equal(auditLog.query({ requesterId: "user-security-1", purpose: "TEST", correlationId: "correlation-fcr-008" }).some(({ decision }) => decision === "ALLOW"), false);
});

test("TEST-046 expires stale sessions fail closed", async () => {
  const { service, advance } = createFixture();
  const session = await service.createSession({
    evidence,
    correlationId: "correlation-identity-3",
  });
  advance(16);

  assert.throws(() => service.readSession(session.id), /SESSION_EXPIRED/);
});

test("TEST-046 rejects human roles for a service principal", async () => {
  const { service } = createFixture({
    principalId: "service-worker-1",
    principalType: "SERVICE",
    roles: ["AGT"],
    assurance: "WORKLOAD",
    isMfaVerified: false,
    status: "ACTIVE",
  });

  await assert.rejects(
    () =>
      service.createSession({
        evidence,
        correlationId: "correlation-identity-4",
      }),
    /SERVICE_ROLE_PROHIBITED/,
  );
});

test("TEST-046 rotates refresh references and revokes the family on replay", async () => {
  const { service } = createFixture();
  const original = await service.createSession({
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

function createPersistentService(
  unitOfWork: SessionUnitOfWork,
  idPrefix: string,
): SessionService {
  let sequence = 0;
  const clock = (): Date => new Date("2026-09-13T00:00:00.000Z");
  return new SessionService({
    authenticationAdapter: new StubAuthenticationAdapter({
      principalId: "durable-user-1",
      principalType: "HUMAN",
      roles: ["AGT"],
      teamId: "team-durable",
      assurance: "MFA",
      isMfaVerified: true,
      status: "ACTIVE",
    }),
    auditSink: new AuditLog({
      clock,
      idFactory: () => `${idPrefix}-audit-${String(++sequence)}`,
    }),
    clock,
    idFactory: () => `${idPrefix}-identity-${String(++sequence)}`,
    accessLifetimeMs: 30 * 60 * 1000,
    absoluteLifetimeMs: 12 * 60 * 60 * 1000,
    unitOfWork,
    tenantBindingOrigin: "assignment:durable-user-1:v1",
  });
}

test("Phase 1D persists a newly issued Session at version 1 for reconstruction", async () => {
  const unitOfWork = new InMemorySessionUnitOfWork();
  const first = createPersistentService(unitOfWork, "first");
  const created = await first.createSession({
    evidence,
    correlationId: "correlation-phase1d-create",
  });

  assert.equal(created.sessionVersion, 1);
  assert.equal(created.issuedAt, "2026-09-13T00:00:00.000Z");
  assert.equal(created.lastAccessedAt, "2026-09-13T00:00:00.000Z");
  assert.equal(created.tenantBindingOrigin, "assignment:durable-user-1:v1");

  const reconstructed = createPersistentService(unitOfWork, "second");
  assert.deepEqual(reconstructed.readSession(created.id), created);
});

test("Phase 1D persists irreversible revoke metadata and increments version once", async () => {
  const unitOfWork = new InMemorySessionUnitOfWork();
  const service = createPersistentService(unitOfWork, "revoke");
  const created = await service.createSession({
    evidence,
    correlationId: "correlation-phase1d-revoke-create",
  });
  const revoked = service.revokeSession({
    sessionId: created.id,
    actor: {
      id: "security-operator-1",
      type: "HUMAN",
      roles: ["SEC"],
      teamId: "team-security",
    },
    reason: "approved security revocation",
    correlationId: "correlation-phase1d-revoke",
  });

  assert.equal(revoked.state, "REVOKED");
  assert.equal(revoked.sessionVersion, 2);
  assert.equal(revoked.revokedAt, "2026-09-13T00:00:00.000Z");
  assert.equal(typeof revoked.revocationEvidenceRef, "string");

  const reconstructed = createPersistentService(unitOfWork, "revoke-reconstructed");
  assert.throws(() => reconstructed.readSession(created.id), /SESSION_REVOKED/);
});

test("Phase 1D refresh replay revokes the durable Session family after reconstruction", async () => {
  const unitOfWork = new InMemorySessionUnitOfWork();
  const first = createPersistentService(unitOfWork, "refresh-first");
  const original = await first.createSession({
    evidence,
    correlationId: "correlation-phase1d-refresh-create",
  });
  const successor = first.refreshSession({
    sessionId: original.id,
    refreshReference: original.refreshReference,
    correlationId: "correlation-phase1d-refresh",
  });

  const reconstructed = createPersistentService(unitOfWork, "refresh-second");
  assert.throws(() => reconstructed.refreshSession({
    sessionId: original.id,
    refreshReference: original.refreshReference,
    correlationId: "correlation-phase1d-refresh-replay",
  }), /SESSION_REVOKED/);
  assert.throws(() => reconstructed.readSession(successor.id), /SESSION_REVOKED/);
});
