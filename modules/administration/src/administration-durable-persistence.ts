import { DatabaseSync, type SQLOutputValue } from "node:sqlite";
import { existsSync } from "node:fs";

import {
  AdministrationPersistenceError,
  type AdministrationDecisionReadRepository,
  type AdministrationDecisionRecord,
  type AdministrationEvidenceReference,
  type AdministrationIdempotencyReadRepository,
  type AdministrationIdempotencyRecord,
  type AdministrationPersistenceFailurePort,
  type AdministrationPersistenceOperation,
  type AdministrationPersistenceResourceType,
  type AdministrationPersistenceScope,
  type AdministrationProposalReadRepository,
  type AdministrationProposalRecord,
  type AdministrationTransaction,
  type AdministrationTransactionIdentity,
  type AdministrationUnitOfWork,
  type PolicyReadRepository,
  type PublicationTargetReadRepository,
  type RoleAssignmentReadRepository,
  type RoleReadRepository,
  type SourceGovernanceReadRepository,
  type TeamScopeReadRepository,
} from "./administration-persistence.js";
import {
  AdministrationTransactionState,
  createAdministrationReadRepositories,
  createAdministrationTransaction,
  identityKey,
  type AdministrationTransactionTrackerSnapshot,
  type GovernedRecord,
} from "./administration-persistence-engine.js";

const SCHEMA_VERSION = 1;
const NO_FAILURES: AdministrationPersistenceFailurePort = Object.freeze({ check: () => undefined });
const RESOURCE_TYPES = Object.freeze([
  "ROLE_ASSIGNMENT", "ROLE", "POLICY", "TEAM_SCOPE", "SOURCE_REGISTRY", "PUBLICATION_TARGET",
] as const);
const SCOPE_TYPES = Object.freeze(["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"] as const);
const ROLE_CODES = Object.freeze(["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"] as const);
const PROPOSAL_STATUSES = Object.freeze(["PROPOSED", "APPROVED", "REJECTED", "REVOKED"] as const);
const DECISION_STATUSES = Object.freeze(["APPROVED", "REJECTED", "REVOKED"] as const);
const RESULT_STATUSES = Object.freeze(["PROPOSED", "ACTIVE", "REJECTED", "REVOKED", "PAUSED", "BLOCKED", "RETIRED"] as const);
const OPERATIONS = Object.freeze([
  "PROPOSE_ROLE_ASSIGNMENT", "APPROVE_ROLE_ASSIGNMENT", "REJECT_ROLE_ASSIGNMENT", "REVOKE_ROLE_ASSIGNMENT",
  "PROPOSE_ROLE_CHANGE", "APPROVE_ROLE_CHANGE", "REJECT_ROLE_CHANGE",
  "PROPOSE_POLICY_CHANGE", "APPROVE_POLICY_CHANGE", "REJECT_POLICY_CHANGE",
  "PROPOSE_TEAM_SCOPE_CHANGE", "APPROVE_TEAM_SCOPE_CHANGE", "REJECT_TEAM_SCOPE_CHANGE",
  "PROPOSE_SOURCE_GOVERNANCE", "APPROVE_SOURCE_GOVERNANCE", "REJECT_SOURCE_GOVERNANCE", "TRANSITION_SOURCE_GOVERNANCE",
  "PROPOSE_PUBLICATION_TARGET_GOVERNANCE", "APPROVE_PUBLICATION_TARGET_GOVERNANCE",
  "REJECT_PUBLICATION_TARGET_GOVERNANCE", "TRANSITION_PUBLICATION_TARGET_GOVERNANCE",
] as const satisfies readonly AdministrationPersistenceOperation[]);
type EvidenceTable = "administration_resource_evidence" | "administration_proposal_evidence" | "administration_decision_evidence";

export interface DurableAdministrationUnitOfWorkOptions {
  readonly databasePath: string;
  readonly busyTimeoutMilliseconds?: 5000;
  readonly failures?: AdministrationPersistenceFailurePort;
  readonly schemaMode?: "INITIALIZE" | "REQUIRE_EXISTING";
}

export class DurableAdministrationUnitOfWork implements AdministrationUnitOfWork {
  readonly #database: DatabaseSync;
  readonly #failures: AdministrationPersistenceFailurePort;
  readonly #state: AdministrationTransactionState;
  readonly #reads: ReturnType<typeof createAdministrationReadRepositories>;
  #active = false;
  #closed = false;
  #quarantined = false;

  public readonly roleAssignments: RoleAssignmentReadRepository;
  public readonly roles: RoleReadRepository;
  public readonly policies: PolicyReadRepository;
  public readonly teamScopes: TeamScopeReadRepository;
  public readonly sourceGovernance: SourceGovernanceReadRepository;
  public readonly publicationTargets: PublicationTargetReadRepository;
  public readonly proposals: AdministrationProposalReadRepository;
  public readonly decisions: AdministrationDecisionReadRepository;
  public readonly idempotency: AdministrationIdempotencyReadRepository;

