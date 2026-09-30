import { createHash } from "node:crypto";

import type { IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationDecision, AuthorizationRequest } from "../../../modules/authorization/src/authorization-service.js";
import type {
  AdministrationDecisionRecord,
  AdministrationEvidenceReference as PersistenceEvidenceReference,
  AdministrationIdempotencyRecord,
  AdministrationPersistenceResourceType,
  AdministrationPersistenceScope,
  AdministrationProposalRecord,
  AdministrationTransactionIdentity,
  RoleAssignmentPersistenceRecord,
  RolePersistenceRecord,
  TeamScopePersistenceRecord,
} from "../../../modules/administration/src/administration-persistence.js";
import type {
  AsyncAdministrationDecisionReadRepository,
  AsyncAdministrationIdempotencyReadRepository,
  AsyncAdministrationProposalReadRepository,
  AsyncAdministrationUnitOfWork,
  AsyncPolicyReadRepository,
  AsyncPublicationTargetReadRepository,
  AsyncRoleAssignmentReadRepository,
  AsyncRoleReadRepository,
  AsyncSourceGovernanceReadRepository,
  AsyncTeamScopeReadRepository,
} from "../../../modules/administration/src/administration-async-persistence.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  AdministrationApiError,
  assertIndependentAdministrationApproval,
  createAdministrationCommandFingerprint,
  createAdministrationCommandResult,
  createAdministrationCollectionView,
  createAdministrationReadView,
  parseAdministrationApiRequest,
  resolveAdministrationApiSessionAsync,
  type AdministrationApiCommandOperation,
  type AdministrationApiCommandRequest,
  type AdministrationApiCommandResult,
  type AdministrationCollectionView,
  type AdministrationApiQueryRequest,
  type AdministrationEvidenceReference,
  type AdministrationReadView,
  type AdministrationProposalEvidence,
  type AdministrationScopeReference,
  type AdministrationSessionResolver,
  type AsyncAdministrationSessionResolver,
  type ResolvedAdministrationApiRequest,
} from "./administration-api-contracts.js";

export interface AdministrationGovernanceApplicationDependencies {
  readonly authorizationService: { evaluate(request: AuthorizationRequest): AuthorizationDecision | Promise<AuthorizationDecision> };
  readonly unitOfWork: AsyncAdministrationUnitOfWork;
  readonly roleAssignments: AsyncRoleAssignmentReadRepository;
  readonly roles: AsyncRoleReadRepository;
  readonly policies: AsyncPolicyReadRepository;
  readonly teamScopes: AsyncTeamScopeReadRepository;
  readonly sourceGovernance: AsyncSourceGovernanceReadRepository;
  readonly publicationTargets: AsyncPublicationTargetReadRepository;
  readonly proposals: AsyncAdministrationProposalReadRepository;
  readonly decisions: AsyncAdministrationDecisionReadRepository;
  readonly idempotency: AsyncAdministrationIdempotencyReadRepository;
  readonly sessionResolver: AdministrationSessionResolver | AsyncAdministrationSessionResolver;
  readonly clock: () => Date;
  readonly idFactory: IdFactory;
}

type PolicyOperation = "PROPOSE_POLICY_CHANGE" | "APPROVE_POLICY_CHANGE" | "REJECT_POLICY_CHANGE";
type SourceOperation = "PROPOSE_SOURCE_GOVERNANCE" | "APPROVE_SOURCE_GOVERNANCE" | "REJECT_SOURCE_GOVERNANCE" | "TRANSITION_SOURCE_GOVERNANCE";
type TargetOperation = "PROPOSE_PUBLICATION_TARGET_GOVERNANCE" | "APPROVE_PUBLICATION_TARGET_GOVERNANCE" | "REJECT_PUBLICATION_TARGET_GOVERNANCE" | "TRANSITION_PUBLICATION_TARGET_GOVERNANCE";
type RoleAssignmentOperation = "PROPOSE_ROLE_ASSIGNMENT" | "APPROVE_ROLE_ASSIGNMENT" | "REJECT_ROLE_ASSIGNMENT" | "REVOKE_ROLE_ASSIGNMENT";
type RoleOperation = "PROPOSE_ROLE_CHANGE" | "APPROVE_ROLE_CHANGE" | "REJECT_ROLE_CHANGE";
type TeamScopeOperation = "PROPOSE_TEAM_SCOPE_CHANGE" | "APPROVE_TEAM_SCOPE_CHANGE" | "REJECT_TEAM_SCOPE_CHANGE";

export class AdministrationGovernanceApplication {
  public constructor(private readonly dependencies: AdministrationGovernanceApplicationDependencies) {}

  public async execute(input: unknown): Promise<AdministrationApiCommandResult> {
    const request = parseAdministrationApiRequest(input);
    if (request.kind !== "COMMAND") throw new AdministrationApiError("VALIDATION_FAILED");
    const resolved = await resolveAdministrationApiSessionAsync(request, this.dependencies.sessionResolver, this.dependencies.clock);
    try {
      if (isRoleAssignmentOperation(request.operation)) return request.operation === "PROPOSE_ROLE_ASSIGNMENT"
        ? await this.proposeRoleAssignment(resolved) : await this.decideRoleAssignment(resolved);
      if (isRoleOperation(request.operation)) return request.operation === "PROPOSE_ROLE_CHANGE"
        ? await this.proposeRole(resolved) : await this.decideRole(resolved);
      if (isTeamScopeOperation(request.operation)) return request.operation === "PROPOSE_TEAM_SCOPE_CHANGE"
        ? await this.proposeTeamScope(resolved) : await this.decideTeamScope(resolved);
      if (isPolicyOperation(request.operation)) return request.operation === "PROPOSE_POLICY_CHANGE"
        ? await this.proposePolicy(resolved) : await this.decidePolicy(resolved);
      if (isSourceOperation(request.operation)) return request.operation === "PROPOSE_SOURCE_GOVERNANCE"
        ? await this.proposeSource(resolved) : await this.decideSource(resolved);
      if (isTargetOperation(request.operation)) return request.operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE"
        ? await this.proposeTarget(resolved) : await this.decideTarget(resolved);
      throw new AdministrationApiError("VALIDATION_FAILED");
    } catch (error: unknown) {
      if (error instanceof AdministrationApiError) throw error;
      const code = error instanceof Error ? error.message : "";
      if (code === "VERSION_CONFLICT" || code === "VERSION_ADVANCEMENT_INVALID") throw new AdministrationApiError("VERSION_CONFLICT");
      if (code === "IDEMPOTENCY_CONFLICT") throw new AdministrationApiError("IDEMPOTENCY_CONFLICT");
      if (code === "RECORD_NOT_FOUND") throw new AdministrationApiError("NOT_FOUND");
      throw new AdministrationApiError("INTERNAL_ERROR");
    }
  }

