import { PublicationApplicationError, mapPublicationApplicationError } from "./publication-application-error.js";
import type {
  PublicationCoordinationPort,
  PublicationExecutionContext,
  PublicationReconciliationPort,
  PublicationReconciliationRequest,
  PublicationReconciliationResult,
  PublicationRecoveryDecision,
} from "./publication-application-contracts.js";
import { PUBLICATION_RECOVERY_CATEGORIES } from "./publication-application-contracts.js";
import type { PublicationApplicationService } from "./publication-application-service.js";
import type { PublicationAuditRecord, PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationAuthorizationCommandType, PublicationAuthorizationGuard } from "./publication-authorization.js";
import type { PublicationClock } from "./publication-clock.js";
import {
  immutableDomain,
  RECONCILIATION_RESOLUTIONS,
  type PublicationIdentity,
  type PublicationSnapshot,
  type ReconciliationResolution,
} from "./publication-contracts.js";
import type { PublicationIdempotencyStore } from "./publication-idempotency-store.js";
import { persistenceError } from "./publication-persistence-error.js";
import type { PublicationRepository } from "./publication-repository.js";
import { requireEffectivePublicationApproval, type PublicationEffectiveApprovalPort } from "./publication-service.js";
import type { PublicationUnitOfWork } from "./publication-unit-of-work.js";
import type { PublicationOperationsObserver } from "./publication-operations-contracts.js";
import { PublicationRecoveryExecutionPlanner } from "./publication-recovery-execution-planner.js";

export interface PublicationReconciliationDependencies {
  readonly application: PublicationApplicationService;
  readonly repository: PublicationRepository;
  readonly authorization: PublicationAuthorizationGuard;
  readonly effectiveApproval: PublicationEffectiveApprovalPort;
  readonly unitOfWork: PublicationUnitOfWork;
  readonly idempotency: PublicationIdempotencyStore;
  readonly audit: PublicationAuditStore;
  readonly clock: PublicationClock;
  readonly operations?: PublicationOperationsObserver;
  readonly recoveryAuthorizationReader?: PublicationRecoveryAuthorizationReader;
  readonly recoveryCaseWriter?: PublicationRecoveryCaseWriter;
  readonly recoveryExecutionStore?: PublicationRecoveryExecutionStore;
  readonly coordination?: PublicationCoordinationPort;
}

export interface PublicationAuthorizedRecoveryCase {
  readonly recoveryCaseId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly status: "OPEN" | "RESOLVED";
  readonly version: number;
  readonly createdBy: string;
  readonly finding?: Readonly<{ readonly finding: "CONFIRMED_EXECUTED" | "CONFIRMED_NOT_EXECUTED" | "UNRESOLVED"; readonly decidedBy: string }>;
  readonly disposition?: Readonly<{ readonly recoveryId: string; readonly recoveryDisposition: "RECOVERY_AUTHORIZED" | "NO_RECOVERY_REQUIRED" | "RECOVERY_REJECTED"; readonly recoveryActionType: "PUBLICATION_RECOVERY" | "CONNECTOR_REEXECUTION"; readonly decidedBy: string }>;
  readonly recovery?: Readonly<{ readonly recoveryId: string; readonly recoveryCaseId: string; readonly originalOriginIdentity: Readonly<{ readonly reconciliationCaseId: string; readonly attemptId: string }> | Readonly<Record<string, string>>; readonly decisionVersion: number; readonly recoveryActionType: "PUBLICATION_RECOVERY" | "CONNECTOR_REEXECUTION"; readonly recoveryExecutionIdentity: Readonly<{ readonly attemptId: string; readonly commandId: string }> | Readonly<{ readonly invocationId: string }>; readonly evidenceRefs: readonly string[]; readonly authorizedBy: string }>;
}

export interface PublicationRecoveryAuthorizationReader {
  findAuthorizedPublicationRecovery(input: Readonly<{ tenantId: string; scopeRef: string; resourceType: "Publication"; resourceId: string; reconciliationCaseId: string }>): PublicationAuthorizedRecoveryCase | undefined;
}

