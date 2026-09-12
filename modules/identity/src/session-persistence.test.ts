import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemorySessionUnitOfWork,
  SessionPersistenceError,
  type DurableSessionRecord,
} from "./session-persistence.js";

function activeSession(
  overrides: Partial<DurableSessionRecord> = {},
): DurableSessionRecord {
  return {
    id: "session-1",
    principalId: "user-1",
    principalType: "HUMAN",
    roles: ["AGT"],
    teamId: "team-1",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    familyId: "family-1",
    refreshReference: "refresh-1",
    sessionVersion: 1,
    tenantBindingOrigin: "assignment:role-assignment-1:v3",
    issuedAt: "2026-09-13T00:00:00.000Z",
    lastAccessedAt: "2026-09-13T00:00:00.000Z",
    lastMfaVerifiedAt: "2026-09-13T00:00:00.000Z",
    auditEvidenceRef: "audit:session-created-1",
    ...overrides,
  };
}

function expectCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean =>
    error instanceof SessionPersistenceError && error.code === code;
}

test("creates a complete Session at canonical version 1 and returns an immutable clone", () => {
  const unit = new InMemorySessionUnitOfWork();
  const mutableRoles = ["AGT"] as const;
  const record = activeSession({ roles: mutableRoles });

  unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
    unit.sessions.create(record);
  });

  const found = unit.sessions.find(record.id);
  assert.equal(found?.sessionVersion, 1);
  assert.notStrictEqual(found, record);
  assert.notStrictEqual(found?.roles, record.roles);
  assert.equal(Object.isFrozen(found), true);
  assert.equal(Object.isFrozen(found?.roles), true);
});

test("rejects incomplete, unknown-field, and non-version-1 Session creation", () => {
  const invalidRecords: readonly unknown[] = [
    { ...activeSession(), principalId: undefined },
    { ...activeSession(), callerRole: "ADM" },
    activeSession({ sessionVersion: 2 }),
  ];

  for (const record of invalidRecords) {
    const unit = new InMemorySessionUnitOfWork();
    assert.throws(
      () => unit.transaction({ sessionId: "session-1", expectedVersion: 0 }, () => {
        unit.sessions.create(record as DurableSessionRecord);
      }),
      expectCode("SESSION_RECORD_INVALID"),
    );
    assert.equal(unit.sessions.find("session-1"), undefined);
  }
});

test("enforces compare-and-swap and exactly one Session version increment", () => {
  const unit = new InMemorySessionUnitOfWork();
  const record = activeSession();
  unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
    unit.sessions.create(record);
  });

  assert.throws(
    () => unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => undefined),
    expectCode("SESSION_VERSION_CONFLICT"),
  );

  unit.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
    unit.sessions.update(1, activeSession({
      sessionVersion: 2,
      lastAccessedAt: "2026-09-13T00:01:00.000Z",
    }));
  });
  assert.equal(unit.sessions.find(record.id)?.sessionVersion, 2);
});

test("rejects mutation of immutable actor, binding, family, and issuance fields", () => {
  const mutations: readonly Partial<DurableSessionRecord>[] = [
    { principalId: "other-user" },
    { principalType: "SERVICE" },
    { tenantBindingOrigin: "assignment:other:v1" },
    { familyId: "other-family" },
    { issuedAt: "2026-09-13T00:00:01.000Z" },
  ];

  for (const mutation of mutations) {
    const unit = new InMemorySessionUnitOfWork();
    const record = activeSession();
    unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
      unit.sessions.create(record);
    });
    assert.throws(
      () => unit.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
        unit.sessions.update(1, activeSession({ ...mutation, sessionVersion: 2 }));
      }),
      expectCode("SESSION_IMMUTABLE_FIELD"),
    );
    assert.deepEqual(unit.sessions.find(record.id), record);
  }
});

