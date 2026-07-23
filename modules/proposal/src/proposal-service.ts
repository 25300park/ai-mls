import type { AuditPrincipal, AuditSink, Clock, DataClassification, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { MatchResult } from "../../matching/src/matching-service.js";
import type { Permission, PermissionAudience } from "../../permission/src/permission-service.js";
import type { VersionedEntityReference } from "../../verification/src/verification-service.js";

export type ProposalStatus = "DRAFT" | "REVIEW_PENDING" | "APPROVED_TO_SHARE" | "REVISION_REQUIRED" | "SHARED" | "FEEDBACK_RECEIVED" | "EXPIRED" | "WITHDRAWN";
export type ProposalReviewDecision = "SUBMIT" | "APPROVE" | "REQUEST_REVISION";
export interface ProposalStatusEntry { readonly status: ProposalStatus; readonly actorId: string; readonly reason: string; readonly occurredAt: string }
export interface ProposalShareEntry { readonly actorId: string; readonly audience: PermissionAudience; readonly channel: string; readonly reason: string; readonly occurredAt: string }
export interface ProposalFeedbackEntry { readonly actorId: string; readonly feedbackReference: string; readonly summary: string; readonly occurredAt: string }
export interface ClientProposal {
  readonly id: string; readonly version: number; readonly teamId: string; readonly status: ProposalStatus;
  readonly matchResultRef: Readonly<{ readonly id: string; readonly version: number }>;
  readonly requirementRef: Readonly<{ readonly id: string; readonly version: number }>;
  readonly candidateRef: Readonly<{ readonly id: string; readonly version: number }>;
  readonly offerRef: Readonly<{ readonly id: string; readonly version: number }>;
  readonly clientRef: VersionedEntityReference; readonly permissionId: string; readonly permissionVersion: number;
  readonly representationChecksum: string; readonly createdBy: string; readonly createdAt: string;
  readonly statusHistory: readonly ProposalStatusEntry[]; readonly shareHistory: readonly ProposalShareEntry[];
  readonly feedbackHistory: readonly ProposalFeedbackEntry[]; readonly classification: DataClassification; readonly policyVersion: string;
}

interface Context { readonly actor: SessionContext; readonly purpose: "PURPOSE_CLIENT_PRESENTATION"; readonly correlationId: string; readonly requestId?: string }
interface Dependencies {
  readonly authorizationService: AuthorizationService; readonly auditSink: AuditSink; readonly clock: Clock; readonly idFactory: IdFactory; readonly policyVersion: string;
  readonly matchResultResolver: (matchResultId: string) => MatchResult | undefined;
  readonly permissionResolver: (permissionId: string) => Permission | undefined;
}
interface IdempotencyRecord { readonly fingerprint: string; readonly proposalId: string; readonly version: number }

function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function immutable<T>(value: T): T { const snapshot = structuredClone(value); deepFreeze(snapshot); return snapshot; }
function principal(actor: SessionContext): AuditPrincipal { return { id: actor.principalId, type: actor.principalType, roles: actor.roles, ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }), sessionId: actor.id }; }
function sameRef(left: VersionedEntityReference, right: VersionedEntityReference): boolean { return left.entityType === right.entityType && left.entityId === right.entityId && left.version === right.version; }

export class ProposalService {
  readonly #authorization: AuthorizationService; readonly #audit: AuditSink; readonly #clock: Clock; readonly #idFactory: IdFactory; readonly #policyVersion: string;
  readonly #matchResolver: Dependencies["matchResultResolver"]; readonly #permissionResolver: Dependencies["permissionResolver"];
  readonly #proposals = new Map<string, ClientProposal>(); readonly #history = new Map<string, ClientProposal[]>(); readonly #idempotency = new Map<string, IdempotencyRecord>();

