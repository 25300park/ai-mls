import type { AuthorizationDecision, AuthorizationRequest } from "../../authorization/src/authorization-service.js";
import {
  hasVerifiedMfaAssurance,
  isAuthenticationAssuranceConsistent,
  type SessionContext,
} from "../../identity/src/session-service.js";
import type { PublicationModificationCommand } from "./publication-application-contracts.js";
import type { PublicationBinding } from "./publication-contracts.js";

export type PublicationAuthorizationCommandType = "CREATE_PUBLICATION" | PublicationModificationCommand["type"];

export type PublicationAuthorizationErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "PURPOSE_SCOPE_DENIED"
  | "MFA_REQUIRED"
  | "REASON_REQUIRED"
  | "SEPARATION_OF_DUTIES_DENIED"
  | "APPROVAL_NOT_EFFECTIVE"
  | "VERIFICATION_NOT_EFFECTIVE"
  | "PERMISSION_NOT_EFFECTIVE"
  | "BINDING_MISMATCH"
  | "POLICY_VERSION_STALE"
  | "PUBLICATION_VERSION_CONFLICT";

export interface PublicationSessionResolver {
  resolve(sessionId: string): SessionContext | undefined;
}

export interface PublicationAuthorizationEvaluator {
  evaluate(request: AuthorizationRequest): AuthorizationDecision;
}

export interface PublicationLiveAuthorizationContext {
  readonly tenantId: string;
  readonly teamId: string;
  readonly purpose: "PUBLICATION_EXECUTION";
  readonly policyVersion: string;
  readonly representation: Readonly<{
    id: string;
    version: number;
    checksum: string;
    subjectId: string;
    subjectRevision: number;
    creatorActorId: string;
    editorActorIds: readonly string[];
  }>;
  readonly approval: Readonly<{
    id: string;
    version: number;
    status: "APPROVED" | "REQUESTED" | "UNDER_REVIEW" | "REJECTED" | "REVOKED" | "EXPIRED";
    expiresAt: string;
    requesterActorId: string;
    decisionActorId?: string;
    representationId: string;
    representationVersion: number;
    representationChecksum: string;
    subjectId: string;
    subjectRevision: number;
    verificationId: string;
    verificationVersion: number;
    permissionId: string;
    permissionVersion: number;
    targetId: string;
    targetPolicyVersion: string;
    channelId: string;
    channelPolicyVersion: string;
    audience: string;
  }>;
  readonly verification: Readonly<{
    id: string;
    version: number;
    status: string;
    subjectId: string;
    subjectRevision: number;
    decisionActorId?: string;
  }>;
  readonly permission: Readonly<{
    id: string;
    version: number;
    status: string;
    type: string;
    purpose: string;
    subjectId: string;
    subjectRevision: number;
    decisionActorId?: string;
    audience: string;
  }>;
  readonly target: Readonly<{
    id: string;
    version: number;
    status: string;
    policyVersion: string;
    channelId: string;
    channelStatus: string;
    channelPolicyVersion: string;
  }>;
  readonly evidenceSubmitterActorIds: readonly string[];
}

export interface PublicationLiveAuthorizationContextResolver {
  resolve(binding: PublicationBinding, scope: Readonly<{ tenantId: string; teamId?: string }>): PublicationLiveAuthorizationContext | undefined;
}

export interface PublicationAuthorizationEvidence {
  readonly decisionId: string;
  readonly commandType: PublicationAuthorizationCommandType;
  readonly actorId: string;
  readonly tenantId: string;
  readonly teamId: string;
  readonly purpose: string;
  readonly aggregateId: string;
  readonly expectedAggregateVersion: number;
  readonly approvalReference: string;
  readonly verificationReference: string;
  readonly permissionReference: string;
  readonly targetReference: string;
  readonly channelReference: string;
  readonly policyVersion: string;
  readonly decision: "ALLOW" | "DENY";
  readonly reasonCode: string;
  readonly checkedAt: string;
  readonly correlationId: string;
  readonly classification: "RESTRICTED_SECURITY";
}

