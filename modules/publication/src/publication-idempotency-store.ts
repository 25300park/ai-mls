import { immutableDomain, type PublicationIdentity } from "./publication-contracts.js";
import { InMemoryPersistenceState } from "./in-memory-persistence-state.js";
import { persistenceError } from "./publication-persistence-error.js";

export interface IdempotencyIdentity {
  readonly tenantScopeId: string;
  readonly aggregateId: string;
  readonly commandKey: string;
}

export interface IdempotencyRecord extends IdempotencyIdentity {
  readonly fingerprint: string;
  readonly resultReference: string;
  readonly recordedAt: string;
}

export interface IdempotencyRecordResult {
  readonly status: "STORED" | "REPLAYED";
  readonly record: IdempotencyRecord;
}

export interface PublicationIdempotencyStore {
  record(input: IdempotencyRecord): IdempotencyRecordResult;
  find(identity: IdempotencyIdentity): IdempotencyRecord | undefined;
}

export class InMemoryIdempotencyStore implements PublicationIdempotencyStore {
  public constructor(
    private readonly state: InMemoryPersistenceState = new InMemoryPersistenceState(),
    private readonly scope?: PublicationIdentity,
    private readonly assertUsable: () => void = () => undefined,
  ) {}

  public record(input: IdempotencyRecord): IdempotencyRecordResult {
    this.assertUsable();
    this.assertScope(input);
    const key = this.key(input);
    const existing = this.state.idempotency.get(key);
    if (existing !== undefined) {
      if (existing.fingerprint !== input.fingerprint) throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different intent.");
      return immutableDomain({ status: "REPLAYED" as const, record: existing });
    }
    const record = immutableDomain(input);
    this.state.idempotency.set(key, record);
    this.state.markScopeChanged(input.tenantScopeId, input.aggregateId);
    return immutableDomain({ status: "STORED" as const, record });
  }

  public find(identity: IdempotencyIdentity): IdempotencyRecord | undefined {
    this.assertUsable();
    this.assertScope(identity);
    const record = this.state.idempotency.get(this.key(identity));
    return record === undefined ? undefined : immutableDomain(record);
  }

  private key(identity: IdempotencyIdentity): string {
    return JSON.stringify([identity.tenantScopeId, identity.aggregateId, identity.commandKey]);
  }

  private assertScope(identity: IdempotencyIdentity): void {
    if (this.scope !== undefined && (identity.aggregateId !== this.scope.publicationId || identity.tenantScopeId !== this.scope.tenantScopeId)) {
      throw persistenceError("PERSISTENCE_SCOPE_VIOLATION", "Idempotency operation is outside the transaction scope.");
    }
  }
}
