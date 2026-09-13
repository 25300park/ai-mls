import { isAbsolute } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import type { CandidateListing, DuplicateGroup, ListingOffer } from "./listing-service.js";

export interface ListingTenantResolver {
  resolveCandidateTenant(input: Readonly<{ intakeId: string; sourceIds: readonly string[] }>): string | undefined;
}
export interface ListingAuditIntent {
  readonly intentId: string;
  readonly domainOwner: "LISTING";
  readonly aggregateId: string;
  readonly mutationIdentity: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly classificationRef: string;
  readonly committedAt: string;
  readonly evidenceRefs: readonly string[];
}
export type ListingPersistenceErrorCode = "IDEMPOTENCY_CONFLICT" | "PERSISTENCE_INPUT_INVALID" | "PERSISTENCE_UNAVAILABLE" | "RECORD_ALREADY_EXISTS" | "RECORD_NOT_FOUND" | "TENANT_BINDING_INVALID" | "VERSION_CONFLICT";
export class ListingPersistenceError extends Error {
  public constructor(public readonly code: ListingPersistenceErrorCode) { super(code); this.name = "ListingPersistenceError"; }
}
export interface DurableListingStoreOptions {
  readonly databasePath: string;
  readonly tenantResolver: ListingTenantResolver;
  readonly busyTimeoutMilliseconds?: number;
  readonly beforeAuditIntentWrite?: () => void;
}

