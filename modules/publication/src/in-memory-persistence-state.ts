import type { PublicationPersistenceRecord } from "./publication-persistence-model.js";
import type { PublicationAuditRecord } from "./publication-audit-store.js";
import type { IdempotencyRecord } from "./publication-idempotency-store.js";

export class InMemoryPersistenceState {
  public records = new Map<string, PublicationPersistenceRecord>();
  public histories = new Map<string, readonly PublicationPersistenceRecord[]>();
  public idempotency = new Map<string, IdempotencyRecord>();
  public audits = new Map<string, PublicationAuditRecord>();
  private scopeRevisions = new Map<string, number>();

  public clone(): InMemoryPersistenceState {
    const copy = new InMemoryPersistenceState();
    copy.records = structuredClone(this.records);
    copy.histories = structuredClone(this.histories);
    copy.idempotency = structuredClone(this.idempotency);
    copy.audits = structuredClone(this.audits);
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
    this.scopeRevisions.set(key, source.scopeRevision(tenantScopeId, aggregateId));
  }
}

function replaceOptional<Value>(target: Map<string, Value>, source: Map<string, Value>, key: string): void {
  const value = source.get(key);
  if (value === undefined) target.delete(key);
  else target.set(key, structuredClone(value));
}

export function persistenceKey(tenantScopeId: string, aggregateId: string): string {
  return JSON.stringify([tenantScopeId, aggregateId]);
}