export interface PublicationAuthorizationEvidenceStore {
  append(evidence: PublicationAuthorizationEvidence): void;
  list(aggregateId: string): readonly PublicationAuthorizationEvidence[];
}

export class InMemoryPublicationAuthorizationEvidenceStore implements PublicationAuthorizationEvidenceStore {
  readonly #records: PublicationAuthorizationEvidence[] = [];

  public append(evidence: PublicationAuthorizationEvidence): void {
    const existing = this.#records.find((item) => item.decisionId === evidence.decisionId);
    if (existing !== undefined && JSON.stringify(existing) === JSON.stringify(evidence)) return;
    if (existing !== undefined) {
      throw new Error("AUTHORIZATION_EVIDENCE_DUPLICATE");
    }
    this.#records.push(immutable(evidence));
  }

  public list(aggregateId: string): readonly PublicationAuthorizationEvidence[] {
    return Object.freeze(this.#records.filter((item) => item.aggregateId === aggregateId));
  }
}

export interface PublicationAuthorizationClock {
  now(): string;
}

export interface PublicationAuthorizationDependencies {
  readonly sessionResolver?: PublicationSessionResolver;
  readonly authorizationEvaluator?: PublicationAuthorizationEvaluator;
  readonly liveContextResolver?: PublicationLiveAuthorizationContextResolver;
  readonly evidence: PublicationAuthorizationEvidenceStore;
  readonly clock: PublicationAuthorizationClock;
  readonly publicationPolicyVersion?: string;
}

export interface PublicationAuthorizationRequest {
  readonly sessionId?: string;
  readonly commandType: PublicationAuthorizationCommandType;
  readonly actorIdClaim?: string;
  readonly tenantId: string;
  readonly teamId?: string;
  readonly purpose: string;
  readonly aggregateId: string;
  readonly expectedAggregateVersion: number;
  readonly reason: string;
  readonly correlationId: string;
  readonly binding?: PublicationBinding;
  readonly currentAggregateVersion?: number;
  readonly resolveResource?: (actor: SessionContext) => PublicationAuthorizationResource;
}

export interface PublicationAuthorizationResource {
  readonly binding: PublicationBinding;
  readonly currentAggregateVersion: number;
}

type ResolvedPublicationAuthorizationRequest = PublicationAuthorizationRequest & PublicationAuthorizationResource;

export interface PublicationAuthorizationSuccess {
  readonly actor: SessionContext;
  readonly evidence: PublicationAuthorizationEvidence;
}

export class PublicationAuthorizationError extends Error {
  public constructor(public readonly code: PublicationAuthorizationErrorCode) {
    super(safeMessage(code));
    this.name = "PublicationAuthorizationError";
  }
}

const commandCapabilities: Readonly<Record<PublicationAuthorizationCommandType, string>> = Object.freeze({
  CREATE_PUBLICATION: "publication.create",
  BEGIN_INITIAL_EXECUTION: "publication.execution.begin",
  RESOLVE_EXECUTION: "publication.execution.resolve",
  REQUEST_WITHDRAWAL: "publication.withdraw.request",
  RESOLVE_WITHDRAWAL: "publication.withdraw.resolve",
  BEGIN_ACTIVE_OPERATION: "publication.active-operation.begin",
  BEGIN_WITHDRAWN_REPUBLISH: "publication.republish.begin",
  RESOLVE_RECONCILIATION: "publication.reconciliation.resolve",
  SUPERSEDE: "publication.supersede",
  TERMINATE: "publication.terminate",
  SET_SUSPENSION: "publication.suspension.set",
});

export function publicationCapability(commandType: PublicationAuthorizationCommandType): string {
  return commandCapabilities[commandType];
}

export class PublicationAuthorizationGuard {
  public constructor(private readonly dependencies: PublicationAuthorizationDependencies) {}

