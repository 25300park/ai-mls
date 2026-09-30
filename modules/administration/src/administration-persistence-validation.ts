import {
  AdministrationPersistenceError,
  type AdministrationDecisionRecord,
  type AdministrationEvidenceReference,
  type AdministrationIdempotencyRecord,
  type AdministrationPersistenceOperation,
  type AdministrationPersistenceResourceType,
  type AdministrationPersistenceScope,
  type AdministrationProposalRecord,
  type AdministrationTransactionIdentity,
} from "./administration-persistence.js";
import { identityKey, type AdministrationTransactionState, type GovernedRecord } from "./administration-persistence-engine.js";

const ROLE_CODES = ["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"] as const;
const SCOPE_TYPES = ["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"] as const;
const PROPOSAL_STATUSES = ["PROPOSED", "APPROVED", "REJECTED", "REVOKED"] as const;
const DECISION_STATUSES = ["APPROVED", "REJECTED", "REVOKED"] as const;
const RESULT_STATUSES = ["PROPOSED", "ACTIVE", "REJECTED", "REVOKED", "PAUSED", "BLOCKED", "RETIRED"] as const;

export function validateHydratedAdministrationState(state: AdministrationTransactionState): void {
  for (const record of governedRecords(state)) validateGoverned(record, governedIdentity(record));
  for (const proposal of state.proposals.values()) validateProposal(proposal);
  for (const decision of state.decisions.values()) validateDecision(decision);
  for (const record of state.idempotency.values()) validateIdempotency(record);
  validateLinkage(state);
}

function validateLinkage(state: AdministrationTransactionState): void {
  for (const proposal of state.proposals.values()) {
    const governed = governedRecordFor(state, proposal);
    const decisions = [...state.decisions.values()].filter((item) => item.tenantId === proposal.tenantId && item.proposalId === proposal.proposalId);
    if (!state.revisions.has(identityKey(proposal)) || governed === undefined || !sameScope(governed.scope, proposal.scope)) fail();
    if (proposal.status === "PROPOSED" ? proposal.version !== 1 || decisions.length !== 0
      : proposal.version !== 2 || decisions.length !== 1 || decisions[0]?.status !== proposal.status
        || decisions[0].version !== proposal.resourceVersion + (proposal.status === "REJECTED" ? 0 : 1)) fail();
  }
  for (const decision of state.decisions.values()) {
    const proposal = state.proposals.get(key(decision.tenantId, decision.proposalId));
    if (proposal?.resourceType !== decision.resourceType || proposal.resourceId !== decision.resourceId
      || proposal.proposedBy !== decision.proposerId || proposal.status !== decision.status
      || !sameScope(proposal.scope, decision.scope) || !state.revisions.has(identityKey(decision))) fail();
  }
  for (const record of state.idempotency.values()) {
    if (!state.revisions.has(identityKey(record)) || operationResourceType(record.operation) !== record.resourceType) fail();
    if (record.operation.startsWith("PROPOSE_")) {
      const proposal = state.proposals.get(key(record.tenantId, record.resultReference));
      if (proposal?.resourceType !== record.resourceType || proposal.resourceId !== record.resourceId || record.resultVersion !== 1) fail();
    } else {
      const decision = state.decisions.get(key(record.tenantId, record.resultReference));
      if (decision?.resourceType !== record.resourceType || decision.resourceId !== record.resourceId
        || decision.operation !== record.operation || decision.version !== record.resultVersion) fail();
    }
  }
  for (const record of governedRecords(state)) {
    if (!state.revisions.has(identityKey(governedIdentity(record)))) fail();
    const history = [...state.decisions.values()].filter((decision) => decision.tenantId === record.tenantId
      && decision.resourceType === record.recordType && decision.resourceId === recordId(record));
    if (history.length > 0 && Math.max(...history.map((decision) => decision.version)) !== record.version) fail();
    if (history.length === 0 && record.recordType !== "ROLE" && record.version !== 1) fail();
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
    if (record.status !== initialStatus) fail();
    return;
  }
  const result = [...state.idempotency.values()].find((candidate) => candidate.tenantId === authoritative.tenantId
    && candidate.resourceType === authoritative.resourceType && candidate.resourceId === authoritative.resourceId
    && candidate.operation === authoritative.operation && candidate.resultReference === authoritative.decisionId);
  if (result?.resultStatus !== record.status || !operationPermitsResultStatus(authoritative.operation, record.status)) fail();
}

