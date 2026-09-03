export type RecoveryOriginDomain = "PUBLICATION" | "CONNECTOR" | "EXTERNAL_INTEGRATION";

export const RECOVERY_ORCHESTRATION_OPERATIONS = Object.freeze([
  "CREATE_RECOVERY_CASE",
  "RESOLVE_RECOVERY_CASE",
  "AUTHORIZE_RECOVERY",
  "READ_RECOVERY_CASE",
] as const);

export type PublicationRecoveryOrigin = Readonly<{
  reconciliationCaseId: string;
  attemptId: string;
}>;

export type ConnectorRecoveryOrigin = Readonly<{
  invocationId: string;
}>;

export type ExternalIntegrationRecoveryOrigin = Readonly<{
  integrationContractId: string;
  mappingId?: string;
  observationId?: string;
  conflictEvidenceId?: string;
}>;

export type RecoveryOriginIdentity =
  | PublicationRecoveryOrigin
  | ConnectorRecoveryOrigin
  | ExternalIntegrationRecoveryOrigin;

export type RecoveryCaseStatus = "OPEN" | "RESOLVED";
export type ReconciliationFinding = "CONFIRMED_EXECUTED" | "CONFIRMED_NOT_EXECUTED" | "UNRESOLVED";
export type RecoveryDisposition = "RECOVERY_AUTHORIZED" | "NO_RECOVERY_REQUIRED" | "RECOVERY_REJECTED";

export type RecoveryExecutionIdentity =
  | Readonly<{ attemptId: string; commandId: string }>
  | Readonly<{ invocationId: string }>;
export type RecoveryActionType = "PUBLICATION_RECOVERY" | "CONNECTOR_REEXECUTION";

export interface RecoveryCaseRecord {
  readonly recoveryCaseId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly originDomain: RecoveryOriginDomain;
  readonly originIdentity: RecoveryOriginIdentity;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly parentRecoveryCaseId?: string;
  readonly status: RecoveryCaseStatus;
  readonly version: number;
  readonly evidenceRefs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
  readonly finding?: RecoveryFindingRecord;
  readonly disposition?: RecoveryDispositionRecord;
  readonly recovery?: RecoveryAuthorizationBinding;
}

export interface RecoveryFindingRecord {
  readonly findingRecordId: string;
  readonly recoveryCaseId: string;
  readonly finding: ReconciliationFinding;
  readonly reasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
}

export interface RecoveryDispositionRecord {
  readonly recoveryId: string;
  readonly dispositionRecordId: string;
  readonly recoveryCaseId: string;
  readonly recoveryDisposition: RecoveryDisposition;
  readonly recoveryActionType: RecoveryActionType;
  readonly evidenceRefs: readonly string[];
  readonly decidedBy: string;
  readonly decidedAt: string;
}

export interface RecoveryAuthorizationBinding {
  readonly recoveryId: string;
  readonly recoveryCaseId: string;
  readonly originalOriginIdentity: RecoveryOriginIdentity;
  readonly decisionVersion: number;
  readonly reconciliationFindingRecordId: string;
  readonly recoveryDispositionRecordId: string;
  readonly recoveryActionType: RecoveryActionType;
  readonly recoveryExecutionIdentity: RecoveryExecutionIdentity;
  readonly idempotencyKey: string;
  readonly evidenceRefs: readonly string[];
  readonly authorizedBy: string;
  readonly authorizedAt: string;
}

export interface CreateRecoveryCaseInput {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly originDomain: RecoveryOriginDomain;
  readonly originIdentity: RecoveryOriginIdentity;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly parentRecoveryCaseId?: string;
  readonly evidenceRefs: readonly string[];
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface RecoveryOrchestrationStore {
  createCase(input: CreateRecoveryCaseInput): RecoveryCaseRecord;
  findCase(recoveryCaseId: string): RecoveryCaseRecord | undefined;
  findAuthorizedPublicationRecovery(input: Readonly<{
    tenantId: string;
    scopeRef: string;
    resourceType: "Publication";
    resourceId: string;
    reconciliationCaseId: string;
  }>): RecoveryCaseRecord | undefined;
  recordFinding(input: Readonly<{
    recoveryCaseId: string;
    expectedVersion: number;
    finding: ReconciliationFinding;
    reasonCode: string;
    evidenceRefs: readonly string[];
    decidedBy: string;
    decidedAt: string;
    idempotencyKey: string;
    fingerprint: string;
  }>): Readonly<{ replay: boolean; record: RecoveryCaseRecord }>;
  authorizeRecovery(input: Readonly<{
    recoveryCaseId: string;
    expectedVersion: number;
    recoveryDisposition: RecoveryDisposition;
    recoveryActionType: RecoveryActionType;
    recoveryExecutionIdentity?: RecoveryExecutionIdentity;
    evidenceRefs: readonly string[];
    decidedBy: string;
    decidedAt: string;
    idempotencyKey: string;
    fingerprint: string;
  }>): Readonly<{ replay: boolean; record: RecoveryCaseRecord }>;
}

export type RecoveryStoreErrorCode = "VERSION_CONFLICT" | "IDEMPOTENCY_CONFLICT" | "INVALID_STATE" | "DUPLICATE_ORIGIN";

export class RecoveryStoreError extends Error {
  constructor(readonly code: RecoveryStoreErrorCode) {
    super(code);
    this.name = "RecoveryStoreError";
  }
}