export interface PublicationRecoveryCaseWriter {
  createCase(input: Readonly<{
    resourceType: "Publication";
    resourceId: string;
    originDomain: "PUBLICATION";
    originIdentity: Readonly<{ reconciliationCaseId: string; attemptId: string }>;
    tenantId: string;
    scopeRef: string;
    parentRecoveryCaseId: string;
    evidenceRefs: readonly string[];
    createdBy: string;
    createdAt: string;
  }>): Readonly<{ recoveryCaseId: string }>;
}

interface PublicationRecoveryExecutionRecord {
  readonly recoveryId: string;
  readonly fingerprint: string;
  readonly resultJson?: string;
}

export interface PublicationRecoveryExecutionStore {
  findRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string }>): PublicationRecoveryExecutionRecord | undefined;
  claimRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string }>): Readonly<{ replay: boolean; record: PublicationRecoveryExecutionRecord }>;
  completeRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string; resultJson: string }>): Readonly<{ replay: boolean; record: PublicationRecoveryExecutionRecord }>;
}

interface AuthorizedRecovery {
  readonly actorId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly snapshot: PublicationSnapshot;
}

export class PublicationReconciliationService implements PublicationReconciliationPort {
  public constructor(private readonly dependencies: PublicationReconciliationDependencies) {}

  public reconcile(request: PublicationReconciliationRequest): Promise<PublicationReconciliationResult> {
    return this.coordinate(request);
  }

  public async recover(request: PublicationReconciliationRequest): Promise<PublicationReconciliationResult> {
    try {
      validateRecoveryExecutionRequest(request);
      const authorized = await this.authorizeAndLoad(request, true, "BEGIN_INITIAL_EXECUTION");
      const recovery = this.dependencies.recoveryAuthorizationReader?.findAuthorizedPublicationRecovery({
        tenantId: authorized.tenantId,
        scopeRef: authorized.scopeRef,
        resourceType: "Publication",
        resourceId: request.identity.publicationId,
        reconciliationCaseId: request.input.caseId,
      });
      if (recovery === undefined) {
        throw new PublicationApplicationError("RECOVERY_AUTHORIZATION_REQUIRED", "DOMAIN_REJECTION", "Publication recovery authorization is required.");
      }
      const recoveryExecutionStore = this.dependencies.recoveryExecutionStore;
      if (recoveryExecutionStore === undefined) throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Durable Publication recovery execution evidence is unavailable.");
      const executionFingerprint = recoveryExecutionFingerprint(recovery);
      const recoveryId = recovery.recovery?.recoveryId;
      if (recoveryId !== undefined) {
        const durableReplay = recoveryStoreCall(() => recoveryExecutionStore.findRecoveryExecution({ recoveryId, fingerprint: executionFingerprint }));
        if (durableReplay?.resultJson !== undefined) return replayStoredPublicationResult(durableReplay.resultJson);
      }
      const priorExecution = recovery.recovery === undefined ? undefined : await this.dependencies.idempotency.find({
        tenantScopeId: request.identity.tenantScopeId,
        aggregateId: request.identity.publicationId,
        commandKey: `${recovery.recovery.recoveryId}:publish`,
      });
      if (priorExecution !== undefined && priorExecution.fingerprint !== `${executionFingerprint}:publish`) {
        throw new PublicationApplicationError("IDEMPOTENCY_CONFLICT", "CONFLICT", "Publication recovery identity conflicts with durable history.");
      }
      const binding = requirePublicationRecoveryBinding(recovery, request, authorized);
      const coordination = this.dependencies.coordination;
      if (coordination === undefined) throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Publication recovery execution is unavailable.");
      if (this.dependencies.recoveryCaseWriter === undefined) throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Publication recovery case linkage is unavailable.");
      recoveryStoreCall(() => recoveryExecutionStore.claimRecoveryExecution({ recoveryId: binding.recoveryId, fingerprint: executionFingerprint }));
      const result = await coordination.recover({
        identity: request.identity,
        context: immutableDomain({ ...request.context, idempotencyKey: binding.recoveryId, intentFingerprint: executionFingerprint }),
        command: request.input.command,
        attempt: immutableDomain({ id: binding.attemptId, commandId: binding.commandId, operation: "INITIAL_PUBLISH" as const, occurredAt: request.input.command.occurredAt, evidenceRefs: recovery.recovery?.evidenceRefs ?? [] }),
        expectedAggregateVersion: authorized.snapshot.aggregateVersion,
      });
      if (!result.ok) {
        if (result.error.code === "CONNECTOR_OUTCOME_UNKNOWN") {
          const snapshot = await this.dependencies.repository.find(request.identity);
          const reconciliation = snapshot?.reconciliationCases.find(({ attemptId, status }) => attemptId === binding.attemptId && status === "OPEN");
          const attempt = snapshot?.attempts.find(({ id }) => id === binding.attemptId);
          if (reconciliation === undefined || attempt?.outcome !== "UNKNOWN") {
            throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Publication recovery ambiguity could not be linked.");
          }
          try {
            this.dependencies.recoveryCaseWriter.createCase({
              resourceType: "Publication",
              resourceId: request.identity.publicationId,
              originDomain: "PUBLICATION",
              originIdentity: immutableDomain({ reconciliationCaseId: reconciliation.id, attemptId: binding.attemptId }),
              tenantId: authorized.tenantId,
              scopeRef: authorized.scopeRef,
              parentRecoveryCaseId: recovery.recoveryCaseId,
              evidenceRefs: attempt.evidenceRefs,
              createdBy: authorized.actorId,
              createdAt: this.dependencies.clock.now(),
            });
          } catch (error) {
            if (!isDuplicateRecoveryCase(error)) throw error;
          }
        }
        return recordPublicationRecoveryResult(recoveryExecutionStore, binding.recoveryId, executionFingerprint, result);
      }
      const completed = immutableDomain({ ok: true as const, publicationId: result.publicationId, aggregateVersion: result.aggregateVersion, decision: "RECOVERED" as const, resultReference: JSON.stringify([recovery.disposition?.recoveryId, binding.commandId, result.aggregateVersion]), replayed: result.replayed });
      return recordPublicationRecoveryResult(recoveryExecutionStore, binding.recoveryId, executionFingerprint, completed);
    } catch (error) {
      return mapPublicationApplicationError(error, false);
    }
  }

