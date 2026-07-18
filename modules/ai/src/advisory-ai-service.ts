import type { AuditPrincipal, AuditSink, Clock, DataClassification, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type AiCapabilityId = "AI-001" | "AI-002" | "AI-003" | "AI-004" | "AI-005" | "AI-006" | "AI-007";
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type ReviewRoute = "HUMAN_REVIEW_REQUIRED" | "MANUAL_CORRECTION_REQUIRED" | "MANUAL_FALLBACK";

export interface EntityReference {
  readonly entityType: string;
  readonly entityId: string;
  readonly version: number;
}

export interface AdvisoryResultEnvelope {
  readonly schemaVersion: "1.0";
  readonly capabilityId: AiCapabilityId;
  readonly subjectRef: EntityReference;
  readonly provenance: readonly EntityReference[];
  readonly classification: DataClassification;
  readonly confidence: Readonly<{ readonly band: ConfidenceBand; readonly reasonCodes: readonly string[]; readonly policyVersion: string }>;
  readonly output: Readonly<Record<string, unknown>>;
}

export interface AdvisoryValidationDecision {
  readonly status: "VALID" | "REJECTED";
  readonly route: ReviewRoute;
  readonly reasonCode?: string;
}

interface ValidateRequest {
  readonly expectedCapabilityId: AiCapabilityId;
  readonly expectedSubject: EntityReference;
  readonly inputClassifications: readonly DataClassification[];
  readonly result: unknown;
}

const topLevelKeys = new Set(["schemaVersion", "capabilityId", "subjectRef", "provenance", "classification", "confidence", "output"]);
const authorityKeys = new Set(["approve", "approved", "activate", "canonicalMutation", "createCanonicalProperty", "grantPermission", "merge", "publicationCommand", "publish", "verificationApproved", "writeAuthoritative"]);
const outputKeys: Readonly<Record<AiCapabilityId, ReadonlySet<string>>> = {
  "AI-001": new Set(["fields", "warnings"]),
  "AI-002": new Set(["outcome", "candidates", "ambiguities"]),
  "AI-003": new Set(["comparedRefs", "relationship", "recommendation", "signals", "contradictions"]),
  "AI-004": new Set(["intent", "constraints", "clarifications"]),
  "AI-005": new Set(["requirementRef", "candidateRef", "hardConstraintOutcome", "factors", "explanation"]),
  "AI-006": new Set(["intent", "filters", "resultClass", "unresolved", "warnings"]),
  "AI-007": new Set(["validationOutcome", "reviewRoute", "fieldConfidences"]),
};
const classificationRank: Readonly<Record<DataClassification, number>> = { PUBLIC_APPROVED: 0, INTERNAL: 1, CONFIDENTIAL_BUSINESS: 2, RESTRICTED_PERSONAL: 3, RESTRICTED_SECURITY: 4 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sameRef(left: unknown, right: EntityReference): boolean {
  return isRecord(left) && left["entityType"] === right.entityType && left["entityId"] === right.entityId && left["version"] === right.version;
}

function containsAuthority(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAuthority);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => authorityKeys.has(key) || containsAuthority(nested));
}

function reject(reasonCode: string, route: ReviewRoute = "MANUAL_FALLBACK"): AdvisoryValidationDecision {
  return Object.freeze({ status: "REJECTED", route, reasonCode });
}

