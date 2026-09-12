import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import {
  AuthorizationService,
  type LiveRoleAssignment,
} from "../../authorization/src/authorization-service.js";
import {
  SessionAccessCoordinator,
} from "./session-access-coordinator.js";
import {
  InMemorySessionUnitOfWork,
  type DurableSessionRecord,
  type SessionUnitOfWork,
  type TrustedSessionBindingResolver,
} from "./session-persistence.js";
import { AuthenticationError } from "./session-service.js";

const baseTime = new Date("2026-09-13T00:00:00.000Z");

function instant(milliseconds: number): string {
  return new Date(baseTime.getTime() + milliseconds).toISOString();
}

function session(overrides: Partial<DurableSessionRecord> = {}): DurableSessionRecord {
  return {
    id: "session-access-1",
    principalId: "agent-access-1",
    principalType: "HUMAN",
    roles: ["AGT"],
    teamId: "team-1",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    familyId: "family-access-1",
    refreshReference: "refresh-access-1",
    sessionVersion: 1,
    tenantBindingOrigin: "assignment:access-1:v1",
    issuedAt: instant(0),
    auditEvidenceRef: "audit:session-access-created-1",
    lastAccessedAt: instant(0),
    lastMfaVerifiedAt: instant(0),
    ...overrides,
  };
}

function assignment(overrides: Partial<LiveRoleAssignment> = {}): LiveRoleAssignment {
  return {
    id: "assignment-access-1",
    principalId: "agent-access-1",
    subjectPrincipalType: "HUMAN",
    role: "AGT",
    teamIds: ["team-1"],
    resourceTypes: ["Property"],
    purposes: ["PROPERTY_ADMINISTRATION"],
    effectiveFrom: instant(-60_000),
    effectiveUntil: instant(24 * 60 * 60 * 1000),
    status: "ACTIVE",
    version: 1,
    tenantId: "tenant-1",
    ...overrides,
  };
}

class MutableAssignments {
  public current: readonly LiveRoleAssignment[] = [assignment()];

  public resolveCurrentAssignments(): readonly LiveRoleAssignment[] {
    return this.current;
  }
}

function seed(unit: SessionUnitOfWork, record = session()): void {
  unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
    unit.sessions.create(record);
  });
}

function fixture(input: {
  readonly now: Date;
  readonly record?: DurableSessionRecord;
  readonly unitOfWork?: SessionUnitOfWork;
  readonly bindingResolver?: TrustedSessionBindingResolver;
  readonly assignments?: MutableAssignments;
}): {
  readonly coordinator: SessionAccessCoordinator;
  readonly unitOfWork: SessionUnitOfWork;
  readonly assignments: MutableAssignments;
  readonly auditLog: AuditLog;
} {
  const unitOfWork = input.unitOfWork ?? new InMemorySessionUnitOfWork();
  if (unitOfWork.sessions.find((input.record ?? session()).id) === undefined) {
    seed(unitOfWork, input.record);
  }
  const assignments = input.assignments ?? new MutableAssignments();
  let auditSequence = 0;
  const auditLog = new AuditLog({
    clock: () => new Date(input.now),
    idFactory: () => `audit-access-${String(++auditSequence)}`,
  });
  const authorization = new AuthorizationService({
    liveAssignmentResolver: assignments,
    auditSink: auditLog,
    clock: () => new Date(input.now),
    policyVersion: "authorization-access-v1",
  });
  const bindingResolver = input.bindingResolver ?? {
    resolve: () => ({
      actor: {
        id: "agent-access-1",
        type: "HUMAN" as const,
        roles: ["AGT"] as const,
        teamId: "team-1",
      },
      tenantId: "tenant-1",
      tenantBindingOrigin: "assignment:access-1:v1",
    }),
  };
  return {
    unitOfWork,
    assignments,
    auditLog,
    coordinator: new SessionAccessCoordinator({
      unitOfWork,
      bindingResolver,
      authorization,
      clock: () => new Date(input.now),
    }),
  };
}

const request = {
  sessionId: "session-access-1",
  action: "property.read",
  resource: {
    type: "Property",
    id: "property-1",
    tenantId: "tenant-1",
    teamId: "team-1",
  },
  purpose: "PROPERTY_ADMINISTRATION",
  correlationId: "correlation-session-access-1",
} as const;

function expectAuthenticationCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean =>
    error instanceof AuthenticationError && error.code === code;
}

