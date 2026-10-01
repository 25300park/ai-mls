import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { existsSync } from "node:fs";

const SCHEMA_VERSION = 1;

export type ConnectorExecutionScope = Readonly<{
  readonly tenantId: string;
  readonly scopeType: "TENANT" | "TEAM" | "ORGANIZATION" | "SOURCE";
  readonly scopeId: string;
  readonly sourceId: string;
  readonly connectorId: string;
}>;

export type ConnectorLease = ConnectorExecutionScope & Readonly<{
  readonly leaseId: string;
  readonly ownerId: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly status: "ACTIVE" | "RELEASED" | "EXPIRED";
  readonly version: number;
}>;

export type ConnectorInvocationState = "PREPARED" | "AMBIGUOUS" | "SUCCEEDED" | "FAILED";

export type ConnectorTechnicalResult = Readonly<{
  readonly resultId: string;
  readonly outcome: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  readonly reasonCode: string;
  readonly safeEvidenceReference: string;
  readonly completedAt: string;
}>;

export type ConnectorInvocation = ConnectorExecutionScope & Readonly<{
  readonly invocationId: string;
  readonly leaseId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
  readonly inputReference: string;
  readonly inputVersion: number;
  readonly sourcePolicyVersion: number;
  readonly connectorVersion: number;
  readonly expectedCheckpointVersion: number;
  readonly preparedAt: string;
  readonly startedAt?: string;
  readonly state: ConnectorInvocationState;
  readonly result?: ConnectorTechnicalResult;
}>;

export type ConnectorCheckpoint = ConnectorExecutionScope & Readonly<{
  readonly checkpointReference: string;
  readonly safeEvidenceReference: string;
  readonly version: number;
  readonly updatedAt: string;
}>;

export type ConnectorExecutionEvidence = ConnectorExecutionScope & Readonly<{
  readonly invocationId: string;
  readonly sequence: number;
  readonly kind: "INTENT_PREPARED" | "EXECUTION_STARTED" | "RESULT_RECORDED";
  readonly recordedAt: string;
  readonly safeEvidenceReference?: string;
}>;

export type ConnectorIdempotencyRecord = ConnectorExecutionScope & Readonly<{
  readonly idempotencyKey: string;
  readonly invocationId: string;
  readonly inputFingerprint: string;
  readonly resultId?: string;
}>;

export type ConnectorTechnicalRecordType = "CONNECTOR_INSTANCE" | "CAPTURE_BATCH" | "DELIVERY_ATTEMPT" | "EXTERNAL_OBSERVATION" | "HEALTH_SIGNAL";

export type ConnectorTechnicalState = ConnectorExecutionScope & Readonly<{
  readonly recordType: ConnectorTechnicalRecordType;
  readonly recordId: string;
  readonly status: string;
  readonly version: number;
  readonly safeEvidenceReference: string;
  readonly recordedAt: string;
  readonly bindingReference?: string;
}>;

export type ConnectorTechnicalEvidence = ConnectorExecutionScope & Readonly<{
  readonly recordType: ConnectorTechnicalRecordType;
  readonly recordId: string;
  readonly sequence: number;
  readonly status: string;
  readonly safeEvidenceReference: string;
  readonly recordedAt: string;
}>;

export type ConnectorTechnicalStateInput = ConnectorExecutionScope & Readonly<{
  readonly recordType: ConnectorTechnicalRecordType;
  readonly recordId: string;
  readonly status: string;
  readonly expectedVersion: number;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
  readonly safeEvidenceReference: string;
  readonly recordedAt: string;
  readonly bindingReference?: string;
}>;

export class ConnectorPersistenceError extends Error {
  public constructor(public readonly code: ConnectorPersistenceErrorCode, message: string) {
    super(message);
    this.name = "ConnectorPersistenceError";
  }
}

export type ConnectorPersistenceErrorCode =
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_UNAVAILABLE"
  | "LEASE_CONFLICT"
  | "LEASE_NOT_FOUND"
  | "LEASE_VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVOCATION_CONFLICT"
  | "INVOCATION_NOT_FOUND"
  | "CHECKPOINT_VERSION_CONFLICT"
  | "TECHNICAL_VERSION_CONFLICT"
  | "RESULT_CONFLICT";

export interface DurableConnectorExecutionUnitOfWorkOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: 5000;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
}

export type ConnectorLeaseInput = ConnectorExecutionScope & Readonly<{
  readonly leaseId: string;
  readonly ownerId: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly expectedScopeRevision: number;
}>;

export type ConnectorInvocationIntentInput = ConnectorExecutionScope & Readonly<{
  readonly invocationId: string;
  readonly leaseId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
  readonly inputReference: string;
  readonly inputVersion: number;
  readonly sourcePolicyVersion: number;
  readonly connectorVersion: number;
  readonly expectedCheckpointVersion: number;
  readonly preparedAt: string;
}>;

