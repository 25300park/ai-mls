import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/postgresql-pool.js";

import type { AsyncConnectorExecutionPersistence } from "./connector-async-persistence.js";
import {
  ConnectorPersistenceError,
  type ConnectorCheckpoint,
  type ConnectorExecutionEvidence,
  type ConnectorExecutionScope,
  type ConnectorIdempotencyRecord,
  type ConnectorInvocation,
  type ConnectorInvocationCompletionInput,
  type ConnectorInvocationIntentInput,
  type ConnectorInvocationState,
  type ConnectorLease,
  type ConnectorLeaseInput,
  type ConnectorPersistenceErrorCode,
  type ConnectorTechnicalEvidence,
  type ConnectorTechnicalRecordType,
  type ConnectorTechnicalResult,
  type ConnectorTechnicalState,
  type ConnectorTechnicalStateInput,
} from "./connector-durable-persistence.js";

const SCOPE_COLUMNS = "tenant_id, scope_type, scope_id, source_id, connector_id";
const SCOPE_WHERE = "tenant_id=$1 AND scope_type=$2 AND scope_id=$3 AND source_id=$4 AND connector_id=$5";

/** PostgreSQL persistence for API-018. The pool remains owned by ProductionBootstrap. */
export class PostgreSqlConnectorExecutionUnitOfWork implements AsyncConnectorExecutionPersistence {
  #closed = false;
  #quarantined = false;

  public constructor(private readonly pool: PostgreSqlPoolPort) {}

  public acquireLease(input: ConnectorLeaseInput): Promise<ConnectorLease> {
    validateScope(input); validateText(input.leaseId, input.ownerId, input.acquiredAt, input.expiresAt);
    if (!Number.isInteger(input.expectedScopeRevision) || input.expectedScopeRevision < 0 || Date.parse(input.expiresAt) <= Date.parse(input.acquiredAt)) throw failure("PERSISTENCE_INPUT_INVALID", "Connector lease input is invalid.");
    return this.transaction(async (client) => {
      await ensureScope(client, input);
      const revision = await scopeRevision(client, input, true);
      if (revision !== input.expectedScopeRevision) throw failure("LEASE_VERSION_CONFLICT", "Connector lease scope changed.");
      const expired = await query<Row>(client, `SELECT payload_json FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} AND status='ACTIVE' AND expires_at <= $6 FOR UPDATE`, [...scopeValues(input), input.acquiredAt]);
      if (expired.rows[0] !== undefined) {
        const current = payload<ConnectorLease>(expired.rows[0]);
        const next = Object.freeze({ ...current, status: "EXPIRED" as const, version: current.version + 1 });
        await query(client, `UPDATE app_connector.connector_leases SET status='EXPIRED', version=$6, payload_json=$7 WHERE ${SCOPE_WHERE} AND lease_id=$8 AND status='ACTIVE'`, [...scopeValues(input), next.version, next, current.leaseId]);
      }
      const active = await query(client, `SELECT lease_id FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} AND status='ACTIVE' FOR UPDATE`, scopeValues(input));
      if (active.rows[0] !== undefined) throw failure("LEASE_CONFLICT", "Connector execution scope already has an active lease.");
      const lease: ConnectorLease = Object.freeze({ ...scopeOf(input), leaseId: input.leaseId, ownerId: input.ownerId, acquiredAt: input.acquiredAt, expiresAt: input.expiresAt, status: "ACTIVE", version: 1 });
      await query(client, `INSERT INTO app_connector.connector_leases (${SCOPE_COLUMNS}, lease_id, owner_id, acquired_at, expires_at, status, version, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ACTIVE',1,$10)`, [...scopeValues(input), input.leaseId, input.ownerId, input.acquiredAt, input.expiresAt, lease]);
      await incrementScopeRevision(client, input, revision);
      return lease;
    });
  }

