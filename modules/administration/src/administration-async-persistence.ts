import type {
  AdministrationDecisionRecord,
  AdministrationIdempotencyIdentity,
  AdministrationIdempotencyRecord,
  AdministrationIdempotencyResult,
  AdministrationPersistenceScope,
  AdministrationProposalRecord,
  AdministrationTransaction,
  AdministrationTransactionIdentity,
  AdministrationUnitOfWork,
  AdministrationDecisionReadRepository,
  AdministrationIdempotencyReadRepository,
  AdministrationProposalReadRepository,
  PolicyReadRepository,
  PublicationTargetReadRepository,
  RoleAssignmentReadRepository,
  RoleReadRepository,
  SourceGovernanceReadRepository,
  TeamScopeReadRepository,
  PolicyPersistenceRecord,
  PublicationTargetGovernancePersistenceRecord,
  RoleAssignmentPersistenceRecord,
  RolePersistenceRecord,
  SourceGovernancePersistenceRecord,
  TeamScopePersistenceRecord,
} from "./administration-persistence.js";
import { DurableAdministrationUnitOfWork, type DurableAdministrationUnitOfWorkOptions } from "./administration-durable-persistence.js";

export interface AsyncRoleAssignmentReadRepository {
  find(identity: AdministrationTransactionIdentity): Promise<RoleAssignmentPersistenceRecord | undefined>;
  listByScope(scope: AdministrationPersistenceScope): Promise<readonly RoleAssignmentPersistenceRecord[]>;
  listBySubject(tenantId: string, subjectPrincipalId: string): Promise<readonly RoleAssignmentPersistenceRecord[]>;
}
export interface AsyncRoleReadRepository { find(identity: AdministrationTransactionIdentity): Promise<RolePersistenceRecord | undefined>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly RolePersistenceRecord[]> }
export interface AsyncPolicyReadRepository { find(identity: AdministrationTransactionIdentity): Promise<PolicyPersistenceRecord | undefined>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly PolicyPersistenceRecord[]> }
export interface AsyncTeamScopeReadRepository { find(identity: AdministrationTransactionIdentity): Promise<TeamScopePersistenceRecord | undefined>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly TeamScopePersistenceRecord[]> }
export interface AsyncSourceGovernanceReadRepository { find(identity: AdministrationTransactionIdentity): Promise<SourceGovernancePersistenceRecord | undefined>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly SourceGovernancePersistenceRecord[]> }
export interface AsyncPublicationTargetReadRepository { find(identity: AdministrationTransactionIdentity): Promise<PublicationTargetGovernancePersistenceRecord | undefined>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly PublicationTargetGovernancePersistenceRecord[]> }
export interface AsyncAdministrationProposalReadRepository { findById(tenantId: string, proposalId: string): Promise<AdministrationProposalRecord | undefined>; listPending(scope: AdministrationPersistenceScope): Promise<readonly AdministrationProposalRecord[]>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly AdministrationProposalRecord[]> }
export interface AsyncAdministrationDecisionReadRepository { findById(tenantId: string, decisionId: string): Promise<AdministrationDecisionRecord | undefined>; list(identity: AdministrationTransactionIdentity): Promise<readonly AdministrationDecisionRecord[]>; listByScope(scope: AdministrationPersistenceScope): Promise<readonly AdministrationDecisionRecord[]> }
export interface AsyncAdministrationIdempotencyReadRepository { find(identity: AdministrationIdempotencyIdentity): Promise<AdministrationIdempotencyRecord | undefined> }

export interface AsyncAdministrationTransaction extends Omit<AdministrationTransaction, "commit" | "rollback"> {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface AsyncAdministrationUnitOfWork {
  readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  readonly roles: AsyncRoleReadRepository;
  readonly policies: AsyncPolicyReadRepository;
  readonly teamScopes: AsyncTeamScopeReadRepository;
  readonly sourceGovernance: AsyncSourceGovernanceReadRepository;
  readonly publicationTargets: AsyncPublicationTargetReadRepository;
  readonly proposals: AsyncAdministrationProposalReadRepository;
  readonly decisions: AsyncAdministrationDecisionReadRepository;
  readonly idempotency: AsyncAdministrationIdempotencyReadRepository;
  begin(identity: AdministrationTransactionIdentity): Promise<AsyncAdministrationTransaction>;
  close(): Promise<void>;
}

export interface SynchronousAdministrationPersistence extends AdministrationUnitOfWork {
  readonly roleAssignments: RoleAssignmentReadRepository;
  readonly roles: RoleReadRepository;
  readonly policies: PolicyReadRepository;
  readonly teamScopes: TeamScopeReadRepository;
  readonly sourceGovernance: SourceGovernanceReadRepository;
  readonly publicationTargets: PublicationTargetReadRepository;
  readonly proposals: AdministrationProposalReadRepository;
  readonly decisions: AdministrationDecisionReadRepository;
  readonly idempotency: AdministrationIdempotencyReadRepository;
  close?(): void;
}

export function adaptSynchronousAdministrationPersistence(delegate: SynchronousAdministrationPersistence): AsyncAdministrationUnitOfWork {
  return new AsyncAdministrationPersistenceAdapter(delegate);
}

class AsyncAdministrationPersistenceAdapter implements AsyncAdministrationUnitOfWork {
  public readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  public readonly roles: AsyncRoleReadRepository;
  public readonly policies: AsyncPolicyReadRepository;
  public readonly teamScopes: AsyncTeamScopeReadRepository;
  public readonly sourceGovernance: AsyncSourceGovernanceReadRepository;
  public readonly publicationTargets: AsyncPublicationTargetReadRepository;
  public readonly proposals: AsyncAdministrationProposalReadRepository;
  public readonly decisions: AsyncAdministrationDecisionReadRepository;
  public readonly idempotency: AsyncAdministrationIdempotencyReadRepository;

