import { createHash } from "node:crypto";

import type { AuthorizationDecision } from "../../../modules/authorization/src/authorization-service.js";
import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { PublicationAuditRecord } from "../../../modules/publication/src/publication-audit-store.js";
import type { PublicationLiveAuthorizationContext } from "../../../modules/publication/src/publication-authorization.js";
import type {
  PublicationLifecycleState,
  PublicationSnapshot,
  PublicationSuspensionStatus,
} from "../../../modules/publication/src/publication-contracts.js";
import { immutableApiValue, type PublicationApiCommandOperation } from "./publication-api-contracts.js";

export interface PublicationCanonicalView {
  readonly viewType: "PUBLICATION";
  readonly publicationId: string;
  readonly lifecycle: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly aggregateVersion: number;
  readonly publicationVersion: number;
  readonly effectiveVersion?: number;
  readonly target: Readonly<{ readonly id: string; readonly version: number }>;
  readonly channel: Readonly<{ readonly id: string; readonly policyVersion: string }>;
  readonly stale: boolean;
}

export interface PublicationOperationsView {
  readonly screenId: "UI-031";
  readonly publicationId: string;
  readonly lifecycle: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly aggregateVersion: number;
  readonly effectiveVersion?: number;
  readonly target: Readonly<{ readonly id: string; readonly version: number }>;
  readonly channel: Readonly<{ readonly id: string; readonly policyVersion: string }>;
  readonly currentOperationState: string;
  readonly prerequisiteSummary: Readonly<{
    readonly approval: string;
    readonly verification: string;
    readonly permission: string;
    readonly policy: string;
    readonly binding: string;
    readonly mfaReady: boolean;
    readonly documentedReasonRequired: true;
  }>;
  readonly availableActions: readonly PublicationApiCommandOperation[];
  readonly blockedActions: readonly string[];
  readonly stale: boolean;
}

export interface PublicationRevalidationView {
  readonly screenId: "UI-032";
  readonly publicationId: string;
  readonly approvalStatus: string;
  readonly verificationStatus: string;
  readonly permissionStatus: string;
  readonly policyStatus: "CURRENT" | "STALE" | "UNKNOWN";
  readonly bindingStatus: "MATCHED" | "MISMATCHED" | "UNKNOWN";
  readonly stale: boolean;
  readonly revalidationRequired: boolean;
  readonly availableActions: readonly PublicationApiCommandOperation[];
}

export interface PublicationRecoveryView {
  readonly screenId: "UI-033";
  readonly publicationId: string;
  readonly lifecycle: PublicationLifecycleState;
  readonly reconciliationStatus: "NONE" | "OPEN" | "RESOLVED";
  readonly caseId?: string;
  readonly attemptId?: string;
  readonly outcomeCategory: "NONE" | "PENDING" | "CONFIRMED" | "NO_EFFECT" | "UNKNOWN";
  readonly manualReviewRequired: boolean;
  readonly availableActions: readonly PublicationApiCommandOperation[];
  readonly safeEvidenceSummary: Readonly<{ readonly referenceCount: number; readonly restricted: true }>;
}

export interface PublicationAuditHistoryView {
  readonly screenId: "UI-035";
  readonly historyKind: "PUBLICATION_AUDIT_HISTORY";
  readonly publicationId: string;
  readonly aggregateVersion: number;
  readonly lifecycleHistory: readonly Readonly<{
    readonly id: string;
    readonly sequence: number;
    readonly transitionId: string;
    readonly fromState?: PublicationLifecycleState;
    readonly toState: PublicationLifecycleState;
    readonly occurredAt: string;
  }>[];
  readonly attemptHistory: readonly Readonly<{
    readonly id: string;
    readonly sequence: number;
    readonly operation: string;
    readonly outcome: string;
    readonly occurredAt: string;
  }>[];
  readonly reconciliationHistory: readonly Readonly<{
    readonly id: string;
    readonly attemptId: string;
    readonly status: string;
    readonly openedAt: string;
    readonly resolvedAt?: string;
  }>[];
  readonly authorizationDecisionSummary: Readonly<{ readonly allowed: number; readonly denied: number }>;
  readonly auditEntries: readonly Readonly<{
    readonly id: string;
    readonly command: string;
    readonly timestamp: string;
    readonly version: number;
    readonly result: "COMPLETED" | "FAILED";
    readonly actorId?: string;
    readonly failureCode?: string;
  }>[];
}

