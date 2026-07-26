import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import { domainError } from "./publication-domain-error.js";

export const PUBLICATION_LIFECYCLE_STATES = ["READY", "EXECUTION_PENDING", "ACTIVE", "RECONCILIATION_REQUIRED", "WITHDRAWAL_PENDING", "WITHDRAWN", "SUPERSEDED", "TERMINATED"] as const;
export const PUBLICATION_SUSPENSION_STATUSES = ["NOT_SUSPENDED", "SUSPENDED_OPERATIONAL", "SUSPENDED_SECURITY", "SUSPENDED_COMPLIANCE", "SUSPENDED_PROVIDER_POLICY"] as const;
export const PUBLICATION_CLASSIFICATIONS = ["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"] as const satisfies readonly DataClassification[];
export const DELIVERY_OPERATIONS = ["INITIAL_PUBLISH", "CORRECTION", "REPUBLISH", "WITHDRAWAL"] as const;
export const DELIVERY_OUTCOMES = ["PENDING", "CONFIRMED", "NO_EFFECT", "UNKNOWN"] as const;
export const OPERATION_ORIGINS = ["INITIAL", "ACTIVE_CORRECTION_OR_REPUBLISH", "WITHDRAWN_REPUBLISH", "WITHDRAWAL"] as const;
export const RECONCILIATION_RESOLUTIONS = ["EFFECT_CONFIRMED", "INITIAL_NO_EFFECT", "ACTIVE_ORIGIN_NO_EFFECT", "WITHDRAWN_ORIGIN_NO_EFFECT", "WITHDRAWAL_CONFIRMED", "WITHDRAWAL_NO_EFFECT"] as const;
export const PUBLICATION_TRANSITION_IDS = ["PUB-TR-001", "PUB-TR-002", "PUB-TR-003", "PUB-TR-004", "PUB-TR-005", "PUB-TR-006", "PUB-TR-007", "PUB-TR-008", "PUB-TR-009", "PUB-TR-010", "PUB-TR-011", "PUB-TR-012", "PUB-TR-013", "PUB-TR-014", "PUB-TR-015", "PUB-TR-016", "PUB-TR-017", "PUB-TR-018", "PUB-TR-019", "PUB-TR-020"] as const;

export type PublicationLifecycleState = typeof PUBLICATION_LIFECYCLE_STATES[number];
export type PublicationSuspensionStatus = typeof PUBLICATION_SUSPENSION_STATUSES[number];
export type PublicationAuthorizationState = "NOT_EVALUATED" | "REVALIDATION_REQUIRED" | "AUTHORIZED_FOR_COMMAND" | "BLOCKED" | "EXPIRED" | "REVOKED";
export type WithdrawalStatus = "NOT_REQUESTED" | "AUTHORIZATION_REQUIRED" | "AUTHORIZED" | "EXECUTION_PENDING" | "RECONCILIATION_REQUIRED" | "CONFIRMED" | "CONFIRMED_NO_EFFECT" | "REJECTED";
export type RepublishStatus = "NOT_REQUESTED" | "AUTHORIZATION_REQUIRED" | "AUTHORIZED" | "EXECUTION_PENDING" | "RECONCILIATION_REQUIRED" | "CONFIRMED" | "CONFIRMED_NO_EFFECT" | "REJECTED";
export type DeliveryOperation = typeof DELIVERY_OPERATIONS[number];
export type DeliveryOutcome = typeof DELIVERY_OUTCOMES[number];
export type OperationOrigin = typeof OPERATION_ORIGINS[number];
export type ReconciliationResolution = typeof RECONCILIATION_RESOLUTIONS[number];
export type CorrectionMateriality = "MATERIAL" | "NON_MATERIAL";
export type ActiveOperationMateriality = CorrectionMateriality | "SAME_INTENT";
export type PublicationTransitionId = typeof PUBLICATION_TRANSITION_IDS[number];

export interface PublicationIdentity {
  readonly publicationId: string;
  readonly tenantScopeId: string;
}

export interface PublicationBinding {
  readonly subjectId: string;
  readonly subjectRevision: number;
  readonly representationId: string;
  readonly representationVersion: number;
  readonly representationChecksum: string;
  readonly approvalId: string;
  readonly approvalVersion: number;
  readonly targetId: string;
  readonly targetVersion: number;
  readonly channelId: string;
  readonly channelPolicyVersion: string;
}

export interface PublicationVersions {
  readonly aggregateVersion: number;
  readonly publicationVersion: number;
  readonly effectiveVersion?: number;
}