  public constructor(private readonly delegate: SynchronousAdministrationPersistence) {
    this.roleAssignments = {
      find: (identity): Promise<RoleAssignmentPersistenceRecord | undefined> => Promise.resolve(delegate.roleAssignments.find(identity)),
      listByScope: (scope): Promise<readonly RoleAssignmentPersistenceRecord[]> => Promise.resolve(delegate.roleAssignments.listByScope(scope)),
      listBySubject: (tenantId, subjectPrincipalId): Promise<readonly RoleAssignmentPersistenceRecord[]> => Promise.resolve(delegate.roleAssignments.listBySubject(tenantId, subjectPrincipalId)),
    };
    this.roles = { find: (identity): Promise<RolePersistenceRecord | undefined> => Promise.resolve(delegate.roles.find(identity)), listByScope: (scope): Promise<readonly RolePersistenceRecord[]> => Promise.resolve(delegate.roles.listByScope(scope)) };
    this.policies = { find: (identity): Promise<PolicyPersistenceRecord | undefined> => Promise.resolve(delegate.policies.find(identity)), listByScope: (scope): Promise<readonly PolicyPersistenceRecord[]> => Promise.resolve(delegate.policies.listByScope(scope)) };
    this.teamScopes = { find: (identity): Promise<TeamScopePersistenceRecord | undefined> => Promise.resolve(delegate.teamScopes.find(identity)), listByScope: (scope): Promise<readonly TeamScopePersistenceRecord[]> => Promise.resolve(delegate.teamScopes.listByScope(scope)) };
    this.sourceGovernance = { find: (identity): Promise<SourceGovernancePersistenceRecord | undefined> => Promise.resolve(delegate.sourceGovernance.find(identity)), listByScope: (scope): Promise<readonly SourceGovernancePersistenceRecord[]> => Promise.resolve(delegate.sourceGovernance.listByScope(scope)) };
    this.publicationTargets = { find: (identity): Promise<PublicationTargetGovernancePersistenceRecord | undefined> => Promise.resolve(delegate.publicationTargets.find(identity)), listByScope: (scope): Promise<readonly PublicationTargetGovernancePersistenceRecord[]> => Promise.resolve(delegate.publicationTargets.listByScope(scope)) };
    this.proposals = { findById: (tenantId, proposalId): Promise<AdministrationProposalRecord | undefined> => Promise.resolve(delegate.proposals.findById(tenantId, proposalId)), listPending: (scope): Promise<readonly AdministrationProposalRecord[]> => Promise.resolve(delegate.proposals.listPending(scope)), listByScope: (scope): Promise<readonly AdministrationProposalRecord[]> => Promise.resolve(delegate.proposals.listByScope(scope)) };
    this.decisions = { findById: (tenantId, decisionId): Promise<AdministrationDecisionRecord | undefined> => Promise.resolve(delegate.decisions.findById(tenantId, decisionId)), list: (identity): Promise<readonly AdministrationDecisionRecord[]> => Promise.resolve(delegate.decisions.list(identity)), listByScope: (scope): Promise<readonly AdministrationDecisionRecord[]> => Promise.resolve(delegate.decisions.listByScope(scope)) };
    this.idempotency = { find: (identity): Promise<AdministrationIdempotencyRecord | undefined> => Promise.resolve(delegate.idempotency.find(identity)) };
  }
  public begin(identity: AdministrationTransactionIdentity): Promise<AsyncAdministrationTransaction> {
    const transaction = this.delegate.begin(identity);
    return Promise.resolve(Object.freeze({
      ...transaction,
      commit: (): Promise<void> => { transaction.commit(); return Promise.resolve(); },
      rollback: (): Promise<void> => { transaction.rollback(); return Promise.resolve(); },
    }));
  }
  public close(): Promise<void> { this.delegate.close?.(); return Promise.resolve(); }
}

/** Async parity adapter for the canonical Local/Test SQLite persistence. */
export class AsyncDurableAdministrationUnitOfWork implements AsyncAdministrationUnitOfWork {
  readonly #adapter: AsyncAdministrationUnitOfWork;
  public readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  public readonly roles: AsyncRoleReadRepository;
  public readonly policies: AsyncPolicyReadRepository;
  public readonly teamScopes: AsyncTeamScopeReadRepository;
  public readonly sourceGovernance: AsyncSourceGovernanceReadRepository;
  public readonly publicationTargets: AsyncPublicationTargetReadRepository;
  public readonly proposals: AsyncAdministrationProposalReadRepository;
  public readonly decisions: AsyncAdministrationDecisionReadRepository;
  public readonly idempotency: AsyncAdministrationIdempotencyReadRepository;

  public constructor(options: DurableAdministrationUnitOfWorkOptions) {
    this.#adapter = adaptSynchronousAdministrationPersistence(new DurableAdministrationUnitOfWork(options));
    this.roleAssignments = this.#adapter.roleAssignments;
    this.roles = this.#adapter.roles;
    this.policies = this.#adapter.policies;
    this.teamScopes = this.#adapter.teamScopes;
    this.sourceGovernance = this.#adapter.sourceGovernance;
    this.publicationTargets = this.#adapter.publicationTargets;
    this.proposals = this.#adapter.proposals;
    this.decisions = this.#adapter.decisions;
    this.idempotency = this.#adapter.idempotency;
  }

  public async begin(identity: AdministrationTransactionIdentity): Promise<AsyncAdministrationTransaction> {
    return this.#adapter.begin(identity);
  }

  public async close(): Promise<void> { await this.#adapter.close(); }
}

export type { AdministrationIdempotencyResult };
