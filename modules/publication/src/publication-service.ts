import type {
  CreatePublicationCoordinationRequest,
  PublishPublicationCoordinationRequest,
  PublicationApplicationResult,
  PublicationCoordinationResult,
  PublicationApplicationErrorResult,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";
import { mapPublicationApplicationError, PublicationApplicationError } from "./publication-application-error.js";
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
import type { PublicationOperationsObserver } from "./publication-operations-contracts.js";
import type { PublicationExecutionEligibilityPort } from "./publication-execution-eligibility.js";
import type { PublicationExecutionIntent, PublicationExecutionJournal, PublicationExecutionReceipt } from "./publication-execution-journal.js";
import type { PublicationDurableRetryEligibility } from "./publication-durable-retry.js";

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
  readonly providerIdempotencyKey: string;
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
  readonly retryEligibility?: Pick<PublicationDurableRetryEligibility, "evaluate">;
  readonly application: PublicationApplicationService;
  readonly repository: PublicationRepository;
  readonly effectiveApproval: PublicationEffectiveApprovalPort;
  readonly executionEligibility: PublicationExecutionEligibilityPort;
  readonly executionJournal: PublicationExecutionJournal;
  readonly connector: PublicationConnectorDispatcher;
  readonly unitOfWork: PublicationUnitOfWork;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
  readonly eventCoordinator: PublicationEventCoordinator;
  readonly dispatchEvidence: PublicationConnectorDispatchEvidenceStore;
  readonly operations?: PublicationOperationsObserver;
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
    return this.coordinateExecution(request, false);
  }

  public recover(request: PublishPublicationCoordinationRequest): PublicationCoordinationResult {
    return this.coordinateExecution(request, true);
  }

  private coordinateExecution(request: PublishPublicationCoordinationRequest, recoveryAuthorized: boolean): PublicationCoordinationResult {
    const { identity } = request;
    const before = this.dependencies.repository.find(identity);
    const repeatedAttempt = before?.attempts.some((attempt) => attempt.commandId === request.attempt.commandId) === true;
    const newRetry = !recoveryAuthorized && before !== undefined && before.attempts.length > 0 && !repeatedAttempt;
    const retryExecution = newRetry || (before !== undefined && before.attempts.length > 1 && repeatedAttempt
      && this.dependencies.executionJournal.findIntent(identity, request.attempt.commandId) !== undefined
      && this.dependencies.executionJournal.recoveryDisposition(identity, request.attempt.commandId).condition === "PRE_DISPATCH");
    let authorizedActorId = "";
    let approvalDecisionReference = "";
    let preparedIntent: PublicationExecutionIntent | undefined;
    let preparedDispatchInput: PublicationConnectorDispatchInput | undefined;

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
      if (before?.attempts.some((attempt) => (attempt.id === request.attempt.id || attempt.commandId === request.attempt.commandId)
        && (attempt.id !== request.attempt.id || attempt.commandId !== request.attempt.commandId))) {
        const conflict = dispatchEvidenceConflict().error;
        throw new PublicationApplicationError(conflict.code, conflict.category, conflict.message);
      }
      if (retryExecution && this.dependencies.retryEligibility?.evaluate({ ...request, expectedAggregateVersion: before.aggregateVersion }).retryEligible !== true) {
        throw new PublicationApplicationError("PUBLICATION_STATE_INVALID", "DOMAIN_REJECTION", "Publication retry is not allowed.");
      }
      const eligibility = this.dependencies.executionEligibility.evaluate({
        identity,
        context: request.context,
        authorization,
      });
      if (eligibility.status === "BLOCKED") {
        throw new PublicationApplicationError(
          eligibility.reasonCode,
          "DOMAIN_REJECTION",
          "Publication Approval is not effective.",
        );
      }
      authorizedActorId = eligibility.actorId;
      approvalDecisionReference = eligibility.approvalDecisionReference;
      const providerIdempotencyKey = providerExecutionKey(identity, request);
      preparedDispatchInput = createDispatchInput(identity, request, authorization.binding, approvalDecisionReference, providerIdempotencyKey);
      preparedIntent = immutableDomain({
        ...identity,
        commandId: request.attempt.commandId,
        attemptId: request.attempt.id,
        dispatchFingerprint: dispatchFingerprint(preparedDispatchInput),
        providerIdempotencyKey,
        preparedAt: request.command.occurredAt,
      });
    }, undefined, (transaction) => {
      if (preparedIntent === undefined) throw new PublicationApplicationError("EXECUTION_INTENT_INVALID", "INFRASTRUCTURE", "Publication execution intent is unavailable.");
      transaction.execution.prepare(preparedIntent);
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

    const dispatchInput = preparedDispatchInput ?? createDispatchInput(identity, request, current.binding, approvalDecisionReference, providerExecutionKey(identity, request));
    const dispatchFingerprintValue = dispatchFingerprint(dispatchInput);
    const disposition = this.dependencies.executionJournal.recoveryDisposition(identity, request.attempt.commandId);
    const durableReceipt = this.dependencies.executionJournal.findReceipt(identity, request.attempt.commandId);
    const priorDispatch = this.dependencies.dispatchEvidence.find(identity, request.attempt.commandId);
    if (priorDispatch !== undefined && (priorDispatch.attemptId !== request.attempt.id || priorDispatch.dispatchFingerprint !== dispatchFingerprintValue)) {
      return dispatchEvidenceConflict();
    }
    let dispatch = durableReceipt === undefined ? undefined : receiptToDispatch(durableReceipt);
    if (dispatch === undefined && disposition.condition === "RECONCILIATION_REQUIRED") {
      dispatch = immutableDomain({ outcome: "UNKNOWN" as const, evidenceRefs: [`durable-execution:${request.attempt.id}:outcome-unproven`] });
    }
    if (dispatch === undefined) {
      if (retryExecution) {
        try {
          if (this.dependencies.retryEligibility?.evaluate({ ...request, expectedAggregateVersion: current.aggregateVersion }).retryEligible !== true) {
            return mapPublicationApplicationError(new PublicationApplicationError("PUBLICATION_STATE_INVALID", "DOMAIN_REJECTION", "Publication retry is not allowed."));
          }
        } catch (error) { return mapPublicationApplicationError(error); }
      }
      const claim = this.dependencies.unitOfWork.begin(identity);
      try {
        const claimedSnapshot = claim.repository.find(identity);
        if (claimedSnapshot?.aggregateVersion !== current.aggregateVersion
          || claimedSnapshot.lifecycleState !== "EXECUTION_PENDING"
          || claimedSnapshot.suspensionStatus !== "NOT_SUSPENDED"
          || claimedSnapshot.pendingOperation?.attemptId !== request.attempt.id
          || !claimedSnapshot.attempts.some(attempt => attempt.id === request.attempt.id && attempt.commandId === request.attempt.commandId)) {
          claim.rollback();
          return mapPublicationApplicationError(new PublicationApplicationError("PUBLICATION_VERSION_CONFLICT", "CONFLICT", "Publication changed before dispatch."));
        }
        const claimed = claim.execution.markDispatchStarted(identity, request.attempt.commandId, this.dependencies.clock.now());
        claim.commit();
        if (claimed === "ALREADY_STARTED") {
          const authoritative = this.dependencies.executionJournal.findReceipt(identity, request.attempt.commandId);
          dispatch = authoritative === undefined
            ? immutableDomain({ outcome: "UNKNOWN" as const, evidenceRefs: [`durable-execution:${request.attempt.id}:outcome-unproven`] })
            : receiptToDispatch(authoritative);
        }
      } catch {
        try { claim.rollback(); } catch { /* preserve original safe failure */ }
        return connectorFailure("CONNECTOR_OUTCOME_UNKNOWN");
      }
      if (dispatch === undefined) {
        try {
          dispatch = normalizeConnectorResult(this.dependencies.connector.dispatch(dispatchInput), request.attempt.id);
        } catch (error) {
          dispatch = immutableDomain({
            outcome: "UNKNOWN" as const,
            evidenceRefs: [`connector-observation:${request.attempt.id}:${safeConnectorFailureCategory(error)}`],
          });
        }
      }
      this.dependencies.dispatchEvidence.record({ ...identity, commandId: request.attempt.commandId, attemptId: request.attempt.id, dispatchFingerprint: dispatchFingerprintValue, result: dispatch });
    }
    safelyObserve(this.dependencies.operations, { component: "CONNECTOR_ATTEMPT", result: dispatch.outcome === "CONFIRMED" ? "COMPLETED" : "FAILED", ...(dispatch.outcome === "CONFIRMED" ? {} : { failureCode: dispatch.outcome === "REJECTED" ? "CONNECTOR_REJECTED" : "CONNECTOR_OUTCOME_UNKNOWN" }), sourceReference: request.attempt.id, correlationId: request.command.correlationId, actorOrServiceReference: authorizedActorId });

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
      transaction.execution.appendReceipt({
        ...identity,
        receiptId: `${identity.publicationId}:receipt:${request.attempt.id}`,
        commandId: request.attempt.commandId,
        attemptId: request.attempt.id,
        outcome: dispatch.outcome === "CONFIRMED" ? "CONFIRMED" : dispatch.outcome === "REJECTED" ? "NO_EFFECT" : "UNKNOWN",
        evidenceRefs: dispatch.evidenceRefs,
        recordedAt: request.command.occurredAt,
        ...(dispatch.externalObjectReference === undefined ? {} : { externalObjectReference: dispatch.externalObjectReference }),
      });
      const events = this.dependencies.eventCoordinator.appendAcceptedTransition(transaction, snapshot, updated, {
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
      this.dependencies.eventCoordinator.observeCommitted(events, actorId);
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

function createDispatchInput(identity: PublicationIdentity, request: PublishPublicationCoordinationRequest, binding: PublicationBinding, approvalDecisionReference: string, providerIdempotencyKey: string): PublicationConnectorDispatchInput {
  return immutableDomain({ publicationId: identity.publicationId, tenantScopeId: identity.tenantScopeId, commandId: request.attempt.commandId, attemptId: request.attempt.id, targetId: binding.targetId, targetVersion: binding.targetVersion, channelId: binding.channelId, channelPolicyVersion: binding.channelPolicyVersion, representationId: binding.representationId, representationVersion: binding.representationVersion, representationChecksum: binding.representationChecksum, approvalDecisionReference, providerIdempotencyKey });
}

function providerExecutionKey(identity: PublicationIdentity, request: PublishPublicationCoordinationRequest): string {
  return `publication:${identity.tenantScopeId}:${identity.publicationId}:${request.attempt.commandId}:${request.attempt.id}`;
}

function dispatchFingerprint(input: PublicationConnectorDispatchInput): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

function receiptToDispatch(receipt: PublicationExecutionReceipt): PublicationConnectorDispatchResult {
  return immutableDomain({ outcome: receipt.outcome === "NO_EFFECT" ? "REJECTED" as const : receipt.outcome, evidenceRefs: receipt.evidenceRefs, ...(receipt.externalObjectReference === undefined ? {} : { externalObjectReference: receipt.externalObjectReference }) });
}

function safelyObserve(observer: PublicationOperationsObserver | undefined, observation: Parameters<PublicationOperationsObserver["observe"]>[0]): void {
  try { observer?.observe(observation); } catch { /* Observability cannot alter connector coordination semantics. */ }
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
  const invalid = (): PublicationConnectorDispatchResult => immutableDomain({ outcome: "UNKNOWN" as const, evidenceRefs: [`connector-observation:${attemptId}:invalid-result`] });
  if (result === null || typeof result !== "object") return invalid();
  const outcome: unknown = Object.getOwnPropertyDescriptor(result, "outcome")?.value;
  const references: unknown = Object.getOwnPropertyDescriptor(result, "evidenceRefs")?.value;
  const externalObjectReference: unknown = Object.getOwnPropertyDescriptor(result, "externalObjectReference")?.value;
  if (!Array.isArray(references)) return invalid();
  const count: unknown = Object.getOwnPropertyDescriptor(references, "length")?.value;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 1 || count > 64) return invalid();
  const evidenceRefs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const reference: unknown = Object.getOwnPropertyDescriptor(references, String(index))?.value;
    if (!isSafeProviderReference(reference)) return invalid();
    evidenceRefs.push(reference);
  }
  if (outcome === "CONFIRMED" && isSafeProviderReference(externalObjectReference)) {
    return immutableDomain({ outcome, evidenceRefs, externalObjectReference });
  }
  if ((outcome === "REJECTED" || outcome === "UNKNOWN") && externalObjectReference === undefined) {
    return immutableDomain({ outcome, evidenceRefs });
  }
  return invalid();
}

function isSafeProviderReference(value: unknown): value is string {
  return typeof value === "string"
    && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u.test(value)
    && !/(?:authorization|bearer|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key)/iu.test(value);
}

function safeConnectorFailureCategory(error: unknown): "timeout" | "connection-failure" | "unavailable" {
  try {
    if (error !== null && typeof error === "object") {
      const code: unknown = Object.getOwnPropertyDescriptor(error, "code")?.value;
      if (code === "ETIMEDOUT") return "timeout";
      if (code === "ECONNRESET" || code === "ECONNREFUSED") return "connection-failure";
    }
  } catch { /* Provider objects cannot expose exception details through classification. */ }
  return "unavailable";
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