export interface DomainCommandContext {
  readonly actorId: string;
  readonly authorityContext: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export interface DeliveryAttempt {
  readonly id: string;
  readonly publicationId: string;
  readonly commandId: string;
  readonly operation: DeliveryOperation;
  readonly outcome: DeliveryOutcome;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface ReconciliationCase {
  readonly id: string;
  readonly publicationId: string;
  readonly attemptId: string;
  readonly origin: OperationOrigin;
  readonly status: "OPEN" | "RESOLVED";
  readonly evidenceRefs: readonly string[];
  readonly resolution?: ReconciliationResolution;
  readonly openedAt: string;
  readonly resolvedAt?: string;
}

export interface PublicationTransitionRecord {
  readonly id: string;
  readonly publicationId: string;
  readonly sequence: number;
  readonly transitionId: PublicationTransitionId;
  readonly fromState?: PublicationLifecycleState;
  readonly toState: PublicationLifecycleState;
  readonly actorId: string;
  readonly reason: string;
  readonly correlationId: string;
  readonly occurredAt: string;
}

export interface PublicationVersionRecord {
  readonly id: string;
  readonly publicationId: string;
  readonly publicationVersion: number;
  readonly binding: PublicationBinding;
  readonly actorId: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface PendingPublicationOperation {
  readonly origin: OperationOrigin;
  readonly operation: DeliveryOperation;
  readonly attemptId: string;
}

export interface PublicationSnapshot extends PublicationIdentity, PublicationVersions {
  readonly aggregateId: string;
  readonly binding: PublicationBinding;
  readonly lifecycleState: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly authorizationState: PublicationAuthorizationState;
  readonly withdrawalStatus: WithdrawalStatus;
  readonly republishStatus: RepublishStatus;
  readonly currentFlag: boolean;
  readonly classification: DataClassification;
  readonly attempts: readonly DeliveryAttempt[];
  readonly reconciliationCases: readonly ReconciliationCase[];
  readonly transitionHistory: readonly PublicationTransitionRecord[];
  readonly bindingHistory: readonly PublicationVersionRecord[];
  readonly pendingOperation?: PendingPublicationOperation;
  readonly effectiveAt?: string;
  readonly externalObjectReference?: string;
  readonly predecessorPublicationId?: string;
  readonly successorPublicationId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly auditCorrelationId: string;
}

export interface PublicationCreationPrerequisites {
  readonly immutableSnapshot: true;
  readonly effectiveApproval: true;
  readonly exactTargetChannel: true;
  readonly provenancePresent: true;
}

export function immutableDomain<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

export function requireText(value: string, field: string): string {
  if (value.trim().length === 0) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", `${field} is required.`, { field });
  return value;
}

export function requirePositiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", `${field} must be a positive integer.`, { field, value });
  return value;
}

export function requireClosedValue<Value extends string>(value: Value, allowed: readonly Value[], field: string): Value {
  if (!allowed.includes(value)) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", `${field} is not canonical.`, { field });
  return value;
}

export function createPublicationIdentity(input: PublicationIdentity): PublicationIdentity {
  try {
    return immutableDomain({ publicationId: requireText(input.publicationId, "publicationId"), tenantScopeId: requireText(input.tenantScopeId, "tenantScopeId") });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("required")) throw domainError("PUBLICATION_IDENTITY_INVALID", "VALIDATION", "Publication identity is invalid.", undefined);
    throw error;
  }
}

export function createPublicationBinding(input: PublicationBinding): PublicationBinding {
  const textFields = ["subjectId", "representationId", "representationChecksum", "approvalId", "targetId", "channelId", "channelPolicyVersion"] as const;
  const integerFields = ["subjectRevision", "representationVersion", "approvalVersion", "targetVersion"] as const;
  try {
    for (const field of textFields) requireText(input[field], field);
    for (const field of integerFields) requirePositiveInteger(input[field], field);
    return immutableDomain(input);
  } catch (error: unknown) {
    if (error instanceof Error) throw domainError("PUBLICATION_BINDING_INVALID", "VALIDATION", "Publication binding is invalid.");
    throw error;
  }
}

export function createPublicationVersions(input: PublicationVersions): PublicationVersions {
  requirePositiveInteger(input.aggregateVersion, "aggregateVersion");
  if (!Number.isSafeInteger(input.publicationVersion) || input.publicationVersion < 0) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "publicationVersion must be a non-negative integer.", { value: input.publicationVersion });
  if (input.effectiveVersion !== undefined && (!Number.isSafeInteger(input.effectiveVersion) || input.effectiveVersion < 1 || input.effectiveVersion > input.publicationVersion)) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "effectiveVersion is invalid.", { value: input.effectiveVersion });
  return immutableDomain(input);
}

export function createCommandContext(input: DomainCommandContext): DomainCommandContext {
  requireText(input.actorId, "actorId");
  requireText(input.authorityContext, "authorityContext");
  requireText(input.reason, "reason");
  requireText(input.correlationId, "correlationId");
  requireIsoTimestamp(input.occurredAt, "occurredAt");
  return immutableDomain(input);
}

export function samePublicationBinding(left: PublicationBinding, right: PublicationBinding): boolean {
  return left.subjectId === right.subjectId
    && left.subjectRevision === right.subjectRevision
    && left.representationId === right.representationId
    && left.representationVersion === right.representationVersion
    && left.representationChecksum === right.representationChecksum
    && left.approvalId === right.approvalId
    && left.approvalVersion === right.approvalVersion
    && left.targetId === right.targetId
    && left.targetVersion === right.targetVersion
    && left.channelId === right.channelId
    && left.channelPolicyVersion === right.channelPolicyVersion;
}

export function requireIsoTimestamp(value: string, field: string): string {
  requireText(value, field);
  const isoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u;
  if (!isoTimestamp.test(value) || Number.isNaN(Date.parse(value))) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", `${field} must be an ISO timestamp.`, { field });
  return value;
}

function deepFreeze(value: unknown): void {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
}
