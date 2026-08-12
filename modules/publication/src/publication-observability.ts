import { createHash } from "node:crypto";

import type { PublicationClock } from "./publication-clock.js";
import type { PublicationSessionResolver } from "./publication-authorization.js";
import type { ListingProjectionAuditStore, ListingProjectionStore } from "./listing-projection-store.js";
import type { ListingProjectionRebuildCoordinator, ListingProjectionRebuildResult } from "./listing-projection-rebuild.js";
import { operationsError } from "./publication-operations-error.js";
import {
  PUBLICATION_OPERATIONS_COMPONENTS,
  immutableOperations,
  type PublicationOperationalComponentStatus,
  type PublicationOperationalEvidence,
  type PublicationOperationalEvidenceStore,
  type PublicationOperationalFailureClassification,
  type PublicationOperationalMetrics,
  type PublicationOperationsComponent,
  type PublicationOperationsObservation,
  type PublicationOperationsObserver,
  type PublicationOperationsRetryAuthority,
  type PublicationOperationsRetryDecision,
  type PublicationOperationsRetryRequest,
  type PublicationOperationsRetryState,
  type PublicationOperationsRetryStateResolver,
  type PublicationOperationsRebuildAuthority,
  type PublicationOperationsRebuildRequest,
  type PublicationProjectionOperationalStatus,
  type PublicationSystemOperationalStatus,
} from "./publication-operations-contracts.js";

export interface PublicationOperationsStatusPort extends PublicationOperationsObserver {
  getComponentStatus(component: PublicationOperationsComponent): PublicationOperationalComponentStatus;
}

export interface PublicationOperationsProjectionReadPort {
  getProjectionOperationalStatus(identity: Readonly<{ tenantId: string; publicationId: string }>): PublicationProjectionOperationalStatus;
}

export class PublicationOperationsProjectionReadService implements PublicationOperationsProjectionReadPort {
  public constructor(private readonly store: ListingProjectionStore, private readonly audit: ListingProjectionAuditStore) {}

  public getProjectionOperationalStatus(identity: Readonly<{ tenantId: string; publicationId: string }>): PublicationProjectionOperationalStatus {
    const generation = this.store.getServingGeneration(identity);
    const record = this.store.getServing(identity);
    const audit = this.audit.list(identity);
    const lastApply = [...audit].reverse().find(({ operation, result }) => operation === "EVENT_APPLIED" && result === "COMPLETED");
    const lastRebuild = [...audit].reverse().find(({ operation, result }) => operation === "GENERATION_CUTOVER" && result === "COMPLETED");
    const projectionStatus: PublicationProjectionOperationalStatus["projectionStatus"] = record?.stale === true ? "STALE"
      : generation?.lifecycle === "REBUILDING" ? "REBUILDING"
        : generation?.lifecycle === "FAILED" ? "FAILED"
          : record === undefined ? "UNAVAILABLE" : "ACTIVE";
    return immutableOperations({
      projectionId: "PRJ-002", publicationId: identity.publicationId,
      ...(generation === undefined ? {} : { servingGeneration: generation.generationId, definitionVersion: generation.projectionDefinitionVersion, schemaVersion: generation.projectionSchemaVersion }),
      projectionStatus, stale: record?.stale ?? false,
      ...(record?.staleReason === undefined ? {} : { staleReason: record.staleReason }),
      ...(record === undefined ? {} : { lastEventSequence: record.lastEventSequence, sourceAggregateVersion: record.aggregateVersion, publicationVersion: record.publicationVersion, projectionRecordVersion: record.projectionRecordVersion, definitionVersion: record.projectionDefinitionVersion, schemaVersion: record.projectionSchemaVersion }),
      ...(lastApply === undefined ? {} : { lastSuccessfulApply: lastApply.recordedAt }),
      ...(lastRebuild === undefined ? {} : { lastSuccessfulRebuild: lastRebuild.recordedAt }),
    });
  }
}

export class PublicationOperationsRebuildControl {
  public constructor(private readonly dependencies: Readonly<{
    sessionResolver?: PublicationSessionResolver;
    authority?: PublicationOperationsRebuildAuthority;
    rebuild: ListingProjectionRebuildCoordinator;
    status: PublicationOperationsStatusPort;
    clock: PublicationClock;
  }>) {}

