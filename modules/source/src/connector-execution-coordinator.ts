import {
  ConnectorPersistenceError,
  type ConnectorExecutionScope,
  type ConnectorInvocation,
  type DurableConnectorExecutionUnitOfWork,
} from "./connector-durable-persistence.js";
import type { ConnectorInvocationPort, ConnectorInvocationRequest } from "./connector-invocation-port.js";
import type { SourceIngestionAdmissionGate, SourceIngestionAdmissionInput } from "./source-ingestion-admission.js";

export type ConnectorExecutionInput = Readonly<{
  readonly admissionInput: SourceIngestionAdmissionInput;
  readonly leaseId: string;
  readonly leaseOwnerId: string;
  readonly leaseAcquiredAt: string;
  readonly leaseExpiresAt: string;
  readonly expectedScopeRevision: number;
  readonly invocationId: string;
  readonly idempotencyKey: string;
  readonly inputFingerprint: string;
  readonly inputReference: string;
  readonly inputVersion: number;
  readonly expectedCheckpointVersion: number;
  readonly preparedAt: string;
  readonly startedAt: string;
  readonly completedAt: string;
}>;

export type ConnectorExecutionResult =
  | Readonly<{ readonly status: "BLOCKED"; readonly reasonCode: "ADMISSION_DENIED" }>
  | Readonly<{ readonly status: "SUCCEEDED" | "FAILED"; readonly reasonCode: string; readonly invocationId: string; readonly resultId: string }>
  | Readonly<{ readonly status: "AMBIGUOUS"; readonly reasonCode: "RECONCILIATION_REQUIRED"; readonly invocationId: string }>;

export class ConnectorExecutionCoordinator {
  public constructor(private readonly dependencies: Readonly<{
    readonly persistence: DurableConnectorExecutionUnitOfWork;
    readonly connector: ConnectorInvocationPort;
    readonly admission: Pick<SourceIngestionAdmissionGate, "evaluate">;
  }>) {}

  public execute(input: ConnectorExecutionInput): ConnectorExecutionResult {
    const admission = this.dependencies.admission.evaluate(input.admissionInput);
    if (admission.status === "BLOCKED") return Object.freeze({ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
    const scope: ConnectorExecutionScope = Object.freeze({
      tenantId: admission.tenantId,
      scopeType: admission.scope.scopeType,
      scopeId: admission.scope.scopeId,
      sourceId: admission.sourceId,
      connectorId: admission.connectorId,
    });
    const priorIdempotency = this.dependencies.persistence.findIdempotency(scope, input.idempotencyKey);
    if (priorIdempotency !== undefined) {
      if (priorIdempotency.invocationId !== input.invocationId || priorIdempotency.inputFingerprint !== input.inputFingerprint) {
        throw new ConnectorPersistenceError("IDEMPOTENCY_CONFLICT", "Connector idempotency identity conflicts.");
      }
      const prior = this.dependencies.persistence.findInvocation(scope, input.invocationId);
      if (prior === undefined) throw new ConnectorPersistenceError("PERSISTENCE_UNAVAILABLE", "Connector invocation linkage is invalid.");
      return resultFrom(prior);
    }

    this.dependencies.persistence.acquireLease({
      ...scope,
      leaseId: input.leaseId,
      ownerId: input.leaseOwnerId,
      acquiredAt: input.leaseAcquiredAt,
      expiresAt: input.leaseExpiresAt,
      expectedScopeRevision: input.expectedScopeRevision,
    });
    const intent = this.dependencies.persistence.prepareInvocation({
      ...scope,
      invocationId: input.invocationId,
      leaseId: input.leaseId,
      idempotencyKey: input.idempotencyKey,
      inputFingerprint: input.inputFingerprint,
      inputReference: input.inputReference,
      inputVersion: input.inputVersion,
      sourcePolicyVersion: admission.sourcePolicyVersion,
      connectorVersion: admission.connectorVersion,
      expectedCheckpointVersion: input.expectedCheckpointVersion,
      preparedAt: input.preparedAt,
    });
    const claim = this.dependencies.persistence.markExecutionStarted(scope, input.invocationId, input.startedAt);
    if (!claim.claimed) return resultFrom(claim.invocation);

    const connectorRequest: ConnectorInvocationRequest = Object.freeze({
      ...scope,
      invocationId: intent.invocationId,
      inputReference: intent.inputReference,
      inputVersion: intent.inputVersion,
      sourcePolicyVersion: intent.sourcePolicyVersion,
      connectorVersion: intent.connectorVersion,
    });
    let response: ReturnType<ConnectorInvocationPort["invoke"]>;
    try { response = this.dependencies.connector.invoke(connectorRequest); }
    catch { return ambiguous(intent.invocationId); }

    const resultId = `${intent.invocationId}:result`;
    const normalized = normalizeResponse(response, intent.invocationId);
    const completed = this.dependencies.persistence.completeInvocation({
      ...scope,
      invocationId: intent.invocationId,
      resultId,
      outcome: normalized.outcome,
      reasonCode: normalized.reasonCode,
      safeEvidenceReference: normalized.safeEvidenceReference,
      ...(normalized.checkpointReference === undefined ? {} : { checkpointReference: normalized.checkpointReference }),
      expectedCheckpointVersion: intent.expectedCheckpointVersion,
      completedAt: input.completedAt,
    });
    return resultFrom(completed);
  }
}

function resultFrom(invocation: ConnectorInvocation): ConnectorExecutionResult {
  if (invocation.state === "AMBIGUOUS" || invocation.state === "PREPARED") return ambiguous(invocation.invocationId);
  if (invocation.result === undefined) return ambiguous(invocation.invocationId);
  return Object.freeze({ status: invocation.state, reasonCode: invocation.result.reasonCode, invocationId: invocation.invocationId, resultId: invocation.result.resultId });
}

function ambiguous(invocationId: string): Extract<ConnectorExecutionResult, { readonly status: "AMBIGUOUS" }> {
  return Object.freeze({ status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId });
}

function normalizeResponse(response: ReturnType<ConnectorInvocationPort["invoke"]>, invocationId: string): ReturnType<ConnectorInvocationPort["invoke"]> {
  const invalid = (): ReturnType<ConnectorInvocationPort["invoke"]> => Object.freeze({ outcome: "UNKNOWN", reasonCode: "OUTCOME_UNPROVEN", safeEvidenceReference: `connector-observation:${invocationId}:invalid-result` });
  try {
    if (!isSafeReference(response.safeEvidenceReference) || !isSafeReference(response.reasonCode)) return invalid();
    if (response.outcome === "SUCCEEDED") {
      return isSafeReference(response.checkpointReference) ? Object.freeze({ outcome: response.outcome, reasonCode: response.reasonCode, safeEvidenceReference: response.safeEvidenceReference, checkpointReference: response.checkpointReference }) : invalid();
    }
    if ((response.outcome === "FAILED" || response.outcome === "UNKNOWN") && response.checkpointReference === undefined) {
      return Object.freeze({ outcome: response.outcome, reasonCode: response.reasonCode, safeEvidenceReference: response.safeEvidenceReference });
    }
  } catch { /* connector-controlled access cannot escape the safe boundary */ }
  return invalid();
}

function isSafeReference(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u.test(value) && !/(?:authorization|bearer|cookie|credential|password|secret|token|api[-_]?key|private[-_]?key)/iu.test(value);
}
