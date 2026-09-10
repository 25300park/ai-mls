import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { createHash } from "node:crypto";

import {
  OperationalAlertError,
  normalizeAuthoritativeAlertSignals,
  validateAuthoritativeAlertSource,
  validateOperationalAlertProjection,
  validateOperationalAlertSignal,
  type OperationalAlertProjection,
  type OperationalAlertSignal,
  type OperationalAlertState,
  type AuthoritativeAlertSource,
} from "./operational-alert-projection.js";
import {
  OperationalEvidenceError,
  immutableOperationalEvidence,
  validateOperationalCategory,
  validateOperationalReference,
  validateOperationalResourceReference,
  validateOperationalTelemetryRecord,
  type OperationalTelemetryRecord,
} from "./operational-telemetry-contracts.js";
import {
  OperationalStatusError,
  deriveEvidenceFreshness,
  validateOperationalStatusProjectionRequest,
  validateOperationalStatusSnapshot,
  type OperationalStatusProjectionRequest,
  type OperationalStatusSnapshot,
} from "./operational-status-projection.js";

export interface DurableOperationalEvidenceStoreOptions {
  readonly databasePath: string;
}

export interface OperationalEvidenceFilter {
  readonly component?: string;
  readonly resourceRef?: string;
  readonly correlationId?: string;
  readonly limit?: number;
}

export interface OperationalStatusFilter {
  readonly component?: string;
  readonly resourceRef?: string;
  readonly limit?: number;
}

export interface OperationalAlertFilter {
  readonly currentState?: OperationalAlertState;
  readonly component?: string;
  readonly resourceRef?: string;
  readonly limit?: number;
}

export interface OperationalEvidenceBinding {
  readonly tenantId: string;
  readonly scopeRef: string;
}

export interface OperationalEvidenceStore {
  append(record: OperationalTelemetryRecord): OperationalTelemetryRecord;
  appendScoped(record: OperationalTelemetryRecord, binding: OperationalEvidenceBinding): OperationalTelemetryRecord;
  find(telemetryEventId: string): OperationalTelemetryRecord | undefined;
  list(filter?: OperationalEvidenceFilter): readonly OperationalTelemetryRecord[];
  listScoped(binding: OperationalEvidenceBinding, filter?: OperationalEvidenceFilter): readonly OperationalTelemetryRecord[];
  projectStatus(request: OperationalStatusProjectionRequest): OperationalStatusSnapshot;
  projectAlerts(source: AuthoritativeAlertSource): readonly OperationalAlertProjection[];
  findStatus(statusSnapshotId: string): OperationalStatusSnapshot | undefined;
  listStatuses(filter?: OperationalStatusFilter): readonly OperationalStatusSnapshot[];
  listAlertsScoped(binding: OperationalEvidenceBinding, filter?: OperationalAlertFilter): readonly OperationalAlertProjection[];
  close(): void;
}

export class DurableOperationalEvidenceStore implements OperationalEvidenceStore {
  readonly #database: DatabaseSync;
  #closed = false;