  public requestProjectionRebuild(request: PublicationOperationsRebuildRequest): ListingProjectionRebuildResult {
    validateRebuildRequest(request);
    let session;
    try {
      session = this.dependencies.sessionResolver?.resolve(request.sessionId);
    } catch {
      throw operationsError("OPERATIONS_UNAUTHORIZED", "Operational authentication is required.");
    }
    const now = this.dependencies.clock.now();
    const currentTime = Date.parse(now);
    const expiresAt = Date.parse(session?.expiresAt ?? "");
    const absoluteExpiresAt = Date.parse(session?.absoluteExpiresAt ?? "");
    if (session?.state !== "ACTIVE" || !Number.isFinite(currentTime) || !Number.isFinite(expiresAt) || !Number.isFinite(absoluteExpiresAt) || expiresAt <= currentTime || absoluteExpiresAt <= currentTime) {
      throw operationsError("OPERATIONS_UNAUTHORIZED", "Operational authentication is required.");
    }
    if (session.teamId !== request.tenantId) throw operationsError("OPERATIONS_FORBIDDEN", "Operational scope is not authorized.");
    if (!session.isMfaVerified) throw operationsError("OPERATIONS_FORBIDDEN", "Operational step-up authentication is required.");
    let authorized = false;
    try {
      authorized = this.dependencies.authority?.authorize({ session, tenantId: request.tenantId, publicationId: request.publicationId, reason: request.reason, action: "projection.rebuild", purpose: "PROJECTION_REBUILD", correlationId: request.correlationId }) === true;
    } catch {
      authorized = false;
    }
    if (!authorized) {
      throw operationsError("OPERATIONS_FORBIDDEN", "Projection rebuild is not authorized.");
    }
    try {
      const result = this.dependencies.rebuild.rebuild({
        tenantId: request.tenantId, publicationId: request.publicationId, projectionId: "PRJ-002", generationId: request.generationId,
        ...(request.expectedServingGenerationId === undefined ? {} : { expectedServingGenerationId: request.expectedServingGenerationId }),
        actorOrServiceReference: session.principalId, purpose: "PROJECTION_REBUILD", reason: request.reason,
        correlationId: request.correlationId, idempotencyKey: request.idempotencyKey, sourceFromSequence: request.sourceFromSequence,
      });
      return result;
    } catch {
      throw operationsError("OPERATIONS_PROJECTION_REBUILD_FAILED", "Projection rebuild failed safely.");
    }
  }
}

export interface PublicationOperationsReadPort {
  getSystemOperationalStatus(): PublicationSystemOperationalStatus;
  getComponentStatus(component: PublicationOperationsComponent): PublicationOperationalComponentStatus;
  getOperationalMetrics(): ReturnType<PublicationOperationalMetrics["snapshot"]>;
  getJournalOperationalStatus(): PublicationOperationalComponentStatus;
}

export class PublicationOperationsStatusService implements PublicationOperationsStatusPort, PublicationOperationsReadPort {
  private readonly statuses = new Map<PublicationOperationsComponent, PublicationOperationalComponentStatus>();

  public constructor(
    private readonly evidence: PublicationOperationalEvidenceStore,
    private readonly metrics: PublicationOperationalMetrics,
    private readonly clock: PublicationClock,
  ) {
    for (const component of PUBLICATION_OPERATIONS_COMPONENTS) {
      this.statuses.set(component, immutableOperations({
        component,
        status: "HEALTHY",
        reasonCode: "OPERATIONS_COMPONENT_HEALTHY",
        firstObservedAt: clock.now(),
        lastObservedAt: clock.now(),
        failureCount: 0,
        retryCount: 0,
        retryExhausted: false,
        recoverable: true,
        sourceReference: "sha256:unobserved",
        correlationId: "operations-initialization",
      }));
    }
  }

