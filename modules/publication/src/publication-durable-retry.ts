import { createHash } from "node:crypto";
import type { PublishPublicationCoordinationRequest } from "./publication-application-contracts.js";
import { PublicationAuthorizationError, type PublicationAuthorizationGuard } from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationBinding, type PublicationIdentity } from "./publication-contracts.js";
import { classifyPublicationExecutionFailure } from "./publication-execution-failure.js";
import { PublicationExecutionEligibilityGate } from "./publication-execution-eligibility.js";
import { decidePublicationRetryPolicy } from "./publication-observability.js";
import type { PublicationOperationsRetryDecision } from "./publication-operations-contracts.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationEffectiveApprovalPort } from "./publication-service.js";
import type { PublicationUnitOfWork } from "./publication-unit-of-work.js";

export interface PublicationApprovedRetryPolicy {
  readonly tenantScopeId: string;
  readonly targetId: string;
  readonly targetVersion: number;
  readonly channelId: string;
  readonly channelPolicyVersion: string;
  readonly reference: string;
  readonly maximumAttempts: number;
  readonly allowedOutcomes: readonly ("NO_EFFECT" | "PRE_DISPATCH")[];
}

/** Read-only approved policy source. Absence never grants retry authority. */
export interface PublicationApprovedRetryPolicyResolver {
  resolve(identity: PublicationIdentity, binding: PublicationBinding): PublicationApprovedRetryPolicy | undefined;
}

export class PublicationDurableRetryEligibility {
  public constructor(private readonly dependencies: Readonly<{
    unitOfWork: PublicationUnitOfWork;
    authorization: PublicationAuthorizationGuard;
    effectiveApproval: PublicationEffectiveApprovalPort;
    clock: PublicationClock;
    policy?: PublicationApprovedRetryPolicyResolver;
  }>) {}

