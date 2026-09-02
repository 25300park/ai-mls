import { createHash } from "node:crypto";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import type {
  CreateRecoveryCaseInput,
  RecoveryAuthorizationBinding,
  RecoveryCaseRecord,
  RecoveryDispositionRecord,
  RecoveryFindingRecord,
  RecoveryOrchestrationStore,
  RecoveryOriginIdentity,
} from "./recovery-orchestration-contracts.js";
import { RecoveryStoreError } from "./recovery-orchestration-contracts.js";

type SqlRow = Record<string, SQLOutputValue>;

export class DurableRecoveryOrchestrationStore implements RecoveryOrchestrationStore {
  readonly #database: DatabaseSync;
  #closed = false;

  constructor(options: Readonly<{ databasePath: string }>) {
    if (!options.databasePath.trim() || options.databasePath === ":memory:") throw new Error("Durable recovery database path is required.");
    this.#database = new DatabaseSync(options.databasePath);
    try {
      this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
      this.#database.exec(SCHEMA);
      const integrity = this.#database.prepare("PRAGMA integrity_check").get()?.["integrity_check"];
      if (integrity !== "ok") throw new Error("Recovery database integrity check failed.");
    } catch (error) {
      this.#database.close();
      throw error;
    }
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }

  createCase(input: CreateRecoveryCaseInput): RecoveryCaseRecord {
    return this.#transaction(() => {
      if (input.parentRecoveryCaseId) {
        const parent = requiredCase(this.#database, input.parentRecoveryCaseId);
        if (parent.tenantId !== input.tenantId || parent.scopeRef !== input.scopeRef) throw new RecoveryStoreError("INVALID_STATE");
      }
      const recoveryCaseId = stableId("recovery-case", [input.tenantId, input.scopeRef, input.originDomain, canonicalJson(input.originIdentity), input.parentRecoveryCaseId ?? "root"]);
      try {
        this.#database.prepare(`INSERT INTO recovery_cases
          (recovery_case_id, resource_type, resource_id, origin_domain, origin_identity_json, tenant_id, scope_ref, parent_recovery_case_id, status, version, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 1, ?, ?)`)
          .run(recoveryCaseId, input.resourceType, input.resourceId, input.originDomain, canonicalJson(input.originIdentity), input.tenantId, input.scopeRef, input.parentRecoveryCaseId ?? null, input.createdBy, input.createdAt);
        insertEvidence(this.#database, "CASE", recoveryCaseId, input.evidenceRefs);
      } catch (error) {
        if (String(error).includes("UNIQUE constraint failed")) throw new RecoveryStoreError("DUPLICATE_ORIGIN");
        throw error;
      }
      return requiredCase(this.#database, recoveryCaseId);
    });
  }

  findCase(recoveryCaseId: string): RecoveryCaseRecord | undefined {
    this.#assertOpen();
    const row = this.#database.prepare("SELECT * FROM recovery_cases WHERE recovery_case_id = ?").get(recoveryCaseId);
    return row ? decodeCase(this.#database, row) : undefined;
  }

  recordFinding(input: Parameters<RecoveryOrchestrationStore["recordFinding"]>[0]): ReturnType<RecoveryOrchestrationStore["recordFinding"]> {
    return this.#transaction(() => {
      const replay = readIdempotency(this.#database, input.idempotencyKey, "RESOLVE_RECOVERY_CASE", input.fingerprint);
      if (replay) return Object.freeze({ replay: true, record: replay });
      const current = requiredCase(this.#database, input.recoveryCaseId);
      if (current.version !== input.expectedVersion) throw new RecoveryStoreError("VERSION_CONFLICT");
      if (current.finding && current.finding.finding !== "UNRESOLVED") throw new RecoveryStoreError("INVALID_STATE");
      const findingRecordId = stableId("finding", [input.recoveryCaseId, input.idempotencyKey]);
      this.#database.prepare(`INSERT INTO recovery_findings
        (finding_record_id, recovery_case_id, finding, reason_code, decided_by, decided_at)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .run(findingRecordId, input.recoveryCaseId, input.finding, input.reasonCode, input.decidedBy, input.decidedAt);
      insertEvidence(this.#database, "FINDING", findingRecordId, input.evidenceRefs);
      const status = input.finding === "UNRESOLVED" ? "OPEN" : "RESOLVED";
      const update = this.#database.prepare("UPDATE recovery_cases SET status = ?, version = version + 1 WHERE recovery_case_id = ? AND version = ?")
        .run(status, input.recoveryCaseId, input.expectedVersion);
      if (Number(update.changes) !== 1) throw new RecoveryStoreError("VERSION_CONFLICT");
      const record = requiredCase(this.#database, input.recoveryCaseId);
      insertIdempotency(this.#database, input.idempotencyKey, "RESOLVE_RECOVERY_CASE", input.fingerprint, record);
      return Object.freeze({ replay: false, record });
    });
  }

  authorizeRecovery(input: Parameters<RecoveryOrchestrationStore["authorizeRecovery"]>[0]): ReturnType<RecoveryOrchestrationStore["authorizeRecovery"]> {
    return this.#transaction(() => {
      const replay = readIdempotency(this.#database, input.idempotencyKey, "AUTHORIZE_RECOVERY", input.fingerprint);
      if (replay) return Object.freeze({ replay: true, record: replay });
      const current = requiredCase(this.#database, input.recoveryCaseId);
      if (current.version !== input.expectedVersion) throw new RecoveryStoreError("VERSION_CONFLICT");
      if (!current.finding || current.finding.finding === "UNRESOLVED" || current.disposition) throw new RecoveryStoreError("INVALID_STATE");
      if (input.recoveryDisposition === "RECOVERY_AUTHORIZED") {
        if (current.finding.finding !== "CONFIRMED_NOT_EXECUTED" || !input.recoveryExecutionIdentity || !isExecutionIdentity(input.recoveryActionType, input.recoveryExecutionIdentity)) throw new RecoveryStoreError("INVALID_STATE");
      } else if (input.recoveryExecutionIdentity) {
        throw new RecoveryStoreError("INVALID_STATE");
      }
      const dispositionRecordId = stableId("disposition", [input.recoveryCaseId, input.idempotencyKey]);
      const recoveryId = stableId("recovery", [input.recoveryCaseId, input.idempotencyKey]);
      this.#database.prepare(`INSERT INTO recovery_dispositions
        (disposition_record_id, recovery_id, recovery_case_id, recovery_disposition, recovery_action_type, decided_by, decided_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(dispositionRecordId, recoveryId, input.recoveryCaseId, input.recoveryDisposition, input.recoveryActionType, input.decidedBy, input.decidedAt);
      insertEvidence(this.#database, "DISPOSITION", dispositionRecordId, input.evidenceRefs);
      if (input.recoveryDisposition === "RECOVERY_AUTHORIZED" && input.recoveryExecutionIdentity) {
        this.#database.prepare(`INSERT INTO recovery_bindings
          (recovery_id, recovery_case_id, original_origin_identity_json, decision_version, finding_record_id, disposition_record_id, action_type, execution_identity_json, idempotency_key, authorized_by, authorized_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(recoveryId, input.recoveryCaseId, canonicalJson(current.originIdentity), current.version, current.finding.findingRecordId, dispositionRecordId, input.recoveryActionType, canonicalJson(input.recoveryExecutionIdentity), input.idempotencyKey, input.decidedBy, input.decidedAt);
        insertEvidence(this.#database, "RECOVERY", recoveryId, input.evidenceRefs);
      }
      const update = this.#database.prepare("UPDATE recovery_cases SET version = version + 1 WHERE recovery_case_id = ? AND version = ?")
        .run(input.recoveryCaseId, input.expectedVersion);
      if (Number(update.changes) !== 1) throw new RecoveryStoreError("VERSION_CONFLICT");
      const record = requiredCase(this.#database, input.recoveryCaseId);
      insertIdempotency(this.#database, input.idempotencyKey, "AUTHORIZE_RECOVERY", input.fingerprint, record);
      return Object.freeze({ replay: false, record });
    });
  }

  #transaction<T>(work: () => T): T {
    this.#assertOpen();
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const value = work();
      this.#database.exec("COMMIT");
      return value;
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* preserve original failure */ }
      throw error;
    }
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error("Recovery store is closed.");
  }
}

function requiredCase(database: DatabaseSync, recoveryCaseId: string): RecoveryCaseRecord {
  const row = database.prepare("SELECT * FROM recovery_cases WHERE recovery_case_id = ?").get(recoveryCaseId);
  if (!row) throw new RecoveryStoreError("INVALID_STATE");
  return decodeCase(database, row);
}

function decodeCase(database: DatabaseSync, row: SqlRow): RecoveryCaseRecord {
  const recoveryCaseId = text(row["recovery_case_id"]);
  const findingRow = database.prepare("SELECT * FROM recovery_findings WHERE recovery_case_id = ? ORDER BY rowid DESC LIMIT 1").get(recoveryCaseId);
  const dispositionRow = database.prepare("SELECT * FROM recovery_dispositions WHERE recovery_case_id = ? ORDER BY rowid DESC LIMIT 1").get(recoveryCaseId);
  const recoveryRow = database.prepare("SELECT * FROM recovery_bindings WHERE recovery_case_id = ? ORDER BY rowid DESC LIMIT 1").get(recoveryCaseId);
  const finding = findingRow ? decodeFinding(database, findingRow) : undefined;
  const disposition = dispositionRow ? decodeDisposition(database, dispositionRow) : undefined;
  const recovery = recoveryRow ? decodeRecovery(database, recoveryRow) : undefined;
  return Object.freeze({
    recoveryCaseId,
    resourceType: text(row["resource_type"]),
    resourceId: text(row["resource_id"]),
    originDomain: text(row["origin_domain"]) as RecoveryCaseRecord["originDomain"],
    originIdentity: deepFreeze(JSON.parse(text(row["origin_identity_json"])) as RecoveryOriginIdentity),
    tenantId: text(row["tenant_id"]),
    scopeRef: text(row["scope_ref"]),
    ...(row["parent_recovery_case_id"] === null ? {} : { parentRecoveryCaseId: text(row["parent_recovery_case_id"]) }),
    status: text(row["status"]) as RecoveryCaseRecord["status"],
    version: Number(row["version"]),
    evidenceRefs: readEvidence(database, "CASE", recoveryCaseId),
    createdBy: text(row["created_by"]),
    createdAt: text(row["created_at"]),
    ...(finding ? { finding } : {}),
    ...(disposition ? { disposition } : {}),
    ...(recovery ? { recovery } : {}),
  });
}

function decodeFinding(database: DatabaseSync, row: SqlRow): RecoveryFindingRecord {
  const id = text(row["finding_record_id"]);
  return Object.freeze({ findingRecordId: id, recoveryCaseId: text(row["recovery_case_id"]), finding: text(row["finding"]) as RecoveryFindingRecord["finding"], reasonCode: text(row["reason_code"]), evidenceRefs: readEvidence(database, "FINDING", id), decidedBy: text(row["decided_by"]), decidedAt: text(row["decided_at"]) });
}

function decodeDisposition(database: DatabaseSync, row: SqlRow): RecoveryDispositionRecord {
  const id = text(row["disposition_record_id"]);
  return Object.freeze({ dispositionRecordId: id, recoveryId: text(row["recovery_id"]), recoveryCaseId: text(row["recovery_case_id"]), recoveryDisposition: text(row["recovery_disposition"]) as RecoveryDispositionRecord["recoveryDisposition"], recoveryActionType: text(row["recovery_action_type"]) as RecoveryDispositionRecord["recoveryActionType"], evidenceRefs: readEvidence(database, "DISPOSITION", id), decidedBy: text(row["decided_by"]), decidedAt: text(row["decided_at"]) });
}

function decodeRecovery(database: DatabaseSync, row: SqlRow): RecoveryAuthorizationBinding {
  const id = text(row["recovery_id"]);
  return Object.freeze({ recoveryId: id, recoveryCaseId: text(row["recovery_case_id"]), originalOriginIdentity: deepFreeze(JSON.parse(text(row["original_origin_identity_json"])) as RecoveryOriginIdentity), decisionVersion: Number(row["decision_version"]), reconciliationFindingRecordId: text(row["finding_record_id"]), recoveryDispositionRecordId: text(row["disposition_record_id"]), recoveryActionType: text(row["action_type"]) as RecoveryAuthorizationBinding["recoveryActionType"], recoveryExecutionIdentity: deepFreeze(JSON.parse(text(row["execution_identity_json"])) as RecoveryAuthorizationBinding["recoveryExecutionIdentity"]), idempotencyKey: text(row["idempotency_key"]), evidenceRefs: readEvidence(database, "RECOVERY", id), authorizedBy: text(row["authorized_by"]), authorizedAt: text(row["authorized_at"]) });
}

function insertEvidence(database: DatabaseSync, ownerType: string, ownerId: string, refs: readonly string[]): void {
  const statement = database.prepare("INSERT INTO recovery_evidence (owner_type, owner_id, sequence, evidence_ref) VALUES (?, ?, ?, ?)");
  refs.forEach((ref, index) => statement.run(ownerType, ownerId, index + 1, ref));
}

function readEvidence(database: DatabaseSync, ownerType: string, ownerId: string): readonly string[] {
  return Object.freeze(database.prepare("SELECT evidence_ref FROM recovery_evidence WHERE owner_type = ? AND owner_id = ? ORDER BY sequence").all(ownerType, ownerId).map((row) => text(row["evidence_ref"])));
}

function insertIdempotency(database: DatabaseSync, key: string, operation: string, fingerprint: string, record: RecoveryCaseRecord): void {
  database.prepare("INSERT INTO recovery_idempotency (idempotency_key, operation, fingerprint, result_json) VALUES (?, ?, ?, ?)").run(key, operation, fingerprint, JSON.stringify(record));
}

function readIdempotency(database: DatabaseSync, key: string, operation: string, fingerprint: string): RecoveryCaseRecord | undefined {
  const row = database.prepare("SELECT operation, fingerprint, result_json FROM recovery_idempotency WHERE idempotency_key = ?").get(key);
  if (!row) return undefined;
  if (text(row["operation"]) !== operation || text(row["fingerprint"]) !== fingerprint) throw new RecoveryStoreError("IDEMPOTENCY_CONFLICT");
  return deepFreeze(JSON.parse(text(row["result_json"])) as RecoveryCaseRecord);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function isExecutionIdentity(actionType: RecoveryAuthorizationBinding["recoveryActionType"], value: unknown): value is RecoveryAuthorizationBinding["recoveryExecutionIdentity"] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  return actionType === "PUBLICATION_RECOVERY"
    ? keys === "attemptId,commandId" && typeof record["attemptId"] === "string" && record["attemptId"].length > 0 && typeof record["commandId"] === "string" && record["commandId"].length > 0
    : keys === "invocationId" && typeof record["invocationId"] === "string" && record["invocationId"].length > 0;
}

function stableId(prefix: string, parts: readonly string[]): string {
  return `${prefix}-${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 24)}`;
}

function text(value: SQLOutputValue | undefined): string {
  if (typeof value !== "string") throw new Error("Invalid recovery persistence value.");
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const IMMUTABLE_TRIGGER_TABLES = ["recovery_evidence", "recovery_findings", "recovery_dispositions", "recovery_bindings", "recovery_idempotency"] as const;
const IMMUTABLE_TRIGGERS = IMMUTABLE_TRIGGER_TABLES.map((table) => `
CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`).join("\n");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS recovery_cases (
  recovery_case_id TEXT PRIMARY KEY, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL,
  origin_domain TEXT NOT NULL CHECK(origin_domain IN ('PUBLICATION','CONNECTOR','EXTERNAL_INTEGRATION')),
  origin_identity_json TEXT NOT NULL, tenant_id TEXT NOT NULL, scope_ref TEXT NOT NULL,
  parent_recovery_case_id TEXT REFERENCES recovery_cases(recovery_case_id),
  status TEXT NOT NULL CHECK(status IN ('OPEN','RESOLVED')), version INTEGER NOT NULL CHECK(version > 0),
  created_by TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(tenant_id, scope_ref, origin_domain, origin_identity_json, parent_recovery_case_id)
);
CREATE TABLE IF NOT EXISTS recovery_evidence (owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, sequence INTEGER NOT NULL, evidence_ref TEXT NOT NULL, PRIMARY KEY(owner_type, owner_id, sequence));
CREATE TABLE IF NOT EXISTS recovery_findings (finding_record_id TEXT PRIMARY KEY, recovery_case_id TEXT NOT NULL REFERENCES recovery_cases(recovery_case_id), finding TEXT NOT NULL CHECK(finding IN ('CONFIRMED_EXECUTED','CONFIRMED_NOT_EXECUTED','UNRESOLVED')), reason_code TEXT NOT NULL, decided_by TEXT NOT NULL, decided_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_dispositions (disposition_record_id TEXT PRIMARY KEY, recovery_id TEXT NOT NULL UNIQUE, recovery_case_id TEXT NOT NULL UNIQUE REFERENCES recovery_cases(recovery_case_id), recovery_disposition TEXT NOT NULL CHECK(recovery_disposition IN ('RECOVERY_AUTHORIZED','NO_RECOVERY_REQUIRED','RECOVERY_REJECTED')), recovery_action_type TEXT NOT NULL CHECK(recovery_action_type IN ('PUBLICATION_RECOVERY','CONNECTOR_REEXECUTION')), decided_by TEXT NOT NULL, decided_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_bindings (recovery_id TEXT PRIMARY KEY, recovery_case_id TEXT NOT NULL UNIQUE REFERENCES recovery_cases(recovery_case_id), original_origin_identity_json TEXT NOT NULL, decision_version INTEGER NOT NULL CHECK(decision_version > 0), finding_record_id TEXT NOT NULL REFERENCES recovery_findings(finding_record_id), disposition_record_id TEXT NOT NULL REFERENCES recovery_dispositions(disposition_record_id), action_type TEXT NOT NULL CHECK(action_type IN ('PUBLICATION_RECOVERY','CONNECTOR_REEXECUTION')), execution_identity_json TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, authorized_by TEXT NOT NULL, authorized_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS recovery_idempotency (idempotency_key TEXT PRIMARY KEY, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, result_json TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS recovery_cases_identity_no_update BEFORE UPDATE ON recovery_cases
WHEN OLD.recovery_case_id IS NOT NEW.recovery_case_id OR OLD.resource_type IS NOT NEW.resource_type OR OLD.resource_id IS NOT NEW.resource_id OR OLD.origin_domain IS NOT NEW.origin_domain OR OLD.origin_identity_json IS NOT NEW.origin_identity_json OR OLD.tenant_id IS NOT NEW.tenant_id OR OLD.scope_ref IS NOT NEW.scope_ref OR OLD.parent_recovery_case_id IS NOT NEW.parent_recovery_case_id OR OLD.created_by IS NOT NEW.created_by OR OLD.created_at IS NOT NEW.created_at
BEGIN SELECT RAISE(ABORT, 'immutable recovery case identity'); END;
CREATE TRIGGER IF NOT EXISTS recovery_cases_no_delete BEFORE DELETE ON recovery_cases BEGIN SELECT RAISE(ABORT, 'append-only'); END;
${IMMUTABLE_TRIGGERS}`;
