import type { PrincipalType, RoleCode } from "../../../packages/security-contracts/src/index.js";
import {
  AdministrationTransactionState,
  clone,
  createAdministrationReadRepositories,
  createAdministrationTransaction,
  identityKey,
  validateHydratedRole,
} from "./administration-persistence-engine.js";

export type AdministrationPersistenceResourceType =
  | "ROLE_ASSIGNMENT" | "ROLE" | "POLICY" | "TEAM_SCOPE" | "SOURCE_REGISTRY" | "PUBLICATION_TARGET";
export type AdministrationPersistenceScopeType = "TENANT" | "TEAM" | "ORGANIZATION" | "RESOURCE" | "POLICY" | "SOURCE" | "TARGET";
export type AdministrationPersistenceFailurePoint = "STATE_WRITE" | "DECISION_APPEND" | "IDEMPOTENCY_WRITE" | "COMMIT";
export type AdministrationPersistenceOperation =
  | "PROPOSE_ROLE_ASSIGNMENT" | "APPROVE_ROLE_ASSIGNMENT" | "REJECT_ROLE_ASSIGNMENT" | "REVOKE_ROLE_ASSIGNMENT"
  | "PROPOSE_ROLE_CHANGE" | "APPROVE_ROLE_CHANGE" | "REJECT_ROLE_CHANGE"
  | "PROPOSE_POLICY_CHANGE" | "APPROVE_POLICY_CHANGE" | "REJECT_POLICY_CHANGE"
  | "PROPOSE_TEAM_SCOPE_CHANGE" | "APPROVE_TEAM_SCOPE_CHANGE" | "REJECT_TEAM_SCOPE_CHANGE"
  | "PROPOSE_SOURCE_GOVERNANCE" | "APPROVE_SOURCE_GOVERNANCE" | "REJECT_SOURCE_GOVERNANCE" | "TRANSITION_SOURCE_GOVERNANCE"
  | "PROPOSE_PUBLICATION_TARGET_GOVERNANCE" | "APPROVE_PUBLICATION_TARGET_GOVERNANCE" | "REJECT_PUBLICATION_TARGET_GOVERNANCE" | "TRANSITION_PUBLICATION_TARGET_GOVERNANCE";

export interface AdministrationPersistenceScope {
  readonly tenantId: string;
  readonly scopeType: AdministrationPersistenceScopeType;
  readonly scopeId: string;
}

export interface AdministrationTransactionIdentity {
  readonly tenantId: string;
  readonly resourceType: AdministrationPersistenceResourceType;
  readonly resourceId: string;
}

interface AdministrationRecordBase {
  readonly tenantId: string;
  readonly scope: AdministrationPersistenceScope;
  readonly version: number;
  readonly evidenceReferences: readonly AdministrationEvidenceReference[];
}

export interface AdministrationEvidenceReference {
  readonly type: "DECISION" | "APPROVAL" | "AUDIT" | "CASE";
  readonly id: string;
  readonly version: number;
}

export interface RoleAssignmentPersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "ROLE_ASSIGNMENT";
  readonly roleAssignmentId: string;
  readonly proposalId: string;
  readonly subjectPrincipalId: string;
  readonly subjectPrincipalType: PrincipalType;
  readonly roleId: string;
  readonly teamIds: readonly string[];
  readonly resourceTypes: readonly string[];
  readonly purposes: readonly string[];
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REVOKED";
  readonly proposedBy: string;
  readonly approvedBy?: string;
  readonly revokedBy?: string;
  readonly reasonReference: string;
}

export interface RolePersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "ROLE";
  readonly roleId: string;
  readonly roleCode: RoleCode;
  readonly status: "ACTIVE" | "RETIRED";
  readonly policyReference: string;
}

export interface PolicyPersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "POLICY";
  readonly policyId: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REJECTED" | "REVOKED";
  readonly policyReference: string;
}