  public releaseLease(scope: ConnectorExecutionScope, leaseId: string, expectedVersion: number, releasedAt: string): Promise<ConnectorLease> {
    validateScope(scope); validateText(leaseId, releasedAt);
    return this.transaction(async (client) => {
      await ensureScope(client, scope);
      const revision = await scopeRevision(client, scope, true);
      const found = await query<Row>(client, `SELECT payload_json FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} AND lease_id=$6 FOR UPDATE`, [...scopeValues(scope), leaseId]);
      if (found.rows[0] === undefined) throw failure("LEASE_NOT_FOUND", "Connector lease is unavailable.");
      const current = payload<ConnectorLease>(found.rows[0]);
      if (current.status !== "ACTIVE" || current.version !== expectedVersion) throw failure("LEASE_VERSION_CONFLICT", "Connector lease changed.");
      const released: ConnectorLease = Object.freeze({ ...current, status: "RELEASED", version: current.version + 1, expiresAt: releasedAt });
      const updated = await query(client, `UPDATE app_connector.connector_leases SET status='RELEASED', version=$6, expires_at=$7, payload_json=$8 WHERE ${SCOPE_WHERE} AND lease_id=$9 AND status='ACTIVE' AND version=$10`, [...scopeValues(scope), released.version, releasedAt, released, leaseId, expectedVersion]);
      if (updated.rowCount !== 1) throw failure("LEASE_VERSION_CONFLICT", "Connector lease changed.");
      await incrementScopeRevision(client, scope, revision);
      return released;
    });
  }

  public expireLeases(now: string): Promise<number> {
    validateText(now);
    return this.transaction(async (client) => {
      const candidates = await query<Row>(client, `SELECT DISTINCT ${SCOPE_COLUMNS} FROM app_connector.connector_leases WHERE status='ACTIVE' AND expires_at <= $1 ORDER BY ${SCOPE_COLUMNS}`, [now]);
      let count = 0;
      for (const candidate of candidates.rows) {
        const scope = scopeFromRow(candidate);
        await ensureScope(client, scope);
        const revision = await scopeRevision(client, scope, true);
        const rows = await query<Row>(client, `SELECT payload_json FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} AND status='ACTIVE' AND expires_at <= $6 FOR UPDATE`, [...scopeValues(scope), now]);
        const row = rows.rows[0];
        if (row === undefined) continue;
        const current = payload<ConnectorLease>(row);
        const expired: ConnectorLease = Object.freeze({ ...current, status: "EXPIRED", version: current.version + 1 });
        await query(client, `UPDATE app_connector.connector_leases SET status='EXPIRED', version=$6, payload_json=$7 WHERE ${SCOPE_WHERE} AND lease_id=$8 AND status='ACTIVE' AND version=$9`, [...scopeValues(current), expired.version, expired, current.leaseId, current.version]);
        await incrementScopeRevision(client, current, revision);
        count += 1;
      }
      return count;
    });
  }

  public findLease(scope: ConnectorExecutionScope): Promise<ConnectorLease | undefined> {
    validateScope(scope);
    return this.read(async (client) => {
      const found = await query<Row>(client, `SELECT payload_json FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} ORDER BY acquired_at DESC, lease_id DESC LIMIT 1`, scopeValues(scope));
      return found.rows[0] === undefined ? undefined : freeze(payload<ConnectorLease>(found.rows[0]));
    });
  }

