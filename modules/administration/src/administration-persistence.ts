import type { PrincipalType, RoleCode } from "../../../packages/security-contracts/src/index.js";

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
  readonly role: RoleCode;
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
}

export interface PublicationTargetGovernancePersistenceRecord extends AdministrationRecordBase {
  readonly recordType: "PUBLICATION_TARGET";
  readonly publicationTargetId: string;
  readonly status: "PROPOSED" | "ACTIVE" | "PAUSED" | "RETIRED";
  readonly policyReference: string;
  readonly channelReference: string;
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
}
export interface RoleReadRepository { find(identity: AdministrationTransactionIdentity): RolePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly RolePersistenceRecord[] }
export interface PolicyReadRepository { find(identity: AdministrationTransactionIdentity): PolicyPersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly PolicyPersistenceRecord[] }
export interface TeamScopeReadRepository { find(identity: AdministrationTransactionIdentity): TeamScopePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly TeamScopePersistenceRecord[] }
export interface SourceGovernanceReadRepository { find(identity: AdministrationTransactionIdentity): SourceGovernancePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly SourceGovernancePersistenceRecord[] }
export interface PublicationTargetReadRepository { find(identity: AdministrationTransactionIdentity): PublicationTargetGovernancePersistenceRecord | undefined; listByScope(scope: AdministrationPersistenceScope): readonly PublicationTargetGovernancePersistenceRecord[] }
export interface AdministrationProposalReadRepository {
  findById(tenantId: string, proposalId: string): AdministrationProposalRecord | undefined;
  listPending(scope: AdministrationPersistenceScope): readonly AdministrationProposalRecord[];
}
export interface AdministrationDecisionReadRepository { list(identity: AdministrationTransactionIdentity): readonly AdministrationDecisionRecord[] }
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

type GovernedRecord = RoleAssignmentPersistenceRecord | RolePersistenceRecord | PolicyPersistenceRecord | TeamScopePersistenceRecord | SourceGovernancePersistenceRecord | PublicationTargetGovernancePersistenceRecord;

interface AdministrationTransactionTracker {
  rollbackOnly: boolean;
  readonly existingRecord?: GovernedRecord;
  governedSave?: GovernedRecord;
  authoritativeUpdate?: { readonly initialVersion: number; readonly finalVersion: number; readonly record: GovernedRecord };
  proposalSave?: AdministrationProposalRecord;
  proposalUpdate?: AdministrationProposalRecord;
  decision?: AdministrationDecisionRecord;
  idempotency?: AdministrationIdempotencyRecord;
}

const OPERATION_RESOURCE: Readonly<Record<AdministrationPersistenceOperation, AdministrationPersistenceResourceType>> = Object.freeze({
  PROPOSE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", APPROVE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", REJECT_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", REVOKE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT",
  PROPOSE_ROLE_CHANGE: "ROLE", APPROVE_ROLE_CHANGE: "ROLE", REJECT_ROLE_CHANGE: "ROLE",
  PROPOSE_POLICY_CHANGE: "POLICY", APPROVE_POLICY_CHANGE: "POLICY", REJECT_POLICY_CHANGE: "POLICY",
  PROPOSE_TEAM_SCOPE_CHANGE: "TEAM_SCOPE", APPROVE_TEAM_SCOPE_CHANGE: "TEAM_SCOPE", REJECT_TEAM_SCOPE_CHANGE: "TEAM_SCOPE",
  PROPOSE_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", APPROVE_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", REJECT_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", TRANSITION_SOURCE_GOVERNANCE: "SOURCE_REGISTRY",
  PROPOSE_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", APPROVE_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", REJECT_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", TRANSITION_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET",
});

class InMemoryAdministrationState {
  public roleAssignments = new Map<string, RoleAssignmentPersistenceRecord>();
  public roles = new Map<string, RolePersistenceRecord>();
  public policies = new Map<string, PolicyPersistenceRecord>();
  public teamScopes = new Map<string, TeamScopePersistenceRecord>();
  public sources = new Map<string, SourceGovernancePersistenceRecord>();
  public targets = new Map<string, PublicationTargetGovernancePersistenceRecord>();
  public proposals = new Map<string, AdministrationProposalRecord>();
  public decisions = new Map<string, AdministrationDecisionRecord>();
  public idempotency = new Map<string, AdministrationIdempotencyRecord>();
  public revisions = new Map<string, number>();