  public constructor(options: DurableAdministrationUnitOfWorkOptions) {
    const schemaMode = options.schemaMode ?? "INITIALIZE";
    if (!isFileDatabasePath(options.databasePath)
      || (options.busyTimeoutMilliseconds !== undefined && options.busyTimeoutMilliseconds !== 5000)
      || (schemaMode !== "INITIALIZE" && schemaMode !== "REQUIRE_EXISTING")
      || (schemaMode === "REQUIRE_EXISTING" && !existsSync(options.databasePath))) {
      throw persistenceError("PERSISTENCE_INPUT_INVALID");
    }
    this.#failures = options.failures ?? NO_FAILURES;
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      if (schemaMode === "INITIALIZE") {
        configureDatabase(database, options.busyTimeoutMilliseconds ?? 5000);
        bootstrapSchema(database);
      } else {
        configurePreparedDatabase(database, options.busyTimeoutMilliseconds ?? 5000);
      }
      this.#state = readStateSnapshot(database, true);
      this.#database = database;
    } catch (error) {
      try { database?.close(); } catch { /* preserve safe startup failure */ }
      throw mapStorageError(error);
    }
    this.#reads = createAdministrationReadRepositories(this.#state);
    this.roleAssignments = {
      find: (identity): ReturnType<RoleAssignmentReadRepository["find"]> => { this.refreshState(); return this.#reads.roleAssignments.find(identity); },
      listByScope: (scope): ReturnType<RoleAssignmentReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.roleAssignments.listByScope(scope); },
      listBySubject: (tenantId, subjectPrincipalId): ReturnType<RoleAssignmentReadRepository["listBySubject"]> => { this.refreshState(); return this.#reads.roleAssignments.listBySubject(tenantId, subjectPrincipalId); },
    };
    this.roles = {
      find: (identity): ReturnType<RoleReadRepository["find"]> => { this.refreshState(); return this.#reads.roles.find(identity); },
      listByScope: (scope): ReturnType<RoleReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.roles.listByScope(scope); },
    };
    this.policies = {
      find: (identity): ReturnType<PolicyReadRepository["find"]> => { this.refreshState(); return this.#reads.policies.find(identity); },
      listByScope: (scope): ReturnType<PolicyReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.policies.listByScope(scope); },
    };
    this.teamScopes = {
      find: (identity): ReturnType<TeamScopeReadRepository["find"]> => { this.refreshState(); return this.#reads.teamScopes.find(identity); },
      listByScope: (scope): ReturnType<TeamScopeReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.teamScopes.listByScope(scope); },
    };
    this.sourceGovernance = {
      find: (identity): ReturnType<SourceGovernanceReadRepository["find"]> => { this.refreshState(); return this.#reads.sourceGovernance.find(identity); },
      listByScope: (scope): ReturnType<SourceGovernanceReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.sourceGovernance.listByScope(scope); },
    };
    this.publicationTargets = {
      find: (identity): ReturnType<PublicationTargetReadRepository["find"]> => { this.refreshState(); return this.#reads.publicationTargets.find(identity); },
      listByScope: (scope): ReturnType<PublicationTargetReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.publicationTargets.listByScope(scope); },
    };
    this.proposals = {
      findById: (tenantId, proposalId): ReturnType<AdministrationProposalReadRepository["findById"]> => { this.refreshState(); return this.#reads.proposals.findById(tenantId, proposalId); },
      listPending: (scope): ReturnType<AdministrationProposalReadRepository["listPending"]> => { this.refreshState(); return this.#reads.proposals.listPending(scope); },
      listByScope: (scope): ReturnType<AdministrationProposalReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.proposals.listByScope(scope); },
    };
    this.decisions = {
      findById: (tenantId, decisionId): ReturnType<AdministrationDecisionReadRepository["findById"]> => { this.refreshState(); return this.#reads.decisions.findById(tenantId, decisionId); },
      list: (identity): ReturnType<AdministrationDecisionReadRepository["list"]> => { this.refreshState(); return this.#reads.decisions.list(identity); },
      listByScope: (scope): ReturnType<AdministrationDecisionReadRepository["listByScope"]> => { this.refreshState(); return this.#reads.decisions.listByScope(scope); },
    };
    this.idempotency = { find: (identity): ReturnType<AdministrationIdempotencyReadRepository["find"]> => { this.refreshState(); return this.#reads.idempotency.find(identity); } };
  }

  public begin(identity: AdministrationTransactionIdentity): AdministrationTransaction {
    if (this.#closed || this.#quarantined) throw persistenceError("PERSISTENCE_WRITE_FAILED");
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE");
    this.refreshState();
    this.#active = true;
    try {
      return createAdministrationTransaction({
        identity,
        initialState: this.#state,
        initialRevision: this.#state.revision(identity),
        failures: this.#failures,
        commitBoundary: { commit: ({ initialRevision, state, tracker }) => this.commit(identity, initialRevision, state, tracker) },
        release: () => { this.#active = false; },
      });
    } catch (error) {
      this.#active = false;
      throw error;
    }
  }

  public close(): void {
    if (this.#closed) return;
    if (this.#active) throw persistenceError("TRANSACTION_ALREADY_ACTIVE");
    this.#closed = true;
    this.#database.close();
  }

  private commit(identity: AdministrationTransactionIdentity, initialRevision: number, state: AdministrationTransactionState, tracker: AdministrationTransactionTrackerSnapshot): void {
    let transactionOpen = false;
    let commitStarted = false;
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      transactionOpen = true;
      ensureRevision(this.#database, identity, initialRevision);
      persistTrackedChanges(this.#database, tracker);
      compareAndSwapRevision(this.#database, identity, initialRevision);
      commitStarted = true;
      this.#database.exec("COMMIT");
      transactionOpen = false;
      state.revisions.set(identityKey(identity), initialRevision + 1);
      this.#state.replaceScope(state, identity);
    } catch (error) {
      if (transactionOpen && !commitStarted) {
        try { this.#database.exec("ROLLBACK"); } catch { this.#quarantined = true; }
      } else if (commitStarted) {
        this.#quarantined = true;
      }
      throw mapStorageError(error);
    }
  }

  private refreshState(): void {
    if (this.#closed || this.#quarantined) throw persistenceError("PERSISTENCE_WRITE_FAILED");
    try {
      this.#state.replaceAll(readStateSnapshot(this.#database, false));
    } catch (error) {
      throw mapStorageError(error);
    }
  }
}

function readStateSnapshot(database: DatabaseSync, validateIntegrity: boolean): AdministrationTransactionState {
  database.exec("BEGIN");
  try {
    if (validateIntegrity) validateDatabase(database);
    const state = loadState(database);
    database.exec("COMMIT");
    return state;
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* caller closes or quarantines the connection */ }
    throw error;
  }
}

function configureDatabase(database: DatabaseSync, busyTimeoutMilliseconds: number): void {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA synchronous = FULL");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMilliseconds}`);
}

function configurePreparedDatabase(database: DatabaseSync, busyTimeoutMilliseconds: number): void {
  database.exec("PRAGMA foreign_keys = ON");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMilliseconds}`);
}

function bootstrapSchema(database: DatabaseSync): void {
  database.exec("BEGIN EXCLUSIVE");
  try {
    database.exec(SCHEMA_SQL);
    const row = database.prepare("SELECT schema_version FROM administration_schema WHERE singleton_id = 1").get();
    if (row === undefined) {
      database.prepare("INSERT INTO administration_schema (singleton_id, schema_version) VALUES (1, ?)").run(SCHEMA_VERSION);
    } else if (numberValue(row["schema_version"]) !== SCHEMA_VERSION) {
      throw persistenceError("PERSISTENCE_INPUT_INVALID");
    }
    database.exec("COMMIT");
  } catch (error) {
    try { database.exec("ROLLBACK"); } catch { /* constructor closes the connection */ }
    throw error;
  }
}

function validateDatabase(database: DatabaseSync): void {
  const integrity = database.prepare("PRAGMA integrity_check").get();
  if (integrity === undefined || Object.values(integrity)[0] !== "ok") throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) throw persistenceError("PERSISTENCE_INPUT_INVALID");
}

function loadState(database: DatabaseSync): AdministrationTransactionState {
  const state = new AdministrationTransactionState();
  for (const row of database.prepare("SELECT tenant_id, resource_type, resource_id, version, scope_type, scope_id, payload_json FROM administration_resources ORDER BY tenant_id, resource_type, resource_id").all()) {
    const record = decodeGovernedRecord(database, row);
    setGovernedRecord(state, record);
  }
  for (const row of database.prepare("SELECT tenant_id, proposal_id, resource_type, resource_id, version, scope_type, scope_id, payload_json FROM administration_proposals ORDER BY tenant_id, proposal_id").all()) {
    const record = decodeProposal(database, row);
    state.proposals.set(proposalKey(record.tenantId, record.proposalId), record);
  }
  for (const row of database.prepare("SELECT tenant_id, decision_id, proposal_id, resource_type, resource_id, version, scope_type, scope_id, payload_json FROM administration_decisions ORDER BY tenant_id, decision_id").all()) {
    const record = decodeDecision(database, row);
    state.decisions.set(decisionKey(record.tenantId, record.decisionId), record);
  }
  for (const row of database.prepare("SELECT tenant_id, resource_type, resource_id, idempotency_key, operation, fingerprint, result_reference, result_version, payload_json FROM administration_idempotency ORDER BY tenant_id, resource_type, resource_id, idempotency_key").all()) {
    const record = decodeIdempotency(row);
    state.idempotency.set(idempotencyKey(record), record);
  }
  for (const row of database.prepare("SELECT tenant_id, resource_type, resource_id, revision FROM administration_revisions").all()) {
    const identity = rowIdentity(row);
    const revision = numberValue(row["revision"]);
    if (!Number.isSafeInteger(revision) || revision < 0) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    state.revisions.set(identityKey(identity), revision);
  }
  validateLoadedLinkage(state);
  return state;
}

function persistTrackedChanges(database: DatabaseSync, tracker: AdministrationTransactionTrackerSnapshot): void {
  if (tracker.governedSave !== undefined) insertGovernedRecord(database, tracker.governedSave);
  if (tracker.authoritativeUpdate !== undefined) updateGovernedRecord(database, tracker.authoritativeUpdate.initialVersion, tracker.authoritativeUpdate.record);
  if (tracker.proposalSave !== undefined) insertProposal(database, tracker.proposalSave);
  if (tracker.proposalUpdate !== undefined) updateProposal(database, tracker.proposalUpdate.version - 1, tracker.proposalUpdate);
  if (tracker.decision !== undefined) insertDecision(database, tracker.decision);
  if (tracker.idempotency !== undefined) insertIdempotency(database, tracker.idempotency);
}

function ensureRevision(database: DatabaseSync, identity: AdministrationTransactionIdentity, initialRevision: number): void {
  const existing = database.prepare("SELECT revision FROM administration_revisions WHERE tenant_id = ? AND resource_type = ? AND resource_id = ?").get(identity.tenantId, identity.resourceType, identity.resourceId);
  if (existing === undefined) {
    if (initialRevision !== 0) throw persistenceError("VERSION_CONFLICT");
    const result = database.prepare("INSERT INTO administration_revisions (tenant_id, resource_type, resource_id, revision) VALUES (?, ?, ?, 0)").run(identity.tenantId, identity.resourceType, identity.resourceId);
    if (numberValue(result.changes) !== 1) throw persistenceError("VERSION_CONFLICT");
  } else if (numberValue(existing["revision"]) !== initialRevision) {
    throw persistenceError("VERSION_CONFLICT");
  }
}

function compareAndSwapRevision(database: DatabaseSync, identity: AdministrationTransactionIdentity, initialRevision: number): void {
  const result = database.prepare("UPDATE administration_revisions SET revision = revision + 1 WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND revision = ?").run(identity.tenantId, identity.resourceType, identity.resourceId, initialRevision);
  if (numberValue(result.changes) !== 1) throw persistenceError("VERSION_CONFLICT");
}

function insertGovernedRecord(database: DatabaseSync, record: GovernedRecord): void {
  const identity = governedIdentity(record);
  database.prepare("INSERT INTO administration_resources (tenant_id, resource_type, resource_id, version, scope_type, scope_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(identity.tenantId, identity.resourceType, identity.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, payloadWithoutEvidence(record));
  insertEvidence(database, "administration_resource_evidence", [identity.tenantId, identity.resourceType, identity.resourceId], record.evidenceReferences, 0);
}

function updateGovernedRecord(database: DatabaseSync, expectedVersion: number, record: GovernedRecord): void {
  const identity = governedIdentity(record);
  const count = evidenceCount(database, "administration_resource_evidence", "tenant_id = ? AND resource_type = ? AND resource_id = ?", [identity.tenantId, identity.resourceType, identity.resourceId]);
  const result = database.prepare("UPDATE administration_resources SET version = ?, scope_type = ?, scope_id = ?, payload_json = ? WHERE tenant_id = ? AND resource_type = ? AND resource_id = ? AND version = ?")
    .run(record.version, record.scope.scopeType, record.scope.scopeId, payloadWithoutEvidence(record), identity.tenantId, identity.resourceType, identity.resourceId, expectedVersion);
  if (numberValue(result.changes) !== 1) throw persistenceError("VERSION_CONFLICT");
  insertEvidence(database, "administration_resource_evidence", [identity.tenantId, identity.resourceType, identity.resourceId], record.evidenceReferences.slice(count), count);
}

function insertProposal(database: DatabaseSync, record: AdministrationProposalRecord): void {
  database.prepare("INSERT INTO administration_proposals (tenant_id, proposal_id, resource_type, resource_id, version, scope_type, scope_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(record.tenantId, record.proposalId, record.resourceType, record.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, payloadWithoutEvidence(record));
  insertEvidence(database, "administration_proposal_evidence", [record.tenantId, record.proposalId], record.evidenceReferences, 0);
}

function updateProposal(database: DatabaseSync, expectedVersion: number, record: AdministrationProposalRecord): void {
  const count = evidenceCount(database, "administration_proposal_evidence", "tenant_id = ? AND proposal_id = ?", [record.tenantId, record.proposalId]);
  const result = database.prepare("UPDATE administration_proposals SET version = ?, scope_type = ?, scope_id = ?, payload_json = ? WHERE tenant_id = ? AND proposal_id = ? AND version = ?")
    .run(record.version, record.scope.scopeType, record.scope.scopeId, payloadWithoutEvidence(record), record.tenantId, record.proposalId, expectedVersion);
  if (numberValue(result.changes) !== 1) throw persistenceError("VERSION_CONFLICT");
  insertEvidence(database, "administration_proposal_evidence", [record.tenantId, record.proposalId], record.evidenceReferences.slice(count), count);
}

function insertDecision(database: DatabaseSync, record: AdministrationDecisionRecord): void {
  database.prepare("INSERT INTO administration_decisions (tenant_id, decision_id, proposal_id, resource_type, resource_id, version, scope_type, scope_id, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(record.tenantId, record.decisionId, record.proposalId, record.resourceType, record.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, payloadWithoutEvidence(record));
  insertEvidence(database, "administration_decision_evidence", [record.tenantId, record.decisionId], record.evidenceReferences, 0);
}

function insertIdempotency(database: DatabaseSync, record: AdministrationIdempotencyRecord): void {
  database.prepare("INSERT INTO administration_idempotency (tenant_id, resource_type, resource_id, idempotency_key, operation, fingerprint, result_reference, result_version, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(record.tenantId, record.resourceType, record.resourceId, record.idempotencyKey, record.operation, record.fingerprint, record.resultReference, record.resultVersion, canonicalJson(record));
}

function insertEvidence(database: DatabaseSync, table: EvidenceTable, parentValues: readonly string[], evidence: readonly AdministrationEvidenceReference[], initialSequence: number): void {
  const columns = table === "administration_resource_evidence" ? "tenant_id, resource_type, resource_id, sequence, payload_json" : table === "administration_proposal_evidence" ? "tenant_id, proposal_id, sequence, payload_json" : "tenant_id, decision_id, sequence, payload_json";
  const placeholders = table === "administration_resource_evidence" ? "?, ?, ?, ?, ?" : "?, ?, ?, ?";
  const statement = database.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`);
  evidence.forEach((reference, index) => statement.run(...parentValues, initialSequence + index + 1, canonicalJson(reference)));
}

function decodeGovernedRecord(database: DatabaseSync, row: Record<string, SQLOutputValue>): GovernedRecord {
  const identity = rowIdentity(row);
  const payload = objectValue(row["payload_json"]);
  const scope = scopeFromRow(identity.tenantId, row);
  assertPayloadFields(payload, { tenantId: identity.tenantId, recordType: identity.resourceType, version: numberValue(row["version"]), scope });
  const evidenceReferences = readEvidence(database, "administration_resource_evidence", "tenant_id = ? AND resource_type = ? AND resource_id = ?", [identity.tenantId, identity.resourceType, identity.resourceId]);
  const record = { ...payload, recordType: identity.resourceType, tenantId: identity.tenantId, version: numberValue(row["version"]), scope, evidenceReferences } as unknown as GovernedRecord;
  validateGovernedRecord(record, identity);
  return record;
}

function decodeProposal(database: DatabaseSync, row: Record<string, SQLOutputValue>): AdministrationProposalRecord {
  const tenantId = stringValue(row["tenant_id"]);
  const proposalId = stringValue(row["proposal_id"]);
  const payload = objectValue(row["payload_json"]);
  const resourceType = resourceTypeValue(row["resource_type"]);
  const resourceId = stringValue(row["resource_id"]);
  const version = numberValue(row["version"]);
  const scope = scopeFromRow(tenantId, row);
  assertPayloadFields(payload, { tenantId, proposalId, resourceType, resourceId, version, scope });
  const evidenceReferences = readEvidence(database, "administration_proposal_evidence", "tenant_id = ? AND proposal_id = ?", [tenantId, proposalId]);
  const record = { ...payload, tenantId, proposalId, resourceType, resourceId, version, scope, evidenceReferences } as unknown as AdministrationProposalRecord;
  validateProposalRecord(record);
  return record;
}

function decodeDecision(database: DatabaseSync, row: Record<string, SQLOutputValue>): AdministrationDecisionRecord {
  const tenantId = stringValue(row["tenant_id"]);
  const decisionId = stringValue(row["decision_id"]);
  const payload = objectValue(row["payload_json"]);
  const proposalId = stringValue(row["proposal_id"]);
  const resourceType = resourceTypeValue(row["resource_type"]);
  const resourceId = stringValue(row["resource_id"]);
  const version = numberValue(row["version"]);
  const scope = scopeFromRow(tenantId, row);
  assertPayloadFields(payload, { tenantId, decisionId, proposalId, resourceType, resourceId, version, scope });
  const evidenceReferences = readEvidence(database, "administration_decision_evidence", "tenant_id = ? AND decision_id = ?", [tenantId, decisionId]);
  const record = { ...payload, tenantId, decisionId, proposalId, resourceType, resourceId, version, scope, evidenceReferences } as unknown as AdministrationDecisionRecord;
  validateDecisionRecord(record);
  return record;
}

function decodeIdempotency(row: Record<string, SQLOutputValue>): AdministrationIdempotencyRecord {
  const payload = objectValue(row["payload_json"]);
  assertPayloadFields(payload, {
    tenantId: stringValue(row["tenant_id"]),
    resourceType: resourceTypeValue(row["resource_type"]),
    resourceId: stringValue(row["resource_id"]),
    idempotencyKey: stringValue(row["idempotency_key"]),
    operation: stringValue(row["operation"]),
    fingerprint: stringValue(row["fingerprint"]),
    resultReference: stringValue(row["result_reference"]),
    resultVersion: numberValue(row["result_version"]),
  });
  const record = payload as unknown as AdministrationIdempotencyRecord;
  validateIdempotencyRecord(record);
  return record;
}

function readEvidence(database: DatabaseSync, table: EvidenceTable, where: string, values: readonly string[]): readonly AdministrationEvidenceReference[] {
  return database.prepare(`SELECT sequence, payload_json FROM ${table} WHERE ${where} ORDER BY sequence`).all(...values).map((row, index) => {
    if (numberValue(row["sequence"]) !== index + 1) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    const reference = objectValue(row["payload_json"]) as unknown as AdministrationEvidenceReference;
    validateEvidence(reference);
    return reference;
  });
}

function validateLoadedLinkage(state: AdministrationTransactionState): void {
  for (const proposal of state.proposals.values()) {
    const record = governedRecordFor(state, proposal);
    if (!state.revisions.has(identityKey(proposal)) || record === undefined || !sameScope(record.scope, proposal.scope)) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    const linkedDecisions = [...state.decisions.values()].filter((decision) => decision.tenantId === proposal.tenantId && decision.proposalId === proposal.proposalId);
    if (proposal.status === "PROPOSED") {
      if (proposal.version !== 1 || linkedDecisions.length !== 0) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    } else {
      const decision = linkedDecisions[0];
      const expectedDecisionVersion = proposal.resourceVersion + (proposal.status === "REJECTED" ? 0 : 1);
      if (proposal.version !== 2 || linkedDecisions.length !== 1 || decision?.status !== proposal.status
        || decision.version !== expectedDecisionVersion) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    }
  }
  for (const decision of state.decisions.values()) {
    const proposal = state.proposals.get(proposalKey(decision.tenantId, decision.proposalId));
    if (proposal?.resourceType !== decision.resourceType || proposal.resourceId !== decision.resourceId
      || proposal.proposedBy !== decision.proposerId || proposal.status !== decision.status
      || !sameScope(proposal.scope, decision.scope) || !state.revisions.has(identityKey(decision))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  }
  for (const record of state.idempotency.values()) {
    if (!state.revisions.has(identityKey(record)) || operationResourceType(record.operation) !== record.resourceType) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    if (record.operation.startsWith("PROPOSE_")) {
      const proposal = state.proposals.get(proposalKey(record.tenantId, record.resultReference));
      if (proposal?.resourceType !== record.resourceType || proposal.resourceId !== record.resourceId || record.resultVersion !== 1) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    } else {
      const decision = state.decisions.get(decisionKey(record.tenantId, record.resultReference));
      if (decision?.resourceType !== record.resourceType || decision.resourceId !== record.resourceId
        || decision.operation !== record.operation || decision.version !== record.resultVersion) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    }
  }
  for (const record of governedRecords(state)) {
    if (!state.revisions.has(identityKey(governedIdentity(record)))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    const history = [...state.decisions.values()].filter((decision) => decision.tenantId === record.tenantId
      && decision.resourceType === record.recordType && decision.resourceId === recordId(record));
    if (history.length > 0 && Math.max(...history.map((decision) => decision.version)) !== record.version) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    if (history.length === 0 && record.recordType !== "ROLE" && record.version !== 1) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    validateAuthoritativeStatus(record, history, state);
  }
}

function validateAuthoritativeStatus(
  record: GovernedRecord,
  history: readonly AdministrationDecisionRecord[],
  state: AdministrationTransactionState,
): void {
  const authoritative = history.filter((decision) => decision.status !== "REJECTED")
    .sort((left, right) => left.version - right.version || Date.parse(left.decidedAt) - Date.parse(right.decidedAt)).at(-1);
  if (authoritative === undefined) {
    const initialStatus = record.recordType === "SOURCE_REGISTRY" ? "DRAFT"
      : record.recordType === "ROLE" ? record.status
      : "PROPOSED";
    if (record.status !== initialStatus) throw persistenceError("PERSISTENCE_INPUT_INVALID");
    return;
  }
  const result = [...state.idempotency.values()].find((candidate) => candidate.tenantId === authoritative.tenantId
    && candidate.resourceType === authoritative.resourceType && candidate.resourceId === authoritative.resourceId
    && candidate.operation === authoritative.operation && candidate.resultReference === authoritative.decisionId);
  if (result?.resultStatus !== record.status || !operationPermitsResultStatus(authoritative.operation, record.status)) {
    throw persistenceError("PERSISTENCE_INPUT_INVALID");
  }
}

function operationPermitsResultStatus(operation: AdministrationPersistenceOperation, status: GovernedRecord["status"]): boolean {
  if (operation.startsWith("APPROVE_")) return status === "ACTIVE";
  if (operation === "REVOKE_ROLE_ASSIGNMENT") return status === "REVOKED";
  if (operation === "TRANSITION_SOURCE_GOVERNANCE") return status === "PAUSED" || status === "BLOCKED" || status === "RETIRED";
  if (operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE") return status === "PAUSED" || status === "RETIRED";
  return false;
}

function validateGovernedRecord(record: GovernedRecord, identity: AdministrationTransactionIdentity): void {
  if (record.recordType !== identity.resourceType || record.tenantId !== identity.tenantId || recordId(record) !== identity.resourceId || record.scope.tenantId !== record.tenantId || !positiveInteger(record.version)) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  validateScope(record.scope);
  record.evidenceReferences.forEach(validateEvidence);
  if (record.recordType === "ROLE_ASSIGNMENT" && (!nonEmpty(record.proposalId) || !nonEmpty(record.subjectPrincipalId)
    || !["HUMAN", "SERVICE"].includes(record.subjectPrincipalType) || !nonEmpty(record.roleId) || !stringArray(record.teamIds)
    || !stringArray(record.resourceTypes) || !stringArray(record.purposes) || !["PROPOSED", "ACTIVE", "REVOKED"].includes(record.status)
    || !isoTimestamp(record.effectiveFrom) || !isoTimestamp(record.effectiveUntil) || Date.parse(record.effectiveFrom) >= Date.parse(record.effectiveUntil)
    || !nonEmpty(record.proposedBy) || !nonEmpty(record.reasonReference))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (record.recordType === "ROLE" && (!nonEmpty(record.roleId) || !ROLE_CODES.includes(record.roleCode)
    || !["ACTIVE", "RETIRED"].includes(record.status) || !nonEmpty(record.policyReference))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (record.recordType === "POLICY" && (!nonEmpty(record.policyId) || !["PROPOSED", "ACTIVE", "REJECTED", "REVOKED"].includes(record.status) || !nonEmpty(record.policyReference))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (record.recordType === "TEAM_SCOPE" && (!nonEmpty(record.teamId) || !["PROPOSED", "ACTIVE", "REVOKED"].includes(record.status) || !nonEmpty(record.organizationId))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (record.recordType === "SOURCE_REGISTRY" && (!nonEmpty(record.sourceRegistryEntryId) || !["DRAFT", "UNDER_REVIEW", "ACTIVE", "PAUSED", "BLOCKED", "RETIRED"].includes(record.status)
    || !nonEmpty(record.policyReference) || !nonEmpty(record.name) || !nonEmpty(record.sourceType) || !stringArray(record.allowedMethods)
    || !stringArray(record.allowedPurposes) || !["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"].includes(record.classification))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  if (record.recordType === "PUBLICATION_TARGET" && (!nonEmpty(record.publicationTargetId) || !["PROPOSED", "ACTIVE", "PAUSED", "RETIRED"].includes(record.status)
    || !nonEmpty(record.policyReference) || !nonEmpty(record.channelReference) || !nonEmpty(record.name) || !nonEmpty(record.targetType)
    || !stringArray(record.allowedFieldReferences))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
}

function validateProposalRecord(record: AdministrationProposalRecord): void {
  if (!nonEmpty(record.proposalId) || !nonEmpty(record.tenantId) || !nonEmpty(record.resourceId) || !positiveInteger(record.resourceVersion)
    || !positiveInteger(record.version) || !PROPOSAL_STATUSES.includes(record.status) || !nonEmpty(record.proposedBy)
    || !nonEmpty(record.proposedChangeReference) || !nonEmpty(record.policyReference) || !nonEmpty(record.reasonReference)
    || record.scope.tenantId !== record.tenantId) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  validateScope(record.scope);
  record.evidenceReferences.forEach(validateEvidence);
}

function validateDecisionRecord(record: AdministrationDecisionRecord): void {
  if (!nonEmpty(record.decisionId) || !nonEmpty(record.proposalId) || !nonEmpty(record.tenantId) || !nonEmpty(record.resourceId)
    || operationResourceType(record.operation) !== record.resourceType || !positiveInteger(record.version)
    || !DECISION_STATUSES.includes(record.status) || !decisionStatusMatchesOperation(record.status, record.operation)
    || !nonEmpty(record.proposerId) || !nonEmpty(record.decisionActorId) || record.proposerId === record.decisionActorId
    || !nonEmpty(record.reasonReference) || !isoTimestamp(record.decidedAt) || record.scope.tenantId !== record.tenantId) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  validateScope(record.scope);
  record.evidenceReferences.forEach(validateEvidence);
}

function validateIdempotencyRecord(record: AdministrationIdempotencyRecord): void {
  if (!nonEmpty(record.tenantId) || !nonEmpty(record.resourceId) || operationResourceType(record.operation) !== record.resourceType
    || !nonEmpty(record.idempotencyKey) || !nonEmpty(record.fingerprint) || !nonEmpty(record.resultReference)
    || !positiveInteger(record.resultVersion) || !isoTimestamp(record.recordedAt)
    || (record.resultStatus !== undefined && !RESULT_STATUSES.includes(record.resultStatus))) throw persistenceError("PERSISTENCE_INPUT_INVALID");
  record.resultEvidenceReferences?.forEach(validateEvidence);
}

function validateEvidence(reference: AdministrationEvidenceReference): void { if (!["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(reference.type) || !nonEmpty(reference.id) || !positiveInteger(reference.version)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); }
function validateScope(scope: AdministrationPersistenceScope): void { if (!nonEmpty(scope.tenantId) || !SCOPE_TYPES.includes(scope.scopeType) || !nonEmpty(scope.scopeId)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); }

function payloadWithoutEvidence(record: { readonly evidenceReferences: readonly AdministrationEvidenceReference[] }): string { return canonicalJson(Object.fromEntries(Object.entries(record).filter(([key]) => key !== "evidenceReferences"))); }
function canonicalJson(value: unknown): string { return JSON.stringify(sortJson(value)); }
function sortJson(value: unknown): unknown { if (Array.isArray(value)) return value.map(sortJson); if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, sortJson(child)])); }
function assertPayloadFields(payload: Record<string, unknown>, expected: Readonly<Record<string, unknown>>): void { for (const [key, value] of Object.entries(expected)) if (!(key in payload) || canonicalJson(payload[key]) !== canonicalJson(value)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); }

function objectValue(value: SQLOutputValue | undefined): Record<string, unknown> {
  if (typeof value !== "string") throw persistenceError("PERSISTENCE_INPUT_INVALID");
  try { const parsed: unknown = JSON.parse(value); if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); return parsed as Record<string, unknown>; }
  catch (error) { if (error instanceof AdministrationPersistenceError) throw error; throw persistenceError("PERSISTENCE_INPUT_INVALID"); }
}

function rowIdentity(row: Record<string, SQLOutputValue>): AdministrationTransactionIdentity { return { tenantId: stringValue(row["tenant_id"]), resourceType: resourceTypeValue(row["resource_type"]), resourceId: stringValue(row["resource_id"]) }; }
function scopeFromRow(tenantId: string, row: Record<string, SQLOutputValue>): AdministrationPersistenceScope { return { tenantId, scopeType: stringValue(row["scope_type"]) as AdministrationPersistenceScope["scopeType"], scopeId: stringValue(row["scope_id"]) }; }
function resourceTypeValue(value: SQLOutputValue | undefined): AdministrationPersistenceResourceType { const resourceType = stringValue(value); if (!RESOURCE_TYPES.includes(resourceType as AdministrationPersistenceResourceType)) throw persistenceError("PERSISTENCE_INPUT_INVALID"); return resourceType as AdministrationPersistenceResourceType; }
function stringValue(value: SQLOutputValue | undefined): string { if (typeof value !== "string" || value.trim().length === 0) throw persistenceError("PERSISTENCE_INPUT_INVALID"); return value; }
function numberValue(value: SQLOutputValue | undefined): number { if (typeof value === "bigint") return Number(value); if (typeof value !== "number") throw persistenceError("PERSISTENCE_INPUT_INVALID"); return value; }
function evidenceCount(database: DatabaseSync, table: EvidenceTable, where: string, values: readonly string[]): number { const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get(...values); return row === undefined ? 0 : numberValue(row["count"]); }

function setGovernedRecord(state: AdministrationTransactionState, record: GovernedRecord): void { const key = identityKey(governedIdentity(record)); if (record.recordType === "ROLE_ASSIGNMENT") state.roleAssignments.set(key, record); else if (record.recordType === "ROLE") state.roles.set(key, record); else if (record.recordType === "POLICY") state.policies.set(key, record); else if (record.recordType === "TEAM_SCOPE") state.teamScopes.set(key, record); else if (record.recordType === "SOURCE_REGISTRY") state.sources.set(key, record); else state.targets.set(key, record); }
function governedIdentity(record: GovernedRecord): AdministrationTransactionIdentity { return { tenantId: record.tenantId, resourceType: record.recordType, resourceId: recordId(record) }; }
function recordId(record: GovernedRecord): string { if (record.recordType === "ROLE_ASSIGNMENT") return record.roleAssignmentId; if (record.recordType === "ROLE") return record.roleId; if (record.recordType === "POLICY") return record.policyId; if (record.recordType === "TEAM_SCOPE") return record.teamId; if (record.recordType === "SOURCE_REGISTRY") return record.sourceRegistryEntryId; return record.publicationTargetId; }
function governedRecords(state: AdministrationTransactionState): readonly GovernedRecord[] { return [...state.roleAssignments.values(), ...state.roles.values(), ...state.policies.values(), ...state.teamScopes.values(), ...state.sources.values(), ...state.targets.values()]; }
function governedRecordFor(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity): GovernedRecord | undefined { const key = identityKey(identity); if (identity.resourceType === "ROLE_ASSIGNMENT") return state.roleAssignments.get(key); if (identity.resourceType === "ROLE") return state.roles.get(key); if (identity.resourceType === "POLICY") return state.policies.get(key); if (identity.resourceType === "TEAM_SCOPE") return state.teamScopes.get(key); if (identity.resourceType === "SOURCE_REGISTRY") return state.sources.get(key); return state.targets.get(key); }
function proposalKey(tenantId: string, proposalId: string): string { return JSON.stringify([tenantId, proposalId]); }
function decisionKey(tenantId: string, decisionId: string): string { return JSON.stringify([tenantId, decisionId]); }
function idempotencyKey(record: AdministrationIdempotencyRecord): string { return JSON.stringify([record.tenantId, record.resourceType, record.resourceId, record.idempotencyKey]); }
function positiveInteger(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function stringArray(value: unknown): value is readonly string[] { return Array.isArray(value) && value.every(nonEmpty); }
function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean { return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId; }
function isoTimestamp(value: unknown): value is string { if (!nonEmpty(value)) return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function operationResourceType(operation: string): AdministrationPersistenceResourceType | undefined { if (!OPERATIONS.includes(operation as AdministrationPersistenceOperation)) return undefined; if (operation.endsWith("ROLE_ASSIGNMENT")) return "ROLE_ASSIGNMENT"; if (operation.endsWith("ROLE_CHANGE")) return "ROLE"; if (operation.endsWith("POLICY_CHANGE")) return "POLICY"; if (operation.endsWith("TEAM_SCOPE_CHANGE")) return "TEAM_SCOPE"; if (operation.endsWith("SOURCE_GOVERNANCE")) return "SOURCE_REGISTRY"; return "PUBLICATION_TARGET"; }
function decisionStatusMatchesOperation(status: AdministrationDecisionRecord["status"], operation: string): boolean { return operation.startsWith("REJECT_") ? status === "REJECTED" : operation.startsWith("REVOKE_") ? status === "REVOKED" : status === "APPROVED"; }
function isFileDatabasePath(path: string): boolean { const normalized = path.trim().toLowerCase(); return normalized.length > 0 && normalized !== ":memory:" && !(normalized.startsWith("file:") && normalized.includes("mode=memory")); }
function mapStorageError(error: unknown): AdministrationPersistenceError { if (error instanceof AdministrationPersistenceError) return error; const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""; const sqliteCode = typeof error === "object" && error !== null && "errcode" in error ? Number(error.errcode) : undefined; if (sqliteCode === 5 || sqliteCode === 6 || code.includes("SQLITE_BUSY") || code.includes("SQLITE_LOCKED") || code.includes("SQLITE_CONSTRAINT_PRIMARYKEY") || code.includes("SQLITE_CONSTRAINT_UNIQUE")) return persistenceError("VERSION_CONFLICT"); return persistenceError("PERSISTENCE_WRITE_FAILED"); }
function persistenceError(code: ConstructorParameters<typeof AdministrationPersistenceError>[0]): AdministrationPersistenceError { return new AdministrationPersistenceError(code); }

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS administration_schema (singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1), schema_version INTEGER NOT NULL CHECK (schema_version > 0));
CREATE TABLE IF NOT EXISTS administration_revisions (tenant_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision >= 0), PRIMARY KEY (tenant_id, resource_type, resource_id));
CREATE TABLE IF NOT EXISTS administration_resources (tenant_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0), scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, resource_type, resource_id), FOREIGN KEY (tenant_id, resource_type, resource_id) REFERENCES administration_revisions (tenant_id, resource_type, resource_id));
CREATE TABLE IF NOT EXISTS administration_proposals (tenant_id TEXT NOT NULL, proposal_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0), scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, proposal_id), UNIQUE (tenant_id, proposal_id, resource_type, resource_id), FOREIGN KEY (tenant_id, resource_type, resource_id) REFERENCES administration_revisions (tenant_id, resource_type, resource_id));
CREATE TABLE IF NOT EXISTS administration_decisions (tenant_id TEXT NOT NULL, decision_id TEXT NOT NULL, proposal_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, version INTEGER NOT NULL CHECK (version > 0), scope_type TEXT NOT NULL, scope_id TEXT NOT NULL, payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, decision_id), FOREIGN KEY (tenant_id, resource_type, resource_id) REFERENCES administration_revisions (tenant_id, resource_type, resource_id), FOREIGN KEY (tenant_id, proposal_id, resource_type, resource_id) REFERENCES administration_proposals (tenant_id, proposal_id, resource_type, resource_id));
CREATE TABLE IF NOT EXISTS administration_resource_evidence (tenant_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, resource_type, resource_id, sequence), FOREIGN KEY (tenant_id, resource_type, resource_id) REFERENCES administration_resources (tenant_id, resource_type, resource_id));
CREATE TABLE IF NOT EXISTS administration_proposal_evidence (tenant_id TEXT NOT NULL, proposal_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, proposal_id, sequence), FOREIGN KEY (tenant_id, proposal_id) REFERENCES administration_proposals (tenant_id, proposal_id));
CREATE TABLE IF NOT EXISTS administration_decision_evidence (tenant_id TEXT NOT NULL, decision_id TEXT NOT NULL, sequence INTEGER NOT NULL CHECK (sequence > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, decision_id, sequence), FOREIGN KEY (tenant_id, decision_id) REFERENCES administration_decisions (tenant_id, decision_id));
CREATE TABLE IF NOT EXISTS administration_idempotency (tenant_id TEXT NOT NULL, resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, operation TEXT NOT NULL, fingerprint TEXT NOT NULL, result_reference TEXT NOT NULL, result_version INTEGER NOT NULL CHECK (result_version > 0), payload_json TEXT NOT NULL CHECK (json_valid(payload_json)), PRIMARY KEY (tenant_id, resource_type, resource_id, idempotency_key), FOREIGN KEY (tenant_id, resource_type, resource_id) REFERENCES administration_revisions (tenant_id, resource_type, resource_id));
CREATE TRIGGER IF NOT EXISTS administration_decisions_no_update BEFORE UPDATE ON administration_decisions BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_decisions_no_delete BEFORE DELETE ON administration_decisions BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_resource_evidence_no_update BEFORE UPDATE ON administration_resource_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_resource_evidence_no_delete BEFORE DELETE ON administration_resource_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_proposal_evidence_no_update BEFORE UPDATE ON administration_proposal_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_proposal_evidence_no_delete BEFORE DELETE ON administration_proposal_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_decision_evidence_no_update BEFORE UPDATE ON administration_decision_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_decision_evidence_no_delete BEFORE DELETE ON administration_decision_evidence BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_idempotency_no_update BEFORE UPDATE ON administration_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS administration_idempotency_no_delete BEFORE DELETE ON administration_idempotency BEGIN SELECT RAISE(ABORT, 'append-only'); END;
`;