  public execute(request: PublicationReconciliationRequest): Promise<PublicationReconciliationResult> {
    return this.coordinate(request);
  }

  private async coordinate(request: PublicationReconciliationRequest): Promise<PublicationReconciliationResult> {
    const result = await this.coordinateCanonical(request);
    safelyObserve(this.dependencies.operations, {
      component: "RECONCILIATION",
      result: result.ok ? "COMPLETED" : "FAILED",
      ...(result.ok ? {} : { failureCode: result.error.code }),
      sourceReference: request.input.caseId,
      correlationId: request.context.correlationId,
      actorOrServiceReference: "reconciliation-service",
    });
    return result;
  }

  private async coordinateCanonical(request: PublicationReconciliationRequest): Promise<PublicationReconciliationResult> {
    try {
      validateRequest(request);
      const replayCandidate = await findRecoveryRecord(this.dependencies, request.identity, request.context);
      const authorized = await this.authorizeAndLoad(request, replayCandidate !== undefined);
      const replay = await replayResult(this.dependencies, request, authorized.snapshot, replayCandidate);
      if (replay !== undefined) return replay;

      const reconciliation = authorized.snapshot.reconciliationCases.find(({ id }) => id === request.input.caseId);
      if (reconciliation === undefined) throw invalidRecoveryRequest();
      if (reconciliation.status === "RESOLVED") {
        return await this.recordDecision(request, authorized, "NO_ACTION_REQUIRED");
      }

      const decision = requestedDecision(request.input.category, request.input.resolution);
      if (decision === "MANUAL_REVIEW_REQUIRED") {
        return await this.recordDecision(request, authorized, decision);
      }

      const resolution = request.input.resolution;
      if (resolution === undefined) throw invalidRecoveryRequest();
      const applicationResult = await this.dependencies.application.executeAuthorized({
        kind: "MODIFY_PUBLICATION",
        identity: request.identity,
        input: {
          type: "RESOLVE_RECONCILIATION",
          expectedAggregateVersion: request.input.expectedAggregateVersion,
          caseId: request.input.caseId,
          resolution,
          evidenceRefs: request.input.evidenceRefs,
          ...(request.input.externalObjectReference === undefined ? {} : { externalObjectReference: request.input.externalObjectReference }),
          command: request.input.command,
        },
      }, request.context, (execution) => {
        requireEffectivePublicationApproval(
          this.dependencies.effectiveApproval,
          request.identity,
          request.context,
          execution.actorId,
          execution.binding,
        );
      }, {
        decision,
        reason: request.input.command.reason,
        correlationId: request.context.correlationId,
        evidenceRefs: request.input.evidenceRefs,
      });
      if (!applicationResult.ok) return applicationResult;
      return immutableDomain({
        ok: true as const,
        publicationId: applicationResult.publicationId,
        aggregateVersion: applicationResult.aggregateVersion,
        decision,
        resultReference: applicationResult.resultReference,
        replayed: applicationResult.replayed,
      });
    } catch (error) {
      return mapPublicationApplicationError(error, false);
    }
  }

