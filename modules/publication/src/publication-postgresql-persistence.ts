import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/postgresql-pool.js";

import { PublicationAggregate } from "./publication-aggregate.js";
import { InMemoryPublicationAuditStore, type PublicationAuditRecord, type PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationIdentity } from "./publication-contracts.js";
import type { PublicationEventEnvelope } from "./publication-event-contracts.js";
import { InMemoryPublicationEventJournal } from "./in-memory-publication-event-journal.js";
import { InMemoryIdempotencyStore, type IdempotencyRecord, type PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { InMemoryPersistenceState, persistenceKey } from "./in-memory-persistence-state.js";
import { InMemoryPublicationRepository } from "./in-memory-publication-repository.js";
import { InMemoryPublicationExecutionJournal, executionKey, type PublicationDispatchEvent, type PublicationExecutionIntent, type PublicationExecutionJournal, type PublicationExecutionReceipt } from "./publication-execution-journal.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { persistenceError, PublicationPersistenceError } from "./publication-persistence-error.js";
import { mapPersistenceToPublication } from "./publication-persistence-mapper.js";
import type { PublicationPersistenceRecord } from "./publication-persistence-model.js";
import type { PublicationRepository } from "./publication-repository.js";
import type { PublicationTransaction, PublicationUnitOfWork } from "./publication-unit-of-work.js";

/** PostgreSQL persistence for API-014. Pool ownership remains with ProductionBootstrap. */
export class PostgreSqlPublicationUnitOfWork implements PublicationUnitOfWork {
  readonly #pool: PostgreSqlPoolPort;
  #closed = false;
  #quarantined = false;

  public readonly repository: PublicationRepository;
  public readonly idempotency: PublicationIdempotencyStore;
  public readonly audit: PublicationAuditStore;
  public readonly eventJournal: PublicationEventJournal;
  public readonly execution: PublicationExecutionJournal;

  public constructor(pool: PostgreSqlPoolPort) {
    this.#pool = pool;
    const repository: PublicationRepository = {
      save: (snapshot) => this.#inTransaction(snapshot, (transaction) => transaction.repository.save(snapshot)),
      update: (version, snapshot) => this.#inTransaction(snapshot, (transaction) => transaction.repository.update(version, snapshot)),
      find: (identity) => this.#read(identity, (state) => new InMemoryPublicationRepository(state).find(identity)),
      exists: (identity) => this.#read(identity, (state) => new InMemoryPublicationRepository(state).exists(identity)),
      checkVersion: (identity, version) => this.#read(identity, (state) => new InMemoryPublicationRepository(state).checkVersion(identity, version)),
      readHistory: (identity) => this.#read(identity, (state) => new InMemoryPublicationRepository(state).readHistory(identity)),
    };
    this.repository = repository;
    const idempotency: PublicationIdempotencyStore = {
      record: (record) => this.#inTransaction({ tenantScopeId: record.tenantScopeId, publicationId: record.aggregateId }, (transaction) => transaction.idempotency.record(record)),
      find: (identity) => this.#read({ tenantScopeId: identity.tenantScopeId, publicationId: identity.aggregateId }, (state) => new InMemoryIdempotencyStore(state).find(identity)),
    };
    this.idempotency = idempotency;
    const audit: PublicationAuditStore = {
      append: (record) => this.#inTransaction({ tenantScopeId: record.tenantScopeId, publicationId: record.aggregateId }, (transaction) => transaction.audit.append(record)),
      list: (identity) => this.#read(identity, (state) => new InMemoryPublicationAuditStore(state).list(identity)),
    };
    this.audit = audit;
    const eventJournal: PublicationEventJournal = {
      append: (event) => this.#inTransaction({ tenantScopeId: event.tenantId, publicationId: event.aggregateId }, (transaction) => transaction.eventJournal.append(event)),
      appendAll: (events) => events.length === 0
        ? Promise.resolve(Object.freeze([]))
        : this.#inTransaction({ tenantScopeId: events[0]!.tenantId, publicationId: events[0]!.aggregateId }, (transaction) => transaction.eventJournal.appendAll(events)),
      prepareAppend: (event) => {
        let committed = false;
        return Promise.resolve(Object.freeze({ event, commit: async () => {
          if (!committed) { committed = true; return await this.eventJournal.append(event); }
          const found = await this.eventJournal.findByEventId(event.tenantId, event.eventId);
          if (found === undefined) throw persistenceError("PERSISTENCE_WRITE_FAILED", "PostgreSQL Publication event is unavailable.");
          return Object.freeze({ status: "REPLAYED" as const, event: found });
        } }));
      },
      findByEventId: (tenantId, eventId) => this.#readEventScope(tenantId, eventId, (state) => new InMemoryPublicationEventJournal(state).findByEventId(tenantId, eventId)),
      listByAggregate: (tenantId, aggregateId) => this.#read({ tenantScopeId: tenantId, publicationId: aggregateId }, (state) => new InMemoryPublicationEventJournal(state).listByAggregate(tenantId, aggregateId)),
      getLastSequence: (tenantId, aggregateId) => this.#read({ tenantScopeId: tenantId, publicationId: aggregateId }, (state) => new InMemoryPublicationEventJournal(state).getLastSequence(tenantId, aggregateId)),
    };
    this.eventJournal = eventJournal;
    const execution: PublicationExecutionJournal = {
      prepare: (intent) => this.#inTransaction(intent, (transaction) => transaction.execution.prepare(intent)),
      markDispatchStarted: (identity, commandId, recordedAt) => this.#inTransaction(identity, (transaction) => transaction.execution.markDispatchStarted(identity, commandId, recordedAt)),
      appendReceipt: (receipt) => this.#inTransaction(receipt, (transaction) => transaction.execution.appendReceipt(receipt)),
      findIntent: (identity, commandId) => this.#read(identity, (state) => new InMemoryPublicationExecutionJournal(state).findIntent(identity, commandId)),
      findReceipt: (identity, commandId) => this.#read(identity, (state) => new InMemoryPublicationExecutionJournal(state).findReceipt(identity, commandId)),
      recoveryDisposition: (identity, commandId) => this.#read(identity, (state) => new InMemoryPublicationExecutionJournal(state).recoveryDisposition(identity, commandId)),
    };
    this.execution = execution;
  }

  public async begin(identity: PublicationIdentity): Promise<PublicationTransaction> {
    this.#assertOpen();
    let client: PostgreSqlClientPort | undefined;
    let transactionOpen = false;
    let completed = false;
    let discard = false;
    try {
      client = await this.#pool.connect();
      await query(client, "BEGIN");
      transactionOpen = true;
      const baseline = await loadScope(client, identity, true);
      const staged = baseline.clone();
      const ensureActive = (): void => {
        if (completed) throw persistenceError("TRANSACTION_ALREADY_COMPLETED", "The PostgreSQL Publication transaction has already completed.");
      };
      const finish = async (commit: boolean): Promise<void> => {
        ensureActive();
        let commitStarted = false;
        try {
          if (commit) {
            const baselineRevision = baseline.scopeRevision(identity.tenantScopeId, identity.publicationId);
            if (staged.scopeRevision(identity.tenantScopeId, identity.publicationId) !== baselineRevision) {
              await persistScope(client!, identity, baselineRevision, staged);
              await persistAppendOnly(client!, identity, baseline, staged);
            }
            commitStarted = true;
            await query(client!, "COMMIT");
          } else {
            await query(client!, "ROLLBACK");
          }
          transactionOpen = false;
        } catch (error) {
          discard = true;
          if (commitStarted) {
            // PostgreSQL may have committed before the client observed a transport failure.
            // Quarantine the UoW so no contradictory failure evidence can be appended.
            this.#quarantined = true;
          } else if (transactionOpen) {
            try { await query(client!, "ROLLBACK"); transactionOpen = false; } catch { /* release destroys the uncertain connection */ }
          }
          throw mapError(error);
        } finally {
          completed = true;
          client!.release(discard);
        }
      };
      return Object.freeze({
        repository: new InMemoryPublicationRepository(staged, identity, ensureActive),
        idempotency: new InMemoryIdempotencyStore(staged, identity, ensureActive),
        audit: new InMemoryPublicationAuditStore(staged, identity, ensureActive),
        eventJournal: new InMemoryPublicationEventJournal(staged, identity, ensureActive),
        execution: new InMemoryPublicationExecutionJournal(staged, identity, ensureActive),
        commit: () => finish(true),
        rollback: () => finish(false),
      });
    } catch (error) {
      if (transactionOpen && client !== undefined) try { await query(client, "ROLLBACK"); } catch { discard = true; }
      client?.release(discard);
      throw mapError(error);
    }
  }

  public close(): Promise<void> {
    this.#closed = true;
    return Promise.resolve();
  }

  async #read<Result>(identity: PublicationIdentity, operation: (state: InMemoryPersistenceState) => Promise<Result>): Promise<Result> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    let discard = false;
    try { return await operation(await loadScope(client, identity, false)); }
    catch (error) { discard = true; throw mapError(error); }
    finally { client.release(discard); }
  }

  async #readEventScope<Result>(tenantId: string, eventId: string, operation: (state: InMemoryPersistenceState) => Promise<Result>): Promise<Result> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    let discard = false;
    try {
      const found = await query<Row>(client, "SELECT publication_id FROM app_publication.publication_events WHERE tenant_scope_id=$1 AND event_id=$2", [tenantId, eventId]);
      const publicationId = text(found.rows[0]?.["publication_id"]);
      if (publicationId === undefined) return await operation(new InMemoryPersistenceState());
      return await operation(await loadScope(client, { tenantScopeId: tenantId, publicationId }, false));
    } catch (error) { discard = true; throw mapError(error); }
    finally { client.release(discard); }
  }

  async #inTransaction<Result>(identity: PublicationIdentity, operation: (transaction: PublicationTransaction) => Promise<Result>): Promise<Result> {
    const transaction = await this.begin(identity);
    try { const result = await operation(transaction); await transaction.commit(); return result; }
    catch (error) { try { await transaction.rollback(); } catch { /* transaction may already be completed */ } throw error; }
  }

  #assertOpen(): void {
    if (this.#closed || this.#quarantined) throw persistenceError("PERSISTENCE_WRITE_FAILED", "PostgreSQL Publication persistence is unavailable.");
  }
}