export interface TeamScopePersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "TEAM_SCOPE";
  readonly teamId: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REVOKED";
  readonly organizationId: string;
}

export interface SourceGovernancePersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "SOURCE_REGISTRY";
  readonly sourceRegistryEntryId: string;
  readonly status: "DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "PAUSED" | "BLOCKED" | "RETIRED";
  readonly policyReference: string;
  readonly name: string;
  readonly sourceType: string;
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
  readonly classification: "PUBLIC_APPROVED" | "INTERNAL" | "CONFIDENTIAL_BUSINESS" | "RESTRICTED_PERSONAL" | "RESTRICTED_SECURITY";
}

export interface PublicationTargetGovernancePersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "PUBLICATION_TARGET";
  readonly publicationTargetId: string;
  readonly status: "PROPOSED" | "ACTIVE" | "PAUSED" | "RETIRED";
  readonly policyReference: string;
  readonly channelReference: string;
  readonly name: string;
  readonly targetType: string;
  readonly allowedFieldReferences: readonly string[];
}

export interface ProposedSourceGovernanceChange {
  readonly name: string;
  readonly sourceType: string;
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
  readonly classification: SourceGovernancePersistenceRecord["classification"];
}

export interface ProposedPublicationTargetGovernanceChange {
  readonly name: string;
  readonly targetType: string;
  readonly channelReference: string;
  readonly allowedFieldReferences: readonly string[];
}

export interface AdministrationProposalRecord extends AdministrationRecordBase {
  readonly proposalId: string;
  readonly resourceType: AdministrationPersistenceResourceType;
  readonly resourceId: string;
  readonly resourceVersion: number;
  readonly proposedBy: string;
  readonly proposedChangeReference: string;
  readonly policyReference: string;
  readonly status: "PROPOSED" | "APPROVED" | "REJECTED" | "REVOKED";
  readonly reasonReference: string;
  readonly sourceGovernanceChange?: ProposedSourceGovernanceChange;
  readonly publicationTargetGovernanceChange?: ProposedPublicationTargetGovernanceChange;
}

export interface AdministrationDecisionRecord {
  readonly decisionId: string;
  readonly proposalId: string;
  readonly tenantId: string;
  readonly operation: AdministrationPersistenceOperation;
  readonly resourceType: AdministrationPersistenceResourceType;
  readonly resourceId: string;
  readonly scope: AdministrationPersistenceScope;
  readonly proposerId: string;
  readonly decisionActorId: string;
  readonly status: "APPROVED" | "REJECTED" | "REVOKED";
  readonly reasonReference: string;
  readonly evidenceReferences: readonly AdministrationEvidenceReference[];
  readonly version: number;
  readonly decidedAt: string;
}

export interface AdministrationIdempotencyIdentity extends AdministrationTransactionIdentity {
  readonly idempotencyKey: string;
}

export interface AdministrationIdempotencyRecord extends AdministrationIdempotencyIdentity {
  readonly operation: AdministrationPersistenceOperation;
  readonly fingerprint: string;
  readonly resultReference: string;
  readonly resultVersion: number;
  readonly resultStatus?: "PROPOSED" | "ACTIVE" | "REJECTED" | "REVOKED" | "PAUSED" | "BLOCKED" | "RETIRED";
  readonly resultEvidenceReferences?: readonly AdministrationEvidenceReference[];
  readonly recordedAt: string;
}

export interface AdministrationIdempotencyResult {
  readonly status: "STORED" | "REPLAYED";
  readonly record: AdministrationIdempotencyRecord;
}

