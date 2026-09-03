import type { DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";
import type { ConnectorExecutionCoordinator, ConnectorExecutionInput, ConnectorExecutionResult } from "./connector-execution-coordinator.js";
import type { SourceIngestionAdmissionInput } from "./source-ingestion-admission.js";
import { isValidConnectorTrustedRuntimeContext, type ConnectorRuntimeAuthorizer, type ConnectorRuntimeContextResolver, type ConnectorTrustedRuntimeContext } from "./connector-runtime-application.js";
import { createHash } from "node:crypto";
import type { IntegrationContract } from "./external-integration-durable-persistence.js";
import type { RecoveryCaseRecord } from "../../recovery/src/recovery-orchestration-contracts.js";

export type AuthorizedConnectorRecovery = Readonly<{
  readonly recoveryId: string;
  readonly recoveryCaseId: string;
  readonly resourceType: "ConnectorInvocation";
  readonly resourceId: string;
  readonly originDomain: "CONNECTOR";
  readonly originIdentity: Readonly<{ readonly invocationId: string }>;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly status: "RESOLVED";
  readonly version: number;
  readonly evidenceRefs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly findingRecordId: string;
  readonly finding: "CONFIRMED_NOT_EXECUTED";
  readonly findingReasonCode: string;
  readonly findingEvidenceRefs: readonly string[];
  readonly findingDecidedBy: string;
  readonly findingDecidedAt: string;
  readonly dispositionRecordId: string;
  readonly recoveryDisposition: "RECOVERY_AUTHORIZED";
  readonly recoveryActionType: "CONNECTOR_REEXECUTION";
  readonly dispositionEvidenceRefs: readonly string[];
  readonly dispositionDecidedBy: string;
  readonly dispositionDecidedAt: string;
  readonly bindingRecoveryCaseId: string;
  readonly originalOriginIdentity: Readonly<{ readonly invocationId: string }>;
  readonly decisionVersion: number;
  readonly reconciliationFindingRecordId: string;
  readonly recoveryDispositionRecordId: string;
  readonly bindingRecoveryActionType: "CONNECTOR_REEXECUTION";
  readonly recoveryExecutionIdentity: Readonly<{ readonly invocationId: string }>;
  readonly recoveryIdempotencyKey: string;
  readonly recoveryEvidenceRefs: readonly string[];
  readonly authorizedBy: string;
  readonly recoveryAuthorizedAt: string;
}>;

export interface ConnectorRecoveryAuthorizationReader {
  findAuthorizedConnectorRecovery(input: Readonly<{
    readonly recoveryId: string;
    readonly tenantId: string;
    readonly scopeRef: string;
  }>): AuthorizedConnectorRecovery | undefined;
}

interface ConnectorRecoveryExecutionRecord {
  readonly recoveryId: string;
  readonly fingerprint: string;
  readonly resultJson?: string;
}

export interface ConnectorRecoveryExecutionStore {
  findRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string }>): ConnectorRecoveryExecutionRecord | undefined;
  claimRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string }>): Readonly<{ replay: boolean; record: ConnectorRecoveryExecutionRecord }>;
  completeRecoveryExecution(input: Readonly<{ recoveryId: string; fingerprint: string; resultJson: string }>): Readonly<{ replay: boolean; record: ConnectorRecoveryExecutionRecord }>;
}

type ConnectorRecoveryStoreRecord = RecoveryCaseRecord;

export class ConnectorRecoveryAuthorizationAdapter implements ConnectorRecoveryAuthorizationReader {
  public constructor(private readonly store: Readonly<{ findAuthorizedConnectorRecovery(input: Readonly<{ recoveryId: string; tenantId: string; scopeRef: string }>): ConnectorRecoveryStoreRecord | undefined }>) {}