  public observe(observation: PublicationOperationsObservation): PublicationOperationalComponentStatus {
    validateObservation(observation);
    const prior = this.requireStatus(observation.component);
    const classification = observation.result === "FAILED"
      ? classifyOperationalFailure(observation.failureCode ?? "INTERNAL_OPERATIONS_ERROR")
      : undefined;
    const failed = observation.result === "FAILED";
    const now = this.clock.now();
    const reasonCode = failed ? safeOperationalReason(classification!) : "OPERATIONS_COMPONENT_HEALTHY";
    const status = observation.operationType === "REBUILD_REQUESTED" || (observation.operationType === "RETRY_DECISION" && !failed)
      ? "RECOVERING"
      : failed
      ? classification === "PERSISTENT" ? "FAILED" : "DEGRADED"
      : "HEALTHY";
    const next = immutableOperations({
      ...prior,
      status,
      reasonCode,
      lastObservedAt: now,
      failureCount: prior.failureCount + (failed ? 1 : 0),
      retryCount: Math.max(prior.retryCount, observation.attemptNumber ?? 0),
      retryExhausted: failed && classification === "PERSISTENT" ? true : prior.retryExhausted,
      recoverable: classification !== "INTEGRITY_FAILURE" && classification !== "AUTHORITY_FAILURE",
      sourceReference: safeReference(observation.sourceReference),
      correlationId: requireSafeIdentifier(observation.correlationId),
    } satisfies PublicationOperationalComponentStatus);
    this.evidence.append(createEvidence({
      component: observation.component,
      operationType: observation.operationType ?? "OBSERVATION",
      sourceReference: next.sourceReference,
      result: failed ? "FAILED" : "COMPLETED",
      safeReasonCode: reasonCode,
      attemptNumber: observation.attemptNumber ?? 0,
      retryEligible: classification === "TRANSIENT" || classification === "DEPENDENCY_FAILURE",
      retryExhausted: next.retryExhausted,
      correlationId: next.correlationId,
      actorOrServiceReference: requireSafeIdentifier(observation.actorOrServiceReference),
      recordedAt: now,
    }));
    this.statuses.set(observation.component, next);
    this.metrics.increment("operationsObserved");
    this.metrics.increment(failed ? "operationsFailed" : "operationsSucceeded");
    if (observation.component === "PROJECTION_REBUILD") {
      if (observation.operationType === "REBUILD_REQUESTED") this.metrics.increment("projectionRebuildRequested");
      else this.metrics.increment(failed ? "projectionRebuildFailed" : "projectionRebuildSucceeded");
    }
    incrementFailureMetric(this.metrics, observation.component, classification);
    return immutableOperations(next);
  }

  public getComponentStatus(component: PublicationOperationsComponent): PublicationOperationalComponentStatus {
    return immutableOperations(this.requireStatus(component));
  }

  public getSystemOperationalStatus(): PublicationSystemOperationalStatus {
    const components = PUBLICATION_OPERATIONS_COMPONENTS.map((component) => this.getComponentStatus(component));
    const runtime = this.requireStatus("API_RUNTIME_HOST");
    const journal = this.requireStatus("EVENT_JOURNAL");
    const projection = this.requireStatus("LISTING_PROJECTION");
    return immutableOperations({
      health: runtime.status === "FAILED" ? "FAILED" : runtime.status === "DEGRADED" ? "DEGRADED" : "HEALTHY",
      readiness: {
        operationsRead: runtime.status !== "FAILED",
        publicationMutation: journal.status === "HEALTHY",
        projectionRead: projection.status === "HEALTHY",
      },
      components,
      observedAt: this.clock.now(),
    });
  }

  public getOperationalMetrics(): ReturnType<PublicationOperationalMetrics["snapshot"]> {
    return this.metrics.snapshot();
  }

  public getJournalOperationalStatus(): PublicationOperationalComponentStatus {
    return this.getComponentStatus("EVENT_JOURNAL");
  }

  private requireStatus(component: PublicationOperationsComponent): PublicationOperationalComponentStatus {
    const status = this.statuses.get(component);
    if (status === undefined) throw operationsError("OPERATIONS_COMPONENT_UNAVAILABLE", "Operational component is unavailable.");
    return status;
  }
}

export class PublicationOperationsRetryPolicy {
  private readonly decisions = new Map<string, Readonly<{ operationIdentity: string; fingerprint: string; exhausted: boolean; completed: boolean; attempts: ReadonlyMap<number, Readonly<{ policyFingerprint: string; stateFingerprint: string; result: PublicationOperationsRetryDecision }>> }>>();

  public constructor(
    private readonly evidence: PublicationOperationalEvidenceStore,
    private readonly metrics: PublicationOperationalMetrics,
    private readonly clock: PublicationClock,
    private readonly authority?: PublicationOperationsRetryAuthority,
    private readonly status?: PublicationOperationsObserver,
    private readonly stateResolver?: PublicationOperationsRetryStateResolver,
  ) {}