  public constructor(options: DurableOperationalEvidenceStoreOptions) {
    if (!isFileDatabasePath(options.databasePath)) throw unavailable();
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
      database.exec(SCHEMA);
      const integrity = database.prepare("PRAGMA integrity_check").get();
      if (integrity?.["integrity_check"] !== "ok") throw new Error("integrity check failed");
      this.#database = database;
      this.#validateDatabaseControls();
      this.#validateStoredState();
    } catch (error) {
      try { database?.close(); } catch { /* preserve fail-closed startup */ }
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public append(record: OperationalTelemetryRecord): OperationalTelemetryRecord {
    this.#assertOpen();
    const valid = validateOperationalTelemetryRecord(record);
    const existing = this.find(valid.telemetryEventId);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(valid)) {
        throw new OperationalEvidenceError("TELEMETRY_IDENTITY_CONFLICT", "Operational telemetry identity is immutable.");
      }
      return existing;
    }
    try {
      this.#database.prepare(`INSERT INTO operational_telemetry
        (telemetry_event_id, event_type, component, operation, resource_type, resource_ref, outcome, safe_error_code, correlation_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(valid.telemetryEventId, valid.eventType, valid.component, valid.operation, valid.resourceType, valid.resourceRef,
          valid.outcome, valid.safeErrorCode, valid.correlationId, valid.occurredAt, canonicalJson(valid));
      return immutableOperationalEvidence(valid);
    } catch (error) {
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public appendScoped(record: OperationalTelemetryRecord, binding: OperationalEvidenceBinding): OperationalTelemetryRecord {
    this.#assertOpen();
    const valid = validateOperationalTelemetryRecord(record);
    const validBinding = validateBinding(binding);
    const existing = this.find(valid.telemetryEventId);
    if (existing !== undefined) {
      const existingBinding = this.#findBinding(valid.telemetryEventId);
      if (canonicalJson(existing) !== canonicalJson(valid)
        || existingBinding === undefined
        || canonicalJson(existingBinding) !== canonicalJson(validBinding)) {
        throw new OperationalEvidenceError("TELEMETRY_IDENTITY_CONFLICT", "Operational telemetry identity is immutable.");
      }
      return existing;
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      this.#database.prepare(`INSERT INTO operational_telemetry
        (telemetry_event_id, event_type, component, operation, resource_type, resource_ref, outcome, safe_error_code, correlation_id, occurred_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(valid.telemetryEventId, valid.eventType, valid.component, valid.operation, valid.resourceType, valid.resourceRef,
          valid.outcome, valid.safeErrorCode, valid.correlationId, valid.occurredAt, canonicalJson(valid));
      this.#database.prepare("INSERT INTO operational_evidence_binding (telemetry_event_id, tenant_id, scope_ref) VALUES (?, ?, ?)")
        .run(valid.telemetryEventId, validBinding.tenantId, validBinding.scopeRef);
      this.#database.exec("COMMIT");
      return immutableOperationalEvidence(valid);
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve original persistence failure */ }
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public find(telemetryEventId: string): OperationalTelemetryRecord | undefined {
    this.#assertOpen();
    const identity = validateOperationalReference(telemetryEventId, "telemetry:");
    try {
      const row = this.#database.prepare("SELECT payload_json FROM operational_telemetry WHERE telemetry_event_id = ?").get(identity);
      return row === undefined ? undefined : decode(row);
    } catch (error) {
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public list(filter: OperationalEvidenceFilter = {}): readonly OperationalTelemetryRecord[] {
    this.#assertOpen();
    validateFilter(filter);
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new OperationalEvidenceError("TELEMETRY_INPUT_INVALID", "Operational telemetry input is invalid.");
    }
    const clauses: string[] = [];
    const values: string[] = [];
    if (filter.component !== undefined) { values.push(validateOperationalCategory(filter.component)); clauses.push("component = ?"); }
    if (filter.resourceRef !== undefined) { values.push(validateOperationalResourceReference(filter.resourceRef)); clauses.push("resource_ref = ?"); }
    if (filter.correlationId !== undefined) { values.push(validateOperationalReference(filter.correlationId, "correlation:")); clauses.push("correlation_id = ?"); }
    const where = clauses.length === 0 ? "" : ` WHERE ${clauses.join(" AND ")}`;
    try {
      const rows = this.#database.prepare(`SELECT payload_json FROM operational_telemetry${where} ORDER BY occurred_at, telemetry_event_id LIMIT ${limit}`).all(...values);
      return immutableOperationalEvidence(rows.map(decode));
    } catch (error) {
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public listScoped(binding: OperationalEvidenceBinding, filter: OperationalEvidenceFilter = {}): readonly OperationalTelemetryRecord[] {
    this.#assertOpen();
    const validBinding = validateBinding(binding);
    validateFilter(filter);
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalidTelemetry();
    const clauses = ["binding.tenant_id = ?", "binding.scope_ref = ?"];
    const values = [validBinding.tenantId, validBinding.scopeRef];
    if (filter.component !== undefined) { values.push(validateOperationalCategory(filter.component)); clauses.push("telemetry.component = ?"); }
    if (filter.resourceRef !== undefined) { values.push(validateOperationalResourceReference(filter.resourceRef)); clauses.push("telemetry.resource_ref = ?"); }
    if (filter.correlationId !== undefined) { values.push(validateOperationalReference(filter.correlationId, "correlation:")); clauses.push("telemetry.correlation_id = ?"); }
    try {
      const rows = this.#database.prepare(`SELECT telemetry.payload_json FROM operational_telemetry AS telemetry
        INNER JOIN operational_evidence_binding AS binding ON binding.telemetry_event_id = telemetry.telemetry_event_id
        WHERE ${clauses.join(" AND ")} ORDER BY telemetry.occurred_at, telemetry.telemetry_event_id LIMIT ${limit}`).all(...values);
      return immutableOperationalEvidence(rows.map(decode));
    } catch (error) {
      if (error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public projectStatus(request: OperationalStatusProjectionRequest): OperationalStatusSnapshot {
    this.#assertOpen();
    const valid = validateOperationalStatusProjectionRequest(request);
    const source = this.find(valid.telemetryEventId);
    if (source === undefined) throw new OperationalStatusError("TELEMETRY_NOT_FOUND", "Referenced operational telemetry was not found.");
    const snapshot = validateOperationalStatusSnapshot({
      ...valid,
      component: source.component,
      resourceType: source.resourceType,
      resourceRef: source.resourceRef,
      freshness: deriveEvidenceFreshness(source.occurredAt, valid.evaluatedAt, valid.freshnessThresholdMs),
      evidenceOccurredAt: source.occurredAt,
    });
    const existing = this.findStatus(snapshot.statusSnapshotId);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(snapshot)) {
        throw new OperationalStatusError("OPERATIONAL_STATUS_IDENTITY_CONFLICT", "Operational status snapshot identity is immutable.");
      }
      this.#projectStatusAlerts(existing, source);
      return existing;
    }
    try {
      this.#database.prepare(`INSERT INTO operational_status_snapshot
        (status_snapshot_id, telemetry_event_id, component, resource_type, resource_ref, health, readiness, freshness,
         evidence_occurred_at, evaluated_at, freshness_threshold_ms, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(snapshot.statusSnapshotId, snapshot.telemetryEventId, snapshot.component, snapshot.resourceType, snapshot.resourceRef,
          snapshot.health, snapshot.readiness, snapshot.freshness, snapshot.evidenceOccurredAt, snapshot.evaluatedAt,
          snapshot.freshnessThresholdMs, canonicalJson(snapshot));
      this.#projectStatusAlerts(snapshot, source);
      return immutableOperationalEvidence(snapshot);
    } catch (error) {
      if (error instanceof OperationalStatusError) throw error;
      throw unavailable();
    }
  }

  public findStatus(statusSnapshotId: string): OperationalStatusSnapshot | undefined {
    this.#assertOpen();
    const identity = validateOperationalReference(statusSnapshotId, "status-snapshot:");
    try {
      const row = this.#database.prepare("SELECT payload_json FROM operational_status_snapshot WHERE status_snapshot_id = ?").get(identity);
      return row === undefined ? undefined : decodeStatus(row);
    } catch (error) {
      if (error instanceof OperationalEvidenceError || error instanceof OperationalStatusError) throw error;
      throw unavailable();
    }
  }

  public listStatuses(filter: OperationalStatusFilter = {}): readonly OperationalStatusSnapshot[] {
    this.#assertOpen();
    validateStatusFilter(filter);
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalidTelemetry();
    const clauses: string[] = [];
    const values: string[] = [];
    if (filter.component !== undefined) { values.push(validateOperationalCategory(filter.component)); clauses.push("component = ?"); }
    if (filter.resourceRef !== undefined) { values.push(validateOperationalResourceReference(filter.resourceRef)); clauses.push("resource_ref = ?"); }
    const where = clauses.length === 0 ? "" : ` WHERE ${clauses.join(" AND ")}`;
    try {
      const rows = this.#database.prepare(`SELECT payload_json FROM operational_status_snapshot${where} ORDER BY evaluated_at, status_snapshot_id LIMIT ${limit}`).all(...values);
      return immutableOperationalEvidence(rows.map(decodeStatus));
    } catch (error) {
      if (error instanceof OperationalEvidenceError || error instanceof OperationalStatusError) throw error;
      throw unavailable();
    }
  }

  public projectAlerts(source: AuthoritativeAlertSource): readonly OperationalAlertProjection[] {
    const validSource = validateAuthoritativeAlertSource(source);
    this.#validateAlertSourceProvenance(validSource);
    const projected = normalizeAuthoritativeAlertSignals(validSource)
      .map((signal) => this.#projectAlert(signal))
      .filter((alert): alert is OperationalAlertProjection => alert !== undefined);
    return immutableOperationalEvidence(projected);
  }

  #projectAlert(signal: OperationalAlertSignal): OperationalAlertProjection | undefined {
    this.#assertOpen();
    const valid = validateOperationalAlertSignal(signal);
    const binding = validateBinding({ tenantId: valid.tenantId, scopeRef: valid.scopeRef });
    const conditionKey = hash(`${valid.alertType}|${valid.component}|${valid.resourceRef}|${valid.conditionFingerprint}`);
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      const replayRow = this.#database.prepare(`SELECT evaluation.payload_json, evaluation.signal_json
        FROM operational_alert_evaluation AS evaluation
        INNER JOIN operational_alert_occurrence AS occurrence ON occurrence.alert_id = evaluation.alert_id
        WHERE evaluation.alert_type = ? AND evaluation.source_id = ?`).get(valid.alertType, valid.sourceId);
      if (replayRow !== undefined) {
        if (text(replayRow["signal_json"]) !== canonicalJson(valid)) throw new OperationalAlertError("OPERATIONAL_ALERT_IDENTITY_CONFLICT", "Operational Alert source identity is immutable.");
        const replay = decodeAlert(replayRow);
        this.#database.exec("COMMIT");
        return replay;
      }

      const latestRow = this.#database.prepare(`SELECT occurrence.alert_id, occurrence.opened_at, evaluation.payload_json
        FROM operational_alert_occurrence AS occurrence
        INNER JOIN operational_alert_evaluation AS evaluation ON evaluation.evaluation_id = (
          SELECT candidate.evaluation_id FROM operational_alert_evaluation AS candidate
          WHERE candidate.alert_id = occurrence.alert_id ORDER BY candidate.rowid DESC LIMIT 1
        )
        WHERE occurrence.condition_key = ? AND occurrence.tenant_id = ? AND occurrence.scope_ref = ?
        ORDER BY occurrence.opened_at DESC, occurrence.alert_id DESC LIMIT 1`)
        .get(conditionKey, binding.tenantId, binding.scopeRef);
      const latest = latestRow === undefined ? undefined : decodeAlert(latestRow);
      if (!valid.active && latest === undefined) {
        this.#database.exec("COMMIT");
        return undefined;
      }
      if (latest !== undefined && Date.parse(valid.observedAt) < Date.parse(latest.lastEvaluatedAt)) {
        throw new OperationalAlertError("OPERATIONAL_ALERT_INVALID", "Operational Alert evaluation time cannot move backwards.");
      }

      const opensOccurrence = valid.active && (latest === undefined || latest.currentState === "CLEARED");
      const alertId = opensOccurrence
        ? `alert:${hash(`${conditionKey}|${binding.tenantId}|${binding.scopeRef}|${valid.sourceId}|${valid.observedAt}`)}`
        : latest?.alertId;
      if (alertId === undefined) throw new OperationalAlertError("OPERATIONAL_ALERT_NOT_FOUND", "Operational Alert occurrence was not found.");
      const openedAt = opensOccurrence ? valid.observedAt : latest?.openedAt;
      if (openedAt === undefined) throw new OperationalAlertError("OPERATIONAL_ALERT_NOT_FOUND", "Operational Alert occurrence was not found.");
      const currentState: OperationalAlertState = valid.active ? "ACTIVE" : "CLEARED";
      const projection = validateOperationalAlertProjection({
        alertId,
        alertType: valid.alertType,
        severity: valid.severity,
        component: valid.component,
        resourceRef: valid.resourceRef,
        currentState,
        safeReasonCode: valid.safeReasonCode,
        evidenceRefs: valid.evidenceRefs,
        openedAt,
        lastEvaluatedAt: valid.observedAt,
        clearedAt: currentState === "ACTIVE" ? null : latest?.clearedAt ?? valid.observedAt,
      });
      if (opensOccurrence) {
        this.#database.prepare(`INSERT INTO operational_alert_occurrence
          (alert_id, condition_key, alert_type, component, resource_ref, tenant_id, scope_ref, opened_source_id, opened_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(alertId, conditionKey, valid.alertType, valid.component, valid.resourceRef, binding.tenantId, binding.scopeRef, valid.sourceId, openedAt);
      }
      const evaluationId = `alert-evaluation:${hash(`${alertId}|${valid.sourceId}`)}`;
      this.#database.prepare(`INSERT INTO operational_alert_evaluation
        (evaluation_id, alert_id, alert_type, source_id, current_state, severity, safe_reason_code, evaluated_at, payload_json, signal_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(evaluationId, alertId, valid.alertType, valid.sourceId, projection.currentState, projection.severity,
          projection.safeReasonCode, projection.lastEvaluatedAt, canonicalJson(projection), canonicalJson(valid));
      this.#database.exec("COMMIT");
      return projection;
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve original failure */ }
      if (error instanceof OperationalAlertError || error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public listAlertsScoped(binding: OperationalEvidenceBinding, filter: OperationalAlertFilter = {}): readonly OperationalAlertProjection[] {
    this.#assertOpen();
    const validBinding = validateBinding(binding);
    validateAlertFilter(filter);
    const limit = filter.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw invalidAlert();
    const clauses = ["occurrence.tenant_id = ?", "occurrence.scope_ref = ?"];
    const values = [validBinding.tenantId, validBinding.scopeRef];
    if (filter.currentState !== undefined) { values.push(filter.currentState); clauses.push("evaluation.current_state = ?"); }
    if (filter.component !== undefined) { values.push(validateOperationalCategory(filter.component)); clauses.push("occurrence.component = ?"); }
    if (filter.resourceRef !== undefined) { values.push(validateOperationalResourceReference(filter.resourceRef)); clauses.push("occurrence.resource_ref = ?"); }
    try {
      const rows = this.#database.prepare(`SELECT evaluation.payload_json
        FROM operational_alert_occurrence AS occurrence
        INNER JOIN operational_alert_evaluation AS evaluation ON evaluation.evaluation_id = (
          SELECT candidate.evaluation_id FROM operational_alert_evaluation AS candidate
          WHERE candidate.alert_id = occurrence.alert_id ORDER BY candidate.rowid DESC LIMIT 1
        )
        WHERE ${clauses.join(" AND ")}
        ORDER BY CASE evaluation.current_state WHEN 'ACTIVE' THEN 0 ELSE 1 END,
          evaluation.evaluated_at DESC, occurrence.opened_at DESC, occurrence.alert_id DESC LIMIT ${limit}`).all(...values);
      return immutableOperationalEvidence(rows.map(decodeAlert));
    } catch (error) {
      if (error instanceof OperationalAlertError || error instanceof OperationalEvidenceError) throw error;
      throw unavailable();
    }
  }

  public close(): void {
    if (this.#closed) return;
    this.#database.close();
    this.#closed = true;
  }

  #assertOpen(): void {
    if (this.#closed) throw unavailable();
  }

  #validateStoredState(): void {
    for (const row of this.#database.prepare("SELECT * FROM operational_telemetry").all()) {
      const record = decode(row);
      if (text(row["telemetry_event_id"]) !== record.telemetryEventId
        || text(row["event_type"]) !== record.eventType
        || text(row["component"]) !== record.component
        || text(row["operation"]) !== record.operation
        || text(row["resource_type"]) !== record.resourceType
        || text(row["resource_ref"]) !== record.resourceRef
        || text(row["outcome"]) !== record.outcome
        || nullableText(row["safe_error_code"]) !== record.safeErrorCode
        || nullableText(row["correlation_id"]) !== record.correlationId
        || text(row["occurred_at"]) !== record.occurredAt
        || text(row["payload_json"]) !== canonicalJson(record)) throw unavailable();
    }
    for (const row of this.#database.prepare("SELECT telemetry_event_id, tenant_id, scope_ref FROM operational_evidence_binding").all()) {
      validateOperationalReference(text(row["telemetry_event_id"]), "telemetry:");
      validateBinding({ tenantId: text(row["tenant_id"]), scopeRef: text(row["scope_ref"]) });
      if (this.find(text(row["telemetry_event_id"])) === undefined) throw unavailable();
    }
    for (const row of this.#database.prepare("SELECT * FROM operational_status_snapshot").all()) {
      const snapshot = decodeStatus(row);
      if (text(row["status_snapshot_id"]) !== snapshot.statusSnapshotId
        || text(row["telemetry_event_id"]) !== snapshot.telemetryEventId
        || text(row["component"]) !== snapshot.component
        || text(row["resource_type"]) !== snapshot.resourceType
        || text(row["resource_ref"]) !== snapshot.resourceRef
        || text(row["health"]) !== snapshot.health
        || text(row["readiness"]) !== snapshot.readiness
        || text(row["freshness"]) !== snapshot.freshness
        || text(row["evidence_occurred_at"]) !== snapshot.evidenceOccurredAt
        || text(row["evaluated_at"]) !== snapshot.evaluatedAt
        || nullableNumber(row["freshness_threshold_ms"]) !== snapshot.freshnessThresholdMs
        || text(row["payload_json"]) !== canonicalJson(snapshot)) throw unavailable();
      const telemetry = this.find(snapshot.telemetryEventId);
      if (telemetry?.component !== snapshot.component || telemetry.resourceType !== snapshot.resourceType
        || telemetry.resourceRef !== snapshot.resourceRef || telemetry.occurredAt !== snapshot.evidenceOccurredAt) throw unavailable();
    }
    const alertOccurrences = new Map<string, Readonly<Record<string, string>>>();
    for (const row of this.#database.prepare("SELECT * FROM operational_alert_occurrence").all()) {
      const alertId = validateOperationalReference(text(row["alert_id"]), "alert:");
      const occurrence = Object.freeze({
        conditionKey: text(row["condition_key"]),
        alertType: validateOperationalCategory(text(row["alert_type"])),
        component: validateOperationalCategory(text(row["component"])),
        resourceRef: validateOperationalResourceReference(text(row["resource_ref"])),
        tenantId: text(row["tenant_id"]), scopeRef: text(row["scope_ref"]),
        openedSourceId: validateOperationalReference(text(row["opened_source_id"])),
        openedAt: text(row["opened_at"]),
      });
      validateBinding({ tenantId: occurrence.tenantId, scopeRef: occurrence.scopeRef });
      if (!/^[a-f0-9]{64}$/u.test(occurrence.conditionKey) || !Number.isFinite(Date.parse(occurrence.openedAt))) throw unavailable();
      alertOccurrences.set(alertId, occurrence);
    }
    for (const row of this.#database.prepare("SELECT * FROM operational_alert_evaluation").all()) {
      const projection = decodeAlert(row);
      const signal = decodeAlertSignal(row);
      const occurrence = alertOccurrences.get(projection.alertId);
      if (occurrence?.["conditionKey"] !== hash(`${signal.alertType}|${signal.component}|${signal.resourceRef}|${signal.conditionFingerprint}`)
        || occurrence["alertType"] !== signal.alertType || occurrence["alertType"] !== projection.alertType
        || occurrence["component"] !== signal.component || occurrence["component"] !== projection.component
        || occurrence["resourceRef"] !== signal.resourceRef || occurrence["resourceRef"] !== projection.resourceRef
        || occurrence["tenantId"] !== signal.tenantId || occurrence["scopeRef"] !== signal.scopeRef
        || occurrence["openedAt"] !== projection.openedAt
        || text(row["evaluation_id"]) !== `alert-evaluation:${hash(`${projection.alertId}|${signal.sourceId}`)}`
        || text(row["alert_id"]) !== projection.alertId
        || text(row["alert_type"]) !== projection.alertType
        || text(row["source_id"]) !== signal.sourceId
        || text(row["current_state"]) !== projection.currentState
        || text(row["severity"]) !== projection.severity
        || text(row["safe_reason_code"]) !== projection.safeReasonCode
        || text(row["evaluated_at"]) !== projection.lastEvaluatedAt
        || text(row["payload_json"]) !== canonicalJson(projection)
        || text(row["signal_json"]) !== canonicalJson(signal)) throw unavailable();
    }
  }

  #findBinding(telemetryEventId: string): OperationalEvidenceBinding | undefined {
    const row = this.#database.prepare("SELECT tenant_id, scope_ref FROM operational_evidence_binding WHERE telemetry_event_id = ?").get(telemetryEventId);
    return row === undefined ? undefined : validateBinding({ tenantId: text(row["tenant_id"]), scopeRef: text(row["scope_ref"]) });
  }

  #validateAlertSourceProvenance(source: AuthoritativeAlertSource): void {
    if (source.sourceKind === "OPERATIONAL_STATUS") {
      const snapshot = this.findStatus(source.sourceId);
      if (snapshot?.component !== source.component || snapshot.resourceRef !== source.resourceRef
        || snapshot.evaluatedAt !== source.observedAt || snapshot.health !== source.health
        || snapshot.readiness !== source.readiness || snapshot.freshness !== source.freshness
        || snapshot.freshnessThresholdMs !== source.freshnessThresholdMs) throw invalidAlert();
      const telemetry = this.find(snapshot.telemetryEventId);
      const binding = this.#findBinding(snapshot.telemetryEventId);
      if (telemetry === undefined || binding === undefined
        || canonicalJson(telemetry.evidenceRefs) !== canonicalJson(source.evidenceRefs)
        || binding.tenantId !== source.tenantId || binding.scopeRef !== source.scopeRef) throw invalidAlert();
      return;
    }

    const telemetry = this.find(source.sourceId);
    const binding = this.#findBinding(source.sourceId);
    if (telemetry === undefined || binding === undefined
      || telemetry.component !== source.component || telemetry.resourceRef !== source.resourceRef
      || telemetry.occurredAt !== source.observedAt
      || canonicalJson(telemetry.evidenceRefs) !== canonicalJson(source.evidenceRefs)
      || binding.tenantId !== source.tenantId || binding.scopeRef !== source.scopeRef
      || !alertSourceConditionMatchesTelemetry(source, telemetry)) throw invalidAlert();
  }

  #projectStatusAlerts(snapshot: OperationalStatusSnapshot, source: OperationalTelemetryRecord): void {
    const scopedBinding = this.#findBinding(snapshot.telemetryEventId);
    if (scopedBinding === undefined) return;
    const conditionRef = `condition:operational-status-${hash(`${snapshot.component}|${snapshot.resourceRef}`)}`;
    this.projectAlerts({
      sourceId: snapshot.statusSnapshotId,
      conditionRef,
      sourceKind: "OPERATIONAL_STATUS",
      component: snapshot.component,
      resourceRef: snapshot.resourceRef,
      tenantId: scopedBinding.tenantId,
      scopeRef: scopedBinding.scopeRef,
      evidenceRefs: source.evidenceRefs,
      observedAt: snapshot.evaluatedAt,
      health: snapshot.health,
      readiness: snapshot.readiness,
      freshness: snapshot.freshness,
      freshnessThresholdMs: snapshot.freshnessThresholdMs,
    });
  }

  #validateDatabaseControls(): void {
    const foreignKeys = this.#database.prepare("PRAGMA foreign_keys").get()?.["foreign_keys"];
    const journalMode = this.#database.prepare("PRAGMA journal_mode").get()?.["journal_mode"];
    const synchronous = this.#database.prepare("PRAGMA synchronous").get()?.["synchronous"];
    const busyTimeout = this.#database.prepare("PRAGMA busy_timeout").get()?.["timeout"];
    if (foreignKeys !== 1 || journalMode !== "wal" || synchronous !== 2 || busyTimeout !== 5000) throw unavailable();
    for (const [name, expectedSql] of Object.entries(SCHEMA_OBJECTS)) {
      const row = this.#database.prepare("SELECT sql FROM sqlite_schema WHERE name = ?").get(name);
      if (row === undefined || normalizeSql(text(row["sql"])) !== normalizeSql(expectedSql)) throw unavailable();
    }
  }
}

export function createProductionOperationalEvidenceStore(options: DurableOperationalEvidenceStoreOptions): OperationalEvidenceStore {
  return new DurableOperationalEvidenceStore(options);
}

function alertSourceConditionMatchesTelemetry(
  source: Exclude<AuthoritativeAlertSource, Readonly<{ sourceKind: "OPERATIONAL_STATUS" }>>,
  telemetry: OperationalTelemetryRecord,
): boolean {
  switch (source.sourceKind) {
    case "PUBLICATION_OUTCOME":
      return telemetry.resourceType === "PUBLICATION" && telemetry.outcome === source.outcome;
    case "CONNECTOR_INVOCATION":
      return telemetry.resourceType === "CONNECTOR" && telemetry.outcome === source.state;
    case "RECOVERY_CASE":
      return telemetry.resourceType === "RECOVERY_CASE" && telemetry.outcome === source.status;
    case "INTEGRATION_CONTRACT":
      return telemetry.resourceType === "INTEGRATION_CONTRACT" && telemetry.outcome === source.status;
    case "SECURITY_FINDING":
      return telemetry.resourceType === "SECURITY_EVENT"
        && telemetry.operation === "SECURITY_MONITORING"
        && telemetry.outcome === (source.detected ? "DETECTED" : "CLEARED");
    case "DEPENDENCY_AUDIT":
      return telemetry.resourceType === "DEPENDENCY_AUDIT"
        && telemetry.outcome === (source.active ? "ACTIVE" : "CLEARED")
        && telemetry.safeErrorCode === source.auditSeverity.toUpperCase()
        && telemetry.operation === source.classification;
    case "ARCHITECTURE_CHECKSUM":
      return telemetry.resourceType === "ARCHITECTURE_CHECKSUM"
        && telemetry.operation === "ARCHITECTURE_VALIDATION"
        && telemetry.outcome === (source.matchesBaseline ? "MATCHED" : source.approvedDelta ? "APPROVED_DELTA" : "DRIFT");
    case "AUTHORIZATION_AGGREGATE":
    case "IDEMPOTENCY_AGGREGATE":
    case "BACKUP_READINESS":
    case "DEPLOYMENT_READINESS":
      return false;
  }
}

function validateFilter(filter: unknown): asserts filter is OperationalEvidenceFilter {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)
    || (Object.getPrototypeOf(filter) !== Object.prototype && Object.getPrototypeOf(filter) !== null)
    || Object.keys(filter).some((key) => !["component", "resourceRef", "correlationId", "limit"].includes(key))) {
    throw new OperationalEvidenceError("TELEMETRY_INPUT_INVALID", "Operational telemetry input is invalid.");
  }
}

function validateStatusFilter(filter: unknown): asserts filter is OperationalStatusFilter {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)
    || (Object.getPrototypeOf(filter) !== Object.prototype && Object.getPrototypeOf(filter) !== null)
    || Object.keys(filter).some((key) => !["component", "resourceRef", "limit"].includes(key))) throw invalidTelemetry();
}

function validateAlertFilter(filter: unknown): asserts filter is OperationalAlertFilter {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)
    || (Object.getPrototypeOf(filter) !== Object.prototype && Object.getPrototypeOf(filter) !== null)
    || Object.keys(filter).some((key) => !["currentState", "component", "resourceRef", "limit"].includes(key))) throw invalidAlert();
  const value = filter as Readonly<Record<string, unknown>>;
  if (value["currentState"] !== undefined && value["currentState"] !== "ACTIVE" && value["currentState"] !== "CLEARED") throw invalidAlert();
}

function validateBinding(binding: unknown): OperationalEvidenceBinding {
  if (typeof binding !== "object" || binding === null || Array.isArray(binding)
    || (Object.getPrototypeOf(binding) !== Object.prototype && Object.getPrototypeOf(binding) !== null)
    || Object.keys(binding).length !== 2 || !Object.hasOwn(binding, "tenantId") || !Object.hasOwn(binding, "scopeRef")) throw invalidTelemetry();
  const value = binding as Readonly<Record<string, unknown>>;
  for (const key of ["tenantId", "scopeRef"] as const) {
    const item = value[key];
    if (typeof item !== "string" || item.trim() !== item || item.length < 1 || item.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(item)) throw invalidTelemetry();
  }
  return immutableOperationalEvidence({ tenantId: value["tenantId"], scopeRef: value["scopeRef"] }) as OperationalEvidenceBinding;
}

function decode(row: Record<string, SQLOutputValue>): OperationalTelemetryRecord {
  const value = row["payload_json"];
  if (typeof value !== "string") throw unavailable();
  try { return validateOperationalTelemetryRecord(JSON.parse(value) as unknown); } catch { throw unavailable(); }
}

function decodeStatus(row: Record<string, SQLOutputValue>): OperationalStatusSnapshot {
  const value = row["payload_json"];
  if (typeof value !== "string") throw unavailable();
  try { return validateOperationalStatusSnapshot(JSON.parse(value) as unknown); } catch { throw unavailable(); }
}

function decodeAlert(row: Record<string, SQLOutputValue>): OperationalAlertProjection {
  const value = row["payload_json"];
  if (typeof value !== "string") throw unavailable();
  try { return validateOperationalAlertProjection(JSON.parse(value) as unknown); } catch { throw unavailable(); }
}

function decodeAlertSignal(row: Record<string, SQLOutputValue>): OperationalAlertSignal {
  const value = row["signal_json"];
  if (typeof value !== "string") throw unavailable();
  try { return validateOperationalAlertSignal(JSON.parse(value) as unknown); } catch { throw unavailable(); }
}

function text(value: SQLOutputValue | undefined): string {
  if (typeof value !== "string") throw unavailable();
  return value;
}

function nullableText(value: SQLOutputValue | undefined): string | null {
  if (value === null) return null;
  return text(value);
}

function nullableNumber(value: SQLOutputValue | undefined): number | null {
  if (value === null) return null;
  if (typeof value !== "number") throw unavailable();
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortValue(child)]));
}

function isFileDatabasePath(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== ":memory:" && !normalized.startsWith("file:");
}

function unavailable(): OperationalEvidenceError {
  return new OperationalEvidenceError("PERSISTENCE_UNAVAILABLE", "Durable operational evidence persistence is unavailable.");
}

function invalidTelemetry(): OperationalEvidenceError {
  return new OperationalEvidenceError("TELEMETRY_INPUT_INVALID", "Operational telemetry input is invalid.");
}

function invalidAlert(): OperationalAlertError {
  return new OperationalAlertError("OPERATIONAL_ALERT_INVALID", "Operational Alert input is invalid.");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/gu, " ").replace(/\s+if not exists/giu, "").replace(/;$/u, "").trim().toLowerCase();
}

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS operational_telemetry (
  telemetry_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  component TEXT NOT NULL,
  operation TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  outcome TEXT NOT NULL,
  safe_error_code TEXT,
  correlation_id TEXT,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL
)`;
const COMPONENT_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_telemetry_component_idx ON operational_telemetry(component, occurred_at)";
const RESOURCE_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_telemetry_resource_idx ON operational_telemetry(resource_ref, occurred_at)";
const CORRELATION_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_telemetry_correlation_idx ON operational_telemetry(correlation_id, occurred_at)";
const UPDATE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_telemetry_no_update BEFORE UPDATE ON operational_telemetry BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const DELETE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_telemetry_no_delete BEFORE DELETE ON operational_telemetry BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const INSERT_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_telemetry_no_replace BEFORE INSERT ON operational_telemetry WHEN EXISTS (SELECT 1 FROM operational_telemetry WHERE telemetry_event_id = NEW.telemetry_event_id) BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const STATUS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS operational_status_snapshot (
  status_snapshot_id TEXT PRIMARY KEY,
  telemetry_event_id TEXT NOT NULL REFERENCES operational_telemetry(telemetry_event_id),
  component TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  health TEXT NOT NULL,
  readiness TEXT NOT NULL,
  freshness TEXT NOT NULL,
  evidence_occurred_at TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  freshness_threshold_ms INTEGER,
  payload_json TEXT NOT NULL
)`;
const STATUS_COMPONENT_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_status_component_idx ON operational_status_snapshot(component, evaluated_at)";
const STATUS_RESOURCE_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_status_resource_idx ON operational_status_snapshot(resource_ref, evaluated_at)";
const STATUS_UPDATE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_status_no_update BEFORE UPDATE ON operational_status_snapshot BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const STATUS_DELETE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_status_no_delete BEFORE DELETE ON operational_status_snapshot BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const STATUS_INSERT_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_status_no_replace BEFORE INSERT ON operational_status_snapshot WHEN EXISTS (SELECT 1 FROM operational_status_snapshot WHERE status_snapshot_id = NEW.status_snapshot_id) BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const BINDING_TABLE_SQL = `CREATE TABLE IF NOT EXISTS operational_evidence_binding (
  telemetry_event_id TEXT PRIMARY KEY REFERENCES operational_telemetry(telemetry_event_id),
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL
)`;
const BINDING_SCOPE_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_evidence_binding_scope_idx ON operational_evidence_binding(tenant_id, scope_ref, telemetry_event_id)";
const BINDING_UPDATE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_evidence_binding_no_update BEFORE UPDATE ON operational_evidence_binding BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const BINDING_DELETE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_evidence_binding_no_delete BEFORE DELETE ON operational_evidence_binding BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const BINDING_INSERT_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_evidence_binding_no_replace BEFORE INSERT ON operational_evidence_binding WHEN EXISTS (SELECT 1 FROM operational_evidence_binding WHERE telemetry_event_id = NEW.telemetry_event_id) BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_OCCURRENCE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS operational_alert_occurrence (
  alert_id TEXT PRIMARY KEY,
  condition_key TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  component TEXT NOT NULL,
  resource_ref TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  opened_source_id TEXT NOT NULL,
  opened_at TEXT NOT NULL
)`;
const ALERT_OCCURRENCE_CONDITION_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_alert_condition_idx ON operational_alert_occurrence(condition_key, tenant_id, scope_ref, opened_at)";
const ALERT_OCCURRENCE_SCOPE_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_alert_scope_idx ON operational_alert_occurrence(tenant_id, scope_ref, opened_at)";
const ALERT_OCCURRENCE_UPDATE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_occurrence_no_update BEFORE UPDATE ON operational_alert_occurrence BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_OCCURRENCE_DELETE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_occurrence_no_delete BEFORE DELETE ON operational_alert_occurrence BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_OCCURRENCE_INSERT_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_occurrence_no_replace BEFORE INSERT ON operational_alert_occurrence WHEN EXISTS (SELECT 1 FROM operational_alert_occurrence WHERE alert_id = NEW.alert_id) BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_EVALUATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS operational_alert_evaluation (
  evaluation_id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES operational_alert_occurrence(alert_id),
  alert_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  current_state TEXT NOT NULL CHECK (current_state IN ('ACTIVE','CLEARED')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','HIGH','CRITICAL')),
  safe_reason_code TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  signal_json TEXT NOT NULL,
  UNIQUE (alert_type, source_id)
)`;
const ALERT_EVALUATION_ALERT_INDEX_SQL = "CREATE INDEX IF NOT EXISTS operational_alert_evaluation_alert_idx ON operational_alert_evaluation(alert_id, evaluated_at)";
const ALERT_EVALUATION_UPDATE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_evaluation_no_update BEFORE UPDATE ON operational_alert_evaluation BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_EVALUATION_DELETE_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_evaluation_no_delete BEFORE DELETE ON operational_alert_evaluation BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const ALERT_EVALUATION_INSERT_TRIGGER_SQL = "CREATE TRIGGER IF NOT EXISTS operational_alert_evaluation_no_replace BEFORE INSERT ON operational_alert_evaluation WHEN EXISTS (SELECT 1 FROM operational_alert_evaluation WHERE evaluation_id = NEW.evaluation_id) BEGIN SELECT RAISE(ABORT, 'append-only'); END";
const SCHEMA_OBJECTS = Object.freeze({
  operational_telemetry: TABLE_SQL,
  operational_telemetry_component_idx: COMPONENT_INDEX_SQL,
  operational_telemetry_resource_idx: RESOURCE_INDEX_SQL,
  operational_telemetry_correlation_idx: CORRELATION_INDEX_SQL,
  operational_telemetry_no_update: UPDATE_TRIGGER_SQL,
  operational_telemetry_no_delete: DELETE_TRIGGER_SQL,
  operational_telemetry_no_replace: INSERT_TRIGGER_SQL,
  operational_status_snapshot: STATUS_TABLE_SQL,
  operational_status_component_idx: STATUS_COMPONENT_INDEX_SQL,
  operational_status_resource_idx: STATUS_RESOURCE_INDEX_SQL,
  operational_status_no_update: STATUS_UPDATE_TRIGGER_SQL,
  operational_status_no_delete: STATUS_DELETE_TRIGGER_SQL,
  operational_status_no_replace: STATUS_INSERT_TRIGGER_SQL,
  operational_evidence_binding: BINDING_TABLE_SQL,
  operational_evidence_binding_scope_idx: BINDING_SCOPE_INDEX_SQL,
  operational_evidence_binding_no_update: BINDING_UPDATE_TRIGGER_SQL,
  operational_evidence_binding_no_delete: BINDING_DELETE_TRIGGER_SQL,
  operational_evidence_binding_no_replace: BINDING_INSERT_TRIGGER_SQL,
  operational_alert_occurrence: ALERT_OCCURRENCE_TABLE_SQL,
  operational_alert_condition_idx: ALERT_OCCURRENCE_CONDITION_INDEX_SQL,
  operational_alert_scope_idx: ALERT_OCCURRENCE_SCOPE_INDEX_SQL,
  operational_alert_occurrence_no_update: ALERT_OCCURRENCE_UPDATE_TRIGGER_SQL,
  operational_alert_occurrence_no_delete: ALERT_OCCURRENCE_DELETE_TRIGGER_SQL,
  operational_alert_occurrence_no_replace: ALERT_OCCURRENCE_INSERT_TRIGGER_SQL,
  operational_alert_evaluation: ALERT_EVALUATION_TABLE_SQL,
  operational_alert_evaluation_alert_idx: ALERT_EVALUATION_ALERT_INDEX_SQL,
  operational_alert_evaluation_no_update: ALERT_EVALUATION_UPDATE_TRIGGER_SQL,
  operational_alert_evaluation_no_delete: ALERT_EVALUATION_DELETE_TRIGGER_SQL,
  operational_alert_evaluation_no_replace: ALERT_EVALUATION_INSERT_TRIGGER_SQL,
});
const SCHEMA = `${Object.values(SCHEMA_OBJECTS).join(";\n")};`;