  public findAuthorizedConnectorRecovery(input: Parameters<ConnectorRecoveryAuthorizationReader["findAuthorizedConnectorRecovery"]>[0]): AuthorizedConnectorRecovery | undefined {
    const record = this.store.findAuthorizedConnectorRecovery(input);
    if (record === undefined) return undefined;
    const { finding, disposition, recovery } = record;
    if (finding === undefined || disposition === undefined || recovery === undefined) return undefined;
    if (record.resourceType !== "ConnectorInvocation" || record.originDomain !== "CONNECTOR" || record.status !== "RESOLVED"
      || finding.finding !== "CONFIRMED_NOT_EXECUTED" || disposition.recoveryDisposition !== "RECOVERY_AUTHORIZED" || disposition.recoveryActionType !== "CONNECTOR_REEXECUTION"
      || recovery.recoveryActionType !== "CONNECTOR_REEXECUTION" || !("invocationId" in record.originIdentity) || !("invocationId" in recovery.originalOriginIdentity) || !("invocationId" in recovery.recoveryExecutionIdentity)
      || recovery.recoveryId !== disposition.recoveryId || recovery.recoveryCaseId !== record.recoveryCaseId || finding.recoveryCaseId !== record.recoveryCaseId || disposition.recoveryCaseId !== record.recoveryCaseId
      || recovery.reconciliationFindingRecordId !== finding.findingRecordId || recovery.recoveryDispositionRecordId !== disposition.dispositionRecordId) return undefined;
    return Object.freeze({
      recoveryId: recovery.recoveryId,
      recoveryCaseId: record.recoveryCaseId,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      originDomain: record.originDomain,
      originIdentity: record.originIdentity,
      tenantId: record.tenantId,
      scopeRef: record.scopeRef,
      status: record.status,
      version: record.version,
      evidenceRefs: record.evidenceRefs,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      findingRecordId: finding.findingRecordId,
      finding: finding.finding,
      findingReasonCode: finding.reasonCode,
      findingEvidenceRefs: finding.evidenceRefs,
      findingDecidedBy: finding.decidedBy,
      findingDecidedAt: finding.decidedAt,
      dispositionRecordId: disposition.dispositionRecordId,
      recoveryDisposition: disposition.recoveryDisposition,
      recoveryActionType: disposition.recoveryActionType,
      dispositionEvidenceRefs: disposition.evidenceRefs,
      dispositionDecidedBy: disposition.decidedBy,
      dispositionDecidedAt: disposition.decidedAt,
      bindingRecoveryCaseId: recovery.recoveryCaseId,
      originalOriginIdentity: recovery.originalOriginIdentity,
      decisionVersion: recovery.decisionVersion,
      reconciliationFindingRecordId: recovery.reconciliationFindingRecordId,
      recoveryDispositionRecordId: recovery.recoveryDispositionRecordId,
      bindingRecoveryActionType: recovery.recoveryActionType,
      recoveryExecutionIdentity: recovery.recoveryExecutionIdentity,
      recoveryIdempotencyKey: recovery.idempotencyKey,
      recoveryEvidenceRefs: recovery.evidenceRefs,
      authorizedBy: recovery.authorizedBy,
      recoveryAuthorizedAt: recovery.authorizedAt,
    });
  }
}

type ConnectorAmbiguityInput = Readonly<{
  readonly invocationId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly sourceId: string;
  readonly connectorId: string;
  readonly evidenceRefs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly parentRecoveryCaseId?: string;
}>;

export class ConnectorAmbiguityRecoveryCaseWriterAdapter {
  public constructor(private readonly store: Readonly<{ createCase(input: Readonly<{ resourceType: string; resourceId: string; originDomain: "CONNECTOR"; originIdentity: Readonly<{ invocationId: string }>; tenantId: string; scopeRef: string; parentRecoveryCaseId?: string; evidenceRefs: readonly string[]; createdBy: string; createdAt: string }>): unknown }>) {}