  public decide(request: PublicationOperationsRetryRequest): PublicationOperationsRetryDecision {
    validateRetryRequest(request);
    const classification = classifyOperationalFailure(request.failureCode);
    const decisionKey = JSON.stringify([request.tenantId, request.idempotencyKey]);
    const prior = this.decisions.get(decisionKey);
    if (prior !== undefined && (prior.operationIdentity !== request.operationIdentity || prior.fingerprint !== request.fingerprint)) {
      throw operationsError("OPERATIONS_RECOVERY_CONFLICT", "Retry identity conflicts with prior technical work.");
    }
    const policyFingerprint = retryPolicyFingerprint(request);
    const replay = prior?.attempts.get(request.attemptNumber);
    if (replay !== undefined && replay.policyFingerprint !== policyFingerprint) {
      throw operationsError("OPERATIONS_RECOVERY_CONFLICT", "Retry policy input conflicts with the prior decision.");
    }
    if (prior?.exhausted === true) return immutableOperations({ decision: "EXHAUSTED", classification, retryEligible: false, retryExhausted: true, attemptNumber: request.attemptNumber, maximumAttempts: request.maximumAttempts, operationIdentity: request.operationIdentity });
    if (prior?.completed === true) return immutableOperations({ decision: "ALREADY_COMPLETED", classification, retryEligible: false, retryExhausted: false, attemptNumber: request.attemptNumber, maximumAttempts: request.maximumAttempts, operationIdentity: request.operationIdentity });
    let state;
    try {
      state = this.stateResolver?.resolve({ tenantId: request.tenantId, operationIdentity: request.operationIdentity, idempotencyKey: request.idempotencyKey });
    } catch {
      throw operationsError("OPERATIONS_RETRY_NOT_ALLOWED", "Retry state is unavailable.");
    }
    const stateFingerprint = retryStateFingerprint(state);
    const authorityCurrent = state?.authorityRevalidationRequired !== true || this.isAuthorityCurrent(request, state);
    if (state?.priorFingerprint !== undefined && state.priorFingerprint !== request.fingerprint) {
      throw operationsError("OPERATIONS_RECOVERY_CONFLICT", "Retry fingerprint conflicts with current technical state.");
    }
    let decision: PublicationOperationsRetryDecision["decision"] = "NOT_ALLOWED";
    if (state?.externalEffectCompleted === true) decision = "ALREADY_COMPLETED";
    else if (state === undefined || state.subsystemStatus === "FAILED" || !request.idempotencySafe) decision = "NOT_ALLOWED";
    else if (request.attemptNumber >= request.maximumAttempts) decision = "EXHAUSTED";
    else if (classification === "TRANSIENT" || classification === "DEPENDENCY_FAILURE") {
      if (!authorityCurrent) decision = "STALE_AUTHORITY";
      else decision = "ELIGIBLE";
    }
    if (replay?.stateFingerprint === stateFingerprint && replay.result.decision === decision) {
      return immutableOperations(replay.result);
    }
    const retryEligible = decision === "ELIGIBLE";
    const retryExhausted = decision === "EXHAUSTED";
    const reasonCode = decision === "ELIGIBLE" ? "OPERATIONS_RETRY_ELIGIBLE"
      : decision === "EXHAUSTED" ? "OPERATIONS_RETRY_EXHAUSTED"
        : decision === "STALE_AUTHORITY" ? "OPERATIONS_STALE_AUTHORITY"
          : decision === "ALREADY_COMPLETED" ? "OPERATIONS_EXTERNAL_EFFECT_ALREADY_COMPLETED"
            : "OPERATIONS_RETRY_NOT_ALLOWED";
    this.evidence.append(createEvidence({
      component: "CONNECTOR_ATTEMPT",
      operationType: "RETRY_DECISION",
      sourceReference: safeReference(request.operationIdentity),
      result: retryEligible ? "COMPLETED" : "DENIED",
      safeReasonCode: reasonCode,
      attemptNumber: request.attemptNumber,
      retryEligible,
      retryExhausted,
      correlationId: requireSafeIdentifier(request.correlationId),
      actorOrServiceReference: requireSafeIdentifier(request.actorOrServiceReference),
      recordedAt: this.clock.now(),
    }));
    if (retryEligible) this.metrics.increment("retryAttempts");
    if (retryExhausted) this.metrics.increment("retryExhausted");
    if (retryExhausted) {
      try { this.status?.observe({ component: "CONNECTOR_ATTEMPT", result: "FAILED", operationType: "RETRY_DECISION", attemptNumber: request.attemptNumber, failureCode: "DEPENDENCY_PERSISTENT_FAILURE", sourceReference: request.operationIdentity, correlationId: request.correlationId, actorOrServiceReference: request.actorOrServiceReference }); } catch { /* Retry policy remains deterministic if diagnostics fail. */ }
    } else if (retryEligible) {
      try { this.status?.observe({ component: "CONNECTOR_ATTEMPT", result: "COMPLETED", operationType: "RETRY_DECISION", attemptNumber: request.attemptNumber, sourceReference: request.operationIdentity, correlationId: request.correlationId, actorOrServiceReference: request.actorOrServiceReference }); } catch { /* Retry policy remains deterministic if diagnostics fail. */ }
    }
    const result = immutableOperations({ decision, classification, retryEligible, retryExhausted, attemptNumber: request.attemptNumber, maximumAttempts: request.maximumAttempts, operationIdentity: request.operationIdentity });
    const attempts = new Map(prior?.attempts ?? []);
    attempts.set(request.attemptNumber, Object.freeze({ policyFingerprint, stateFingerprint, result }));
    this.decisions.set(decisionKey, Object.freeze({ operationIdentity: request.operationIdentity, fingerprint: request.fingerprint, exhausted: retryExhausted, completed: decision === "ALREADY_COMPLETED", attempts }));
    return result;
  }