export type PublicationViewContract =
  | PublicationCanonicalView
  | PublicationOperationsView
  | PublicationRevalidationView
  | PublicationRecoveryView
  | PublicationAuditHistoryView;

export interface PublicationViewDependencies {
  readonly snapshot: PublicationSnapshot;
  readonly session: SessionContext;
  readonly live: PublicationLiveAuthorizationContext | undefined;
  readonly audit: readonly PublicationAuditRecord[];
  readonly authorizationDecisions: readonly Readonly<{ readonly decision: "ALLOW" | "DENY" }>[];
  readonly authorizeAction: (action: string) => AuthorizationDecision;
  readonly maxEntries: number;
  readonly expectedPolicyVersion: string;
  readonly canViewAuditActor: boolean;
}

const actionCapabilities: Readonly<Record<PublicationApiCommandOperation, string>> = Object.freeze({
  CREATE_PUBLICATION: "publication.create",
  PUBLISH_PUBLICATION: "publication.execution.begin",
  CORRECT_PUBLICATION: "publication.active-operation.begin",
  SUSPEND_PUBLICATION: "publication.suspension.set",
  RESUME_PUBLICATION: "publication.suspension.set",
  REQUEST_WITHDRAWAL: "publication.withdraw.request",
  RESOLVE_WITHDRAWAL: "publication.withdraw.resolve",
  REPUBLISH_PUBLICATION: "publication.republish.begin",
  RESOLVE_RECONCILIATION: "publication.reconciliation.resolve",
  RECOVER_PUBLICATION: "publication.reconciliation.resolve",
  SUPERSEDE_PUBLICATION: "publication.supersede",
  TERMINATE_PUBLICATION: "publication.terminate",
});

export function createCanonicalPublicationView(dependencies: PublicationViewDependencies): PublicationCanonicalView {
  const { snapshot } = dependencies;
  return immutableApiValue({
    viewType: "PUBLICATION" as const,
    publicationId: snapshot.publicationId,
    lifecycle: snapshot.lifecycleState,
    suspensionStatus: snapshot.suspensionStatus,
    aggregateVersion: snapshot.aggregateVersion,
    publicationVersion: snapshot.publicationVersion,
    ...(snapshot.effectiveVersion === undefined ? {} : { effectiveVersion: snapshot.effectiveVersion }),
    target: { id: snapshot.binding.targetId, version: snapshot.binding.targetVersion },
    channel: { id: snapshot.binding.channelId, policyVersion: snapshot.binding.channelPolicyVersion },
    stale: isStale(dependencies),
  });
}

export function createPublicationOperationsView(dependencies: PublicationViewDependencies): PublicationOperationsView {
  const { snapshot, live, session } = dependencies;
  const actions = derivePublicationActions(dependencies);
  const stale = isStale(dependencies);
  return immutableApiValue({
    screenId: "UI-031" as const,
    publicationId: snapshot.publicationId,
    lifecycle: snapshot.lifecycleState,
    suspensionStatus: snapshot.suspensionStatus,
    aggregateVersion: snapshot.aggregateVersion,
    ...(snapshot.effectiveVersion === undefined ? {} : { effectiveVersion: snapshot.effectiveVersion }),
    target: { id: snapshot.binding.targetId, version: snapshot.binding.targetVersion },
    channel: { id: snapshot.binding.channelId, policyVersion: snapshot.binding.channelPolicyVersion },
    currentOperationState: snapshot.pendingOperation?.operation ?? snapshot.lifecycleState,
    prerequisiteSummary: {
      approval: live?.approval.status ?? "UNKNOWN",
      verification: live?.verification.status ?? "UNKNOWN",
      permission: live?.permission.status ?? "UNKNOWN",
      policy: live === undefined ? "UNKNOWN" : live.policyVersion,
      binding: bindingMatches(snapshot, live) ? "MATCHED" : live === undefined ? "UNKNOWN" : "MISMATCHED",
      mfaReady: session.isMfaVerified && session.assurance === "MFA",
      documentedReasonRequired: true as const,
    },
    availableActions: actions,
    blockedActions: actionBlockers(dependencies, actions),
    stale,
  });
}

