import type { AuditSink, Clock } from "../../../packages/security-contracts/src/index.js";
import {
  AuthorizationService,
  isCanonicalRoleCode,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type WorkloadAuthorizationRequest,
  type LiveAssignmentResolutionContext,
  type LiveAssignmentResolver,
  type LiveRoleAssignment,
} from "../../authorization/src/authorization-service.js";
import type {
  RoleAssignmentPersistenceRecord,
  RoleAssignmentReadRepository,
  RoleReadRepository,
  RolePersistenceRecord,
  AdministrationProposalReadRepository,
  AdministrationDecisionReadRepository,
  AdministrationEvidenceReference,
} from "./administration-persistence.js";
import type {
  AsyncAdministrationDecisionReadRepository,
  AsyncAdministrationProposalReadRepository,
  AsyncRoleAssignmentReadRepository,
  AsyncRoleReadRepository,
} from "./administration-async-persistence.js";

interface LiveAuthorityReadDependencies {
  readonly roleAssignments: RoleAssignmentReadRepository;
  readonly roles: RoleReadRepository;
  readonly proposals: AdministrationProposalReadRepository;
  readonly decisions: AdministrationDecisionReadRepository;
}

export class AdministrationLiveAssignmentAdapter implements LiveAssignmentResolver {
  public constructor(private readonly dependencies: LiveAuthorityReadDependencies) {}

  public resolveCurrentAssignments(context: LiveAssignmentResolutionContext): readonly LiveRoleAssignment[] {
    const records = this.dependencies.roleAssignments.listBySubject(context.tenantId, context.subjectPrincipalId);
    return Object.freeze(records
      .map((record) => mapCurrentAssignment(record, context, this.dependencies))
      .filter((record): record is LiveRoleAssignment => record !== undefined));
  }
}

interface LiveAuthorizationCompositionDependencies {
  readonly roleAssignments: RoleAssignmentReadRepository;
  readonly roles: RoleReadRepository;
  readonly proposals: AdministrationProposalReadRepository;
  readonly decisions: AdministrationDecisionReadRepository;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly policyVersion: string;
}

const liveAdministrationAuthorityBrand: unique symbol = Symbol("LIVE_ADMINISTRATION_AUTHORITY");

export interface LiveAdministrationAuthorizationService {
  readonly [liveAdministrationAuthorityBrand]: true;
  evaluate(request: AuthorizationRequest): AuthorizationDecision;
  evaluateWorkload(request: WorkloadAuthorizationRequest): AuthorizationDecision;
}

export function createAdministrationBackedAuthorizationService(
  dependencies: LiveAuthorizationCompositionDependencies,
): LiveAdministrationAuthorizationService {
  const service = new AuthorizationService({
    liveAssignmentResolver: new AdministrationLiveAssignmentAdapter(dependencies),
    auditSink: dependencies.auditSink,
    clock: dependencies.clock,
    policyVersion: dependencies.policyVersion,
  });
  return Object.freeze({
    [liveAdministrationAuthorityBrand]: true as const,
    evaluate: (request: AuthorizationRequest) => service.evaluate(request),
    evaluateWorkload: (request: WorkloadAuthorizationRequest) => service.evaluateWorkload(request),
  });
}

interface AsyncLiveAuthorizationCompositionDependencies {
  readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  readonly roles: AsyncRoleReadRepository;
  readonly proposals: AsyncAdministrationProposalReadRepository;
  readonly decisions: AsyncAdministrationDecisionReadRepository;
  readonly auditSink: AuditSink;
  readonly clock: Clock;
  readonly policyVersion: string;
}

export interface AsyncLiveAdministrationAuthorizationService {
  evaluateWorkload(request: WorkloadAuthorizationRequest): Promise<AuthorizationDecision>;
  evaluate(request: AuthorizationRequest): Promise<AuthorizationDecision>;
}

