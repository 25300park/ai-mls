export const PUBLICATION_OPERATIONS_COMPONENTS = Object.freeze([
  "PUBLICATION_APPLICATION",
  "EVENT_JOURNAL",
  "LISTING_PROJECTION",
  "PROJECTION_REBUILD",
  "CONNECTOR_ATTEMPT",
  "RECONCILIATION",
  "API_RUNTIME_HOST",
] as const);

export type PublicationOperationsComponent = typeof PUBLICATION_OPERATIONS_COMPONENTS[number];
export type PublicationOperationalStatus = "HEALTHY" | "DEGRADED" | "RECOVERING" | "FAILED";
export type PublicationOperationalFailureClassification =
  | "TRANSIENT"
  | "PERSISTENT"
  | "CONFLICT"
  | "AUTHORITY_FAILURE"
  | "INTEGRITY_FAILURE"
  | "DEPENDENCY_FAILURE"
  | "DRIFT"
  | "UNKNOWN";

export interface PublicationOperationsObservation {
  readonly component: PublicationOperationsComponent;
  readonly result: "COMPLETED" | "FAILED";
  readonly failureCode?: string;
  readonly sourceReference: string;
  readonly correlationId: string;
  readonly actorOrServiceReference: string;
  readonly operationType?: PublicationOperationalEvidenceOperation;
  readonly attemptNumber?: number;
}

export interface PublicationOperationsObserver {
  observe(observation: PublicationOperationsObservation): PublicationOperationalComponentStatus;
}

export interface PublicationOperationalComponentStatus {
  readonly component: PublicationOperationsComponent;
  readonly status: PublicationOperationalStatus;
  readonly reasonCode: string;
  readonly firstObservedAt: string;
  readonly lastObservedAt: string;
  readonly failureCount: number;
  readonly retryCount: number;
  readonly retryExhausted: boolean;
  readonly recoverable: boolean;
  readonly sourceReference: string;
  readonly correlationId: string;
}

export interface PublicationSystemOperationalStatus {
  readonly health: "HEALTHY" | "DEGRADED" | "FAILED";
  readonly readiness: Readonly<{
    readonly operationsRead: boolean;
    readonly publicationMutation: boolean;
    readonly projectionRead: boolean;
  }>;
  readonly components: readonly PublicationOperationalComponentStatus[];
  readonly observedAt: string;
}

export type PublicationOperationalEvidenceOperation =
  | "OBSERVATION"
  | "RETRY_DECISION"
  | "REBUILD_REQUESTED"
  | "REBUILD_COMPLETED"
  | "REBUILD_FAILED";

export interface PublicationOperationalEvidence {
  readonly operationEvidenceId: string;
  readonly component: PublicationOperationsComponent;
  readonly operationType: PublicationOperationalEvidenceOperation;
  readonly sourceReference: string;
  readonly result: "COMPLETED" | "FAILED" | "DENIED";
  readonly safeReasonCode: string;
  readonly attemptNumber: number;
  readonly retryEligible: boolean;
  readonly retryExhausted: boolean;
  readonly correlationId: string;
  readonly actorOrServiceReference: string;
  readonly recordedAt: string;
}

export interface PublicationOperationalEvidenceFilter {
  readonly component?: PublicationOperationsComponent;
  readonly sourceReference?: string;
}

export interface PublicationOperationalEvidenceStore {
  append(evidence: PublicationOperationalEvidence): PublicationOperationalEvidence;
  list(filter?: PublicationOperationalEvidenceFilter): readonly PublicationOperationalEvidence[];
}

export interface PublicationOperationalMetricsSnapshot {
  readonly operationsObserved: number;
  readonly operationsSucceeded: number;
  readonly operationsFailed: number;
  readonly retryAttempts: number;
  readonly retryExhausted: number;
  readonly journalAppendFailures: number;
  readonly journalIntegrityFailures: number;
  readonly projectionApplyFailures: number;
  readonly projectionDriftDetected: number;
  readonly projectionRebuildRequested: number;
  readonly projectionRebuildSucceeded: number;
  readonly projectionRebuildFailed: number;
  readonly connectorFailures: number;
  readonly reconciliationFailures: number;
}

export type PublicationOperationalMetric = keyof PublicationOperationalMetricsSnapshot;

export interface PublicationOperationalMetrics {
  increment(metric: PublicationOperationalMetric): void;
  snapshot(): PublicationOperationalMetricsSnapshot;
}

export interface PublicationOperationsRetryRequest {
  readonly tenantId: string;
  readonly operationIdentity: string;
  readonly failureCode: string;
  readonly attemptNumber: number;
  readonly maximumAttempts: number;
  readonly idempotencySafe: boolean;
  readonly requiresAuthorityRevalidation: boolean;
  readonly idempotencyKey: string;
  readonly fingerprint: string;
  readonly correlationId: string;
  readonly actorOrServiceReference: string;
}

export interface PublicationOperationsRetryDecision {
  readonly decision: "ELIGIBLE" | "NOT_ALLOWED" | "EXHAUSTED" | "ALREADY_COMPLETED" | "STALE_AUTHORITY";
  readonly classification: PublicationOperationalFailureClassification;
  readonly retryEligible: boolean;
  readonly retryExhausted: boolean;
  readonly attemptNumber: number;
  readonly maximumAttempts: number;
  readonly operationIdentity: string;
}

export interface PublicationOperationsRetryAuthority {
  revalidate(request: PublicationOperationsRetryRequest): boolean;
}

export interface PublicationOperationsRetryState {
  readonly priorFingerprint?: string;
  readonly externalEffectCompleted: boolean;
  readonly subsystemStatus: PublicationOperationalStatus;
}

export interface PublicationOperationsRetryStateResolver {
  resolve(request: Readonly<{ tenantId: string; operationIdentity: string; idempotencyKey: string }>): PublicationOperationsRetryState | undefined;
}

export interface PublicationProjectionOperationalStatus {
  readonly projectionId: "PRJ-002";
  readonly publicationId: string;
  readonly servingGeneration?: string;
  readonly projectionStatus: "UNAVAILABLE" | "ACTIVE" | "STALE" | "REBUILDING" | "FAILED";
  readonly stale: boolean;
  readonly staleReason?: string;
  readonly lastEventSequence?: number;
  readonly sourceAggregateVersion?: number;
  readonly publicationVersion?: number;
  readonly projectionRecordVersion?: number;
  readonly definitionVersion?: string;
  readonly schemaVersion?: string;
  readonly lastSuccessfulApply?: string;
  readonly lastSuccessfulRebuild?: string;
}

export interface PublicationOperationsRebuildRequest {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly publicationId: string;
  readonly generationId: string;
  readonly expectedServingGenerationId?: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly sourceFromSequence: number;
}

export interface PublicationOperationsRebuildAuthority {
  authorize(request: Readonly<{
    session: SessionContext;
    tenantId: string;
    publicationId: string;
    reason: string;
    action: "projection.rebuild";
    purpose: "PROJECTION_REBUILD";
    correlationId: string;
  }>): boolean;
}

export function immutableOperations<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
import type { SessionContext } from "../../identity/src/session-service.js";
