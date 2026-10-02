import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { existsSync } from "node:fs";

import { canonicalAiSchemaId, validateAdvisoryResult } from "./advisory-ai-service.js";
import {
  AdvisoryPersistenceError,
  isSafeAdvisoryEvidenceRef,
  isSafeAdvisoryPrincipalProvenance,
  type AcceptedAdvisoryRecord,
  type AdvisoryPersistence,
  type AdvisoryPromptRecord,
} from "./advisory-runtime-contracts.js";

export interface DurableAdvisoryStoreOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: 5000;
  readonly beforeIdempotencyWrite?: () => void;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
}

export class DurableAdvisoryStore implements AdvisoryPersistence {
  readonly #database: DatabaseSync;
  readonly #beforeIdempotencyWrite: (() => void) | undefined;
  #closed = false;

  public constructor(options: DurableAdvisoryStoreOptions) {
    const schemaMode = options.schemaMode ?? "INITIALIZE";
    if (!isFileDatabasePath(options.databasePath) || (options.busyTimeoutMilliseconds !== undefined && options.busyTimeoutMilliseconds !== 5000)
      || (schemaMode !== "INITIALIZE" && schemaMode !== "REQUIRE_EXISTING")
      || (schemaMode === "REQUIRE_EXISTING" && !existsSync(options.databasePath))) {
      throw failure("PERSISTENCE_INPUT_INVALID", "Durable Advisory database configuration is invalid.");
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec(`PRAGMA busy_timeout = ${options.busyTimeoutMilliseconds ?? 5000}`);
      if (schemaMode === "INITIALIZE") {
        database.exec("PRAGMA journal_mode = WAL");
        database.exec("PRAGMA synchronous = FULL");
        database.exec(SCHEMA);
      }
      const integrity = database.prepare("PRAGMA integrity_check").get();
      if (integrity?.["integrity_check"] !== "ok") throw new Error("integrity check failed");
      this.#database = database;
      this.#beforeIdempotencyWrite = options.beforeIdempotencyWrite;
      try { this.validateStoredState(); } catch { throw new Error("stored Advisory validation failed"); }
    } catch (error) {
      try { database?.close(); } catch { /* preserve fail-closed startup */ }
      if (error instanceof AdvisoryPersistenceError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE", "Durable Advisory persistence is unavailable.");
    }
  }

  public registerPrompt(record: AdvisoryPromptRecord): AdvisoryPromptRecord {
    this.assertOpen();
    validatePrompt(record);
    const existing = this.findPrompt(record.promptId, record.promptVersion);
    if (existing !== undefined) {
      if (canonicalJson(existing) !== canonicalJson(record)) throw failure("PROMPT_IDENTITY_CONFLICT", "Prompt identity is immutable.");
      return existing;
    }
    try {
      this.#database.prepare("INSERT INTO advisory_prompts (prompt_id, prompt_version, capability_id, schema_id, content_fingerprint, status, created_at, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(record.promptId, record.promptVersion, record.capabilityId, record.schemaId, record.contentFingerprint, record.status, record.createdAt, canonicalJson(record));
      return immutable(record);
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  public findPrompt(promptId: string, promptVersion: string): AdvisoryPromptRecord | undefined {
    this.assertOpen();
    validateText(promptId, promptVersion);
    const row = this.#database.prepare("SELECT payload_json FROM advisory_prompts WHERE prompt_id = ? AND prompt_version = ?").get(promptId, promptVersion);
    return row === undefined ? undefined : immutable(validatePrompt(parse<AdvisoryPromptRecord>(text(row["payload_json"]))));
  }

  public findReplay(tenantId: string, scopeRef: string, idempotencyKey: string, executionFingerprint: string): AcceptedAdvisoryRecord | undefined {
    this.assertOpen();
    validateText(tenantId, scopeRef, idempotencyKey, executionFingerprint);
    const row = this.#database.prepare("SELECT execution_fingerprint, advisory_id FROM advisory_idempotency WHERE tenant_id = ? AND scope_ref = ? AND idempotency_key = ?")
      .get(tenantId, scopeRef, idempotencyKey);
    if (row === undefined) return undefined;
    if (text(row["execution_fingerprint"]) !== executionFingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Idempotency key is already bound to different input.");
    const advisory = this.findAdvisory(tenantId, scopeRef, text(row["advisory_id"]));
    if (advisory === undefined) throw failure("PERSISTENCE_UNAVAILABLE", "Stored idempotency evidence is incomplete.");
    return advisory;
  }

  public findAdvisory(tenantId: string, scopeRef: string, advisoryId: string): AcceptedAdvisoryRecord | undefined {
    this.assertOpen();
    validateText(tenantId, scopeRef, advisoryId);
    const row = this.#database.prepare("SELECT payload_json FROM advisory_records WHERE tenant_id = ? AND scope_ref = ? AND advisory_id = ?")
      .get(tenantId, scopeRef, advisoryId);
    if (row === undefined) return undefined;
    return immutable(validateAcceptedRecord(parse<AcceptedAdvisoryRecord>(text(row["payload_json"]))));
  }

  public recordAccepted(record: AcceptedAdvisoryRecord, idempotencyKey: string): AcceptedAdvisoryRecord {
    this.assertOpen();
    validateText(idempotencyKey);
    const valid = validateAcceptedRecord(record);
    const replay = this.findReplay(valid.tenantId, valid.scopeRef, idempotencyKey, valid.executionFingerprint);
    if (replay !== undefined) return replay;
    const prompt = this.findPrompt(valid.promptId, valid.promptVersion);
    if (prompt?.status !== "ACTIVE" || prompt.capabilityId !== valid.capabilityId || prompt.schemaId !== valid.schemaId) {
      throw failure("PROMPT_SCHEMA_MISMATCH", "Accepted Advisory must bind an active compatible prompt.");
    }
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      const existing = this.#database.prepare("SELECT payload_json FROM advisory_records WHERE advisory_id = ?").get(valid.advisoryId);
      if (existing === undefined) {
        this.#database.prepare("INSERT INTO advisory_records (advisory_id, tenant_id, scope_ref, capability_id, schema_id, execution_fingerprint, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(valid.advisoryId, valid.tenantId, valid.scopeRef, valid.capabilityId, valid.schemaId, valid.executionFingerprint, canonicalJson(valid));
      } else if (canonicalJson(parse<AcceptedAdvisoryRecord>(text(existing["payload_json"]))) !== canonicalJson(valid)) {
        throw failure("ADVISORY_IDENTITY_CONFLICT", "Advisory identity is immutable.");
      }
      this.#beforeIdempotencyWrite?.();
      this.#database.prepare("INSERT INTO advisory_idempotency (tenant_id, scope_ref, idempotency_key, execution_fingerprint, advisory_id) VALUES (?, ?, ?, ?, ?)")
        .run(valid.tenantId, valid.scopeRef, idempotencyKey, valid.executionFingerprint, valid.advisoryId);
      this.#database.exec("COMMIT");
      return immutable(valid);
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* original transaction failure remains authoritative */ }
      throw mapStorageError(error);
    }
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }

  private assertOpen(): void {
    if (this.#closed) throw failure("PERSISTENCE_UNAVAILABLE", "Durable Advisory persistence is closed.");
  }

  private validateStoredState(): void {
    for (const row of this.#database.prepare("SELECT prompt_id, prompt_version, capability_id, schema_id, content_fingerprint, status, created_at, payload_json FROM advisory_prompts").all()) {
      const prompt = validatePrompt(parse<AdvisoryPromptRecord>(text(row["payload_json"])));
      if (prompt.promptId !== text(row["prompt_id"]) || prompt.promptVersion !== text(row["prompt_version"]) || prompt.capabilityId !== text(row["capability_id"]) || prompt.schemaId !== text(row["schema_id"]) || prompt.contentFingerprint !== text(row["content_fingerprint"]) || prompt.status !== text(row["status"]) || prompt.createdAt !== text(row["created_at"])) throw failure("PERSISTENCE_UNAVAILABLE", "Stored prompt identity is inconsistent.");
    }
    for (const row of this.#database.prepare("SELECT advisory_id, tenant_id, scope_ref, capability_id, schema_id, execution_fingerprint, payload_json FROM advisory_records").all()) {
      const record = validateAcceptedRecord(parse<AcceptedAdvisoryRecord>(text(row["payload_json"])));
      if (record.advisoryId !== text(row["advisory_id"]) || record.tenantId !== text(row["tenant_id"]) || record.scopeRef !== text(row["scope_ref"]) || record.capabilityId !== text(row["capability_id"]) || record.schemaId !== text(row["schema_id"]) || record.executionFingerprint !== text(row["execution_fingerprint"])) throw failure("PERSISTENCE_UNAVAILABLE", "Stored Advisory identity is inconsistent.");
    }
    const invalidBinding = this.#database.prepare("SELECT COUNT(*) AS count FROM advisory_idempotency AS i LEFT JOIN advisory_records AS a ON a.advisory_id = i.advisory_id WHERE a.advisory_id IS NULL OR a.tenant_id <> i.tenant_id OR a.scope_ref <> i.scope_ref OR a.execution_fingerprint <> i.execution_fingerprint").get();
    if (Number(invalidBinding?.["count"] ?? 0) !== 0) throw failure("PERSISTENCE_UNAVAILABLE", "Stored idempotency evidence is incomplete.");
  }
}

function validatePrompt(record: AdvisoryPromptRecord): AdvisoryPromptRecord {
  if (!hasExactKeys(record, ["promptId", "promptVersion", "capabilityId", "schemaId", "contentFingerprint", "status", "createdAt"])) throw failure("PERSISTENCE_INPUT_INVALID", "Prompt metadata is invalid.");
  validateText(record.promptId, record.promptVersion, record.contentFingerprint, record.createdAt);
  if (!(["ACTIVE", "RETIRED"] as const).includes(record.status)) throw failure("PERSISTENCE_INPUT_INVALID", "Prompt status is invalid.");
  if (record.schemaId !== canonicalAiSchemaId(record.capabilityId)) throw failure("PROMPT_SCHEMA_MISMATCH", "Prompt capability and schema do not match.");
  return record;
}

function validateAcceptedRecord(record: AcceptedAdvisoryRecord): AcceptedAdvisoryRecord {
  if (!hasExactKeys(record, ["advisoryId", "tenantId", "scopeRef", "capabilityId", "schemaId", "inputFingerprint", "evidenceFingerprint", "inputClassifications", "promptId", "promptVersion", "adapterVersion", "executionFingerprint", "envelope", "validationResult", "generatedAt", "reviewRequired", "reviewEvidenceRef", "authority"], ["reviewedAt", "reviewerRef", "capabilityVersion", "correlationId", "initiatingPrincipalEvidenceRef", "initiatingPrincipalProvenance"])) throw failure("PERSISTENCE_INPUT_INVALID", "Accepted Advisory envelope is invalid.");
  validateText(record.advisoryId, record.tenantId, record.scopeRef, record.inputFingerprint, record.evidenceFingerprint, record.promptId, record.promptVersion, record.adapterVersion, record.executionFingerprint, record.generatedAt);
  if (record.authority !== "ADVISORY" || record.schemaId !== canonicalAiSchemaId(record.capabilityId) || record.envelope.schemaId !== record.schemaId || record.envelope.capabilityId !== record.capabilityId) {
    throw failure("PERSISTENCE_INPUT_INVALID", "Accepted Advisory binding is invalid.");
  }
  if (!Array.isArray(record.inputClassifications) || record.inputClassifications.length === 0) throw failure("PERSISTENCE_INPUT_INVALID", "Accepted Advisory classification evidence is invalid.");
  for (const value of [record.capabilityVersion, record.correlationId, record.initiatingPrincipalEvidenceRef]) if (value !== undefined) validateText(value);
  if (record.initiatingPrincipalEvidenceRef !== undefined && !isSafeAdvisoryEvidenceRef(record.initiatingPrincipalEvidenceRef)) throw failure("PERSISTENCE_INPUT_INVALID", "Principal evidence reference is invalid.");
  if (record.initiatingPrincipalProvenance !== undefined && !isSafeAdvisoryPrincipalProvenance(record.initiatingPrincipalProvenance)) throw failure("PERSISTENCE_INPUT_INVALID", "Principal provenance is invalid.");
  const validation = validateAdvisoryResult({ expectedCapabilityId: record.capabilityId, expectedSubject: record.envelope.subjectRef, inputClassifications: record.inputClassifications, result: record.envelope });
  if (validation.status !== "VALID" || record.validationResult.status !== "VALID" || canonicalJson(validation) !== canonicalJson(record.validationResult)) {
    throw failure("PERSISTENCE_INPUT_INVALID", "Unvalidated Advisory cannot be persisted as accepted truth.");
  }
  if (record.reviewRequired !== true || record.reviewEvidenceRef === undefined || record.reviewEvidenceRef.trim().length === 0) throw failure("PERSISTENCE_INPUT_INVALID", "Reviewer evidence binding is required.");
  return record;
}

function hasExactKeys(value: object, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

function isFileDatabasePath(value: string): boolean { return typeof value === "string" && value.trim().length > 0 && value !== ":memory:" && !value.startsWith("file::memory:"); }
function validateText(...values: readonly string[]): void { if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) throw failure("PERSISTENCE_INPUT_INVALID", "Persistence input is invalid."); }
function failure(code: ConstructorParameters<typeof AdvisoryPersistenceError>[0], message: string): AdvisoryPersistenceError { return new AdvisoryPersistenceError(code, message); }
function parse<T>(value: string): T { return JSON.parse(value) as T; }
function text(value: SQLOutputValue | undefined): string { if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE", "Stored Advisory data is invalid."); return value; }
function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`; return JSON.stringify(value); }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function mapStorageError(error: unknown): AdvisoryPersistenceError { return error instanceof AdvisoryPersistenceError ? error : failure("PERSISTENCE_UNAVAILABLE", "Durable Advisory persistence is unavailable."); }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS advisory_prompts (
  prompt_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  capability_id TEXT NOT NULL CHECK(capability_id IN ('AI-001','AI-002','AI-003','AI-004','AI-005','AI-006','AI-007')),
  schema_id TEXT NOT NULL,
  content_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','RETIRED')),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  PRIMARY KEY(prompt_id, prompt_version)
);
CREATE TRIGGER IF NOT EXISTS advisory_prompts_no_update BEFORE UPDATE ON advisory_prompts BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS advisory_prompts_no_delete BEFORE DELETE ON advisory_prompts BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TABLE IF NOT EXISTS advisory_records (
  advisory_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  capability_id TEXT NOT NULL CHECK(capability_id IN ('AI-001','AI-002','AI-003','AI-004','AI-005','AI-006','AI-007')),
  schema_id TEXT NOT NULL,
  execution_fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TRIGGER IF NOT EXISTS advisory_records_no_update BEFORE UPDATE ON advisory_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS advisory_records_no_delete BEFORE DELETE ON advisory_records BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TABLE IF NOT EXISTS advisory_idempotency (
  tenant_id TEXT NOT NULL,
  scope_ref TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  execution_fingerprint TEXT NOT NULL,
  advisory_id TEXT NOT NULL REFERENCES advisory_records(advisory_id),
  PRIMARY KEY(tenant_id, scope_ref, idempotency_key)
);
CREATE TRIGGER IF NOT EXISTS advisory_idempotency_no_update BEFORE UPDATE ON advisory_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS advisory_idempotency_no_delete BEFORE DELETE ON advisory_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;

export { validatePrompt as validateAdvisoryPromptRecord, validateAcceptedRecord as validateAcceptedAdvisoryRecord, canonicalJson as canonicalAdvisoryJson, immutable as immutableAdvisoryRecord };