test("accepts 29m59s idle and rejects the exact 30-minute idle boundary without refresh", () => {
  const allowed = fixture({ now: new Date(instant(29 * 60_000 + 59_000)) });
  assert.equal(allowed.coordinator.resolveAuthorized(request).principalId, "agent-access-1");
  assert.equal(allowed.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 2);

  const blocked = fixture({ now: new Date(instant(30 * 60_000)) });
  assert.throws(
    () => blocked.coordinator.resolveAuthorized(request),
    expectAuthenticationCode("AUTHENTICATION_REQUIRED"),
  );
  assert.equal(blocked.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
  assert.equal(blocked.unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
});

test("rejects the exact 12-hour absolute boundary regardless of recent access", () => {
  const allowedRecord = session({ lastAccessedAt: instant(11 * 60 * 60_000 + 59 * 60_000) });
  const allowed = fixture({ now: new Date(instant(12 * 60 * 60_000 - 1_000)), record: allowedRecord });
  assert.equal(allowed.coordinator.resolveAuthorized(request).principalId, "agent-access-1");

  const record = session({ lastAccessedAt: instant(12 * 60 * 60_000 - 60_000) });
  const blocked = fixture({ now: new Date(instant(12 * 60 * 60_000)), record });
  assert.throws(
    () => blocked.coordinator.resolveAuthorized(request),
    expectAuthenticationCode("AUTHENTICATION_REQUIRED"),
  );
  assert.equal(blocked.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
});

test("accepts MFA at 15 minutes and rejects MFA older than 15 minutes", () => {
  const privilegedRequest = {
    ...request,
    action: "release.accept",
    reason: "approved staging acceptance verification",
  };
  const releaseAssignment = assignment({
    role: "RELEASE_OWNER",
    resourceTypes: ["ReleaseCandidate"],
  });
  const releaseRequest = {
    ...privilegedRequest,
    resource: { ...request.resource, type: "ReleaseCandidate" },
  };

  const exact = new MutableAssignments();
  exact.current = [releaseAssignment];
  const allowed = fixture({ now: new Date(instant(15 * 60_000)), assignments: exact });
  assert.equal(allowed.coordinator.resolveAuthorized(releaseRequest).principalId, "agent-access-1");

  const stale = new MutableAssignments();
  stale.current = [releaseAssignment];
  const blocked = fixture({ now: new Date(instant(15 * 60_000 + 1)), assignments: stale });
  assert.throws(
    () => blocked.coordinator.resolveAuthorized(releaseRequest),
    expectAuthenticationCode("REAUTHENTICATION_REQUIRED"),
  );
  assert.equal(blocked.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
});

test("denied live authority and revoked Sessions never refresh last access", () => {
  const assignments = new MutableAssignments();
  assignments.current = [];
  const denied = fixture({ now: new Date(instant(60_000)), assignments });
  assert.throws(() => denied.coordinator.resolveAuthorized(request), /NO_ACTIVE_ASSIGNMENT/);
  assert.equal(denied.unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));

  const revokedUnit = new InMemorySessionUnitOfWork();
  seed(revokedUnit);
  revokedUnit.transaction({ sessionId: request.sessionId, expectedVersion: 1 }, () => {
    revokedUnit.sessions.appendRevocation(1, {
      sessionId: request.sessionId,
      revokedAt: instant(30_000),
      revocationEvidenceRef: "audit:revoked-access-1",
      auditEvidenceRef: "audit:revoked-access-1",
    });
  });
  const revoked = fixture({ now: new Date(instant(60_000)), unitOfWork: revokedUnit });
  assert.throws(
    () => revoked.coordinator.resolveAuthorized(request),
    expectAuthenticationCode("AUTHENTICATION_REQUIRED"),
  );
  assert.equal(revoked.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 2);
  assert.equal(revoked.unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
});

test("ignores caller actor role tenant and scope claims in favor of trusted binding", () => {
  const { coordinator, auditLog } = fixture({ now: new Date(instant(60_000)) });
  const result = coordinator.resolveAuthorized({
    ...request,
    actorId: "caller-admin",
    roles: ["ADM"],
    tenantId: "caller-tenant",
    scope: "caller-global",
  } as typeof request);

  assert.equal(result.principalId, "agent-access-1");
  assert.deepEqual(result.roles, ["AGT"]);
  assert.equal(result.teamId, "team-1");
  assert.notEqual(result.id, request.sessionId);
  assert.notEqual(result.refreshReference, "refresh-access-1");
  const events = auditLog.query({ requesterId: "security-review", purpose: "TEST" });
  assert.equal(events.some((event) => event.principal.sessionId === request.sessionId), false);
  assert.equal(events.some((event) => event.target.id === request.sessionId), false);
  assert.equal(JSON.stringify(events).includes("refresh-access-1"), false);
});

test("missing and malformed locators fail closed without mutation", () => {
  for (const sessionId of ["", " session-access-1", "session/access/1"]) {
    const state = fixture({ now: new Date(instant(60_000)) });
    assert.throws(
      () => state.coordinator.resolveAuthorized({ ...request, sessionId }),
      expectAuthenticationCode("AUTHENTICATION_REQUIRED"),
    );
    assert.equal(state.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
    assert.equal(state.unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
  }
});

test("revalidates live role capability on every request", () => {
  const state = fixture({ now: new Date(instant(60_000)) });
  state.coordinator.resolveAuthorized(request);
  const versionAfterAllow = state.unitOfWork.sessions.find(request.sessionId)?.sessionVersion;

  state.assignments.current = [];
  assert.throws(() => state.coordinator.resolveAuthorized(request), /NO_ACTIVE_ASSIGNMENT/);
  assert.equal(state.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, versionAfterAllow);
});

test("concurrent revocation wins over stale authorized access update", () => {
  const underlying = new InMemorySessionUnitOfWork();
  seed(underlying);
  let injectRevocation = true;
  const racingUnit: SessionUnitOfWork = {
    sessions: underlying.sessions,
    transaction: (identity, operation) => {
      if (injectRevocation && identity.expectedVersion === 1) {
        injectRevocation = false;
        underlying.transaction(identity, () => underlying.sessions.appendRevocation(1, {
          sessionId: identity.sessionId,
          revokedAt: instant(30_000),
          revocationEvidenceRef: "audit:concurrent-revocation-1",
          auditEvidenceRef: "audit:concurrent-revocation-1",
        }));
      }
      return underlying.transaction(identity, operation);
    },
  };
  const state = fixture({ now: new Date(instant(60_000)), unitOfWork: racingUnit });

  assert.throws(
    () => state.coordinator.resolveAuthorized(request),
    expectAuthenticationCode("AUTHENTICATION_REQUIRED"),
  );
  assert.equal(underlying.sessions.find(request.sessionId)?.state, "REVOKED");
  assert.equal(underlying.sessions.find(request.sessionId)?.sessionVersion, 2);
  assert.equal(underlying.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
});

test("missing or failing trusted binding resolver fails closed without access refresh", () => {
  for (const bindingResolver of [
    { resolve: () => null },
    { resolve: () => { throw new Error("Bearer hidden-token C:\\secret\\identity.sqlite SELECT *"); } },
  ] satisfies readonly TrustedSessionBindingResolver[]) {
    const state = fixture({
      now: new Date(instant(60_000)),
      bindingResolver,
    });
    assert.throws(
      () => state.coordinator.resolveAuthorized(request),
      (error: unknown) => error instanceof AuthenticationError
        && ["AUTHENTICATION_REQUIRED", "FORBIDDEN"].includes(error.code)
        && !/hidden-token|secret|sqlite|select|stack/i.test(error.message),
    );
    assert.equal(state.unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
    assert.equal(state.unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
  }
});

test("authorization dependency failure is concealed and does not refresh access", () => {
  const unitOfWork = new InMemorySessionUnitOfWork();
  seed(unitOfWork);
  const coordinator = new SessionAccessCoordinator({
    unitOfWork,
    bindingResolver: {
      resolve: () => ({
        actor: { id: "agent-access-1", type: "HUMAN", roles: ["AGT"], teamId: "team-1" },
        tenantId: "tenant-1",
        tenantBindingOrigin: "assignment:access-1:v1",
      }),
    },
    authorization: {
      evaluate: () => { throw new Error("Bearer unsafe-value C:\\private\\authority.sqlite SELECT token\n at unsafe stack"); },
    },
    clock: () => new Date(instant(60_000)),
  });
  assert.throws(
    () => coordinator.resolveAuthorized(request),
    (error: unknown) => error instanceof AuthenticationError
      && error.code === "AUTHENTICATION_REQUIRED"
      && !/bearer|private|sqlite|select|token|stack/i.test(error.message),
  );
  assert.equal(unitOfWork.sessions.find(request.sessionId)?.sessionVersion, 1);
  assert.equal(unitOfWork.sessions.find(request.sessionId)?.lastAccessedAt, instant(0));
});
