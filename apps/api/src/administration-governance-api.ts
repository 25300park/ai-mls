import { createHash } from "node:crypto";

import type { IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { LiveAdministrationAuthorizationService } from "../../../modules/administration/src/live-assignment-adapter.js";
import type {
  AdministrationDecisionReadRepository,
  AdministrationDecisionRecord,
  AdministrationEvidenceReference as PersistenceEvidenceReference,
  AdministrationIdempotencyReadRepository,
  AdministrationIdempotencyRecord,
  AdministrationPersistenceResourceType,
  AdministrationPersistenceScope,
  AdministrationProposalReadRepository,
  AdministrationProposalRecord,
  AdministrationTransactionIdentity,
  AdministrationUnitOfWork,
  PolicyReadRepository,
  PublicationTargetReadRepository,
  SourceGovernanceReadRepository,
} from "../../../modules/administration/src/administration-persistence.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import {
  AdministrationApiError,
  assertIndependentAdministrationApproval,
  createAdministrationCommandFingerprint,
  createAdministrationCommandResult,
  createAdministrationReadView,
  parseAdministrationApiRequest,
  resolveAdministrationApiSession,
  type AdministrationApiCommandOperation,
  type AdministrationApiCommandRequest,
  type AdministrationApiCommandResult,
  type AdministrationApiQueryRequest,
  type AdministrationEvidenceReference,
  type AdministrationReadView,
  type AdministrationProposalEvidence,
  type AdministrationScopeReference,
  type AdministrationSessionResolver,
  type ResolvedAdministrationApiRequest,
} from "./administration-api-contracts.js";

interface AdministrationGovernanceApplicationDependencies {
  readonly authorizationService: LiveAdministrationAuthorizationService;
  readonly unitOfWork: AdministrationUnitOfWork;
  readonly policies: PolicyReadRepository;
  readonly sourceGovernance: SourceGovernanceReadRepository;
  readonly publicationTargets: PublicationTargetReadRepository;
  readonly proposals: AdministrationProposalReadRepository;
  readonly decisions: AdministrationDecisionReadRepository;
  readonly idempotency: AdministrationIdempotencyReadRepository;
  readonly sessionResolver: AdministrationSessionResolver;
  readonly clock: () => Date;
  readonly idFactory: IdFactory;
}

type PolicyOperation = "PROPOSE_POLICY_CHANGE" | "APPROVE_POLICY_CHANGE" | "REJECT_POLICY_CHANGE";
type SourceOperation = "PROPOSE_SOURCE_GOVERNANCE" | "APPROVE_SOURCE_GOVERNANCE" | "REJECT_SOURCE_GOVERNANCE" | "TRANSITION_SOURCE_GOVERNANCE";
type TargetOperation = "PROPOSE_PUBLICATION_TARGET_GOVERNANCE" | "APPROVE_PUBLICATION_TARGET_GOVERNANCE" | "REJECT_PUBLICATION_TARGET_GOVERNANCE" | "TRANSITION_PUBLICATION_TARGET_GOVERNANCE";

export class AdministrationGovernanceApplication {
  public constructor(private readonly dependencies: AdministrationGovernanceApplicationDependencies) {}