  private isAuthorityCurrent(
    request: PublicationOperationsRetryRequest,
    state: PublicationOperationsRetryState,
  ): boolean {
    if (state.authorizationRequest === undefined) return false;
    try {
      return this.authority?.revalidate(Object.freeze({
        tenantId: request.tenantId,
        operationIdentity: request.operationIdentity,
        idempotencyKey: request.idempotencyKey,
        correlationId: request.correlationId,
        actorOrServiceReference: request.actorOrServiceReference,
        authorizationRequest: state.authorizationRequest,
      })) === true;
    } catch {
      return false;
    }
  }
}

function retryPolicyFingerprint(request: PublicationOperationsRetryRequest): string {
  return createHash("sha256").update(JSON.stringify({
    failureCode: normalizeFailureCode(request.failureCode),
    maximumAttempts: request.maximumAttempts,
    idempotencySafe: request.idempotencySafe,
  })).digest("hex");
}

function retryStateFingerprint(state: ReturnType<PublicationOperationsRetryStateResolver["resolve"]>): string {
  return createHash("sha256").update(JSON.stringify(state === undefined ? null : {
    priorFingerprint: state.priorFingerprint ?? null,
    externalEffectCompleted: state.externalEffectCompleted,
    subsystemStatus: state.subsystemStatus,
    authorityRevalidationRequired: state.authorityRevalidationRequired,
  })).digest("hex");
}


export function classifyOperationalFailure(failureCode: string): PublicationOperationalFailureClassification {
  const code = normalizeFailureCode(failureCode);
  if (code === undefined) return "UNKNOWN";
  if (code.includes("AUTHORIZATION") || code.includes("AUTHENTICATION") || code.includes("MFA") || code.includes("PERMISSION") || code.includes("APPROVAL") || code.includes("VERIFICATION") || code.includes("SEPARATION_OF_DUTIES") || code.includes("STALE_AUTHORITY")) return "AUTHORITY_FAILURE";
  if (code.includes("INTEGRITY")) return "INTEGRITY_FAILURE";
  if (code.includes("PROJECTION") && (code.includes("DRIFT") || code.includes("GAP") || code.includes("OUT_OF_ORDER") || code.includes("STALE"))) return "DRIFT";
  if (code.includes("CONFLICT")) return "CONFLICT";
  if (code.includes("PERSISTENT")) return "PERSISTENT";
  if (code.includes("TIMEOUT") || code.includes("TEMPORARY") || code.includes("TRANSIENT") || code.endsWith("_UNAVAILABLE")) return "TRANSIENT";
  if (code.includes("DEPENDENCY")) return "DEPENDENCY_FAILURE";
  return "UNKNOWN";
}

