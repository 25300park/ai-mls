import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  DurableSessionUnitOfWork,
} from "./session-durable-persistence.js";
import {
  SessionPersistenceError,
  type DurableSessionRecord,
  type SessionUnitOfWork,
} from "./session-persistence.js";

function activeSession(overrides: Partial<DurableSessionRecord> = {}): DurableSessionRecord {
  return {
    id: "session-durable-1",
    principalId: "user-durable-1",
    principalType: "HUMAN",
    roles: ["AGT"],
    teamId: "team-1",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    familyId: "family-durable-1",
    refreshReference: "refresh-durable-1",
    sessionVersion: 1,
    tenantBindingOrigin: "assignment:durable-1:v1",
    issuedAt: "2026-09-13T00:00:00.000Z",
    auditEvidenceRef: "audit:session-created-durable-1",
    lastAccessedAt: "2026-09-13T00:00:00.000Z",
    lastMfaVerifiedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  };
}

function withDatabase(run: (databasePath: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "rel001-session-"));
  try {
    run(join(directory, "identity.sqlite"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function create(unit: SessionUnitOfWork, record = activeSession()): void {
  unit.transaction({ sessionId: record.id, expectedVersion: 0 }, () => {
    unit.sessions.create(record);
  });
}

function expectCode(code: string): (error: unknown) => boolean {
  return (error: unknown): boolean =>
    error instanceof SessionPersistenceError && error.code === code;
}

test("persists canonical Session state across close and reopen", () => withDatabase((databasePath) => {
  const first = new DurableSessionUnitOfWork({ databasePath });
  const record = activeSession();
  create(first, record);
  first.close();

  const reopened = new DurableSessionUnitOfWork({ databasePath });
  assert.deepEqual(reopened.sessions.find(record.id), record);
  reopened.close();
}));

test("persists irreversible revocation metadata across restart", () => withDatabase((databasePath) => {
  const first = new DurableSessionUnitOfWork({ databasePath });
  const record = activeSession();
  create(first, record);
  first.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
    first.sessions.appendRevocation(1, {
      sessionId: record.id,
      revokedAt: "2026-09-13T00:05:00.000Z",
      revocationEvidenceRef: "audit:revoked-durable-1",
      auditEvidenceRef: "audit:revoked-durable-1",
    });
  });
  first.close();

  const reopened = new DurableSessionUnitOfWork({ databasePath });
  const revoked = reopened.sessions.find(record.id);
  assert.equal(revoked?.state, "REVOKED");
  assert.equal(revoked?.sessionVersion, 2);
  assert.equal(revoked?.revocationEvidenceRef, "audit:revoked-durable-1");
  reopened.close();
}));

test("rolls back the whole durable Session transaction on failure", () => withDatabase((databasePath) => {
  const unit = new DurableSessionUnitOfWork({ databasePath });
  const record = activeSession();
  assert.throws(() => unit.transaction(
    { sessionId: record.id, expectedVersion: 0 },
    () => {
      unit.sessions.create(record);
      throw new Error("forced transaction failure");
    },
  ), /forced transaction failure/);
  assert.equal(unit.sessions.find(record.id), undefined);
  unit.close();

  const reopened = new DurableSessionUnitOfWork({ databasePath });
  assert.equal(reopened.sessions.find(record.id), undefined);
  reopened.close();
}));

test("rejects a stale durable access write after concurrent revocation", () => withDatabase((databasePath) => {
  const accessWriter = new DurableSessionUnitOfWork({ databasePath });
  const revoker = new DurableSessionUnitOfWork({ databasePath });
  const record = activeSession();
  create(accessWriter, record);

  revoker.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
    revoker.sessions.appendRevocation(1, {
      sessionId: record.id,
      revokedAt: "2026-09-13T00:02:00.000Z",
      revocationEvidenceRef: "audit:revoked-concurrent-1",
      auditEvidenceRef: "audit:revoked-concurrent-1",
    });
  });

  assert.throws(
    () => accessWriter.transaction({ sessionId: record.id, expectedVersion: 1 }, () => {
      accessWriter.sessions.update(1, activeSession({
        sessionVersion: 2,
        lastAccessedAt: "2026-09-13T00:03:00.000Z",
      }));
    }),
    expectCode("SESSION_VERSION_CONFLICT"),
  );
  assert.equal(accessWriter.sessions.find(record.id)?.state, "REVOKED");
  accessWriter.close();
  revoker.close();
}));

test("fails closed for non-file or corrupt databases without leaking path or SQLite detail", () => {
  assert.throws(
    () => new DurableSessionUnitOfWork({ databasePath: ":memory:" }),
    expectCode("SESSION_PERSISTENCE_UNAVAILABLE"),
  );

  const directory = mkdtempSync(join(tmpdir(), "rel001-session-corrupt-"));
  const databasePath = join(directory, "secret-identity.sqlite");
  writeFileSync(databasePath, "not a sqlite database");
  try {
    assert.throws(
      () => new DurableSessionUnitOfWork({ databasePath }),
      (error: unknown) => error instanceof SessionPersistenceError
        && error.code === "SESSION_PERSISTENCE_UNAVAILABLE"
        && error.publicMessage === "Session persistence is unavailable."
        && !error.message.includes(databasePath)
        && !/sqlite|database disk image|stack/i.test(error.message),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("durable generic update cannot bypass append-only revocation evidence", () => withDatabase((databasePath) => {
  const unit = new DurableSessionUnitOfWork({ databasePath });
  try {
    const original = activeSession();
    unit.transaction({ sessionId: original.id, expectedVersion: 0 }, () => unit.sessions.create(original));
    assert.throws(
      () => unit.transaction({ sessionId: original.id, expectedVersion: 1 }, () => {
        unit.sessions.update(1, {
          ...original,
          state: "REVOKED",
          sessionVersion: 2,
          revokedAt: "2026-09-13T00:01:00.000Z",
          revocationEvidenceRef: "audit:forged-durable-revocation",
          auditEvidenceRef: "audit:forged-durable-revocation",
        });
      }),
      /SESSION_REVOCATION_IRREVERSIBLE/,
    );
    assert.equal(unit.sessions.find(original.id)?.state, "ACTIVE");
  } finally {
    unit.close();
  }
}));

test("Production prepared-schema mode fails closed without creating Session tables", () => withDatabase((databasePath) => {
  assert.throws(
    () => new DurableSessionUnitOfWork({ databasePath, schemaMode: "REQUIRE_EXISTING" }),
    expectCode("SESSION_PERSISTENCE_UNAVAILABLE"),
  );
  const inspection = new DatabaseSync(databasePath);
  assert.equal(inspection.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'identity_session%'").all().length, 0);
  inspection.close();
}));

test("Production prepared-schema mode opens an already provisioned Session schema without mutation", () => withDatabase((databasePath) => {
  const provisioner = new DurableSessionUnitOfWork({ databasePath });
  provisioner.close();
  const production = new DurableSessionUnitOfWork({ databasePath, schemaMode: "REQUIRE_EXISTING" });
  create(production);
  assert.equal(production.sessions.find("session-durable-1")?.principalId, "user-durable-1");
  production.close();
}));