export function createPublicationRevalidationView(dependencies: PublicationViewDependencies): PublicationRevalidationView {
  const stale = isStale(dependencies);
  const { snapshot, live } = dependencies;
  return immutableApiValue({
    screenId: "UI-032" as const,
    publicationId: snapshot.publicationId,
    approvalStatus: live?.approval.status ?? "UNKNOWN",
    verificationStatus: live?.verification.status ?? "UNKNOWN",
    permissionStatus: live?.permission.status ?? "UNKNOWN",
    policyStatus: live === undefined ? "UNKNOWN" as const : live.policyVersion === dependencies.expectedPolicyVersion ? "CURRENT" as const : "STALE" as const,
    bindingStatus: live === undefined ? "UNKNOWN" as const : bindingMatches(snapshot, live) ? "MATCHED" as const : "MISMATCHED" as const,
    stale,
    revalidationRequired: stale,
    availableActions: stale ? Object.freeze([]) : derivePublicationActions(dependencies),
  });
}

export function createPublicationRecoveryView(dependencies: PublicationViewDependencies): PublicationRecoveryView {
  const { snapshot } = dependencies;
  const reconciliation = snapshot.reconciliationCases.at(-1);
  const attempt = reconciliation === undefined ? undefined : snapshot.attempts.find(({ id }) => id === reconciliation.attemptId);
  const actions = derivePublicationActions(dependencies).filter((action) => action === "RESOLVE_RECONCILIATION" || action === "RECOVER_PUBLICATION");
  return immutableApiValue({
    screenId: "UI-033" as const,
    publicationId: snapshot.publicationId,
    lifecycle: snapshot.lifecycleState,
    reconciliationStatus: reconciliation?.status ?? "NONE",
    ...(reconciliation === undefined ? {} : { caseId: reconciliation.id, attemptId: reconciliation.attemptId }),
    outcomeCategory: attempt?.outcome ?? "NONE",
    manualReviewRequired: reconciliation?.status === "OPEN",
    availableActions: actions,
    safeEvidenceSummary: { referenceCount: reconciliation?.evidenceRefs.length ?? 0, restricted: true as const },
  });
}

export function createPublicationAuditHistoryView(dependencies: PublicationViewDependencies): PublicationAuditHistoryView {
  const { snapshot, maxEntries } = dependencies;
  const tail = <Value>(values: readonly Value[]): readonly Value[] => values.slice(-maxEntries);
  return immutableApiValue({
    screenId: "UI-035" as const,
    historyKind: "PUBLICATION_AUDIT_HISTORY" as const,
    publicationId: snapshot.publicationId,
    aggregateVersion: snapshot.aggregateVersion,
    lifecycleHistory: tail(snapshot.transitionHistory).map((item) => ({
      id: item.id, sequence: item.sequence, transitionId: item.transitionId,
      ...(item.fromState === undefined ? {} : { fromState: item.fromState }),
      toState: item.toState, occurredAt: item.occurredAt,
    })),
    attemptHistory: tail(snapshot.attempts).map((item) => ({ id: item.id, sequence: item.sequence, operation: item.operation, outcome: item.outcome, occurredAt: item.occurredAt })),
    reconciliationHistory: tail(snapshot.reconciliationCases).map((item) => ({ id: item.id, attemptId: item.attemptId, status: item.status, openedAt: item.openedAt, ...(item.resolvedAt === undefined ? {} : { resolvedAt: item.resolvedAt }) })),
    authorizationDecisionSummary: {
      allowed: dependencies.authorizationDecisions.filter(({ decision }) => decision === "ALLOW").length,
      denied: dependencies.authorizationDecisions.filter(({ decision }) => decision === "DENY").length,
    },
    auditEntries: tail(dependencies.audit).map((item) => ({
      id: publicAuditId(item.id),
      command: item.command,
      timestamp: item.timestamp,
      version: item.version,
      result: item.result,
      ...(dependencies.canViewAuditActor ? { actorId: item.actorId } : {}),
      ...(item.failureReason === undefined ? {} : { failureCode: "COMMAND_FAILED" }),
    })),
  });
}

export function derivePublicationActions(dependencies: PublicationViewDependencies): readonly PublicationApiCommandOperation[] {
  const { snapshot, session, live } = dependencies;
  if (session.principalType !== "HUMAN" || !session.roles.includes("OPS") || !session.isMfaVerified || session.assurance !== "MFA") return Object.freeze([]);
  if (live === undefined || isStale(dependencies) || hasActorConflict(session.principalId, live)) return Object.freeze([]);
  const candidates = candidateActions(snapshot);
  return Object.freeze(candidates.filter((action) => {
    try { return dependencies.authorizeAction(actionCapabilities[action]).effect === "ALLOW"; } catch { return false; }
  }));
}

