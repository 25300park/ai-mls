import { immutableDomain, type PublicationIdentity, type PublicationSnapshot } from "./publication-contracts.js";
import { InMemoryPersistenceState, persistenceKey } from "./in-memory-persistence-state.js";
import { persistenceError } from "./publication-persistence-error.js";
import { mapPersistenceToPublication, mapPublicationToPersistence } from "./publication-persistence-mapper.js";
import type { PublicationRepository } from "./publication-repository.js";

export class InMemoryPublicationRepository implements PublicationRepository {
  public constructor(
    private readonly state: InMemoryPersistenceState = new InMemoryPersistenceState(),
    private readonly scope?: PublicationIdentity,
    private readonly assertUsable: () => void = () => undefined,
  ) {}

  public save(snapshot: PublicationSnapshot): void {
    this.assertUsable();
    this.assertScope(snapshot);
    const key = persistenceKey(snapshot.tenantScopeId, snapshot.publicationId);
    if (this.state.records.has(key)) throw persistenceError("PUBLICATION_ALREADY_EXISTS", "Publication already exists.");
    const record = mapPublicationToPersistence(snapshot);
    this.state.records.set(key, record);
    this.state.histories.set(key, immutableDomain([record]));
    this.state.markScopeChanged(snapshot.tenantScopeId, snapshot.publicationId);
  }

  public update(expectedAggregateVersion: number, snapshot: PublicationSnapshot): void {
    this.assertUsable();
    this.assertScope(snapshot);
    const key = persistenceKey(snapshot.tenantScopeId, snapshot.publicationId);
    const current = this.state.records.get(key);
    if (current === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
    if (current.versions.aggregateVersion !== expectedAggregateVersion) throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication version conflict.");
    if (snapshot.aggregateVersion !== expectedAggregateVersion + 1) throw persistenceError("PUBLICATION_REVISION_INVALID", "Publication revision must advance by one.");
    const record = mapPublicationToPersistence(snapshot);
    const history = this.state.histories.get(key) ?? [];
    this.state.records.set(key, record);
    this.state.histories.set(key, immutableDomain([...history, record]));
    this.state.markScopeChanged(snapshot.tenantScopeId, snapshot.publicationId);
  }

  public find(identity: PublicationIdentity): PublicationSnapshot | undefined {
    this.assertUsable();
    this.assertScope(identity);
    const record = this.state.records.get(persistenceKey(identity.tenantScopeId, identity.publicationId));
    return record === undefined ? undefined : mapPersistenceToPublication(record);
  }

  public exists(identity: PublicationIdentity): boolean {
    return this.find(identity) !== undefined;
  }

  public checkVersion(identity: PublicationIdentity, expectedAggregateVersion: number): boolean {
    return this.find(identity)?.aggregateVersion === expectedAggregateVersion;
  }

  public readHistory(identity: PublicationIdentity): readonly PublicationSnapshot[] {
    this.assertUsable();
    this.assertScope(identity);
    const history = this.state.histories.get(persistenceKey(identity.tenantScopeId, identity.publicationId)) ?? [];
    return immutableDomain(history.map(mapPersistenceToPublication));
  }

  private assertScope(identity: PublicationIdentity): void {
    if (this.scope !== undefined && (identity.publicationId !== this.scope.publicationId || identity.tenantScopeId !== this.scope.tenantScopeId)) {
      throw persistenceError("PERSISTENCE_SCOPE_VIOLATION", "Persistence operation is outside the transaction scope.");
    }
  }
}
