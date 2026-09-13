import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import type { AuditEvent } from "../../../packages/security-contracts/src/index.js";

export type AuditVisibilityBinding =
  | Readonly<{ kind: "TENANT_BOUND"; tenantId: string; scopeRef: string }>
  | Readonly<{ kind: "SYSTEM_BOUND"; scopeRef: "system:property-master" }>;

export interface DurableMaterializedAuditEvent extends AuditEvent {
  readonly sourceDomain: string;
  readonly auditIntentId: string;
  readonly aggregateId: string;
  readonly mutationIdentity: string;
  readonly visibility: AuditVisibilityBinding;
  readonly materializedAt: string;
  readonly evidenceRefs: readonly string[];
}

export type DurableAuditEventStoreErrorCode =
  | "MATERIALIZATION_IDENTITY_CONFLICT"
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_UNAVAILABLE";

export class DurableAuditEventStoreError extends Error {
  public constructor(public readonly code: DurableAuditEventStoreErrorCode) {
    super(code);
    this.name = "DurableAuditEventStoreError";
  }
}

export interface DurableAuditEventStoreOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: number;
  readonly beforeCommit?: () => void;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS api016_audit_events (
  event_id TEXT PRIMARY KEY,
  source_domain TEXT NOT NULL,
  audit_intent_id TEXT NOT NULL,
  intent_fingerprint TEXT NOT NULL,
  tenant_id TEXT,
  scope_ref TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  materialized_at TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE(source_domain, audit_intent_id)
);
CREATE TRIGGER IF NOT EXISTS api016_audit_events_no_update BEFORE UPDATE ON api016_audit_events BEGIN SELECT RAISE(ABORT, 'append-only audit event'); END;
CREATE TRIGGER IF NOT EXISTS api016_audit_events_no_delete BEFORE DELETE ON api016_audit_events BEGIN SELECT RAISE(ABORT, 'append-only audit event'); END;
`;

export class DurableAuditEventStore {
  readonly #database: DatabaseSync;
  readonly #beforeCommit: (() => void) | undefined;
  #closed = false;

  public constructor(options: DurableAuditEventStoreOptions) {
    const timeout = options.busyTimeoutMilliseconds ?? 5000;
    if (!validPath(options.databasePath) || !Number.isInteger(timeout) || timeout < 1 || timeout > 60_000) throw failure("PERSISTENCE_UNAVAILABLE");
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = FULL");
      database.exec(`PRAGMA busy_timeout = ${String(timeout)}`);
      database.exec(SCHEMA);
      assertSchema(database);
      this.#database = database;
      this.#beforeCommit = options.beforeCommit;
    } catch {
      try { database?.close(); } catch { /* preserve fail-closed startup */ }
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public append(input: Readonly<{ fingerprint: string; event: DurableMaterializedAuditEvent }>): Readonly<{ status: "MATERIALIZED" | "REPLAYED"; event: DurableMaterializedAuditEvent }> {
    this.#open();
    validateStoredInput(input);
    let transaction = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      transaction = true;
      const prior = this.#database.prepare("SELECT intent_fingerprint, payload_json FROM api016_audit_events WHERE source_domain = ? AND audit_intent_id = ?").get(input.event.sourceDomain, input.event.auditIntentId);
      if (prior !== undefined) {
        const event = decode(required(prior["payload_json"]));
        if (prior["intent_fingerprint"] !== input.fingerprint) throw failure("MATERIALIZATION_IDENTITY_CONFLICT");
        this.#database.exec("COMMIT");
        transaction = false;
        return Object.freeze({ status: "REPLAYED", event });
      }
      const tenantId = input.event.visibility.kind === "TENANT_BOUND" ? input.event.visibility.tenantId : null;
      this.#database.prepare("INSERT INTO api016_audit_events (event_id, source_domain, audit_intent_id, intent_fingerprint, tenant_id, scope_ref, occurred_at, materialized_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(input.event.id, input.event.sourceDomain, input.event.auditIntentId, input.fingerprint, tenantId, input.event.visibility.scopeRef, input.event.occurredAt, input.event.materializedAt, JSON.stringify(input.event));
      this.#beforeCommit?.();
      this.#database.exec("COMMIT");
      transaction = false;
      return Object.freeze({ status: "MATERIALIZED", event: snapshot(input.event) });
    } catch (error) {
      if (transaction) try { this.#database.exec("ROLLBACK"); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
      if (error instanceof DurableAuditEventStoreError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public readByIntentId(input: Readonly<{ sourceDomain: string; intentId: string }>): DurableMaterializedAuditEvent | undefined {
    this.#open();
    if (!safeText(input.sourceDomain) || !safeText(input.intentId)) return undefined;
    try {
      const row = this.#database.prepare("SELECT payload_json FROM api016_audit_events WHERE source_domain = ? AND audit_intent_id = ?").get(input.sourceDomain, input.intentId);
      return row === undefined ? undefined : decode(required(row["payload_json"]));
    } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  public listAll(): readonly DurableMaterializedAuditEvent[] {
    this.#open();
    try { return Object.freeze(this.#database.prepare("SELECT payload_json FROM api016_audit_events ORDER BY occurred_at, source_domain, audit_intent_id").all().map((row) => decode(required(row["payload_json"])))); }
    catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#database.close(); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  #open(): void { if (this.#closed) throw failure("PERSISTENCE_UNAVAILABLE"); }
}

function validateStoredInput(input: Readonly<{ fingerprint: string; event: DurableMaterializedAuditEvent }>): void {
  if (!safeText(input.fingerprint) || !safeText(input.event.id) || !safeText(input.event.sourceDomain) || !safeText(input.event.auditIntentId)
    || !safeText(input.event.aggregateId) || !safeText(input.event.mutationIdentity) || !instant(input.event.occurredAt) || !instant(input.event.materializedAt)) throw failure("PERSISTENCE_INPUT_INVALID");
}

function assertSchema(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(api016_audit_events)").all();
  const table = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'api016_audit_events'").get();
  const triggers = database.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'api016_audit_events' ORDER BY name").all().map((row) => row["name"]);
  const sql = typeof table?.["sql"] === "string" ? table["sql"].replace(/\s+/gu, " ").toUpperCase() : "";
  const requiredFragments = ["EVENT_ID TEXT PRIMARY KEY", "SOURCE_DOMAIN TEXT NOT NULL", "AUDIT_INTENT_ID TEXT NOT NULL", "INTENT_FINGERPRINT TEXT NOT NULL", "SCOPE_REF TEXT NOT NULL", "OCCURRED_AT TEXT NOT NULL", "MATERIALIZED_AT TEXT NOT NULL", "PAYLOAD_JSON TEXT NOT NULL", "UNIQUE(SOURCE_DOMAIN, AUDIT_INTENT_ID)"];
  if (columns.length !== 9 || requiredFragments.some((fragment) => !sql.includes(fragment)) || triggers.length !== 2
    || triggers[0] !== "api016_audit_events_no_delete" || triggers[1] !== "api016_audit_events_no_update") throw failure("PERSISTENCE_UNAVAILABLE");
}

function decode(value: SQLOutputValue): DurableMaterializedAuditEvent {
  if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE");
  try { return snapshot(JSON.parse(value) as DurableMaterializedAuditEvent); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
}

function snapshot<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) deepFreeze(nested);
  Object.freeze(value);
}

function validPath(value: string): boolean { return safeText(value) && isAbsolute(value); }
function safeText(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value); }
function instant(value: unknown): value is string { return safeText(value) && !Number.isNaN(Date.parse(value)); }
function required(value: SQLOutputValue | undefined): SQLOutputValue { if (value === undefined) throw failure("PERSISTENCE_UNAVAILABLE"); return value; }
function failure(code: DurableAuditEventStoreErrorCode): DurableAuditEventStoreError { return new DurableAuditEventStoreError(code); }
