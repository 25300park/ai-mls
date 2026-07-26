import {
  createPublicationBinding,
  DELIVERY_OPERATIONS,
  DELIVERY_OUTCOMES,
  immutableDomain,
  OPERATION_ORIGINS,
  PUBLICATION_LIFECYCLE_STATES,
  PUBLICATION_TRANSITION_IDS,
  RECONCILIATION_RESOLUTIONS,
  requireClosedValue,
  requireIsoTimestamp,
  requirePositiveInteger,
  requireText,
  type DeliveryAttempt,
  type PublicationTransitionRecord,
  type PublicationTransitionId,
  type PublicationVersionRecord,
  type OperationOrigin,
  type PublicationLifecycleState,
  type ReconciliationResolution,
  type ReconciliationCase,
} from "./publication-contracts.js";
import { domainError } from "./publication-domain-error.js";

export function createDeliveryAttempt(input: DeliveryAttempt): DeliveryAttempt {
  requireText(input.id, "attemptId");
  requireText(input.publicationId, "publicationId");
  requireText(input.commandId, "commandId");
  requirePositiveInteger(input.sequence, "sequence");
  requireIsoTimestamp(input.occurredAt, "occurredAt");
  requireClosedValue(input.operation, DELIVERY_OPERATIONS, "operation");
  requireClosedValue(input.outcome, DELIVERY_OUTCOMES, "outcome");
  for (const ref of input.evidenceRefs) requireText(ref, "evidenceRef");
  return immutableDomain(input);
}

export function createReconciliationCase(input: ReconciliationCase): ReconciliationCase {
  requireText(input.id, "caseId");
  requireText(input.publicationId, "publicationId");
  requireText(input.attemptId, "attemptId");
  requireIsoTimestamp(input.openedAt, "openedAt");
  requireClosedValue(input.origin, OPERATION_ORIGINS, "origin");
  requireClosedValue(input.status, ["OPEN", "RESOLVED"], "status");
  if (input.resolution !== undefined) requireClosedValue(input.resolution, RECONCILIATION_RESOLUTIONS, "resolution");
  if (input.evidenceRefs.length === 0) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Reconciliation evidence is required.");
  for (const ref of input.evidenceRefs) requireText(ref, "evidenceRef");
  if (input.status === "OPEN" && (input.resolution !== undefined || input.resolvedAt !== undefined)) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Open reconciliation case cannot contain a resolution.");
  if (input.status === "RESOLVED" && (input.resolution === undefined || input.resolvedAt === undefined)) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "Resolved reconciliation case requires resolution evidence.");
  if (input.status === "RESOLVED" && input.resolution !== undefined && !RECONCILIATION_BY_ORIGIN[input.origin].includes(input.resolution)) throw domainError("PUBLICATION_STATE_INVALID", "VALIDATION", "Reconciliation resolution does not match operation origin.");
  if (input.resolvedAt !== undefined) requireIsoTimestamp(input.resolvedAt, "resolvedAt");
  return immutableDomain(input);
}

export function createTransitionRecord(input: PublicationTransitionRecord): PublicationTransitionRecord {
  requireText(input.id, "transitionRecordId");
  requireText(input.publicationId, "publicationId");
  requirePositiveInteger(input.sequence, "sequence");
  requireClosedValue(input.transitionId, PUBLICATION_TRANSITION_IDS, "transitionId");
  if (input.fromState !== undefined) requireClosedValue(input.fromState, PUBLICATION_LIFECYCLE_STATES, "fromState");
  requireClosedValue(input.toState, PUBLICATION_LIFECYCLE_STATES, "toState");
  const canonical = CANONICAL_TRANSITIONS[input.transitionId];
  const actualFrom = input.fromState ?? "NONE";
  if (canonical.from !== actualFrom || canonical.to !== input.toState) throw domainError("PUBLICATION_STATE_INVALID", "VALIDATION", "Transition record does not match the canonical transition table.");
  requireText(input.actorId, "actorId");
  requireText(input.reason, "reason");
  requireText(input.correlationId, "correlationId");
  requireIsoTimestamp(input.occurredAt, "occurredAt");
  if (input.fromState === input.toState) throw domainError("PUBLICATION_STATE_INVALID", "VALIDATION", "Lifecycle transition must change state.");
  return immutableDomain(input);
}