type Row = Record<string, unknown>;

async function loadScope(client: PostgreSqlClientPort, identity: PublicationIdentity, lock: boolean): Promise<InMemoryPersistenceState> {
  const state = new InMemoryPersistenceState();
  const values = [identity.tenantScopeId, identity.publicationId] as const;
  const scope = await query<Row>(client, `SELECT revision, record_json, history_json FROM app_publication.publication_scopes WHERE tenant_scope_id=$1 AND publication_id=$2${lock ? " FOR UPDATE" : ""}`, values);
  const row = scope.rows[0];
  const key = persistenceKey(identity.tenantScopeId, identity.publicationId);
  if (row !== undefined) {
    const record = json<PublicationPersistenceRecord | null>(row["record_json"]);
    if (record !== null) { validateRecord(record); state.records.set(key, record); }
    const history = json<readonly PublicationPersistenceRecord[]>(row["history_json"]);
    history.forEach(validateRecord);
    state.histories.set(key, history);
    state.setScopeRevision(identity.tenantScopeId, identity.publicationId, integer(row["revision"]));
  }
  const tables = [
    "publication_idempotency", "publication_audit", "publication_events",
    "publication_execution_intents", "publication_dispatch_events", "publication_execution_receipts",
  ] as const;
  for (const table of tables) {
    const order = table === "publication_dispatch_events" ? " ORDER BY sequence" : "";
    const result = await query<Row>(client, `SELECT payload_json FROM app_publication.${table} WHERE tenant_scope_id=$1 AND publication_id=$2${order}`, values);
    for (const item of result.rows) loadPayload(state, table, json<unknown>(item["payload_json"]));
  }
  return state;
}