  public authorize(request: PublicationAuthorizationRequest): PublicationAuthorizationSuccess {
    const checkedAt = this.dependencies.clock.now();
    const session = this.resolveSession(request, checkedAt);
    if (!isAuthenticationAssuranceConsistent(session)) {
      this.deny(request, session, undefined, "AUTHENTICATION_REQUIRED", checkedAt);
    }
    if (!hasVerifiedMfaAssurance(session)) {
      this.deny(request, session, undefined, "MFA_REQUIRED", checkedAt);
    }
    if (request.purpose !== "PUBLICATION_EXECUTION" || session.teamId === undefined
      || (request.teamId !== undefined && request.teamId !== session.teamId)) {
      this.deny(request, session, undefined, "PURPOSE_SCOPE_DENIED", checkedAt);
    }
    const evaluator = this.dependencies.authorizationEvaluator;
    if (evaluator === undefined) this.deny(request, session, undefined, "AUTHORIZATION_DENIED", checkedAt);
    let authorization: AuthorizationDecision;
    try {
      authorization = evaluator.evaluate({
        session,
        action: publicationCapability(request.commandType),
        resource: { type: "Publication", id: request.aggregateId, version: request.expectedAggregateVersion, teamId: session.teamId },
        purpose: request.purpose,
        reason: request.reason,
        correlationId: request.correlationId,
      });
    } catch {
      this.deny(request, session, undefined, "AUTHORIZATION_DENIED", checkedAt);
    }
    if (authorization.effect !== "ALLOW") {
      this.deny(request, session, undefined, mapAuthorizationReason(authorization.reasonCode), checkedAt);
    }

    const resource = this.resolveResource(request, session, checkedAt);
    const resolvedRequest: ResolvedPublicationAuthorizationRequest = { ...request, ...resource };
    let live: PublicationLiveAuthorizationContext | undefined;
    try {
      live = this.dependencies.liveContextResolver?.resolve(resource.binding, {
        tenantId: request.tenantId,
        teamId: session.teamId,
      });
    } catch {
      live = undefined;
    }
    if (live === undefined) this.deny(resolvedRequest, session, undefined, "APPROVAL_NOT_EFFECTIVE", checkedAt);
    if (live.purpose !== "PUBLICATION_EXECUTION" || request.tenantId !== live.tenantId || session.teamId !== live.teamId) {
      this.deny(resolvedRequest, session, live, "PURPOSE_SCOPE_DENIED", checkedAt);
    }

    this.validateSoD(resolvedRequest, session, live, checkedAt);
    this.validateLiveBinding(resolvedRequest, session, live, checkedAt);
    if (resource.currentAggregateVersion !== request.expectedAggregateVersion) {
      this.deny(resolvedRequest, session, live, "PUBLICATION_VERSION_CONFLICT", checkedAt);
    }

    const evidence = this.evidence(resolvedRequest, session, live, "ALLOW", "POLICY_ALLOWED", checkedAt, live.policyVersion);
    try {
      this.dependencies.evidence.append(evidence);
    } catch {
      throw new PublicationAuthorizationError("AUTHORIZATION_DENIED");
    }
    return Object.freeze({ actor: session, evidence });
  }

  private resolveResource(request: PublicationAuthorizationRequest, session: SessionContext, checkedAt: string): PublicationAuthorizationResource {
    if (request.resolveResource !== undefined) return request.resolveResource(session);
    if (request.binding !== undefined && request.currentAggregateVersion !== undefined) {
      return Object.freeze({ binding: request.binding, currentAggregateVersion: request.currentAggregateVersion });
    }
    this.deny(request, session, undefined, "APPROVAL_NOT_EFFECTIVE", checkedAt);
  }

  private resolveSession(request: PublicationAuthorizationRequest, checkedAt: string): SessionContext {
    if (request.sessionId === undefined || request.sessionId.trim().length === 0 || this.dependencies.sessionResolver === undefined) {
      this.deny(request, undefined, undefined, "AUTHENTICATION_REQUIRED", checkedAt);
    }
    let session: SessionContext | undefined;
    try { session = this.dependencies.sessionResolver.resolve(request.sessionId); } catch { session = undefined; }
    if (session === undefined || !activeAt(session, request.sessionId, checkedAt)) {
      this.deny(request, session, undefined, "AUTHENTICATION_REQUIRED", checkedAt);
    }
    return session;
  }