  private async authorizeAndLoad(request: PublicationReconciliationRequest, replayCandidate: boolean, commandType: PublicationAuthorizationCommandType = "RESOLVE_RECONCILIATION"): Promise<AuthorizedRecovery> {
    let snapshot = replayCandidate ? await this.dependencies.repository.find(request.identity) : undefined;
    const expectedAggregateVersion = snapshot?.aggregateVersion ?? request.input.expectedAggregateVersion;
    const authorization = await this.dependencies.authorization.authorizeAsync({
      ...(request.context.sessionId === undefined ? {} : { sessionId: request.context.sessionId }),
      commandType,
      actorIdClaim: request.context.actorId,
      tenantId: request.identity.tenantScopeId,
      teamId: request.identity.tenantScopeId,
      purpose: request.input.command.authorityContext,
      aggregateId: request.identity.publicationId,
      expectedAggregateVersion,
      reason: request.input.command.reason,
      correlationId: request.context.correlationId,
      resolveResource: async () => {
        snapshot ??= await this.dependencies.repository.find(request.identity);
        if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
        return Object.freeze({ binding: snapshot.binding, currentAggregateVersion: snapshot.aggregateVersion });
      },
    });
    if (snapshot === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
    requireEffectivePublicationApproval(
      this.dependencies.effectiveApproval,
      request.identity,
      request.context,
      authorization.actor.principalId,
      snapshot.binding,
    );
    return immutableDomain({ actorId: authorization.actor.principalId, tenantId: request.identity.tenantScopeId, scopeRef: authorization.actor.teamId ?? "", snapshot });
  }

  private async recordDecision(
    request: PublicationReconciliationRequest,
    authorized: AuthorizedRecovery,
    decision: Extract<PublicationRecoveryDecision, "MANUAL_REVIEW_REQUIRED" | "NO_ACTION_REQUIRED">,
  ): Promise<PublicationReconciliationResult> {
    const transaction = await this.dependencies.unitOfWork.begin(request.identity);
    const checkedAt = this.dependencies.clock.now();
    try {
      const current = await transaction.repository.find(request.identity);
      if (current === undefined) throw persistenceError("PUBLICATION_NOT_FOUND", "Publication was not found.");
      if (current.aggregateVersion !== authorized.snapshot.aggregateVersion) {
        throw persistenceError("PUBLICATION_VERSION_CONFLICT", "Publication persistence scope changed during recovery coordination.");
      }
      await transaction.audit.append(recoveryAudit(request, authorized.actorId, current.aggregateVersion, decision, checkedAt));
      const resultReference = JSON.stringify([request.identity.publicationId, current.aggregateVersion]);
      await transaction.idempotency.record({
        tenantScopeId: request.identity.tenantScopeId,
        aggregateId: request.identity.publicationId,
        commandKey: request.context.idempotencyKey,
        fingerprint: request.context.intentFingerprint,
        resultReference,
        recordedAt: checkedAt,
      });
      await transaction.commit();
      return immutableDomain({
        ok: true as const,
        publicationId: request.identity.publicationId,
        aggregateVersion: current.aggregateVersion,
        decision,
        resultReference,
        replayed: false,
      });
    } catch (error) {
      try { await transaction.rollback(); } catch { /* Commit conflict may already have closed the transaction. */ }
      throw error;
    }
  }
}

function safelyObserve(observer: PublicationOperationsObserver | undefined, observation: Parameters<PublicationOperationsObserver["observe"]>[0]): void {
  try { observer?.observe(observation); } catch { /* Observability cannot alter reconciliation semantics. */ }
}

function validateRequest(request: PublicationReconciliationRequest): void {
  const { context, input } = request;
  const required = [
    request.identity.publicationId,
    request.identity.tenantScopeId,
    context.actorId,
    context.correlationId,
    context.idempotencyKey,
    context.intentFingerprint,
    input.caseId,
    input.command.authorityContext,
    input.command.reason,
    input.command.correlationId,
    input.command.occurredAt,
  ];
  if (required.some((value) => value.trim().length === 0)
    || !Number.isSafeInteger(input.expectedAggregateVersion)
    || input.expectedAggregateVersion <= 0
    || input.command.correlationId !== context.correlationId
    || !PUBLICATION_RECOVERY_CATEGORIES.includes(input.category)
    || (input.resolution !== undefined && !RECONCILIATION_RESOLUTIONS.includes(input.resolution))
    || input.evidenceRefs.length === 0
    || input.evidenceRefs.some((reference) => reference.trim().length === 0)) {
    throw invalidRecoveryRequest();
  }
  const success = input.resolution === "EFFECT_CONFIRMED" || input.resolution === "WITHDRAWAL_CONFIRMED";
  const noEffect = input.resolution !== undefined && !success;
  if ((input.category === "CONFIRMED_SUCCESS" && !success)
    || (input.category === "CONFIRMED_FAILURE" && !noEffect)
    || ((input.category === "UNKNOWN" || input.category === "EXTERNAL_TIMEOUT" || input.category === "MANUAL_REVIEW_REQUIRED")
      && input.resolution !== undefined)
    || (input.resolution === "EFFECT_CONFIRMED" && (input.externalObjectReference === undefined || input.externalObjectReference.trim().length === 0))) {
    throw invalidRecoveryRequest();
  }
}

function validateRecoveryExecutionRequest(request: PublicationReconciliationRequest): void {
  const required = [request.identity.publicationId, request.identity.tenantScopeId, request.context.correlationId, request.context.idempotencyKey, request.context.intentFingerprint, request.input.caseId, request.input.command.authorityContext, request.input.command.reason, request.input.command.correlationId, request.input.command.occurredAt];
  if (required.some((value) => value.trim().length === 0)
    || !Number.isSafeInteger(request.input.expectedAggregateVersion)
    || request.input.expectedAggregateVersion <= 0
    || request.input.command.correlationId !== request.context.correlationId) throw invalidRecoveryRequest();
}

function requirePublicationRecoveryBinding(recovery: PublicationAuthorizedRecoveryCase, request: PublicationReconciliationRequest, authorized: AuthorizedRecovery): Readonly<{ recoveryId: string; attemptId: string; commandId: string }> {
  const publicationCase = authorized.snapshot.reconciliationCases.find(({ id }) => id === request.input.caseId);
  const originalAttempt = publicationCase === undefined ? undefined : authorized.snapshot.attempts.find(({ id }) => id === publicationCase.attemptId);
  const disposition = recovery.disposition;
  const binding = recovery.recovery;
  const executionIdentity = binding?.recoveryExecutionIdentity;
  const originIdentity = binding?.originalOriginIdentity as Readonly<Record<string, unknown>> | undefined;
  const plannedIdentity = publicationCase === undefined || originalAttempt === undefined
    ? undefined
    : new PublicationRecoveryExecutionPlanner().plan({
      identity: request.identity,
      recoveryCaseId: recovery.recoveryCaseId,
      reconciliationCaseId: publicationCase.id,
      originalAttemptId: originalAttempt.id,
      originalCommandId: originalAttempt.commandId,
    });
  if (recovery.resourceType !== "Publication" || recovery.resourceId !== request.identity.publicationId || recovery.tenantId !== authorized.tenantId || recovery.scopeRef !== authorized.scopeRef
    || publicationCase?.status !== "RESOLVED" || originalAttempt?.outcome !== "UNKNOWN" || originalAttempt.operation !== "INITIAL_PUBLISH"
    || recovery.status !== "RESOLVED" || recovery.version !== (binding?.decisionVersion ?? -2) + 1 || recovery.finding?.finding !== "CONFIRMED_NOT_EXECUTED"
    || disposition?.recoveryDisposition !== "RECOVERY_AUTHORIZED" || disposition.recoveryActionType !== "PUBLICATION_RECOVERY"
    || binding?.recoveryActionType !== "PUBLICATION_RECOVERY" || binding.recoveryCaseId !== recovery.recoveryCaseId || binding.recoveryId !== disposition.recoveryId
    || originIdentity?.["reconciliationCaseId"] !== request.input.caseId || originIdentity?.["attemptId"] !== originalAttempt.id
    || executionIdentity === undefined || !("attemptId" in executionIdentity) || !("commandId" in executionIdentity)
    || !executionIdentity.attemptId.trim() || !executionIdentity.commandId.trim() || executionIdentity.attemptId === originalAttempt.id || executionIdentity.commandId === originalAttempt.commandId
    || executionIdentity.attemptId !== plannedIdentity?.attemptId || executionIdentity.commandId !== plannedIdentity?.commandId
    || [recovery.createdBy, recovery.finding.decidedBy, disposition.decidedBy, binding.authorizedBy].includes(authorized.actorId)) {
    throw new PublicationApplicationError("RECOVERY_AUTHORIZATION_INVALID", "DOMAIN_REJECTION", "Publication recovery authorization is invalid.");
  }
  const existingRecoveryAttempt = authorized.snapshot.attempts.find(({ id, commandId }) => id === executionIdentity.attemptId || commandId === executionIdentity.commandId);
  if (existingRecoveryAttempt === undefined && authorized.snapshot.aggregateVersion !== request.input.expectedAggregateVersion) {
    throw new PublicationApplicationError("PUBLICATION_VERSION_CONFLICT", "CONFLICT", "Publication version conflict.");
  }
  if (existingRecoveryAttempt !== undefined && (existingRecoveryAttempt.id !== executionIdentity.attemptId || existingRecoveryAttempt.commandId !== executionIdentity.commandId)) {
    throw new PublicationApplicationError("IDEMPOTENCY_CONFLICT", "CONFLICT", "Publication recovery identity conflicts with durable history.");
  }
  return immutableDomain({ recoveryId: binding.recoveryId, attemptId: executionIdentity.attemptId, commandId: executionIdentity.commandId });
}

function isDuplicateRecoveryCase(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "DUPLICATE_ORIGIN";
}

function recoveryExecutionFingerprint(recovery: PublicationAuthorizedRecoveryCase): string {
  const binding = recovery.recovery;
  const identity = binding?.recoveryExecutionIdentity;
  const origin = binding?.originalOriginIdentity;
  const canonicalIdentity = identity === undefined
    ? undefined
    : "attemptId" in identity
      ? ["PUBLICATION", identity.attemptId, identity.commandId]
      : ["CONNECTOR", identity.invocationId];
  const canonicalOrigin = origin === undefined
    ? undefined
    : "reconciliationCaseId" in origin && "attemptId" in origin
      ? ["PUBLICATION", origin.reconciliationCaseId, origin.attemptId]
      : Object.entries(origin).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify([
    recovery.recoveryCaseId,
    recovery.resourceType,
    recovery.resourceId,
    recovery.tenantId,
    recovery.scopeRef,
    recovery.status,
    recovery.version,
    recovery.createdBy,
    recovery.finding?.finding,
    recovery.finding?.decidedBy,
    recovery.disposition?.recoveryId,
    recovery.disposition?.recoveryDisposition,
    recovery.disposition?.recoveryActionType,
    recovery.disposition?.decidedBy,
    binding?.recoveryId,
    binding?.recoveryCaseId,
    canonicalOrigin,
    binding?.decisionVersion,
    binding?.recoveryActionType,
    canonicalIdentity,
    binding?.evidenceRefs,
    binding?.authorizedBy,
  ]);
}

function recoveryStoreCall<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "IDEMPOTENCY_CONFLICT") {
      throw new PublicationApplicationError("IDEMPOTENCY_CONFLICT", "CONFLICT", "Publication recovery identity conflicts with durable F19 history.");
    }
    throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Durable Publication recovery execution evidence is unavailable.");
  }
}

