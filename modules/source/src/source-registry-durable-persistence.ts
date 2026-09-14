import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { isDeepStrictEqual } from "node:util";

import {
  validateEnrichedAuditIntentV2,
  type EnrichedAuditIntentV2,
} from "../../audit/src/enriched-audit-intent-contract.js";
import type { SourcePolicy } from "./source-registry-service.js";

export interface TenantBoundSourcePolicy extends SourcePolicy {
  readonly tenantId: string;
}

export type SourceRegistryAuditIntent = EnrichedAuditIntentV2<"SOURCE_REGISTRY">;

export interface LegacySourceRegistryAuditIntentV1 {
  readonly intentId: string;
  readonly domainOwner: "SOURCE_REGISTRY";
  readonly aggregateId: string;
  readonly mutationIdentity: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly classificationRef: string;
  readonly committedAt: string;
  readonly evidenceRefs: readonly string[];
}

export type StoredSourceRegistryAuditIntent = SourceRegistryAuditIntent | LegacySourceRegistryAuditIntentV1;

export type SourceRegistryPersistenceErrorCode =
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_UNAVAILABLE"
  | "RECORD_ALREADY_EXISTS";

export class SourceRegistryPersistenceError extends Error {
  public constructor(public readonly code: SourceRegistryPersistenceErrorCode) {
    super(code);
    this.name = "SourceRegistryPersistenceError";
  }
}

export interface DurableSourceRegistryStoreOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: number;
  readonly beforeAuditIntentWrite?: () => void;
}