const RECONCILIATION_BY_ORIGIN: Readonly<Record<OperationOrigin, readonly ReconciliationResolution[]>> = {
  INITIAL: ["EFFECT_CONFIRMED", "INITIAL_NO_EFFECT"],
  ACTIVE_CORRECTION_OR_REPUBLISH: ["EFFECT_CONFIRMED", "ACTIVE_ORIGIN_NO_EFFECT"],
  WITHDRAWN_REPUBLISH: ["EFFECT_CONFIRMED", "WITHDRAWN_ORIGIN_NO_EFFECT"],
  WITHDRAWAL: ["WITHDRAWAL_CONFIRMED", "WITHDRAWAL_NO_EFFECT"],
};

const CANONICAL_TRANSITIONS: Readonly<Record<PublicationTransitionId, Readonly<{ from: PublicationLifecycleState | "NONE"; to: PublicationLifecycleState }>>> = {
  "PUB-TR-001": { from: "NONE", to: "READY" },
  "PUB-TR-002": { from: "READY", to: "EXECUTION_PENDING" },
  "PUB-TR-003": { from: "EXECUTION_PENDING", to: "ACTIVE" },
  "PUB-TR-004": { from: "EXECUTION_PENDING", to: "READY" },
  "PUB-TR-005": { from: "EXECUTION_PENDING", to: "ACTIVE" },
  "PUB-TR-006": { from: "EXECUTION_PENDING", to: "WITHDRAWN" },
  "PUB-TR-007": { from: "EXECUTION_PENDING", to: "RECONCILIATION_REQUIRED" },
  "PUB-TR-008": { from: "RECONCILIATION_REQUIRED", to: "ACTIVE" },
  "PUB-TR-009": { from: "RECONCILIATION_REQUIRED", to: "READY" },
  "PUB-TR-010": { from: "RECONCILIATION_REQUIRED", to: "ACTIVE" },
  "PUB-TR-011": { from: "RECONCILIATION_REQUIRED", to: "WITHDRAWN" },
  "PUB-TR-012": { from: "ACTIVE", to: "WITHDRAWAL_PENDING" },
  "PUB-TR-013": { from: "WITHDRAWAL_PENDING", to: "WITHDRAWN" },
  "PUB-TR-014": { from: "WITHDRAWAL_PENDING", to: "RECONCILIATION_REQUIRED" },
  "PUB-TR-015": { from: "RECONCILIATION_REQUIRED", to: "WITHDRAWN" },
  "PUB-TR-016": { from: "RECONCILIATION_REQUIRED", to: "ACTIVE" },
  "PUB-TR-017": { from: "ACTIVE", to: "EXECUTION_PENDING" },
  "PUB-TR-018": { from: "WITHDRAWN", to: "EXECUTION_PENDING" },
  "PUB-TR-019": { from: "ACTIVE", to: "SUPERSEDED" },
  "PUB-TR-020": { from: "READY", to: "TERMINATED" },
};

export function createPublicationVersionRecord(input: PublicationVersionRecord): PublicationVersionRecord {
  requireText(input.id, "publicationVersionRecordId");
  requireText(input.publicationId, "publicationId");
  if (!Number.isSafeInteger(input.publicationVersion) || input.publicationVersion < 0) throw domainError("PUBLICATION_INPUT_INVALID", "VALIDATION", "publicationVersion must be a non-negative integer.");
  requireText(input.actorId, "actorId");
  requireText(input.reason, "reason");
  requireIsoTimestamp(input.occurredAt, "occurredAt");
  return immutableDomain({ ...input, binding: createPublicationBinding(input.binding) });
}
