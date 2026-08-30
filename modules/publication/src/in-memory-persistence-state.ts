import type { PublicationPersistenceRecord } from "./publication-persistence-model.js";
import type { PublicationAuditRecord } from "./publication-audit-store.js";
import type { IdempotencyRecord } from "./publication-idempotency-store.js";
import type { PublicationEventEnvelope } from "./publication-event-contracts.js";
import type { PublicationDispatchEvent, PublicationExecutionIntent, PublicationExecutionReceipt } from "./publication-execution-journal.js";

export class InMemoryPersistenceState {
  public records = new Map<string, PublicationPersistenceRecord>();
  public histories = new Map<string, readonly PublicationPersistenceRecord[]>();
  public idempotency = new Map<string, IdempotencyRecord>();
  public audits = new Map<string, PublicationAuditRecord>();
  public events = new Map<string, PublicationEventEnvelope>();
  public executionIntents = new Map<string, PublicationExecutionIntent>();
  public dispatchEvents = new Map<string, readonly PublicationDispatchEvent[]>();
  public executionReceipts = new Map<string, PublicationExecutionReceipt>();
  private scopeRevisions = new Map<string, number>();

  public clone(): InMemoryPersistenceState {
    const copy = new InMemoryPersistenceState();
    copy.records = structuredClone(this.records);
    copy.histories = structuredClone(this.histories);
    copy.idempotency = structuredClone(this.idempotency);
    copy.audits = structuredClone(this.audits);
    copy.events = structuredClone(this.events);
    copy.executionIntents = structuredClone(this.executionIntents);
    copy.dispatchEvents = structuredClone(this.dispatchEvents);
    copy.executionReceipts = structuredClone(this.executionReceipts);
    copy.scopeRevisions = structuredClone(this.scopeRevisions);
    return copy;
  }

  public scopeRevision(tenantScopeId: string, aggregateId: string): number {
    return this.scopeRevisions.get(persistenceKey(tenantScopeId, aggregateId)) ?? 0;
  }

  public markScopeChanged(tenantScopeId: string, aggregateId: string): void {
    const key = persistenceKey(tenantScopeId, aggregateId);
    this.scopeRevisions.set(key, this.scopeRevision(tenantScopeId, aggregateId) + 1);
  }

  public setScopeRevision(tenantScopeId: string, aggregateId: string, revision: number): void {
    this.scopeRevisions.set(persistenceKey(tenantScopeId, aggregateId), revision);
  }

  public replaceAllWith(source: InMemoryPersistenceState): void {
    this.records = structuredClone(source.records);
    this.histories = structuredClone(source.histories);
    this.idempotency = structuredClone(source.idempotency);
    this.audits = structuredClone(source.audits);
    this.events = structuredClone(source.events);
    this.executionIntents = structuredClone(source.executionIntents);
    this.dispatchEvents = structuredClone(source.dispatchEvents);
    this.executionReceipts = structuredClone(source.executionReceipts);
    this.scopeRevisions = structuredClone(source.scopeRevisions);
  }

  public hasAuditIdentityCollision(source: InMemoryPersistenceState, tenantScopeId: string, aggregateId: string): boolean {
    for (const [entryKey, record] of source.audits) {
      if (record.tenantScopeId !== tenantScopeId || record.aggregateId !== aggregateId) continue;
      const existing = this.audits.get(entryKey);
      if (existing !== undefined && (existing.tenantScopeId !== tenantScopeId || existing.aggregateId !== aggregateId)) return true;
    }
    return false;
  }

  public replaceScopeWith(source: InMemoryPersistenceState, tenantScopeId: string, aggregateId: string): void {
    const key = persistenceKey(tenantScopeId, aggregateId);
    replaceOptional(this.records, source.records, key);
    replaceOptional(this.histories, source.histories, key);

    for (const [entryKey, record] of this.idempotency) {
      if (record.tenantScopeId === tenantScopeId && record.aggregateId === aggregateId) this.idempotency.delete(entryKey);
    }
    for (const [entryKey, record] of source.idempotency) {
      if (record.tenantScopeId === tenantScopeId && record.aggregateId === aggregateId) this.idempotency.set(entryKey, structuredClone(record));
    }

    for (const [entryKey, record] of this.audits) {
      if (record.tenantScopeId === tenantScopeId && record.aggregateId === aggregateId) this.audits.delete(entryKey);
    }
    for (const [entryKey, record] of source.audits) {
      if (record.tenantScopeId === tenantScopeId && record.aggregateId === aggregateId) this.audits.set(entryKey, structuredClone(record));
    }

    for (const [entryKey, event] of this.events) {
      if (event.tenantId === tenantScopeId && event.aggregateId === aggregateId) this.events.delete(entryKey);
    }
    for (const [entryKey, event] of source.events) {
      if (event.tenantId === tenantScopeId && event.aggregateId === aggregateId) this.events.set(entryKey, structuredClone(event));
    }
    replaceScopedMap(this.executionIntents, source.executionIntents, tenantScopeId, aggregateId);
    replaceScopedMap(this.dispatchEvents, source.dispatchEvents, tenantScopeId, aggregateId);
    replaceScopedMap(this.executionReceipts, source.executionReceipts, tenantScopeId, aggregateId);
    this.scopeRevisions.set(key, source.scopeRevision(tenantScopeId, aggregateId));
  }
}

function replaceScopedMap<Value>(target: Map<string, Value>, source: Map<string, Value>, tenantScopeId: string, publicationId: string): void {
  const prefix = JSON.stringify([tenantScopeId, publicationId]).slice(0, -1) + ",";
  for (const key of target.keys()) if (key.startsWith(prefix)) target.delete(key);
  for (const [key, value] of source) if (key.startsWith(prefix)) target.set(key, structuredClone(value));
}

function replaceOptional<Value>(target: Map<string, Value>, source: Map<string, Value>, key: string): void {
  const value = source.get(key);
  if (value === undefined) target.delete(key);
  else target.set(key, structuredClone(value));
}

export function persistenceKey(tenantScopeId: string, aggregateId: string): string {
  return JSON.stringify([tenantScopeId, aggregateId]);
}
