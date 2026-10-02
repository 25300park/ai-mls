import {
  AdministrationPersistenceError,
  type AdministrationDecisionReadRepository,
  type AdministrationDecisionRecord,
  type AdministrationDecisionWriteRepository,
  type AdministrationEvidenceReference,
  type AdministrationIdempotencyIdentity,
  type AdministrationIdempotencyReadRepository,
  type AdministrationIdempotencyRecord,
  type AdministrationIdempotencyResult,
  type AdministrationIdempotencyWriteRepository,
  type AdministrationPersistenceFailurePort,
  type AdministrationPersistenceOperation,
  type AdministrationPersistenceResourceType,
  type AdministrationPersistenceScope,
  type AdministrationProposalReadRepository,
  type AdministrationProposalRecord,
  type AdministrationProposalWriteRepository,
  type AdministrationTransaction,
  type AdministrationTransactionIdentity,
  type PolicyPersistenceRecord,
  type PolicyReadRepository,
  type PolicyWriteRepository,
  type PublicationTargetGovernancePersistenceRecord,
  type PublicationTargetReadRepository,
  type PublicationTargetWriteRepository,
  type RoleAssignmentPersistenceRecord,
  type RoleAssignmentReadRepository,
  type RoleAssignmentWriteRepository,
  type RolePersistenceRecord,
  type RoleReadRepository,
  type RoleWriteRepository,
  type SourceGovernancePersistenceRecord,
  type SourceGovernanceReadRepository,
  type SourceGovernanceWriteRepository,
  type TeamScopePersistenceRecord,
  type TeamScopeReadRepository,
  type TeamScopeWriteRepository,
} from "./administration-persistence.js";
import type { AsyncAdministrationTransaction } from "./administration-async-persistence.js";

export type GovernedRecord =
  | RoleAssignmentPersistenceRecord
  | RolePersistenceRecord
  | PolicyPersistenceRecord
  | TeamScopePersistenceRecord
  | SourceGovernancePersistenceRecord
  | PublicationTargetGovernancePersistenceRecord;

export interface AdministrationTransactionTrackerSnapshot {
  readonly existingRecord?: GovernedRecord;
  readonly governedSave?: GovernedRecord;
  readonly authoritativeUpdate?: {
    readonly initialVersion: number;
    readonly finalVersion: number;
    readonly record: GovernedRecord;
  };
  readonly proposalSave?: AdministrationProposalRecord;
  readonly proposalUpdate?: AdministrationProposalRecord;
  readonly decision?: AdministrationDecisionRecord;
  readonly idempotency?: AdministrationIdempotencyRecord;
}

interface AdministrationTransactionTracker extends AdministrationTransactionTrackerSnapshot {
  rollbackOnly: boolean;
  governedSave?: GovernedRecord;
  authoritativeUpdate?: { readonly initialVersion: number; readonly finalVersion: number; readonly record: GovernedRecord };
  proposalSave?: AdministrationProposalRecord;
  proposalUpdate?: AdministrationProposalRecord;
  decision?: AdministrationDecisionRecord;
  idempotency?: AdministrationIdempotencyRecord;
}

export class AdministrationTransactionState {
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