function recordPublicationRecoveryResult(store: PublicationRecoveryExecutionStore, recoveryId: string, fingerprint: string, result: PublicationReconciliationResult): PublicationReconciliationResult {
  const completed = recoveryStoreCall(() => store.completeRecoveryExecution({ recoveryId, fingerprint, resultJson: JSON.stringify(result) }));
  if (completed.record.resultJson === undefined) throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Durable Publication recovery result is unavailable.");
  const authoritative = decodeStoredPublicationResult(completed.record.resultJson);
  return completed.replay && authoritative.ok ? immutableDomain({ ...authoritative, replayed: true }) : authoritative;
}

function replayStoredPublicationResult(resultJson: string): PublicationReconciliationResult {
  const result = decodeStoredPublicationResult(resultJson);
  return result.ok ? immutableDomain({ ...result, replayed: true }) : result;
}

function decodeStoredPublicationResult(resultJson: string): PublicationReconciliationResult {
  try {
    const value: unknown = JSON.parse(resultJson);
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("invalid result");
    const record = value as Record<string, unknown>;
    if (record["ok"] === true
      && typeof record["publicationId"] === "string"
      && Number.isSafeInteger(record["aggregateVersion"])
      && typeof record["decision"] === "string"
      && typeof record["resultReference"] === "string"
      && typeof record["replayed"] === "boolean") {
      return immutableDomain(value as PublicationReconciliationResult);
    }
    const error = record["error"];
    if (record["ok"] === false && typeof error === "object" && error !== null && !Array.isArray(error)) {
      const detail = error as Record<string, unknown>;
      if (typeof detail["code"] === "string" && typeof detail["category"] === "string" && typeof detail["message"] === "string") return immutableDomain(value as PublicationReconciliationResult);
    }
  } catch { /* map malformed durable evidence to a closed infrastructure error */ }
  throw new PublicationApplicationError("RECOVERY_EXECUTION_UNAVAILABLE", "INFRASTRUCTURE", "Stored Publication recovery result is invalid.");
}