  public async evaluate(request: PublishPublicationCoordinationRequest): Promise<PublicationOperationsRetryDecision> {
    const tx = await this.dependencies.unitOfWork.begin(request.identity);
    let resolvedActorId = "unresolved-session";
    try {
      const snapshot = await tx.repository.find(request.identity);
      if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
      const authorization = this.dependencies.authorization.authorize({
        ...(request.context.sessionId === undefined ? {} : { sessionId: request.context.sessionId }),
        commandType: "BEGIN_INITIAL_EXECUTION", tenantId: request.identity.tenantScopeId, teamId: request.identity.tenantScopeId,
        purpose: request.command.authorityContext, aggregateId: request.identity.publicationId,
        expectedAggregateVersion: request.expectedAggregateVersion, reason: request.command.reason, correlationId: request.context.correlationId,
        resolveResource: (actor) => {
          resolvedActorId = actor.principalId;
          return { binding: snapshot.binding, currentAggregateVersion: snapshot.aggregateVersion };
        },
      });
      const effective = new PublicationExecutionEligibilityGate({ effectiveApproval: this.dependencies.effectiveApproval }).evaluate({ identity: request.identity, context: request.context, authorization: { actorId: authorization.actor.principalId, binding: snapshot.binding, currentAggregateVersion: snapshot.aggregateVersion } });
      const reserved = snapshot.attempts.at(-1);
      const pendingResume = reserved?.id === request.attempt.id && reserved.commandId === request.attempt.commandId
        && await tx.execution.findIntent(request.identity, reserved.commandId) !== undefined
        && (await tx.execution.recoveryDisposition(request.identity, reserved.commandId)).condition === "PRE_DISPATCH";
      const latest = pendingResume ? snapshot.attempts.at(-2) : reserved;
      // A durable reservation is the same attempt, not another consumed retry.
      const attempts = snapshot.attempts.length - (pendingResume ? 1 : 0);
      const receipt = latest === undefined ? undefined : await tx.execution.findReceipt(request.identity, latest.commandId);
      const intent = latest === undefined ? undefined : await tx.execution.findIntent(request.identity, latest.commandId);
      const disposition = intent === undefined ? undefined : await tx.execution.recoveryDisposition(request.identity, intent.commandId);
      const attemptEvidence = await Promise.all(snapshot.attempts.map(async (attempt) => ({
        attempt,
        receipt: await tx.execution.findReceipt(request.identity, attempt.commandId),
        intent: await tx.execution.findIntent(request.identity, attempt.commandId),
      })));
      const ambiguous = snapshot.lifecycleState === "RECONCILIATION_REQUIRED" || attemptEvidence.some(({ attempt, receipt: itemReceipt, intent: itemIntent }) => attempt.outcome === "UNKNOWN"
        || itemReceipt?.outcome === "UNKNOWN"
        || (itemIntent !== undefined && disposition?.condition === "RECONCILIATION_REQUIRED"));
      let policy: PublicationApprovedRetryPolicy | undefined;
      try { policy = this.dependencies.policy?.resolve(request.identity, snapshot.binding); } catch { policy = undefined; }
      if (!validPolicy(policy, request.identity, snapshot.binding)) policy = undefined;
      const previousOutcome = receipt?.outcome ?? (disposition?.condition === "PRE_DISPATCH" || (pendingResume && latest === undefined) ? "PRE_DISPATCH" : undefined);
      const sameIdentity = snapshot.attempts.some(attempt => attempt.id === request.attempt.id || attempt.commandId === request.attempt.commandId);
      const permitted = !ambiguous && snapshot.suspensionStatus === "NOT_SUSPENDED" && policy !== undefined && (latest !== undefined || pendingResume)
        && ((!sameIdentity && snapshot.lifecycleState === "READY") || pendingResume);
      const resultCode = effective.status === "BLOCKED" ? "STALE_AUTHORITY" : decidePublicationRetryPolicy({
        completed: !ambiguous && receipt?.outcome === "CONFIRMED", permitted,
        attempts, maximumAttempts: policy?.maximumAttempts ?? 0,
        authorityCurrent: true,
        failurePermitted: previousOutcome !== undefined && policy?.allowedOutcomes.includes(previousOutcome as "NO_EFFECT" | "PRE_DISPATCH") === true,
      });
      const failure = ambiguous ? "AMBIGUOUS_EXTERNAL_OUTCOME" : receipt === undefined ? undefined : classifyPublicationExecutionFailure({ outcome: receipt.outcome === "NO_EFFECT" ? "REJECTED" : receipt.outcome, authoritativeReceipt: true });
      const result = immutableDomain({ decision: resultCode, classification: "UNKNOWN" as const, retryEligible: resultCode === "ELIGIBLE", retryExhausted: resultCode === "EXHAUSTED", attemptNumber: attempts, maximumAttempts: policy?.maximumAttempts ?? 0, operationIdentity: request.identity.publicationId });
      // Version is revalidated on every call; preparing this same intent advances it.
      const fingerprint = hash([request.identity, request.attempt.id, request.attempt.commandId, request.attempt.operation, request.context.intentFingerprint, request.command.reason]);
      const stableKey = `retry-intent:${request.context.idempotencyKey}`;
      const idempotencyIdentity = { tenantScopeId: request.identity.tenantScopeId, aggregateId: request.identity.publicationId };
      const prior = await tx.idempotency.find({ ...idempotencyIdentity, commandKey: stableKey });
      if (prior !== undefined && prior.fingerprint !== fingerprint) throw persistenceError("IDEMPOTENCY_CONFLICT", "Retry idempotency identity conflicts with prior intent.");
      const safeEvidence = { result, failure, version: snapshot.aggregateVersion, attemptId: request.attempt.id, commandId: request.attempt.commandId, priorAttemptId: latest?.id, priorCommandId: latest?.commandId, receiptId: receipt?.receiptId, binding: snapshot.binding, policyReference: policy?.reference, actorId: authorization.actor.principalId, approvalReference: effective.status === "ELIGIBLE" ? effective.approvalDecisionReference : undefined };
      const stateHash = hash(safeEvidence);
      const evidenceKey = `${stableKey}:${stateHash}`;
      if (await tx.idempotency.find({ ...idempotencyIdentity, commandKey: evidenceKey }) === undefined) {
        const timestamp = this.dependencies.clock.now();
        await tx.audit.append({ id: `retry:${hash([idempotencyIdentity, evidenceKey])}`, ...idempotencyIdentity, command: "RETRY_DECISION", actorId: authorization.actor.principalId, timestamp, version: snapshot.aggregateVersion, result: result.retryEligible ? "COMPLETED" : "FAILED", ...(result.retryEligible ? {} : { failureReason: resultCode }), correlationId: request.context.correlationId });
        await tx.idempotency.record({ ...idempotencyIdentity, commandKey: evidenceKey, fingerprint, resultReference: JSON.stringify(safeEvidence), recordedAt: timestamp });
        if (prior === undefined) await tx.idempotency.record({ ...idempotencyIdentity, commandKey: stableKey, fingerprint, resultReference: evidenceKey, recordedAt: timestamp });
      }
      await tx.commit();
      return result;
    } catch (error) {
      if (error instanceof PublicationAuthorizationError) {
        try {
          // Failed authorization cannot write aggregate state, an intent, or a success result.
          // Record only safe denial evidence for an already-existing aggregate.
          const snapshot = await tx.repository.find(request.identity);
          if (snapshot !== undefined) {
            const idempotencyIdentity = { tenantScopeId: request.identity.tenantScopeId, aggregateId: request.identity.publicationId };
            const evidence = { decision: "STALE_AUTHORITY", reason: error.code, actorId: resolvedActorId, version: snapshot.aggregateVersion };
            const fingerprint = hash([request.attempt.id, request.attempt.commandId, request.context.intentFingerprint, evidence]);
            const commandKey = `retry-denied:${hash([idempotencyIdentity, request.context.idempotencyKey, fingerprint])}`;
            if (await tx.idempotency.find({ ...idempotencyIdentity, commandKey }) === undefined) {
              const timestamp = this.dependencies.clock.now();
              await tx.audit.append({ ...idempotencyIdentity, id: commandKey, command: "RETRY_DECISION", actorId: resolvedActorId, timestamp, version: snapshot.aggregateVersion, result: "FAILED", failureReason: error.code, correlationId: request.context.correlationId });
              await tx.idempotency.record({ ...idempotencyIdentity, commandKey, fingerprint, resultReference: JSON.stringify(evidence), recordedAt: timestamp });
            }
            await tx.commit();
          } else await tx.rollback();
        } catch (persistenceFailure) {
          try { await tx.rollback(); } catch { /* preserve persistence failure */ }
          throw persistenceFailure;
        }
        return immutableDomain({ decision: "STALE_AUTHORITY", classification: "AUTHORITY_FAILURE", retryEligible: false, retryExhausted: false, attemptNumber: 0, maximumAttempts: 0, operationIdentity: request.identity.publicationId });
      }
      try { await tx.rollback(); } catch { /* preserve original failure */ }
      throw error;
    }
  }
}

function validPolicy(policy: PublicationApprovedRetryPolicy | undefined, identity: PublicationIdentity, binding: PublicationBinding): policy is PublicationApprovedRetryPolicy {
  return policy?.tenantScopeId === identity.tenantScopeId && policy.targetId === binding.targetId
    && policy.targetVersion === binding.targetVersion && policy.channelId === binding.channelId && policy.channelPolicyVersion === binding.channelPolicyVersion
    && Number.isSafeInteger(policy.maximumAttempts) && policy.maximumAttempts > 0 && policy.maximumAttempts <= 100
    && typeof policy.reference === "string" && /^[A-Za-z0-9:._-]{1,128}$/u.test(policy.reference)
    && Array.isArray(policy.allowedOutcomes) && policy.allowedOutcomes.every(outcome => outcome === "NO_EFFECT" || outcome === "PRE_DISPATCH");
}

function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