  public clone(): InMemoryAdministrationState {
    const copy = new InMemoryAdministrationState();
    copy.roleAssignments = structuredClone(this.roleAssignments);
    copy.roles = structuredClone(this.roles);
    copy.policies = structuredClone(this.policies);
    copy.teamScopes = structuredClone(this.teamScopes);
    copy.sources = structuredClone(this.sources);
    copy.targets = structuredClone(this.targets);
    copy.proposals = structuredClone(this.proposals);
    copy.decisions = structuredClone(this.decisions);
    copy.idempotency = structuredClone(this.idempotency);
    copy.revisions = structuredClone(this.revisions);
    return copy;
  }

  public revision(identity: AdministrationTransactionIdentity): number { return this.revisions.get(identityKey(identity)) ?? 0; }
  public changed(identity: AdministrationTransactionIdentity): void { this.revisions.set(identityKey(identity), this.revision(identity) + 1); }

  public replaceScope(source: InMemoryAdministrationState, identity: AdministrationTransactionIdentity): void {
    replaceGoverned(this.roleAssignments, source.roleAssignments, identity);
    replaceGoverned(this.roles, source.roles, identity);
    replaceGoverned(this.policies, source.policies, identity);
    replaceGoverned(this.teamScopes, source.teamScopes, identity);
    replaceGoverned(this.sources, source.sources, identity);
    replaceGoverned(this.targets, source.targets, identity);
    replaceScoped(this.proposals, source.proposals, identity, proposalMatches);
    replaceScoped(this.decisions, source.decisions, identity, decisionMatches);
    replaceScoped(this.idempotency, source.idempotency, identity, idempotencyMatches);
    this.revisions.set(identityKey(identity), source.revision(identity));
  }
}

export class InMemoryAdministrationUnitOfWork implements AdministrationUnitOfWork {
  readonly #state = new InMemoryAdministrationState();
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

