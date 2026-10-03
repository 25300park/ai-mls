import {
  assertDurableSessionImmutableFields,
  assertValidDurableSessionRecord,
  cloneDurableSessionRecord,
  SessionPersistenceError,
  type DurableSessionRecord,
  type SessionMutationIdentity,
  type SessionRevocationRecord,
} from "./session-persistence.js";
import {
  PostgreSqlPersistenceError,
  type PostgreSqlClientPort,
  type PostgreSqlPoolPort,
  type PostgreSqlQueryResult,
} from "./postgresql-pool.js";

export interface AsyncSessionRepository {
  find(sessionId: string): Promise<DurableSessionRecord | undefined>;
  listByFamily(familyId: string): Promise<readonly DurableSessionRecord[]>;
  create(record: DurableSessionRecord): Promise<void>;
  update(expectedVersion: number, record: DurableSessionRecord): Promise<void>;
  appendRevocation(expectedVersion: number, input: SessionRevocationRecord): Promise<void>;
}

// Read authority only: no mutation identity, row lock, transaction or pool ownership.
export class PostgreSqlSessionReader {
  public constructor(private readonly pool: PostgreSqlPoolPort) {}

  public async assertReadPathReady(): Promise<void> {
    await this.#read("SELECT session_id, session_version, state, payload_json FROM app_identity.identity_sessions LIMIT 0");
  }

  public async find(sessionId: string): Promise<DurableSessionRecord | undefined> {
    if (!safeIdentifier(sessionId)) return undefined;
    const result = await this.#read(
      "SELECT session_id, session_version, state, payload_json FROM app_identity.identity_sessions WHERE session_id = $1",
      [sessionId],
    );
    if (result.rows.length > 1) throw unavailable();
    return result.rows[0] === undefined ? undefined : decodeRecord(result.rows[0]);
  }

  async #read(sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<SessionRow>> {
    let client: PostgreSqlClientPort | undefined;
    let discard = false;
    try {
      client = await this.pool.connect();
      return await safeQuery<SessionRow>(client, sql, values);
    } catch {
      discard = true;
      throw unavailable();
    } finally {
      try { client?.release(discard); } catch { throw unavailable(); }
    }
  }
}

export interface AsyncSessionUnitOfWork {
  transaction<Result>(
    identity: SessionMutationIdentity,
    operation: (sessions: AsyncSessionRepository) => Promise<Result>,
    beforeOperation?: (client: PostgreSqlClientPort) => Promise<void>,
  ): Promise<Result>;
  close(): Promise<void>;
}

export class PostgreSqlSessionUnitOfWork implements AsyncSessionUnitOfWork {
  readonly #pool: PostgreSqlPoolPort;
  #closed = false;

  public constructor(pool: PostgreSqlPoolPort) {
    this.#pool = pool;
  }

  public async transaction<Result>(
    identity: SessionMutationIdentity,
    operation: (sessions: AsyncSessionRepository) => Promise<Result>,
    beforeOperation?: (client: PostgreSqlClientPort) => Promise<void>,
  ): Promise<Result> {
    this.#assertOpen();
    if (!validIdentity(identity)) throw new SessionPersistenceError("SESSION_RECORD_INVALID");
    let client: PostgreSqlClientPort | undefined;
    let transactionOpen = false;
    let discard = false;
    try {
      client = await this.#pool.connect();
      await safeQuery(client, "BEGIN");
      transactionOpen = true;
      await assertExpectedVersion(client, identity);
      await beforeOperation?.(client);
      const sessions = createRepository(client, identity);
      const result = await operation(sessions);
      await safeQuery(client, "COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen && client !== undefined) {
        try {
          await safeQuery(client, "ROLLBACK");
        } catch {
          discard = true;
          throw unavailable();
        }
      }
      discard ||= error instanceof PostgreSqlPersistenceError;
      if (error instanceof SessionPersistenceError || error instanceof PostgreSqlPersistenceError) throw error;
      throw error;
    } finally {
      client?.release(discard);
    }
  }

  public close(): Promise<void> {
    this.#closed = true;
    return Promise.resolve();
  }

  #assertOpen(): void {
    if (this.#closed) throw unavailable();
  }
}

async function assertExpectedVersion(
  client: PostgreSqlClientPort,
  identity: SessionMutationIdentity,
): Promise<void> {
  const result = await safeQuery<{ session_version: string | number }>(client,
    "SELECT session_version FROM app_identity.identity_sessions WHERE session_id = $1 FOR UPDATE",
    [identity.sessionId]);
  const actual = result.rows[0] === undefined ? 0 : Number(result.rows[0].session_version);
  if (!Number.isSafeInteger(actual) || actual !== identity.expectedVersion) {
    throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
  }
}