export interface CreateTenantBoundSourcePolicyInput {
  readonly record: TenantBoundSourcePolicy;
  readonly commandId: string;
  readonly commandFingerprint: string;
  readonly auditIntent: SourceRegistryAuditIntent;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS source_registry_policies (
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  policy_version INTEGER NOT NULL CHECK(policy_version >= 1),
  payload_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, source_id)
);
CREATE TABLE IF NOT EXISTS source_registry_commands (
  tenant_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  source_id TEXT NOT NULL,
  PRIMARY KEY (tenant_id, command_id),
  FOREIGN KEY (tenant_id, source_id) REFERENCES source_registry_policies(tenant_id, source_id)
);
CREATE TABLE IF NOT EXISTS source_registry_history (tenant_id TEXT NOT NULL, source_id TEXT NOT NULL, policy_version INTEGER NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY (tenant_id, source_id, policy_version));
CREATE TABLE IF NOT EXISTS source_registry_audit_intents (
  intent_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  mutation_identity TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  FOREIGN KEY (tenant_id, aggregate_id) REFERENCES source_registry_policies(tenant_id, source_id)
);
CREATE TRIGGER IF NOT EXISTS source_registry_commands_no_update BEFORE UPDATE ON source_registry_commands BEGIN SELECT RAISE(ABORT, 'append-only command'); END;
CREATE TRIGGER IF NOT EXISTS source_registry_commands_no_delete BEFORE DELETE ON source_registry_commands BEGIN SELECT RAISE(ABORT, 'append-only command'); END;
CREATE TRIGGER IF NOT EXISTS source_registry_audit_intents_no_update BEFORE UPDATE ON source_registry_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only audit intent'); END;
CREATE TRIGGER IF NOT EXISTS source_registry_audit_intents_no_delete BEFORE DELETE ON source_registry_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only audit intent'); END;
CREATE TRIGGER IF NOT EXISTS source_registry_history_no_update BEFORE UPDATE ON source_registry_history BEGIN SELECT RAISE(ABORT, 'append-only history'); END;
CREATE TRIGGER IF NOT EXISTS source_registry_history_no_delete BEFORE DELETE ON source_registry_history BEGIN SELECT RAISE(ABORT, 'append-only history'); END;
`;

export class DurableSourceRegistryStore {
  readonly #database: DatabaseSync;
  readonly #beforeAuditIntentWrite: (() => void) | undefined;
  #closed = false;

  public constructor(options: DurableSourceRegistryStoreOptions) {
    const busyTimeout = options.busyTimeoutMilliseconds ?? 5000;
    if (!validDatabasePath(options.databasePath) || !Number.isInteger(busyTimeout) || busyTimeout < 1 || busyTimeout > 60_000) {
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = FULL");
      database.exec(`PRAGMA busy_timeout = ${String(busyTimeout)}`);
      database.exec(SCHEMA);
      assertHealthy(database);
      this.#database = database;
      this.#beforeAuditIntentWrite = options.beforeAuditIntentWrite;
    } catch {
      try { database?.close(); } catch { /* keep startup failure safe */ }
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public create(input: CreateTenantBoundSourcePolicyInput): Readonly<{ status: "STORED" | "REPLAYED"; record: TenantBoundSourcePolicy }> {
    this.#assertOpen();
    const { record, auditIntent } = validateCreate(input);
    let open = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      open = true;
      const prior = this.#database.prepare(
        "SELECT fingerprint, source_id FROM source_registry_commands WHERE tenant_id = ? AND command_id = ?",
      ).get(record.tenantId, input.commandId);
      if (prior !== undefined) {
        const stored = this.#readRequired(record.tenantId, record.id);
        const storedIntentRow = this.#database.prepare(
          "SELECT payload_json FROM source_registry_audit_intents WHERE tenant_id = ? AND aggregate_id = ? AND mutation_identity = ?",
        ).get(record.tenantId, record.id, input.commandId);
        if (storedIntentRow === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
        const storedIntent = decodeIntent(requiredValue(storedIntentRow["payload_json"]));
        if (prior["fingerprint"] !== input.commandFingerprint || prior["source_id"] !== record.id
          || !isDeepStrictEqual(stored, record) || !isDeepStrictEqual(storedIntent, auditIntent)) {
          throw failure("IDEMPOTENCY_CONFLICT");
        }
        this.#database.exec("COMMIT");
        open = false;
        return Object.freeze({ status: "REPLAYED", record: stored });
      }
      if (this.#read(record.tenantId, record.id) !== undefined) {
        throw failure("RECORD_ALREADY_EXISTS");
      }
      this.#database.prepare(
        "INSERT INTO source_registry_policies (tenant_id, source_id, policy_version, payload_json) VALUES (?, ?, ?, ?)",
      ).run(record.tenantId, record.id, record.policyVersion, JSON.stringify(record));
      this.#database.prepare("INSERT INTO source_registry_history (tenant_id, source_id, policy_version, payload_json) VALUES (?, ?, ?, ?)").run(record.tenantId, record.id, record.policyVersion, JSON.stringify(record));
      this.#database.prepare(
        "INSERT INTO source_registry_commands (tenant_id, command_id, fingerprint, source_id) VALUES (?, ?, ?, ?)",
      ).run(record.tenantId, input.commandId, input.commandFingerprint, record.id);
      this.#beforeAuditIntentWrite?.();
      this.#database.prepare(
        "INSERT INTO source_registry_audit_intents (intent_id, tenant_id, aggregate_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)",
      ).run(auditIntent.intentId, record.tenantId, auditIntent.aggregateId, auditIntent.mutationIdentity, JSON.stringify(auditIntent));
      this.#database.exec("COMMIT");
      open = false;
      return Object.freeze({ status: "STORED", record });
    } catch (error) {
      if (open) {
        try { this.#database.exec("ROLLBACK"); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
      }
      if (error instanceof SourceRegistryPersistenceError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public read(input: Readonly<{ tenantId: string; sourceId: string }>): TenantBoundSourcePolicy | undefined {
    this.#assertOpen();
    if (!safeText(input.tenantId) || !safeText(input.sourceId)) return undefined;
    try { return this.#read(input.tenantId, input.sourceId); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  public listHistory(input: Readonly<{ tenantId: string; sourceId: string }>): readonly TenantBoundSourcePolicy[] {
    this.#assertOpen();
    if (!safeText(input.tenantId) || !safeText(input.sourceId)) return Object.freeze([]);
    try { return Object.freeze(this.#database.prepare("SELECT payload_json FROM source_registry_history WHERE tenant_id = ? AND source_id = ? ORDER BY policy_version").all(input.tenantId, input.sourceId).map((row) => decodePolicy(requiredValue(row["payload_json"])))); }
    catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  public listAuditIntents(input: Readonly<{ tenantId: string }>): readonly StoredSourceRegistryAuditIntent[] {
    this.#assertOpen();
    if (!safeText(input.tenantId)) return Object.freeze([]);
    try {
      return Object.freeze(this.#database.prepare(
        "SELECT payload_json FROM source_registry_audit_intents WHERE tenant_id = ? ORDER BY intent_id",
      ).all(input.tenantId).map((row) => decodeIntent(requiredValue(row["payload_json"]))));
    } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#database.close(); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }

  #read(tenantId: string, sourceId: string): TenantBoundSourcePolicy | undefined {
    const row = this.#database.prepare(
      "SELECT tenant_id, source_id, policy_version, payload_json FROM source_registry_policies WHERE tenant_id = ? AND source_id = ?",
    ).get(tenantId, sourceId);
    if (row === undefined) return undefined;
    const record = decodePolicy(requiredValue(row["payload_json"]));
    if (record.tenantId !== row["tenant_id"] || record.id !== row["source_id"] || record.policyVersion !== Number(row["policy_version"])) {
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
    return record;
  }

  #readRequired(tenantId: string, sourceId: string): TenantBoundSourcePolicy {
    const record = this.#read(tenantId, sourceId);
    if (record === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
    return record;
  }

  #assertOpen(): void {
    if (this.#closed) throw failure("PERSISTENCE_UNAVAILABLE");
  }
}

function validateCreate(input: CreateTenantBoundSourcePolicyInput): Readonly<{
  record: TenantBoundSourcePolicy;
  auditIntent: SourceRegistryAuditIntent;
}> {
  validatePolicy(input.record);
  const record = clonePolicy(jsonRepresentation(input.record));
  let auditIntent: SourceRegistryAuditIntent;
  try {
    const validated = validateEnrichedAuditIntentV2(input.auditIntent, "SOURCE_REGISTRY");
    auditIntent = validateEnrichedAuditIntentV2(jsonRepresentation(validated), "SOURCE_REGISTRY");
  } catch {
    throw failure("PERSISTENCE_INPUT_INVALID");
  }
  const principalId = auditIntent.principalProvenance.kind === "TRUSTED_SNAPSHOT"
    ? auditIntent.principalProvenance.principal.id
    : auditIntent.principalProvenance.principalId;
  if (!safeText(input.commandId) || !safeText(input.commandFingerprint)
    || record.policyVersion !== 1
    || auditIntent.aggregateId !== record.id
    || auditIntent.mutationIdentity !== input.commandId
    || auditIntent.target.id !== record.id
    || auditIntent.target.version !== record.policyVersion
    || auditIntent.visibility.kind !== "TENANT_BOUND"
    || auditIntent.visibility.tenantId !== record.tenantId
    || auditIntent.visibility.scopeRef !== `tenant:${record.tenantId}`
    || auditIntent.purpose !== "SOURCE_GOVERNANCE"
    || auditIntent.outcome !== "ACCEPTED"
    || auditIntent.decision !== "ALLOW"
    || auditIntent.classification !== record.classification
    || principalId !== record.proposedBy) {
    throw failure("PERSISTENCE_INPUT_INVALID");
  }
  return Object.freeze({ record, auditIntent });
}

function validatePolicy(value: unknown): asserts value is TenantBoundSourcePolicy {
  if (!plainObject(value)) throw failure("PERSISTENCE_INPUT_INVALID");
  const record = value as unknown as Record<string, unknown>;
  const keys = ["tenantId", "id", "name", "sourceType", "status", "policyVersion", "allowedMethods", "allowedPurposes", "classification", "proposedBy", "reviewedAt"];
  if (Object.keys(record).some((key) => !keys.includes(key))
    || !safeText(record["tenantId"]) || !safeText(record["id"]) || !safeText(record["name"])
    || !safeText(record["sourceType"]) || !["DRAFT", "UNDER_REVIEW", "ACTIVE", "PAUSED", "BLOCKED", "RETIRED"].includes(String(record["status"]))
    || !Number.isInteger(record["policyVersion"]) || Number(record["policyVersion"]) < 1
    || !safeTextArray(record["allowedMethods"]) || !safeTextArray(record["allowedPurposes"])
    || !safeText(record["classification"]) || !safeText(record["proposedBy"])
    || (record["reviewedAt"] !== undefined && !isoInstant(record["reviewedAt"]))) {
    throw failure("PERSISTENCE_INPUT_INVALID");
  }
}

function validateLegacyIntent(value: unknown): asserts value is LegacySourceRegistryAuditIntentV1 {
  if (!plainObject(value)) throw failure("PERSISTENCE_INPUT_INVALID");
  const record = value as unknown as Record<string, unknown>;
  const keys = ["intentId", "domainOwner", "aggregateId", "mutationIdentity", "actorId", "tenantId", "scopeRef", "classificationRef", "committedAt", "evidenceRefs"];
  if (Object.keys(record).length !== keys.length || Object.keys(record).some((key) => !keys.includes(key))
    || record["domainOwner"] !== "SOURCE_REGISTRY"
    || !safeText(record["intentId"]) || !safeText(record["aggregateId"]) || !safeText(record["mutationIdentity"])
    || !safeText(record["actorId"]) || !safeText(record["tenantId"]) || !safeText(record["scopeRef"])
    || !safeText(record["classificationRef"]) || !isoInstant(record["committedAt"]) || !safeEvidenceRefs(record["evidenceRefs"])) {
    throw failure("PERSISTENCE_INPUT_INVALID");
  }
}

function decodePolicy(value: SQLOutputValue): TenantBoundSourcePolicy {
  const parsed = parse(value);
  validatePolicy(parsed);
  return clonePolicy(parsed);
}

function decodeIntent(value: SQLOutputValue): StoredSourceRegistryAuditIntent {
  const parsed = parse(value);
  if (plainObject(parsed) && "auditIntentContractVersion" in parsed) {
    try { return validateEnrichedAuditIntentV2(parsed, "SOURCE_REGISTRY"); }
    catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
  }
  validateLegacyIntent(parsed);
  return cloneLegacyIntent(parsed);
}

function parse(value: SQLOutputValue): unknown {
  if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE");
  try { return JSON.parse(value); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
}

function requiredValue(value: SQLOutputValue | undefined): SQLOutputValue {
  if (value === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
  return value;
}

function clonePolicy(record: TenantBoundSourcePolicy): TenantBoundSourcePolicy {
  const copy = structuredClone(record);
  Object.freeze(copy.allowedMethods);
  Object.freeze(copy.allowedPurposes);
  return Object.freeze(copy);
}

function cloneLegacyIntent(record: LegacySourceRegistryAuditIntentV1): LegacySourceRegistryAuditIntentV1 {
  const copy = structuredClone(record);
  Object.freeze(copy.evidenceRefs);
  return Object.freeze(copy);
}

function jsonRepresentation<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function safeEvidenceRefs(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100
    && value.every(isSafeEvidenceRef);
}

function isSafeEvidenceRef(value: unknown): value is string {
  return typeof value === "string" && value.length <= 256
    && /^evidence:[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)*$/u.test(value)
    && !/(?:^|[:._-])(secret|token|password|authorization|bearer|api[-_]?key|prompt|reasoning|stack|sqlite|database|provider[-_]?payload)(?:$|[:._-])/iu.test(value);
}

function assertHealthy(database: DatabaseSync): void {
  if (database.prepare("PRAGMA integrity_check").get()?.["integrity_check"] !== "ok") throw failure("PERSISTENCE_UNAVAILABLE");
  assertSchema(database, SCHEMA);
}

function assertSchema(database: DatabaseSync, schema: string): void { compareCatalog(database, schema, () => failure("PERSISTENCE_UNAVAILABLE")); }
function compareCatalog(database: DatabaseSync, schema: string, failClosed: () => Error): void { const golden = new DatabaseSync(":memory:"); try { golden.exec(schema); const sql = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"; if (JSON.stringify(database.prepare(sql).all()) !== JSON.stringify(golden.prepare(sql).all())) throw failClosed(); } finally { golden.close(); } }

function validDatabasePath(value: string): boolean {
  return typeof value === "string" && value.length > 0 && isAbsolute(value) && value !== ":memory:" && !value.startsWith("file:");
}

function plainObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512 && !/[\r\n\0]/u.test(value);
}

function safeTextArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(safeText);
}

function isoInstant(value: unknown): value is string {
  return safeText(value) && !Number.isNaN(Date.parse(value));
}

function failure(code: SourceRegistryPersistenceErrorCode): SourceRegistryPersistenceError {
  return new SourceRegistryPersistenceError(code);
}