/** Resolves the same canonical Administration authority through async persistence. */
export function createAsyncAdministrationBackedAuthorizationService(
  dependencies: AsyncLiveAuthorizationCompositionDependencies,
): AsyncLiveAdministrationAuthorizationService {
  const resolveService = async (context: LiveAssignmentResolutionContext): Promise<AuthorizationService> => {
    const records = await dependencies.roleAssignments.listBySubject(context.tenantId,context.subjectPrincipalId);
    const assignments: LiveRoleAssignment[]=[];
    for(const record of records){const mapped=await mapCurrentAssignmentAsync(record,context,dependencies);if(mapped!==undefined)assignments.push(mapped);}
    return new AuthorizationService({liveAssignmentResolver:{resolveCurrentAssignments:()=>Object.freeze(assignments)},auditSink:dependencies.auditSink,clock:dependencies.clock,policyVersion:dependencies.policyVersion});
  };
  return Object.freeze({
    evaluate: async (request: AuthorizationRequest): Promise<AuthorizationDecision> => {
      const context:LiveAssignmentResolutionContext={tenantId:request.resource.tenantId??"",subjectPrincipalId:request.session.principalId,subjectPrincipalType:request.session.principalType,resourceType:request.resource.type,purpose:request.purpose,...(request.session.teamId===undefined?{}:{teamId:request.session.teamId})};
      return (await resolveService(context)).evaluate(request);
    },
    evaluateWorkload: async (request: WorkloadAuthorizationRequest): Promise<AuthorizationDecision> => {
      const context:LiveAssignmentResolutionContext={tenantId:request.resource.tenantId??"",subjectPrincipalId:request.subject.principalId,subjectPrincipalType:request.subject.principalType,resourceType:request.resource.type,purpose:request.purpose,...(request.resource.teamId===undefined?{}:{teamId:request.resource.teamId})};
      return (await resolveService(context)).evaluateWorkload(request);
    },
  });
}
async function mapCurrentAssignmentAsync(
  record: RoleAssignmentPersistenceRecord,
  context: LiveAssignmentResolutionContext,
  dependencies: AsyncLiveAuthorizationCompositionDependencies,
): Promise<LiveRoleAssignment | undefined> {
  assertCanonicalAssignment(record);
  if (record.status !== "ACTIVE" || record.subjectPrincipalType !== context.subjectPrincipalType) return undefined;
  if (record.scope.scopeType === "TEAM" && record.scope.scopeId !== context.teamId) return undefined;
  if (record.scope.scopeType !== "TEAM" && record.scope.scopeType !== "TENANT") return undefined;
  const [role, proposal, decisionHistory] = await Promise.all([
    dependencies.roles.find({ tenantId: record.tenantId, resourceType: "ROLE", resourceId: record.roleId }),
    dependencies.proposals.findById(record.tenantId, record.proposalId),
    dependencies.decisions.list({ tenantId: record.tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: record.roleAssignmentId }),
  ]);
  return mapVerifiedAssignment(record, context, role, proposal, decisionHistory);
}

function mapCurrentAssignment(
  record: RoleAssignmentPersistenceRecord,
  context: LiveAssignmentResolutionContext,
  dependencies: LiveAuthorityReadDependencies,
): LiveRoleAssignment | undefined {
  assertCanonicalAssignment(record);
  if (record.status !== "ACTIVE" || record.subjectPrincipalType !== context.subjectPrincipalType) return undefined;
  if (record.scope.scopeType === "TEAM" && record.scope.scopeId !== context.teamId) return undefined;
  if (record.scope.scopeType !== "TEAM" && record.scope.scopeType !== "TENANT") return undefined;
  const role = dependencies.roles.find({ tenantId: record.tenantId, resourceType: "ROLE", resourceId: record.roleId });
  const proposal = dependencies.proposals.findById(record.tenantId, record.proposalId);
  const decisionHistory = dependencies.decisions.list({
    tenantId: record.tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: record.roleAssignmentId,
  });
  return mapVerifiedAssignment(record, context, role, proposal, decisionHistory);
}