export type ConnectorInvocationCompletionInput = ConnectorExecutionScope & Readonly<{
  readonly invocationId: string;
  readonly resultId: string;
  readonly outcome: "SUCCEEDED" | "FAILED" | "UNKNOWN";
  readonly reasonCode: string;
  readonly safeEvidenceReference: string;
  readonly checkpointReference?: string;
  readonly expectedCheckpointVersion?: number;
  readonly completedAt: string;
}>;

export class DurableConnectorExecutionUnitOfWork {
  readonly #database: DatabaseSync;
  #closed = false;
  #quarantined = false;

  public constructor(options: DurableConnectorExecutionUnitOfWorkOptions) {
    const schemaMode = options.schemaMode ?? "INITIALIZE";
    if (!isFileDatabasePath(options.databasePath) || (options.busyTimeoutMilliseconds !== undefined && options.busyTimeoutMilliseconds !== 5000)
      || (schemaMode !== "INITIALIZE" && schemaMode !== "REQUIRE_EXISTING")
      || (schemaMode === "REQUIRE_EXISTING" && !existsSync(options.databasePath))) {
      throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector database configuration is invalid.");
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMilliseconds ?? 5000}`);
      if (schemaMode === "INITIALIZE") {
        database.exec("PRAGMA journal_mode = WAL");
        database.exec("PRAGMA synchronous = FULL");
        bootstrap(database);
      }
      validate(database);
      this.#database = database;
    } catch (error) {
      try { database?.close(); } catch { /* preserve safe startup error */ }
      throw mapStorageError(error);
    }
  }

  public acquireLease(input: ConnectorLeaseInput): ConnectorLease {
    validateScope(input);
    validateText(input.leaseId, input.ownerId, input.acquiredAt, input.expiresAt);
    if (!Number.isInteger(input.expectedScopeRevision) || input.expectedScopeRevision < 0 || Date.parse(input.expiresAt) <= Date.parse(input.acquiredAt)) {
      throw failure("PERSISTENCE_INPUT_INVALID", "Connector lease input is invalid.");
    }
    return this.transaction(() => {
      this.expireScopeLease(input, input.acquiredAt);
      const revision = this.scopeRevision(input);
      if (revision !== input.expectedScopeRevision) throw failure("LEASE_VERSION_CONFLICT", "Connector lease scope changed.");
      if (this.activeLeaseRow(input) !== undefined) throw failure("LEASE_CONFLICT", "Connector execution scope already has an active lease.");
      this.ensureScope(input, revision);
      const lease: ConnectorLease = Object.freeze({ ...scopeOf(input), leaseId: input.leaseId, ownerId: input.ownerId, acquiredAt: input.acquiredAt, expiresAt: input.expiresAt, status: "ACTIVE", version: 1 });
      this.#database.prepare(`INSERT INTO connector_leases (${SCOPE_COLUMNS}, lease_id, owner_id, acquired_at, expires_at, status, version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, ?)`)
        .run(...scopeValues(input), input.leaseId, input.ownerId, input.acquiredAt, input.expiresAt, JSON.stringify(lease));
      this.incrementScopeRevision(input, revision);
      return lease;
    });
  }

  public releaseLease(scope: ConnectorExecutionScope, leaseId: string, expectedVersion: number, releasedAt: string): ConnectorLease {
    validateScope(scope); validateText(leaseId, releasedAt);
    return this.transaction(() => {
      const row = this.#database.prepare(`SELECT payload_json FROM connector_leases WHERE ${SCOPE_WHERE} AND lease_id = ?`).get(...scopeValues(scope), leaseId);
      if (row === undefined) throw failure("LEASE_NOT_FOUND", "Connector lease is unavailable.");
      const current = parse<ConnectorLease>(text(row["payload_json"]));
      if (current.status !== "ACTIVE" || current.version !== expectedVersion) throw failure("LEASE_VERSION_CONFLICT", "Connector lease changed.");
      const released: ConnectorLease = Object.freeze({ ...current, status: "RELEASED", version: current.version + 1, expiresAt: releasedAt });
      const result = this.#database.prepare(`UPDATE connector_leases SET status = 'RELEASED', version = ?, expires_at = ?, payload_json = ? WHERE ${SCOPE_WHERE} AND lease_id = ? AND status = 'ACTIVE' AND version = ?`)
        .run(released.version, releasedAt, JSON.stringify(released), ...scopeValues(scope), leaseId, expectedVersion);
      if (Number(result.changes) !== 1) throw failure("LEASE_VERSION_CONFLICT", "Connector lease changed.");
      this.incrementScopeRevision(scope, this.scopeRevision(scope));
      return released;
    });
  }

  public expireLeases(now: string): number {
    validateText(now);
    return this.transaction(() => {
      const rows = this.#database.prepare("SELECT payload_json FROM connector_leases WHERE status = 'ACTIVE' AND expires_at <= ?").all(now);
      for (const row of rows) {
        const current = parse<ConnectorLease>(text(row["payload_json"]));
        const expired: ConnectorLease = Object.freeze({ ...current, status: "EXPIRED", version: current.version + 1 });
        this.#database.prepare(`UPDATE connector_leases SET status = 'EXPIRED', version = ?, payload_json = ? WHERE ${SCOPE_WHERE} AND lease_id = ? AND status = 'ACTIVE' AND version = ?`)
          .run(expired.version, JSON.stringify(expired), ...scopeValues(current), current.leaseId, current.version);
        this.incrementScopeRevision(current, this.scopeRevision(current));
      }
      return rows.length;
    });
  }

  public findLease(scope: ConnectorExecutionScope): ConnectorLease | undefined {
    this.assertOpen(); validateScope(scope);
    const row = this.#database.prepare(`SELECT payload_json FROM connector_leases WHERE ${SCOPE_WHERE} ORDER BY rowid DESC LIMIT 1`).get(...scopeValues(scope));
    return row === undefined ? undefined : freeze(parse<ConnectorLease>(text(row["payload_json"])));
  }

  public prepareInvocation(input: ConnectorInvocationIntentInput): ConnectorInvocation {
    validateScope(input); validateText(input.invocationId, input.leaseId, input.idempotencyKey, input.inputFingerprint, input.preparedAt); validateReference(input.inputReference);
    if (![input.inputVersion, input.sourcePolicyVersion, input.connectorVersion].every((value) => Number.isInteger(value) && value > 0) || !Number.isInteger(input.expectedCheckpointVersion) || input.expectedCheckpointVersion < 0) {
      throw failure("PERSISTENCE_INPUT_INVALID", "Connector invocation input is invalid.");
    }
    return this.transaction(() => {
      const replay = this.findIdempotency(input, input.idempotencyKey);
      if (replay !== undefined) {
        if (replay.invocationId !== input.invocationId || replay.inputFingerprint !== input.inputFingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Connector idempotency identity conflicts.");
        const existing = this.findInvocation(input, input.invocationId);
        if (existing === undefined) throw failure("PERSISTENCE_UNAVAILABLE", "Connector invocation linkage is invalid.");
        return existing;
      }
      const identityRow = this.#database.prepare(`SELECT payload_json FROM connector_invocations WHERE ${SCOPE_WHERE} AND invocation_id = ?`).get(...scopeValues(input), input.invocationId);
      if (identityRow !== undefined) throw failure("INVOCATION_CONFLICT", "Connector invocation identity conflicts.");
      const lease = this.activeLeaseRow(input);
      if (lease === undefined || text(lease["lease_id"]) !== input.leaseId || text(lease["expires_at"]) <= input.preparedAt) throw failure("LEASE_NOT_FOUND", "A current Connector lease is required.");
      const invocation: ConnectorInvocation = Object.freeze({ ...scopeOf(input), invocationId: input.invocationId, leaseId: input.leaseId, idempotencyKey: input.idempotencyKey, inputFingerprint: input.inputFingerprint, inputReference: input.inputReference, inputVersion: input.inputVersion, sourcePolicyVersion: input.sourcePolicyVersion, connectorVersion: input.connectorVersion, expectedCheckpointVersion: input.expectedCheckpointVersion, preparedAt: input.preparedAt, state: "PREPARED" });
      this.#database.prepare(`INSERT INTO connector_invocations (${SCOPE_COLUMNS}, invocation_id, lease_id, idempotency_key, input_fingerprint, raw_state, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PREPARED', ?)`)
        .run(...scopeValues(input), input.invocationId, input.leaseId, input.idempotencyKey, input.inputFingerprint, JSON.stringify(invocation));
      this.#database.prepare(`INSERT INTO connector_idempotency (${SCOPE_COLUMNS}, idempotency_key, invocation_id, input_fingerprint, result_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
        .run(...scopeValues(input), input.idempotencyKey, input.invocationId, input.inputFingerprint, JSON.stringify({ ...scopeOf(input), idempotencyKey: input.idempotencyKey, invocationId: input.invocationId, inputFingerprint: input.inputFingerprint }));
      this.appendEvidence(input, input.invocationId, 1, "INTENT_PREPARED", input.preparedAt);
      return invocation;
    });
  }

  public markExecutionStarted(scope: ConnectorExecutionScope, invocationId: string, startedAt: string): Readonly<{ readonly claimed: boolean; readonly invocation: ConnectorInvocation }> {
    validateScope(scope); validateText(invocationId, startedAt);
    return this.transaction(() => {
      const raw = this.rawInvocation(scope, invocationId);
      if (raw === undefined) throw failure("INVOCATION_NOT_FOUND", "Connector invocation is unavailable.");
      if (raw.rawState !== "PREPARED") return Object.freeze({ claimed: false, invocation: this.toInvocation(raw) });
      const updated = Object.freeze({ ...raw.invocation, startedAt });
      const result = this.#database.prepare(`UPDATE connector_invocations SET raw_state = 'EXECUTION_STARTED', payload_json = ? WHERE ${SCOPE_WHERE} AND invocation_id = ? AND raw_state = 'PREPARED'`)
        .run(JSON.stringify(updated), ...scopeValues(scope), invocationId);
      if (Number(result.changes) !== 1) throw failure("INVOCATION_CONFLICT", "Connector invocation dispatch claim conflicts.");
      this.appendEvidence(scope, invocationId, 2, "EXECUTION_STARTED", startedAt);
      return Object.freeze({ claimed: true, invocation: Object.freeze({ ...updated, state: "AMBIGUOUS" as const }) });
    });
  }

  public completeInvocation(input: ConnectorInvocationCompletionInput): ConnectorInvocation {
    validateScope(input); validateText(input.invocationId, input.resultId, input.reasonCode, input.completedAt); validateReference(input.safeEvidenceReference);
    return this.transaction(() => {
      const raw = this.rawInvocation(input, input.invocationId);
      if (raw === undefined) throw failure("INVOCATION_NOT_FOUND", "Connector invocation is unavailable.");
      if (raw.result !== undefined || raw.rawState === "SUCCEEDED" || raw.rawState === "FAILED") throw failure("RESULT_CONFLICT", "Connector result is append-only.");
      if (raw.rawState !== "EXECUTION_STARTED") throw failure("INVOCATION_CONFLICT", "Connector invocation was not durably started.");
      const expectedCheckpointVersion = input.expectedCheckpointVersion ?? raw.invocation.expectedCheckpointVersion;
      if (input.outcome === "SUCCEEDED") {
        if (input.checkpointReference === undefined) throw failure("PERSISTENCE_INPUT_INVALID", "Successful Connector result requires a checkpoint reference.");
        validateReference(input.checkpointReference);
        const currentCheckpoint = this.findCheckpoint(input);
        if ((currentCheckpoint?.version ?? 0) !== expectedCheckpointVersion) throw failure("CHECKPOINT_VERSION_CONFLICT", "Connector checkpoint changed.");
      }
      const technicalResult: ConnectorTechnicalResult = Object.freeze({ resultId: input.resultId, outcome: input.outcome, reasonCode: input.reasonCode, safeEvidenceReference: input.safeEvidenceReference, completedAt: input.completedAt });
      this.#database.prepare(`INSERT INTO connector_results (${SCOPE_COLUMNS}, invocation_id, result_id, outcome, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(...scopeValues(input), input.invocationId, input.resultId, input.outcome, JSON.stringify(technicalResult));
      const terminal = input.outcome === "UNKNOWN" ? "AMBIGUOUS" : input.outcome;
      this.#database.prepare(`UPDATE connector_invocations SET raw_state = ?, payload_json = ? WHERE ${SCOPE_WHERE} AND invocation_id = ? AND raw_state = 'EXECUTION_STARTED'`)
        .run(terminal, JSON.stringify(raw.invocation), ...scopeValues(input), input.invocationId);
      const idempotency: ConnectorIdempotencyRecord = Object.freeze({ ...scopeOf(input), idempotencyKey: raw.invocation.idempotencyKey, invocationId: input.invocationId, inputFingerprint: raw.invocation.inputFingerprint, resultId: input.resultId });
      this.#database.prepare(`UPDATE connector_idempotency SET result_id = ?, payload_json = ? WHERE ${SCOPE_WHERE} AND idempotency_key = ? AND result_id IS NULL`)
        .run(input.resultId, JSON.stringify(idempotency), ...scopeValues(input), raw.invocation.idempotencyKey);
      if (input.outcome === "SUCCEEDED" && input.checkpointReference !== undefined) {
        const current = this.findCheckpoint(input);
        const checkpoint: ConnectorCheckpoint = Object.freeze({ ...scopeOf(input), checkpointReference: input.checkpointReference, safeEvidenceReference: input.safeEvidenceReference, version: (current?.version ?? 0) + 1, updatedAt: input.completedAt });
        this.#database.prepare(`INSERT INTO connector_checkpoints (${SCOPE_COLUMNS}, version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (${SCOPE_COLUMNS}) DO UPDATE SET version = excluded.version, payload_json = excluded.payload_json WHERE connector_checkpoints.version = ?`)
          .run(...scopeValues(input), checkpoint.version, JSON.stringify(checkpoint), expectedCheckpointVersion);
      }
      this.appendEvidence(input, input.invocationId, 3, "RESULT_RECORDED", input.completedAt, input.safeEvidenceReference);
      return Object.freeze({ ...raw.invocation, state: terminal, result: technicalResult });
    });
  }

  public findInvocation(scope: ConnectorExecutionScope, invocationId: string): ConnectorInvocation | undefined {
    this.assertOpen(); validateScope(scope); validateText(invocationId);
    const raw = this.rawInvocation(scope, invocationId);
    return raw === undefined ? undefined : this.toInvocation(raw);
  }

  public findCheckpoint(scope: ConnectorExecutionScope): ConnectorCheckpoint | undefined {
    this.assertOpen(); validateScope(scope);
    const row = this.#database.prepare(`SELECT payload_json FROM connector_checkpoints WHERE ${SCOPE_WHERE}`).get(...scopeValues(scope));
    return row === undefined ? undefined : freeze(parse<ConnectorCheckpoint>(text(row["payload_json"])));
  }

  public findIdempotency(scope: ConnectorExecutionScope, idempotencyKey: string): ConnectorIdempotencyRecord | undefined {
    this.assertOpen(); validateScope(scope); validateText(idempotencyKey);
    const row = this.#database.prepare(`SELECT payload_json FROM connector_idempotency WHERE ${SCOPE_WHERE} AND idempotency_key = ?`).get(...scopeValues(scope), idempotencyKey);
    return row === undefined ? undefined : freeze(parse<ConnectorIdempotencyRecord>(text(row["payload_json"])));
  }

  public listEvidence(scope: ConnectorExecutionScope): readonly ConnectorExecutionEvidence[] {
    this.assertOpen(); validateScope(scope);
    return Object.freeze(this.#database.prepare(`SELECT payload_json FROM connector_evidence WHERE ${SCOPE_WHERE} ORDER BY invocation_id, sequence`).all(...scopeValues(scope))
      .map((row) => freeze(parse<ConnectorExecutionEvidence>(text(row["payload_json"])))));
  }

  public recordTechnicalState(input: ConnectorTechnicalStateInput): ConnectorTechnicalState {
    validateScope(input);
    validateText(input.recordType, input.recordId, input.status, input.idempotencyKey, input.inputFingerprint, input.recordedAt);
    validateReference(input.safeEvidenceReference);
    if (input.bindingReference !== undefined) validateReference(input.bindingReference);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw failure("PERSISTENCE_INPUT_INVALID", "Connector technical record input is invalid.");
    return this.transaction(() => {
      const replayRow = this.#database.prepare(`SELECT input_fingerprint, payload_json FROM connector_technical_idempotency WHERE ${SCOPE_WHERE} AND idempotency_key = ?`).get(...scopeValues(input), input.idempotencyKey);
      if (replayRow !== undefined) {
        if (text(replayRow["input_fingerprint"]) !== input.inputFingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Connector technical idempotency identity conflicts.");
        return freeze(parse<ConnectorTechnicalState>(text(replayRow["payload_json"])));
      }
      const current = this.findTechnicalState(input, input.recordType, input.recordId);
      if ((current?.version ?? 0) !== input.expectedVersion) throw failure("TECHNICAL_VERSION_CONFLICT", "Connector technical record changed.");
      this.ensureScope(input, this.scopeRevision(input));
      const record: ConnectorTechnicalState = Object.freeze({
        ...scopeOf(input), recordType: input.recordType, recordId: input.recordId, status: input.status,
        version: input.expectedVersion + 1, safeEvidenceReference: input.safeEvidenceReference, recordedAt: input.recordedAt,
        ...(input.bindingReference === undefined ? {} : { bindingReference: input.bindingReference }),
      });
      this.#database.prepare(`INSERT INTO connector_technical_records (${SCOPE_COLUMNS}, record_type, record_id, version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (${SCOPE_COLUMNS}, record_type, record_id) DO UPDATE SET version = excluded.version, payload_json = excluded.payload_json WHERE connector_technical_records.version = ?`)
        .run(...scopeValues(input), input.recordType, input.recordId, record.version, JSON.stringify(record), input.expectedVersion);
      this.#database.prepare(`INSERT INTO connector_technical_idempotency (${SCOPE_COLUMNS}, idempotency_key, input_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(...scopeValues(input), input.idempotencyKey, input.inputFingerprint, JSON.stringify(record));
      const evidence: ConnectorTechnicalEvidence = Object.freeze({ ...scopeOf(input), recordType: input.recordType, recordId: input.recordId, sequence: record.version, status: input.status, safeEvidenceReference: input.safeEvidenceReference, recordedAt: input.recordedAt });
      this.#database.prepare(`INSERT INTO connector_technical_evidence (${SCOPE_COLUMNS}, record_type, record_id, sequence, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(...scopeValues(input), input.recordType, input.recordId, record.version, JSON.stringify(evidence));
      return record;
    });
  }

  public findTechnicalState(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): ConnectorTechnicalState | undefined {
    this.assertOpen(); validateScope(scope); validateText(recordType, recordId);
    const row = this.#database.prepare(`SELECT payload_json FROM connector_technical_records WHERE ${SCOPE_WHERE} AND record_type = ? AND record_id = ?`).get(...scopeValues(scope), recordType, recordId);
    return row === undefined ? undefined : freeze(parse<ConnectorTechnicalState>(text(row["payload_json"])));
  }

  public listTechnicalEvidence(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): readonly ConnectorTechnicalEvidence[] {
    this.assertOpen(); validateScope(scope); validateText(recordType, recordId);
    return Object.freeze(this.#database.prepare(`SELECT payload_json FROM connector_technical_evidence WHERE ${SCOPE_WHERE} AND record_type = ? AND record_id = ? ORDER BY sequence`).all(...scopeValues(scope), recordType, recordId)
      .map((row) => freeze(parse<ConnectorTechnicalEvidence>(text(row["payload_json"])))));
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }

  private rawInvocation(scope: ConnectorExecutionScope, invocationId: string): Readonly<{ invocation: ConnectorInvocation; rawState: string; result?: ConnectorTechnicalResult }> | undefined {
    const row = this.#database.prepare(`SELECT raw_state, payload_json FROM connector_invocations WHERE ${SCOPE_WHERE} AND invocation_id = ?`).get(...scopeValues(scope), invocationId);
    if (row === undefined) return undefined;
    const resultRow = this.#database.prepare(`SELECT payload_json FROM connector_results WHERE ${SCOPE_WHERE} AND invocation_id = ?`).get(...scopeValues(scope), invocationId);
    return Object.freeze({ invocation: parse<ConnectorInvocation>(text(row["payload_json"])), rawState: text(row["raw_state"]), ...(resultRow === undefined ? {} : { result: parse<ConnectorTechnicalResult>(text(resultRow["payload_json"])) }) });
  }

  private toInvocation(raw: Readonly<{ invocation: ConnectorInvocation; rawState: string; result?: ConnectorTechnicalResult }>): ConnectorInvocation {
    const state: ConnectorInvocationState = raw.result?.outcome === "UNKNOWN" ? "AMBIGUOUS" : raw.result?.outcome ?? (raw.rawState === "EXECUTION_STARTED" ? "AMBIGUOUS" : raw.rawState as ConnectorInvocationState);
    return freeze({ ...raw.invocation, state, ...(raw.result === undefined ? {} : { result: raw.result }) });
  }

  private activeLeaseRow(scope: ConnectorExecutionScope): Record<string, SQLOutputValue> | undefined {
    return this.#database.prepare(`SELECT lease_id, expires_at FROM connector_leases WHERE ${SCOPE_WHERE} AND status = 'ACTIVE' ORDER BY rowid DESC LIMIT 1`).get(...scopeValues(scope));
  }

  private expireScopeLease(scope: ConnectorExecutionScope, now: string): void {
    const row = this.#database.prepare(`SELECT payload_json FROM connector_leases WHERE ${SCOPE_WHERE} AND status = 'ACTIVE' AND expires_at <= ?`).get(...scopeValues(scope), now);
    if (row === undefined) return;
    const current = parse<ConnectorLease>(text(row["payload_json"]));
    const expired = Object.freeze({ ...current, status: "EXPIRED" as const, version: current.version + 1 });
    this.#database.prepare(`UPDATE connector_leases SET status = 'EXPIRED', version = ?, payload_json = ? WHERE ${SCOPE_WHERE} AND lease_id = ? AND status = 'ACTIVE'`).run(expired.version, JSON.stringify(expired), ...scopeValues(scope), current.leaseId);
  }

  private appendEvidence(scope: ConnectorExecutionScope, invocationId: string, sequence: number, kind: ConnectorExecutionEvidence["kind"], recordedAt: string, safeEvidenceReference?: string): void {
    const evidence: ConnectorExecutionEvidence = Object.freeze({ ...scopeOf(scope), invocationId, sequence, kind, recordedAt, ...(safeEvidenceReference === undefined ? {} : { safeEvidenceReference }) });
    this.#database.prepare(`INSERT INTO connector_evidence (${SCOPE_COLUMNS}, invocation_id, sequence, kind, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(...scopeValues(scope), invocationId, sequence, kind, JSON.stringify(evidence));
  }

  private scopeRevision(scope: ConnectorExecutionScope): number {
    const row = this.#database.prepare(`SELECT revision FROM connector_scopes WHERE ${SCOPE_WHERE}`).get(...scopeValues(scope));
    return row === undefined ? 0 : number(row["revision"]);
  }

  private ensureScope(scope: ConnectorExecutionScope, revision: number): void {
    if (revision !== 0) return;
    this.#database.prepare(`INSERT OR IGNORE INTO connector_scopes (${SCOPE_COLUMNS}, revision) VALUES (?, ?, ?, ?, ?, 0)`).run(...scopeValues(scope));
  }

  private incrementScopeRevision(scope: ConnectorExecutionScope, expected: number): void {
    this.ensureScope(scope, expected);
    const result = this.#database.prepare(`UPDATE connector_scopes SET revision = revision + 1 WHERE ${SCOPE_WHERE} AND revision = ?`).run(...scopeValues(scope), expected);
    if (Number(result.changes) !== 1) throw failure("LEASE_VERSION_CONFLICT", "Connector execution scope changed.");
  }

  private transaction<Result>(operation: () => Result): Result {
    this.assertOpen();
    let open = false;
    let commitStarted = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE"); open = true;
      const result = operation();
      commitStarted = true; this.#database.exec("COMMIT"); open = false;
      return result;
    } catch (error) {
      if (open && !commitStarted) { try { this.#database.exec("ROLLBACK"); } catch { this.#quarantined = true; } }
      else if (commitStarted) this.#quarantined = true;
      throw mapStorageError(error);
    }
  }

  private assertOpen(): void {
    if (this.#closed || this.#quarantined) throw failure("PERSISTENCE_UNAVAILABLE", "Durable Connector persistence is unavailable.");
  }
}

function validateScope(scope: ConnectorExecutionScope): void { validateText(scope.tenantId, scope.scopeType, scope.scopeId, scope.sourceId, scope.connectorId); }
function validateText(...values: readonly string[]): void { if (values.some((value) => value.trim().length === 0)) throw failure("PERSISTENCE_INPUT_INVALID", "Connector persistence input is invalid."); }
function validateReference(value: string): void { if (!isSafeReference(value)) throw failure("PERSISTENCE_INPUT_INVALID", "Connector persistence reference is invalid."); }
function isSafeReference(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u.test(value) && !/(?:authorization|bearer|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key)/iu.test(value); }
function scopeOf(scope: ConnectorExecutionScope): ConnectorExecutionScope { return Object.freeze({ tenantId: scope.tenantId, scopeType: scope.scopeType, scopeId: scope.scopeId, sourceId: scope.sourceId, connectorId: scope.connectorId }); }
function scopeValues(scope: ConnectorExecutionScope): readonly string[] { return [scope.tenantId, scope.scopeType, scope.scopeId, scope.sourceId, scope.connectorId]; }
function freeze<T extends object>(value: T): Readonly<T> { return Object.freeze(value); }
function parse<T>(value: string): T { return JSON.parse(value) as T; }
function text(value: SQLOutputValue | undefined): string { if (typeof value !== "string") throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector data is invalid."); return value; }
function number(value: SQLOutValue | undefined): number { if (typeof value !== "number" && typeof value !== "bigint") throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector data is invalid."); return Number(value); }
type SQLOutValue = SQLOutputValue;
function failure(code: ConnectorPersistenceErrorCode, message: string): ConnectorPersistenceError { return new ConnectorPersistenceError(code, message); }
function mapStorageError(error: unknown): ConnectorPersistenceError { return error instanceof ConnectorPersistenceError ? error : failure("PERSISTENCE_UNAVAILABLE", "Durable Connector persistence failed."); }
function isFileDatabasePath(value: string): boolean { const normalized = value.trim().toLowerCase(); return normalized.length > 0 && normalized !== ":memory:" && !normalized.startsWith("file::memory:"); }

function bootstrap(database: DatabaseSync): void {
  database.exec("BEGIN EXCLUSIVE");
  try {
    database.exec(SCHEMA_SQL);
    const row = database.prepare("SELECT schema_version FROM connector_schema WHERE singleton_id = 1").get();
    if (row === undefined) database.prepare("INSERT INTO connector_schema (singleton_id, schema_version) VALUES (1, ?)").run(SCHEMA_VERSION);
    else if (number(row["schema_version"]) !== SCHEMA_VERSION) throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector schema is incompatible.");
    database.exec("COMMIT");
  } catch (error) { try { database.exec("ROLLBACK"); } catch { /* constructor closes */ } throw error; }
}

function validate(database: DatabaseSync): void {
  if (database.prepare("PRAGMA integrity_check").get()?.["integrity_check"] !== "ok") throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector database failed integrity validation.");
  if (database.prepare("PRAGMA foreign_key_check").all().length > 0) throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector database failed linkage validation.");
  const schema = database.prepare("SELECT schema_version FROM connector_schema WHERE singleton_id = 1").get();
  if (number(schema?.["schema_version"]) !== SCHEMA_VERSION) throw failure("PERSISTENCE_INPUT_INVALID", "Durable Connector schema is incompatible.");
}

const SCOPE_COLUMNS = "tenant_id, scope_type, scope_id, source_id, connector_id";
const SCOPE_WHERE = "tenant_id = ? AND scope_type = ? AND scope_id = ? AND source_id = ? AND connector_id = ?";
const SCOPE_DEFINITION = "tenant_id TEXT NOT NULL, scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, source_id TEXT NOT NULL, connector_id TEXT NOT NULL";
const SCOPE_PRIMARY = "tenant_id, scope_type, scope_id, source_id, connector_id";
const APPEND_ONLY = ["connector_results", "connector_evidence", "connector_technical_idempotency", "connector_technical_evidence"]
  .flatMap((table) => [`CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`, `CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`]).join("\n");
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS connector_schema (singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), schema_version INTEGER NOT NULL CHECK (schema_version > 0));
CREATE TABLE IF NOT EXISTS connector_scopes (${SCOPE_DEFINITION}, revision INTEGER NOT NULL CHECK (revision >= 0), PRIMARY KEY (${SCOPE_PRIMARY}));
CREATE TABLE IF NOT EXISTS connector_leases (${SCOPE_DEFINITION}, lease_id TEXT NOT NULL, owner_id TEXT NOT NULL, acquired_at TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('ACTIVE','RELEASED','EXPIRED')), version INTEGER NOT NULL CHECK (version > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, lease_id), FOREIGN KEY (${SCOPE_PRIMARY}) REFERENCES connector_scopes (${SCOPE_PRIMARY}));
CREATE UNIQUE INDEX IF NOT EXISTS connector_active_lease_scope ON connector_leases (${SCOPE_PRIMARY}) WHERE status = 'ACTIVE';
CREATE TABLE IF NOT EXISTS connector_invocations (${SCOPE_DEFINITION}, invocation_id TEXT NOT NULL, lease_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, input_fingerprint TEXT NOT NULL, raw_state TEXT NOT NULL CHECK (raw_state IN ('PREPARED','EXECUTION_STARTED','SUCCEEDED','FAILED','AMBIGUOUS')), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, invocation_id), UNIQUE (${SCOPE_PRIMARY}, idempotency_key), FOREIGN KEY (${SCOPE_PRIMARY}, lease_id) REFERENCES connector_leases (${SCOPE_PRIMARY}, lease_id));
CREATE TABLE IF NOT EXISTS connector_idempotency (${SCOPE_DEFINITION}, idempotency_key TEXT NOT NULL, invocation_id TEXT NOT NULL, input_fingerprint TEXT NOT NULL, result_id TEXT, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, idempotency_key), FOREIGN KEY (${SCOPE_PRIMARY}, invocation_id) REFERENCES connector_invocations (${SCOPE_PRIMARY}, invocation_id));
CREATE TABLE IF NOT EXISTS connector_results (${SCOPE_DEFINITION}, invocation_id TEXT NOT NULL, result_id TEXT NOT NULL UNIQUE, outcome TEXT NOT NULL CHECK (outcome IN ('SUCCEEDED','FAILED','UNKNOWN')), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, invocation_id), FOREIGN KEY (${SCOPE_PRIMARY}, invocation_id) REFERENCES connector_invocations (${SCOPE_PRIMARY}, invocation_id));
CREATE TABLE IF NOT EXISTS connector_checkpoints (${SCOPE_DEFINITION}, version INTEGER NOT NULL CHECK (version > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}));
CREATE TABLE IF NOT EXISTS connector_evidence (${SCOPE_DEFINITION}, invocation_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), kind TEXT NOT NULL CHECK (kind IN ('INTENT_PREPARED','EXECUTION_STARTED','RESULT_RECORDED')), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, invocation_id, sequence), FOREIGN KEY (${SCOPE_PRIMARY}, invocation_id) REFERENCES connector_invocations (${SCOPE_PRIMARY}, invocation_id));
CREATE TABLE IF NOT EXISTS connector_technical_records (${SCOPE_DEFINITION}, record_type TEXT NOT NULL CHECK (record_type IN ('CONNECTOR_INSTANCE','CAPTURE_BATCH','DELIVERY_ATTEMPT','EXTERNAL_OBSERVATION','HEALTH_SIGNAL')), record_id TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, record_type, record_id), FOREIGN KEY (${SCOPE_PRIMARY}) REFERENCES connector_scopes (${SCOPE_PRIMARY}));
CREATE TABLE IF NOT EXISTS connector_technical_idempotency (${SCOPE_DEFINITION}, idempotency_key TEXT NOT NULL, input_fingerprint TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, idempotency_key), FOREIGN KEY (${SCOPE_PRIMARY}) REFERENCES connector_scopes (${SCOPE_PRIMARY}));
CREATE TABLE IF NOT EXISTS connector_technical_evidence (${SCOPE_DEFINITION}, record_type TEXT NOT NULL, record_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (${SCOPE_PRIMARY}, record_type, record_id, sequence), FOREIGN KEY (${SCOPE_PRIMARY}, record_type, record_id) REFERENCES connector_technical_records (${SCOPE_PRIMARY}, record_type, record_id));
${APPEND_ONLY}`;