function validateObservation(observation: PublicationOperationsObservation): void {
  if (!PUBLICATION_OPERATIONS_COMPONENTS.includes(observation.component)
    || (observation.result !== "COMPLETED" && observation.result !== "FAILED")
    || (observation.result === "FAILED" && (observation.failureCode === undefined || normalizeFailureCode(observation.failureCode) === undefined))
    || (observation.operationType !== undefined && !["OBSERVATION", "RETRY_DECISION", "REBUILD_REQUESTED", "REBUILD_COMPLETED", "REBUILD_FAILED"].includes(observation.operationType))
    || (observation.attemptNumber !== undefined && (!Number.isSafeInteger(observation.attemptNumber) || observation.attemptNumber < 0 || observation.attemptNumber > 100))) {
    throw operationsError("INTERNAL_OPERATIONS_ERROR", "Operational observation is invalid.");
  }
  requireSafeIdentifier(observation.correlationId);
  requireSafeIdentifier(observation.actorOrServiceReference);
}

function validateRetryRequest(request: PublicationOperationsRetryRequest): void {
  if (!Number.isSafeInteger(request.attemptNumber) || request.attemptNumber < 1
    || !Number.isSafeInteger(request.maximumAttempts) || request.maximumAttempts < 1
    || request.attemptNumber > 100 || request.maximumAttempts > 100) {
    throw operationsError("OPERATIONS_RETRY_NOT_ALLOWED", "Retry policy request is invalid.");
  }
  for (const value of [request.tenantId, request.operationIdentity, request.idempotencyKey, request.fingerprint, request.correlationId, request.actorOrServiceReference]) requireSafeIdentifier(value);
}

function validateRebuildRequest(request: PublicationOperationsRebuildRequest): void {
  for (const value of [request.sessionId, request.tenantId, request.publicationId, request.generationId, request.correlationId, request.idempotencyKey]) requireSafeIdentifier(value);
  const reason = request.reason.trim();
  if (reason.length < 3 || reason.length > 256 || /[\u0000-\u001f\u007f]/.test(reason)) throw operationsError("OPERATIONS_RECOVERY_NOT_ALLOWED", "Projection rebuild reason is invalid.");
  if (request.expectedServingGenerationId !== undefined) requireSafeIdentifier(request.expectedServingGenerationId);
  if (!Number.isSafeInteger(request.sourceFromSequence) || request.sourceFromSequence < 1) {
    throw operationsError("OPERATIONS_RECOVERY_NOT_ALLOWED", "Projection rebuild request is invalid.");
  }
}

function normalizeFailureCode(value: string): string | undefined {
  const trimmed = value.trim();
  return /^[A-Z][A-Z0-9_]{2,127}$/.test(trimmed) ? trimmed : undefined;
}

function requireSafeIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9:_.@-]{0,127}$/.test(trimmed)) throw operationsError("INTERNAL_OPERATIONS_ERROR", "Operational identifier is invalid.");
  return trimmed;
}

function safeReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeOperationalReason(classification: PublicationOperationalFailureClassification): string {
  return classification === "INTEGRITY_FAILURE" ? "OPERATIONS_INTEGRITY_FAILURE"
    : classification === "AUTHORITY_FAILURE" ? "OPERATIONS_UNAUTHORIZED"
      : classification === "DRIFT" ? "OPERATIONS_DEGRADED"
        : classification === "TRANSIENT" || classification === "DEPENDENCY_FAILURE" ? "OPERATIONS_DEPENDENCY_FAILURE"
          : classification === "CONFLICT" ? "OPERATIONS_RECOVERY_CONFLICT"
            : classification === "PERSISTENT" ? "OPERATIONS_COMPONENT_UNAVAILABLE"
              : "INTERNAL_OPERATIONS_ERROR";
}

function incrementFailureMetric(metrics: PublicationOperationalMetrics, component: PublicationOperationsComponent, classification: PublicationOperationalFailureClassification | undefined): void {
  if (classification === undefined) return;
  if (component === "EVENT_JOURNAL") metrics.increment(classification === "INTEGRITY_FAILURE" ? "journalIntegrityFailures" : "journalAppendFailures");
  if (component === "LISTING_PROJECTION") {
    metrics.increment("projectionApplyFailures");
    if (classification === "DRIFT") metrics.increment("projectionDriftDetected");
  }
  if (component === "CONNECTOR_ATTEMPT") metrics.increment("connectorFailures");
  if (component === "RECONCILIATION") metrics.increment("reconciliationFailures");
}

function createEvidence(input: Omit<PublicationOperationalEvidence, "operationEvidenceId">): PublicationOperationalEvidence {
  const operationEvidenceId = `ops:${createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
  return immutableOperations({ operationEvidenceId, ...input });
}