function requestedDecision(category: PublicationReconciliationRequest["input"]["category"], resolution: ReconciliationResolution | undefined): PublicationRecoveryDecision {
  if (resolution === undefined) return "MANUAL_REVIEW_REQUIRED";
  if (resolution === "EFFECT_CONFIRMED" || resolution === "WITHDRAWAL_CONFIRMED") return "CONFIRMED";
  if (resolution === "INITIAL_NO_EFFECT") return "REJECTED";
  if (category === "CONFIRMED_FAILURE" || category === "PARTIAL_COMPLETION") return "RECOVERED";
  throw invalidRecoveryRequest();
}

function invalidRecoveryRequest(): PublicationApplicationError {
  return new PublicationApplicationError("RECOVERY_REQUEST_INVALID", "VALIDATION", "Recovery request is invalid.");
}

function recoveryAudit(
  request: PublicationReconciliationRequest,
  actorId: string,
  version: number,
  decision: PublicationRecoveryDecision,
  checkedAt: string,
): PublicationAuditRecord {
  return immutableDomain({
    id: recoveryAuditId(request.identity, request.context, request.context.intentFingerprint, "completed"),
    tenantScopeId: request.identity.tenantScopeId,
    aggregateId: request.identity.publicationId,
    command: "RESOLVE_RECONCILIATION",
    actorId,
    timestamp: checkedAt,
    version,
    result: "COMPLETED" as const,
    decision,
    reason: request.input.command.reason,
    correlationId: request.context.correlationId,
    checkedAt,
    evidenceRefs: request.input.evidenceRefs,
  });
}