  public async read(input: unknown): Promise<AdministrationReadView> {
    const request = parseAdministrationApiRequest(input);
    if (request.kind !== "QUERY") throw new AdministrationApiError("VALIDATION_FAILED");
    const resolved = await resolveAdministrationApiSessionAsync(request, this.dependencies.sessionResolver, this.dependencies.clock);
    const scope = asPersistenceScope(request.payload.scope);
    if (request.operation === "READ_ROLE_ASSIGNMENT") {
      const resourceId = requiredString(request.payload["roleAssignmentId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.roleAssignments.find(transactionIdentity(request.tenantId, "ROLE_ASSIGNMENT", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return roleAssignmentView(record);
    }
    if (request.operation === "READ_ROLE") {
      const resourceId = requiredString(request.payload["roleId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.roles.find(transactionIdentity(request.tenantId, "ROLE", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "ROLE", roleId: resourceId, roleCode: record.roleCode, scope: record.scope,
        status: record.status, version: record.version, evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_TEAM_SCOPE") {
      const resourceId = requiredString(request.payload["teamId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.teamScopes.find(transactionIdentity(request.tenantId, "TEAM_SCOPE", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "TEAM_SCOPE", teamId: resourceId, scope: record.scope,
        status: record.status, version: record.version, evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_ADMINISTRATION_DECISION") {
      const decisionId = requiredString(request.payload["decisionId"]);
      await this.authorizeRead(resolved.actor, request, scope, decisionId);
      const decision = await this.dependencies.decisions.findById(request.tenantId, decisionId);
      if (decision === undefined || !sameScope(decision.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return decisionView(decision);
    }
    if (request.operation === "READ_POLICY") {
      const resourceId = requiredString(request.payload["policyId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.policies.find(transactionIdentity(request.tenantId, "POLICY", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "POLICY", policyId: resourceId, scope: record.scope, status: record.status,
        version: record.version, evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_SOURCE_GOVERNANCE") {
      const resourceId = requiredString(request.payload["sourceRegistryEntryId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.sourceGovernance.find(transactionIdentity(request.tenantId, "SOURCE_REGISTRY", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "SOURCE_GOVERNANCE", sourceRegistryEntryId: resourceId, scope: record.scope,
        status: record.status, version: record.version, policyReference: record.policyReference,
        evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_PUBLICATION_TARGET_GOVERNANCE") {
      const resourceId = requiredString(request.payload["publicationTargetId"]);
      await this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = await this.dependencies.publicationTargets.find(transactionIdentity(request.tenantId, "PUBLICATION_TARGET", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "PUBLICATION_TARGET_GOVERNANCE", publicationTargetId: resourceId, scope: record.scope,
        status: record.status, version: record.version, policyReference: record.policyReference,
        channelReference: record.channelReference, evidenceReferences: record.evidenceReferences,
      });
    }
    throw new AdministrationApiError("VALIDATION_FAILED");
  }

  public async list(input: unknown): Promise<AdministrationCollectionView<AdministrationReadView>> {
    const request = parseAdministrationApiRequest(input);
    if (request.kind !== "QUERY") throw new AdministrationApiError("VALIDATION_FAILED");
    const resolved = await resolveAdministrationApiSessionAsync(request, this.dependencies.sessionResolver, this.dependencies.clock);
    const scope = asPersistenceScope(request.payload.scope);
    await this.authorizeRead(resolved.actor, request, scope, scope.scopeId);
    const pagination = queryPagination(request.payload["pagination"]);
    const requestedStatus = request.payload["status"];
    if (request.operation === "LIST_ROLES") {
      const records = (await this.dependencies.roles.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.roleId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.roleId.localeCompare(right.roleId));
      return pagedAdministrationCollection(records, pagination, (record) => record.roleId, (record) => createAdministrationReadView({
        viewType: "ROLE", roleId: record.roleId, roleCode: record.roleCode, scope: record.scope, status: record.status,
        version: record.version, evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_TEAM_SCOPES") {
      const records = (await this.dependencies.teamScopes.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.teamId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.teamId.localeCompare(right.teamId));
      return pagedAdministrationCollection(records, pagination, (record) => record.teamId, (record) => createAdministrationReadView({
        viewType: "TEAM_SCOPE", teamId: record.teamId, scope: record.scope, status: record.status,
        version: record.version, evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_POLICIES") {
      const records = (await this.dependencies.policies.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.policyId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.policyId.localeCompare(right.policyId));
      return pagedAdministrationCollection(records, pagination, (record) => record.policyId, (record) => createAdministrationReadView({
        viewType: "POLICY", policyId: record.policyId, scope: record.scope, status: record.status,
        version: record.version, evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_SOURCE_GOVERNANCE") {
      const records = (await this.dependencies.sourceGovernance.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.sourceRegistryEntryId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.sourceRegistryEntryId.localeCompare(right.sourceRegistryEntryId));
      return pagedAdministrationCollection(records, pagination, (record) => record.sourceRegistryEntryId, (record) => createAdministrationReadView({
        viewType: "SOURCE_GOVERNANCE", sourceRegistryEntryId: record.sourceRegistryEntryId,
        scope: record.scope, status: record.status, version: record.version,
        policyReference: record.policyReference, evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_PUBLICATION_TARGET_GOVERNANCE") {
      const records = (await this.dependencies.publicationTargets.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.publicationTargetId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.publicationTargetId.localeCompare(right.publicationTargetId));
      return pagedAdministrationCollection(records, pagination, (record) => record.publicationTargetId, (record) => createAdministrationReadView({
        viewType: "PUBLICATION_TARGET_GOVERNANCE", publicationTargetId: record.publicationTargetId,
        scope: record.scope, status: record.status, version: record.version,
        policyReference: record.policyReference, channelReference: record.channelReference,
        evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_ADMINISTRATION_PROPOSALS") {
      const records = (await this.dependencies.proposals.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.proposalId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
      return pagedAdministrationCollection(records, pagination, (record) => record.proposalId, (record) => createAdministrationReadView({
        viewType: "ADMINISTRATION_PROPOSAL", proposalId: record.proposalId,
        resourceType: record.resourceType, resourceId: record.resourceId,
        proposerReference: record.proposedBy, proposedChangeReference: record.proposedChangeReference,
        scope: record.scope, status: record.status, version: record.version,
        evidenceReferences: record.evidenceReferences,
      }));
    }
    if (request.operation === "LIST_ADMINISTRATION_DECISIONS") {
      const records = (await this.dependencies.decisions.listByScope(scope))
        .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
        .filter((record) => pagination.cursor === undefined || record.decisionId.localeCompare(pagination.cursor) > 0)
        .sort((left, right) => left.decisionId.localeCompare(right.decisionId));
      return pagedAdministrationCollection(records, pagination, (record) => record.decisionId, decisionView);
    }

    if (request.operation !== "LIST_ROLE_ASSIGNMENTS") throw new AdministrationApiError("VALIDATION_FAILED");
    const records = (await this.dependencies.roleAssignments.listByScope(scope))
      .filter((record) => requestedStatus === undefined || record.status === requestedStatus)
      .filter((record) => pagination.cursor === undefined || record.roleAssignmentId.localeCompare(pagination.cursor) > 0)
      .sort((left, right) => left.roleAssignmentId.localeCompare(right.roleAssignmentId));
    return pagedAdministrationCollection(records, pagination, (record) => record.roleAssignmentId, roleAssignmentView);
  }

  private async proposeRoleAssignment(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const requestedAssignmentId = request.payload["roleAssignmentId"];
    const assignmentId = typeof requestedAssignmentId === "string"
      ? requestedAssignmentId
      : deterministicCreateId("assignment", request.tenantId, request.payload.idempotencyKey);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "ROLE_ASSIGNMENT", assignmentId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, assignmentId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.roleAssignments.find(identity);
    if (requestedAssignmentId === undefined && current !== undefined) throw new AdministrationApiError("VERSION_CONFLICT");
    if (requestedAssignmentId !== undefined && current === undefined) throw new AdministrationApiError("NOT_FOUND");
    if (current !== undefined && !sameScope(current.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (current !== undefined && current.status !== "ACTIVE") throw new AdministrationApiError("INVALID_STATE");
    if (current !== undefined && current.version !== request.payload.expectedVersion) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    const requestedRoleCode = requiredString(request.payload["role"]);
    const role = (await this.dependencies.roles.listByScope({
      tenantId: request.tenantId, scopeType: "TENANT", scopeId: request.tenantId,
    })).find((candidate) => candidate.roleCode === requestedRoleCode && candidate.status === "ACTIVE");
    if (role === undefined) throw new AdministrationApiError("NOT_FOUND");
    const proposalId = this.dependencies.idFactory();
    const evidence = asPersistenceEvidence(request.payload.evidenceReferences);
    const assignment = {
      recordType: "ROLE_ASSIGNMENT" as const, tenantId: request.tenantId, roleAssignmentId: assignmentId,
      proposalId, scope, subjectPrincipalId: requiredString(request.payload["subjectPrincipalId"]),
      subjectPrincipalType: requiredPrincipalType(request.payload["subjectPrincipalType"]), roleId: role.roleId,
      teamIds: requiredStringList(request.payload["teamIds"]), resourceTypes: requiredStringList(request.payload["resourceTypes"]),
      purposes: requiredStringList(request.payload["purposes"]), effectiveFrom: requiredString(request.payload["effectiveFrom"]),
      effectiveUntil: requiredString(request.payload["effectiveUntil"]), status: "PROPOSED" as const, version: 1,
      proposedBy: resolved.actor.principalId, reasonReference: reasonReference(fingerprint), evidenceReferences: evidence,
    };
    if (current !== undefined && (current.subjectPrincipalId !== assignment.subjectPrincipalId
      || current.subjectPrincipalType !== assignment.subjectPrincipalType || current.roleId !== assignment.roleId
      || !sameStringValues(current.teamIds, assignment.teamIds) || !sameStringValues(current.resourceTypes, assignment.resourceTypes)
      || !sameStringValues(current.purposes, assignment.purposes) || current.effectiveFrom !== assignment.effectiveFrom
      || current.effectiveUntil !== assignment.effectiveUntil)) throw new AdministrationApiError("VALIDATION_FAILED");
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "ROLE_ASSIGNMENT", resourceId: assignmentId,
      resourceVersion: current?.version ?? 1, scope, proposedBy: resolved.actor.principalId, proposedChangeReference: `intent:${fingerprint}`,
      policyReference: role.policyReference, status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: evidence,
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.roleAssignments.save(assignment);
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private async decideRoleAssignment(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const assignmentId = requiredString(request.payload["roleAssignmentId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "ROLE_ASSIGNMENT", assignmentId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, assignmentId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.roleAssignments.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "ROLE_ASSIGNMENT" || proposal.resourceId !== assignmentId
      || !sameScope(current.scope, scope) || !sameScope(proposal.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (proposal.status !== "PROPOSED") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    if (request.operation === "REVOKE_ROLE_ASSIGNMENT" ? current.status !== "ACTIVE" : current.status !== "PROPOSED") {
      throw new AdministrationApiError("INVALID_STATE");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    const rejected = request.operation === "REJECT_ROLE_ASSIGNMENT";
    const revoked = request.operation === "REVOKE_ROLE_ASSIGNMENT";
    const resultVersion = rejected ? current.version : current.version + 1;
    const status = rejected ? "REJECTED" as const : revoked ? "REVOKED" as const : "ACTIVE" as const;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const combinedEvidence = Object.freeze([...asPersistenceEvidence(request.payload.evidenceReferences), decisionReference]);
    const decision: AdministrationDecisionRecord = {
      decisionId, proposalId, tenantId: request.tenantId, operation: request.operation,
      resourceType: "ROLE_ASSIGNMENT", resourceId: assignmentId, scope, proposerId: proposal.proposedBy,
      decisionActorId: resolved.actor.principalId, status: rejected ? "REJECTED" : revoked ? "REVOKED" : "APPROVED",
      reasonReference: reasonReference(fingerprint), evidenceReferences: combinedEvidence,
      version: resultVersion, decidedAt: this.dependencies.clock().toISOString(),
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.roleAssignments.update(current.version, {
        ...current, status: revoked ? "REVOKED" : "ACTIVE", version: resultVersion,
        ...(revoked ? { revokedBy: resolved.actor.principalId } : { approvedBy: resolved.actor.principalId }),
        evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, {
        ...proposal, status: rejected ? "REJECTED" : revoked ? "REVOKED" : "APPROVED", version: proposal.version + 1,
        evidenceReferences: [...proposal.evidenceReferences, decisionReference],
      });
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion, status, this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "ROLE_ASSIGNMENT", resourceId: assignmentId,
      status, version: resultVersion, decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private async proposeTarget(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const requestedTargetId = request.payload["publicationTargetId"];
    const targetId = typeof requestedTargetId === "string"
      ? requestedTargetId
      : deterministicCreateId("target", request.tenantId, request.payload.idempotencyKey);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "PUBLICATION_TARGET", targetId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, targetId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.publicationTargets.find(identity);
    if (requestedTargetId !== undefined && current === undefined) throw new AdministrationApiError("NOT_FOUND");
    if ((current?.version ?? 0) !== request.payload.expectedVersion) throw new AdministrationApiError("VERSION_CONFLICT");
    const proposalId = this.dependencies.idFactory();
    const evidence = asPersistenceEvidence(request.payload.evidenceReferences);
    const policyReference = requiredString(request.payload["policyReference"]);
    const channelReference = requiredString(request.payload["channelReference"]);
    const publicationTargetGovernanceChange = {
      name: requiredString(request.payload["name"]), targetType: requiredString(request.payload["targetType"]),
      channelReference, allowedFieldReferences: requiredStringList(request.payload["allowedFieldReferences"]),
    };
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "PUBLICATION_TARGET", resourceId: targetId,
      resourceVersion: current?.version ?? 1, scope, proposedBy: resolved.actor.principalId,
      proposedChangeReference: `intent:${fingerprint}`, policyReference, status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: evidence, publicationTargetGovernanceChange,
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.publicationTargets.save({
          recordType: "PUBLICATION_TARGET", tenantId: request.tenantId, publicationTargetId: targetId,
          scope, status: "PROPOSED", version: 1, policyReference, ...publicationTargetGovernanceChange,
          evidenceReferences: evidence,
        });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private async decideTarget(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const targetId = requiredString(request.payload["publicationTargetId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "PUBLICATION_TARGET", targetId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, targetId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.publicationTargets.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "PUBLICATION_TARGET"
      || proposal.resourceId !== targetId || !sameScope(proposal.scope, scope)) {
      throw new AdministrationApiError("NOT_FOUND");
    }
    if (proposal.status !== "PROPOSED" || proposal.publicationTargetGovernanceChange === undefined) {
      throw new AdministrationApiError("INVALID_STATE");
    }
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    const rejected = request.operation === "REJECT_PUBLICATION_TARGET_GOVERNANCE";
    const resultVersion = rejected ? current.version : current.version + 1;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const combinedEvidence = Object.freeze([...asPersistenceEvidence(request.payload.evidenceReferences), decisionReference]);
    const authoritativeStatus = request.operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE"
      ? requiredTargetTransition(request.payload["targetStatus"])
      : "ACTIVE" as const;
    const status = rejected ? "REJECTED" as const : authoritativeStatus;
    const decision: AdministrationDecisionRecord = {
      decisionId, proposalId, tenantId: request.tenantId, operation: request.operation,
      resourceType: "PUBLICATION_TARGET", resourceId: targetId, scope, proposerId: proposal.proposedBy,
      decisionActorId: resolved.actor.principalId, status: rejected ? "REJECTED" : "APPROVED",
      reasonReference: reasonReference(fingerprint), evidenceReferences: combinedEvidence,
      version: resultVersion, decidedAt: this.dependencies.clock().toISOString(),
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.publicationTargets.update(current.version, {
        ...current, status: authoritativeStatus, policyReference: proposal.policyReference,
        ...(proposal.publicationTargetGovernanceChange ?? {}), version: resultVersion,
        evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, {
        ...proposal, status: rejected ? "REJECTED" : "APPROVED", version: proposal.version + 1,
        evidenceReferences: [...proposal.evidenceReferences, decisionReference],
      });
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion, status, this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "PUBLICATION_TARGET", resourceId: targetId,
      status, version: resultVersion, decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private async proposeSource(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const requestedSourceId = request.payload["sourceRegistryEntryId"];
    const sourceId = typeof requestedSourceId === "string"
      ? requestedSourceId
      : deterministicCreateId("source", request.tenantId, request.payload.idempotencyKey);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "SOURCE_REGISTRY", sourceId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, sourceId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.sourceGovernance.find(identity);
    if (requestedSourceId !== undefined && current === undefined) throw new AdministrationApiError("NOT_FOUND");
    if ((current?.version ?? 0) !== request.payload.expectedVersion) throw new AdministrationApiError("VERSION_CONFLICT");
    const proposalId = this.dependencies.idFactory();
    const evidence = asPersistenceEvidence(request.payload.evidenceReferences);
    const policyReference = requiredString(request.payload["policyReference"]);
    const sourceGovernanceChange = {
      name: requiredString(request.payload["name"]), sourceType: requiredString(request.payload["sourceType"]),
      allowedMethods: requiredStringList(request.payload["allowedMethods"]),
      allowedPurposes: requiredStringList(request.payload["allowedPurposes"]),
      classification: requiredClassification(request.payload["classification"]),
    };
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "SOURCE_REGISTRY", resourceId: sourceId,
      resourceVersion: current?.version ?? 1, scope, proposedBy: resolved.actor.principalId,
      proposedChangeReference: `intent:${fingerprint}`, policyReference, status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: evidence, sourceGovernanceChange,
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.sourceGovernance.save({
          recordType: "SOURCE_REGISTRY", tenantId: request.tenantId, sourceRegistryEntryId: sourceId,
          scope, status: "DRAFT", version: 1, policyReference, ...sourceGovernanceChange,
          evidenceReferences: evidence,
        });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private async decideSource(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const sourceId = requiredString(request.payload["sourceRegistryEntryId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "SOURCE_REGISTRY", sourceId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, sourceId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.sourceGovernance.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "SOURCE_REGISTRY"
      || proposal.resourceId !== sourceId || !sameScope(proposal.scope, scope)) {
      throw new AdministrationApiError("NOT_FOUND");
    }
    if (proposal.status !== "PROPOSED" || proposal.sourceGovernanceChange === undefined) {
      throw new AdministrationApiError("INVALID_STATE");
    }
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    const rejected = request.operation === "REJECT_SOURCE_GOVERNANCE";
    const resultVersion = rejected ? current.version : current.version + 1;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const combinedEvidence = Object.freeze([...asPersistenceEvidence(request.payload.evidenceReferences), decisionReference]);
    const authoritativeStatus = request.operation === "TRANSITION_SOURCE_GOVERNANCE"
      ? requiredSourceTransition(request.payload["targetStatus"])
      : "ACTIVE" as const;
    const status = rejected ? "REJECTED" as const : authoritativeStatus;
    const decision: AdministrationDecisionRecord = {
      decisionId, proposalId, tenantId: request.tenantId, operation: request.operation,
      resourceType: "SOURCE_REGISTRY", resourceId: sourceId, scope, proposerId: proposal.proposedBy,
      decisionActorId: resolved.actor.principalId, status: rejected ? "REJECTED" : "APPROVED",
      reasonReference: reasonReference(fingerprint), evidenceReferences: combinedEvidence,
      version: resultVersion, decidedAt: this.dependencies.clock().toISOString(),
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.sourceGovernance.update(current.version, {
        ...current, status: authoritativeStatus, policyReference: proposal.policyReference,
        ...(proposal.sourceGovernanceChange ?? {}), version: resultVersion,
        evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, {
        ...proposal, status: rejected ? "REJECTED" : "APPROVED", version: proposal.version + 1,
        evidenceReferences: [...proposal.evidenceReferences, decisionReference],
      });
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion, status, this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "SOURCE_REGISTRY", resourceId: sourceId,
      status, version: resultVersion, decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private async proposeRole(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const roleId = requiredString(request.payload["roleId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "ROLE", roleId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, roleId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.roles.find(identity);
    if (current === undefined || !sameScope(current.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (current.status !== "ACTIVE") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion) throw new AdministrationApiError("VERSION_CONFLICT");
    const proposalId = this.dependencies.idFactory();
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "ROLE", resourceId: roleId,
      resourceVersion: current.version, scope, proposedBy: resolved.actor.principalId,
      proposedChangeReference: requiredString(request.payload["proposedChangeReference"]),
      policyReference: requiredString(request.payload["proposedChangeReference"]), status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: asPersistenceEvidence(request.payload.evidenceReferences),
    };
    await this.persistProposal(identity, request, fingerprint, proposal);
    return proposalResult(request.operation, proposal);
  }

  private async decideRole(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const roleId = requiredString(request.payload["roleId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "ROLE", roleId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, roleId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.roles.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "ROLE" || proposal.resourceId !== roleId
      || !sameScope(current.scope, scope) || !sameScope(proposal.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (current.status !== "ACTIVE" || proposal.status !== "PROPOSED") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    return await this.persistRoleDecision(current, proposal, resolved, fingerprint);
  }

  private async persistRoleDecision(
    current: RolePersistenceRecord,
    proposal: AdministrationProposalRecord,
    resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>,
    fingerprint: string,
  ): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const rejected = request.operation === "REJECT_ROLE_CHANGE";
    const resultVersion = rejected ? current.version : current.version + 1;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const combinedEvidence = Object.freeze([...asPersistenceEvidence(request.payload.evidenceReferences), decisionReference]);
    const decision = decisionRecord(proposal, resolved, decisionId, resultVersion, combinedEvidence, rejected,
      fingerprint, this.dependencies.clock().toISOString());
    const identity = transactionIdentity(request.tenantId, "ROLE", current.roleId);
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.roles.update(current.version, {
        ...current, status: "ACTIVE", policyReference: proposal.proposedChangeReference,
        version: resultVersion, evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, decidedProposal(proposal, rejected, decisionReference));
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion,
        rejected ? "REJECTED" : "ACTIVE", this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return decisionResult(request.operation, proposal, decisionId, resultVersion, combinedEvidence, rejected);
  }

  private async proposeTeamScope(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const teamId = requiredString(request.payload["teamId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "TEAM_SCOPE", teamId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, teamId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.teamScopes.find(identity);
    if (current === undefined || !sameScope(current.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (current.status !== "ACTIVE") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion) throw new AdministrationApiError("VERSION_CONFLICT");
    const proposalId = this.dependencies.idFactory();
    const changeReference = requiredString(request.payload["proposedChangeReference"]);
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "TEAM_SCOPE", resourceId: teamId,
      resourceVersion: current.version, scope, proposedBy: resolved.actor.principalId,
      proposedChangeReference: changeReference, policyReference: changeReference, status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: asPersistenceEvidence(request.payload.evidenceReferences),
    };
    await this.persistProposal(identity, request, fingerprint, proposal);
    return proposalResult(request.operation, proposal);
  }

  private async decideTeamScope(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const teamId = requiredString(request.payload["teamId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "TEAM_SCOPE", teamId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, teamId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.teamScopes.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "TEAM_SCOPE" || proposal.resourceId !== teamId
      || !sameScope(current.scope, scope) || !sameScope(proposal.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
    if (current.status !== "ACTIVE" || proposal.status !== "PROPOSED") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    return await this.persistTeamScopeDecision(current, proposal, resolved, fingerprint);
  }

  private async persistTeamScopeDecision(
    current: TeamScopePersistenceRecord,
    proposal: AdministrationProposalRecord,
    resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>,
    fingerprint: string,
  ): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const rejected = request.operation === "REJECT_TEAM_SCOPE_CHANGE";
    const resultVersion = rejected ? current.version : current.version + 1;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const combinedEvidence = Object.freeze([...asPersistenceEvidence(request.payload.evidenceReferences), decisionReference]);
    const decision = decisionRecord(proposal, resolved, decisionId, resultVersion, combinedEvidence, rejected,
      fingerprint, this.dependencies.clock().toISOString());
    const identity = transactionIdentity(request.tenantId, "TEAM_SCOPE", current.teamId);
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.teamScopes.update(current.version, {
        ...current, status: "ACTIVE", version: resultVersion,
        evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, decidedProposal(proposal, rejected, decisionReference));
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion,
        rejected ? "REJECTED" : "ACTIVE", this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return decisionResult(request.operation, proposal, decisionId, resultVersion, combinedEvidence, rejected);
  }

  private async persistProposal(
    identity: AdministrationTransactionIdentity,
    request: AdministrationApiCommandRequest,
    fingerprint: string,
    proposal: AdministrationProposalRecord,
  ): Promise<void> {
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposal.proposalId, 1,
        "PROPOSED", this.dependencies.clock, proposal.evidenceReferences));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
  }

  private async proposePolicy(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const policyId = requiredString(request.payload["policyId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "POLICY", policyId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, policyId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.policies.find(identity);
    if ((current?.version ?? 0) !== request.payload.expectedVersion) throw new AdministrationApiError("VERSION_CONFLICT");
    const proposalId = this.dependencies.idFactory();
    const evidence = asPersistenceEvidence(request.payload.evidenceReferences);
    const proposal: AdministrationProposalRecord = {
      proposalId, tenantId: request.tenantId, resourceType: "POLICY", resourceId: policyId,
      resourceVersion: current?.version ?? 1, scope, proposedBy: resolved.actor.principalId,
      proposedChangeReference: requiredString(request.payload["proposedChangeReference"]),
      policyReference: requiredString(request.payload["proposedChangeReference"]), status: "PROPOSED", version: 1,
      reasonReference: reasonReference(fingerprint), evidenceReferences: evidence,
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.policies.save({
        recordType: "POLICY", tenantId: request.tenantId, policyId, scope, status: "PROPOSED",
        policyReference: proposal.policyReference, version: 1, evidenceReferences: evidence,
      });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private async decidePolicy(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): Promise<AdministrationApiCommandResult> {
    const request = resolved.request;
    const policyId = requiredString(request.payload["policyId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "POLICY", policyId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    await this.authorize(resolved.actor, request, scope, policyId);
    const replay = await this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = await this.dependencies.policies.find(identity);
    const proposal = await this.dependencies.proposals.findById(request.tenantId, proposalId);
    if (current === undefined || proposal?.resourceType !== "POLICY"
      || proposal.resourceId !== policyId || !sameScope(proposal.scope, scope)) {
      throw new AdministrationApiError("NOT_FOUND");
    }
    if (proposal.status !== "PROPOSED") throw new AdministrationApiError("INVALID_STATE");
    if (current.version !== request.payload.expectedVersion || proposal.resourceVersion !== current.version) {
      throw new AdministrationApiError("VERSION_CONFLICT");
    }
    assertIndependentAdministrationApproval(resolved.actor, proposalEvidence(proposal));
    const rejected = request.operation === "REJECT_POLICY_CHANGE";
    const resultVersion = rejected ? current.version : current.version + 1;
    const decisionId = this.dependencies.idFactory();
    const decisionReference: PersistenceEvidenceReference = { type: "DECISION", id: decisionId, version: resultVersion };
    const requestEvidence = asPersistenceEvidence(request.payload.evidenceReferences);
    const combinedEvidence = Object.freeze([...requestEvidence, decisionReference]);
    const decision: AdministrationDecisionRecord = {
      decisionId, proposalId, tenantId: request.tenantId, operation: request.operation,
      resourceType: "POLICY", resourceId: policyId, scope, proposerId: proposal.proposedBy,
      decisionActorId: resolved.actor.principalId, status: rejected ? "REJECTED" : "APPROVED",
      reasonReference: reasonReference(fingerprint), evidenceReferences: combinedEvidence,
      version: resultVersion, decidedAt: this.dependencies.clock().toISOString(),
    };
    const transaction = await this.dependencies.unitOfWork.begin(identity);
    try {
      if (!rejected) transaction.policies.update(current.version, {
        ...current, status: "ACTIVE", policyReference: proposal.proposedChangeReference,
        version: resultVersion, evidenceReferences: [...current.evidenceReferences, decisionReference],
      });
      transaction.proposals.update(proposal.version, {
        ...proposal, status: rejected ? "REJECTED" : "APPROVED", version: proposal.version + 1,
        evidenceReferences: [...proposal.evidenceReferences, decisionReference],
      });
      transaction.decisions.append(decision);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, decisionId, resultVersion, rejected ? "REJECTED" : "ACTIVE", this.dependencies.clock));
      await transaction.commit();
    } catch (error) {
      if (transaction.isActive()) await transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "POLICY", resourceId: policyId,
      status: rejected ? "REJECTED" : "ACTIVE", version: resultVersion,
      decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private async authorize(
    actor: SessionContext,
    request: AdministrationApiCommandRequest,
    scope: AdministrationPersistenceScope,
    resourceId: string,
  ): Promise<void> {
    const decision = await this.dependencies.authorizationService.evaluate({
      session: actor, action: "security.admin",
      resource: {
        type: `Administration:${scope.scopeType}:${scope.scopeId}`, id: resourceId,
        tenantId: request.tenantId, ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
      },
      purpose: "ACCESS_GOVERNANCE", reason: request.payload.reason,
      requestId: request.requestId, correlationId: request.correlationId,
    });
    if (decision.effect !== "ALLOW") throw new AdministrationApiError("AUTHORIZATION_DENIED");
  }

  private async authorizeRead(
    actor: SessionContext,
    request: AdministrationApiQueryRequest,
    scope: AdministrationPersistenceScope,
    resourceId: string,
  ): Promise<void> {
    const decision = await this.dependencies.authorizationService.evaluate({
      session: actor, action: "resource.view",
      resource: {
        type: `Administration:${scope.scopeType}:${scope.scopeId}`, id: resourceId,
        tenantId: request.tenantId, ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
      },
      purpose: "ACCESS_GOVERNANCE", requestId: request.requestId, correlationId: request.correlationId,
    });
    if (decision.effect !== "ALLOW") throw new AdministrationApiError("AUTHORIZATION_DENIED");
  }

  private async replay(
    identity: AdministrationTransactionIdentity,
    idempotencyKey: string,
    operation: AdministrationApiCommandOperation,
    fingerprint: string,
  ): Promise<AdministrationApiCommandResult | undefined> {
    const stored = await this.dependencies.idempotency.find({ ...identity, idempotencyKey });
    if (stored === undefined) return undefined;
    if (stored.operation !== operation || stored.fingerprint !== fingerprint) throw new AdministrationApiError("IDEMPOTENCY_CONFLICT");
    const decision = operation.startsWith("PROPOSE_")
      ? undefined
      : requiredDecision(await this.dependencies.decisions.list(identity), stored.resultReference);
    const proposal = await this.dependencies.proposals.findById(
      identity.tenantId,
      operation.startsWith("PROPOSE_") ? stored.resultReference : decision!.proposalId,
    );
    if (proposal === undefined) throw new AdministrationApiError("INTERNAL_ERROR");
    if (operation.startsWith("PROPOSE_")) return createAdministrationCommandResult({
      operation, proposalId: proposal.proposalId, resourceType: proposal.resourceType, resourceId: proposal.resourceId,
      status: "PROPOSED", version: stored.resultVersion, decisionReferences: [],
      evidenceReferences: stored.resultEvidenceReferences ?? proposal.evidenceReferences,
    });
    return createAdministrationCommandResult({
      operation, proposalId: proposal.proposalId, resourceType: identity.resourceType,
      resourceId: identity.resourceId, status: stored.resultStatus ?? (decision!.status === "APPROVED" ? "ACTIVE" : decision!.status),
      version: stored.resultVersion, decisionReferences: [decision!.decisionId], evidenceReferences: decision!.evidenceReferences,
    });
  }
}

function isPolicyOperation(operation: AdministrationApiCommandOperation): operation is PolicyOperation {
  return operation === "PROPOSE_POLICY_CHANGE" || operation === "APPROVE_POLICY_CHANGE" || operation === "REJECT_POLICY_CHANGE";
}

function isRoleAssignmentOperation(operation: AdministrationApiCommandOperation): operation is RoleAssignmentOperation {
  return operation === "PROPOSE_ROLE_ASSIGNMENT" || operation === "APPROVE_ROLE_ASSIGNMENT"
    || operation === "REJECT_ROLE_ASSIGNMENT" || operation === "REVOKE_ROLE_ASSIGNMENT";
}

function isRoleOperation(operation: AdministrationApiCommandOperation): operation is RoleOperation {
  return operation === "PROPOSE_ROLE_CHANGE" || operation === "APPROVE_ROLE_CHANGE" || operation === "REJECT_ROLE_CHANGE";
}

function isTeamScopeOperation(operation: AdministrationApiCommandOperation): operation is TeamScopeOperation {
  return operation === "PROPOSE_TEAM_SCOPE_CHANGE" || operation === "APPROVE_TEAM_SCOPE_CHANGE"
    || operation === "REJECT_TEAM_SCOPE_CHANGE";
}

function isSourceOperation(operation: AdministrationApiCommandOperation): operation is SourceOperation {
  return operation === "PROPOSE_SOURCE_GOVERNANCE" || operation === "APPROVE_SOURCE_GOVERNANCE"
    || operation === "REJECT_SOURCE_GOVERNANCE" || operation === "TRANSITION_SOURCE_GOVERNANCE";
}

function isTargetOperation(operation: AdministrationApiCommandOperation): operation is TargetOperation {
  return operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE" || operation === "APPROVE_PUBLICATION_TARGET_GOVERNANCE"
    || operation === "REJECT_PUBLICATION_TARGET_GOVERNANCE" || operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE";
}

function transactionIdentity(tenantId: string, resourceType: AdministrationPersistenceResourceType, resourceId: string): AdministrationTransactionIdentity {
  return { tenantId, resourceType, resourceId };
}

function asPersistenceScope(scope: AdministrationScopeReference): AdministrationPersistenceScope {
  return { tenantId: scope.tenantId, scopeType: scope.scopeType, scopeId: scope.scopeId };
}

function asPersistenceEvidence(references: readonly AdministrationEvidenceReference[]): readonly PersistenceEvidenceReference[] {
  return references.map((reference) => ({ ...reference }));
}

function decisionRecord(
  proposal: AdministrationProposalRecord,
  resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>,
  decisionId: string,
  resultVersion: number,
  evidenceReferences: readonly PersistenceEvidenceReference[],
  rejected: boolean,
  fingerprint: string,
  decidedAt: string,
): AdministrationDecisionRecord {
  return {
    decisionId, proposalId: proposal.proposalId, tenantId: resolved.request.tenantId,
    operation: resolved.request.operation, resourceType: proposal.resourceType, resourceId: proposal.resourceId,
    scope: proposal.scope, proposerId: proposal.proposedBy, decisionActorId: resolved.actor.principalId,
    status: rejected ? "REJECTED" : "APPROVED", reasonReference: reasonReference(fingerprint),
    evidenceReferences, version: resultVersion, decidedAt,
  };
}

function decidedProposal(
  proposal: AdministrationProposalRecord,
  rejected: boolean,
  decisionReference: PersistenceEvidenceReference,
): AdministrationProposalRecord {
  return {
    ...proposal, status: rejected ? "REJECTED" : "APPROVED", version: proposal.version + 1,
    evidenceReferences: [...proposal.evidenceReferences, decisionReference],
  };
}

function decisionResult(
  operation: AdministrationApiCommandOperation,
  proposal: AdministrationProposalRecord,
  decisionId: string,
  resultVersion: number,
  evidenceReferences: readonly PersistenceEvidenceReference[],
  rejected: boolean,
): AdministrationApiCommandResult {
  return createAdministrationCommandResult({
    operation, proposalId: proposal.proposalId, resourceType: proposal.resourceType, resourceId: proposal.resourceId,
    status: rejected ? "REJECTED" : "ACTIVE", version: resultVersion,
    decisionReferences: [decisionId], evidenceReferences,
  });
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new AdministrationApiError("VALIDATION_FAILED");
  return value;
}

function requiredStringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new AdministrationApiError("VALIDATION_FAILED");
  const strings = value.map((item: unknown) => {
    if (typeof item !== "string" || item.length === 0) throw new AdministrationApiError("VALIDATION_FAILED");
    return item;
  });
  return Object.freeze(strings);
}

function requiredPrincipalType(value: unknown): "HUMAN" | "SERVICE" {
  if (value === "HUMAN" || value === "SERVICE") return value;
  throw new AdministrationApiError("VALIDATION_FAILED");
}

function roleAssignmentView(record: RoleAssignmentPersistenceRecord): AdministrationReadView {
  return createAdministrationReadView({
    viewType: "ROLE_ASSIGNMENT", roleAssignmentId: record.roleAssignmentId,
    subjectPrincipalReference: record.subjectPrincipalId, roleId: record.roleId, scope: record.scope,
    status: record.status, version: record.version, evidenceReferences: record.evidenceReferences,
  });
}

function decisionView(record: AdministrationDecisionRecord): AdministrationReadView {
  return createAdministrationReadView({
    viewType: "ADMINISTRATION_DECISION", decisionId: record.decisionId, proposalId: record.proposalId,
    decisionActorReference: record.decisionActorId, scope: record.scope, status: record.status,
    version: record.version, evidenceReferences: record.evidenceReferences,
  });
}

function queryPagination(value: unknown): Readonly<{ limit: number; cursor?: string }> {
  if (value === undefined) return Object.freeze({ limit: 100 });
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new AdministrationApiError("VALIDATION_FAILED");
  const pagination = value as Readonly<Record<string, unknown>>;
  const limit = pagination["limit"];
  const cursor = pagination["cursor"];
  if (!Number.isSafeInteger(limit) || (limit as number) < 1 || (limit as number) > 100
    || (cursor !== undefined && (typeof cursor !== "string" || cursor.length === 0))) {
    throw new AdministrationApiError("VALIDATION_FAILED");
  }
  return Object.freeze({ limit: limit as number, ...(cursor === undefined ? {} : { cursor }) });
}

function pagedAdministrationCollection<RecordType>(
  records: readonly RecordType[],
  pagination: Readonly<{ limit: number; cursor?: string }>,
  identity: (record: RecordType) => string,
  view: (record: RecordType) => AdministrationReadView,
): AdministrationCollectionView<AdministrationReadView> {
  const bounded = records.slice(0, pagination.limit + 1);
  const page = bounded.slice(0, pagination.limit);
  return createAdministrationCollectionView({
    items: page.map(view),
    ...(bounded.length > pagination.limit && page.length > 0
      ? { nextCursor: identity(page[page.length - 1]!) }
      : {}),
  });
}

function requiredClassification(value: unknown): "PUBLIC_APPROVED" | "INTERNAL" | "CONFIDENTIAL_BUSINESS" | "RESTRICTED_PERSONAL" | "RESTRICTED_SECURITY" {
  if (value === "PUBLIC_APPROVED" || value === "INTERNAL" || value === "CONFIDENTIAL_BUSINESS"
    || value === "RESTRICTED_PERSONAL" || value === "RESTRICTED_SECURITY") return value;
  throw new AdministrationApiError("VALIDATION_FAILED");
}

function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean {
  return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId;
}

function sameStringValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function reasonReference(fingerprint: string): string { return `reason:${fingerprint.slice(0, 24)}`; }

function deterministicCreateId(prefix: string, tenantId: string, idempotencyKey: string): string {
  return `${prefix}-${createHash("sha256").update(`${tenantId}:${idempotencyKey}`).digest("hex").slice(0, 24)}`;
}

function proposalEvidence(proposal: AdministrationProposalRecord): AdministrationProposalEvidence {
  return {
    proposalId: proposal.proposalId, proposerId: proposal.proposedBy, resourceType: proposal.resourceType,
    resourceId: proposal.resourceId, scope: proposal.scope, proposedChangeReference: proposal.proposedChangeReference,
    policyReference: proposal.policyReference, version: proposal.version,
    reasonReference: proposal.reasonReference, evidenceReferences: proposal.evidenceReferences,
  };
}

function requiredSourceTransition(value: unknown): "PAUSED" | "BLOCKED" | "RETIRED" {
  if (value === "PAUSED" || value === "BLOCKED" || value === "RETIRED") return value;
  throw new AdministrationApiError("VALIDATION_FAILED");
}

function requiredTargetTransition(value: unknown): "PAUSED" | "RETIRED" {
  if (value === "PAUSED" || value === "RETIRED") return value;
  throw new AdministrationApiError("VALIDATION_FAILED");
}

function idempotencyRecord(
  identity: AdministrationTransactionIdentity,
  request: AdministrationApiCommandRequest,
  fingerprint: string,
  resultReference: string,
  resultVersion: number,
  resultStatus: NonNullable<AdministrationIdempotencyRecord["resultStatus"]>,
  clock: () => Date,
  resultEvidenceReferences?: readonly PersistenceEvidenceReference[],
): AdministrationIdempotencyRecord {
  return { ...identity, idempotencyKey: request.payload.idempotencyKey, operation: request.operation,
    fingerprint, resultReference, resultVersion, resultStatus,
    ...(resultEvidenceReferences === undefined ? {} : { resultEvidenceReferences }),
    recordedAt: clock().toISOString() };
}

function proposalResult(operation: AdministrationApiCommandOperation, proposal: AdministrationProposalRecord): AdministrationApiCommandResult {
  return createAdministrationCommandResult({
    operation, proposalId: proposal.proposalId, resourceType: proposal.resourceType, resourceId: proposal.resourceId,
    status: "PROPOSED", version: proposal.version, decisionReferences: [], evidenceReferences: proposal.evidenceReferences,
  });
}

function requiredDecision(
  decisions: readonly AdministrationDecisionRecord[],
  decisionId: string,
): AdministrationDecisionRecord {
  const decision = decisions.find((item) => item.decisionId === decisionId);
  if (decision === undefined) throw new AdministrationApiError("INTERNAL_ERROR");
  return decision;
}