function candidateActions(snapshot: PublicationSnapshot): readonly PublicationApiCommandOperation[] {
  if (snapshot.reconciliationCases.some(({ status }) => status === "OPEN")) return [];
  const suspension = snapshot.suspensionStatus === "NOT_SUSPENDED" ? ["SUSPEND_PUBLICATION"] as const : ["RESUME_PUBLICATION"] as const;
  const candidates = ((): readonly PublicationApiCommandOperation[] => { switch (snapshot.lifecycleState) {
    case "READY": return ["PUBLISH_PUBLICATION", ...suspension, "TERMINATE_PUBLICATION"];
    case "ACTIVE": return ["CORRECT_PUBLICATION", "REQUEST_WITHDRAWAL", "REPUBLISH_PUBLICATION", ...suspension, "SUPERSEDE_PUBLICATION"];
    case "WITHDRAWAL_PENDING": return ["RESOLVE_WITHDRAWAL", ...suspension];
    case "WITHDRAWN": return ["REPUBLISH_PUBLICATION", ...suspension];
    case "RECONCILIATION_REQUIRED": return suspension;
    case "EXECUTION_PENDING": return suspension;
    case "SUPERSEDED":
    case "TERMINATED": return [];
  } })();
  if (snapshot.suspensionStatus === "NOT_SUSPENDED") return candidates;
  return candidates.filter((action) => !suspensionBlockedActions.has(action));
}

const suspensionBlockedActions = new Set<PublicationApiCommandOperation>([
  "PUBLISH_PUBLICATION", "CORRECT_PUBLICATION", "REQUEST_WITHDRAWAL", "REPUBLISH_PUBLICATION",
]);

function publicAuditId(internalId: string): string {
  return `audit-${createHash("sha256").update(internalId).digest("hex").slice(0, 24)}`;
}

function isStale(dependencies: PublicationViewDependencies): boolean {
  const { snapshot, live } = dependencies;
  return live?.approval.status !== "APPROVED"
    || live.verification.status !== "VERIFIED"
    || live.permission.status !== "ACTIVE"
    || live.target.status !== "ACTIVE"
    || live.target.channelStatus !== "ACTIVE"
    || live.policyVersion !== dependencies.expectedPolicyVersion
    || !bindingMatches(snapshot, live);
}

function bindingMatches(snapshot: PublicationSnapshot, live: PublicationLiveAuthorizationContext | undefined): boolean {
  if (live === undefined) return false;
  const binding = snapshot.binding;
  return live.representation.id === binding.representationId
    && live.representation.version === binding.representationVersion
    && live.representation.checksum === binding.representationChecksum
    && live.approval.id === binding.approvalId
    && live.approval.version === binding.approvalVersion
    && live.target.id === binding.targetId
    && live.target.version === binding.targetVersion
    && live.target.channelId === binding.channelId
    && live.target.channelPolicyVersion === binding.channelPolicyVersion;
}

function hasActorConflict(actorId: string, live: PublicationLiveAuthorizationContext): boolean {
  return [
    live.approval.requesterActorId,
    live.approval.decisionActorId,
    live.representation.creatorActorId,
    ...live.representation.editorActorIds,
    live.verification.decisionActorId,
    live.permission.decisionActorId,
    ...live.evidenceSubmitterActorIds,
  ].some((conflictActorId) => conflictActorId === actorId);
}

function actionBlockers(dependencies: PublicationViewDependencies, actions: readonly PublicationApiCommandOperation[]): readonly string[] {
  const blockers: string[] = [];
  if (isStale(dependencies)) blockers.push("PREREQUISITE_REVALIDATION_REQUIRED");
  if (!dependencies.session.isMfaVerified || dependencies.session.assurance !== "MFA") blockers.push("MFA_REQUIRED");
  if (dependencies.live !== undefined && hasActorConflict(dependencies.session.principalId, dependencies.live)) blockers.push("SEPARATION_OF_DUTIES");
  if (actions.length === 0) blockers.push("NO_CURRENT_MUTATION_AUTHORITY");
  blockers.push("DOCUMENTED_REASON_REQUIRED_AT_COMMAND");
  return Object.freeze(blockers);
}