  public linkAmbiguousInvocation(input: ConnectorAmbiguityInput): void {
    try {
      this.store.createCase(Object.freeze({
        resourceType: "ConnectorInvocation",
        resourceId: input.invocationId,
        originDomain: "CONNECTOR",
        originIdentity: Object.freeze({ invocationId: input.invocationId }),
        tenantId: input.tenantId,
        scopeRef: input.scopeRef,
        ...(input.parentRecoveryCaseId === undefined ? {} : { parentRecoveryCaseId: input.parentRecoveryCaseId }),
        evidenceRefs: input.evidenceRefs,
        createdBy: input.createdBy,
        createdAt: input.createdAt,
      }));
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "DUPLICATE_ORIGIN") throw error;
    }
  }
}

export class ConnectorRecoveryExecutionPlanner {
  public plan(input: Readonly<{ readonly recoveryId: string; readonly originalInvocationId: string }>): Readonly<{ readonly invocationId: string }> {
    const invocationId = `connector-recovery:${input.recoveryId}`;
    if (!nonBlank(input.recoveryId) || !nonBlank(input.originalInvocationId) || invocationId === input.originalInvocationId) throw new Error("Connector recovery identity is invalid.");
    return Object.freeze({ invocationId });
  }
}

export type ConnectorRecoveryExecutionRequest = Readonly<{
  readonly recoveryId: string;
  readonly sessionId: string;
  readonly integrationContractId: string;
  readonly expectedIntegrationContractVersion: number;
  readonly leaseId: string;
  readonly leaseAcquiredAt: string;
  readonly leaseExpiresAt: string;
  readonly expectedScopeRevision: number;
  readonly inputReference: string;
  readonly inputVersion: number;
  readonly expectedCheckpointVersion: number;
  readonly preparedAt: string;
  readonly startedAt: string;
  readonly completedAt: string;
}>;

export class ConnectorRecoveryExecutionHandoff {
  public constructor(private readonly dependencies: Readonly<{
    readonly authorizations: ConnectorRecoveryAuthorizationReader;
    readonly planner: Pick<ConnectorRecoveryExecutionPlanner, "plan">;
    readonly persistence: Pick<DurableConnectorExecutionUnitOfWork, "findInvocation">;
    readonly coordinator: Pick<ConnectorExecutionCoordinator, "execute">;
    readonly contextResolver: ConnectorRuntimeContextResolver;
    readonly authorizer: ConnectorRuntimeAuthorizer;
    readonly clock: () => string;
    readonly integrationContracts: Readonly<{ readContract(scope: Readonly<{ tenantId: string; scopeType: "TENANT" | "TEAM" | "ORGANIZATION" | "SOURCE"; scopeId: string; connectorId: string; sourceId: string }>, integrationContractId: string): IntegrationContract | undefined }>;
    readonly recoveryExecutionStore?: ConnectorRecoveryExecutionStore;
  }>) {}

