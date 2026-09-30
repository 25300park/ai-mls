import type { PostgreSqlClientPort, PostgreSqlPoolPort, PostgreSqlQueryResult } from "../../identity/src/postgresql-pool.js";
import {
  AdministrationPersistenceError,
  type AdministrationDecisionRecord,
  type AdministrationEvidenceReference,
  type AdministrationIdempotencyRecord,
  type AdministrationPersistenceErrorCode,
  type AdministrationTransactionIdentity,
  type AdministrationProposalRecord,
  type RoleAssignmentPersistenceRecord,
  type RolePersistenceRecord,
  type PolicyPersistenceRecord,
  type TeamScopePersistenceRecord,
  type SourceGovernancePersistenceRecord,
  type PublicationTargetGovernancePersistenceRecord,
} from "./administration-persistence.js";
import type {
  AsyncAdministrationDecisionReadRepository,
  AsyncAdministrationIdempotencyReadRepository,
  AsyncAdministrationProposalReadRepository,
  AsyncAdministrationTransaction,
  AsyncAdministrationUnitOfWork,
  AsyncPolicyReadRepository,
  AsyncPublicationTargetReadRepository,
  AsyncRoleAssignmentReadRepository,
  AsyncRoleReadRepository,
  AsyncSourceGovernanceReadRepository,
  AsyncTeamScopeReadRepository,
} from "./administration-async-persistence.js";
import {
  AdministrationTransactionState,
  createAdministrationReadRepositories,
  createAsyncAdministrationTransaction,
  identityKey,
  type AdministrationTransactionTrackerSnapshot,
  type GovernedRecord,
} from "./administration-persistence-engine.js";
import { validateHydratedAdministrationState } from "./administration-persistence-validation.js";

const NO_FAILURES = Object.freeze({ check: (): void => undefined });
type Row = Record<string, unknown>;

/** PostgreSQL API-015 persistence. The pool is owned by ProductionBootstrap. */
export class PostgreSqlAdministrationUnitOfWork implements AsyncAdministrationUnitOfWork {
  readonly #pool: PostgreSqlPoolPort;
  #activeTransactions = 0;
  #closed = false;
  #quarantined = false;

  public readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  public readonly roles: AsyncRoleReadRepository;
  public readonly policies: AsyncPolicyReadRepository;
  public readonly teamScopes: AsyncTeamScopeReadRepository;
  public readonly sourceGovernance: AsyncSourceGovernanceReadRepository;
  public readonly publicationTargets: AsyncPublicationTargetReadRepository;
  public readonly proposals: AsyncAdministrationProposalReadRepository;
  public readonly decisions: AsyncAdministrationDecisionReadRepository;
  public readonly idempotency: AsyncAdministrationIdempotencyReadRepository;

