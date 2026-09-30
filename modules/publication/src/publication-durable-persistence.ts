import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { existsSync } from "node:fs";

import { InMemoryPublicationAuditStore, type PublicationAuditStore } from "./publication-audit-store.js";
import { InMemoryIdempotencyStore, type PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { InMemoryPersistenceState, persistenceKey } from "./in-memory-persistence-state.js";
import { InMemoryPublicationRepository } from "./in-memory-publication-repository.js";
import { InMemoryPublicationEventJournal } from "./in-memory-publication-event-journal.js";
import { InMemoryPublicationExecutionJournal, executionKey, type PublicationDispatchEvent, type PublicationExecutionJournal } from "./publication-execution-journal.js";
import { persistenceError, PublicationPersistenceError } from "./publication-persistence-error.js";
import type { PublicationPersistenceRecord } from "./publication-persistence-model.js";
import type { PublicationRepository } from "./publication-repository.js";
import type { PublicationIdentity } from "./publication-contracts.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import type { PublicationTransaction, PublicationUnitOfWork } from "./publication-unit-of-work.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import { mapPersistenceToPublication } from "./publication-persistence-mapper.js";

const SCHEMA_VERSION = 1;

export interface DurablePublicationUnitOfWorkOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: 5000;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
}

export class DurablePublicationUnitOfWork implements PublicationUnitOfWork {
  readonly #database: DatabaseSync;
  readonly #state = new InMemoryPersistenceState();
  #active = false;
  #closed = false;
  #quarantined = false;

  public readonly repository: PublicationRepository;
  public readonly idempotency: PublicationIdempotencyStore;
  public readonly audit: PublicationAuditStore;
  public readonly eventJournal: PublicationEventJournal;
  public readonly execution: PublicationExecutionJournal;