  public execute(input: unknown): AdministrationApiCommandResult {
    const request = parseAdministrationApiRequest(input);
    if (request.kind !== "COMMAND") throw new AdministrationApiError("VALIDATION_FAILED");
    const resolved = resolveAdministrationApiSession(request, this.dependencies.sessionResolver, this.dependencies.clock);
    try {
      if (isPolicyOperation(request.operation)) return request.operation === "PROPOSE_POLICY_CHANGE"
        ? this.proposePolicy(resolved) : this.decidePolicy(resolved);
      if (isSourceOperation(request.operation)) return request.operation === "PROPOSE_SOURCE_GOVERNANCE"
        ? this.proposeSource(resolved) : this.decideSource(resolved);
      if (isTargetOperation(request.operation)) return request.operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE"
        ? this.proposeTarget(resolved) : this.decideTarget(resolved);
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

  public read(input: unknown): AdministrationReadView {
    const request = parseAdministrationApiRequest(input);
    if (request.kind !== "QUERY") throw new AdministrationApiError("VALIDATION_FAILED");
    const resolved = resolveAdministrationApiSession(request, this.dependencies.sessionResolver, this.dependencies.clock);
    const scope = asPersistenceScope(request.payload.scope);
    if (request.operation === "READ_POLICY") {
      const resourceId = requiredString(request.payload["policyId"]);
      this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = this.dependencies.policies.find(transactionIdentity(request.tenantId, "POLICY", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "POLICY", policyId: resourceId, scope: record.scope, status: record.status,
        version: record.version, evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_SOURCE_GOVERNANCE") {
      const resourceId = requiredString(request.payload["sourceRegistryEntryId"]);
      this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = this.dependencies.sourceGovernance.find(transactionIdentity(request.tenantId, "SOURCE_REGISTRY", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "SOURCE_GOVERNANCE", sourceRegistryEntryId: resourceId, scope: record.scope,
        status: record.status, version: record.version, policyReference: record.policyReference,
        evidenceReferences: record.evidenceReferences,
      });
    }
    if (request.operation === "READ_PUBLICATION_TARGET_GOVERNANCE") {
      const resourceId = requiredString(request.payload["publicationTargetId"]);
      this.authorizeRead(resolved.actor, request, scope, resourceId);
      const record = this.dependencies.publicationTargets.find(transactionIdentity(request.tenantId, "PUBLICATION_TARGET", resourceId));
      if (record === undefined || !sameScope(record.scope, scope)) throw new AdministrationApiError("NOT_FOUND");
      return createAdministrationReadView({
        viewType: "PUBLICATION_TARGET_GOVERNANCE", publicationTargetId: resourceId, scope: record.scope,
        status: record.status, version: record.version, policyReference: record.policyReference,
        channelReference: record.channelReference, evidenceReferences: record.evidenceReferences,
      });
    }
    throw new AdministrationApiError("VALIDATION_FAILED");
  }

  private proposeTarget(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const requestedTargetId = request.payload["publicationTargetId"];
    const targetId = typeof requestedTargetId === "string"
      ? requestedTargetId
      : deterministicCreateId("target", request.tenantId, request.payload.idempotencyKey);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "PUBLICATION_TARGET", targetId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, targetId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.publicationTargets.find(identity);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.publicationTargets.save({
          recordType: "PUBLICATION_TARGET", tenantId: request.tenantId, publicationTargetId: targetId,
          scope, status: "PROPOSED", version: 1, policyReference, ...publicationTargetGovernanceChange,
          evidenceReferences: evidence,
        });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private decideTarget(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const targetId = requiredString(request.payload["publicationTargetId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "PUBLICATION_TARGET", targetId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, targetId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.publicationTargets.find(identity);
    const proposal = this.dependencies.proposals.findById(request.tenantId, proposalId);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
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
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "PUBLICATION_TARGET", resourceId: targetId,
      status, version: resultVersion, decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private proposeSource(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const requestedSourceId = request.payload["sourceRegistryEntryId"];
    const sourceId = typeof requestedSourceId === "string"
      ? requestedSourceId
      : deterministicCreateId("source", request.tenantId, request.payload.idempotencyKey);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "SOURCE_REGISTRY", sourceId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, sourceId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.sourceGovernance.find(identity);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.sourceGovernance.save({
          recordType: "SOURCE_REGISTRY", tenantId: request.tenantId, sourceRegistryEntryId: sourceId,
          scope, status: "DRAFT", version: 1, policyReference, ...sourceGovernanceChange,
          evidenceReferences: evidence,
        });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private decideSource(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const sourceId = requiredString(request.payload["sourceRegistryEntryId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "SOURCE_REGISTRY", sourceId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, sourceId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.sourceGovernance.find(identity);
    const proposal = this.dependencies.proposals.findById(request.tenantId, proposalId);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
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
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "SOURCE_REGISTRY", resourceId: sourceId,
      status, version: resultVersion, decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private proposePolicy(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const policyId = requiredString(request.payload["policyId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "POLICY", policyId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, policyId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.policies.find(identity);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
    try {
      if (current === undefined) transaction.policies.save({
        recordType: "POLICY", tenantId: request.tenantId, policyId, scope, status: "PROPOSED",
        policyReference: proposal.policyReference, version: 1, evidenceReferences: evidence,
      });
      transaction.proposals.save(proposal);
      transaction.idempotency.record(idempotencyRecord(identity, request, fingerprint, proposalId, 1, "PROPOSED", this.dependencies.clock, evidence));
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return proposalResult(request.operation, proposal);
  }

  private decidePolicy(resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>): AdministrationApiCommandResult {
    const request = resolved.request;
    const policyId = requiredString(request.payload["policyId"]);
    const proposalId = requiredString(request.payload["proposalId"]);
    const scope = asPersistenceScope(request.payload.scope);
    const identity = transactionIdentity(request.tenantId, "POLICY", policyId);
    const fingerprint = createAdministrationCommandFingerprint(request);
    this.authorize(resolved.actor, request, scope, policyId);
    const replay = this.replay(identity, request.payload.idempotencyKey, request.operation, fingerprint);
    if (replay !== undefined) return replay;
    const current = this.dependencies.policies.find(identity);
    const proposal = this.dependencies.proposals.findById(request.tenantId, proposalId);
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
    const transaction = this.dependencies.unitOfWork.begin(identity);
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
      transaction.commit();
    } catch (error) {
      if (transaction.isActive()) transaction.rollback();
      throw error;
    }
    return createAdministrationCommandResult({
      operation: request.operation, proposalId, resourceType: "POLICY", resourceId: policyId,
      status: rejected ? "REJECTED" : "ACTIVE", version: resultVersion,
      decisionReferences: [decisionId], evidenceReferences: combinedEvidence,
    });
  }

  private authorize(
    actor: SessionContext,
    request: AdministrationApiCommandRequest,
    scope: AdministrationPersistenceScope,
    resourceId: string,
  ): void {
    const decision = this.dependencies.authorizationService.evaluate({
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

  private authorizeRead(
    actor: SessionContext,
    request: AdministrationApiQueryRequest,
    scope: AdministrationPersistenceScope,
    resourceId: string,
  ): void {
    const decision = this.dependencies.authorizationService.evaluate({
      session: actor, action: "resource.view",
      resource: {
        type: `Administration:${scope.scopeType}:${scope.scopeId}`, id: resourceId,
        tenantId: request.tenantId, ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }),
      },
      purpose: "ACCESS_GOVERNANCE", requestId: request.requestId, correlationId: request.correlationId,
    });
    if (decision.effect !== "ALLOW") throw new AdministrationApiError("AUTHORIZATION_DENIED");
  }

  private replay(
    identity: AdministrationTransactionIdentity,
    idempotencyKey: string,
    operation: AdministrationApiCommandOperation,
    fingerprint: string,
  ): AdministrationApiCommandResult | undefined {
    const stored = this.dependencies.idempotency.find({ ...identity, idempotencyKey });
    if (stored === undefined) return undefined;
    if (stored.operation !== operation || stored.fingerprint !== fingerprint) throw new AdministrationApiError("IDEMPOTENCY_CONFLICT");
    const proposal = operation.startsWith("PROPOSE_")
      ? this.dependencies.proposals.findById(identity.tenantId, stored.resultReference)
      : this.dependencies.proposals.findById(identity.tenantId, requiredDecision(this.dependencies.decisions, identity, stored.resultReference).proposalId);
    if (proposal === undefined) throw new AdministrationApiError("INTERNAL_ERROR");
    if (operation.startsWith("PROPOSE_")) return createAdministrationCommandResult({
      operation, proposalId: proposal.proposalId, resourceType: proposal.resourceType, resourceId: proposal.resourceId,
      status: "PROPOSED", version: stored.resultVersion, decisionReferences: [],
      evidenceReferences: stored.resultEvidenceReferences ?? proposal.evidenceReferences,
    });
    const decision = requiredDecision(this.dependencies.decisions, identity, stored.resultReference);
    return createAdministrationCommandResult({
      operation, proposalId: proposal.proposalId, resourceType: identity.resourceType,
      resourceId: identity.resourceId, status: stored.resultStatus ?? (decision.status === "APPROVED" ? "ACTIVE" : decision.status),
      version: stored.resultVersion, decisionReferences: [decision.decisionId], evidenceReferences: decision.evidenceReferences,
    });
  }
}

function isPolicyOperation(operation: AdministrationApiCommandOperation): operation is PolicyOperation {
  return operation === "PROPOSE_POLICY_CHANGE" || operation === "APPROVE_POLICY_CHANGE" || operation === "REJECT_POLICY_CHANGE";
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

function requiredClassification(value: unknown): "PUBLIC_APPROVED" | "INTERNAL" | "CONFIDENTIAL_BUSINESS" | "RESTRICTED_PERSONAL" | "RESTRICTED_SECURITY" {
  if (value === "PUBLIC_APPROVED" || value === "INTERNAL" || value === "CONFIDENTIAL_BUSINESS"
    || value === "RESTRICTED_PERSONAL" || value === "RESTRICTED_SECURITY") return value;
  throw new AdministrationApiError("VALIDATION_FAILED");
}

function sameScope(left: AdministrationPersistenceScope, right: AdministrationPersistenceScope): boolean {
  return left.tenantId === right.tenantId && left.scopeType === right.scopeType && left.scopeId === right.scopeId;
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
  decisions: AdministrationDecisionReadRepository,
  identity: AdministrationTransactionIdentity,
  decisionId: string,
): AdministrationDecisionRecord {
  const decision = decisions.list(identity).find((item) => item.decisionId === decisionId);
  if (decision === undefined) throw new AdministrationApiError("INTERNAL_ERROR");
  return decision;
}