  public execute(request: ConnectorRecoveryExecutionRequest): ConnectorExecutionResult {
    if (!nonBlank(request.recoveryId) || !nonBlank(request.sessionId) || !nonBlank(request.integrationContractId) || !Number.isInteger(request.expectedIntegrationContractVersion)) return blocked();
    const context = this.dependencies.contextResolver.resolve(request.sessionId);
    if (!isValidConnectorTrustedRuntimeContext(context, this.dependencies.clock())) return blocked();
    const admission = admissionFrom(context);
    const recovery = this.dependencies.authorizations.findAuthorizedConnectorRecovery({
      recoveryId: request.recoveryId,
      tenantId: admission.tenantId,
      scopeRef: `${admission.scope.scopeType.toLowerCase()}:${admission.scope.scopeId}`,
    });
    if (!matchesAuthorizedRecovery(recovery, request.recoveryId, admission.tenantId, `${admission.scope.scopeType.toLowerCase()}:${admission.scope.scopeId}`)) return blocked();
    if (recovery.authorizedBy === context.session.principalId || recovery.findingDecidedBy === context.session.principalId) return blocked();
    try { if (!this.dependencies.authorizer.authorize({ context, operation: "SubmitCaptureBatch", resourceId: recovery.originIdentity.invocationId })) return blocked(); }
    catch { return blocked(); }
    const contract = this.dependencies.integrationContracts.readContract({ tenantId: context.tenantId, scopeType: context.scope.scopeType, scopeId: context.scope.scopeId, connectorId: context.connectorId, sourceId: context.sourceId }, request.integrationContractId);
    if (contract?.status !== "ACTIVE" || contract.version !== request.expectedIntegrationContractVersion || contract.tenantId !== context.tenantId || contract.scopeType !== context.scope.scopeType || contract.scopeId !== context.scope.scopeId || contract.connectorId !== context.connectorId || contract.sourceId !== context.sourceId) return blocked();
    let planned: Readonly<{ readonly invocationId: string }>;
    try { planned = this.dependencies.planner.plan({ recoveryId: recovery.recoveryId, originalInvocationId: recovery.originIdentity.invocationId }); }
    catch { return blocked(); }
    if (planned.invocationId === recovery.originIdentity.invocationId || planned.invocationId !== recovery.recoveryExecutionIdentity.invocationId) return blocked();
    const scope = { tenantId: admission.tenantId, scopeType: admission.scope.scopeType, scopeId: admission.scope.scopeId, sourceId: admission.sourceId, connectorId: admission.connectorId } as const;
    if (this.dependencies.persistence.findInvocation(scope, recovery.originIdentity.invocationId) === undefined) return blocked();
    const recoveryExecutionStore = this.dependencies.recoveryExecutionStore;
    if (recoveryExecutionStore === undefined) return blocked();
    const executionFingerprint = fingerprint([
      [
        recovery.recoveryCaseId, recovery.resourceType, recovery.resourceId, recovery.originDomain, recovery.originIdentity.invocationId,
        recovery.tenantId, recovery.scopeRef, recovery.status, recovery.version, recovery.evidenceRefs, recovery.createdBy, recovery.createdAt,
        recovery.findingRecordId, recovery.finding, recovery.findingReasonCode, recovery.findingEvidenceRefs, recovery.findingDecidedBy, recovery.findingDecidedAt,
        recovery.dispositionRecordId, recovery.recoveryId, recovery.recoveryDisposition, recovery.recoveryActionType, recovery.dispositionEvidenceRefs, recovery.dispositionDecidedBy, recovery.dispositionDecidedAt,
        recovery.bindingRecoveryCaseId, recovery.originalOriginIdentity.invocationId, recovery.decisionVersion, recovery.reconciliationFindingRecordId,
        recovery.recoveryDispositionRecordId, recovery.bindingRecoveryActionType, recovery.recoveryExecutionIdentity.invocationId,
        recovery.recoveryIdempotencyKey, recovery.recoveryEvidenceRefs, recovery.authorizedBy, recovery.recoveryAuthorizedAt,
      ],
      [
        planned.invocationId, context.session.id, context.session.principalId, context.tenantId, context.scope.scopeType, context.scope.scopeId,
        context.sourceId, context.connectorId, context.purpose, context.sourcePolicyVersion, context.connectorVersion, context.correlationId,
        contract.integrationContractId, contract.providerNamespace, contract.governedBindingRef, contract.tenantId, contract.scopeType, contract.scopeId,
        contract.connectorId, contract.sourceId, contract.status, contract.version, contract.evidenceRef, contract.createdAt, contract.updatedAt,
        request.leaseId, request.leaseAcquiredAt, request.leaseExpiresAt, request.expectedScopeRevision, request.inputReference, request.inputVersion,
        request.expectedCheckpointVersion, request.preparedAt, request.startedAt, request.completedAt,
      ],
    ]);
    const durableReplay = recoveryExecutionStore.findRecoveryExecution({ recoveryId: recovery.recoveryId, fingerprint: executionFingerprint });
    if (durableReplay?.resultJson !== undefined) return decodeConnectorExecutionResult(durableReplay.resultJson);
    recoveryExecutionStore.claimRecoveryExecution({ recoveryId: recovery.recoveryId, fingerprint: executionFingerprint });
    const input: ConnectorExecutionInput = Object.freeze({
      admissionInput: admission,
      leaseId: request.leaseId,
      leaseOwnerId: context.session.principalId,
      leaseAcquiredAt: request.leaseAcquiredAt,
      leaseExpiresAt: request.leaseExpiresAt,
      expectedScopeRevision: request.expectedScopeRevision,
      invocationId: planned.invocationId,
      idempotencyKey: `connector-recovery:${recovery.recoveryId}`,
      inputFingerprint: executionFingerprint,
      inputReference: request.inputReference,
      inputVersion: request.inputVersion,
      expectedCheckpointVersion: request.expectedCheckpointVersion,
      preparedAt: request.preparedAt,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
      parentRecoveryCaseId: recovery.recoveryCaseId,
    });
    const result = this.dependencies.coordinator.execute(input);
    const completed = recoveryExecutionStore.completeRecoveryExecution({ recoveryId: recovery.recoveryId, fingerprint: executionFingerprint, resultJson: JSON.stringify(result) });
    return decodeConnectorExecutionResult(completed.record.resultJson ?? JSON.stringify(result));
  }
}