function loadPayload(state: InMemoryPersistenceState, table: string, value: unknown): void {
  if (table === "publication_idempotency") {
    const payload = objectWithStrings<IdempotencyRecord>(value, ["tenantScopeId", "aggregateId", "commandKey"]);
    state.idempotency.set(JSON.stringify([payload.tenantScopeId, payload.aggregateId, payload.commandKey]), payload);
  } else if (table === "publication_audit") {
    const payload = objectWithStrings<PublicationAuditRecord>(value, ["id", "tenantScopeId", "aggregateId"]);
    state.audits.set(payload.id, payload);
  } else if (table === "publication_events") {
    const payload = objectWithStrings<PublicationEventEnvelope>(value, ["tenantId", "eventId", "aggregateId"]);
    state.events.set(JSON.stringify([payload.tenantId, payload.eventId]), payload);
  } else if (table === "publication_execution_intents") {
    const payload = objectWithStrings<PublicationExecutionIntent>(value, ["tenantScopeId", "publicationId", "commandId"]);
    state.executionIntents.set(executionKey(payload, payload.commandId), payload);
  } else if (table === "publication_dispatch_events") {
    const payload = objectWithStrings<PublicationDispatchEvent>(value, ["tenantScopeId", "publicationId", "commandId"]);
    const key = executionKey(payload, payload.commandId);
    state.dispatchEvents.set(key, [...(state.dispatchEvents.get(key) ?? []), payload]);
  } else if (table === "publication_execution_receipts") {
    const payload = objectWithStrings<PublicationExecutionReceipt>(value, ["tenantScopeId", "publicationId", "commandId"]);
    state.executionReceipts.set(executionKey(payload, payload.commandId), payload);
  }
}