  public prepareInvocation(input: ConnectorInvocationIntentInput): Promise<ConnectorInvocation> {
    validateScope(input); validateText(input.invocationId, input.leaseId, input.idempotencyKey, input.inputFingerprint, input.preparedAt); validateReference(input.inputReference);
    if (![input.inputVersion, input.sourcePolicyVersion, input.connectorVersion].every((value) => Number.isInteger(value) && value > 0) || !Number.isInteger(input.expectedCheckpointVersion) || input.expectedCheckpointVersion < 0) throw failure("PERSISTENCE_INPUT_INVALID", "Connector invocation input is invalid.");
    return this.transaction(async (client) => {
      await ensureScope(client, input);
      await scopeRevision(client, input, true);
      const replay = await findPayload<ConnectorIdempotencyRecord>(client, "connector_idempotency", input, "idempotency_key=$6", [input.idempotencyKey], true);
      if (replay !== undefined) {
        if (replay.invocationId !== input.invocationId || replay.inputFingerprint !== input.inputFingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Connector idempotency identity conflicts.");
        const existing = await rawInvocation(client, input, input.invocationId, true);
        if (existing === undefined) throw failure("PERSISTENCE_UNAVAILABLE", "Connector invocation linkage is invalid.");
        return toInvocation(existing);
      }
      if (await rawInvocation(client, input, input.invocationId, true) !== undefined) throw failure("INVOCATION_CONFLICT", "Connector invocation identity conflicts.");
      const active = await query<Row>(client, `SELECT lease_id, expires_at FROM app_connector.connector_leases WHERE ${SCOPE_WHERE} AND status='ACTIVE' FOR UPDATE`, scopeValues(input));
      if (active.rows[0] === undefined || string(active.rows[0]["lease_id"]) !== input.leaseId || timestamp(active.rows[0]["expires_at"]) <= input.preparedAt) throw failure("LEASE_NOT_FOUND", "A current Connector lease is required.");
      const invocation: ConnectorInvocation = Object.freeze({ ...scopeOf(input), invocationId: input.invocationId, leaseId: input.leaseId, idempotencyKey: input.idempotencyKey, inputFingerprint: input.inputFingerprint, inputReference: input.inputReference, inputVersion: input.inputVersion, sourcePolicyVersion: input.sourcePolicyVersion, connectorVersion: input.connectorVersion, expectedCheckpointVersion: input.expectedCheckpointVersion, preparedAt: input.preparedAt, state: "PREPARED" });
      await query(client, `INSERT INTO app_connector.connector_invocations (${SCOPE_COLUMNS}, invocation_id, lease_id, idempotency_key, input_fingerprint, raw_state, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PREPARED',$10)`, [...scopeValues(input), input.invocationId, input.leaseId, input.idempotencyKey, input.inputFingerprint, invocation]);
      const idempotency: ConnectorIdempotencyRecord = Object.freeze({ ...scopeOf(input), idempotencyKey: input.idempotencyKey, invocationId: input.invocationId, inputFingerprint: input.inputFingerprint });
      await query(client, `INSERT INTO app_connector.connector_idempotency (${SCOPE_COLUMNS}, idempotency_key, invocation_id, input_fingerprint, result_id, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9)`, [...scopeValues(input), input.idempotencyKey, input.invocationId, input.inputFingerprint, idempotency]);
      await appendEvidence(client, input, input.invocationId, 1, "INTENT_PREPARED", input.preparedAt);
      return invocation;
    });
  }

  public markExecutionStarted(scope: ConnectorExecutionScope, invocationId: string, startedAt: string): Promise<Readonly<{ readonly claimed: boolean; readonly invocation: ConnectorInvocation }>> {
    validateScope(scope); validateText(invocationId, startedAt);
    return this.transaction(async (client) => {
      const raw = await rawInvocation(client, scope, invocationId, true);
      if (raw === undefined) throw failure("INVOCATION_NOT_FOUND", "Connector invocation is unavailable.");
      if (raw.rawState !== "PREPARED") return Object.freeze({ claimed: false, invocation: toInvocation(raw) });
      const updated = Object.freeze({ ...raw.invocation, startedAt });
      const changed = await query(client, `UPDATE app_connector.connector_invocations SET raw_state='EXECUTION_STARTED', payload_json=$6 WHERE ${SCOPE_WHERE} AND invocation_id=$7 AND raw_state='PREPARED'`, [...scopeValues(scope), updated, invocationId]);
      if (changed.rowCount !== 1) throw failure("INVOCATION_CONFLICT", "Connector invocation dispatch claim conflicts.");
      await appendEvidence(client, scope, invocationId, 2, "EXECUTION_STARTED", startedAt);
      return Object.freeze({ claimed: true, invocation: Object.freeze({ ...updated, state: "AMBIGUOUS" as const }) });
    });
  }

  public completeInvocation(input: ConnectorInvocationCompletionInput): Promise<ConnectorInvocation> {
    validateScope(input); validateText(input.invocationId, input.resultId, input.reasonCode, input.completedAt); validateReference(input.safeEvidenceReference);
    return this.transaction(async (client) => {
      const raw = await rawInvocation(client, input, input.invocationId, true);
      if (raw === undefined) throw failure("INVOCATION_NOT_FOUND", "Connector invocation is unavailable.");
      if (raw.result !== undefined || raw.rawState === "SUCCEEDED" || raw.rawState === "FAILED") throw failure("RESULT_CONFLICT", "Connector result is append-only.");
      if (raw.rawState !== "EXECUTION_STARTED") throw failure("INVOCATION_CONFLICT", "Connector invocation was not durably started.");
      const expectedCheckpointVersion = input.expectedCheckpointVersion ?? raw.invocation.expectedCheckpointVersion;
      let currentCheckpoint: ConnectorCheckpoint | undefined;
      if (input.outcome === "SUCCEEDED") {
        if (input.checkpointReference === undefined) throw failure("PERSISTENCE_INPUT_INVALID", "Successful Connector result requires a checkpoint reference.");
        validateReference(input.checkpointReference);
        currentCheckpoint = await findPayload(client, "connector_checkpoints", input, "TRUE", [], true);
        if ((currentCheckpoint?.version ?? 0) !== expectedCheckpointVersion) throw failure("CHECKPOINT_VERSION_CONFLICT", "Connector checkpoint changed.");
      }
      const technicalResult: ConnectorTechnicalResult = Object.freeze({ resultId: input.resultId, outcome: input.outcome, reasonCode: input.reasonCode, safeEvidenceReference: input.safeEvidenceReference, completedAt: input.completedAt });
      await query(client, `INSERT INTO app_connector.connector_results (${SCOPE_COLUMNS}, invocation_id, result_id, outcome, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...scopeValues(input), input.invocationId, input.resultId, input.outcome, technicalResult]);
      const terminal = input.outcome === "UNKNOWN" ? "AMBIGUOUS" : input.outcome;
      const invocationUpdate = await query(client, `UPDATE app_connector.connector_invocations SET raw_state=$6, payload_json=$7 WHERE ${SCOPE_WHERE} AND invocation_id=$8 AND raw_state='EXECUTION_STARTED'`, [...scopeValues(input), terminal, raw.invocation, input.invocationId]);
      if (invocationUpdate.rowCount !== 1) throw failure("INVOCATION_CONFLICT", "Connector invocation changed.");
      const idempotency: ConnectorIdempotencyRecord = Object.freeze({ ...scopeOf(input), idempotencyKey: raw.invocation.idempotencyKey, invocationId: input.invocationId, inputFingerprint: raw.invocation.inputFingerprint, resultId: input.resultId });
      const idempotencyUpdate = await query(client, `UPDATE app_connector.connector_idempotency SET result_id=$6, payload_json=$7 WHERE ${SCOPE_WHERE} AND idempotency_key=$8 AND result_id IS NULL`, [...scopeValues(input), input.resultId, idempotency, raw.invocation.idempotencyKey]);
      if (idempotencyUpdate.rowCount !== 1) throw failure("IDEMPOTENCY_CONFLICT", "Connector idempotency result changed.");
      if (input.outcome === "SUCCEEDED" && input.checkpointReference !== undefined) {
        const checkpoint: ConnectorCheckpoint = Object.freeze({ ...scopeOf(input), checkpointReference: input.checkpointReference, safeEvidenceReference: input.safeEvidenceReference, version: (currentCheckpoint?.version ?? 0) + 1, updatedAt: input.completedAt });
        const checkpointUpdate = await query(client, `INSERT INTO app_connector.connector_checkpoints (${SCOPE_COLUMNS}, version, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (${SCOPE_COLUMNS}) DO UPDATE SET version=excluded.version, payload_json=excluded.payload_json WHERE app_connector.connector_checkpoints.version=$8`, [...scopeValues(input), checkpoint.version, checkpoint, expectedCheckpointVersion]);
        if (checkpointUpdate.rowCount !== 1) throw failure("CHECKPOINT_VERSION_CONFLICT", "Connector checkpoint changed.");
      }
      await appendEvidence(client, input, input.invocationId, 3, "RESULT_RECORDED", input.completedAt, input.safeEvidenceReference);
      return Object.freeze({ ...raw.invocation, state: terminal, result: technicalResult });
    });
  }

  public findInvocation(scope: ConnectorExecutionScope, invocationId: string): Promise<ConnectorInvocation | undefined> {
    validateScope(scope); validateText(invocationId);
    return this.read(async (client) => { const raw = await rawInvocation(client, scope, invocationId, false); return raw === undefined ? undefined : toInvocation(raw); });
  }
  public findCheckpoint(scope: ConnectorExecutionScope): Promise<ConnectorCheckpoint | undefined> { validateScope(scope); return this.read((client) => findPayload(client, "connector_checkpoints", scope)); }
  public findIdempotency(scope: ConnectorExecutionScope, idempotencyKey: string): Promise<ConnectorIdempotencyRecord | undefined> { validateScope(scope); validateText(idempotencyKey); return this.read((client) => findPayload(client, "connector_idempotency", scope, "idempotency_key=$6", [idempotencyKey])); }
  public listEvidence(scope: ConnectorExecutionScope): Promise<readonly ConnectorExecutionEvidence[]> { validateScope(scope); return this.read(async (client) => Object.freeze((await query<Row>(client, `SELECT payload_json FROM app_connector.connector_evidence WHERE ${SCOPE_WHERE} ORDER BY invocation_id, sequence`, scopeValues(scope))).rows.map((row) => freeze(payload<ConnectorExecutionEvidence>(row))))); }

  public recordTechnicalState(input: ConnectorTechnicalStateInput): Promise<ConnectorTechnicalState> {
    validateScope(input); validateText(input.recordType, input.recordId, input.status, input.idempotencyKey, input.inputFingerprint, input.recordedAt); validateReference(input.safeEvidenceReference);
    if (input.bindingReference !== undefined) validateReference(input.bindingReference);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw failure("PERSISTENCE_INPUT_INVALID", "Connector technical record input is invalid.");
    return this.transaction(async (client) => {
      await ensureScope(client, input);
      await scopeRevision(client, input, true);
      const replayResult = await query<Row>(client, `SELECT input_fingerprint, payload_json FROM app_connector.connector_technical_idempotency WHERE ${SCOPE_WHERE} AND idempotency_key=$6 FOR UPDATE`, [...scopeValues(input), input.idempotencyKey]);
      const replay = replayResult.rows[0];
      if (replay !== undefined) {
        if (string(replay["input_fingerprint"]) !== input.inputFingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Connector technical idempotency identity conflicts.");
        return freeze(payload<ConnectorTechnicalState>(replay));
      }
      const current = await findPayload<ConnectorTechnicalState>(client, "connector_technical_records", input, "record_type=$6 AND record_id=$7", [input.recordType, input.recordId], true);
      if ((current?.version ?? 0) !== input.expectedVersion) throw failure("TECHNICAL_VERSION_CONFLICT", "Connector technical record changed.");
      const record: ConnectorTechnicalState = Object.freeze({ ...scopeOf(input), recordType: input.recordType, recordId: input.recordId, status: input.status, version: input.expectedVersion + 1, safeEvidenceReference: input.safeEvidenceReference, recordedAt: input.recordedAt, ...(input.bindingReference === undefined ? {} : { bindingReference: input.bindingReference }) });
      const upsert = await query(client, `INSERT INTO app_connector.connector_technical_records (${SCOPE_COLUMNS}, record_type, record_id, version, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (${SCOPE_COLUMNS}, record_type, record_id) DO UPDATE SET version=excluded.version, payload_json=excluded.payload_json WHERE app_connector.connector_technical_records.version=$10`, [...scopeValues(input), input.recordType, input.recordId, record.version, record, input.expectedVersion]);
      if (upsert.rowCount !== 1) throw failure("TECHNICAL_VERSION_CONFLICT", "Connector technical record changed.");
      await query(client, `INSERT INTO app_connector.connector_technical_idempotency (${SCOPE_COLUMNS}, idempotency_key, input_fingerprint, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [...scopeValues(input), input.idempotencyKey, input.inputFingerprint, record]);
      const evidence: ConnectorTechnicalEvidence = Object.freeze({ ...scopeOf(input), recordType: input.recordType, recordId: input.recordId, sequence: record.version, status: input.status, safeEvidenceReference: input.safeEvidenceReference, recordedAt: input.recordedAt });
      await query(client, `INSERT INTO app_connector.connector_technical_evidence (${SCOPE_COLUMNS}, record_type, record_id, sequence, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...scopeValues(input), input.recordType, input.recordId, record.version, evidence]);
      return record;
    });
  }

  public findTechnicalState(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<ConnectorTechnicalState | undefined> { validateScope(scope); validateText(recordType, recordId); return this.read((client) => findPayload(client, "connector_technical_records", scope, "record_type=$6 AND record_id=$7", [recordType, recordId])); }
  public listTechnicalEvidence(scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string): Promise<readonly ConnectorTechnicalEvidence[]> { validateScope(scope); validateText(recordType, recordId); return this.read(async (client) => Object.freeze((await query<Row>(client, `SELECT payload_json FROM app_connector.connector_technical_evidence WHERE ${SCOPE_WHERE} AND record_type=$6 AND record_id=$7 ORDER BY sequence`, [...scopeValues(scope), recordType, recordId])).rows.map((row) => freeze(payload<ConnectorTechnicalEvidence>(row))))); }
  public close(): Promise<void> { this.#closed = true; return Promise.resolve(); }

  private async read<Result>(operation: (client: PostgreSqlClientPort) => Promise<Result>): Promise<Result> {
    this.assertOpen(); const client = await this.pool.connect(); let discard = false;
    try { return await operation(client); } catch (error) { discard = true; throw mapError(error); } finally { client.release(discard); }
  }

  private async transaction<Result>(operation: (client: PostgreSqlClientPort) => Promise<Result>): Promise<Result> {
    this.assertOpen(); const client = await this.pool.connect(); let open = false; let commitStarted = false; let discard = false;
    try {
      await query(client, "BEGIN"); open = true;
      const result = await operation(client);
      commitStarted = true; await query(client, "COMMIT"); open = false;
      return result;
    } catch (error) {
      discard = true;
      if (open && !commitStarted) { try { await query(client, "ROLLBACK"); open = false; } catch { this.#quarantined = true; } }
      else if (commitStarted) this.#quarantined = true;
      throw mapError(error);
    } finally { client.release(discard); }
  }

  private assertOpen(): void { if (this.#closed || this.#quarantined) throw failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector persistence is unavailable."); }
}

type Row = Record<string, unknown>;
type RawInvocation = Readonly<{ invocation: ConnectorInvocation; rawState: string; result?: ConnectorTechnicalResult }>;

async function query<RowType extends Row = Row>(client: PostgreSqlClientPort, text: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<RowType>> { return client.query<RowType>(text, values); }
async function ensureScope(client: PostgreSqlClientPort, scope: ConnectorExecutionScope): Promise<void> { await query(client, `INSERT INTO app_connector.connector_scopes (${SCOPE_COLUMNS}, revision) VALUES ($1,$2,$3,$4,$5,0) ON CONFLICT (${SCOPE_COLUMNS}) DO NOTHING`, scopeValues(scope)); }
async function scopeRevision(client: PostgreSqlClientPort, scope: ConnectorExecutionScope, lock = false): Promise<number> { const found = await query<Row>(client, `SELECT revision FROM app_connector.connector_scopes WHERE ${SCOPE_WHERE}${lock ? " FOR UPDATE" : ""}`, scopeValues(scope)); return found.rows[0] === undefined ? 0 : integer(found.rows[0]["revision"]); }
async function incrementScopeRevision(client: PostgreSqlClientPort, scope: ConnectorExecutionScope, expected: number): Promise<void> { const changed = await query(client, `UPDATE app_connector.connector_scopes SET revision=revision+1 WHERE ${SCOPE_WHERE} AND revision=$6`, [...scopeValues(scope), expected]); if (changed.rowCount !== 1) throw failure("LEASE_VERSION_CONFLICT", "Connector execution scope changed."); }
async function findPayload<Value extends object>(client: PostgreSqlClientPort, table: string, scope: ConnectorExecutionScope, extra = "TRUE", values: readonly unknown[] = [], lock = false): Promise<Value | undefined> { const found = await query<Row>(client, `SELECT payload_json FROM app_connector.${table} WHERE ${SCOPE_WHERE} AND ${extra}${lock ? " FOR UPDATE" : ""}`, [...scopeValues(scope), ...values]); return found.rows[0] === undefined ? undefined : freeze(payload<Value>(found.rows[0])); }
async function rawInvocation(client: PostgreSqlClientPort, scope: ConnectorExecutionScope, invocationId: string, lock: boolean): Promise<RawInvocation | undefined> { const found = await query<Row>(client, `SELECT raw_state, payload_json FROM app_connector.connector_invocations WHERE ${SCOPE_WHERE} AND invocation_id=$6${lock ? " FOR UPDATE" : ""}`, [...scopeValues(scope), invocationId]); if (found.rows[0] === undefined) return undefined; const result = await findPayload<ConnectorTechnicalResult>(client, "connector_results", scope, "invocation_id=$6", [invocationId]); return Object.freeze({ invocation: payload<ConnectorInvocation>(found.rows[0]), rawState: string(found.rows[0]["raw_state"]), ...(result === undefined ? {} : { result }) }); }
function toInvocation(raw: RawInvocation): ConnectorInvocation { const state: ConnectorInvocationState = raw.result?.outcome === "UNKNOWN" ? "AMBIGUOUS" : raw.result?.outcome ?? (raw.rawState === "EXECUTION_STARTED" ? "AMBIGUOUS" : raw.rawState as ConnectorInvocationState); return freeze({ ...raw.invocation, state, ...(raw.result === undefined ? {} : { result: raw.result }) }); }
async function appendEvidence(client: PostgreSqlClientPort, scope: ConnectorExecutionScope, invocationId: string, sequence: number, kind: ConnectorExecutionEvidence["kind"], recordedAt: string, safeEvidenceReference?: string): Promise<void> { const evidence: ConnectorExecutionEvidence = Object.freeze({ ...scopeOf(scope), invocationId, sequence, kind, recordedAt, ...(safeEvidenceReference === undefined ? {} : { safeEvidenceReference }) }); await query(client, `INSERT INTO app_connector.connector_evidence (${SCOPE_COLUMNS}, invocation_id, sequence, kind, payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...scopeValues(scope), invocationId, sequence, kind, evidence]); }
function validateScope(scope: ConnectorExecutionScope): void { validateText(scope.tenantId, scope.scopeType, scope.scopeId, scope.sourceId, scope.connectorId); }
function validateText(...values: readonly string[]): void { if (values.some((value) => value.trim().length === 0)) throw failure("PERSISTENCE_INPUT_INVALID", "Connector persistence input is invalid."); }
function validateReference(value: string): void { if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u.test(value) || /(?:authorization|bearer|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key)/iu.test(value)) throw failure("PERSISTENCE_INPUT_INVALID", "Connector persistence reference is invalid."); }
function scopeOf(scope: ConnectorExecutionScope): ConnectorExecutionScope { return Object.freeze({ tenantId: scope.tenantId, scopeType: scope.scopeType, scopeId: scope.scopeId, sourceId: scope.sourceId, connectorId: scope.connectorId }); }
function scopeValues(scope: ConnectorExecutionScope): readonly string[] { return [scope.tenantId, scope.scopeType, scope.scopeId, scope.sourceId, scope.connectorId]; }
function scopeFromRow(row: Row): ConnectorExecutionScope { return Object.freeze({ tenantId: string(row["tenant_id"]), scopeType: scopeType(row["scope_type"]), scopeId: string(row["scope_id"]), sourceId: string(row["source_id"]), connectorId: string(row["connector_id"]) }); }
function scopeType(value: unknown): ConnectorExecutionScope["scopeType"] { const parsed = string(value); if (parsed !== "TENANT" && parsed !== "TEAM" && parsed !== "ORGANIZATION" && parsed !== "SOURCE") throw failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector data is invalid."); return parsed; }
function payload<Value extends object>(row: Row): Value { const value = row["payload_json"]; if (typeof value === "string") return JSON.parse(value) as Value; if (typeof value === "object" && value !== null) return value as Value; throw failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector data is invalid."); }
function string(value: unknown): string { if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector data is invalid."); return value; }
function timestamp(value: unknown): string { if (value instanceof Date) return value.toISOString(); return string(value); }
function integer(value: unknown): number { const number = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : value; if (typeof number !== "number" || !Number.isSafeInteger(number)) throw failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector data is invalid."); return number; }
function freeze<Value extends object>(value: Value): Readonly<Value> { return Object.freeze(value); }
function failure(code: ConnectorPersistenceErrorCode, message: string): ConnectorPersistenceError { return new ConnectorPersistenceError(code, message); }
function mapError(error: unknown): ConnectorPersistenceError { return error instanceof ConnectorPersistenceError ? error : failure("PERSISTENCE_UNAVAILABLE", "PostgreSQL Connector persistence failed."); }