function recoveryAuditId(
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
  fingerprint: string,
  outcome: "completed" | "failed",
): string {
  return JSON.stringify([
    identity.tenantScopeId,
    identity.publicationId,
    context.correlationId,
    context.idempotencyKey,
    "RESOLVE_RECONCILIATION",
    fingerprint,
    outcome,
  ]);
}

async function findRecoveryRecord(
  dependencies: Pick<PublicationReconciliationDependencies, "audit" | "idempotency">,
  identity: PublicationIdentity,
  context: PublicationExecutionContext,
): Promise<PublicationAuditRecord | undefined> {
  const audit = (await dependencies.audit.list(identity)).find((record) => {
    const decoded = decodeAuditIdentity(record.id);
    return decoded?.idempotencyKey === context.idempotencyKey && decoded.outcome === "completed";
  });
  if (audit !== undefined) return audit;
  try {
    return await dependencies.idempotency.find({
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      commandKey: context.idempotencyKey,
    }) === undefined ? undefined : immutableDomain({
      id: "IDEMPOTENCY_RECORD",
      tenantScopeId: identity.tenantScopeId,
      aggregateId: identity.publicationId,
      command: "RESOLVE_RECONCILIATION",
      actorId: "UNAVAILABLE",
      timestamp: "UNAVAILABLE",
      version: 1,
      result: "COMPLETED" as const,
    });
  } catch {
    return undefined;
  }
}