function mapVerifiedAssignment(
  record: RoleAssignmentPersistenceRecord,
  context: LiveAssignmentResolutionContext,
  role: RolePersistenceRecord | undefined,
  proposal: ReturnType<AdministrationProposalReadRepository["findById"]>,
  decisionHistory: ReturnType<AdministrationDecisionReadRepository["list"]>,
): LiveRoleAssignment {
  const approvalDecisions = decisionHistory.filter((item) =>
    item.operation === "APPROVE_ROLE_ASSIGNMENT" && item.proposalId === record.proposalId);
  const decision = approvalDecisions[0];
  const laterTerminalDecision = decisionHistory.some((item) =>
    item.operation === "REVOKE_ROLE_ASSIGNMENT" && item.status === "REVOKED" && item.version >= record.version);
  if (role !== undefined) assertCanonicalRole(role, context);
  if (role?.roleId !== record.roleId || role.tenantId !== record.tenantId
    || role.status !== "ACTIVE"
    || proposal?.tenantId !== record.tenantId || proposal.resourceType !== "ROLE_ASSIGNMENT"
    || proposal.resourceId !== record.roleAssignmentId || proposal.proposalId !== record.proposalId
    || proposal.scope.tenantId !== record.scope.tenantId || proposal.scope.scopeType !== record.scope.scopeType
    || proposal.scope.scopeId !== record.scope.scopeId || proposal.status !== "APPROVED"
    || proposal.proposedBy !== record.proposedBy || proposal.resourceVersion !== record.version - 1
    || proposal.version !== record.version
    || approvalDecisions.length !== 1 || decision === undefined || laterTerminalDecision
    || decision.tenantId !== record.tenantId || decision.resourceType !== "ROLE_ASSIGNMENT"
    || decision.resourceId !== record.roleAssignmentId || decision.scope.tenantId !== record.scope.tenantId
    || decision.scope.scopeType !== record.scope.scopeType || decision.scope.scopeId !== record.scope.scopeId
    || decision.proposerId !== record.proposedBy || decision.decisionActorId !== record.approvedBy
    || decision.status !== "APPROVED" || decision.version !== record.version
    || record.approvedBy === undefined || record.approvedBy.trim().length === 0 || record.approvedBy === record.proposedBy
    || record.evidenceReferences.length === 0 || proposal.evidenceReferences.length === 0
    || decision.evidenceReferences.length === 0
    || record.evidenceReferences.some((reference) => !isCanonicalEvidence(reference))
    || proposal.evidenceReferences.some((reference) => !isCanonicalEvidence(reference))
    || decision.evidenceReferences.some((reference) => !isCanonicalEvidence(reference))
    || !hasSharedEvidence(record.evidenceReferences, decision.evidenceReferences)
    || !isCanonicalProposal(proposal) || !isCanonicalDecision(decision)) {
    throw new Error("authoritative assignment evidence is invalid");
  }
  return Object.freeze({
    id: record.roleAssignmentId,
    principalId: record.subjectPrincipalId,
    role: role.roleCode,
    teamIds: Object.freeze([...record.teamIds]),
    resourceTypes: Object.freeze([...record.resourceTypes]),
    purposes: Object.freeze([...record.purposes]),
    effectiveFrom: record.effectiveFrom,
    effectiveUntil: record.effectiveUntil,
    status: "ACTIVE",
    version: record.version,
    tenantId: record.tenantId,
    subjectPrincipalType: record.subjectPrincipalType,
  });
}

