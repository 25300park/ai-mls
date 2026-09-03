import type { DurableConnectorExecutionUnitOfWork } from "./connector-durable-persistence.js";
import type { ConnectorExecutionCoordinator, ConnectorExecutionInput, ConnectorExecutionResult } from "./connector-execution-coordinator.js";
import type { SourceIngestionAdmissionInput } from "./source-ingestion-admission.js";
import { isValidConnectorTrustedRuntimeContext, type ConnectorRuntimeAuthorizer, type ConnectorRuntimeContextResolver, type ConnectorTrustedRuntimeContext } from "./connector-runtime-application.js";
import { createHash } from "node:crypto";
import type { IntegrationContract } from "./external-integration-durable-persistence.js";

export type AuthorizedConnectorRecovery = Readonly<{
  readonly recoveryId: string;
  readonly recoveryCaseId: string;
  readonly originDomain: "CONNECTOR";
  readonly originIdentity: Readonly<{ readonly invocationId: string }>;
  readonly status: "RESOLVED";
  readonly finding: "CONFIRMED_NOT_EXECUTED";
  readonly recoveryDisposition: "RECOVERY_AUTHORIZED";
  readonly recoveryActionType: "CONNECTOR_REEXECUTION";
  readonly recoveryExecutionIdentity: Readonly<{ readonly invocationId: string }>;
  readonly authorizedBy: string;
}>;

export interface ConnectorRecoveryAuthorizationReader {
  findAuthorizedConnectorRecovery(input: Readonly<{
    readonly recoveryId: string;
    readonly tenantId: string;
    readonly scopeRef: string;
  }>): AuthorizedConnectorRecovery | undefined;
}

type ConnectorRecoveryStoreRecord = Readonly<{
  readonly recoveryCaseId: string;
  readonly originDomain: "CONNECTOR";
  readonly originIdentity: Readonly<{ readonly invocationId: string }>;
  readonly status: "RESOLVED";
  readonly finding?: Readonly<{ readonly finding: "CONFIRMED_NOT_EXECUTED" }>;
  readonly disposition?: Readonly<{ readonly recoveryId: string; readonly recoveryDisposition: "RECOVERY_AUTHORIZED"; readonly recoveryActionType: "CONNECTOR_REEXECUTION" }>;
  readonly recovery?: Readonly<{ readonly recoveryId: string; readonly recoveryExecutionIdentity: Readonly<{ readonly invocationId: string }>; readonly authorizedBy: string }>;
}>;

export class ConnectorRecoveryAuthorizationAdapter implements ConnectorRecoveryAuthorizationReader {
  public constructor(private readonly store: Readonly<{ findAuthorizedConnectorRecovery(input: Readonly<{ recoveryId: string; tenantId: string; scopeRef: string }>): ConnectorRecoveryStoreRecord | undefined }>) {}

  public findAuthorizedConnectorRecovery(input: Parameters<ConnectorRecoveryAuthorizationReader["findAuthorizedConnectorRecovery"]>[0]): AuthorizedConnectorRecovery | undefined {
    const record = this.store.findAuthorizedConnectorRecovery(input);
    if (record === undefined) return undefined;
    const { finding, disposition, recovery } = record;
    if (finding === undefined || disposition === undefined || recovery === undefined) return undefined;
    if (recovery.recoveryId !== disposition.recoveryId) return undefined;
    return Object.freeze({
      recoveryId: recovery.recoveryId,
      recoveryCaseId: record.recoveryCaseId,
      originDomain: record.originDomain,
      originIdentity: record.originIdentity,
      status: record.status,
      finding: finding.finding,
      recoveryDisposition: disposition.recoveryDisposition,
      recoveryActionType: disposition.recoveryActionType,
      recoveryExecutionIdentity: recovery.recoveryExecutionIdentity,
      authorizedBy: recovery.authorizedBy,
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
}>;

export class ConnectorAmbiguityRecoveryCaseWriterAdapter {
  public constructor(private readonly store: Readonly<{ createCase(input: Readonly<{ resourceType: string; resourceId: string; originDomain: "CONNECTOR"; originIdentity: Readonly<{ invocationId: string }>; tenantId: string; scopeRef: string; evidenceRefs: readonly string[]; createdBy: string; createdAt: string }>): unknown }>) {}

  public linkAmbiguousInvocation(input: ConnectorAmbiguityInput): void {
    try {
      this.store.createCase(Object.freeze({
        resourceType: "ConnectorInvocation",
        resourceId: input.invocationId,
        originDomain: "CONNECTOR",
        originIdentity: Object.freeze({ invocationId: input.invocationId }),
        tenantId: input.tenantId,
        scopeRef: input.scopeRef,
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
    if (!matchesAuthorizedRecovery(recovery, request.recoveryId)) return blocked();
    if (recovery.authorizedBy === context.session.principalId) return blocked();
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
    const input: ConnectorExecutionInput = Object.freeze({
      admissionInput: admission,
      leaseId: request.leaseId,
      leaseOwnerId: context.session.principalId,
      leaseAcquiredAt: request.leaseAcquiredAt,
      leaseExpiresAt: request.leaseExpiresAt,
      expectedScopeRevision: request.expectedScopeRevision,
      invocationId: planned.invocationId,
      idempotencyKey: `connector-recovery:${recovery.recoveryId}`,
      inputFingerprint: fingerprint({ recoveryId: recovery.recoveryId, invocationId: planned.invocationId, tenantId: context.tenantId, scope: context.scope, sourceId: context.sourceId, connectorId: context.connectorId, purpose: context.purpose, integrationContractId: request.integrationContractId, integrationContractVersion: contract.version, inputReference: request.inputReference, inputVersion: request.inputVersion, expectedCheckpointVersion: request.expectedCheckpointVersion }),
      inputReference: request.inputReference,
      inputVersion: request.inputVersion,
      expectedCheckpointVersion: request.expectedCheckpointVersion,
      preparedAt: request.preparedAt,
      startedAt: request.startedAt,
      completedAt: request.completedAt,
    });
    return this.dependencies.coordinator.execute(input);
  }
}

function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function admissionFrom(context: ConnectorTrustedRuntimeContext): SourceIngestionAdmissionInput {
  return Object.freeze({ actor: context.session, tenantId: context.tenantId, scope: context.scope, sourceId: context.sourceId, sourcePolicyVersion: context.sourcePolicyVersion, connectorId: context.connectorId, connectorVersion: context.connectorVersion, method: "CONNECTOR", purpose: context.purpose, correlationId: context.correlationId });
}

function matchesAuthorizedRecovery(recovery: AuthorizedConnectorRecovery | undefined, recoveryId: string): recovery is AuthorizedConnectorRecovery {
  return recovery?.recoveryId === recoveryId
    && recovery.originDomain === "CONNECTOR"
    && recovery.status === "RESOLVED"
    && recovery.finding === "CONFIRMED_NOT_EXECUTED"
    && recovery.recoveryDisposition === "RECOVERY_AUTHORIZED"
    && recovery.recoveryActionType === "CONNECTOR_REEXECUTION"
    && nonBlank(recovery.originIdentity.invocationId)
    && nonBlank(recovery.recoveryExecutionIdentity.invocationId);
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function blocked(): Extract<ConnectorExecutionResult, { readonly status: "BLOCKED" }> {
  return Object.freeze({ status: "BLOCKED", reasonCode: "ADMISSION_DENIED" });
}
