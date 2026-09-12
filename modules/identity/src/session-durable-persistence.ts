import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import {
  assertDurableSessionImmutableFields,
  assertValidDurableSessionRecord,
  cloneDurableSessionRecord,
  SessionPersistenceError,
  type DurableSessionRecord,
  type SessionMutationIdentity,
  type SessionRepository,
  type SessionRevocationRecord,
  type SessionUnitOfWork,
} from "./session-persistence.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS identity_sessions (
  session_id TEXT PRIMARY KEY,
  session_version INTEGER NOT NULL CHECK(session_version >= 1),
  state TEXT NOT NULL CHECK(state IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
  payload_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS identity_session_revocations (
  session_id TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  revoked_at TEXT NOT NULL,
  revocation_evidence_ref TEXT NOT NULL,
  audit_evidence_ref TEXT NOT NULL,
  PRIMARY KEY (session_id, session_version),
  FOREIGN KEY (session_id) REFERENCES identity_sessions(session_id)
);
CREATE TRIGGER IF NOT EXISTS identity_session_revocations_no_update
BEFORE UPDATE ON identity_session_revocations BEGIN
  SELECT RAISE(ABORT, 'append-only revocation');
END;
CREATE TRIGGER IF NOT EXISTS identity_session_revocations_no_delete
BEFORE DELETE ON identity_session_revocations BEGIN
  SELECT RAISE(ABORT, 'append-only revocation');
END;
`;

export interface DurableSessionUnitOfWorkOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: number;
}

export class DurableSessionUnitOfWork implements SessionUnitOfWork {
  readonly #database: DatabaseSync;
  #activeIdentity: SessionMutationIdentity | undefined;
  #mutationPerformed = false;
  #closed = false;

  public constructor(options: DurableSessionUnitOfWorkOptions) {
    const busyTimeout = options.busyTimeoutMilliseconds ?? 5000;
    if (!isFileDatabasePath(options.databasePath)
      || !Number.isInteger(busyTimeout)
      || busyTimeout < 1
      || busyTimeout > 60_000) {
      throw unavailable();
    }

    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = FULL");
      database.exec(`PRAGMA busy_timeout = ${String(busyTimeout)}`);
      database.exec(SCHEMA);
      validateDatabase(database);
      this.#database = database;
    } catch {
      try { database?.close(); } catch { /* preserve safe startup failure */ }
      throw unavailable();
    }
  }

  public readonly sessions: SessionRepository = {
    find: (sessionId) => this.#find(sessionId),
    listByFamily: (familyId) => this.#listByFamily(familyId),
    create: (record) => this.#create(record),
    update: (expectedVersion, record) => this.#update(expectedVersion, record),
    appendRevocation: (expectedVersion, input) => this.#appendRevocation(expectedVersion, input),
  };

  public transaction<Result>(
    identity: SessionMutationIdentity,
    operation: () => Result,
  ): Result {
    this.#assertOpen();
    if (this.#activeIdentity !== undefined) {
      throw new SessionPersistenceError("SESSION_TRANSACTION_ACTIVE");
    }
    if (!validIdentity(identity)) {
      throw new SessionPersistenceError("SESSION_RECORD_INVALID");
    }

    let open = false;
    let operationFailed = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      open = true;
      const currentVersion = this.#readVersion(identity.sessionId);
      if (currentVersion !== identity.expectedVersion) {
        throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
      }
      this.#activeIdentity = identity;
      this.#mutationPerformed = false;
      let result: Result;
      try {
        result = operation();
      } catch (error) {
        operationFailed = true;
        throw error;
      }
      this.#database.exec("COMMIT");
      open = false;
      return result;
    } catch (error) {
      if (open) {
        try { this.#database.exec("ROLLBACK"); } catch { throw unavailable(); }
      }
      if (error instanceof SessionPersistenceError || operationFailed) {
        throw error;
      }
      throw unavailable();
    } finally {
      this.#activeIdentity = undefined;
      this.#mutationPerformed = false;
    }
  }

  public close(): void {
    if (this.#closed) return;
    if (this.#activeIdentity !== undefined) {
      throw new SessionPersistenceError("SESSION_TRANSACTION_ACTIVE");
    }
    this.#closed = true;
    try {
      this.#database.close();
    } catch {
      throw unavailable();
    }
  }

  #find(sessionId: string): DurableSessionRecord | undefined {
    this.#assertOpen();
    if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 512) {
      return undefined;
    }
    try {
      const row = this.#database.prepare(
        "SELECT session_id, session_version, state, payload_json FROM identity_sessions WHERE session_id = ?",
      ).get(sessionId);
      if (row === undefined) return undefined;
      const record = decodeRecord(row);
      if (record.id !== row["session_id"]
        || record.sessionVersion !== Number(row["session_version"])
        || record.state !== row["state"]) {
        throw unavailable();
      }
      return cloneDurableSessionRecord(record);
    } catch (error) {
      if (error instanceof SessionPersistenceError) throw error;
      throw unavailable();
    }
  }

  #listByFamily(familyId: string): readonly DurableSessionRecord[] {
    this.#assertOpen();
    if (typeof familyId !== "string" || familyId.length === 0 || familyId.length > 512) {
      return [];
    }
    try {
      return this.#database.prepare(
        "SELECT session_id, session_version, state, payload_json FROM identity_sessions WHERE json_extract(payload_json, '$.familyId') = ? ORDER BY session_id",
      ).all(familyId).map((row) => decodeRecord(row));
    } catch (error) {
      if (error instanceof SessionPersistenceError) throw error;
      throw unavailable();
    }
  }

  #create(record: DurableSessionRecord): void {
    this.#requireMutation(record.id, 0);
    assertValidDurableSessionRecord(record);
    if (record.sessionVersion !== 1 || this.#activeIdentity?.expectedVersion !== 0) {
      throw new SessionPersistenceError("SESSION_RECORD_INVALID");
    }
    try {
      this.#database.prepare(
        "INSERT INTO identity_sessions (session_id, session_version, state, payload_json) VALUES (?, ?, ?, ?)",
      ).run(record.id, record.sessionVersion, record.state, JSON.stringify(record));
    } catch (error) {
      if (isUniqueConstraint(error)) throw new SessionPersistenceError("SESSION_ALREADY_EXISTS");
      if (error instanceof SessionPersistenceError) throw error;
      throw unavailable();
    }
  }

  #update(expectedVersion: number, record: DurableSessionRecord): void {
    this.#requireMutation(record.id, expectedVersion);
    assertValidDurableSessionRecord(record);
    const current = this.#find(record.id);
    if (current === undefined) throw new SessionPersistenceError("SESSION_NOT_FOUND");
    if (current.sessionVersion !== expectedVersion
      || record.sessionVersion !== expectedVersion + 1) {
      throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    }
    if (current.state === "REVOKED"
      || record.state === "REVOKED"
      || record.revokedAt !== current.revokedAt
      || record.revocationEvidenceRef !== current.revocationEvidenceRef) {
      throw new SessionPersistenceError("SESSION_REVOCATION_IRREVERSIBLE");
    }
    assertDurableSessionImmutableFields(current, record);
    try {
      const result = this.#database.prepare(
        "UPDATE identity_sessions SET session_version = ?, state = ?, payload_json = ? WHERE session_id = ? AND session_version = ?",
      ).run(record.sessionVersion, record.state, JSON.stringify(record), record.id, expectedVersion);
      if (Number(result.changes) !== 1) {
        throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
      }
    } catch (error) {
      if (error instanceof SessionPersistenceError) throw error;
      throw unavailable();
    }
  }

  #appendRevocation(expectedVersion: number, input: SessionRevocationRecord): void {
    this.#requireMutation(input.sessionId, expectedVersion);
    const current = this.#find(input.sessionId);
    if (current === undefined) throw new SessionPersistenceError("SESSION_NOT_FOUND");
    if (current.sessionVersion !== expectedVersion) {
      throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    }
    if (current.state === "REVOKED") {
      throw new SessionPersistenceError("SESSION_REVOCATION_IRREVERSIBLE");
    }
    const revoked: DurableSessionRecord = {
      ...current,
      state: "REVOKED",
      sessionVersion: expectedVersion + 1,
      revokedAt: input.revokedAt,
      revocationEvidenceRef: input.revocationEvidenceRef,
      auditEvidenceRef: input.auditEvidenceRef,
    };
    assertValidDurableSessionRecord(revoked);
    try {
      this.#database.prepare(
        "INSERT INTO identity_session_revocations (session_id, session_version, revoked_at, revocation_evidence_ref, audit_evidence_ref) VALUES (?, ?, ?, ?, ?)",
      ).run(
        input.sessionId,
        revoked.sessionVersion,
        input.revokedAt,
        input.revocationEvidenceRef,
        input.auditEvidenceRef,
      );
      const result = this.#database.prepare(
        "UPDATE identity_sessions SET session_version = ?, state = 'REVOKED', payload_json = ? WHERE session_id = ? AND session_version = ? AND state != 'REVOKED'",
      ).run(revoked.sessionVersion, JSON.stringify(revoked), input.sessionId, expectedVersion);
      if (Number(result.changes) !== 1) {
        throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
      }
    } catch (error) {
      if (error instanceof SessionPersistenceError) throw error;
      throw unavailable();
    }
  }

  #readVersion(sessionId: string): number {
    const row = this.#database.prepare(
      "SELECT session_version FROM identity_sessions WHERE session_id = ?",
    ).get(sessionId);
    return row === undefined ? 0 : Number(row["session_version"]);
  }

  #requireMutation(sessionId: string, expectedVersion: number): void {
    if (this.#activeIdentity === undefined) {
      throw new SessionPersistenceError("SESSION_TRANSACTION_REQUIRED");
    }
    if (this.#activeIdentity.sessionId !== sessionId) {
      throw new SessionPersistenceError("SESSION_MUTATION_IDENTITY_MISMATCH");
    }
    if (this.#activeIdentity.expectedVersion !== expectedVersion
      || this.#mutationPerformed) {
      throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    }
    this.#mutationPerformed = true;
  }

  #assertOpen(): void {
    if (this.#closed) throw unavailable();
  }
}

function decodeRecord(row: Record<string, SQLOutputValue>): DurableSessionRecord {
  const payload = row["payload_json"];
  if (typeof payload !== "string") throw unavailable();
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw unavailable();
  }
  try {
    assertValidDurableSessionRecord(parsed);
  } catch {
    throw unavailable();
  }
  return parsed;
}

function validateDatabase(database: DatabaseSync): void {
  const integrity = database.prepare("PRAGMA integrity_check").get();
  if (integrity?.["integrity_check"] !== "ok") throw unavailable();
  for (const name of ["identity_sessions", "identity_session_revocations"] as const) {
    const row = database.prepare(
      "SELECT type FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(name);
    if (row?.["type"] !== "table") throw unavailable();
  }
}

function validIdentity(identity: SessionMutationIdentity): boolean {
  return typeof identity.sessionId === "string"
    && identity.sessionId.length > 0
    && identity.sessionId.length <= 512
    && Number.isInteger(identity.expectedVersion)
    && identity.expectedVersion >= 0;
}

function isFileDatabasePath(databasePath: string): boolean {
  return typeof databasePath === "string"
    && databasePath.trim().length > 0
    && isAbsolute(databasePath)
    && databasePath !== ":memory:"
    && !databasePath.startsWith("file:");
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && String(error.code).includes("SQLITE_CONSTRAINT");
}

function unavailable(): SessionPersistenceError {
  return new SessionPersistenceError(
    "SESSION_PERSISTENCE_UNAVAILABLE",
    "Session persistence is unavailable.",
  );
}