function validOutput(capabilityId: AiCapabilityId, output: Record<string, unknown>): boolean {
  if (Object.keys(output).some((key) => !outputKeys[capabilityId].has(key))) return false;
  switch (capabilityId) {
    case "AI-001": return Array.isArray(output["fields"]) && Array.isArray(output["warnings"]);
    case "AI-002": return ["MATCHED", "AMBIGUOUS", "NO_MATCH", "UNRESOLVED"].includes(String(output["outcome"])) && Array.isArray(output["candidates"]) && Array.isArray(output["ambiguities"]);
    case "AI-003": return Array.isArray(output["comparedRefs"]) && typeof output["relationship"] === "string" && typeof output["recommendation"] === "string" && Array.isArray(output["signals"]) && Array.isArray(output["contradictions"]);
    case "AI-004": return typeof output["intent"] === "string" && Array.isArray(output["constraints"]) && Array.isArray(output["clarifications"]);
    case "AI-005": return isRecord(output["requirementRef"]) && isRecord(output["candidateRef"]) && ["PASS", "FAIL", "UNKNOWN"].includes(String(output["hardConstraintOutcome"])) && Array.isArray(output["factors"]) && typeof output["explanation"] === "string";
    case "AI-006": return ["PROPERTY_SEARCH", "CANDIDATE_SEARCH", "REQUIREMENT_SEARCH", "MATCH_SEARCH"].includes(String(output["intent"])) && Array.isArray(output["filters"]) && ["PROPERTY", "CANDIDATE", "REQUIREMENT", "MATCH"].includes(String(output["resultClass"])) && Array.isArray(output["unresolved"]) && Array.isArray(output["warnings"]);
    case "AI-007": return typeof output["validationOutcome"] === "string" && typeof output["reviewRoute"] === "string" && Array.isArray(output["fieldConfidences"]);
  }
}

export function validateAdvisoryResult(request: ValidateRequest): AdvisoryValidationDecision {
  if (containsAuthority(request.result)) return reject("PROHIBITED_AUTHORITY_FIELD");
  if (!isRecord(request.result) || Object.keys(request.result).some((key) => !topLevelKeys.has(key))) return reject("AI_RESULT_SCHEMA_INVALID");
  if (request.result["schemaVersion"] !== "1.0" || request.result["capabilityId"] !== request.expectedCapabilityId || !sameRef(request.result["subjectRef"], request.expectedSubject)) return reject("EVIDENCE_MISMATCH");
  if (!Array.isArray(request.result["provenance"]) || request.result["provenance"].length === 0 || !request.result["provenance"].every((item) => isRecord(item) && typeof item["entityType"] === "string" && typeof item["entityId"] === "string" && Number.isInteger(item["version"]))) return reject("PROVENANCE_REQUIRED");
  if (!request.result["provenance"].some((item) => sameRef(item, request.expectedSubject))) return reject("EVIDENCE_MISMATCH");
  const classification = request.result["classification"];
  if (typeof classification !== "string" || !(classification in classificationRank)) return reject("AI_RESULT_SCHEMA_INVALID");
  if (request.inputClassifications.length === 0) return reject("CLASSIFICATION_REQUIRED");
  const requiredRank = Math.max(...request.inputClassifications.map((item) => classificationRank[item]));
  if (classificationRank[classification as DataClassification] < requiredRank) return reject("CLASSIFICATION_DOWNGRADE_DENIED");
  const confidence = request.result["confidence"];
  if (!isRecord(confidence) || !["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(String(confidence["band"])) || !Array.isArray(confidence["reasonCodes"]) || typeof confidence["policyVersion"] !== "string") return reject("AI_RESULT_SCHEMA_INVALID");
  const output = request.result["output"];
  if (!isRecord(output) || !validOutput(request.expectedCapabilityId, output)) return reject("AI_RESULT_SCHEMA_INVALID");
  const band = confidence["band"] as ConfidenceBand;
  const route: ReviewRoute = band === "UNKNOWN" ? "MANUAL_FALLBACK" : band === "LOW" ? "MANUAL_CORRECTION_REQUIRED" : "HUMAN_REVIEW_REQUIRED";
  return Object.freeze({ status: band === "UNKNOWN" ? "REJECTED" : "VALID", route, ...(band === "UNKNOWN" ? { reasonCode: "CONFIDENCE_UNRESOLVED" } : {}) });
}

export type AiReviewStatus = "REVIEW_QUEUED" | "IN_REVIEW" | "ACCEPTED_AS_DRAFT" | "CORRECTED" | "REJECTED" | "NEEDS_EVIDENCE" | "ESCALATED" | "REVALIDATED";
interface ReviewEntry { readonly actorId: string; readonly decision: Exclude<AiReviewStatus, "REVIEW_QUEUED">; readonly reason: string; readonly occurredAt: string }
export interface StoredAiResult extends AdvisoryResultEnvelope { readonly id: string; readonly version: number; readonly resultStatus: "VALIDATED" | "REJECTED"; readonly reviewStatus: AiReviewStatus; readonly authority: "ADVISORY"; readonly reviewHistory: readonly ReviewEntry[] }

interface Dependencies { readonly authorizationService: AuthorizationService; readonly auditSink: AuditSink; readonly clock: Clock; readonly idFactory: IdFactory; readonly policyVersion: string }

function principal(session: SessionContext): AuditPrincipal { return { id: session.principalId, type: session.principalType, roles: session.roles, ...(session.teamId === undefined ? {} : { teamId: session.teamId }), sessionId: session.id }; }
function deepFreeze(value: unknown): void { if (value !== null && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); } }
function immutable<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }

export class AdvisoryAiService {
  readonly #authorization: AuthorizationService; readonly #audit: AuditSink; readonly #clock: Clock; readonly #idFactory: IdFactory; readonly #policyVersion: string; readonly #results = new Map<string, StoredAiResult>();
  public constructor(dependencies: Dependencies) { this.#authorization = dependencies.authorizationService; this.#audit = dependencies.auditSink; this.#clock = dependencies.clock; this.#idFactory = dependencies.idFactory; this.#policyVersion = dependencies.policyVersion; }
  public recordValidated(request: { readonly validation: AdvisoryValidationDecision; readonly envelope: AdvisoryResultEnvelope; readonly correlationId: string }): StoredAiResult {
    if (request.validation.status !== "VALID") throw new Error(request.validation.reasonCode ?? "AI_RESULT_REJECTED");
    const stored = immutable({ ...request.envelope, id: this.#idFactory(), version: 1, resultStatus: "VALIDATED" as const, reviewStatus: "REVIEW_QUEUED" as const, authority: "ADVISORY" as const, reviewHistory: [] });
    this.#results.set(stored.id, stored); return stored;
  }
  public review(request: { readonly actor: SessionContext; readonly resultId: string; readonly expectedVersion: number; readonly decision: Exclude<AiReviewStatus, "REVIEW_QUEUED">; readonly reason: string; readonly purpose: string; readonly correlationId: string }): StoredAiResult {
    const current = this.#results.get(request.resultId); if (current === undefined) throw new Error("AI_RESULT_NOT_FOUND"); if (current.version !== request.expectedVersion) throw new Error("VERSION_CONFLICT"); if (request.reason.trim().length === 0) throw new Error("REASON_REQUIRED");
    const authorization = this.#authorization.evaluate({ session: request.actor, action: "ai.review", resource: { type: "AiResult", id: current.id, version: current.version, ...(request.actor.teamId === undefined ? {} : { teamId: request.actor.teamId }) }, purpose: request.purpose, reason: request.reason, correlationId: request.correlationId });
    if (authorization.effect === "DENY") throw new Error(authorization.reasonCode);
    const entry = immutable({ actorId: request.actor.principalId, decision: request.decision, reason: request.reason, occurredAt: this.#clock().toISOString() });
    const updated = immutable({ ...current, version: current.version + 1, reviewStatus: request.decision, reviewHistory: [...current.reviewHistory, entry] }); this.#results.set(updated.id, updated);
    this.#audit.append({ eventType: "AI_RESULT_REVIEWED", principal: principal(request.actor), action: "ai.review", target: { type: "AiResult", id: updated.id, version: updated.version }, purpose: request.purpose, policyVersion: this.#policyVersion, classification: updated.classification, decision: "ALLOW", outcome: "COMPLETED", reason: request.reason, correlationId: request.correlationId, details: { capabilityId: updated.capabilityId, reviewStatus: updated.reviewStatus, authority: updated.authority, subjectId: updated.subjectRef.entityId, subjectVersion: updated.subjectRef.version } });
    return updated;
  }
}