function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function decodeConnectorExecutionResult(resultJson: string): ConnectorExecutionResult {
  const value: unknown = JSON.parse(resultJson);
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Stored Connector recovery result is invalid.");
  const record = value as Record<string, unknown>;
  if (record["status"] === "BLOCKED" && record["reasonCode"] === "ADMISSION_DENIED") return Object.freeze({ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
  if ((record["status"] === "SUCCEEDED" || record["status"] === "FAILED") && typeof record["reasonCode"] === "string" && typeof record["invocationId"] === "string" && typeof record["resultId"] === "string") {
    return Object.freeze({ status: record["status"], reasonCode: record["reasonCode"], invocationId: record["invocationId"], resultId: record["resultId"] });
  }
  if (record["status"] === "AMBIGUOUS" && record["reasonCode"] === "RECONCILIATION_REQUIRED" && typeof record["invocationId"] === "string") {
    return Object.freeze({ status: "AMBIGUOUS", reasonCode: "RECONCILIATION_REQUIRED", invocationId: record["invocationId"] });
  }
  throw new Error("Stored Connector recovery result is invalid.");
}

function admissionFrom(context: ConnectorTrustedRuntimeContext): SourceIngestionAdmissionInput {
  return Object.freeze({ actor: context.session, tenantId: context.tenantId, scope: context.scope, sourceId: context.sourceId, sourcePolicyVersion: context.sourcePolicyVersion, connectorId: context.connectorId, connectorVersion: context.connectorVersion, method: "CONNECTOR", purpose: context.purpose, correlationId: context.correlationId });
}

function matchesAuthorizedRecovery(recovery: AuthorizedConnectorRecovery | undefined, recoveryId: string, tenantId: string, scopeRef: string): recovery is AuthorizedConnectorRecovery {
  return recovery?.recoveryId === recoveryId
    && recovery.resourceType === "ConnectorInvocation"
    && recovery.resourceId === recovery.originIdentity.invocationId
    && recovery.originDomain === "CONNECTOR"
    && recovery.tenantId === tenantId
    && recovery.scopeRef === scopeRef
    && recovery.status === "RESOLVED"
    && recovery.finding === "CONFIRMED_NOT_EXECUTED"
    && recovery.recoveryDisposition === "RECOVERY_AUTHORIZED"
    && recovery.recoveryActionType === "CONNECTOR_REEXECUTION"
    && recovery.bindingRecoveryCaseId === recovery.recoveryCaseId
    && recovery.originalOriginIdentity.invocationId === recovery.originIdentity.invocationId
    && recovery.reconciliationFindingRecordId === recovery.findingRecordId
    && recovery.recoveryDispositionRecordId === recovery.dispositionRecordId
    && recovery.bindingRecoveryActionType === recovery.recoveryActionType
    && nonBlank(recovery.originIdentity.invocationId)
    && nonBlank(recovery.recoveryExecutionIdentity.invocationId);
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function blocked(): Extract<ConnectorExecutionResult, { readonly status: "BLOCKED" }> {
  return Object.freeze({ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
}
