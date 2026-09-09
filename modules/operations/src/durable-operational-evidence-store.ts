import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import {
  OperationalEvidenceError,
  immutableOperationalEvidence,
  validateOperationalCategory,
  validateOperationalReference,
  validateOperationalResourceReference,
  validateOperationalTelemetryRecord,
  type OperationalTelemetryRecord,
} from "./operational-telemetry-contracts.js";

export interface DurableOperationalEvidenceStoreOptions {
  readonly databasePath: string;
}

export interface OperationalEvidenceFilter {
  readonly component?: string;
  readonly resourceRef?: string;
  readonly correlationId?: string;
  readonly limit?: number;
}

export interface OperationalEvidenceStore {
  append(record: OperationalTelemetryRecord): OperationalTelemetryRecord;
  find(telemetryEventId: string): OperationalTelemetryRecord | undefined;
  list(filter?: OperationalEvidenceFilter): readonly OperationalTelemetryRecord[];
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

function validateFilter(filter: unknown): asserts filter is OperationalEvidenceFilter {
  if (typeof filter !== "object" || filter === null || Array.isArray(filter)
    || (Object.getPrototypeOf(filter) !== Object.prototype && Object.getPrototypeOf(filter) !== null)
    || Object.keys(filter).some((key) => !["component", "resourceRef", "correlationId", "limit"].includes(key))) {
    throw new OperationalEvidenceError("TELEMETRY_INPUT_INVALID", "Operational telemetry input is invalid.");
  }
}

function decode(row: Record<string, SQLOutputValue>): OperationalTelemetryRecord {
  const value = row["payload_json"];
  if (typeof value !== "string") throw unavailable();
  try { return validateOperationalTelemetryRecord(JSON.parse(value) as unknown); } catch { throw unavailable(); }
}

function text(value: SQLOutputValue | undefined): string {
  if (typeof value !== "string") throw unavailable();
  return value;
}

function nullableText(value: SQLOutputValue | undefined): string | null {
  if (value === null) return null;
  return text(value);
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
const SCHEMA_OBJECTS = Object.freeze({
  operational_telemetry: TABLE_SQL,
  operational_telemetry_component_idx: COMPONENT_INDEX_SQL,
  operational_telemetry_resource_idx: RESOURCE_INDEX_SQL,
  operational_telemetry_correlation_idx: CORRELATION_INDEX_SQL,
  operational_telemetry_no_update: UPDATE_TRIGGER_SQL,
  operational_telemetry_no_delete: DELETE_TRIGGER_SQL,
  operational_telemetry_no_replace: INSERT_TRIGGER_SQL,
});
const SCHEMA = `${Object.values(SCHEMA_OBJECTS).join(";\n")};`;