  private validateSoD(request: ResolvedPublicationAuthorizationRequest, session: SessionContext, live: PublicationLiveAuthorizationContext, checkedAt: string): void {
    const conflicts = new Set([
      live.approval.requesterActorId,
      live.approval.decisionActorId,
      live.representation.creatorActorId,
      ...live.representation.editorActorIds,
      live.verification.decisionActorId,
      live.permission.decisionActorId,
      ...live.evidenceSubmitterActorIds,
    ].filter((value): value is string => value !== undefined));
    if (conflicts.has(session.principalId)) {
      this.deny(request, session, live, "SEPARATION_OF_DUTIES_DENIED", checkedAt);
    }
  }

  private validateLiveBinding(request: ResolvedPublicationAuthorizationRequest, session: SessionContext, live: PublicationLiveAuthorizationContext, checkedAt: string): void {
    const binding = request.binding;
    if (live.approval.status !== "APPROVED" || !futureTimestamp(live.approval.expiresAt, checkedAt)) {
      this.deny(request, session, live, "APPROVAL_NOT_EFFECTIVE", checkedAt);
    }
    if (live.verification.status !== "VERIFIED" || live.verification.id !== live.approval.verificationId
      || live.verification.id.trim().length === 0 || !positiveVersion(live.verification.version)
      || !positiveVersion(live.approval.verificationVersion)
      || live.verification.version !== live.approval.verificationVersion) {
      this.deny(request, session, live, "VERIFICATION_NOT_EFFECTIVE", checkedAt);
    }
    if (live.permission.status !== "ACTIVE" || live.permission.type !== "PUBLIC_PUBLICATION"
      || live.permission.purpose !== "PURPOSE_PUBLICATION_APPROVAL" || live.permission.audience !== "AUD_PUBLIC"
      || live.permission.id.trim().length === 0 || !positiveVersion(live.permission.version)
      || !positiveVersion(live.approval.permissionVersion)
      || live.permission.id !== live.approval.permissionId || live.permission.version !== live.approval.permissionVersion) {
      this.deny(request, session, live, "PERMISSION_NOT_EFFECTIVE", checkedAt);
    }
    const exactSubject = [live.representation.subjectId, live.approval.subjectId, live.verification.subjectId, live.permission.subjectId]
      .every((value) => value === binding.subjectId)
      && [live.representation.subjectRevision, live.approval.subjectRevision, live.verification.subjectRevision, live.permission.subjectRevision]
        .every((value) => value === binding.subjectRevision);
    const exactRepresentation = live.representation.id === binding.representationId
      && live.representation.version === binding.representationVersion
      && live.representation.checksum === binding.representationChecksum
      && live.approval.representationId === binding.representationId
      && live.approval.representationVersion === binding.representationVersion
      && live.approval.representationChecksum === binding.representationChecksum;
    const exactApproval = live.approval.id === binding.approvalId && live.approval.version === binding.approvalVersion;
    const exactTarget = live.target.id === binding.targetId && live.target.version === binding.targetVersion
      && live.target.status === "ACTIVE" && live.approval.targetId === binding.targetId;
    const exactChannel = live.target.channelId === binding.channelId && live.target.channelStatus === "ACTIVE"
      && live.approval.channelId === binding.channelId;
    const exactAudience = live.approval.audience === "AUD_PUBLIC"
      && live.permission.audience === live.approval.audience;
    if (!exactSubject || !exactRepresentation || !exactApproval || !exactTarget || !exactChannel || !exactAudience) {
      this.deny(request, session, live, "BINDING_MISMATCH", checkedAt);
    }
    if (live.target.policyVersion !== live.approval.targetPolicyVersion
      || live.target.channelPolicyVersion !== binding.channelPolicyVersion
      || live.approval.channelPolicyVersion !== binding.channelPolicyVersion
      || this.dependencies.publicationPolicyVersion === undefined
      || this.dependencies.publicationPolicyVersion.trim().length === 0
      || live.policyVersion.trim().length === 0
      || live.policyVersion !== this.dependencies.publicationPolicyVersion) {
      this.deny(request, session, live, "POLICY_VERSION_STALE", checkedAt);
    }
  }