  public readonly roleAssignments: RoleAssignmentReadRepository = this.readRepository("ROLE_ASSIGNMENT", this.#state.roleAssignments);
  public readonly roles: RoleReadRepository = this.readRepository("ROLE", this.#state.roles);
  public readonly policies: PolicyReadRepository = this.readRepository("POLICY", this.#state.policies);
  public readonly teamScopes: TeamScopeReadRepository = this.readRepository("TEAM_SCOPE", this.#state.teamScopes);
  public readonly sourceGovernance: SourceGovernanceReadRepository = this.readRepository("SOURCE_REGISTRY", this.#state.sources);
  public readonly publicationTargets: PublicationTargetReadRepository = this.readRepository("PUBLICATION_TARGET", this.#state.targets);
  public readonly proposals: AdministrationProposalReadRepository = proposalReadRepository(this.#state);
  public readonly decisions: AdministrationDecisionReadRepository = decisionReadRepository(this.#state);
  public readonly idempotency: AdministrationIdempotencyReadRepository = idempotencyReadRepository(this.#state);

  public begin(identity: AdministrationTransactionIdentity): AdministrationTransaction {
    validateIdentity(identity);
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE");
    this.#active = true;
    const staged = this.#state.clone();
    const initialRevision = this.#state.revision(identity);
    const existingRecord = optionalClone(governedRecord(staged, identity));
    const tracker: AdministrationTransactionTracker = { rollbackOnly: false, ...(existingRecord === undefined ? {} : { existingRecord }) };
    let active = true;
    const ensureActive = (): void => { if (!active) throw persistenceError("TRANSACTION_ALREADY_COMPLETED"); };
    const guarded = <Result>(operation: () => Result): Result => {
      ensureActive();
      if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
      try { return operation(); } catch (error) { tracker.rollbackOnly = true; throw error; }
    };
    const finish = (commit: boolean): void => {
      ensureActive();
      if (commit) {
        try {
          if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
          validateAtomicBundle(tracker, identity);
          this.failures.check("COMMIT");
          if (this.#state.revision(identity) !== initialRevision) throw persistenceError("VERSION_CONFLICT");
          this.#state.replaceScope(staged, identity);
        } finally {
          active = false;
          this.#active = false;
        }
      } else {
        active = false;
        this.#active = false;
      }
    };
    return {
      roleAssignments: this.writeRepository(staged, "ROLE_ASSIGNMENT", staged.roleAssignments, identity, guarded, tracker),
      roles: this.writeRepository(staged, "ROLE", staged.roles, identity, guarded, tracker),
      policies: this.writeRepository(staged, "POLICY", staged.policies, identity, guarded, tracker),
      teamScopes: this.writeRepository(staged, "TEAM_SCOPE", staged.teamScopes, identity, guarded, tracker),
      sourceGovernance: this.writeRepository(staged, "SOURCE_REGISTRY", staged.sources, identity, guarded, tracker),
      publicationTargets: this.writeRepository(staged, "PUBLICATION_TARGET", staged.targets, identity, guarded, tracker),
      proposals: proposalWriteRepository(staged, identity, guarded, this.failures, tracker),
      decisions: decisionWriteRepository(staged, identity, guarded, this.failures, tracker),
      idempotency: idempotencyWriteRepository(staged, identity, guarded, this.failures, tracker),
      commit: (): void => { finish(true); }, rollback: (): void => { finish(false); }, isActive: (): boolean => active,
    };
  }

  private readRepository<Record extends GovernedRecord>(resourceType: AdministrationPersistenceResourceType, records: Map<string, Record>): RoleAssignmentReadRepository & RoleReadRepository & PolicyReadRepository & TeamScopeReadRepository & SourceGovernanceReadRepository & PublicationTargetReadRepository {
    return {
      find: (identity) => {
        if (identity.resourceType !== resourceType) return undefined;
        const record = records.get(identityKey(identity));
        return record === undefined ? undefined : immutable(record);
      },
      listByScope: (scope) => immutable([...records.values()].filter((record) => sameScope(record.scope, scope)).sort((a, b) => recordId(a).localeCompare(recordId(b)))),
    } as RoleAssignmentReadRepository & RoleReadRepository & PolicyReadRepository & TeamScopeReadRepository & SourceGovernanceReadRepository & PublicationTargetReadRepository;
  }

  private writeRepository<Record extends GovernedRecord>(state: InMemoryAdministrationState, resourceType: AdministrationPersistenceResourceType, records: Map<string, Record>, scopeIdentity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, tracker: AdministrationTransactionTracker): RoleAssignmentWriteRepository & RoleWriteRepository & PolicyWriteRepository & TeamScopeWriteRepository & SourceGovernanceWriteRepository & PublicationTargetWriteRepository {
    const read = this.readRepository(resourceType, records);
    const assertRecordScope = (record: Record): void => {
      if (record.recordType !== resourceType || record.tenantId !== scopeIdentity.tenantId || recordId(record) !== scopeIdentity.resourceId || record.scope.tenantId !== record.tenantId) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
    };
    return {
      ...read,
      save: (record: Record): void => guarded(() => {
        assertRecordScope(record); this.failures.check("STATE_WRITE");
        const key = identityKey(scopeIdentity);
        if (records.has(key)) throw persistenceError("RECORD_ALREADY_EXISTS");
        validateVersion(record.version, 1);
        if (tracker.governedSave !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
        tracker.governedSave = clone(record);
        records.set(key, clone(record));
        state.changed(scopeIdentity);
      }),
      update: (expectedVersion: number, record: Record): void => guarded(() => {
        assertRecordScope(record); this.failures.check("STATE_WRITE");
        const key = identityKey(scopeIdentity);
        const current = records.get(key);
        if (current === undefined) throw persistenceError("RECORD_NOT_FOUND");
        if (current.version !== expectedVersion) throw persistenceError("VERSION_CONFLICT");
        if (tracker.authoritativeUpdate !== undefined) throw persistenceError("VERSION_ADVANCEMENT_INVALID");
        assertImmutableGovernedLinkage(current, record);
        validateVersion(record.version, expectedVersion + 1);
        tracker.authoritativeUpdate = { initialVersion: expectedVersion, finalVersion: record.version, record: clone(record) };
        records.set(key, clone(record));
        state.changed(scopeIdentity);
      }),
    } as RoleAssignmentWriteRepository & RoleWriteRepository & PolicyWriteRepository & TeamScopeWriteRepository & SourceGovernanceWriteRepository & PublicationTargetWriteRepository;
  }

}

function proposalReadRepository(state: InMemoryAdministrationState): AdministrationProposalReadRepository {
  return {
    findById: (tenantId, proposalId) => optionalImmutable(state.proposals.get(proposalKey(tenantId, proposalId))),
    listPending: (scope) => immutable([...state.proposals.values()].filter((record) => record.status === "PROPOSED" && sameScope(record.scope, scope)).sort((a, b) => a.proposalId.localeCompare(b.proposalId))),
  };
}

function proposalWriteRepository(state: InMemoryAdministrationState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationProposalWriteRepository {
  return {
    ...proposalReadRepository(state),
    save: (record): void => guarded(() => {
      assertProposalScope(record, identity); failures.check("STATE_WRITE");
      const key = proposalKey(record.tenantId, record.proposalId);
      if (state.proposals.has(key)) throw persistenceError("RECORD_ALREADY_EXISTS");
      validateVersion(record.version, 1);
      if (tracker.proposalSave !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.proposalSave = clone(record);
      state.proposals.set(key, clone(record)); state.changed(identity);
    }),
    update: (expectedVersion, record): void => guarded(() => {
      assertProposalScope(record, identity); failures.check("STATE_WRITE");
      const key = proposalKey(record.tenantId, record.proposalId); const current = state.proposals.get(key);
      if (current === undefined) throw persistenceError("RECORD_NOT_FOUND");
      if (current.version !== expectedVersion) throw persistenceError("VERSION_CONFLICT");
      if (current.proposedBy !== record.proposedBy || current.resourceType !== record.resourceType || current.resourceId !== record.resourceId || current.resourceVersion !== record.resourceVersion || current.proposedChangeReference !== record.proposedChangeReference || current.policyReference !== record.policyReference || current.reasonReference !== record.reasonReference || !sameScope(current.scope, record.scope) || !evidenceAppends(current.evidenceReferences, record.evidenceReferences)) throw persistenceError("PROPOSER_IMMUTABLE");
      validateVersion(record.version, expectedVersion + 1);
      if (tracker.proposalUpdate !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.proposalUpdate = clone(record);
      state.proposals.set(key, clone(record)); state.changed(identity);
    }),
  };
}

function decisionReadRepository(state: InMemoryAdministrationState): AdministrationDecisionReadRepository {
  return { list: (identity) => immutable([...state.decisions.values()].filter((record) => decisionMatches(record, identity)).sort((a, b) => a.decisionId.localeCompare(b.decisionId))) };
}
function decisionWriteRepository(state: InMemoryAdministrationState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationDecisionWriteRepository {
  return { ...decisionReadRepository(state), append: (record): AdministrationDecisionRecord => {
    return guarded(() => {
      assertDecisionScope(record, identity); failures.check("DECISION_APPEND");
      const key = decisionKey(record.tenantId, record.decisionId);
      if (state.decisions.has(key)) throw persistenceError("DECISION_DUPLICATE");
      const proposal = state.proposals.get(proposalKey(record.tenantId, record.proposalId));
      if (proposal?.proposedBy !== record.proposerId) throw persistenceError("PROPOSER_IMMUTABLE");
      if (proposal === undefined || !assertIdentityShape(proposal, identity) || !sameScope(proposal.scope, record.scope)) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
      if (record.proposerId === record.decisionActorId) throw persistenceError("PERSISTENCE_INPUT_INVALID");
      if (tracker.decision !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.decision = clone(record);
      state.decisions.set(key, clone(record)); state.changed(identity); return immutable(record);
    });
  } };
}

function idempotencyReadRepository(state: InMemoryAdministrationState): AdministrationIdempotencyReadRepository {
  return { find: (identity) => optionalImmutable(state.idempotency.get(idempotencyKey(identity))) };
}
function idempotencyWriteRepository(state: InMemoryAdministrationState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationIdempotencyWriteRepository {
  return { ...idempotencyReadRepository(state), record: (record): AdministrationIdempotencyResult => {
    return guarded(() => {
      assertIdentity(record, identity); failures.check("IDEMPOTENCY_WRITE");
      const key = idempotencyKey(record); const existing = state.idempotency.get(key);
      if (existing !== undefined) {
        if (existing.fingerprint !== record.fingerprint || existing.operation !== record.operation) throw persistenceError("IDEMPOTENCY_CONFLICT");
        return immutable({ status: "REPLAYED" as const, record: existing });
      }
      if (tracker.idempotency !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.idempotency = clone(record);
      state.idempotency.set(key, clone(record)); state.changed(identity); return immutable({ status: "STORED" as const, record });
    });
  } };
}

function replaceGoverned<Record extends GovernedRecord>(target: Map<string, Record>, source: Map<string, Record>, identity: AdministrationTransactionIdentity): void {
  const key = identityKey(identity); const record = source.get(key);
  if (record === undefined) target.delete(key); else target.set(key, clone(record));
}
function replaceScoped<Record>(target: Map<string, Record>, source: Map<string, Record>, identity: AdministrationTransactionIdentity, matches: (record: Record, identity: AdministrationTransactionIdentity) => boolean): void {
  for (const [key, record] of target) if (matches(record, identity)) target.delete(key);
  for (const [key, record] of source) if (matches(record, identity)) target.set(key, clone(record));
}
function proposalMatches(record: AdministrationProposalRecord, identity: AdministrationTransactionIdentity): boolean { return assertIdentityShape(record, identity); }
function decisionMatches(record: AdministrationDecisionRecord, identity: AdministrationTransactionIdentity): boolean { return assertIdentityShape(record, identity); }
function idempotencyMatches(record: AdministrationIdempotencyRecord, identity: AdministrationTransactionIdentity): boolean { return assertIdentityShape(record, identity); }
function assertIdentityShape(record: { tenantId: string; resourceType: AdministrationPersistenceResourceType; resourceId: string }, identity: AdministrationTransactionIdentity): boolean { return record.tenantId === identity.tenantId && record.resourceType === identity.resourceType && record.resourceId === identity.resourceId; }
function assertIdentity(record: { tenantId: string; resourceType: AdministrationPersistenceResourceType; resourceId: string }, identity: AdministrationTransactionIdentity): void { if (!assertIdentityShape(record, identity)) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION"); }
function assertProposalScope(record: AdministrationProposalRecord, identity: AdministrationTransactionIdentity): void { assertIdentity(record, identity); if (record.scope.tenantId !== record.tenantId) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION"); }
function assertDecisionScope(record: AdministrationDecisionRecord, identity: AdministrationTransactionIdentity): void { assertIdentity(record, identity); if (record.scope.tenantId !== record.tenantId) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION"); }
function assertImmutableGovernedLinkage(current: GovernedRecord, next: GovernedRecord): void {
  if (!sameScope(current.scope, next.scope)) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
  if (!evidenceAppends(current.evidenceReferences, next.evidenceReferences)) throw persistenceError("PROPOSER_IMMUTABLE");
  if (current.recordType === "ROLE_ASSIGNMENT" && next.recordType === "ROLE_ASSIGNMENT") {
    const linkageChanged = current.proposalId !== next.proposalId || current.proposedBy !== next.proposedBy
      || current.subjectPrincipalId !== next.subjectPrincipalId || current.subjectPrincipalType !== next.subjectPrincipalType
      || current.role !== next.role || !sameValues(current.teamIds, next.teamIds)
      || !sameValues(current.resourceTypes, next.resourceTypes) || !sameValues(current.purposes, next.purposes)
      || current.effectiveFrom !== next.effectiveFrom || current.effectiveUntil !== next.effectiveUntil
      || current.reasonReference !== next.reasonReference
      || (current.approvedBy !== undefined && current.approvedBy !== next.approvedBy);
    if (linkageChanged) throw persistenceError("PROPOSER_IMMUTABLE");
  }
}
function governedRecord(state: InMemoryAdministrationState, identity: AdministrationTransactionIdentity): GovernedRecord | undefined {
  if (identity.resourceType === "ROLE_ASSIGNMENT") return state.roleAssignments.get(identityKey(identity));
  if (identity.resourceType === "ROLE") return state.roles.get(identityKey(identity));
  if (identity.resourceType === "POLICY") return state.policies.get(identityKey(identity));
  if (identity.resourceType === "TEAM_SCOPE") return state.teamScopes.get(identityKey(identity));
  if (identity.resourceType === "SOURCE_REGISTRY") return state.sources.get(identityKey(identity));
  return state.targets.get(identityKey(identity));
}
function validateAtomicBundle(tracker: AdministrationTransactionTracker, identity: AdministrationTransactionIdentity): void {
  const hasMutationBundlePart = tracker.governedSave !== undefined || tracker.authoritativeUpdate !== undefined || tracker.proposalSave !== undefined || tracker.proposalUpdate !== undefined || tracker.decision !== undefined || tracker.idempotency !== undefined;
  if (!hasMutationBundlePart) return;
  const idempotency = tracker.idempotency;
  if (idempotency === undefined || !assertIdentityShape(idempotency, identity)) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  if (OPERATION_RESOURCE[idempotency.operation] !== identity.resourceType) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  if (idempotency.operation.startsWith("PROPOSE_")) {
    const governed = tracker.governedSave;
    const proposal = tracker.proposalSave;
    if (proposal === undefined || tracker.authoritativeUpdate !== undefined || tracker.proposalUpdate !== undefined || tracker.decision !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if (!assertIdentityShape(proposal, identity) || proposal.status !== "PROPOSED" || proposal.version !== 1 || idempotency.resultReference !== proposal.proposalId || idempotency.resultVersion !== 1) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if (governed === undefined) {
      const existing = tracker.existingRecord;
      const existingMatches = proposal.resourceVersion === existing?.version
        && proposal.scope.tenantId === existing?.scope.tenantId
        && proposal.scope.scopeType === existing.scope.scopeType
        && proposal.scope.scopeId === existing.scope.scopeId;
      if (!existingMatches) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    } else if (tracker.existingRecord !== undefined || !sameScope(governed.scope, proposal.scope) || governed.version !== 1 || proposal.resourceVersion !== governed.version || !operationAllowsProposalCreateStatus(idempotency.operation, governed) || (governed.recordType === "ROLE_ASSIGNMENT" && governed.proposalId !== proposal.proposalId)) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    return;
  }
  const decision = tracker.decision;
  const proposal = tracker.proposalUpdate;
  if (decision === undefined || proposal === undefined || tracker.proposalSave !== undefined || !assertIdentityShape(decision, identity) || !assertIdentityShape(proposal, identity) || decision.proposalId !== proposal.proposalId || decision.operation !== idempotency.operation) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  const rejection = idempotency.operation.startsWith("REJECT_");
  const expectedProposalStatus = rejection ? "REJECTED" : idempotency.operation.startsWith("REVOKE_") ? "REVOKED" : "APPROVED";
  const expectedDecisionStatus = rejection ? "REJECTED" : idempotency.operation.startsWith("REVOKE_") ? "REVOKED" : "APPROVED";
  if (proposal.status !== expectedProposalStatus || decision.status !== expectedDecisionStatus || idempotency.resultVersion !== decision.version || idempotency.resultReference !== decision.decisionId) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  if (rejection) {
    if (tracker.authoritativeUpdate !== undefined || tracker.governedSave !== undefined || decision.version !== proposal.resourceVersion) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  } else {
    const update = tracker.authoritativeUpdate;
    if (update === undefined || tracker.governedSave !== undefined || proposal.resourceVersion !== update.initialVersion || update.finalVersion !== update.initialVersion + 1 || decision.version !== update.finalVersion) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if ((idempotency.operation.startsWith("TRANSITION_") || idempotency.operation.startsWith("REVOKE_")) && tracker.existingRecord?.status !== "ACTIVE") throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if (!operationAllowsStatus(idempotency.operation, update.record)) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  }
}
function validateIdentity(identity: AdministrationTransactionIdentity): void { if ([identity.tenantId, identity.resourceType, identity.resourceId].some((value) => value.trim().length === 0)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); }
function validateHydratedRole(role: RolePersistenceRecord): void {
  if (role.recordType !== "ROLE" || role.tenantId !== role.scope.tenantId) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
  if (![role.tenantId, role.roleId, role.scope.scopeId, role.policyReference].every((value) => value.trim().length > 0)
    || !Number.isSafeInteger(role.version) || role.version < 1 || !["ACTIVE", "RETIRED"].includes(role.status)
    || role.evidenceReferences.some((reference) => !["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(reference.type) || reference.id.trim().length === 0 || !Number.isSafeInteger(reference.version) || reference.version < 1)) throw persistenceError("PERSISTENCE_INPUT_INVALID");
}
function validateVersion(actual: number, expected: number): void { if (!Number.isSafeInteger(actual) || actual !== expected) throw persistenceError("VERSION_ADVANCEMENT_INVALID"); }
function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean { return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId; }
function sameValues(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function evidenceAppends(left: readonly AdministrationEvidenceReference[], right: readonly AdministrationEvidenceReference[]): boolean { return left.length <= right.length && left.every((value, index) => JSON.stringify(value) === JSON.stringify(right[index])); }
function operationAllowsStatus(operation: AdministrationPersistenceOperation, record: GovernedRecord): boolean {
  if (operation.startsWith("APPROVE_")) return record.status === "ACTIVE";
  if (operation === "REVOKE_ROLE_ASSIGNMENT") return record.recordType === "ROLE_ASSIGNMENT" && record.status === "REVOKED";
  if (operation === "TRANSITION_SOURCE_GOVERNANCE") return record.recordType === "SOURCE_REGISTRY" && ["PAUSED", "BLOCKED", "RETIRED"].includes(record.status);
  if (operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE") return record.recordType === "PUBLICATION_TARGET" && ["PAUSED", "RETIRED"].includes(record.status);
  return false;
}
function operationAllowsProposalCreateStatus(operation: AdministrationPersistenceOperation, record: GovernedRecord): boolean {
  if (operation === "PROPOSE_ROLE_ASSIGNMENT") return record.recordType === "ROLE_ASSIGNMENT" && record.status === "PROPOSED";
  if (operation === "PROPOSE_POLICY_CHANGE") return record.recordType === "POLICY" && record.status === "PROPOSED";
  if (operation === "PROPOSE_TEAM_SCOPE_CHANGE") return record.recordType === "TEAM_SCOPE" && record.status === "PROPOSED";
  if (operation === "PROPOSE_SOURCE_GOVERNANCE") return record.recordType === "SOURCE_REGISTRY" && record.status === "DRAFT";
  if (operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE") return record.recordType === "PUBLICATION_TARGET" && record.status === "PROPOSED";
  return false;
}
function recordId(record: GovernedRecord): string { if (record.recordType === "ROLE_ASSIGNMENT") return record.roleAssignmentId; if (record.recordType === "ROLE") return record.roleId; if (record.recordType === "POLICY") return record.policyId; if (record.recordType === "TEAM_SCOPE") return record.teamId; if (record.recordType === "SOURCE_REGISTRY") return record.sourceRegistryEntryId; return record.publicationTargetId; }
function identityKey(identity: AdministrationTransactionIdentity): string { return JSON.stringify([identity.tenantId, identity.resourceType, identity.resourceId]); }
function proposalKey(tenantId: string, proposalId: string): string { return JSON.stringify([tenantId, proposalId]); }
function decisionKey(tenantId: string, decisionId: string): string { return JSON.stringify([tenantId, decisionId]); }
function idempotencyKey(identity: AdministrationIdempotencyIdentity): string { return JSON.stringify([identity.tenantId, identity.resourceType, identity.resourceId, identity.idempotencyKey]); }
function persistenceError(code: AdministrationPersistenceErrorCode): AdministrationPersistenceError { return new AdministrationPersistenceError(code); }
function clone<Value>(value: Value): Value { return structuredClone(value); }
function optionalClone<Value>(value: Value | undefined): Value | undefined { return value === undefined ? undefined : clone(value); }
function optionalImmutable<Value>(value: Value | undefined): Value | undefined { return value === undefined ? undefined : immutable(value); }
function immutable<Value>(value: Value): Value { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return; for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