  public constructor(dependencies: Dependencies) { this.#authorization = dependencies.authorizationService; this.#audit = dependencies.auditSink; this.#clock = dependencies.clock; this.#idFactory = dependencies.idFactory; this.#policyVersion = dependencies.policyVersion; this.#matchResolver = dependencies.matchResultResolver; this.#permissionResolver = dependencies.permissionResolver; }

  public createProposal(request: Context & { readonly matchResultId: string; readonly clientRef: VersionedEntityReference; readonly permissionId: string; readonly representationChecksum: string; readonly reason: string; readonly idempotencyKey: string }): ClientProposal {
    this.#reason(request.reason); if (request.representationChecksum.trim().length === 0) throw new Error("REPRESENTATION_CHECKSUM_MISMATCH");
    const teamId = this.#team(request.actor); this.#authorize(request, "proposal.create", "new", teamId);
    const fingerprint = JSON.stringify({ matchResultId: request.matchResultId, clientRef: request.clientRef, permissionId: request.permissionId, representationChecksum: request.representationChecksum, purpose: request.purpose });
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    const match = this.#matchResolver(request.matchResultId); if (match?.status !== "ACCEPTED" || match.teamId !== teamId) throw new Error("MATCH_REVIEW_REQUIRED");
    const permission = this.#validPermission(request.permissionId, request.clientRef, match, teamId);
    const occurredAt = this.#clock().toISOString();
    const proposal = immutable<ClientProposal>({ id: this.#idFactory(), version: 1, teamId, status: "DRAFT", matchResultRef: { id: match.id, version: match.version }, requirementRef: match.requirementRef, candidateRef: match.candidateRef, offerRef: match.offerRef, clientRef: request.clientRef, permissionId: permission.id, permissionVersion: permission.version, representationChecksum: request.representationChecksum, createdBy: request.actor.principalId, createdAt: occurredAt, statusHistory: [{ status: "DRAFT", actorId: request.actor.principalId, reason: request.reason, occurredAt }], shareHistory: [], feedbackHistory: [], classification: permission.classification, policyVersion: this.#policyVersion });
    this.#store(proposal); this.#remember(request, fingerprint, proposal); this.#record("PROPOSAL_CREATED", "proposal.create", proposal, request, request.reason, { matchResultId: match.id, permissionId: permission.id, audienceCode: permission.audience.code }); return proposal;
  }

  public reviewProposal(request: Context & { readonly proposalId: string; readonly expectedVersion: number; readonly decision: ProposalReviewDecision; readonly reason: string; readonly idempotencyKey: string }): ClientProposal {
    this.#reason(request.reason); const current = this.#scoped(request, request.proposalId);
    const action = request.decision === "SUBMIT" ? "proposal.submit" : "proposal.review";
    if (request.decision !== "SUBMIT" && (!request.actor.roles.includes("SAG") || request.actor.principalId === current.createdBy)) throw new Error("SEPARATION_OF_DUTIES_DENIED");
    this.#authorize(request, action, current.id, current.teamId, current.version, request.decision === "SUBMIT" ? undefined : current.createdBy);
    const fingerprint = JSON.stringify({ action, proposalId: current.id, expectedVersion: request.expectedVersion, decision: request.decision, reason: request.reason }); const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); let status: ProposalStatus;
    if (request.decision === "SUBMIT" && current.status === "DRAFT") status = "REVIEW_PENDING";
    else if (request.decision === "APPROVE" && current.status === "REVIEW_PENDING") status = "APPROVED_TO_SHARE";
    else if (request.decision === "REQUEST_REVISION" && current.status === "REVIEW_PENDING") status = "REVISION_REQUIRED";
    else throw new Error("STATE_TRANSITION_INVALID");
    const updated = this.#replace(current, request, { status }, "PROPOSAL_REVIEWED", action, request.reason); this.#remember(request, fingerprint, updated); return updated;
  }

  public recordProposalShare(request: Context & { readonly proposalId: string; readonly expectedVersion: number; readonly audience: PermissionAudience; readonly channel: string; readonly reason: string; readonly idempotencyKey: string }): ClientProposal {
    this.#reason(request.reason); if (request.channel.trim().length === 0) throw new Error("CHANNEL_NOT_ALLOWED"); const current = this.#scoped(request, request.proposalId); this.#authorize(request, "proposal.share", current.id, current.teamId, current.version);
    const fingerprint = JSON.stringify({ action: "SHARE", proposalId: current.id, expectedVersion: request.expectedVersion, audience: request.audience, channel: request.channel, reason: request.reason }); const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "APPROVED_TO_SHARE") throw new Error("STATE_TRANSITION_INVALID");
    const match = this.#matchResolver(current.matchResultRef.id); if (match === undefined) throw new Error("MATCH_RESULT_NOT_FOUND"); const permission = this.#validPermission(current.permissionId, current.clientRef, match, current.teamId, current.permissionVersion);
    if (JSON.stringify(permission.audience) !== JSON.stringify(request.audience)) throw new Error("PERMISSION_SCOPE_MISMATCH");
    const entry = immutable<ProposalShareEntry>({ actorId: request.actor.principalId, audience: request.audience, channel: request.channel, reason: request.reason, occurredAt: this.#clock().toISOString() });
    const updated = this.#replace(current, request, { status: "SHARED", shareHistory: [...current.shareHistory, entry] }, "PROPOSAL_SHARED", "proposal.share", request.reason); this.#remember(request, fingerprint, updated); return updated;
  }

  public recordProposalFeedback(request: Context & { readonly proposalId: string; readonly expectedVersion: number; readonly feedbackReference: string; readonly summary: string; readonly idempotencyKey: string }): ClientProposal {
    this.#reason(request.summary); if (request.feedbackReference.trim().length === 0) throw new Error("EVIDENCE_INVALID"); const current = this.#scoped(request, request.proposalId); this.#authorize(request, "proposal.feedback", current.id, current.teamId, current.version);
    const fingerprint = JSON.stringify({ action: "FEEDBACK", proposalId: current.id, expectedVersion: request.expectedVersion, feedbackReference: request.feedbackReference, summary: request.summary }); const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "SHARED" && current.status !== "FEEDBACK_RECEIVED") throw new Error("STATE_TRANSITION_INVALID");
    const entry = immutable<ProposalFeedbackEntry>({ actorId: request.actor.principalId, feedbackReference: request.feedbackReference, summary: request.summary, occurredAt: this.#clock().toISOString() });
    const updated = this.#replace(current, request, { status: "FEEDBACK_RECEIVED", feedbackHistory: [...current.feedbackHistory, entry] }, "PROPOSAL_FEEDBACK_RECORDED", "proposal.feedback", request.summary); this.#remember(request, fingerprint, updated); return updated;
  }

  public readProposal(request: Context & { readonly proposalId: string }): ClientProposal { const current = this.#scoped(request, request.proposalId); this.#authorize(request, "proposal.read", current.id, current.teamId, current.version); return current; }
  public readHistory(request: Context & { readonly proposalId: string }): readonly ClientProposal[] { const current = this.readProposal(request); return Object.freeze([...(this.#history.get(current.id) ?? [])]); }

  #validPermission(id: string, clientRef: VersionedEntityReference, match: MatchResult, teamId: string, expectedVersion?: number): Permission {
    const item = this.#permissionResolver(id); const recipient = item?.audience.recipientRef;
    if (item?.teamId !== teamId || item.status !== "ACTIVE" || this.#clock().getTime() >= new Date(item.validUntil).getTime() || item.permissionType !== "CLIENT_SHARING" || item.permissionPurpose !== "PURPOSE_CLIENT_PRESENTATION" || item.audience.code !== "AUD_NAMED_CLIENT" || recipient === undefined || !sameRef(recipient, clientRef) || item.subjectRef.entityId !== match.candidateRef.id || item.subjectRef.version !== match.candidateRef.version || (expectedVersion !== undefined && item.version !== expectedVersion)) throw new Error("PERMISSION_REQUIRED"); return item;
  }
  #team(actor: SessionContext): string { if (actor.teamId === undefined) throw new Error("TEAM_SCOPE_REQUIRED"); return actor.teamId; }
  #scoped(context: Context, id: string): ClientProposal { const item = this.#proposals.get(id); if (item === undefined || item.teamId !== context.actor.teamId || context.purpose !== "PURPOSE_CLIENT_PRESENTATION") throw new Error("PROPOSAL_NOT_FOUND"); return item; }
  #version(item: ClientProposal, expected: number): void { if (item.version !== expected) throw new Error("EXPECTED_VERSION_MISMATCH"); }
  #reason(value: string): void { if (value.trim().length === 0) throw new Error("REASON_REQUIRED"); if (/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{6,}\d)/iu.test(value)) throw new Error("SENSITIVE_FIELD_RESTRICTED"); }
  #authorize(context: Context, action: string, id: string, teamId: string, version?: number, createdBy?: string): void { const decision = this.#authorization.evaluate({ session: context.actor, action, resource: { type: "ClientProposal", id, teamId, ...(version === undefined ? {} : { version }), ...(createdBy === undefined ? {} : { createdBy }) }, purpose: context.purpose, ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId }); if (decision.effect === "DENY") throw new Error(decision.reasonCode); }
  #replace(current: ClientProposal, context: Context, changes: Readonly<Partial<ClientProposal>>, eventType: string, action: string, reason: string): ClientProposal { const status = changes.status ?? current.status; const occurredAt = this.#clock().toISOString(); const statusHistory = status === current.status ? current.statusHistory : [...current.statusHistory, { status, actorId: context.actor.principalId, reason, occurredAt }]; const updated = immutable<ClientProposal>({ ...current, ...changes, version: current.version + 1, statusHistory }); this.#store(updated); this.#record(eventType, action, updated, context, reason, { status: updated.status, permissionId: updated.permissionId }); return updated; }
  #store(item: ClientProposal): void { this.#proposals.set(item.id, item); this.#history.set(item.id, [...(this.#history.get(item.id) ?? []), item]); }
  #replay(context: Context & { readonly idempotencyKey: string }, fingerprint: string): ClientProposal | undefined { if (context.idempotencyKey.trim().length === 0) throw new Error("IDEMPOTENCY_KEY_REQUIRED"); const prior = this.#idempotency.get(`${context.actor.principalId}:${context.idempotencyKey}`); if (prior === undefined) return undefined; if (prior.fingerprint !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT"); return (this.#history.get(prior.proposalId) ?? []).find((item) => item.version === prior.version); }
  #remember(context: Context & { readonly idempotencyKey: string }, fingerprint: string, proposal: ClientProposal): void { this.#idempotency.set(`${context.actor.principalId}:${context.idempotencyKey}`, Object.freeze({ fingerprint, proposalId: proposal.id, version: proposal.version })); }
  #record(eventType: string, action: string, proposal: ClientProposal, context: Context, reason: string, details: Readonly<Record<string, unknown>>): void { this.#audit.append({ eventType, principal: principal(context.actor), action, target: { type: "ClientProposal", id: proposal.id, version: proposal.version }, purpose: context.purpose, policyVersion: this.#policyVersion, classification: proposal.classification, decision: "ALLOW", outcome: "COMPLETED", reason, ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId, details: { ...details, teamId: proposal.teamId, rawContactIncluded: false, publicationApprovalCreated: false } }); }
}