export type AdministrationPersistenceErrorCode =
  | "RECORD_ALREADY_EXISTS" | "RECORD_NOT_FOUND" | "VERSION_CONFLICT" | "VERSION_ADVANCEMENT_INVALID"
  | "PERSISTENCE_SCOPE_VIOLATION" | "PROPOSER_IMMUTABLE" | "DECISION_DUPLICATE" | "IDEMPOTENCY_CONFLICT"
  | "TRANSACTION_ALREADY_ACTIVE" | "TRANSACTION_ALREADY_COMPLETED" | "TRANSACTION_ROLLBACK_ONLY"
  | "ATOMIC_BUNDLE_INCOMPLETE" | "PERSISTENCE_WRITE_FAILED" | "PERSISTENCE_INPUT_INVALID";

export class AdministrationPersistenceError extends Error {
  public constructor(public readonly code: AdministrationPersistenceErrorCode) {
    super(code);
    this.name = "AdministrationPersistenceError";
  }
}

export interface RoleAssignmentReadRepository {
  find(identity: AdministrationTransactionIdentity): RoleAssignmentPersistenceRecord | undefined;
  listByScope(scope: AdministrationPersistenceScope): readonly RoleAssignmentPersistenceRecord[];
  listBySubject(tenantId: string, subjectPrincipalId: string): readonly RoleAssignmentPersistenceRecord[];
}
export interface RoleReadRepository { find(identity: AdministrationTransactionIdentity): RolePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly RolePersistenceRecord[] }
export interface PolicyReadRepository { find(identity: AdministrationTransactionIdentity): PolicyPersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly PolicyPersistenceRecord[] }
export interface TeamScopeReadRepository { find(identity: AdministrationTransactionIdentity): TeamScopePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly TeamScopePersistenceRecord[] }
export interface SourceGovernanceReadRepository { find(identity: AdministrationTransactionIdentity): SourceGovernancePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly SourceGovernancePersistenceRecord[] }
export interface PublicationTargetReadRepository { find(identity: AdministrationTransactionIdentity): PublicationTargetGovernancePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly PublicationTargetGovernancePersistenceRecord[] }
export interface AdministrationProposalReadRepository {
  findById(tenantId: string, proposalId: string): AdministrationProposalRecord | undefined;
  listPending(scope: AdministrationPersistenceScope): readonly AdministrationProposalRecord[];
  listByScope(scope: AdministrationPersistenceScope): readonly AdministrationProposalRecord[];
}
export interface AdministrationDecisionReadRepository {
  findById(tenantId: string, decisionId: string): AdministrationDecisionRecord | undefined;
  list(identity: AdministrationTransactionIdentity): readonly AdministrationDecisionRecord[];
  listByScope(scope: AdministrationPersistenceScope): readonly AdministrationDecisionRecord[];
}
export interface AdministrationIdempotencyReadRepository { find(identity: AdministrationIdempotencyIdentity): AdministrationIdempotencyRecord | undefined }

export interface RoleAssignmentWriteRepository extends RoleAssignmentReadRepository {
  save(record: RoleAssignmentPersistenceRecord): void;
  update(expectedVersion: number, record: RoleAssignmentPersistenceRecord): void;
}
export interface RoleWriteRepository extends RoleReadRepository { save(record: RolePersistenceRecord): void; update(expectedVersion: number, record: RolePersistenceRecord): void }
export interface PolicyWriteRepository extends PolicyReadRepository { save(record: PolicyPersistenceRecord): void; update(expectedVersion: number, record: PolicyPersistenceRecord): void }
export interface TeamScopeWriteRepository extends TeamScopeReadRepository { save(record: TeamScopePersistenceRecord): void; update(expectedVersion: number, record: TeamScopePersistenceRecord): void }
export interface SourceGovernanceWriteRepository extends SourceGovernanceReadRepository { save(record: SourceGovernancePersistenceRecord): void; update(expectedVersion: number, record: SourceGovernancePersistenceRecord): void }
export interface PublicationTargetWriteRepository extends PublicationTargetReadRepository { save(record: PublicationTargetGovernancePersistenceRecord): void; update(expectedVersion: number, record: PublicationTargetGovernancePersistenceRecord): void }
export interface AdministrationProposalWriteRepository extends AdministrationProposalReadRepository { save(record: AdministrationProposalRecord): void; update(expectedVersion: number, record: AdministrationProposalRecord): void }
export interface AdministrationDecisionWriteRepository extends AdministrationDecisionReadRepository { append(record: AdministrationDecisionRecord): AdministrationDecisionRecord }
export interface AdministrationIdempotencyWriteRepository extends AdministrationIdempotencyReadRepository { record(record: AdministrationIdempotencyRecord): AdministrationIdempotencyResult }

