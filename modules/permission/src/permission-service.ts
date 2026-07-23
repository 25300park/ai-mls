import type { AuditPrincipal, AuditSink, Clock, DataClassification, IdFactory } from "../../../packages/security-contracts/src/index.js";
import { validateAdvisoryResult, type AdvisoryValidationDecision } from "../../ai/src/advisory-ai-service.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { Verification, VerificationField, VersionedEntityReference } from "../../verification/src/verification-service.js";

export type PermissionStatus = "DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "REJECTED" | "EXPIRED" | "REVOKED" | "SUPERSEDED";
export type PermissionType = "INTERNAL_ACCESS" | "CLIENT_SHARING" | "CONTACT_DISCLOSURE" | "PUBLIC_PUBLICATION";
export type PermissionPurpose =
  | "PURPOSE_INTERNAL_REVIEW" | "PURPOSE_CLIENT_MATCHING" | "PURPOSE_CLIENT_PRESENTATION"
  | "PURPOSE_BROKER_COORDINATION" | "PURPOSE_TRANSACTION" | "PURPOSE_CONTRACT_PREPARATION"
  | "PURPOSE_CONTACT_DISCLOSURE" | "PURPOSE_PUBLICATION_APPROVAL";
export type PermissionAudienceCode =
  | "AUD_INTERNAL_TEAM" | "AUD_ASSIGNED_STAFF" | "AUD_MANAGER" | "AUD_NAMED_CLIENT"
  | "AUD_NAMED_OWNER" | "AUD_NAMED_BROKER" | "AUD_PARTNER" | "AUD_PUBLIC";
export interface PermissionAudience { readonly code: PermissionAudienceCode; readonly recipientRef?: VersionedEntityReference }
export interface PermissionReviewEntry { readonly actorId: string; readonly action: "REQUEST_EVIDENCE" | "RECOMMEND" | "ESCALATE"; readonly recommendation: string; readonly occurredAt: string }
export interface PermissionApprovalEntry { readonly actorId: string; readonly decision: "GRANTED" | "DENIED" | "REVOKED"; readonly reason: string; readonly occurredAt: string; readonly managerOverride: boolean }
export interface PermissionStatusEntry { readonly status: PermissionStatus; readonly actorId: string; readonly occurredAt: string; readonly reason: string }
export interface Permission {
  readonly id: string;
  readonly version: number;
  readonly teamId: string;
  readonly subjectRef: VersionedEntityReference;
  readonly verificationId: string;
  readonly verificationVersion: number;
  readonly fieldScope: readonly VerificationField[];
  readonly permissionType: PermissionType;
  readonly permissionPurpose: PermissionPurpose;
  readonly audience: PermissionAudience;
  readonly status: PermissionStatus;
  readonly createdBy: string;
  readonly requestedAt: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly validityBasis: "DEFAULT_30_DAYS" | "DEFAULT_14_DAYS" | "DEFAULT_7_DAYS" | "UNTIL_PUBLICATION_APPROVAL_DECISION" | "REQUESTED_PERIOD" | "VERIFICATION_CAP";
  readonly priorPermissionId?: string;
  readonly successorPermissionId?: string;
  readonly reviewHistory: readonly PermissionReviewEntry[];
  readonly approvalHistory: readonly PermissionApprovalEntry[];
  readonly statusHistory: readonly PermissionStatusEntry[];
  readonly classification: DataClassification;
  readonly policyVersion: string;
}
export interface EffectivePermissionDecision { readonly effective: boolean; readonly reasonCode: "PERMISSION_EFFECTIVE" | "PERMISSION_NOT_ACTIVE" | "PERMISSION_EXPIRED" | "PERMISSION_SUBJECT_STALE" | "PERMISSION_SCOPE_DENIED" | "PERMISSION_PURPOSE_DENIED" | "PERMISSION_AUDIENCE_DENIED" | "VERIFICATION_NOT_EFFECTIVE" }