function assertCanonicalAssignment(record: RoleAssignmentPersistenceRecord): void {
  const from = Date.parse(record.effectiveFrom);
  const until = Date.parse(record.effectiveUntil);
  if (
    record.recordType !== "ROLE_ASSIGNMENT" || record.tenantId.trim().length === 0
    || record.scope.tenantId !== record.tenantId || record.roleAssignmentId.trim().length === 0
    || record.roleId.trim().length === 0 || record.proposalId.trim().length === 0 || record.proposedBy.trim().length === 0
    || record.reasonReference.trim().length === 0 || record.scope.scopeId.trim().length === 0
    || !["HUMAN", "SERVICE"].includes(record.subjectPrincipalType)
    || record.subjectPrincipalId.trim().length === 0 || !Number.isSafeInteger(record.version) || record.version < 1
    || !["PROPOSED", "ACTIVE", "REVOKED"].includes(record.status)
    || !Number.isFinite(from) || !Number.isFinite(until) || from >= until
    || new Date(from).toISOString() !== record.effectiveFrom || new Date(until).toISOString() !== record.effectiveUntil
    || record.teamIds.some((item) => item.trim().length === 0)
    || record.resourceTypes.length === 0 || record.resourceTypes.some((item) => item.trim().length === 0)
    || record.purposes.length === 0 || record.purposes.some((item) => item.trim().length === 0)
    || (record.scope.scopeType === "TEAM" && !record.teamIds.includes(record.scope.scopeId))
  ) throw new Error("authoritative assignment is invalid");
}

function assertCanonicalRole(role: RolePersistenceRecord, context: LiveAssignmentResolutionContext): void {
  const applicableScope = (role.scope.scopeType === "TENANT" && role.scope.scopeId === context.tenantId)
    || (role.scope.scopeType === "TEAM" && role.scope.scopeId === context.teamId);
  if (role.recordType !== "ROLE" || role.roleId.trim().length === 0 || role.tenantId.trim().length === 0
    || role.scope.tenantId !== role.tenantId || role.scope.scopeId.trim().length === 0
    || role.policyReference.trim().length === 0 || !Number.isSafeInteger(role.version) || role.version < 1
    || !applicableScope || !["ACTIVE", "RETIRED"].includes(role.status) || !isCanonicalRoleCode(role.roleCode)
    || role.evidenceReferences.length === 0 || role.evidenceReferences.some((reference) => !isCanonicalEvidence(reference))) {
    throw new Error("authoritative Role is invalid");
  }
}

function hasSharedEvidence(
  assignmentEvidence: readonly AdministrationEvidenceReference[],
  decisionEvidence: readonly AdministrationEvidenceReference[],
): boolean {
  return assignmentEvidence.some((left) => decisionEvidence.some((right) =>
    left.type === right.type && left.id === right.id && left.version === right.version));
}

function isCanonicalEvidence(reference: AdministrationEvidenceReference): boolean {
  return ["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(reference.type)
    && reference.id.trim().length > 0 && Number.isSafeInteger(reference.version) && reference.version > 0;
}

function isCanonicalProposal(proposal: NonNullable<ReturnType<AdministrationProposalReadRepository["findById"]>>): boolean {
  return proposal.proposalId.trim().length > 0 && proposal.proposedBy.trim().length > 0
    && proposal.proposedChangeReference.trim().length > 0 && proposal.policyReference.trim().length > 0
    && proposal.reasonReference.trim().length > 0 && Number.isSafeInteger(proposal.version) && proposal.version > 0
    && Number.isSafeInteger(proposal.resourceVersion) && proposal.resourceVersion > 0;
}

function isCanonicalDecision(decision: NonNullable<ReturnType<AdministrationDecisionReadRepository["list"]>[number]>): boolean {
  const decidedAt = Date.parse(decision.decidedAt);
  return decision.decisionId.trim().length > 0 && decision.proposalId.trim().length > 0
    && decision.proposerId.trim().length > 0 && decision.decisionActorId.trim().length > 0
    && decision.reasonReference.trim().length > 0 && Number.isSafeInteger(decision.version) && decision.version > 0
    && Number.isFinite(decidedAt) && new Date(decidedAt).toISOString() === decision.decidedAt;
}