export interface AdministrationTransaction {
  readonly roleAssignments: RoleAssignmentWriteRepository;
  readonly roles: RoleWriteRepository;
  readonly policies: PolicyWriteRepository;
  readonly teamScopes: TeamScopeWriteRepository;
  readonly sourceGovernance: SourceGovernanceWriteRepository;
  readonly publicationTargets: PublicationTargetWriteRepository;
  readonly proposals: AdministrationProposalWriteRepository;
  readonly decisions: AdministrationDecisionWriteRepository;
  readonly idempotency: AdministrationIdempotencyWriteRepository;
  commit(): void;
  rollback(): void;
  isActive(): boolean;
}

export interface AdministrationUnitOfWork {
  begin(identity: AdministrationTransactionIdentity): AdministrationTransaction;
}

export interface AdministrationPersistenceSnapshot {
  readonly roles?: readonly RolePersistenceRecord[];
}

export interface AdministrationPersistenceFailurePort {
  check(point: AdministrationPersistenceFailurePoint): void;
}

export class InMemoryAdministrationUnitOfWork implements AdministrationUnitOfWork {
  readonly #state = new AdministrationTransactionState();
  #active = false;

  public constructor(private readonly failures: AdministrationPersistenceFailurePort = { check: () => undefined }) {}

  public static rehydrate(snapshot: AdministrationPersistenceSnapshot): InMemoryAdministrationUnitOfWork {
    const unitOfWork = new InMemoryAdministrationUnitOfWork();
    for (const role of snapshot.roles ?? []) {
      validateHydratedRole(role);
      const identity = { tenantId: role.tenantId, resourceType: "ROLE" as const, resourceId: role.roleId };
      const key = identityKey(identity);
      if (unitOfWork.#state.roles.has(key)) throw persistenceError("RECORD_ALREADY_EXISTS");
      unitOfWork.#state.roles.set(key, clone(role));
      unitOfWork.#state.changed(identity);
    }
    return unitOfWork;
  }

  readonly #reads = createAdministrationReadRepositories(this.#state);
  public readonly roleAssignments = this.#reads.roleAssignments;
  public readonly roles = this.#reads.roles;
  public readonly policies = this.#reads.policies;
  public readonly teamScopes = this.#reads.teamScopes;
  public readonly sourceGovernance = this.#reads.sourceGovernance;
  public readonly publicationTargets = this.#reads.publicationTargets;
  public readonly proposals = this.#reads.proposals;
  public readonly decisions = this.#reads.decisions;
  public readonly idempotency = this.#reads.idempotency;

  public begin(identity: AdministrationTransactionIdentity): AdministrationTransaction {
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE");
    this.#active = true;
    try {
      return createAdministrationTransaction({
        identity,
        initialState: this.#state,
        initialRevision: this.#state.revision(identity),
        failures: this.failures,
        commitBoundary: {
          commit: ({ initialRevision, state }) => {
            if (this.#state.revision(identity) !== initialRevision) throw persistenceError("VERSION_CONFLICT");
            this.#state.replaceScope(state, identity);
          },
        },
        release: () => { this.#active = false; },
      });
    } catch (error) {
      this.#active = false;
      throw error;
    }
  }
}

function persistenceError(code: AdministrationPersistenceErrorCode): AdministrationPersistenceError {
  return new AdministrationPersistenceError(code);
}