test("appends irreversible revocation at N plus 1 and rejects reactivation", () => {
  const unit = new InMemorySessionUnitOfWork();
  const record = activeSession();
  unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
    unit.sessions.create(record);
  });

  unit.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
    unit.sessions.appendRevocation(1, {
      sessionId: record.id,
      revokedAt: "2026-09-13T00:05:00.000Z",
      revocationEvidenceRef: "audit:session-revoked-1",
      auditEvidenceRef: "audit:session-revoked-1",
    });
  });

  const revoked = unit.sessions.find(record.id);
  assert.equal(revoked?.state, "REVOKED");
  assert.equal(revoked?.sessionVersion, 2);
  assert.equal(revoked?.revokedAt, "2026-09-13T00:05:00.000Z");
  assert.equal(revoked?.revocationEvidenceRef, "audit:session-revoked-1");

  assert.throws(
    () => unit.transaction({ sessionId: record.id, expectedVersion: 2 }, () => {
      unit.sessions.update(2, activeSession({ sessionVersion: 3 }));
    }),
    expectCode("SESSION_REVOCATION_IRREVERSIBLE"),
  );
  assert.deepEqual(unit.sessions.find(record.id), revoked);
});

test("rolls back staged Session mutations when a transaction fails", () => {
  const unit = new InMemorySessionUnitOfWork();
  const record = activeSession();

  assert.throws(() => unit.transaction(
    { sessionId: record.id, expectedVersion: 0 },
    () => {
      unit.sessions.create(record);
      throw new Error("test rollback");
    },
  ), /test rollback/);
  assert.equal(unit.sessions.find(record.id), undefined);
});

test("generic update cannot create or rewrite revocation and audit evidence", () => {
  const unit = new InMemorySessionUnitOfWork();
  const original = activeSession();
  unit.transaction({ sessionId: original.id, expectedVersion: 0 }, () => unit.sessions.create(original));

  assert.throws(
    () => unit.transaction({ sessionId: original.id, expectedVersion: 1 }, () => {
      unit.sessions.update(1, {
        ...original,
        state: "REVOKED",
        sessionVersion: 2,
        revokedAt: "2026-09-13T00:01:00.000Z",
        revocationEvidenceRef: "audit:forged-revocation",
        auditEvidenceRef: "audit:forged-revocation",
      });
    }),
    /SESSION_REVOCATION_IRREVERSIBLE/,
  );
  assert.equal(unit.sessions.find(original.id)?.state, "ACTIVE");

  unit.transaction({ sessionId: original.id, expectedVersion: 1 }, () => {
    unit.sessions.appendRevocation(1, {
      sessionId: original.id,
      revokedAt: "2026-09-13T00:02:00.000Z",
      revocationEvidenceRef: "audit:real-revocation",
      auditEvidenceRef: "audit:real-revocation",
    });
  });
  const revoked = unit.sessions.find(original.id)!;
  assert.throws(
    () => unit.transaction({ sessionId: original.id, expectedVersion: 2 }, () => {
      unit.sessions.update(2, {
        ...revoked,
        sessionVersion: 3,
        revokedAt: "2026-09-13T00:03:00.000Z",
        revocationEvidenceRef: "audit:rewritten-revocation",
        auditEvidenceRef: "audit:rewritten-revocation",
      });
    }),
    /SESSION_REVOCATION_IRREVERSIBLE/,
  );
  assert.deepEqual(unit.sessions.find(original.id), revoked);
});

test("one Session transaction cannot perform two authoritative version increments", () => {
  const unit = new InMemorySessionUnitOfWork();
  const original = activeSession();
  unit.transaction({ sessionId: original.id, expectedVersion: 0 }, () => unit.sessions.create(original));
  assert.throws(
    () => unit.transaction({ sessionId: original.id, expectedVersion: 1 }, () => {
      const version2 = { ...original, sessionVersion: 2, lastAccessedAt: "2026-09-13T00:01:00.000Z" };
      unit.sessions.update(1, version2);
      unit.sessions.update(2, { ...version2, sessionVersion: 3, lastAccessedAt: "2026-09-13T00:02:00.000Z" });
    }),
    /SESSION_VERSION_CONFLICT/,
  );
  assert.deepEqual(unit.sessions.find(original.id), original);
});