function operationPermitsResultStatus(operation: AdministrationPersistenceOperation, status: GovernedRecord["status"]): boolean {
  if (operation.startsWith("APPROVE_")) return status === "ACTIVE";
  if (operation === "REVOKE_ROLE_ASSIGNMENT") return status === "REVOKED";
  if (operation === "TRANSITION_SOURCE_GOVERNANCE") return status === "PAUSED" || status === "BLOCKED" || status === "RETIRED";
  if (operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE") return status === "PAUSED" || status === "RETIRED";
  return false;
}

function validateGoverned(record: GovernedRecord, identity: AdministrationTransactionIdentity): void {
  if (record.recordType !== identity.resourceType || record.tenantId !== identity.tenantId || recordId(record) !== identity.resourceId
    || record.scope.tenantId !== record.tenantId || !positive(record.version)) fail();
  validateScope(record.scope); record.evidenceReferences.forEach(validateEvidence);
  if (record.recordType === "ROLE_ASSIGNMENT" && (!nonEmpty(record.proposalId) || !nonEmpty(record.subjectPrincipalId)
    || !["HUMAN", "SERVICE"].includes(record.subjectPrincipalType) || !nonEmpty(record.roleId) || !stringArray(record.teamIds)
    || !stringArray(record.resourceTypes) || !stringArray(record.purposes) || !["PROPOSED", "ACTIVE", "REVOKED"].includes(record.status)
    || !iso(record.effectiveFrom) || !iso(record.effectiveUntil) || Date.parse(record.effectiveFrom) >= Date.parse(record.effectiveUntil)
    || !nonEmpty(record.proposedBy) || !nonEmpty(record.reasonReference))) fail();
  if (record.recordType === "ROLE" && (!nonEmpty(record.roleId) || !ROLE_CODES.includes(record.roleCode)
    || !["ACTIVE", "RETIRED"].includes(record.status) || !nonEmpty(record.policyReference))) fail();
  if (record.recordType === "POLICY" && (!nonEmpty(record.policyId) || !["PROPOSED", "ACTIVE", "REJECTED", "REVOKED"].includes(record.status) || !nonEmpty(record.policyReference))) fail();
  if (record.recordType === "TEAM_SCOPE" && (!nonEmpty(record.teamId) || !["PROPOSED", "ACTIVE", "REVOKED"].includes(record.status) || !nonEmpty(record.organizationId))) fail();
  if (record.recordType === "SOURCE_REGISTRY" && (!nonEmpty(record.sourceRegistryEntryId) || !["DRAFT", "UNDER_REVIEW", "ACTIVE", "PAUSED", "BLOCKED", "RETIRED"].includes(record.status)
    || !nonEmpty(record.policyReference) || !nonEmpty(record.name) || !nonEmpty(record.sourceType) || !stringArray(record.allowedMethods)
    || !stringArray(record.allowedPurposes) || !["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"].includes(record.classification))) fail();
  if (record.recordType === "PUBLICATION_TARGET" && (!nonEmpty(record.publicationTargetId) || !["PROPOSED", "ACTIVE", "PAUSED", "RETIRED"].includes(record.status)
    || !nonEmpty(record.policyReference) || !nonEmpty(record.channelReference) || !nonEmpty(record.name) || !nonEmpty(record.targetType) || !stringArray(record.allowedFieldReferences))) fail();
}

function validateProposal(record: AdministrationProposalRecord): void {
  if (![record.proposalId, record.tenantId, record.resourceId, record.proposedBy, record.proposedChangeReference, record.policyReference, record.reasonReference].every(nonEmpty)
    || !positive(record.resourceVersion) || !positive(record.version) || !PROPOSAL_STATUSES.includes(record.status) || record.scope.tenantId !== record.tenantId) fail();
  validateScope(record.scope); record.evidenceReferences.forEach(validateEvidence);
}
function validateDecision(record: AdministrationDecisionRecord): void {
  if (![record.decisionId, record.proposalId, record.tenantId, record.resourceId, record.proposerId, record.decisionActorId, record.reasonReference].every(nonEmpty)
    || operationResourceType(record.operation) !== record.resourceType || !positive(record.version) || !DECISION_STATUSES.includes(record.status)
    || !decisionMatches(record.status, record.operation) || record.proposerId === record.decisionActorId || !iso(record.decidedAt) || record.scope.tenantId !== record.tenantId) fail();
  validateScope(record.scope); record.evidenceReferences.forEach(validateEvidence);
}
function validateIdempotency(record: AdministrationIdempotencyRecord): void {
  if (![record.tenantId, record.resourceId, record.idempotencyKey, record.fingerprint, record.resultReference].every(nonEmpty)
    || operationResourceType(record.operation) !== record.resourceType || !positive(record.resultVersion) || !iso(record.recordedAt)
    || (record.resultStatus !== undefined && !RESULT_STATUSES.includes(record.resultStatus))) fail();
  record.resultEvidenceReferences?.forEach(validateEvidence);
}
function validateEvidence(value: AdministrationEvidenceReference): void { if (!["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(value.type) || !nonEmpty(value.id) || !positive(value.version)) fail(); }
function validateScope(value: AdministrationPersistenceScope): void { if (!nonEmpty(value.tenantId) || !SCOPE_TYPES.includes(value.scopeType) || !nonEmpty(value.scopeId)) fail(); }
function governedRecords(state: AdministrationTransactionState): readonly GovernedRecord[] { return [...state.roleAssignments.values(), ...state.roles.values(), ...state.policies.values(), ...state.teamScopes.values(), ...state.sources.values(), ...state.targets.values()]; }
function governedIdentity(record: GovernedRecord): AdministrationTransactionIdentity { return { tenantId: record.tenantId, resourceType: record.recordType, resourceId: recordId(record) }; }
function governedRecordFor(state: AdministrationTransactionState, identity: AdministrationTransactionIdentity): GovernedRecord | undefined { const id = identityKey(identity); if (identity.resourceType === "ROLE_ASSIGNMENT") return state.roleAssignments.get(id); if (identity.resourceType === "ROLE") return state.roles.get(id); if (identity.resourceType === "POLICY") return state.policies.get(id); if (identity.resourceType === "TEAM_SCOPE") return state.teamScopes.get(id); if (identity.resourceType === "SOURCE_REGISTRY") return state.sources.get(id); return state.targets.get(id); }
function recordId(record: GovernedRecord): string { if (record.recordType === "ROLE_ASSIGNMENT") return record.roleAssignmentId; if (record.recordType === "ROLE") return record.roleId; if (record.recordType === "POLICY") return record.policyId; if (record.recordType === "TEAM_SCOPE") return record.teamId; if (record.recordType === "SOURCE_REGISTRY") return record.sourceRegistryEntryId; return record.publicationTargetId; }
function operationResourceType(operation: string): AdministrationPersistenceResourceType | undefined { if (operation.endsWith("ROLE_ASSIGNMENT")) return "ROLE_ASSIGNMENT"; if (operation.endsWith("ROLE_CHANGE")) return "ROLE"; if (operation.endsWith("POLICY_CHANGE")) return "POLICY"; if (operation.endsWith("TEAM_SCOPE_CHANGE")) return "TEAM_SCOPE"; if (operation.endsWith("SOURCE_GOVERNANCE")) return "SOURCE_REGISTRY"; if (operation.endsWith("PUBLICATION_TARGET_GOVERNANCE")) return "PUBLICATION_TARGET"; return undefined; }
function decisionMatches(status: AdministrationDecisionRecord["status"], operation: string): boolean { return operation.startsWith("REJECT_") ? status === "REJECTED" : operation.startsWith("REVOKE_") ? status === "REVOKED" : status === "APPROVED"; }
function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean { return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId; }
function key(left: string, right: string): string { return JSON.stringify([left, right]); }
function positive(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function stringArray(value: unknown): value is readonly string[] { return Array.isArray(value) && value.every(nonEmpty); }
function iso(value: unknown): value is string { if (!nonEmpty(value)) return false; const parsed = Date.parse(value); return Number.isFinite(parsed) && new Date(parsed).toISOString() === value; }
function fail(): never { throw new AdministrationPersistenceError("PERSISTENCE_INPUT_INVALID"); }