async function persistScope(client: PostgreSqlClientPort, identity: PublicationIdentity, revision: number, state: InMemoryPersistenceState): Promise<void> {
  const key = persistenceKey(identity.tenantScopeId, identity.publicationId);
  const record = state.records.get(key);
  const history = state.histories.get(key) ?? [];
  if (revision === 0) {
    await query(client, "INSERT INTO app_publication.publication_scopes(tenant_scope_id,publication_id,revision,record_json,history_json) VALUES($1,$2,1,$3::jsonb,$4::jsonb)", [identity.tenantScopeId, identity.publicationId, record === undefined ? null : JSON.stringify(record), JSON.stringify(history)]);
    return;
  }
  const result = await query(client, "UPDATE app_publication.publication_scopes SET revision=revision+1,record_json=$1::jsonb,history_json=$2::jsonb WHERE tenant_scope_id=$3 AND publication_id=$4 AND revision=$5", [record === undefined ? null : JSON.stringify(record), JSON.stringify(history), identity.tenantScopeId, identity.publicationId, revision]);
  if (result.rowCount !== 1) throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed.");
}

async function persistAppendOnly(client: PostgreSqlClientPort, identity: PublicationIdentity, baseline: InMemoryPersistenceState, staged: InMemoryPersistenceState): Promise<void> {
  for (const [key, record] of staged.idempotency) if (!baseline.idempotency.has(key) && record.tenantScopeId === identity.tenantScopeId && record.aggregateId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_idempotency(tenant_scope_id,publication_id,command_key,payload_json) VALUES($1,$2,$3,$4::jsonb)", [identity.tenantScopeId, identity.publicationId, record.commandKey, JSON.stringify(record)]);
  for (const [key, record] of staged.audits) if (!baseline.audits.has(key) && record.tenantScopeId === identity.tenantScopeId && record.aggregateId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_audit(id,tenant_scope_id,publication_id,payload_json) VALUES($1,$2,$3,$4::jsonb)", [record.id, identity.tenantScopeId, identity.publicationId, JSON.stringify(record)]);
  for (const [key, event] of staged.events) if (!baseline.events.has(key) && event.tenantId === identity.tenantScopeId && event.aggregateId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_events(tenant_scope_id,publication_id,event_id,payload_json) VALUES($1,$2,$3,$4::jsonb)", [identity.tenantScopeId, identity.publicationId, event.eventId, JSON.stringify(event)]);
  for (const [key, intent] of staged.executionIntents) if (!baseline.executionIntents.has(key) && intent.tenantScopeId === identity.tenantScopeId && intent.publicationId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_execution_intents(tenant_scope_id,publication_id,command_id,payload_json) VALUES($1,$2,$3,$4::jsonb)", [identity.tenantScopeId, identity.publicationId, intent.commandId, JSON.stringify(intent)]);
  for (const [key, events] of staged.dispatchEvents) {
    const count = baseline.dispatchEvents.get(key)?.length ?? 0;
    for (const event of events.slice(count)) if (event.tenantScopeId === identity.tenantScopeId && event.publicationId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_dispatch_events(tenant_scope_id,publication_id,command_id,sequence,payload_json) VALUES($1,$2,$3,$4,$5::jsonb)", [identity.tenantScopeId, identity.publicationId, event.commandId, event.sequence, JSON.stringify(event)]);
  }
  for (const [key, receipt] of staged.executionReceipts) if (!baseline.executionReceipts.has(key) && receipt.tenantScopeId === identity.tenantScopeId && receipt.publicationId === identity.publicationId) await query(client, "INSERT INTO app_publication.publication_execution_receipts(tenant_scope_id,publication_id,command_id,receipt_id,payload_json) VALUES($1,$2,$3,$4,$5::jsonb)", [identity.tenantScopeId, identity.publicationId, receipt.commandId, receipt.receiptId, JSON.stringify(receipt)]);
}

async function query<R extends Row = Row>(client: PostgreSqlClientPort, sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<R>> {
  try { return await client.query<R>(sql, values); }
  catch (error) {
    const postgresCode = typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : undefined;
    const mapped = postgresCode === "40001" || postgresCode === "40P01"
      ? persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed.")
      : postgresCode === "23505" && sql.includes("INSERT INTO app_publication.publication_scopes")
        ? persistenceError("PUBLICATION_ALREADY_EXISTS", "Publication already exists.")
        : persistenceError("PERSISTENCE_WRITE_FAILED", "PostgreSQL Publication persistence failed.");
    if (postgresCode !== undefined) (mapped as PublicationPersistenceError & { postgresCode?: string }).postgresCode = postgresCode;
    throw mapped;
  }
}

function mapError(error: unknown): PublicationPersistenceError {
  if (error instanceof PublicationPersistenceError) return error;
  return persistenceError("PERSISTENCE_WRITE_FAILED", "PostgreSQL Publication persistence failed.");
}

function json<T>(value: unknown): T {
  try { return (typeof value === "string" ? JSON.parse(value) : value) as T; }
  catch { throw persistenceError("PERSISTENCE_INPUT_INVALID", "PostgreSQL Publication data is invalid."); }
}

function integer(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw persistenceError("PERSISTENCE_INPUT_INVALID", "PostgreSQL Publication revision is invalid.");
  return parsed;
}

function text(value: unknown): string | undefined { return typeof value === "string" && value.length > 0 ? value : undefined; }

function objectWithStrings<T extends object>(value: unknown, properties: readonly string[]): T {
  if (typeof value !== "object" || value === null || properties.some((property) => typeof Reflect.get(value, property) !== "string")) {
    throw persistenceError("PERSISTENCE_INPUT_INVALID", "PostgreSQL Publication data is invalid.");
  }
  return value as T;
}

function validateRecord(record: PublicationPersistenceRecord): void {
  try { PublicationAggregate.rehydrate(mapPersistenceToPublication(record)); }
  catch { throw persistenceError("PERSISTENCE_INPUT_INVALID", "PostgreSQL Publication record is invalid."); }
}