  public clone(): AdministrationTransactionState {
    const copy = new AdministrationTransactionState();
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

  public revision(identity: AdministrationTransactionIdentity): number {
    return this.revisions.get(identityKey(identity)) ?? 0;
  }

  public changed(identity: AdministrationTransactionIdentity): void {
    this.revisions.set(identityKey(identity), this.revision(identity) + 1);
  }

  public replaceScope(source: AdministrationTransactionState, identity: AdministrationTransactionIdentity): void {
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

  public replaceAll(source: AdministrationTransactionState): void {
    replaceMap(this.roleAssignments, source.roleAssignments);
    replaceMap(this.roles, source.roles);
    replaceMap(this.policies, source.policies);
    replaceMap(this.teamScopes, source.teamScopes);
    replaceMap(this.sources, source.sources);
    replaceMap(this.targets, source.targets);
    replaceMap(this.proposals, source.proposals);
    replaceMap(this.decisions, source.decisions);
    replaceMap(this.idempotency, source.idempotency);
    replaceMap(this.revisions, source.revisions);
  }
}

function replaceMap<Key, Value>(target: Map<Key, Value>, source: Map<Key, Value>): void {
  target.clear();
  for (const [key, value] of structuredClone(source)) target.set(key, value);
}

export interface AdministrationTransactionCommit {
  commit(input: {
    readonly identity: AdministrationTransactionIdentity;
    readonly initialRevision: number;
    readonly state: AdministrationTransactionState;
    readonly tracker: AdministrationTransactionTrackerSnapshot;
  }): void;
}

export function createAdministrationTransaction(input: {
  readonly identity: AdministrationTransactionIdentity;
  readonly initialState: AdministrationTransactionState;
  readonly initialRevision: number;
  readonly failures: AdministrationPersistenceFailurePort;
  readonly commitBoundary: AdministrationTransactionCommit;
  readonly release: () => void;
}): AdministrationTransaction {
  validateIdentity(input.identity);
  const staged = input.initialState.clone();
  const existingRecord = optionalClone(governedRecord(staged, input.identity));
  const tracker: AdministrationTransactionTracker = {
    rollbackOnly: false,
    ...(existingRecord === undefined ? {} : { existingRecord }),
  };
  let active = true;
  const ensureActive = (): void => {
    if (!active) throw persistenceError("TRANSACTION_ALREADY_COMPLETED");
  };
  const guarded = <Result>(operation: () => Result): Result => {
    ensureActive();
    if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
    try {
      return operation();
    } catch (error) {
      tracker.rollbackOnly = true;
      throw error;
    }
  };
  const finish = (commit: boolean): void => {
    ensureActive();
    try {
      if (commit) {
        if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
        validateAtomicBundle(tracker, input.identity);
        input.failures.check("COMMIT");
        input.commitBoundary.commit({
          identity: input.identity,
          initialRevision: input.initialRevision,
          state: staged,
          tracker: immutableTracker(tracker),
        });
      }
    } finally {
      active = false;
      input.release();
    }
  };
  return {
    roleAssignments: writeRepository(staged, "ROLE_ASSIGNMENT", staged.roleAssignments, input.identity, guarded, input.failures, tracker),
    roles: writeRepository(staged, "ROLE", staged.roles, input.identity, guarded, input.failures, tracker),
    policies: writeRepository(staged, "POLICY", staged.policies, input.identity, guarded, input.failures, tracker),
    teamScopes: writeRepository(staged, "TEAM_SCOPE", staged.teamScopes, input.identity, guarded, input.failures, tracker),
    sourceGovernance: writeRepository(staged, "SOURCE_REGISTRY", staged.sources, input.identity, guarded, input.failures, tracker),
    publicationTargets: writeRepository(staged, "PUBLICATION_TARGET", staged.targets, input.identity, guarded, input.failures, tracker),
    proposals: proposalWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    decisions: decisionWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    idempotency: idempotencyWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    commit: () => finish(true),
    rollback: () => finish(false),
    isActive: () => active,
  };
}

export function createAsyncAdministrationTransaction(input: {
  readonly identity: AdministrationTransactionIdentity;
  readonly initialState: AdministrationTransactionState;
  readonly initialRevision: number;
  readonly failures: AdministrationPersistenceFailurePort;
  readonly commit: (input: {
    readonly identity: AdministrationTransactionIdentity;
    readonly initialRevision: number;
    readonly state: AdministrationTransactionState;
    readonly tracker: AdministrationTransactionTrackerSnapshot;
  }) => Promise<void>;
  readonly rollback: () => Promise<void>;
  readonly release: () => void;
}): AsyncAdministrationTransaction {
  validateIdentity(input.identity);
  const staged = input.initialState.clone();
  const existingRecord = optionalClone(governedRecord(staged, input.identity));
  const tracker: AdministrationTransactionTracker = {
    rollbackOnly: false,
    ...(existingRecord === undefined ? {} : { existingRecord }),
  };
  let active = true;
  const ensureActive = (): void => {
    if (!active) throw persistenceError("TRANSACTION_ALREADY_COMPLETED");
  };
  const guarded = <Result>(operation: () => Result): Result => {
    ensureActive();
    if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
    try { return operation(); }
    catch (error) { tracker.rollbackOnly = true; throw error; }
  };
  const finish = async (commit: boolean): Promise<void> => {
    ensureActive();
    active = false;
    let commitEntered = false;
    try {
      if (commit) {
        if (tracker.rollbackOnly) throw persistenceError("TRANSACTION_ROLLBACK_ONLY");
        validateAtomicBundle(tracker, input.identity);
        input.failures.check("COMMIT");
        commitEntered = true;
        await input.commit({
          identity: input.identity,
          initialRevision: input.initialRevision,
          state: staged,
          tracker: immutableTracker(tracker),
        });
      } else await input.rollback();
    } catch (error) {
      if (commit && !commitEntered) await input.rollback();
      throw error;
    } finally {
      active = false;
      input.release();
    }
  };
  return {
    roleAssignments: writeRepository(staged, "ROLE_ASSIGNMENT", staged.roleAssignments, input.identity, guarded, input.failures, tracker),
    roles: writeRepository(staged, "ROLE", staged.roles, input.identity, guarded, input.failures, tracker),
    policies: writeRepository(staged, "POLICY", staged.policies, input.identity, guarded, input.failures, tracker),
    teamScopes: writeRepository(staged, "TEAM_SCOPE", staged.teamScopes, input.identity, guarded, input.failures, tracker),
    sourceGovernance: writeRepository(staged, "SOURCE_REGISTRY", staged.sources, input.identity, guarded, input.failures, tracker),
    publicationTargets: writeRepository(staged, "PUBLICATION_TARGET", staged.targets, input.identity, guarded, input.failures, tracker),
    proposals: proposalWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    decisions: decisionWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    idempotency: idempotencyWriteRepository(staged, input.identity, guarded, input.failures, tracker),
    commit: () => finish(true),
    rollback: () => finish(false),
    isActive: () => active,
  };
}

export function createAdministrationReadRepositories(state: AdministrationTransactionState): {
  readonly roleAssignments: RoleAssignmentReadRepository;
  readonly roles: RoleReadRepository;
  readonly policies: PolicyReadRepository;
  readonly teamScopes: TeamScopeReadRepository;
  readonly sourceGovernance: SourceGovernanceReadRepository;
  readonly publicationTargets: PublicationTargetReadRepository;
  readonly proposals: AdministrationProposalReadRepository;
  readonly decisions: AdministrationDecisionReadRepository;
  readonly idempotency: AdministrationIdempotencyReadRepository;
} {
  return {
    roleAssignments: readRepository("ROLE_ASSIGNMENT", state.roleAssignments),
    roles: readRepository("ROLE", state.roles),
    policies: readRepository("POLICY", state.policies),
    teamScopes: readRepository("TEAM_SCOPE", state.teamScopes),
    sourceGovernance: readRepository("SOURCE_REGISTRY", state.sources),
    publicationTargets: readRepository("PUBLICATION_TARGET", state.targets),
    proposals: proposalReadRepository(state),
    decisions: decisionReadRepository(state),
    idempotency: idempotencyReadRepository(state),
  };
}

function readRepository<Record extends GovernedRecord>(
  resourceType: AdministrationPersistenceResourceType,
  records: Map<string, Record>,
): RoleAssignmentReadRepository & RoleReadRepository & PolicyReadRepository & TeamScopeReadRepository & SourceGovernanceReadRepository & PublicationTargetReadRepository {
  return {
    find: (identity) => {
      if (identity.resourceType !== resourceType) return undefined;
      const record = records.get(identityKey(identity));
      return record === undefined ? undefined : immutable(record);
    },
    listByScope: (scope) => immutable([...records.values()]
      .filter((record) => sameScope(record.scope, scope))
      .sort((a, b) => recordId(a).localeCompare(recordId(b)))),
    listBySubject: (tenantId, subjectPrincipalId) => immutable([...records.values()]
      .filter((record) => record.recordType === "ROLE_ASSIGNMENT" && record.tenantId === tenantId && record.subjectPrincipalId === subjectPrincipalId)
      .sort((a, b) => recordId(a).localeCompare(recordId(b)))) as readonly RoleAssignmentPersistenceRecord[],
  } as RoleAssignmentReadRepository & RoleReadRepository & PolicyReadRepository & TeamScopeReadRepository & SourceGovernanceReadRepository & PublicationTargetReadRepository;
}

function writeRepository<Record extends GovernedRecord>(
  state: AdministrationTransactionState,
  resourceType: AdministrationPersistenceResourceType,
  records: Map<string, Record>,
  identity: AdministrationTransactionIdentity,
  guarded: <Result>(operation: () => Result) => Result,
  failures: AdministrationPersistenceFailurePort,
  tracker: AdministrationTransactionTracker,
): RoleAssignmentWriteRepository & RoleWriteRepository & PolicyWriteRepository & TeamScopeWriteRepository & SourceGovernanceWriteRepository & PublicationTargetWriteRepository {
  const read = readRepository(resourceType, records);
  const assertRecordScope = (record: Record): void => {
    if (record.recordType !== resourceType || record.tenantId !== identity.tenantId || recordId(record) !== identity.resourceId || record.scope.tenantId !== record.tenantId) {
      throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
    }
  };
  return {
    ...read,
    save: (record: Record): void => guarded(() => {
      assertRecordScope(record);
      failures.check("STATE_WRITE");
      const key = identityKey(identity);
      if (records.has(key)) throw persistenceError("RECORD_ALREADY_EXISTS");
      validateVersion(record.version, 1);
      if (tracker.governedSave !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.governedSave = clone(record);
      records.set(key, clone(record));
      state.changed(identity);
    }),
    update: (expectedVersion: number, record: Record): void => guarded(() => {
      assertRecordScope(record);
      failures.check("STATE_WRITE");
      const key = identityKey(identity);
      const current = records.get(key);
      if (current === undefined) throw persistenceError("RECORD_NOT_FOUND");
      if (current.version !== expectedVersion) throw persistenceError("VERSION_CONFLICT");
      if (tracker.authoritativeUpdate !== undefined) throw persistenceError("VERSION_ADVANCEMENT_INVALID");
      assertImmutableGovernedLinkage(current, record);
      validateVersion(record.version, expectedVersion + 1);
      tracker.authoritativeUpdate = { initialVersion: expectedVersion, finalVersion: record.version, record: clone(record) };
      records.set(key, clone(record));
      state.changed(identity);
    }),
  } as RoleAssignmentWriteRepository & RoleWriteRepository & PolicyWriteRepository & TeamScopeWriteRepository & SourceGovernanceWriteRepository & PublicationTargetWriteRepository;
}

function proposalReadRepository(state: AdministrationTransactionState): AdministrationProposalReadRepository {
  return {
    findById: (tenantId, proposalId) => optionalImmutable(state.proposals.get(proposalKey(tenantId, proposalId))),
    listPending: (scope) => immutable([...state.proposals.values()].filter((record) => record.status === "PROPOSED" && sameScope(record.scope, scope)).sort((a, b) => a.proposalId.localeCompare(b.proposalId))),
    listByScope: (scope) => immutable([...state.proposals.values()].filter((record) => sameScope(record.scope, scope)).sort((a, b) => a.proposalId.localeCompare(b.proposalId))),
  };
}

function proposalWriteRepository(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationProposalWriteRepository {
  return {
    ...proposalReadRepository(state),
    save: (record): void => guarded(() => {
      assertProposalScope(record, identity);
      failures.check("STATE_WRITE");
      const key = proposalKey(record.tenantId, record.proposalId);
      if (state.proposals.has(key)) throw persistenceError("RECORD_ALREADY_EXISTS");
      validateVersion(record.version, 1);
      if (tracker.proposalSave !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.proposalSave = clone(record);
      state.proposals.set(key, clone(record));
      state.changed(identity);
    }),
    update: (expectedVersion, record): void => guarded(() => {
      assertProposalScope(record, identity);
      failures.check("STATE_WRITE");
      const key = proposalKey(record.tenantId, record.proposalId);
      const current = state.proposals.get(key);
      if (current === undefined) throw persistenceError("RECORD_NOT_FOUND");
      if (current.version !== expectedVersion) throw persistenceError("VERSION_CONFLICT");
      if (current.proposedBy !== record.proposedBy || current.resourceType !== record.resourceType || current.resourceId !== record.resourceId || current.resourceVersion !== record.resourceVersion || current.proposedChangeReference !== record.proposedChangeReference || current.policyReference !== record.policyReference || current.reasonReference !== record.reasonReference || !sameJson(current.sourceGovernanceChange, record.sourceGovernanceChange) || !sameJson(current.publicationTargetGovernanceChange, record.publicationTargetGovernanceChange) || !sameScope(current.scope, record.scope) || !evidenceAppends(current.evidenceReferences, record.evidenceReferences)) throw persistenceError("PROPOSER_IMMUTABLE");
      if (current.status !== "PROPOSED") throw persistenceError("PERSISTENCE_INPUT_INVALID");
      validateVersion(record.version, expectedVersion + 1);
      if (tracker.proposalUpdate !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.proposalUpdate = clone(record);
      state.proposals.set(key, clone(record));
      state.changed(identity);
    }),
  };
}

function decisionReadRepository(state: AdministrationTransactionState): AdministrationDecisionReadRepository {
  return {
    findById: (tenantId, decisionId) => optionalImmutable(state.decisions.get(decisionKey(tenantId, decisionId))),
    list: (identity) => immutable([...state.decisions.values()]
      .filter((record) => decisionMatches(record, identity))
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId))),
    listByScope: (scope) => immutable([...state.decisions.values()]
      .filter((record) => sameScope(record.scope, scope))
      .sort((a, b) => a.decisionId.localeCompare(b.decisionId))),
  };
}

function decisionWriteRepository(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationDecisionWriteRepository {
  return {
    ...decisionReadRepository(state),
    append: (record): AdministrationDecisionRecord => guarded(() => {
      assertDecisionScope(record, identity);
      failures.check("DECISION_APPEND");
      const key = decisionKey(record.tenantId, record.decisionId);
      if (state.decisions.has(key)) throw persistenceError("DECISION_DUPLICATE");
      const proposal = state.proposals.get(proposalKey(record.tenantId, record.proposalId));
      if (proposal?.proposedBy !== record.proposerId) throw persistenceError("PROPOSER_IMMUTABLE");
      if (proposal === undefined || !assertIdentityShape(proposal, identity) || !sameScope(proposal.scope, record.scope)) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
      if (record.proposerId === record.decisionActorId) throw persistenceError("PERSISTENCE_INPUT_INVALID");
      if (tracker.decision !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.decision = clone(record);
      state.decisions.set(key, clone(record));
      state.changed(identity);
      return immutable(record);
    }),
  };
}

function idempotencyReadRepository(state: AdministrationTransactionState): AdministrationIdempotencyReadRepository {
  return { find: (identity) => optionalImmutable(state.idempotency.get(idempotencyKey(identity))) };
}

function idempotencyWriteRepository(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity, guarded: <Result>(operation: () => Result) => Result, failures: AdministrationPersistenceFailurePort, tracker: AdministrationTransactionTracker): AdministrationIdempotencyWriteRepository {
  return {
    ...idempotencyReadRepository(state),
    record: (record): AdministrationIdempotencyResult => guarded(() => {
      assertIdentity(record, identity);
      failures.check("IDEMPOTENCY_WRITE");
      const key = idempotencyKey(record);
      const existing = state.idempotency.get(key);
      if (existing !== undefined) {
        if (existing.fingerprint !== record.fingerprint || existing.operation !== record.operation) throw persistenceError("IDEMPOTENCY_CONFLICT");
        return immutable({ status: "REPLAYED" as const, record: existing });
      }
      if (tracker.idempotency !== undefined) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
      tracker.idempotency = clone(record);
      state.idempotency.set(key, clone(record));
      state.changed(identity);
      return immutable({ status: "STORED" as const, record });
    }),
  };
}

const OPERATION_RESOURCE: Readonly<Record<AdministrationPersistenceOperation, AdministrationPersistenceResourceType>> = Object.freeze({
  PROPOSE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", APPROVE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", REJECT_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT", REVOKE_ROLE_ASSIGNMENT: "ROLE_ASSIGNMENT",
  PROPOSE_ROLE_CHANGE: "ROLE", APPROVE_ROLE_CHANGE: "ROLE", REJECT_ROLE_CHANGE: "ROLE",
  PROPOSE_POLICY_CHANGE: "POLICY", APPROVE_POLICY_CHANGE: "POLICY", REJECT_POLICY_CHANGE: "POLICY",
  PROPOSE_TEAM_SCOPE_CHANGE: "TEAM_SCOPE", APPROVE_TEAM_SCOPE_CHANGE: "TEAM_SCOPE", REJECT_TEAM_SCOPE_CHANGE: "TEAM_SCOPE",
  PROPOSE_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", APPROVE_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", REJECT_SOURCE_GOVERNANCE: "SOURCE_REGISTRY", TRANSITION_SOURCE_GOVERNANCE: "SOURCE_REGISTRY",
  PROPOSE_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", APPROVE_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", REJECT_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET", TRANSITION_PUBLICATION_TARGET_GOVERNANCE: "PUBLICATION_TARGET",
});

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
  const expectedStatus = rejection ? "REJECTED" : idempotency.operation.startsWith("REVOKE_") ? "REVOKED" : "APPROVED";
  if (proposal.status !== expectedStatus || decision.status !== expectedStatus || idempotency.resultVersion !== decision.version || idempotency.resultReference !== decision.decisionId) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  if (rejection) {
    if (tracker.authoritativeUpdate !== undefined || tracker.governedSave !== undefined || decision.version !== proposal.resourceVersion) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  } else {
    const update = tracker.authoritativeUpdate;
    if (update === undefined || tracker.governedSave !== undefined || proposal.resourceVersion !== update.initialVersion || update.finalVersion !== update.initialVersion + 1 || decision.version !== update.finalVersion) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if ((idempotency.operation.startsWith("TRANSITION_") || idempotency.operation.startsWith("REVOKE_")) && tracker.existingRecord?.status !== "ACTIVE") throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
    if (!operationAllowsStatus(idempotency.operation, update.record)) throw persistenceError("ATOMIC_BUNDLE_INCOMPLETE");
  }
}

export function validateHydratedRole(role: RolePersistenceRecord): void {
  if (role.recordType !== "ROLE" || role.tenantId !== role.scope.tenantId) throw persistenceError("PERSISTENCE_SCOPE_VIOLATION");
  if (![role.tenantId, role.roleId, role.roleCode, role.scope.scopeId, role.policyReference].every((value) => value.trim().length > 0)
    || !Number.isSafeInteger(role.version) || role.version < 1 || !["ACTIVE", "RETIRED"].includes(role.status)
    || role.evidenceReferences.some((reference) => !["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(reference.type) || reference.id.trim().length === 0 || !Number.isSafeInteger(reference.version) || reference.version < 1)) throw persistenceError("PERSISTENCE_INPUT_INVALID");
}

export function identityKey(identity: AdministrationTransactionIdentity): string {
  return JSON.stringify([identity.tenantId, identity.resourceType, identity.resourceId]);
}

export function clone<Value>(value: Value): Value { return structuredClone(value); }

function immutableTracker(tracker: AdministrationTransactionTracker): AdministrationTransactionTrackerSnapshot {
  return immutable({
    ...(tracker.existingRecord === undefined ? {} : { existingRecord: tracker.existingRecord }),
    ...(tracker.governedSave === undefined ? {} : { governedSave: tracker.governedSave }),
    ...(tracker.authoritativeUpdate === undefined ? {} : { authoritativeUpdate: tracker.authoritativeUpdate }),
    ...(tracker.proposalSave === undefined ? {} : { proposalSave: tracker.proposalSave }),
    ...(tracker.proposalUpdate === undefined ? {} : { proposalUpdate: tracker.proposalUpdate }),
    ...(tracker.decision === undefined ? {} : { decision: tracker.decision }),
    ...(tracker.idempotency === undefined ? {} : { idempotency: tracker.idempotency }),
  });
}

function validateIdentity(identity: AdministrationTransactionIdentity): void { if ([identity.tenantId, identity.resourceType, identity.resourceId].some((value) => value.trim().length === 0)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); }
function validateVersion(actual: number, expected: number): void { if (!Number.isSafeInteger(actual) || actual !== expected) throw persistenceError("VERSION_ADVANCEMENT_INVALID"); }
function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean { return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId; }
function sameValues(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && left.every((value, index) => value === right[index]); }
function evidenceAppends(left: readonly AdministrationEvidenceReference[], right: readonly AdministrationEvidenceReference[]): boolean {
  return left.length <= right.length && left.every((value, index) => {
    const candidate = right[index];
    return value.type === candidate?.type && value.id === candidate.id && value.version === candidate.version;
  });
}
function sameJson(left: unknown, right: unknown): boolean { return stableJson(left) === stableJson(right); }
function stableJson(value: unknown): string { return JSON.stringify(sortJson(value)); }
function sortJson(value: unknown): unknown { if (Array.isArray(value)) return value.map(sortJson); if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortJson(child)])); }
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
function proposalKey(tenantId: string, proposalId: string): string { return JSON.stringify([tenantId, proposalId]); }
function decisionKey(tenantId: string, decisionId: string): string { return JSON.stringify([tenantId, decisionId]); }
function idempotencyKey(identity: AdministrationIdempotencyIdentity): string { return JSON.stringify([identity.tenantId, identity.resourceType, identity.resourceId, identity.idempotencyKey]); }
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
      || current.roleId !== next.roleId || !sameValues(current.teamIds, next.teamIds)
      || !sameValues(current.resourceTypes, next.resourceTypes) || !sameValues(current.purposes, next.purposes)
      || current.effectiveFrom !== next.effectiveFrom || current.effectiveUntil !== next.effectiveUntil
      || current.reasonReference !== next.reasonReference || (current.approvedBy !== undefined && current.approvedBy !== next.approvedBy);
    if (linkageChanged) throw persistenceError("PROPOSER_IMMUTABLE");
  }
}
function governedRecord(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity): GovernedRecord | undefined {
  if (identity.resourceType === "ROLE_ASSIGNMENT") return state.roleAssignments.get(identityKey(identity));
  if (identity.resourceType === "ROLE") return state.roles.get(identityKey(identity));
  if (identity.resourceType === "POLICY") return state.policies.get(identityKey(identity));
  if (identity.resourceType === "TEAM_SCOPE") return state.teamScopes.get(identityKey(identity));
  if (identity.resourceType === "SOURCE_REGISTRY") return state.sources.get(identityKey(identity));
  return state.targets.get(identityKey(identity));
}
function replaceGoverned<Record extends GovernedRecord>(target: Map<string, Record>, source: Map<string, Record>, identity: AdministrationTransactionIdentity): void { const key = identityKey(identity); const record = source.get(key); if (record === undefined) target.delete(key); else target.set(key, clone(record)); }
function replaceScoped<Record>(target: Map<string, Record>, source: Map<string, Record>, identity: AdministrationTransactionIdentity, matches: (record: Record, identity: AdministrationTransactionIdentity) => boolean): void { for (const [key, record] of target) if (matches(record, identity)) target.delete(key); for (const [key, record] of source) if (matches(record, identity)) target.set(key, clone(record)); }
function persistenceError(code: ConstructorParameters<typeof AdministrationPersistenceError>[0]): AdministrationPersistenceError { return new AdministrationPersistenceError(code); }
function optionalClone<Value>(value: Value | undefined): Value | undefined { return value === undefined ? undefined : clone(value); }
function optionalImmutable<Value>(value: Value | undefined): Value | undefined { return value === undefined ? undefined : immutable(value); }
function immutable<Value>(value: Value): Value { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return; for (const child of Object.values(value)) deepFreeze(child); Object.freeze(value); }