interface Dependencies { readonly authorizationService: AuthorizationService; readonly auditSink: AuditSink; readonly clock: Clock; readonly idFactory: IdFactory; readonly policyVersion: string; readonly verificationResolver: (verificationId: string) => Verification | undefined }
interface Context { readonly actor: SessionContext; readonly purpose: PermissionPurpose; readonly correlationId: string; readonly requestId?: string }
interface IdempotencyRecord { readonly fingerprint: string; readonly permissionId: string; readonly version: number }

const defaultValidityDays: Readonly<Partial<Record<PermissionType, number>>> = Object.freeze({ INTERNAL_ACCESS: 30, CLIENT_SHARING: 14, CONTACT_DISCLOSURE: 7 });
const namedAudience = new Set<PermissionAudienceCode>(["AUD_NAMED_CLIENT", "AUD_NAMED_OWNER", "AUD_NAMED_BROKER", "AUD_PARTNER"]);
const terminalStatuses = new Set<PermissionStatus>(["REJECTED", "EXPIRED", "REVOKED", "SUPERSEDED"]);
const sensitiveValuePattern = /(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d\s().-]{6,}\d)/iu;

function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function immutable<T>(value: T): T { const snapshot = structuredClone(value); deepFreeze(snapshot); return snapshot; }
function addDays(value: Date, days: number): Date { return new Date(value.getTime() + days * 86_400_000); }
function sameReference(left: VersionedEntityReference, right: VersionedEntityReference): boolean { return left.entityType === right.entityType && left.entityId === right.entityId && left.version === right.version; }
function sameAudience(left: PermissionAudience, right: PermissionAudience): boolean { return JSON.stringify(left) === JSON.stringify(right); }
function principal(actor: SessionContext): AuditPrincipal { return { id: actor.principalId, type: actor.principalType, roles: actor.roles, ...(actor.teamId === undefined ? {} : { teamId: actor.teamId }), sessionId: actor.id }; }

export class PermissionService {
  readonly #authorization: AuthorizationService; readonly #audit: AuditSink; readonly #clock: Clock; readonly #idFactory: IdFactory; readonly #policyVersion: string; readonly #verificationResolver: Dependencies["verificationResolver"];
  readonly #permissions = new Map<string, Permission>(); readonly #history = new Map<string, Permission[]>(); readonly #idempotency = new Map<string, IdempotencyRecord>();