function createRepository(
  client: PostgreSqlClientPort,
  identity: SessionMutationIdentity,
): AsyncSessionRepository {
  let mutationPerformed = false;
  const requireMutation = (sessionId: string, expectedVersion: number): void => {
    if (sessionId !== identity.sessionId) {
      throw new SessionPersistenceError("SESSION_MUTATION_IDENTITY_MISMATCH");
    }
    if (expectedVersion !== identity.expectedVersion || mutationPerformed) {
      throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    }
    mutationPerformed = true;
  };

  const find = async (sessionId: string): Promise<DurableSessionRecord | undefined> => {
    if (!safeIdentifier(sessionId)) return undefined;
    const result = await safeQuery<SessionRow>(client,
      `SELECT session_id, session_version, state, payload_json
       FROM app_identity.identity_sessions WHERE session_id = $1`, [sessionId]);
    return result.rows[0] === undefined ? undefined : decodeRecord(result.rows[0]);
  };

  return Object.freeze({
    find,
    listByFamily: async (familyId: string) => {
      if (!safeIdentifier(familyId)) return Object.freeze([]);
      const result = await safeQuery<SessionRow>(client,
        `SELECT session_id, session_version, state, payload_json
         FROM app_identity.identity_sessions
         WHERE payload_json ->> 'familyId' = $1 ORDER BY session_id`, [familyId]);
      return Object.freeze(result.rows.map((row) => decodeRecord(row)));
    },
    create: async (record: DurableSessionRecord) => {
      requireMutation(record.id, 0);
      assertValidDurableSessionRecord(record);
      if (record.sessionVersion !== 1) throw new SessionPersistenceError("SESSION_RECORD_INVALID");
      try {
        await safeQuery(client,
          `INSERT INTO app_identity.identity_sessions
           (session_id, session_version, state, payload_json, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5::timestamptz, $6::timestamptz)`,
          [record.id, record.sessionVersion, record.state, JSON.stringify(record), record.issuedAt, record.lastAccessedAt]);
      } catch (error) {
        if (error instanceof PostgreSqlPersistenceError && postgresCode(error) === "23505") {
          throw new SessionPersistenceError("SESSION_ALREADY_EXISTS");
        }
        throw error;
      }
    },
    update: async (expectedVersion: number, record: DurableSessionRecord) => {
      requireMutation(record.id, expectedVersion);
      assertValidDurableSessionRecord(record);
      if (record.sessionVersion !== expectedVersion + 1 || record.state === "REVOKED") {
        throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
      }
      const current = await find(record.id);
      if (current === undefined) throw new SessionPersistenceError("SESSION_NOT_FOUND");
      if (current.state === "REVOKED") throw new SessionPersistenceError("SESSION_REVOCATION_IRREVERSIBLE");
      assertDurableSessionImmutableFields(current, record);
      const result = await safeQuery(client,
        `UPDATE app_identity.identity_sessions
         SET session_version = $1, state = $2, payload_json = $3::jsonb, updated_at = $4::timestamptz
         WHERE session_id = $5 AND session_version = $6`,
        [record.sessionVersion, record.state, JSON.stringify(record), record.lastAccessedAt, record.id, expectedVersion]);
      if (result.rowCount !== 1) throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    },
    appendRevocation: async (expectedVersion: number, input: SessionRevocationRecord) => {
      requireMutation(input.sessionId, expectedVersion);
      const current = await find(input.sessionId);
      if (current === undefined) throw new SessionPersistenceError("SESSION_NOT_FOUND");
      if (current.state === "REVOKED") throw new SessionPersistenceError("SESSION_REVOCATION_IRREVERSIBLE");
      const revoked = Object.freeze({
        ...current,
        state: "REVOKED" as const,
        sessionVersion: expectedVersion + 1,
        revokedAt: input.revokedAt,
        revocationEvidenceRef: input.revocationEvidenceRef,
        auditEvidenceRef: input.auditEvidenceRef,
      });
      assertValidDurableSessionRecord(revoked);
      await safeQuery(client,
        `INSERT INTO app_identity.identity_session_revocations
         (session_id, session_version, revoked_at, reason, identity_evidence_ref, audit_evidence_ref)
         VALUES ($1, $2, $3::timestamptz, 'SESSION_REVOKED', $4, $5)`,
        [input.sessionId, revoked.sessionVersion, input.revokedAt, input.revocationEvidenceRef, input.auditEvidenceRef]);
      const result = await safeQuery(client,
        `UPDATE app_identity.identity_sessions
         SET session_version = $1, state = 'REVOKED', payload_json = $2::jsonb, updated_at = $3::timestamptz
         WHERE session_id = $4 AND session_version = $5`,
        [revoked.sessionVersion, JSON.stringify(revoked), input.revokedAt, input.sessionId, expectedVersion]);
      if (result.rowCount !== 1) throw new SessionPersistenceError("SESSION_VERSION_CONFLICT");
    },
  });
}

interface SessionRow extends Record<string, unknown> {
  readonly session_id: unknown;
  readonly session_version: unknown;
  readonly state: unknown;
  readonly payload_json: unknown;
}

function decodeRecord(row: SessionRow): DurableSessionRecord {
  try {
    const payload: unknown = typeof row.payload_json === "string" ? JSON.parse(row.payload_json) as unknown : row.payload_json;
    assertValidDurableSessionRecord(payload);
    if (payload.id !== row.session_id || payload.sessionVersion !== Number(row.session_version)
      || payload.state !== row.state) throw unavailable();
    return cloneDurableSessionRecord(payload);
  } catch {
    throw unavailable();
  }
}

async function safeQuery<Row extends Record<string, unknown> = Record<string, unknown>>(
  client: PostgreSqlClientPort,
  text: string,
  values?: readonly unknown[],
): Promise<PostgreSqlQueryResult<Row>> {
  try {
    return await client.query<Row>(text, values);
  } catch (error) {
    const wrapped = unavailable() as PostgreSqlPersistenceError & { postgresCode?: string };
    if (typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string") {
      wrapped.postgresCode = (error as { code: string }).code;
    }
    throw wrapped;
  }
}

function postgresCode(error: PostgreSqlPersistenceError): string | undefined {
  return (error as PostgreSqlPersistenceError & { postgresCode?: string }).postgresCode;
}

function validIdentity(identity: SessionMutationIdentity): boolean {
  return safeIdentifier(identity.sessionId) && Number.isSafeInteger(identity.expectedVersion)
    && identity.expectedVersion >= 0;
}

function safeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512
    && value.trim() === value && !/[\u0000-\u001f\u007f\\]/u.test(value);
}

function unavailable(): PostgreSqlPersistenceError {
  return new PostgreSqlPersistenceError();
}