async function replayResult(
  dependencies: Pick<PublicationReconciliationDependencies, "audit" | "idempotency">,
  request: PublicationReconciliationRequest,
  snapshot: PublicationSnapshot,
  candidate: PublicationAuditRecord | undefined,
): Promise<PublicationReconciliationResult | undefined> {
  if (candidate === undefined) return undefined;
  const decoded = candidate.id === "IDEMPOTENCY_RECORD" ? undefined : decodeAuditIdentity(candidate.id);
  if (decoded !== undefined && decoded.command !== "RESOLVE_RECONCILIATION") {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key belongs to a different command.");
  }
  let storedFingerprint = decoded?.fingerprint;
  let aggregateVersion = candidate.version;
  if (storedFingerprint === undefined) {
    const record = await dependencies.idempotency.find({
      tenantScopeId: request.identity.tenantScopeId,
      aggregateId: request.identity.publicationId,
      commandKey: request.context.idempotencyKey,
    });
    storedFingerprint = record?.fingerprint;
    if (record !== undefined) aggregateVersion = decodeResultReference(record.resultReference)[1];
  }
  if (storedFingerprint !== request.context.intentFingerprint) {
    throw persistenceError("IDEMPOTENCY_CONFLICT", "Idempotency key was reused for a different recovery intent.");
  }
  const decision = candidate.decision === undefined
    ? requestedDecision(request.input.category, request.input.resolution)
    : candidate.decision as PublicationRecoveryDecision;
  return immutableDomain({
    ok: true as const,
    publicationId: request.identity.publicationId,
    aggregateVersion,
    decision,
    resultReference: JSON.stringify([request.identity.publicationId, aggregateVersion]),
    replayed: true,
  });
}

function decodeResultReference(reference: string): readonly [string, number] {
  try {
    const value: unknown = JSON.parse(reference);
    if (Array.isArray(value) && typeof value[0] === "string" && Number.isSafeInteger(value[1]) && (value[1] as number) > 0) {
      return [value[0], value[1] as number];
    }
  } catch { /* Invalid internal evidence is mapped to a safe application error. */ }
  throw new PublicationApplicationError("APPLICATION_RESULT_REFERENCE_INVALID", "INFRASTRUCTURE", "Stored recovery result is invalid.");
}

interface DecodedAuditIdentity {
  readonly idempotencyKey: string;
  readonly command: string;
  readonly fingerprint: string;
  readonly outcome: "completed" | "failed";
}

function decodeAuditIdentity(id: string): DecodedAuditIdentity | undefined {
  try {
    const value: unknown = JSON.parse(id);
    if (!Array.isArray(value) || value.length !== 7 || value.some((entry) => typeof entry !== "string")) return undefined;
    const [, , , idempotencyKey, command, fingerprint, outcome] = value as readonly string[];
    if (outcome !== "completed" && outcome !== "failed") return undefined;
    return { idempotencyKey: idempotencyKey!, command: command!, fingerprint: fingerprint!, outcome };
  } catch {
    return undefined;
  }
}