  public constructor(dependencies: Dependencies) { this.#authorization = dependencies.authorizationService; this.#audit = dependencies.auditSink; this.#clock = dependencies.clock; this.#idFactory = dependencies.idFactory; this.#policyVersion = dependencies.policyVersion; this.#verificationResolver = dependencies.verificationResolver; }

  public requestPermission(request: Context & { readonly subjectRef: VersionedEntityReference; readonly verificationId: string; readonly fieldScope: readonly VerificationField[]; readonly permissionType: PermissionType; readonly permissionPurpose: PermissionPurpose; readonly audience: PermissionAudience; readonly requestedValidUntil?: string; readonly priorPermissionId?: string; readonly reason: string; readonly idempotencyKey: string }): Permission {
    this.#reason(request.reason); if (request.permissionPurpose !== request.purpose) throw new Error("PERMISSION_PURPOSE_INVALID"); this.#validateAudience(request.permissionType, request.permissionPurpose, request.audience); const teamId = this.#team(request.actor);
    const fingerprint = JSON.stringify({ subjectRef: request.subjectRef, verificationId: request.verificationId, fieldScope: [...request.fieldScope].sort(), permissionType: request.permissionType, permissionPurpose: request.permissionPurpose, audience: request.audience, requestedValidUntil: request.requestedValidUntil, priorPermissionId: request.priorPermissionId });
    this.#authorize(request, "permission.request", "new", teamId, undefined, request.reason);
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    const verification = this.#validVerification(request.verificationId, request.subjectRef, request.fieldScope, teamId);
    if (request.priorPermissionId !== undefined) { const prior = this.#scopedCurrent(request, request.priorPermissionId); if (prior.status !== "ACTIVE") throw new Error("PERMISSION_SUCCESSOR_INVALID"); }
    const occurredAt = this.#clock(); const validity = this.#validity(request.permissionType, verification, request.fieldScope, occurredAt, request.requestedValidUntil);
    const permission = immutable<Permission>({ id: this.#idFactory(), version: 1, teamId, subjectRef: request.subjectRef, verificationId: verification.id, verificationVersion: verification.version, fieldScope: [...new Set(request.fieldScope)], permissionType: request.permissionType, permissionPurpose: request.permissionPurpose, audience: request.audience, status: "DRAFT", createdBy: request.actor.principalId, requestedAt: occurredAt.toISOString(), validFrom: occurredAt.toISOString(), validUntil: validity.validUntil, validityBasis: validity.basis, ...(request.priorPermissionId === undefined ? {} : { priorPermissionId: request.priorPermissionId }), reviewHistory: [], approvalHistory: [], statusHistory: [{ status: "DRAFT", actorId: request.actor.principalId, occurredAt: occurredAt.toISOString(), reason: request.reason }], classification: verification.classification, policyVersion: this.#policyVersion });
    this.#store(permission); this.#remember(request, fingerprint, permission); this.#record("PERMISSION_REQUESTED", "permission.request", permission, request, { permissionType: permission.permissionType, permissionPurpose: permission.permissionPurpose, audienceCode: permission.audience.code, fieldScope: permission.fieldScope, verificationId: permission.verificationId }); return permission;
  }

  public beginReview(request: Context & { readonly permissionId: string; readonly expectedVersion: number; readonly reason: string; readonly idempotencyKey: string }): Permission {
    this.#reason(request.reason); const fingerprint = JSON.stringify({ action: "BEGIN_REVIEW", permissionId: request.permissionId, expectedVersion: request.expectedVersion, reason: request.reason });
    const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); if (!request.actor.roles.includes("PMR")) throw new Error("CAPABILITY_DENIED"); this.#authorize(request, "permission.review", current.id, current.teamId, current.version, request.reason);
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "DRAFT") throw new Error("STATE_TRANSITION_INVALID");
    const updated = this.#replace(current, request, { status: "UNDER_REVIEW" }, "PERMISSION_REVIEW_STARTED", "permission.review", request.reason); this.#remember(request, fingerprint, updated); return updated;
  }

  public recordReviewSupport(request: Context & { readonly permissionId: string; readonly expectedVersion: number; readonly action: PermissionReviewEntry["action"]; readonly recommendation: string; readonly idempotencyKey: string }): Permission {
    this.#reason(request.recommendation); const fingerprint = JSON.stringify({ action: request.action, permissionId: request.permissionId, expectedVersion: request.expectedVersion, recommendation: request.recommendation });
    const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); if (!request.actor.roles.includes("REV")) throw new Error("CAPABILITY_DENIED"); this.#authorize(request, "permission.support", current.id, current.teamId, current.version, request.recommendation);
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "UNDER_REVIEW") throw new Error("STATE_TRANSITION_INVALID");
    const entry = immutable<PermissionReviewEntry>({ actorId: request.actor.principalId, action: request.action, recommendation: request.recommendation, occurredAt: this.#clock().toISOString() }); const updated = this.#replace(current, request, { reviewHistory: [...current.reviewHistory, entry] }, "PERMISSION_REVIEW_SUPPORTED", "permission.support", request.recommendation); this.#remember(request, fingerprint, updated); return updated;
  }

  public decide(request: Context & { readonly permissionId: string; readonly expectedVersion: number; readonly decision: "GRANT" | "DENY"; readonly reason: string; readonly idempotencyKey: string; readonly managerOverride?: boolean }): Permission {
    this.#reason(request.reason); const fingerprint = JSON.stringify({ action: "DECIDE", permissionId: request.permissionId, expectedVersion: request.expectedVersion, decision: request.decision, reason: request.reason, managerOverride: request.managerOverride === true });
    const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); if (!request.actor.roles.includes("PMR")) throw new Error("PERMISSION_DECISION_DENIED"); if (current.createdBy === request.actor.principalId) throw new Error("SEPARATION_OF_DUTIES_DENIED");
    const override = request.managerOverride === true; const action = override ? "permission.override" : "permission.decide"; this.#authorize(request, action, current.id, current.teamId, current.version, request.reason, current.createdBy);
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "UNDER_REVIEW") throw new Error("STATE_TRANSITION_INVALID");
    const verification = this.#validVerification(current.verificationId, current.subjectRef, current.fieldScope, current.teamId, current.verificationVersion); const verifierActorId = [...verification.approvalHistory].reverse().find((entry) => entry.decision === "VERIFIED")?.actorId;
    if (verifierActorId === request.actor.principalId && !override) throw new Error("SEPARATION_OF_DUTIES_DENIED");
    if (override && (verifierActorId !== request.actor.principalId || !request.actor.roles.includes("MGR") || !request.actor.isMfaVerified)) throw new Error("MANAGER_OVERRIDE_DENIED");
    const status: PermissionStatus = request.decision === "GRANT" ? "ACTIVE" : "REJECTED";
    const prior = status === "ACTIVE" && current.priorPermissionId !== undefined ? this.#scopedCurrent(request, current.priorPermissionId) : undefined;
    if (prior !== undefined && prior.status !== "ACTIVE") throw new Error("PERMISSION_SUCCESSOR_INVALID");
    const approval = immutable<PermissionApprovalEntry>({ actorId: request.actor.principalId, decision: request.decision === "GRANT" ? "GRANTED" : "DENIED", reason: request.reason, occurredAt: this.#clock().toISOString(), managerOverride: override });
    const updated = this.#replace(current, request, { status, approvalHistory: [...current.approvalHistory, approval] }, "PERMISSION_DECIDED", action, request.reason, { decision: request.decision, managerOverride: override });
    if (prior !== undefined) this.#supersedePrior(prior, updated, request);
    this.#remember(request, fingerprint, updated); return updated;
  }

  public revoke(request: Context & { readonly permissionId: string; readonly expectedVersion: number; readonly reason: string; readonly idempotencyKey: string }): Permission {
    this.#reason(request.reason); const fingerprint = JSON.stringify({ action: "REVOKE", permissionId: request.permissionId, expectedVersion: request.expectedVersion, reason: request.reason });
    const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); if (!request.actor.roles.includes("PMR")) throw new Error("PERMISSION_DECISION_DENIED"); this.#authorize(request, "permission.revoke", current.id, current.teamId, current.version, request.reason);
    const replay = this.#replay(request, fingerprint); if (replay !== undefined) return replay;
    this.#version(current, request.expectedVersion); if (current.status !== "ACTIVE") throw new Error("STATE_TRANSITION_INVALID");
    const approval = immutable<PermissionApprovalEntry>({ actorId: request.actor.principalId, decision: "REVOKED", reason: request.reason, occurredAt: this.#clock().toISOString(), managerOverride: false }); const updated = this.#replace(current, request, { status: "REVOKED", approvalHistory: [...current.approvalHistory, approval] }, "PERMISSION_REVOKED", "permission.revoke", request.reason); this.#remember(request, fingerprint, updated); return updated;
  }

  public evaluateExpiry(request: Context & { readonly permissionId: string; readonly expectedVersion: number }): Permission {
    const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); this.#version(current, request.expectedVersion); if (request.actor.principalType !== "SERVICE" || !request.actor.roles.includes("SVC")) throw new Error("SERVICE_AUTHORITY_REQUIRED"); if (current.status !== "ACTIVE") throw new Error("STATE_TRANSITION_INVALID"); this.#authorize(request, "permission.expire", current.id, current.teamId, current.version);
    if (this.#clock().getTime() < new Date(current.validUntil).getTime()) return current; return this.#replace(current, request, { status: "EXPIRED" }, "PERMISSION_EXPIRED", "permission.expire", "Validity ended");
  }

  public checkEffective(request: Context & { readonly permissionId: string; readonly subjectRef: VersionedEntityReference; readonly fieldScope: readonly VerificationField[]; readonly permissionPurpose: PermissionPurpose; readonly audience: PermissionAudience }): EffectivePermissionDecision {
    const current = this.#scopedCurrent(request, request.permissionId); this.#authorize(request, "permission.read", current.id, current.teamId, current.version);
    if (current.status !== "ACTIVE") return immutable({ effective: false, reasonCode: "PERMISSION_NOT_ACTIVE" });
    if (this.#clock().getTime() >= new Date(current.validUntil).getTime()) return immutable({ effective: false, reasonCode: "PERMISSION_EXPIRED" });
    if (!sameReference(current.subjectRef, request.subjectRef)) return immutable({ effective: false, reasonCode: "PERMISSION_SUBJECT_STALE" });
    if (request.fieldScope.some((field) => !current.fieldScope.includes(field))) return immutable({ effective: false, reasonCode: "PERMISSION_SCOPE_DENIED" });
    if (current.permissionPurpose !== request.permissionPurpose || current.permissionPurpose !== request.purpose) return immutable({ effective: false, reasonCode: "PERMISSION_PURPOSE_DENIED" });
    if (!sameAudience(current.audience, request.audience)) return immutable({ effective: false, reasonCode: "PERMISSION_AUDIENCE_DENIED" });
    try { this.#validVerification(current.verificationId, current.subjectRef, request.fieldScope, current.teamId, current.verificationVersion); } catch { return immutable({ effective: false, reasonCode: "VERIFICATION_NOT_EFFECTIVE" }); }
    return immutable({ effective: true, reasonCode: "PERMISSION_EFFECTIVE" });
  }

  public readPermission(request: Context & { readonly permissionId: string }): Permission { const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); this.#authorize(request, "permission.read", current.id, current.teamId, current.version); return current; }
  public readHistory(request: Context & { readonly permissionId: string }): readonly Permission[] { const current = this.#scopedCurrent(request, request.permissionId); this.#purpose(current, request); this.#authorize(request, "permission.read", current.id, current.teamId, current.version); return Object.freeze([...(this.#history.get(current.id) ?? [])]); }
  public listQueue(request: Context): readonly Permission[] { const teamId = this.#team(request.actor); this.#authorize(request, "permission.read", "collection", teamId); return Object.freeze([...this.#permissions.values()].filter((item) => item.teamId === teamId && item.permissionPurpose === request.purpose && (item.status === "DRAFT" || item.status === "UNDER_REVIEW"))); }
  public listExpiry(request: Context): readonly Permission[] { const teamId = this.#team(request.actor); this.#authorize(request, "permission.read", "expiry-collection", teamId); return Object.freeze([...this.#permissions.values()].filter((item) => item.teamId === teamId && item.permissionPurpose === request.purpose && (item.status === "ACTIVE" || item.status === "EXPIRED" || item.status === "REVOKED"))); }
  public validateEvidence(request: Context & { readonly permissionId: string; readonly expectedVersion: number; readonly result: unknown }): AdvisoryValidationDecision { const current = this.readPermission(request); this.#version(current, request.expectedVersion); const decision = validateAdvisoryResult({ expectedCapabilityId: "AI-007", expectedSubject: { entityType: "Permission", entityId: current.id, version: current.version }, inputClassifications: [current.classification], result: request.result }); this.#record("PERMISSION_AI_EVIDENCE_VALIDATED", "permission.read", current, request, { capabilityId: "AI-007", validationStatus: decision.status, route: decision.route, authority: "ADVISORY" }); return decision; }

  #validVerification(verificationId: string, subjectRef: VersionedEntityReference, fields: readonly VerificationField[], teamId: string, expectedVersion?: number): Verification {
    const verification = this.#verificationResolver(verificationId); if (verification?.teamId !== teamId || verification.status !== "VERIFIED" || (expectedVersion !== undefined && verification.version !== expectedVersion) || !sameReference(verification.subjectRef, subjectRef) || fields.length === 0) throw new Error("VERIFICATION_NOT_EFFECTIVE");
    const now = this.#clock().getTime(); if (fields.some((field) => !verification.fields.includes(field) || !verification.fieldResults.some((result) => result.field === field && result.result === "VERIFIED" && now >= new Date(result.validFrom).getTime() && now < new Date(result.validUntil).getTime()))) throw new Error("VERIFICATION_SCOPE_INVALID"); return verification;
  }
  #validity(type: PermissionType, verification: Verification, fields: readonly VerificationField[], from: Date, requestedValidUntil?: string): Readonly<{ validUntil: string; basis: Permission["validityBasis"] }> {
    const verificationCap = Math.min(...fields.map((field) => new Date(verification.fieldResults.find((item) => item.field === field)?.validUntil ?? "invalid").getTime())); if (!Number.isFinite(verificationCap)) throw new Error("VERIFICATION_SCOPE_INVALID");
    const days = defaultValidityDays[type]; const defaultCap = days === undefined ? verificationCap : addDays(from, days).getTime(); const requestedCap = requestedValidUntil === undefined ? Number.POSITIVE_INFINITY : new Date(requestedValidUntil).getTime(); if (requestedValidUntil !== undefined && (!Number.isFinite(requestedCap) || requestedCap <= from.getTime())) throw new Error("PERMISSION_VALIDITY_INVALID");
    const cap = Math.min(verificationCap, defaultCap, requestedCap); let basis: Permission["validityBasis"] = type === "PUBLIC_PUBLICATION" ? "UNTIL_PUBLICATION_APPROVAL_DECISION" : type === "INTERNAL_ACCESS" ? "DEFAULT_30_DAYS" : type === "CLIENT_SHARING" ? "DEFAULT_14_DAYS" : "DEFAULT_7_DAYS"; if (requestedCap === cap) basis = "REQUESTED_PERIOD"; else if (verificationCap === cap && verificationCap < defaultCap) basis = "VERIFICATION_CAP"; return immutable({ validUntil: new Date(cap).toISOString(), basis });
  }
  #validateAudience(type: PermissionType, purpose: PermissionPurpose, audience: PermissionAudience): void {
    if (namedAudience.has(audience.code) && audience.recipientRef === undefined) throw new Error("PERMISSION_AUDIENCE_INVALID");
    if (type === "CONTACT_DISCLOSURE" && (purpose !== "PURPOSE_CONTACT_DISCLOSURE" || audience.recipientRef === undefined || audience.code === "AUD_PUBLIC")) throw new Error("CONTACT_DISCLOSURE_SCOPE_INVALID");
    if (type === "PUBLIC_PUBLICATION" && (purpose !== "PURPOSE_PUBLICATION_APPROVAL" || audience.code !== "AUD_PUBLIC" || audience.recipientRef !== undefined)) throw new Error("PERMISSION_AUDIENCE_INVALID");
    if (type !== "PUBLIC_PUBLICATION" && audience.code === "AUD_PUBLIC") throw new Error("PERMISSION_AUDIENCE_INVALID");
  }
  #supersedePrior(prior: Permission, successor: Permission, context: Context): void { this.#replace(prior, context, { status: "SUPERSEDED", successorPermissionId: successor.id }, "PERMISSION_SUPERSEDED", "permission.decide", "Active successor granted", { successorPermissionId: successor.id }); }
  #scopedCurrent(context: Context, permissionId: string): Permission { const current = this.#permissions.get(permissionId); if (current === undefined || context.actor.teamId === undefined || current.teamId !== context.actor.teamId) throw new Error("PERMISSION_NOT_FOUND"); return current; }
  #purpose(current: Permission, context: Context): void { if (current.permissionPurpose !== context.purpose) throw new Error("PERMISSION_PURPOSE_DENIED"); }
  #replace(current: Permission, context: Context, changes: Partial<Permission>, eventType: string, action: string, reason: string, details: Readonly<Record<string, unknown>> = {}): Permission { const nextStatus = changes.status ?? current.status; if (terminalStatuses.has(current.status)) throw new Error("STATE_TRANSITION_INVALID"); const updated = immutable<Permission>({ ...current, ...changes, version: current.version + 1, statusHistory: nextStatus === current.status ? current.statusHistory : [...current.statusHistory, { status: nextStatus, actorId: context.actor.principalId, occurredAt: this.#clock().toISOString(), reason }] }); this.#store(updated); this.#record(eventType, action, updated, context, details); return updated; }
  #store(permission: Permission): void { this.#permissions.set(permission.id, permission); const prior = this.#history.get(permission.id) ?? []; this.#history.set(permission.id, [...prior, permission]); }
  #team(actor: SessionContext): string { if (actor.teamId === undefined) throw new Error("TEAM_SCOPE_REQUIRED"); return actor.teamId; }
  #version(current: Permission, expectedVersion: number): void { if (current.version !== expectedVersion) throw new Error("VERSION_CONFLICT"); }
  #reason(reason: string): void { if (reason.trim().length === 0) throw new Error("REASON_REQUIRED"); if (sensitiveValuePattern.test(reason)) throw new Error("SENSITIVE_FIELD_RESTRICTED"); }
  #authorize(context: Context, action: string, id: string, teamId: string, version?: number, reason?: string, createdBy?: string): void { const decision = this.#authorization.evaluate({ session: context.actor, action, resource: { type: "Permission", id, teamId, ...(version === undefined ? {} : { version }), ...(createdBy === undefined ? {} : { createdBy }) }, purpose: context.purpose, ...(reason === undefined ? {} : { reason }), ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId }); if (decision.effect === "DENY") throw new Error(decision.reasonCode); }
  #replay(context: Context & { readonly idempotencyKey: string }, fingerprint: string): Permission | undefined { if (context.idempotencyKey.trim().length === 0) throw new Error("IDEMPOTENCY_KEY_REQUIRED"); const prior = this.#idempotency.get(`${context.actor.principalId}:${context.idempotencyKey}`); if (prior === undefined) return undefined; if (prior.fingerprint !== fingerprint) throw new Error("IDEMPOTENCY_CONFLICT"); return (this.#history.get(prior.permissionId) ?? []).find((item) => item.version === prior.version); }
  #remember(context: Context & { readonly idempotencyKey: string }, fingerprint: string, permission: Permission): void { this.#idempotency.set(`${context.actor.principalId}:${context.idempotencyKey}`, Object.freeze({ fingerprint, permissionId: permission.id, version: permission.version })); }
  #record(eventType: string, action: string, permission: Permission, context: Context, details: Readonly<Record<string, unknown>>): void { this.#audit.append({ eventType, principal: principal(context.actor), action, target: { type: "Permission", id: permission.id, version: permission.version }, purpose: context.purpose, policyVersion: this.#policyVersion, classification: permission.classification, decision: "ALLOW", outcome: "COMPLETED", ...(context.requestId === undefined ? {} : { requestId: context.requestId }), correlationId: context.correlationId, details: { ...details, teamId: permission.teamId, subjectType: permission.subjectRef.entityType, subjectVersion: permission.subjectRef.version, rawContactIncluded: false, evidenceHandling: "REFERENCE_ONLY" } }); }
}