type Kind = "CANDIDATE" | "OFFER" | "DUPLICATE";
type RecordValue = CandidateListing | ListingOffer | DuplicateGroup;
const SCHEMA = `
CREATE TABLE IF NOT EXISTS listing_records (record_kind TEXT NOT NULL CHECK(record_kind IN ('CANDIDATE','OFFER','DUPLICATE')), record_id TEXT NOT NULL, tenant_id TEXT NOT NULL, version INTEGER NOT NULL CHECK(version >= 1), payload_json TEXT NOT NULL, PRIMARY KEY(record_kind, record_id));
CREATE TABLE IF NOT EXISTS listing_history (record_kind TEXT NOT NULL, record_id TEXT NOT NULL, version INTEGER NOT NULL, tenant_id TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(record_kind, record_id, version));
CREATE TABLE IF NOT EXISTS listing_commands (command_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, record_kind TEXT NOT NULL, record_id TEXT NOT NULL, tenant_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS listing_audit_intents (intent_id TEXT PRIMARY KEY, aggregate_id TEXT NOT NULL, tenant_id TEXT NOT NULL, mutation_identity TEXT NOT NULL, payload_json TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS listing_history_no_update BEFORE UPDATE ON listing_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS listing_history_no_delete BEFORE DELETE ON listing_history BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS listing_commands_no_update BEFORE UPDATE ON listing_commands BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS listing_commands_no_delete BEFORE DELETE ON listing_commands BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS listing_audit_no_update BEFORE UPDATE ON listing_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS listing_audit_no_delete BEFORE DELETE ON listing_audit_intents BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;

export class DurableListingStore {
  readonly #database: DatabaseSync;
  readonly #resolver: ListingTenantResolver;
  readonly #beforeAudit: (() => void) | undefined;
  #closed = false;

  public constructor(options: DurableListingStoreOptions) {
    const timeout = options.busyTimeoutMilliseconds ?? 5000;
    if (!validPath(options.databasePath) || !Number.isInteger(timeout) || timeout < 1 || timeout > 60_000 || typeof options.tenantResolver?.resolveCandidateTenant !== "function") throw fail("PERSISTENCE_UNAVAILABLE");
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON");
      database.exec("PRAGMA journal_mode = WAL");
      database.exec("PRAGMA synchronous = FULL");
      database.exec(`PRAGMA busy_timeout = ${String(timeout)}`);
      database.exec(SCHEMA);
      assertSchema(database, SCHEMA);
      this.#database = database;
      this.#resolver = options.tenantResolver;
      this.#beforeAudit = options.beforeAuditIntentWrite;
    } catch {
      try { database?.close(); } catch { /* safe */ }
      throw fail("PERSISTENCE_UNAVAILABLE");
    }
  }

  public createCandidate(input: Readonly<{ record: CandidateListing; commandId: string; commandFingerprint: string; auditIntent: ListingAuditIntent }>): Readonly<{ status: "STORED" | "REPLAYED"; record: CandidateListing }> {
    validateCandidate(input.record);
    let tenantId: string | undefined;
    try { tenantId = this.#resolver.resolveCandidateTenant({ intakeId: input.record.intakeRef.entityId, sourceIds: input.record.sourceRefs.map((ref) => ref.entityId) }); }
    catch { throw fail("PERSISTENCE_UNAVAILABLE"); }
    if (!text(tenantId) || tenantId !== input.auditIntent.tenantId) throw fail("TENANT_BINDING_INVALID");
    return this.#create("CANDIDATE", tenantId, input.record, input.commandId, input.commandFingerprint, input.auditIntent) as Readonly<{ status: "STORED" | "REPLAYED"; record: CandidateListing }>;
  }
  public createOffer(input: Readonly<{ record: ListingOffer; commandId: string; commandFingerprint: string; auditIntent: ListingAuditIntent }>): Readonly<{ status: "STORED" | "REPLAYED"; record: ListingOffer }> {
    validateOffer(input.record);
    const tenantId = this.#tenantForCandidate(input.record.candidateId);
    this.#requireCandidateBindingById(input.record.candidateId, tenantId);
    if (tenantId !== input.auditIntent.tenantId) throw fail("TENANT_BINDING_INVALID");
    return this.#create("OFFER", tenantId, input.record, input.commandId, input.commandFingerprint, input.auditIntent) as Readonly<{ status: "STORED" | "REPLAYED"; record: ListingOffer }>;
  }
  public createDuplicate(input: Readonly<{ record: DuplicateGroup; commandId: string; commandFingerprint: string; auditIntent: ListingAuditIntent }>): Readonly<{ status: "STORED" | "REPLAYED"; record: DuplicateGroup }> {
    validateDuplicate(input.record);
    const ids = input.record.subjectRefs.filter((ref) => ref.entityType === "CandidateListing").map((ref) => ref.entityId);
    if (ids.length < 2) throw fail("PERSISTENCE_INPUT_INVALID");
    const tenants = new Set(ids.map((id) => { const tenantId = this.#tenantForCandidate(id); this.#requireCandidateBindingById(id, tenantId); return tenantId; }));
    if (tenants.size !== 1 || !tenants.has(input.auditIntent.tenantId)) throw fail("TENANT_BINDING_INVALID");
    return this.#create("DUPLICATE", input.auditIntent.tenantId, input.record, input.commandId, input.commandFingerprint, input.auditIntent) as Readonly<{ status: "STORED" | "REPLAYED"; record: DuplicateGroup }>;
  }

  public updateCandidate(input: Readonly<{ tenantId: string; expectedVersion: number; record: CandidateListing; auditIntent: ListingAuditIntent }>): CandidateListing { validateCandidate(input.record); this.#requireCurrentCandidateTenant(input.record, input.tenantId); return this.#update("CANDIDATE", input, validateCandidate) as CandidateListing; }
  public updateOffer(input: Readonly<{ tenantId: string; expectedVersion: number; record: ListingOffer; auditIntent: ListingAuditIntent }>): ListingOffer { validateOffer(input.record); this.#requireCandidateBindingById(input.record.candidateId, input.tenantId); return this.#update("OFFER", input, validateOffer) as ListingOffer; }
  public updateDuplicate(input: Readonly<{ tenantId: string; expectedVersion: number; record: DuplicateGroup; auditIntent: ListingAuditIntent }>): DuplicateGroup { validateDuplicate(input.record); const ids = input.record.subjectRefs.filter((ref) => ref.entityType === "CandidateListing").map((ref) => ref.entityId); if (ids.length < 2) throw fail("PERSISTENCE_INPUT_INVALID"); ids.forEach((id) => this.#requireCandidateBindingById(id, input.tenantId)); return this.#update("DUPLICATE", input, validateDuplicate) as DuplicateGroup; }

  public readCandidate(input: Readonly<{ tenantId: string; candidateId: string }>): CandidateListing | undefined { return this.#read("CANDIDATE", input.candidateId, input.tenantId, validateCandidate) as CandidateListing | undefined; }
  public readOffer(input: Readonly<{ tenantId: string; offerId: string }>): ListingOffer | undefined { return this.#read("OFFER", input.offerId, input.tenantId, validateOffer) as ListingOffer | undefined; }
  public readDuplicate(input: Readonly<{ tenantId: string; groupId: string }>): DuplicateGroup | undefined { return this.#read("DUPLICATE", input.groupId, input.tenantId, validateDuplicate) as DuplicateGroup | undefined; }
  public listAuditIntents(input: Readonly<{ tenantId: string }>): readonly ListingAuditIntent[] {
    this.#open(); if (!text(input.tenantId)) return Object.freeze([]);
    try { return Object.freeze(this.#database.prepare("SELECT payload_json FROM listing_audit_intents WHERE tenant_id = ? ORDER BY intent_id").all(input.tenantId).map((row) => decodeIntent(required(row["payload_json"])))); }
    catch { throw fail("PERSISTENCE_UNAVAILABLE"); }
  }
  public close(): void { if (this.#closed) return; this.#closed = true; try { this.#database.close(); } catch { throw fail("PERSISTENCE_UNAVAILABLE"); } }

  #create(kind: Kind, tenantId: string, record: RecordValue, commandId: string, fingerprint: string, intent: ListingAuditIntent): Readonly<{ status: "STORED" | "REPLAYED"; record: RecordValue }> {
    validateIntent(intent);
    if (!text(commandId) || !text(fingerprint) || record.version !== 1 || !intentMatches(record.id, commandId, tenantId, intent)) throw fail("PERSISTENCE_INPUT_INVALID");
    return this.#transaction(() => {
      const prior = this.#database.prepare("SELECT fingerprint, record_kind, record_id, tenant_id FROM listing_commands WHERE command_id = ?").get(commandId);
      if (prior !== undefined) {
        const stored = this.#required(kind, record.id, tenantId, validator(kind));
        if (prior["fingerprint"] !== fingerprint || prior["record_kind"] !== kind || prior["record_id"] !== record.id || prior["tenant_id"] !== tenantId || JSON.stringify(stored) !== JSON.stringify(record)) throw fail("IDEMPOTENCY_CONFLICT");
        return Object.freeze({ status: "REPLAYED" as const, record: stored });
      }
      if (this.#raw(kind, record.id) !== undefined) throw fail("RECORD_ALREADY_EXISTS");
      const payload = JSON.stringify(record);
      this.#database.prepare("INSERT INTO listing_records (record_kind, record_id, tenant_id, version, payload_json) VALUES (?, ?, ?, ?, ?)").run(kind, record.id, tenantId, record.version, payload);
      this.#database.prepare("INSERT INTO listing_history (record_kind, record_id, version, tenant_id, payload_json) VALUES (?, ?, ?, ?, ?)").run(kind, record.id, record.version, tenantId, payload);
      this.#database.prepare("INSERT INTO listing_commands (command_id, fingerprint, record_kind, record_id, tenant_id) VALUES (?, ?, ?, ?, ?)").run(commandId, fingerprint, kind, record.id, tenantId);
      this.#appendIntent(intent);
      return Object.freeze({ status: "STORED" as const, record: immutable(record) });
    });
  }
  #update(kind: Kind, input: Readonly<{ tenantId: string; expectedVersion: number; record: RecordValue; auditIntent: ListingAuditIntent }>, validate: Validator): RecordValue {
    validateIntent(input.auditIntent);
    if (!text(input.tenantId) || input.auditIntent.tenantId !== input.tenantId || input.record.version !== input.expectedVersion + 1 || !intentMatches(input.record.id, input.auditIntent.mutationIdentity, input.tenantId, input.auditIntent)) throw fail("PERSISTENCE_INPUT_INVALID");
    return this.#transaction(() => {
      const current = this.#required(kind, input.record.id, input.tenantId, validate);
      if (current.version !== input.expectedVersion) throw fail("VERSION_CONFLICT");
      if (!immutableFieldsEqual(kind, current, input.record)) throw fail("PERSISTENCE_INPUT_INVALID");
      const payload = JSON.stringify(input.record);
      const result = this.#database.prepare("UPDATE listing_records SET version = ?, payload_json = ? WHERE record_kind = ? AND record_id = ? AND tenant_id = ? AND version = ?").run(input.record.version, payload, kind, input.record.id, input.tenantId, input.expectedVersion);
      if (Number(result.changes) !== 1) throw fail("VERSION_CONFLICT");
      this.#database.prepare("INSERT INTO listing_history (record_kind, record_id, version, tenant_id, payload_json) VALUES (?, ?, ?, ?, ?)").run(kind, input.record.id, input.record.version, input.tenantId, payload);
      this.#appendIntent(input.auditIntent);
      return immutable(input.record);
    });
  }
  #appendIntent(intent: ListingAuditIntent): void { this.#beforeAudit?.(); this.#database.prepare("INSERT INTO listing_audit_intents (intent_id, aggregate_id, tenant_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(intent.intentId, intent.aggregateId, intent.tenantId, intent.mutationIdentity, JSON.stringify(intent)); }
  #tenantForCandidate(candidateId: string): string { if (!text(candidateId)) throw fail("PERSISTENCE_INPUT_INVALID"); const row = this.#database.prepare("SELECT tenant_id FROM listing_records WHERE record_kind = 'CANDIDATE' AND record_id = ?").get(candidateId); if (row === undefined || typeof row["tenant_id"] !== "string") throw fail("RECORD_NOT_FOUND"); return row["tenant_id"]; }
  #requireCurrentCandidateTenant(record: CandidateListing, expectedTenantId: string): void { let tenantId: string | undefined; try { tenantId = this.#resolver.resolveCandidateTenant({ intakeId: record.intakeRef.entityId, sourceIds: record.sourceRefs.map((ref) => ref.entityId) }); } catch { throw fail("PERSISTENCE_UNAVAILABLE"); } if (tenantId !== expectedTenantId) throw fail("TENANT_BINDING_INVALID"); }
  #requireCandidateBindingById(candidateId: string, expectedTenantId: string): void { const candidate = this.#required("CANDIDATE", candidateId, expectedTenantId, validateCandidate) as CandidateListing; this.#requireCurrentCandidateTenant(candidate, expectedTenantId); }
  #read(kind: Kind, id: string, tenantId: string, validate: Validator): RecordValue | undefined {
    this.#open(); if (!text(id) || !text(tenantId)) return undefined;
    try { const row = this.#database.prepare("SELECT record_id, tenant_id, version, payload_json FROM listing_records WHERE record_kind = ? AND record_id = ? AND tenant_id = ?").get(kind, id, tenantId); if (row === undefined) return undefined; const parsed = parse(required(row["payload_json"])); validate(parsed); const record = parsed; if (record.id !== row["record_id"] || record.version !== Number(row["version"])) throw fail("PERSISTENCE_UNAVAILABLE"); return immutable(record); }
    catch (error) { if (error instanceof ListingPersistenceError) throw error; throw fail("PERSISTENCE_UNAVAILABLE"); }
  }
  #required(kind: Kind, id: string, tenantId: string, validate: Validator): RecordValue { const record = this.#read(kind, id, tenantId, validate); if (record === undefined) throw fail("RECORD_NOT_FOUND"); return record; }
  #raw(kind: Kind, id: string): Record<string, SQLOutputValue> | undefined { return this.#database.prepare("SELECT tenant_id FROM listing_records WHERE record_kind = ? AND record_id = ?").get(kind, id); }
  #transaction<T>(operation: () => T): T { this.#open(); let open = false; try { this.#database.exec("BEGIN IMMEDIATE"); open = true; const result = operation(); this.#database.exec("COMMIT"); open = false; return result; } catch (error) { if (open) { try { this.#database.exec("ROLLBACK"); } catch { throw fail("PERSISTENCE_UNAVAILABLE"); } } if (error instanceof ListingPersistenceError) throw error; throw fail("PERSISTENCE_UNAVAILABLE"); } }
  #open(): void { if (this.#closed) throw fail("PERSISTENCE_UNAVAILABLE"); }
}

type Validator = (value: unknown) => asserts value is RecordValue;
function validator(kind: Kind): Validator { return kind === "CANDIDATE" ? validateCandidate : kind === "OFFER" ? validateOffer : validateDuplicate; }
function validateCandidate(value: unknown): asserts value is CandidateListing { if (!plain(value)) throw fail("PERSISTENCE_INPUT_INVALID"); const r = value as Record<string, unknown>; if (!text(r["id"]) || !positive(r["version"]) || r["authority"] !== "CANDIDATE" || r["classification"] !== "CONFIDENTIAL_BUSINESS" || !plain(r["intakeRef"]) || !refs(r["sourceRefs"]) || !Array.isArray(r["unresolvedFields"]) || !Array.isArray(r["relatedCandidateIds"]) || !text(r["createdBy"])) throw fail("PERSISTENCE_INPUT_INVALID"); }
function validateOffer(value: unknown): asserts value is ListingOffer { if (!plain(value)) throw fail("PERSISTENCE_INPUT_INVALID"); const r = value as Record<string, unknown>; if (!text(r["id"]) || !positive(r["version"]) || !text(r["candidateId"]) || r["authority"] !== "CANDIDATE_CLAIM" || r["classification"] !== "CONFIDENTIAL_BUSINESS" || !text(r["transactionType"]) || !plain(r["terms"]) || !refs(r["sourceRefs"])) throw fail("PERSISTENCE_INPUT_INVALID"); }
function validateDuplicate(value: unknown): asserts value is DuplicateGroup { if (!plain(value)) throw fail("PERSISTENCE_INPUT_INVALID"); const r = value as Record<string, unknown>; if (!text(r["id"]) || !positive(r["version"]) || !refs(r["subjectRefs"]) || !plain(r["aiResultRef"]) || !Array.isArray(r["decisionHistory"]) || !Array.isArray(r["signals"]) || r["classification"] !== "INTERNAL" || !text(r["createdBy"])) throw fail("PERSISTENCE_INPUT_INVALID"); }
function validateIntent(value: unknown): asserts value is ListingAuditIntent { if (!plain(value)) throw fail("PERSISTENCE_INPUT_INVALID"); const r = value as Record<string, unknown>; const keys = ["intentId", "domainOwner", "aggregateId", "mutationIdentity", "actorId", "tenantId", "scopeRef", "classificationRef", "committedAt", "evidenceRefs"]; if (Object.keys(r).length !== keys.length || Object.keys(r).some((key) => !keys.includes(key)) || r["domainOwner"] !== "LISTING" || !text(r["intentId"]) || !text(r["aggregateId"]) || !text(r["mutationIdentity"]) || !text(r["actorId"]) || !text(r["tenantId"]) || !text(r["scopeRef"]) || !text(r["classificationRef"]) || !instant(r["committedAt"]) || !safeEvidenceRefs(r["evidenceRefs"])) throw fail("PERSISTENCE_INPUT_INVALID"); }
function immutableFieldsEqual(kind: Kind, current: RecordValue, next: RecordValue): boolean { if (kind === "CANDIDATE") { const a = current as CandidateListing; const b = next as CandidateListing; return a.id === b.id && a.authority === b.authority && a.classification === b.classification && a.createdBy === b.createdBy && JSON.stringify(a.intakeRef) === JSON.stringify(b.intakeRef) && JSON.stringify(a.sourceRefs) === JSON.stringify(b.sourceRefs); } if (kind === "OFFER") { const a = current as ListingOffer; const b = next as ListingOffer; return a.id === b.id && a.candidateId === b.candidateId && a.authority === b.authority && a.classification === b.classification && a.transactionType === b.transactionType && JSON.stringify(a.sourceRefs) === JSON.stringify(b.sourceRefs); } const a = current as DuplicateGroup; const b = next as DuplicateGroup; return a.id === b.id && a.classification === b.classification && a.createdBy === b.createdBy && JSON.stringify(a.subjectRefs) === JSON.stringify(b.subjectRefs) && JSON.stringify(a.aiResultRef) === JSON.stringify(b.aiResultRef); }
function intentMatches(id: string, mutation: string, tenantId: string, intent: ListingAuditIntent): boolean { return intent.aggregateId === id && intent.mutationIdentity === mutation && intent.tenantId === tenantId; }
function decodeIntent(value: SQLOutputValue): ListingAuditIntent { const parsed = parse(value); validateIntent(parsed); return immutable(parsed); }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function parse(value: SQLOutputValue): unknown { if (typeof value !== "string") throw fail("PERSISTENCE_UNAVAILABLE"); try { return JSON.parse(value); } catch { throw fail("PERSISTENCE_UNAVAILABLE"); } }
function required(value: SQLOutputValue | undefined): SQLOutputValue { if (value === undefined) throw fail("PERSISTENCE_UNAVAILABLE"); return value; }
function validPath(value: string): boolean { return typeof value === "string" && value.length > 0 && isAbsolute(value) && value !== ":memory:" && !value.startsWith("file:"); }
function plain(value: unknown): value is object { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 512 && !/[\r\n\0]/u.test(value); }
function safeEvidenceRefs(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(isSafeEvidenceRef); }
function isSafeEvidenceRef(value: unknown): value is string { return typeof value === "string" && value.length <= 256 && /^evidence:[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)*$/u.test(value) && !/(?:^|[:._-])(secret|token|password|authorization|bearer|api[-_]?key|prompt|reasoning|stack|sqlite|database|provider[-_]?payload)(?:$|[:._-])/iu.test(value); }
function assertSchema(database: DatabaseSync, schema: string): void { if (database.prepare("PRAGMA integrity_check").get()?.["integrity_check"] !== "ok") throw fail("PERSISTENCE_UNAVAILABLE"); compareCatalog(database, schema, () => fail("PERSISTENCE_UNAVAILABLE")); }
function compareCatalog(database: DatabaseSync, schema: string, failClosed: () => Error): void { const golden = new DatabaseSync(":memory:"); try { golden.exec(schema); const sql = "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE type IN ('table','trigger') AND name NOT LIKE 'sqlite_%' ORDER BY type, name"; if (JSON.stringify(database.prepare(sql).all()) !== JSON.stringify(golden.prepare(sql).all())) throw failClosed(); } finally { golden.close(); } }
function refs(value: unknown): boolean { return Array.isArray(value) && value.length > 0 && value.every((item) => plain(item) && text((item as Record<string, unknown>)["entityId"])); }
function positive(value: unknown): boolean { return Number.isInteger(value) && Number(value) >= 1; }
function instant(value: unknown): value is string { return text(value) && !Number.isNaN(Date.parse(value)); }
function fail(code: ListingPersistenceErrorCode): ListingPersistenceError { return new ListingPersistenceError(code); }
