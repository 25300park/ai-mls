import { createHash } from "node:crypto";

import { isAuthenticationAssuranceConsistent, type SessionContext } from "../../identity/src/session-service.js";
import { parseConnectorApiRequest, type ConnectorApiOperation, type ConnectorApiRequest, type ConnectorApiRequestKind } from "./connector-api-contracts.js";
import { ConnectorPersistenceError, type ConnectorExecutionScope, type ConnectorTechnicalRecordType, type DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";
import type { ConnectorExecutionCoordinator, ConnectorExecutionInput } from "./connector-execution-coordinator.js";
import type { SourceIngestionScope } from "./source-ingestion-admission.js";
import type { ExternalIntegrationApplicationResult } from "./external-integration-application.js";

export type ConnectorTrustedRuntimeContext = Readonly<{
  readonly session: SessionContext;
  readonly tenantId: string;
  readonly scope: SourceIngestionScope;
  readonly sourceId: string;
  readonly connectorId: string;
  readonly purpose: string;
  readonly sourcePolicyVersion: number;
  readonly connectorVersion: number;
  readonly correlationId: string;
}>;

export interface ConnectorRuntimeContextResolver {
  resolve(sessionId: string): ConnectorTrustedRuntimeContext | undefined;
}

export interface ConnectorRuntimeAuthorizer {
  authorize(input: Readonly<{ readonly context: ConnectorTrustedRuntimeContext; readonly operation: ConnectorApiOperation; readonly resourceId: string }>): boolean;
}

export type ConnectorApplicationErrorCode = "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VERSION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "CONFLICT" | "LEASE_CONFLICT" | "CHECKPOINT_CONFLICT" | "CONNECTOR_UNAVAILABLE" | "AMBIGUOUS_EXECUTION" | "INTERNAL_ERROR";
export type ConnectorApplicationResult = Readonly<{ readonly ok: true; readonly operation: ConnectorApiOperation; readonly data: Readonly<Record<string, unknown>> }>
  | Readonly<{ readonly ok: false; readonly error: Readonly<{ readonly code: ConnectorApplicationErrorCode; readonly message: string }> }>;

export class ConnectorRuntimeApplication {
  public constructor(private readonly dependencies: Readonly<{
    readonly persistence: DurableConnectorExecutionUnitOfWork;
    readonly contextResolver: ConnectorRuntimeContextResolver;
    readonly authorizer: ConnectorRuntimeAuthorizer;
    readonly coordinator: Pick<ConnectorExecutionCoordinator, "execute">;
    readonly clock: () => string;
    readonly executionAvailable?: boolean;
    readonly externalObservationSink?: Readonly<{ submit(input: unknown, sessionId: string): ExternalIntegrationApplicationResult }>;
  }>) {}

  public execute(kind: ConnectorApiRequestKind, input: unknown): ConnectorApplicationResult {
    let request: ConnectorApiRequest;
    try { request = parseConnectorApiRequest(kind, input); }
    catch { return error("VALIDATION_FAILED", "Connector request is invalid."); }
    const now = this.dependencies.clock();
    let context: ConnectorTrustedRuntimeContext | undefined;
    try { context = this.dependencies.contextResolver.resolve(stringField(request, "sessionId")); } catch { context = undefined; }
    if (!isValidConnectorTrustedRuntimeContext(context, now)) return error("UNAUTHENTICATED", "Authentication is required.");
    if ((optionalString(request, "sourceId") !== undefined && optionalString(request, "sourceId") !== context.sourceId)
      || (optionalString(request, "connectorId") !== undefined && optionalString(request, "connectorId") !== context.connectorId)) {
      return error("FORBIDDEN", "Connector operation is not permitted.");
    }
    const resourceId = resourceIdentity(request);
    try {
      if (!this.dependencies.authorizer.authorize({ context, operation: request.operation, resourceId })) return error("FORBIDDEN", "Connector operation is not permitted.");
    } catch { return error("FORBIDDEN", "Connector operation is not permitted."); }
    const scope: ConnectorExecutionScope = Object.freeze({ tenantId: context.tenantId, scopeType: context.scope.scopeType, scopeId: context.scope.scopeId, sourceId: context.sourceId, connectorId: context.connectorId });
    try { return this.dispatch(request, context, scope, now); }
    catch (caught) { return mapFailure(caught); }
  }

  private dispatch(request: ConnectorApiRequest, context: ConnectorTrustedRuntimeContext, scope: ConnectorExecutionScope, now: string): ConnectorApplicationResult {
    switch (request.operation) {
      case "SubmitCaptureBatch": return this.submitCaptureBatch(request, context, scope, now);
      case "ReadBatchStatus": return this.readBatch(request, scope);
      case "AdvanceCheckpoint": return this.readCommittedCheckpoint(request, scope);
      case "RegisterConnectorInstance": return this.record(request, scope, "CONNECTOR_INSTANCE", stringField(request, "instanceId"), "REGISTERED", `evidence:connector-instance:${stringField(request, "instanceId")}`, now, { instanceId: stringField(request, "instanceId") });
      case "LeaseApprovedDelivery": return this.record(request, scope, "DELIVERY_ATTEMPT", stringField(request, "deliveryAttemptId"), "LEASED", `evidence:delivery-lease:${stringField(request, "deliveryAttemptId")}`, now, { deliveryAttemptId: stringField(request, "deliveryAttemptId"), leaseId: `${stringField(request, "deliveryAttemptId")}:lease`, acquiredAt: now, expiresAt: new Date(Date.parse(now) + 300_000).toISOString() });
      case "ReportDeliveryAttempt": return this.record(request, scope, "DELIVERY_ATTEMPT", stringField(request, "deliveryAttemptId"), stringField(request, "outcome"), optionalString(request, "safeExternalReference") ?? `evidence:delivery-attempt:${stringField(request, "invocationId")}`, now, { deliveryAttemptId: stringField(request, "deliveryAttemptId"), invocationId: stringField(request, "invocationId") });
      case "SubmitExternalObservation": return this.submitExternalObservation(request, scope, context);
      case "ReportHealth": return this.record(request, scope, "HEALTH_SIGNAL", stringField(request, "instanceId"), stringField(request, "healthStatus"), `evidence:connector-health:${stringField(request, "instanceId")}`, stringField(request, "observedAt"), { instanceId: stringField(request, "instanceId"), acceptedHealthStatus: stringField(request, "healthStatus"), observedAt: stringField(request, "observedAt") });
    }
  }

  private submitExternalObservation(request: ConnectorApiRequest, scope: ConnectorExecutionScope, context: ConnectorTrustedRuntimeContext): ConnectorApplicationResult {
    if (this.dependencies.externalObservationSink === undefined) return error("INTERNAL_ERROR", "Connector operation could not be completed.");
    const result = this.dependencies.externalObservationSink.submit({
      operation: "SubmitProviderObservation", integrationContractId: stringField(request, "integrationContractId"),
      observationId: stringField(request, "observationId"), providerNamespace: stringField(request, "providerNamespace"),
      externalObjectId: stringField(request, "externalObjectId"), connectorId: scope.connectorId, sourceId: scope.sourceId,
      observationType: stringField(request, "observationType"), normalizedFields: request["normalizedFields"],
      observedAt: stringField(request, "observedAt"), idempotencyKey: stringField(request, "idempotencyKey"),
      expectedMappingVersion: numberField(request, "expectedVersion"),
    }, context.session.id);
    if (!result.ok) return error(result.error.code, result.error.message);
    return this.record(request, scope, "EXTERNAL_OBSERVATION", stringField(request, "observationId"), "OBSERVED", String(result.data["evidenceRef"]), stringField(request, "observedAt"), { observationId: stringField(request, "observationId"), mappingState: result.data["mappingState"] });
  }

  private submitCaptureBatch(request: ConnectorApiRequest, context: ConnectorTrustedRuntimeContext, scope: ConnectorExecutionScope, now: string): ConnectorApplicationResult {
    if (this.dependencies.executionAvailable === false) return error("CONNECTOR_UNAVAILABLE", "Connector execution is unavailable.");
    const invocationId = stringField(request, "invocationId");
    const expectedVersion = numberField(request, "expectedVersion");
    const executionInput: ConnectorExecutionInput = Object.freeze({
      admissionInput: Object.freeze({ actor: context.session, tenantId: context.tenantId, scope: context.scope, sourceId: scope.sourceId, sourcePolicyVersion: context.sourcePolicyVersion, connectorId: scope.connectorId, connectorVersion: context.connectorVersion, method: "CONNECTOR", purpose: context.purpose, correlationId: context.correlationId }),
      leaseId: `${invocationId}:lease`, leaseOwnerId: context.session.principalId, leaseAcquiredAt: now,
      leaseExpiresAt: new Date(Date.parse(now) + 300_000).toISOString(), expectedScopeRevision: expectedVersion,
      invocationId, idempotencyKey: stringField(request, "idempotencyKey"), inputFingerprint: fingerprint(request),
      inputReference: arrayField(request, "captureItemEvidenceRefs")[0]!, inputVersion: expectedVersion + 1,
      expectedCheckpointVersion: expectedVersion, preparedAt: now, startedAt: now, completedAt: now,
    });
    const execution = this.dependencies.coordinator.execute(executionInput);
    if (execution.status === "BLOCKED") return error("FORBIDDEN", "Connector operation is not permitted.");
    const state = this.dependencies.persistence.recordTechnicalState({ ...scope, recordType: "CAPTURE_BATCH", recordId: stringField(request, "batchId"), status: execution.status, expectedVersion, idempotencyKey: stringField(request, "idempotencyKey"), inputFingerprint: fingerprint(request), safeEvidenceReference: `evidence:capture-batch:${stringField(request, "batchId")}`, recordedAt: now, bindingReference: invocationId });
    return success(request.operation, { batchId: state.recordId, invocationId, technicalStatus: state.status, currentVersion: state.version, evidenceRef: state.safeEvidenceReference, reasonCode: execution.reasonCode });
  }

  private readBatch(request: ConnectorApiRequest, scope: ConnectorExecutionScope): ConnectorApplicationResult {
    const batchId = stringField(request, "batchId");
    const state = this.dependencies.persistence.findTechnicalState(scope, "CAPTURE_BATCH", batchId);
    if (state === undefined) return error("NOT_FOUND", "Connector resource is unavailable.");
    const invocation = state.bindingReference === undefined ? undefined : this.dependencies.persistence.findInvocation(scope, state.bindingReference);
    const checkpoint = this.dependencies.persistence.findCheckpoint(scope);
    return success(request.operation, { batchId, ...(state.bindingReference === undefined ? {} : { invocationId: state.bindingReference }), technicalStatus: state.status, normalizedOutcome: invocation?.result?.outcome ?? state.status, currentVersion: state.version, evidenceRef: state.safeEvidenceReference, updatedAt: state.recordedAt, ...(checkpoint === undefined ? {} : { checkpointReference: checkpoint.checkpointReference, checkpointVersion: checkpoint.version }) });
  }

  private readCommittedCheckpoint(request: ConnectorApiRequest, scope: ConnectorExecutionScope): ConnectorApplicationResult {
    const invocation = this.dependencies.persistence.findInvocation(scope, stringField(request, "invocationId"));
    const checkpoint = this.dependencies.persistence.findCheckpoint(scope);
    if (invocation?.state !== "SUCCEEDED" || checkpoint?.version !== numberField(request, "priorCheckpointVersion") + 1 || checkpoint?.checkpointReference !== stringField(request, "checkpointCandidate")) {
      return error("CHECKPOINT_CONFLICT", "Connector checkpoint is unavailable.");
    }
    return success(request.operation, { invocationId: invocation.invocationId, checkpointReference: checkpoint.checkpointReference, checkpointVersion: checkpoint.version, evidenceRef: checkpoint.safeEvidenceReference });
  }

  private record(request: ConnectorApiRequest, scope: ConnectorExecutionScope, recordType: ConnectorTechnicalRecordType, recordId: string, status: string, evidence: string, recordedAt: string, additions: Readonly<Record<string, unknown>> = {}): ConnectorApplicationResult {
    const state = this.dependencies.persistence.recordTechnicalState({ ...scope, recordType, recordId, status, expectedVersion: numberField(request, "expectedVersion"), idempotencyKey: stringField(request, "idempotencyKey"), inputFingerprint: fingerprint(request), safeEvidenceReference: evidence, recordedAt });
    return success(request.operation, { connectorId: scope.connectorId, status: state.status, version: state.version, evidenceRef: state.safeEvidenceReference, updatedAt: state.recordedAt, ...additions });
  }
}

export function isValidConnectorTrustedRuntimeContext(context: ConnectorTrustedRuntimeContext | undefined, now: string): context is ConnectorTrustedRuntimeContext {
  return context?.session.state === "ACTIVE" && context.session.id.trim().length > 0
    && Date.parse(context.session.expiresAt) > Date.parse(now) && Date.parse(context.session.absoluteExpiresAt) > Date.parse(now)
    && isAuthenticationAssuranceConsistent(context.session) && context.tenantId.trim().length > 0 && context.scope.scopeId.trim().length > 0
    && context.sourceId.trim().length > 0 && context.connectorId.trim().length > 0
    && (context.scope.scopeType !== "TEAM" || context.session.teamId === context.scope.scopeId) && context.purpose.trim().length > 0;
}

function resourceIdentity(request: ConnectorApiRequest): string {
  for (const field of ["batchId", "deliveryAttemptId", "observationId", "instanceId", "invocationId", "connectorId"]) {
    const value = optionalString(request, field); if (value !== undefined) return value;
  }
  return "connector-resource";
}
function stringField(request: ConnectorApiRequest, field: string): string { const value = request[field]; if (typeof value !== "string") throw new Error("invalid request"); return value; }
function optionalString(request: ConnectorApiRequest, field: string): string | undefined { const value = request[field]; return typeof value === "string" ? value : undefined; }
function numberField(request: ConnectorApiRequest, field: string): number { const value = request[field]; if (typeof value !== "number") throw new Error("invalid request"); return value; }
function arrayField(request: ConnectorApiRequest, field: string): readonly string[] { const value = request[field]; if (!Array.isArray(value)) throw new Error("invalid request"); return value as readonly string[]; }
function fingerprint(request: ConnectorApiRequest): string { return createHash("sha256").update(JSON.stringify(request)).digest("hex"); }
function success(operation: ConnectorApiOperation, data: Record<string, unknown>): ConnectorApplicationResult { return Object.freeze({ ok: true as const, operation, data: Object.freeze(data) }); }
function error(code: ConnectorApplicationErrorCode, message: string): ConnectorApplicationResult { return Object.freeze({ ok: false as const, error: Object.freeze({ code, message }) }); }
function mapFailure(caught: unknown): ConnectorApplicationResult {
  if (caught instanceof ConnectorPersistenceError) {
    if (caught.code === "IDEMPOTENCY_CONFLICT") return error("IDEMPOTENCY_CONFLICT", "Connector request conflicts with prior execution.");
    if (caught.code === "LEASE_CONFLICT" || caught.code === "LEASE_NOT_FOUND" || caught.code === "LEASE_VERSION_CONFLICT") return error("LEASE_CONFLICT", "Connector lease is unavailable.");
    if (caught.code === "CHECKPOINT_VERSION_CONFLICT") return error("CHECKPOINT_CONFLICT", "Connector checkpoint changed.");
    if (caught.code === "TECHNICAL_VERSION_CONFLICT" || caught.code === "INVOCATION_CONFLICT") return error("VERSION_CONFLICT", "Connector resource changed.");
  }
  return error("INTERNAL_ERROR", "Connector operation failed.");
}