  public constructor(pool: PostgreSqlPoolPort) {
    this.#pool = pool;
    this.roleAssignments = {
      find: (identity): Promise<RoleAssignmentPersistenceRecord | undefined> => this.#read((repositories): RoleAssignmentPersistenceRecord | undefined => repositories.roleAssignments.find(identity)),
      listByScope: (scope): Promise<readonly RoleAssignmentPersistenceRecord[]> => this.#read((repositories): readonly RoleAssignmentPersistenceRecord[] => repositories.roleAssignments.listByScope(scope)),
      listBySubject: (tenantId, subjectPrincipalId): Promise<readonly RoleAssignmentPersistenceRecord[]> => this.#read((repositories): readonly RoleAssignmentPersistenceRecord[] => repositories.roleAssignments.listBySubject(tenantId, subjectPrincipalId)),
    };
    this.roles = { find: (identity): Promise<RolePersistenceRecord | undefined> => this.#read((repositories): RolePersistenceRecord | undefined => repositories.roles.find(identity)), listByScope: (scope): Promise<readonly RolePersistenceRecord[]> => this.#read((repositories): readonly RolePersistenceRecord[] => repositories.roles.listByScope(scope)) };
    this.policies = { find: (identity): Promise<PolicyPersistenceRecord | undefined> => this.#read((repositories): PolicyPersistenceRecord | undefined => repositories.policies.find(identity)), listByScope: (scope): Promise<readonly PolicyPersistenceRecord[]> => this.#read((repositories): readonly PolicyPersistenceRecord[] => repositories.policies.listByScope(scope)) };
    this.teamScopes = { find: (identity): Promise<TeamScopePersistenceRecord | undefined> => this.#read((repositories): TeamScopePersistenceRecord | undefined => repositories.teamScopes.find(identity)), listByScope: (scope): Promise<readonly TeamScopePersistenceRecord[]> => this.#read((repositories): readonly TeamScopePersistenceRecord[] => repositories.teamScopes.listByScope(scope)) };
    this.sourceGovernance = { find: (identity): Promise<SourceGovernancePersistenceRecord | undefined> => this.#read((repositories): SourceGovernancePersistenceRecord | undefined => repositories.sourceGovernance.find(identity)), listByScope: (scope): Promise<readonly SourceGovernancePersistenceRecord[]> => this.#read((repositories): readonly SourceGovernancePersistenceRecord[] => repositories.sourceGovernance.listByScope(scope)) };
    this.publicationTargets = { find: (identity): Promise<PublicationTargetGovernancePersistenceRecord | undefined> => this.#read((repositories): PublicationTargetGovernancePersistenceRecord | undefined => repositories.publicationTargets.find(identity)), listByScope: (scope): Promise<readonly PublicationTargetGovernancePersistenceRecord[]> => this.#read((repositories): readonly PublicationTargetGovernancePersistenceRecord[] => repositories.publicationTargets.listByScope(scope)) };
    this.proposals = {
      findById: (tenantId, proposalId): Promise<AdministrationProposalRecord | undefined> => this.#read((repositories): AdministrationProposalRecord | undefined => repositories.proposals.findById(tenantId, proposalId)),
      listPending: (scope): Promise<readonly AdministrationProposalRecord[]> => this.#read((repositories): readonly AdministrationProposalRecord[] => repositories.proposals.listPending(scope)),
      listByScope: (scope): Promise<readonly AdministrationProposalRecord[]> => this.#read((repositories): readonly AdministrationProposalRecord[] => repositories.proposals.listByScope(scope)),
    };
    this.decisions = {
      findById: (tenantId, decisionId): Promise<AdministrationDecisionRecord | undefined> => this.#read((repositories): AdministrationDecisionRecord | undefined => repositories.decisions.findById(tenantId, decisionId)),
      list: (identity): Promise<readonly AdministrationDecisionRecord[]> => this.#read((repositories): readonly AdministrationDecisionRecord[] => repositories.decisions.list(identity)),
      listByScope: (scope): Promise<readonly AdministrationDecisionRecord[]> => this.#read((repositories): readonly AdministrationDecisionRecord[] => repositories.decisions.listByScope(scope)),
    };
    this.idempotency = { find: (identity): Promise<AdministrationIdempotencyRecord | undefined> => this.#read((repositories): AdministrationIdempotencyRecord | undefined => repositories.idempotency.find(identity)) };
  }

  public async begin(identity: AdministrationTransactionIdentity): Promise<AsyncAdministrationTransaction> {
    this.#assertOpen();
    this.#activeTransactions += 1;
    let client: PostgreSqlClientPort | undefined;
    let transactionOpen = false;
    let discard = false;
    try {
      client = await this.#pool.connect();
      await query(client, "BEGIN");
      transactionOpen = true;
      const state = await loadState(client, true, identity);
      const revision = state.revision(identity);
      return createAsyncAdministrationTransaction({
        identity,
        initialState: state,
        initialRevision: revision,
        failures: NO_FAILURES,
        commit: async ({ tracker }) => {
          let commitStarted = false;
          try {
            await ensureRevision(client!, identity, revision);
            await persistTrackedChanges(client!, tracker);
            await compareAndSwapRevision(client!, identity, revision);
            commitStarted = true;
            await query(client!, "COMMIT");
            transactionOpen = false;
          } catch (error) {
            discard = true;
            if (commitStarted) this.#quarantined = true;
            else if (transactionOpen) {
              try { await query(client!, "ROLLBACK"); transactionOpen = false; } catch { /* discard uncertain client */ }
            }
            throw mapError(error);
          } finally {
            client!.release(discard);
          }
        },
        rollback: async () => {
          try { if (transactionOpen) await query(client!, "ROLLBACK"); transactionOpen = false; }
          catch (error) { discard = true; throw mapError(error); }
          finally { client!.release(discard); }
        },
        release: () => { this.#activeTransactions -= 1; },
      });
    } catch (error) {
      this.#activeTransactions -= 1;
      if (transactionOpen && client !== undefined) try { await query(client, "ROLLBACK"); } catch { discard = true; }
      client?.release(discard);
      throw mapError(error);
    }
  }

  public close(): Promise<void> {
    if (this.#activeTransactions > 0) throw failure("TRANSACTION_ALREADY_ACTIVE");
    this.#closed = true;
    return Promise.resolve();
  }

  async #read<Result>(operation: (repositories: ReturnType<typeof createAdministrationReadRepositories>) => Result): Promise<Result> {
    this.#assertOpen();
    const client = await this.#pool.connect();
    let discard = false;
    try { return operation(createAdministrationReadRepositories(await loadState(client, false))); }
    catch (error) { discard = true; throw mapError(error); }
    finally { client.release(discard); }
  }

  #assertOpen(): void {
    if (this.#closed || this.#quarantined) throw failure("PERSISTENCE_WRITE_FAILED");
  }
}

async function loadState(client: PostgreSqlClientPort, lock: boolean, identity?: AdministrationTransactionIdentity): Promise<AdministrationTransactionState> {
  const state = new AdministrationTransactionState();
  const suffix = lock && identity !== undefined ? " WHERE tenant_id=$1 AND resource_type=$2 AND resource_id=$3 FOR UPDATE" : "";
  const values = identity === undefined ? undefined : [identity.tenantId, identity.resourceType, identity.resourceId];
  const revisions = await query<Row>(client, `SELECT tenant_id,resource_type,resource_id,revision FROM app_administration.administration_revisions${suffix}`, suffix === "" ? undefined : values);
  for (const row of revisions.rows) state.revisions.set(identityKey(rowIdentity(row)), integer(row["revision"], true));
  for (const row of (await query<Row>(client, "SELECT tenant_id,resource_type,resource_id,version,scope_type,scope_id,payload_json FROM app_administration.administration_resources")).rows) {
    const recordIdentity = rowIdentity(row);
    const payload = json<Record<string, unknown>>(row["payload_json"]);
    const scope = rowScope(recordIdentity.tenantId, row);
    const version = integer(row["version"]);
    assertPayloadFields(payload, { tenantId: recordIdentity.tenantId, recordType: recordIdentity.resourceType, version, scope });
    const evidenceReferences = await readEvidence(client, "administration_resource_evidence", [recordIdentity.tenantId, recordIdentity.resourceType, recordIdentity.resourceId]);
    const record = { ...payload, tenantId: recordIdentity.tenantId, recordType: recordIdentity.resourceType, version, scope, evidenceReferences } as GovernedRecord;
    setGoverned(state, record);
  }
  for (const row of (await query<Row>(client, "SELECT tenant_id,proposal_id,resource_type,resource_id,version,scope_type,scope_id,payload_json FROM app_administration.administration_proposals")).rows) {
    const tenantId = text(row["tenant_id"]); const proposalId = text(row["proposal_id"]);
    const resourceType = resourceTypeValue(row["resource_type"]); const resourceId = text(row["resource_id"]);
    const version = integer(row["version"]); const scope = rowScope(tenantId, row);
    const payload = json<Record<string, unknown>>(row["payload_json"]);
    assertPayloadFields(payload, { tenantId, proposalId, resourceType, resourceId, version, scope });
    const evidenceReferences = await readEvidence(client, "administration_proposal_evidence", [tenantId, proposalId]);
    const record = { ...payload, tenantId, proposalId, resourceType, resourceId, version, scope, evidenceReferences } as AdministrationProposalRecord;
    state.proposals.set(JSON.stringify([record.tenantId, record.proposalId]), record);
  }
  for (const row of (await query<Row>(client, "SELECT tenant_id,decision_id,proposal_id,resource_type,resource_id,version,scope_type,scope_id,payload_json FROM app_administration.administration_decisions")).rows) {
    const tenantId = text(row["tenant_id"]); const decisionId = text(row["decision_id"]); const proposalId = text(row["proposal_id"]);
    const resourceType = resourceTypeValue(row["resource_type"]); const resourceId = text(row["resource_id"]);
    const version = integer(row["version"]); const scope = rowScope(tenantId, row);
    const payload = json<Record<string, unknown>>(row["payload_json"]);
    assertPayloadFields(payload, { tenantId, decisionId, proposalId, resourceType, resourceId, version, scope });
    const evidenceReferences = await readEvidence(client, "administration_decision_evidence", [tenantId, decisionId]);
    const record = { ...payload, tenantId, decisionId, proposalId, resourceType, resourceId, version, scope, evidenceReferences } as AdministrationDecisionRecord;
    state.decisions.set(JSON.stringify([record.tenantId, record.decisionId]), record);
  }
  for (const row of (await query<Row>(client, "SELECT tenant_id,resource_type,resource_id,idempotency_key,operation,fingerprint,result_reference,result_version,payload_json FROM app_administration.administration_idempotency")).rows) {
    const payload = json<Record<string, unknown>>(row["payload_json"]);
    const expected = { tenantId: text(row["tenant_id"]), resourceType: resourceTypeValue(row["resource_type"]), resourceId: text(row["resource_id"]), idempotencyKey: text(row["idempotency_key"]), operation: text(row["operation"]), fingerprint: text(row["fingerprint"]), resultReference: text(row["result_reference"]), resultVersion: integer(row["result_version"]) };
    assertPayloadFields(payload, expected);
    const record = { ...payload, ...expected } as AdministrationIdempotencyRecord;
    state.idempotency.set(JSON.stringify([record.tenantId, record.resourceType, record.resourceId, record.idempotencyKey]), record);
  }
  validateHydratedAdministrationState(state);
  return state;
}

async function persistTrackedChanges(client: PostgreSqlClientPort, tracker: AdministrationTransactionTrackerSnapshot): Promise<void> {
  if (tracker.governedSave !== undefined) await insertGoverned(client, tracker.governedSave);
  if (tracker.authoritativeUpdate !== undefined) await updateGoverned(client, tracker.authoritativeUpdate.initialVersion, tracker.authoritativeUpdate.record);
  if (tracker.proposalSave !== undefined) await insertProposal(client, tracker.proposalSave);
  if (tracker.proposalUpdate !== undefined) await updateProposal(client, tracker.proposalUpdate.version - 1, tracker.proposalUpdate);
  if (tracker.decision !== undefined) await insertDecision(client, tracker.decision);
  if (tracker.idempotency !== undefined) await query(client, "INSERT INTO app_administration.administration_idempotency(tenant_id,resource_type,resource_id,idempotency_key,operation,fingerprint,result_reference,result_version,payload_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)", [tracker.idempotency.tenantId, tracker.idempotency.resourceType, tracker.idempotency.resourceId, tracker.idempotency.idempotencyKey, tracker.idempotency.operation, tracker.idempotency.fingerprint, tracker.idempotency.resultReference, tracker.idempotency.resultVersion, JSON.stringify(tracker.idempotency)]);
}

async function ensureRevision(client: PostgreSqlClientPort, identity: AdministrationTransactionIdentity, revision: number): Promise<void> {
  if (revision === 0) {
    const inserted = await query(client, "INSERT INTO app_administration.administration_revisions(tenant_id,resource_type,resource_id,revision) VALUES($1,$2,$3,0) ON CONFLICT DO NOTHING", [identity.tenantId, identity.resourceType, identity.resourceId]);
    if (inserted.rowCount !== 1) throw failure("VERSION_CONFLICT");
  }
}

async function compareAndSwapRevision(client: PostgreSqlClientPort, identity: AdministrationTransactionIdentity, revision: number): Promise<void> {
  const result = await query(client, "UPDATE app_administration.administration_revisions SET revision=revision+1 WHERE tenant_id=$1 AND resource_type=$2 AND resource_id=$3 AND revision=$4", [identity.tenantId, identity.resourceType, identity.resourceId, revision]);
  if (result.rowCount !== 1) throw failure("VERSION_CONFLICT");
}

async function insertGoverned(client: PostgreSqlClientPort, record: GovernedRecord): Promise<void> {
  const identity = governedIdentity(record);
  await query(client, "INSERT INTO app_administration.administration_resources(tenant_id,resource_type,resource_id,version,scope_type,scope_id,payload_json) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)", [identity.tenantId, identity.resourceType, identity.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, JSON.stringify(record)]);
  await insertEvidence(client, "administration_resource_evidence", [identity.tenantId, identity.resourceType, identity.resourceId], record.evidenceReferences);
}
async function updateGoverned(client: PostgreSqlClientPort, expected: number, record: GovernedRecord): Promise<void> {
  const identity = governedIdentity(record);
  const result = await query(client, "UPDATE app_administration.administration_resources SET version=$1,scope_type=$2,scope_id=$3,payload_json=$4::jsonb WHERE tenant_id=$5 AND resource_type=$6 AND resource_id=$7 AND version=$8", [record.version, record.scope.scopeType, record.scope.scopeId, JSON.stringify(record), identity.tenantId, identity.resourceType, identity.resourceId, expected]);
  if (result.rowCount !== 1) throw failure("VERSION_CONFLICT");
  await appendNewEvidence(client, "administration_resource_evidence", [identity.tenantId, identity.resourceType, identity.resourceId], record.evidenceReferences);
}
async function insertProposal(client: PostgreSqlClientPort, record: AdministrationProposalRecord): Promise<void> {
  await query(client, "INSERT INTO app_administration.administration_proposals(tenant_id,proposal_id,resource_type,resource_id,version,scope_type,scope_id,payload_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)", [record.tenantId, record.proposalId, record.resourceType, record.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, JSON.stringify(record)]);
  await insertEvidence(client, "administration_proposal_evidence", [record.tenantId, record.proposalId], record.evidenceReferences);
}
async function updateProposal(client: PostgreSqlClientPort, expected: number, record: AdministrationProposalRecord): Promise<void> {
  const result = await query(client, "UPDATE app_administration.administration_proposals SET version=$1,scope_type=$2,scope_id=$3,payload_json=$4::jsonb WHERE tenant_id=$5 AND proposal_id=$6 AND version=$7", [record.version, record.scope.scopeType, record.scope.scopeId, JSON.stringify(record), record.tenantId, record.proposalId, expected]);
  if (result.rowCount !== 1) throw failure("VERSION_CONFLICT");
  await appendNewEvidence(client, "administration_proposal_evidence", [record.tenantId, record.proposalId], record.evidenceReferences);
}
async function insertDecision(client: PostgreSqlClientPort, record: AdministrationDecisionRecord): Promise<void> {
  await query(client, "INSERT INTO app_administration.administration_decisions(tenant_id,decision_id,proposal_id,resource_type,resource_id,version,scope_type,scope_id,payload_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)", [record.tenantId, record.decisionId, record.proposalId, record.resourceType, record.resourceId, record.version, record.scope.scopeType, record.scope.scopeId, JSON.stringify(record)]);
  await insertEvidence(client, "administration_decision_evidence", [record.tenantId, record.decisionId], record.evidenceReferences);
}

type EvidenceTable = "administration_resource_evidence" | "administration_proposal_evidence" | "administration_decision_evidence";
async function insertEvidence(client: PostgreSqlClientPort, table: EvidenceTable, parent: readonly string[], evidence: readonly AdministrationEvidenceReference[]): Promise<void> {
  for (const [index, item] of evidence.entries()) await insertEvidenceRow(client, table, parent, index + 1, item);
}
async function appendNewEvidence(client: PostgreSqlClientPort, table: EvidenceTable, parent: readonly string[], evidence: readonly AdministrationEvidenceReference[]): Promise<void> {
  const where = table === "administration_resource_evidence" ? "tenant_id=$1 AND resource_type=$2 AND resource_id=$3" : table === "administration_proposal_evidence" ? "tenant_id=$1 AND proposal_id=$2" : "tenant_id=$1 AND decision_id=$2";
  const result = await query<Row>(client, `SELECT COUNT(*) AS count FROM app_administration.${table} WHERE ${where}`, parent);
  const count = integer(result.rows[0]?.["count"], true);
  for (let index = count; index < evidence.length; index += 1) await insertEvidenceRow(client, table, parent, index + 1, evidence[index]!);
}
async function insertEvidenceRow(client: PostgreSqlClientPort, table: EvidenceTable, parent: readonly string[], sequence: number, evidence: AdministrationEvidenceReference): Promise<void> {
  const columns = table === "administration_resource_evidence" ? "tenant_id,resource_type,resource_id,sequence,payload_json" : table === "administration_proposal_evidence" ? "tenant_id,proposal_id,sequence,payload_json" : "tenant_id,decision_id,sequence,payload_json";
  const slots = parent.map((_, index) => `$${index + 1}`).join(",");
  await query(client, `INSERT INTO app_administration.${table}(${columns}) VALUES(${slots},$${parent.length + 1},$${parent.length + 2}::jsonb)`, [...parent, sequence, JSON.stringify(evidence)]);
}

async function readEvidence(client: PostgreSqlClientPort, table: EvidenceTable, parent: readonly string[]): Promise<readonly AdministrationEvidenceReference[]> {
  const where = table === "administration_resource_evidence" ? "tenant_id=$1 AND resource_type=$2 AND resource_id=$3" : table === "administration_proposal_evidence" ? "tenant_id=$1 AND proposal_id=$2" : "tenant_id=$1 AND decision_id=$2";
  const rows = (await query<Row>(client, `SELECT sequence,payload_json FROM app_administration.${table} WHERE ${where} ORDER BY sequence`, parent)).rows;
  return Object.freeze(rows.map((row, index) => {
    if (integer(row["sequence"]) !== index + 1) throw failure("PERSISTENCE_INPUT_INVALID");
    const evidence = json<AdministrationEvidenceReference>(row["payload_json"]);
    if (!(["DECISION", "APPROVAL", "AUDIT", "CASE"] as readonly unknown[]).includes(evidence.type)
      || text(evidence.id) !== evidence.id || integer(evidence.version) !== evidence.version) throw failure("PERSISTENCE_INPUT_INVALID");
    return evidence;
  }));
}

function rowScope(tenantId: string, row: Row): GovernedRecord["scope"] {
  const scopeType = text(row["scope_type"]);
  if (!["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"].includes(scopeType)) throw failure("PERSISTENCE_INPUT_INVALID");
  return { tenantId, scopeType: scopeType as GovernedRecord["scope"]["scopeType"], scopeId: text(row["scope_id"]) };
}

function assertPayloadFields(payload: Readonly<Record<string, unknown>>, expected: Readonly<Record<string, unknown>>): void {
  for (const [key, value] of Object.entries(expected)) if (!(key in payload) || stableJson(payload[key]) !== stableJson(value)) throw failure("PERSISTENCE_INPUT_INVALID");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, sortJson(child)]));
}

function setGoverned(state: AdministrationTransactionState, record: GovernedRecord): void {
  const key = identityKey(governedIdentity(record));
  if (record.recordType === "ROLE_ASSIGNMENT") state.roleAssignments.set(key, record);
  else if (record.recordType === "ROLE") state.roles.set(key, record);
  else if (record.recordType === "POLICY") state.policies.set(key, record);
  else if (record.recordType === "TEAM_SCOPE") state.teamScopes.set(key, record);
  else if (record.recordType === "SOURCE_REGISTRY") state.sources.set(key, record);
  else state.targets.set(key, record);
}
function governedIdentity(record: GovernedRecord): AdministrationTransactionIdentity {
  const resourceId = record.recordType === "ROLE_ASSIGNMENT" ? record.roleAssignmentId : record.recordType === "ROLE" ? record.roleId : record.recordType === "POLICY" ? record.policyId : record.recordType === "TEAM_SCOPE" ? record.teamId : record.recordType === "SOURCE_REGISTRY" ? record.sourceRegistryEntryId : record.publicationTargetId;
  return { tenantId: record.tenantId, resourceType: record.recordType, resourceId };
}
function resourceTypeValue(value: unknown): AdministrationTransactionIdentity["resourceType"] {
  const candidate = text(value);
  if (!["ROLE_ASSIGNMENT", "ROLE", "POLICY", "TEAM_SCOPE", "SOURCE_REGISTRY", "PUBLICATION_TARGET"].includes(candidate)) throw failure("PERSISTENCE_INPUT_INVALID");
  return candidate as AdministrationTransactionIdentity["resourceType"];
}
function rowIdentity(row: Row): AdministrationTransactionIdentity { return { tenantId: text(row["tenant_id"]), resourceType: resourceTypeValue(row["resource_type"]), resourceId: text(row["resource_id"]) }; }
function json<T>(value: unknown): T { if (typeof value === "object" && value !== null) return value as T; if (typeof value !== "string") throw failure("PERSISTENCE_INPUT_INVALID"); try { return JSON.parse(value) as T; } catch { throw failure("PERSISTENCE_INPUT_INVALID"); } }
function text(value: unknown): string { if (typeof value !== "string" || value.length === 0) throw failure("PERSISTENCE_INPUT_INVALID"); return value; }
function integer(value: unknown, allowZero = false): number { const number = Number(value); if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) throw failure("PERSISTENCE_INPUT_INVALID"); return number; }

async function query<R extends Row = Row>(client: PostgreSqlClientPort, sql: string, values?: readonly unknown[]): Promise<PostgreSqlQueryResult<R>> {
  try { return await client.query<R>(sql, values); }
  catch (error) {
    if (error instanceof AdministrationPersistenceError) throw error;
    const code = typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
    if (code === "40001" || code === "40P01" || code === "23505") throw failure("VERSION_CONFLICT");
    throw failure("PERSISTENCE_WRITE_FAILED");
  }
}
function mapError(error: unknown): AdministrationPersistenceError { return error instanceof AdministrationPersistenceError ? error : failure("PERSISTENCE_WRITE_FAILED"); }
function failure(code: AdministrationPersistenceErrorCode): AdministrationPersistenceError { return new AdministrationPersistenceError(code); }
