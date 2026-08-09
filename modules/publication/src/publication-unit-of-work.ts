import type { PublicationIdentity } from "./publication-contracts.js";
import { InMemoryPublicationAuditStore, type PublicationAuditStore } from "./publication-audit-store.js";
import { InMemoryIdempotencyStore, type PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { InMemoryPersistenceState } from "./in-memory-persistence-state.js";
import { InMemoryPublicationRepository } from "./in-memory-publication-repository.js";
import { InMemoryPublicationEventJournal } from "./in-memory-publication-event-journal.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationRepository } from "./publication-repository.js";

export interface PublicationTransaction {
  readonly repository: PublicationRepository;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
  readonly eventJournal: PublicationEventJournal;
  commit(): void;
  rollback(): void;
}

export interface PublicationUnitOfWork {
  begin(identity: PublicationIdentity): PublicationTransaction;
}

export class InMemoryPublicationUnitOfWork implements PublicationUnitOfWork {
  private readonly state = new InMemoryPersistenceState();
  private active = false;

  public readonly repository = new InMemoryPublicationRepository(this.state);
  public readonly idempotency = new InMemoryIdempotencyStore(this.state);
  public readonly audit = new InMemoryPublicationAuditStore(this.state);
  public readonly eventJournal = new InMemoryPublicationEventJournal(this.state);

  public begin(identity: PublicationIdentity): PublicationTransaction {
    if (this.active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE", "A logical transaction is already active.");
    this.active = true;
    const staged = this.state.clone();
    const initialScopeRevision = this.state.scopeRevision(identity.tenantScopeId, identity.publicationId);
    let completed = false;

    const ensureActive = (): void => {
      if (completed) throw persistenceError("TRANSACTION_ALREADY_COMPLETED", "The logical transaction has already completed.");
    };

    const finish = (commit: boolean): void => {
      ensureActive();
      if (commit && this.state.scopeRevision(identity.tenantScopeId, identity.publicationId) !== initialScopeRevision) {
        completed = true;
        this.active = false;
        throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed during the logical transaction.");
      }
      if (commit && this.state.hasAuditIdentityCollision(staged, identity.tenantScopeId, identity.publicationId)) {
        completed = true;
        this.active = false;
        throw persistenceError("AUDIT_RECORD_DUPLICATE", "Audit identity was concurrently assigned outside the transaction scope.");
      }
      if (commit) this.state.replaceScopeWith(staged, identity.tenantScopeId, identity.publicationId);
      completed = true;
      this.active = false;
    };

    return {
      repository: new InMemoryPublicationRepository(staged, identity, ensureActive),
      idempotency: new InMemoryIdempotencyStore(staged, identity, ensureActive),
      audit: new InMemoryPublicationAuditStore(staged, identity, ensureActive),
      eventJournal: new InMemoryPublicationEventJournal(staged, identity, ensureActive),
      commit: (): void => { finish(true); },
      rollback: (): void => { finish(false); },
    };
  }
}