  public constructor(options: DurablePublicationUnitOfWorkOptions) {
    const schemaMode = options.schemaMode ?? "INITIALIZE";
    if (!isFileDatabasePath(options.databasePath) || (options.busyTimeoutMilliseconds !== undefined && options.busyTimeoutMilliseconds !== 5000)
      || (schemaMode !== "INITIALIZE" && schemaMode !== "REQUIRE_EXISTING")
      || (schemaMode === "REQUIRE_EXISTING" && !existsSync(options.databasePath))) {
      throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication database configuration is invalid.");
    }
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      if (schemaMode === "INITIALIZE") {
        configureDatabase(database, options.busyTimeoutMilliseconds ?? 5000);
        bootstrapSchema(database);
      } else {
        configurePreparedDatabase(database, options.busyTimeoutMilliseconds ?? 5000);
      }
      validateDatabase(database);
      this.#state.replaceAllWith(loadState(database));
      this.#database = database;
    } catch (error) {
      try { database?.close(); } catch { /* preserve safe startup error */ }
      throw mapStorageError(error);
    }
    const repository = new InMemoryPublicationRepository(this.#state);
    const idempotency = new InMemoryIdempotencyStore(this.#state);
    const audit = new InMemoryPublicationAuditStore(this.#state);
    const events = new InMemoryPublicationEventJournal(this.#state);
    const execution = new InMemoryPublicationExecutionJournal(this.#state);
    this.repository = {
      save: (snapshot): ReturnType<PublicationRepository["save"]> => this.inTransaction(snapshot, (transaction) => transaction.repository.save(snapshot)),
      update: (expectedVersion, snapshot): ReturnType<PublicationRepository["update"]> => this.inTransaction(snapshot, (transaction) => transaction.repository.update(expectedVersion, snapshot)),
      find: async (identity): ReturnType<PublicationRepository["find"]> => { this.refresh(); return await repository.find(identity); },
      exists: async (identity): ReturnType<PublicationRepository["exists"]> => { this.refresh(); return await repository.exists(identity); },
      checkVersion: async (identity, version): ReturnType<PublicationRepository["checkVersion"]> => { this.refresh(); return await repository.checkVersion(identity, version); },
      readHistory: async (identity): ReturnType<PublicationRepository["readHistory"]> => { this.refresh(); return await repository.readHistory(identity); },
    };
    this.idempotency = {
      record: (record): ReturnType<PublicationIdempotencyStore["record"]> => this.inTransaction({ tenantScopeId: record.tenantScopeId, publicationId: record.aggregateId }, (transaction) => transaction.idempotency.record(record)),
      find: async (identity): ReturnType<PublicationIdempotencyStore["find"]> => { this.refresh(); return await idempotency.find(identity); },
    };
    this.audit = {
      append: (record): ReturnType<PublicationAuditStore["append"]> => this.inTransaction({ tenantScopeId: record.tenantScopeId, publicationId: record.aggregateId }, (transaction) => transaction.audit.append(record)),
      list: async (identity): ReturnType<PublicationAuditStore["list"]> => { this.refresh(); return await audit.list(identity); },
    };
    this.eventJournal = {
      append: (event): ReturnType<PublicationEventJournal["append"]> => this.inTransaction({ tenantScopeId: event.tenantId, publicationId: event.aggregateId }, (transaction) => transaction.eventJournal.append(event)),
      appendAll: (items): ReturnType<PublicationEventJournal["appendAll"]> => {
        if (items.length === 0) return Promise.resolve(Object.freeze([]));
        const first = items[0]!;
        return this.inTransaction({ tenantScopeId: first.tenantId, publicationId: first.aggregateId }, (transaction) => transaction.eventJournal.appendAll(items));
      },
      prepareAppend: async (event): ReturnType<NonNullable<PublicationEventJournal["prepareAppend"]>> => {
        await Promise.resolve();
        let committed = false;
        return Object.freeze({ event, commit: async () => {
          if (!committed) { committed = true; return this.eventJournal.append(event); }
          const found = await this.eventJournal.findByEventId(event.tenantId, event.eventId);
          if (found === undefined) throw persistenceError("PERSISTENCE_WRITE_FAILED", "Durable Publication event is unavailable.");
          return Object.freeze({ status: "REPLAYED" as const, event: found });
        } });
      },
      findByEventId: async (tenantId, eventId): ReturnType<PublicationEventJournal["findByEventId"]> => { this.refresh(); return await events.findByEventId(tenantId, eventId); },
      listByAggregate: async (tenantId, aggregateId): ReturnType<PublicationEventJournal["listByAggregate"]> => { this.refresh(); return await events.listByAggregate(tenantId, aggregateId); },
      getLastSequence: async (tenantId, aggregateId): ReturnType<PublicationEventJournal["getLastSequence"]> => { this.refresh(); return await events.getLastSequence(tenantId, aggregateId); },
    };
    this.execution = {
      prepare: (intent): ReturnType<PublicationExecutionJournal["prepare"]> => this.inTransaction(intent, (transaction) => transaction.execution.prepare(intent)),
      markDispatchStarted: (identity, commandId, recordedAt): ReturnType<PublicationExecutionJournal["markDispatchStarted"]> => this.inTransaction(identity, (transaction) => transaction.execution.markDispatchStarted(identity, commandId, recordedAt)),
      appendReceipt: (receipt): ReturnType<PublicationExecutionJournal["appendReceipt"]> => this.inTransaction(receipt, (transaction) => transaction.execution.appendReceipt(receipt)),
      findIntent: async (identity, commandId): ReturnType<PublicationExecutionJournal["findIntent"]> => { this.refresh(); return await execution.findIntent(identity, commandId); },
      findReceipt: async (identity, commandId): ReturnType<PublicationExecutionJournal["findReceipt"]> => { this.refresh(); return await execution.findReceipt(identity, commandId); },
      recoveryDisposition: async (identity, commandId): ReturnType<PublicationExecutionJournal["recoveryDisposition"]> => { this.refresh(); return await execution.recoveryDisposition(identity, commandId); },
    };
  }

  public async begin(identity: PublicationIdentity): Promise<PublicationTransaction> {
    await Promise.resolve();
    this.assertOpen();
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE", "A logical transaction is already active.");
    this.refresh();
    this.#active = true;
    const baseline = this.#state.clone();
    const staged = this.#state.clone();
    const initialRevision = this.#state.scopeRevision(identity.tenantScopeId, identity.publicationId);
    let completed = false;
    const ensureActive = (): void => {
      if (completed) throw persistenceError("TRANSACTION_ALREADY_COMPLETED", "The logical transaction has already completed.");
    };
    const finish = (commit: boolean): void => {
      ensureActive();
      try {
        if (commit) this.commit(identity, initialRevision, baseline, staged);
      } finally {
        completed = true;
        this.#active = false;
      }
    };
    return {
      repository: new InMemoryPublicationRepository(staged, identity, ensureActive),
      idempotency: new InMemoryIdempotencyStore(staged, identity, ensureActive),
      audit: new InMemoryPublicationAuditStore(staged, identity, ensureActive),
      eventJournal: new InMemoryPublicationEventJournal(staged, identity, ensureActive),
      execution: new InMemoryPublicationExecutionJournal(staged, identity, ensureActive),
      commit: async (): Promise<void> => {
        await Promise.resolve(); finish(true); },
      rollback: async (): Promise<void> => {
        await Promise.resolve(); finish(false); },
    };
  }

  public async close(): Promise<void> {
    await Promise.resolve();
    if (this.#closed) return;
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE", "A logical transaction is active.");
    this.#closed = true;
    this.#database.close();
  }

  private commit(identity: PublicationIdentity, initialRevision: number, baseline: InMemoryPersistenceState, staged: InMemoryPersistenceState): void {
    let transactionOpen = false;
    let commitStarted = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      persistScope(this.#database, identity, initialRevision, staged);
      persistAppendOnly(this.#database, identity, baseline, staged);
      commitStarted = true;
      this.#database.exec("COMMIT");
      transactionOpen = false;
      staged.setScopeRevision(identity.tenantScopeId, identity.publicationId, initialRevision + 1);
      this.#state.replaceScopeWith(staged, identity.tenantScopeId, identity.publicationId);
    } catch (error) {
      if (transactionOpen && !commitStarted) {
        try { this.#database.exec("ROLLBACK"); } catch { this.#quarantined = true; }
      } else if (commitStarted) {
        this.#quarantined = true;
      }
      throw mapStorageError(error);
    }
  }

  private refresh(): void {
    this.assertOpen();
    try { this.#state.replaceAllWith(loadState(this.#database)); }
    catch (error) { throw mapStorageError(error); }
  }

  private async inTransaction<Result>(identity: PublicationIdentity, operation: (transaction: PublicationTransaction) => Promise<Result>): Promise<Result> {
    const transaction = await this.begin(identity);
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      try { await transaction.rollback(); } catch { /* transaction may already be closed */ }
      throw error;
    }
  }

  private assertOpen(): void {
    if (this.#closed || this.#quarantined) throw persistenceError("PERSISTENCE_WRITE_FAILED", "Durable Publication persistence is unavailable.");
  }
}

function persistScope(database: DatabaseSync, identity: PublicationIdentity, initialRevision: number, state: InMemoryPersistenceState): void {
  const key = persistenceKey(identity.tenantScopeId, identity.publicationId);
  const record = state.records.get(key);
  const history = state.histories.get(key) ?? [];
  const existing = database.prepare("SELECT revision FROM publication_scopes WHERE tenant_scope_id = ? AND publication_id = ?").get(identity.tenantScopeId, identity.publicationId);
  if (existing === undefined) {
    if (initialRevision !== 0) throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed.");
    database.prepare("INSERT INTO publication_scopes (tenant_scope_id, publication_id, revision, record_json, history_json) VALUES (?, ?, 1, ?, ?)")
      .run(identity.tenantScopeId, identity.publicationId, record === undefined ? null : JSON.stringify(record), JSON.stringify(history));
    return;
  }
  const result = database.prepare("UPDATE publication_scopes SET revision = revision + 1, record_json = ?, history_json = ? WHERE tenant_scope_id = ? AND publication_id = ? AND revision = ?")
    .run(record === undefined ? null : JSON.stringify(record), JSON.stringify(history), identity.tenantScopeId, identity.publicationId, initialRevision);
  if (Number(result.changes) !== 1) throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed.");
}

function persistAppendOnly(database: DatabaseSync, identity: PublicationIdentity, baseline: InMemoryPersistenceState, staged: InMemoryPersistenceState): void {
  for (const [key, record] of staged.idempotency) {
    if (record.tenantScopeId !== identity.tenantScopeId || record.aggregateId !== identity.publicationId || baseline.idempotency.has(key)) continue;
    database.prepare("INSERT INTO publication_idempotency (tenant_scope_id, publication_id, command_key, payload_json) VALUES (?, ?, ?, ?)")
      .run(identity.tenantScopeId, identity.publicationId, record.commandKey, JSON.stringify(record));
  }
  for (const [key, record] of staged.audits) {
    if (record.tenantScopeId !== identity.tenantScopeId || record.aggregateId !== identity.publicationId || baseline.audits.has(key)) continue;
    database.prepare("INSERT INTO publication_audit (id, tenant_scope_id, publication_id, payload_json) VALUES (?, ?, ?, ?)")
      .run(record.id, identity.tenantScopeId, identity.publicationId, JSON.stringify(record));
  }
  for (const [key, event] of staged.events) {
    if (event.tenantId !== identity.tenantScopeId || event.aggregateId !== identity.publicationId || baseline.events.has(key)) continue;
    database.prepare("INSERT INTO publication_events (tenant_scope_id, publication_id, event_id, payload_json) VALUES (?, ?, ?, ?)")
      .run(identity.tenantScopeId, identity.publicationId, event.eventId, JSON.stringify(event));
  }
  for (const [key, intent] of staged.executionIntents) {
    if (intent.tenantScopeId !== identity.tenantScopeId || intent.publicationId !== identity.publicationId || baseline.executionIntents.has(key)) continue;
    database.prepare("INSERT INTO publication_execution_intents (tenant_scope_id, publication_id, command_id, payload_json) VALUES (?, ?, ?, ?)")
      .run(identity.tenantScopeId, identity.publicationId, intent.commandId, JSON.stringify(intent));
  }
  for (const [key, events] of staged.dispatchEvents) {
    if (!key.startsWith(JSON.stringify([identity.tenantScopeId, identity.publicationId]).slice(0, -1) + ",")) continue;
    const initialCount = baseline.dispatchEvents.get(key)?.length ?? 0;
    for (const event of events.slice(initialCount)) {
      database.prepare("INSERT INTO publication_dispatch_events (tenant_scope_id, publication_id, command_id, sequence, payload_json) VALUES (?, ?, ?, ?, ?)")
        .run(identity.tenantScopeId, identity.publicationId, event.commandId, event.sequence, JSON.stringify(event));
    }
  }
  for (const [key, receipt] of staged.executionReceipts) {
    if (receipt.tenantScopeId !== identity.tenantScopeId || receipt.publicationId !== identity.publicationId || baseline.executionReceipts.has(key)) continue;
    database.prepare("INSERT INTO publication_execution_receipts (tenant_scope_id, publication_id, command_id, receipt_id, payload_json) VALUES (?, ?, ?, ?, ?)")
      .run(identity.tenantScopeId, identity.publicationId, receipt.commandId, receipt.receiptId, JSON.stringify(receipt));
  }
}

function loadState(database: DatabaseSync): InMemoryPersistenceState {
  const state = new InMemoryPersistenceState();
  for (const row of database.prepare("SELECT * FROM publication_scopes").all()) {
    const tenant = text(row["tenant_scope_id"]); const publication = text(row["publication_id"]); const key = persistenceKey(tenant, publication);
    const recordJson = row["record_json"];
    if (typeof recordJson === "string") {
      const record = parseJson<PublicationPersistenceRecord>(recordJson);
      PublicationAggregate.rehydrate(mapPersistenceToPublication(record));
      state.records.set(key, record);
    }
    const history = parseJson<readonly PublicationPersistenceRecord[]>(text(row["history_json"]));
    for (const record of history) PublicationAggregate.rehydrate(mapPersistenceToPublication(record));
    state.histories.set(key, history);
    state.setScopeRevision(tenant, publication, number(row["revision"]));
  }
  for (const row of database.prepare("SELECT payload_json FROM publication_idempotency").all()) { const record = parseJson<Parameters<PublicationIdempotencyStore["record"]>[0]>(text(row["payload_json"])); state.idempotency.set(JSON.stringify([record.tenantScopeId, record.aggregateId, record.commandKey]), record); }
  for (const row of database.prepare("SELECT payload_json FROM publication_audit").all()) { const record = parseJson<Parameters<PublicationAuditStore["append"]>[0]>(text(row["payload_json"])); state.audits.set(record.id, record); }
  for (const row of database.prepare("SELECT payload_json FROM publication_events").all()) { const event = parseJson<Parameters<PublicationEventJournal["append"]>[0]>(text(row["payload_json"])); state.events.set(JSON.stringify([event.tenantId, event.eventId]), event); }
  for (const row of database.prepare("SELECT payload_json FROM publication_execution_intents").all()) { const intent = parseJson<Parameters<PublicationExecutionJournal["prepare"]>[0]>(text(row["payload_json"])); state.executionIntents.set(executionKey(intent, intent.commandId), intent); }
  for (const row of database.prepare("SELECT payload_json FROM publication_dispatch_events ORDER BY sequence").all()) { const event = parseJson<PublicationDispatchEvent>(text(row["payload_json"])); const key = executionKey(event, event.commandId); state.dispatchEvents.set(key, [...(state.dispatchEvents.get(key) ?? []), event]); }
  for (const row of database.prepare("SELECT payload_json FROM publication_execution_receipts").all()) { const receipt = parseJson<Parameters<PublicationExecutionJournal["appendReceipt"]>[0]>(text(row["payload_json"])); state.executionReceipts.set(executionKey(receipt, receipt.commandId), receipt); }
  for (const [key, receipt] of state.executionReceipts) {
    if (!state.executionIntents.has(key) || !state.dispatchEvents.get(key)?.some((event) => event.state === "DISPATCH_STARTED")) {
      throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication execution linkage is invalid.");
    }
    if (state.executionIntents.get(key)?.attemptId !== receipt.attemptId) throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication execution linkage is invalid.");
  }
  return state;
}

function configureDatabase(database: DatabaseSync, timeout: number): void { database.exec("PRAGMA foreign_keys = ON"); database.exec("PRAGMA journal_mode = WAL"); database.exec("PRAGMA synchronous = FULL"); database.exec(`PRAGMA busy_timeout = ${timeout}`); }
function configurePreparedDatabase(database: DatabaseSync, timeout: number): void { database.exec("PRAGMA foreign_keys = ON"); database.exec(`PRAGMA busy_timeout = ${timeout}`); }
function bootstrapSchema(database: DatabaseSync): void {
  database.exec("BEGIN EXCLUSIVE");
  try {
    database.exec(SCHEMA_SQL);
    const row = database.prepare("SELECT schema_version FROM publication_schema WHERE singleton_id = 1").get();
    if (row === undefined) database.prepare("INSERT INTO publication_schema (singleton_id, schema_version) VALUES (1, ?)").run(SCHEMA_VERSION);
    else if (number(row["schema_version"]) !== SCHEMA_VERSION) throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication schema is incompatible.");
    database.exec("COMMIT");
  } catch (error) { try { database.exec("ROLLBACK"); } catch { /* constructor closes */ } throw error; }
}
function validateDatabase(database: DatabaseSync): void {
  const integrity = database.prepare("PRAGMA integrity_check").get();
  if (integrity?.["integrity_check"] !== "ok") throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication database failed integrity validation.");
  if (database.prepare("PRAGMA foreign_key_check").all().length > 0) throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication database failed linkage validation.");
}
function isFileDatabasePath(value: string): boolean { const normalized = value.trim().toLowerCase(); return normalized.length > 0 && normalized !== ":memory:" && !normalized.startsWith("file::memory:"); }
function parseJson<T>(value: string): T { return JSON.parse(value) as T; }
function text(value: SQLOutputValue | undefined): string { if (typeof value !== "string") throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication data is invalid."); return value; }
function number(value: SQLOutputValue | undefined): number { if (typeof value !== "number" && typeof value !== "bigint") throw persistenceError("PERSISTENCE_INPUT_INVALID", "Durable Publication data is invalid."); return Number(value); }
function mapStorageError(error: unknown): PublicationPersistenceError { return error instanceof PublicationPersistenceError ? error : persistenceError("PERSISTENCE_WRITE_FAILED", "Durable Publication persistence failed."); }

const APPEND_ONLY_TRIGGERS = ["publication_idempotency", "publication_audit", "publication_events", "publication_execution_intents", "publication_dispatch_events", "publication_execution_receipts"]
  .flatMap((table) => [`CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`, `CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END;`]).join("\n");
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS publication_schema (singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), schema_version INTEGER NOT NULL CHECK (schema_version > 0));
CREATE TABLE IF NOT EXISTS publication_scopes (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), record_json TEXT, history_json TEXT NOT NULL CHECK (json_valid(history_json)), PRIMARY KEY (tenant_scope_id, publication_id));
CREATE TABLE IF NOT EXISTS publication_idempotency (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, command_key TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_scope_id, publication_id, command_key), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE IF NOT EXISTS publication_audit (id TEXT PRIMARY KEY, tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE IF NOT EXISTS publication_events (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, event_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_scope_id, event_id), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE IF NOT EXISTS publication_execution_intents (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, command_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_scope_id, publication_id, command_id), FOREIGN KEY (tenant_scope_id, publication_id) REFERENCES publication_scopes (tenant_scope_id, publication_id));
CREATE TABLE IF NOT EXISTS publication_dispatch_events (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, command_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_scope_id, publication_id, command_id, sequence), FOREIGN KEY (tenant_scope_id, publication_id, command_id) REFERENCES publication_execution_intents (tenant_scope_id, publication_id, command_id));
CREATE TABLE IF NOT EXISTS publication_execution_receipts (tenant_scope_id TEXT NOT NULL, publication_id TEXT NOT NULL, command_id TEXT NOT NULL, receipt_id TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_scope_id, publication_id, command_id), FOREIGN KEY (tenant_scope_id, publication_id, command_id) REFERENCES publication_execution_intents (tenant_scope_id, publication_id, command_id));
${APPEND_ONLY_TRIGGERS}`;