  private deny(request: PublicationAuthorizationRequest, session: SessionContext | undefined, live: PublicationLiveAuthorizationContext | undefined, code: PublicationAuthorizationErrorCode, checkedAt: string): never {
    const policyVersion = live?.policyVersion ?? this.dependencies.publicationPolicyVersion ?? "UNAVAILABLE";
    try {
      this.dependencies.evidence.append(this.evidence(request, session, live, "DENY", code, checkedAt, policyVersion));
    } catch {
      // Denial evidence failure must never replace or weaken the original safe authorization decision.
    }
    throw new PublicationAuthorizationError(code);
  }

  private evidence(request: PublicationAuthorizationRequest, session: SessionContext | undefined, live: PublicationLiveAuthorizationContext | undefined, decision: "ALLOW" | "DENY", reasonCode: string, checkedAt: string, policyVersion: string): PublicationAuthorizationEvidence {
    const reference = (id: string | undefined, version: number | undefined): string => id === undefined ? "UNAVAILABLE" : `${id}@${String(version ?? 0)}`;
    return immutable({
      decisionId: JSON.stringify([request.aggregateId, request.expectedAggregateVersion, request.correlationId, request.commandType, session?.principalId ?? "anonymous", decision, reasonCode, checkedAt]),
      commandType: request.commandType,
      actorId: session?.principalId ?? "anonymous",
      tenantId: request.tenantId,
      teamId: live?.teamId ?? session?.teamId ?? "UNAVAILABLE",
      purpose: request.purpose,
      aggregateId: request.aggregateId,
      expectedAggregateVersion: request.expectedAggregateVersion,
      approvalReference: reference(live?.approval.id ?? request.binding?.approvalId, live?.approval.version ?? request.binding?.approvalVersion),
      verificationReference: reference(live?.verification.id, live?.verification.version),
      permissionReference: reference(live?.permission.id, live?.permission.version),
      targetReference: reference(live?.target.id ?? request.binding?.targetId, live?.target.version ?? request.binding?.targetVersion),
      channelReference: live?.target.channelId ?? request.binding?.channelId ?? "UNAVAILABLE",
      policyVersion,
      decision,
      reasonCode,
      checkedAt,
      correlationId: request.correlationId,
      classification: "RESTRICTED_SECURITY" as const,
    });
  }
}

function mapAuthorizationReason(reasonCode: string): PublicationAuthorizationErrorCode {
  if (reasonCode === "AUTHENTICATION_REQUIRED") return "AUTHENTICATION_REQUIRED";
  if (reasonCode === "SCOPE_DENIED") return "PURPOSE_SCOPE_DENIED";
  if (reasonCode === "REAUTHENTICATION_REQUIRED") return "MFA_REQUIRED";
  if (reasonCode === "REASON_REQUIRED") return "REASON_REQUIRED";
  if (reasonCode === "SEPARATION_OF_DUTIES_DENIED") return "SEPARATION_OF_DUTIES_DENIED";
  return "AUTHORIZATION_DENIED";
}

function safeMessage(code: PublicationAuthorizationErrorCode): string {
  if (code === "AUTHENTICATION_REQUIRED") return "Authentication is required.";
  if (code === "PUBLICATION_VERSION_CONFLICT") return "Publication version conflict.";
  return "Publication command was not authorized.";
}

function activeAt(session: SessionContext, sessionId: string | undefined, checkedAt: string): boolean {
  const checkedAtValue = Date.parse(checkedAt);
  const expiresAtValue = Date.parse(session.expiresAt);
  const absoluteExpiresAtValue = Date.parse(session.absoluteExpiresAt);
  return sessionId !== undefined
    && session.id === sessionId
    && session.state === "ACTIVE"
    && Number.isFinite(checkedAtValue)
    && Number.isFinite(expiresAtValue)
    && Number.isFinite(absoluteExpiresAtValue)
    && checkedAtValue < expiresAtValue
    && checkedAtValue < absoluteExpiresAtValue;
}

function futureTimestamp(value: string, comparedWith: string): boolean {
  const parsed = Date.parse(value);
  const comparison = Date.parse(comparedWith);
  return Number.isFinite(parsed) && Number.isFinite(comparison) && comparison < parsed;
}

function positiveVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function immutable<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
