import type { PublicationApplicationCommand } from "./publication-application-contracts.js";
import type { PublicationEventPayload, PublicationEventType } from "./publication-event-contracts.js";
import type { DeliveryOperation, PublicationSnapshot, ReconciliationCase } from "./publication-contracts.js";

export interface PublicationEventCandidate {
  readonly eventType: PublicationEventType;
  readonly attemptId?: string;
  readonly payload: PublicationEventPayload;
}

export function mapAcceptedPublicationTransition(
  previous: PublicationSnapshot | undefined,
  current: PublicationSnapshot,
  command: PublicationApplicationCommand,
): readonly PublicationEventCandidate[] {
  if (previous === undefined || command.kind !== "MODIFY_PUBLICATION") return Object.freeze([]);
  const candidates: PublicationEventCandidate[] = [];
  const newlyResolved = current.reconciliationCases.find((item) => item.status === "RESOLVED"
    && previous.reconciliationCases.find((prior) => prior.id === item.id)?.status !== "RESOLVED");
  if (newlyResolved !== undefined) candidates.push(reconciliationCandidate(current, newlyResolved));

  if (previous.suspensionStatus !== current.suspensionStatus && current.suspensionStatus !== "NOT_SUSPENDED") {
    candidates.push(Object.freeze({
      eventType: "EVT-004" as const,
      payload: Object.freeze({ publicationId: current.publicationId, suspensionStatus: current.suspensionStatus, reasonCode: "AUTHORIZED_SUSPENSION" }),
    }));
  }

  if (previous.lifecycleState !== "ACTIVE" && current.lifecycleState === "ACTIVE") {
    const operation = previous.pendingOperation?.operation ?? operationForResolvedCase(previous, newlyResolved);
    const eventType = operation === "REPUBLISH" ? "EVT-008" as const : "EVT-003" as const;
    candidates.push(lifecycleCandidate(eventType, previous, current, previous.pendingOperation?.attemptId ?? newlyResolved?.attemptId));
  }
  if (previous.lifecycleState !== "WITHDRAWN" && current.lifecycleState === "WITHDRAWN") {
    candidates.push(lifecycleCandidate("EVT-007", previous, current, previous.pendingOperation?.attemptId ?? newlyResolved?.attemptId));
  }
  return Object.freeze(candidates);
}

function reconciliationCandidate(current: PublicationSnapshot, resolved: ReconciliationCase): PublicationEventCandidate {
  return Object.freeze({
    eventType: "EVT-006" as const,
    attemptId: resolved.attemptId,
    payload: Object.freeze({
      publicationId: current.publicationId,
      caseId: resolved.id,
      attemptId: resolved.attemptId,
      resolutionCategory: resolved.resolution,
      evidenceReferences: Object.freeze([...resolved.evidenceRefs]),
    }),
  });
}

function lifecycleCandidate(eventType: "EVT-003" | "EVT-007" | "EVT-008", previous: PublicationSnapshot, current: PublicationSnapshot, attemptId?: string): PublicationEventCandidate {
  const attempt = current.attempts.find((item) => item.id === attemptId);
  return Object.freeze({
    eventType,
    ...(attemptId === undefined ? {} : { attemptId }),
    payload: Object.freeze({
      publicationId: current.publicationId,
      priorLifecycle: previous.lifecycleState,
      newLifecycle: current.lifecycleState,
      ...(attemptId === undefined ? {} : { attemptId }),
      effectiveVersion: current.effectiveVersion,
      evidenceReferences: Object.freeze([...(attempt?.evidenceRefs ?? [])]),
    }),
  });
}

function operationForResolvedCase(previous: PublicationSnapshot, resolved: ReconciliationCase | undefined): DeliveryOperation | undefined {
  if (resolved === undefined) return undefined;
  return previous.attempts.find((attempt) => attempt.id === resolved.attemptId)?.operation;
}
