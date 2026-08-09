import type {
  CreatePublicationCoordinationRequest,
  PublishPublicationCoordinationRequest,
  PublicationApplicationResult,
  PublicationCoordinationResult,
  PublicationApplicationErrorResult,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import { PublicationApplicationError } from "./publication-application-error.js";
import type { PublicationApplicationService } from "./publication-application-service.js";
import { PublicationAggregate } from "./publication-aggregate.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationBinding, type PublicationIdentity } from "./publication-contracts.js";
import type { PublicationRepository } from "./publication-repository.js";
import type { PublicationUnitOfWork } from "./publication-unit-of-work.js";
import type { PublicationEventCoordinator } from "./publication-event-coordinator.js";
import { PublicationEventError, safePublicationEventErrorCode } from "./publication-event-error.js";
import type { PublicationConnectorDispatchEvidenceStore } from "./publication-connector-dispatch-evidence-store.js";
import { createHash } from "node:crypto";

export interface PublicationEffectiveApprovalCheckInput extends PublicationBinding {
  readonly actorId: string;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly tenantScopeId: string;
  readonly purpose: "PUBLICATION_EXECUTION";
  readonly consumerDuty: "EXECUTION";
}

export type PublicationEffectiveApprovalDecision = Readonly<{
  readonly effective: true;
  readonly decisionReference: string;
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly checkedAt: string;
  readonly effectiveScope: Readonly<{ readonly targetId: string; readonly channelId: string }>;
  readonly reasonCodes: readonly string[];
}> | Readonly<{
  readonly effective: false;
  readonly reasonCodes?: readonly string[];
}>;

export interface PublicationEffectiveApprovalPort {
  check(input: PublicationEffectiveApprovalCheckInput): PublicationEffectiveApprovalDecision;
}

export type PublicationConnectorOutcome = "CONFIRMED" | "REJECTED" | "UNKNOWN";

export interface PublicationConnectorDispatchInput {
  readonly publicationId: string;
  readonly tenantScopeId: string;
  readonly commandId: string;
  readonly attemptId: string;
  readonly targetId: string;
  readonly targetVersion: number;
  readonly channelId: string;
  readonly channelPolicyVersion: string;
  readonly representationId: string;
  readonly representationVersion: number;
  readonly representationChecksum: string;
  readonly approvalDecisionReference: string;
}

export interface PublicationConnectorDispatchResult {
  readonly outcome: PublicationConnectorOutcome;
  readonly evidenceRefs: readonly string[];
  readonly externalObjectReference?: string;
}

export interface PublicationConnectorDispatcher {
  dispatch(input: PublicationConnectorDispatchInput): PublicationConnectorDispatchResult;
}

export interface PublicationCoordinationDependencies {
  readonly application: PublicationApplicationService;
  readonly repository: PublicationRepository;
  readonly effectiveApproval: PublicationEffectiveApprovalPort;
  readonly connector: PublicationConnectorDispatcher;
  readonly unitOfWork: PublicationUnitOfWork;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
  readonly eventCoordinator: PublicationEventCoordinator;
  readonly dispatchEvidence: PublicationConnectorDispatchEvidenceStore;
}

export class PublicationCoordinationService {
  public constructor(private readonly dependencies: PublicationCoordinationDependencies) {}

  public create(request: CreatePublicationCoordinationRequest): PublicationApplicationResult {
    const identity = request.command.input.identity;
    const command = immutableDomain({
      ...request.command,
      input: {
        ...request.command.input,
        prerequisites: { ...request.command.input.prerequisites, effectiveApproval: true as const },
      },
    });
    return this.dependencies.application.executeAuthorized(
      command,
      stageContext(request.context, "create"),
      (authorization) => { requireEffectivePublicationApproval(this.dependencies.effectiveApproval, identity, request.context, authorization.actorId, authorization.binding); },
    );
  }

  public publish(request: PublishPublicationCoordinationRequest): PublicationCoordinationResult {
    const { identity } = request;
    const before = this.dependencies.repository.find(identity);
    const repeatedAttempt = before?.attempts.some((attempt) => attempt.commandId === request.attempt.commandId) === true;
    let authorizedActorId = "";
    let approvalDecisionReference = "";

    const beginResult = this.dependencies.application.executeAuthorized({
      kind: "MODIFY_PUBLICATION",
      identity,
      input: {
        type: "BEGIN_INITIAL_EXECUTION",
        expectedAggregateVersion: repeatedAttempt && before !== undefined ? before.aggregateVersion : request.expectedAggregateVersion,
        attempt: request.attempt,
        command: request.command,
      },
    }, stageContext(request.context, "publish"), (authorization) => {
      authorizedActorId = authorization.actorId;
      approvalDecisionReference = requireEffectivePublicationApproval(this.dependencies.effectiveApproval, identity, request.context, authorization.actorId, authorization.binding).decisionReference;
    });
    if (!beginResult.ok) return beginResult;

    const current = this.dependencies.repository.find(identity);
    if (current === undefined) {
      return Object.freeze({
        ok: false as const,
        error: Object.freeze({ code: "PUBLICATION_NOT_FOUND", category: "NOT_FOUND" as const, message: "Publication was not found." }),
      });
    }
    const priorAttempt = current?.attempts.find((attempt) => attempt.commandId === request.attempt.commandId);
    if (current?.lifecycleState === "ACTIVE" && priorAttempt?.outcome === "CONFIRMED") {
      return immutableDomain({
        ok: true as const,
        publicationId: identity.publicationId,
        aggregateVersion: current.aggregateVersion,
        lifecycleState: "ACTIVE" as const,
        connectorOutcome: "CONFIRMED" as const,
        replayed: true,
      });
    }
    if (priorAttempt?.outcome === "NO_EFFECT") return connectorFailure("CONNECTOR_REJECTED");
    if (priorAttempt?.outcome === "UNKNOWN") return connectorFailure("CONNECTOR_OUTCOME_UNKNOWN");

    const dispatchInput = immutableDomain({
      publicationId: identity.publicationId,
      tenantScopeId: identity.tenantScopeId,
      commandId: request.attempt.commandId,
      attemptId: request.attempt.id,
      targetId: current.binding.targetId,
      targetVersion: current.binding.targetVersion,
      channelId: current.binding.channelId,
      channelPolicyVersion: current.binding.channelPolicyVersion,
      representationId: current.binding.representationId,
      representationVersion: current.binding.representationVersion,
      representationChecksum: current.binding.representationChecksum,
      approvalDecisionReference,
    });
    const dispatchFingerprint = `sha256:${createHash("sha256").update(JSON.stringify(dispatchInput)).digest("hex")}`;
    const priorDispatch = this.dependencies.dispatchEvidence.find(identity, request.attempt.commandId);
    if (priorDispatch !== undefined && (priorDispatch.attemptId !== request.attempt.id || priorDispatch.dispatchFingerprint !== dispatchFingerprint)) {
      return dispatchEvidenceConflict();
    }
    let dispatch = priorDispatch?.result;
    if (dispatch === undefined) {
      try {
        dispatch = normalizeConnectorResult(this.dependencies.connector.dispatch(dispatchInput), request.attempt.id);
      } catch {
        dispatch = immutableDomain({
          outcome: "UNKNOWN" as const,
          evidenceRefs: [`connector-observation:${request.attempt.id}:unavailable`],
        });
      }
      this.dependencies.dispatchEvidence.record({ ...identity, commandId: request.attempt.commandId, attemptId: request.attempt.id, dispatchFingerprint, result: dispatch });
    }

    const resolveResult = this.recordConnectorOutcome(identity, request, dispatch, authorizedActorId);
    if (!resolveResult.ok) return resolveResult;
    if (dispatch.outcome !== "CONFIRMED") {
      return connectorFailure(dispatch.outcome === "REJECTED" ? "CONNECTOR_REJECTED" : "CONNECTOR_OUTCOME_UNKNOWN");
    }
    return immutableDomain({
      ok: true as const,
      publicationId: identity.publicationId,
      aggregateVersion: resolveResult.aggregateVersion,
      lifecycleState: "ACTIVE" as const,
      connectorOutcome: "CONFIRMED" as const,
      replayed: beginResult.replayed || resolveResult.replayed,
    });
  }

  private recordConnectorOutcome(
    identity: PublicationIdentity,
    request: PublishPublicationCoordinationRequest,
    dispatch: PublicationConnectorDispatchResult,
    actorId: string,
  ): PublicationApplicationResult {
    let transaction;
    try {
      transaction = this.dependencies.unitOfWork.begin(identity);
      const snapshot = transaction.repository.find(identity);
      if (snapshot === undefined) throw new PublicationApplicationError("PUBLICATION_NOT_FOUND", "NOT_FOUND", "Publication was not found.");
      const domainCommand = {
        type: "RESOLVE_EXECUTION",
        expectedAggregateVersion: snapshot.aggregateVersion,
        outcome: dispatch.outcome === "CONFIRMED" ? "EFFECT_CONFIRMED" : dispatch.outcome === "REJECTED" ? "NO_EFFECT_CONFIRMED" : "UNKNOWN",
        evidenceRefs: dispatch.evidenceRefs,
        ...(dispatch.externalObjectReference === undefined ? {} : { externalObjectReference: dispatch.externalObjectReference }),
        ...(dispatch.outcome === "UNKNOWN" ? { reconciliationCaseId: `${identity.publicationId}:reconciliation:${request.attempt.id}` } : {}),
        command: { ...request.command, actorId },
      } as const;
      const updated = PublicationAggregate.rehydrate(snapshot).resolveExecution(domainCommand).snapshot;
      transaction.repository.update(snapshot.aggregateVersion, updated);
      this.dependencies.eventCoordinator.appendAcceptedTransition(transaction, snapshot, updated, {
        kind: "MODIFY_PUBLICATION",
        identity,
        input: domainCommand,
      });
      const activationContext = stageContext(request.context, "activation");
      transaction.audit.append({
        id: JSON.stringify([identity.tenantScopeId, identity.publicationId, activationContext.idempotencyKey, activationContext.intentFingerprint, "RESOLVE_EXECUTION", updated.aggregateVersion]),
        tenantScopeId: identity.tenantScopeId,
        aggregateId: identity.publicationId,
        command: "RESOLVE_EXECUTION",
        actorId,
        timestamp: this.dependencies.clock.now(),
        version: updated.aggregateVersion,
        result: "COMPLETED",
      });
      const resultReference = `${identity.publicationId}@${String(updated.aggregateVersion)}`;
      transaction.idempotency.record({
        tenantScopeId: identity.tenantScopeId,
        aggregateId: identity.publicationId,
        commandKey: activationContext.idempotencyKey,
        fingerprint: activationContext.intentFingerprint,
        resultReference,
        recordedAt: this.dependencies.clock.now(),
      });
      transaction.commit();
      return immutableDomain({ ok: true as const, publicationId: identity.publicationId, aggregateVersion: updated.aggregateVersion, resultReference, replayed: false });
    } catch (error) {
      try { transaction?.rollback(); } catch { /* The transaction may already be closed by a commit conflict. */ }
      try {
        const currentVersion = this.dependencies.repository.find(identity)?.aggregateVersion ?? request.expectedAggregateVersion;
        const eventFailure = error instanceof PublicationEventError ? error : undefined;
        const safeReason = eventFailure === undefined ? `CONNECTOR_OUTCOME_PERSISTENCE_FAILED:${dispatch.outcome}` : safePublicationEventErrorCode(eventFailure);
        this.dependencies.audit.append({
          id: JSON.stringify([identity.tenantScopeId, identity.publicationId, request.attempt.id, request.attempt.commandId, safeReason, dispatch.outcome]),
          tenantScopeId: identity.tenantScopeId,
          aggregateId: identity.publicationId,
          command: "RECORD_CONNECTOR_OUTCOME",
          actorId,
          timestamp: this.dependencies.clock.now(),
          version: currentVersion,
          result: "FAILED",
          failureReason: safeReason,
          ...(eventFailure?.evidence === undefined ? {} : {
            correlationId: eventFailure.evidence.correlationId,
            eventId: eventFailure.evidence.eventId,
            eventType: eventFailure.evidence.eventType,
            eventSequence: eventFailure.evidence.eventSequence,
            safeReasonCode: safePublicationEventErrorCode(eventFailure),
          }),
        });
      } catch {
        // Failure evidence is best effort and must never replace the safe application error.
      }
      return Object.freeze({
        ok: false as const,
        error: Object.freeze({
          code: error instanceof PublicationApplicationError ? error.code : error instanceof PublicationEventError ? safePublicationEventErrorCode(error) : "CONNECTOR_OUTCOME_PERSISTENCE_FAILED",
          category: error instanceof PublicationApplicationError ? error.category : "INFRASTRUCTURE" as const,
          message: "Publication connector outcome could not be recorded.",
        }),
      });
    }
  }

}

export function requireEffectivePublicationApproval(
  effectiveApproval: PublicationEffectiveApprovalPort,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  actorId: string,
  binding: PublicationBinding,
): Extract<PublicationEffectiveApprovalDecision, { readonly effective: true }> {
  let decision: PublicationEffectiveApprovalDecision;
  try {
    decision = effectiveApproval.check({
      ...binding,
      actorId,
      sessionId: context.sessionId ?? "",
      correlationId: context.correlationId,
      tenantScopeId: identity.tenantScopeId,
      purpose: "PUBLICATION_EXECUTION",
      consumerDuty: "EXECUTION",
    });
  } catch {
    throw new PublicationApplicationError("APPROVAL_NOT_EFFECTIVE", "DOMAIN_REJECTION", "Publication Approval is not effective.");
  }
  if (decision.effective !== true || decision.decisionReference.trim().length === 0
    || decision.checkedAt.trim().length === 0 || decision.reasonCodes.length === 0
    || decision.approvalId !== binding.approvalId
    || decision.approvalVersion !== binding.approvalVersion
    || decision.effectiveScope.targetId !== binding.targetId
    || decision.effectiveScope.channelId !== binding.channelId) {
    throw new PublicationApplicationError("APPROVAL_NOT_EFFECTIVE", "DOMAIN_REJECTION", "Publication Approval is not effective.");
  }
  return decision;
}

function normalizeConnectorResult(result: PublicationConnectorDispatchResult, attemptId: string): PublicationConnectorDispatchResult {
  const evidenceValid = Array.isArray(result.evidenceRefs)
    && result.evidenceRefs.length > 0
    && result.evidenceRefs.every((reference) => typeof reference === "string" && reference.trim().length > 0);
  const externalReferenceValid = typeof result.externalObjectReference === "string" && result.externalObjectReference.trim().length > 0;
  if (evidenceValid && result.outcome === "CONFIRMED" && externalReferenceValid) return immutableDomain(result);
  if (evidenceValid && result.outcome === "REJECTED" && result.externalObjectReference === undefined) return immutableDomain(result);
  if (evidenceValid && result.outcome === "UNKNOWN" && result.externalObjectReference === undefined) return immutableDomain(result);
  return immutableDomain({ outcome: "UNKNOWN" as const, evidenceRefs: [`connector-observation:${attemptId}:invalid-result`] });
}

function connectorFailure(code: "CONNECTOR_REJECTED" | "CONNECTOR_OUTCOME_UNKNOWN"): PublicationApplicationErrorResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code,
      category: "DOMAIN_REJECTION" as const,
      message: "Publication external effect was not confirmed.",
    }),
  });
}

function dispatchEvidenceConflict(): PublicationApplicationErrorResult {
  return Object.freeze({
    ok: false as const,
    error: Object.freeze({
      code: "DISPATCH_EVIDENCE_IDENTITY_CONFLICT",
      category: "CONFLICT" as const,
      message: "Publication connector dispatch identity conflicts with prior evidence.",
    }),
  });
}

export const unavailablePublicationEffectiveApprovalPort: PublicationEffectiveApprovalPort = Object.freeze({
  check(): PublicationEffectiveApprovalDecision {
    return Object.freeze({ effective: false });
  },
});

export const unavailablePublicationConnectorDispatcher: PublicationConnectorDispatcher = Object.freeze({
  dispatch(): never {
    throw new PublicationApplicationError("CONNECTOR_UNAVAILABLE", "INFRASTRUCTURE", "Publication connector is unavailable.");
  },
});

function stageContext(context: PublicationExecutionContext, stage: "create" | "publish" | "activation"): PublicationExecutionContext {
  return immutableDomain({
    ...context,
    idempotencyKey: `${context.idempotencyKey}:${stage}`,
    intentFingerprint: `${context.intentFingerprint}:${stage}`,
  });
}
