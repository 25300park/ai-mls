import type { AuditPrincipal, AuditSink, Clock, DataClassification, IdFactory } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type AiCapabilityId = "AI-001" | "AI-002" | "AI-003" | "AI-004" | "AI-005" | "AI-006" | "AI-007";
export type ConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type ReviewRoute = "HUMAN_REVIEW_REQUIRED" | "MANUAL_CORRECTION_REQUIRED" | "MANUAL_FALLBACK";
export type AiSchemaId = typeof schemaIds[AiCapabilityId];

export interface EntityReference {
  readonly entityType: string;
  readonly entityId: string;
  readonly version: string;
}

export interface AiConfidence { readonly band: ConfidenceBand; readonly numericValue?: number; readonly reasonCodes: readonly string[]; readonly policyVersion: string }
export interface AiEvidenceReference { readonly sourceRef: EntityReference; readonly evidenceLocator: string }
type Scalar = string | number | boolean | null;

export interface Ai001Output { readonly capabilityId: "AI-001"; readonly inputRef: EntityReference; readonly fields: readonly Readonly<{ fieldName: string; valueState: "PRESENT" | "MISSING" | "AMBIGUOUS" | "CONFLICTING" | "WITHHELD" | "NOT_APPLICABLE"; rawValue?: Scalar; normalizedValue?: Scalar; evidenceRefs: readonly AiEvidenceReference[]; confidence: AiConfidence }>[]; readonly warnings: readonly string[]; readonly overallConfidence: AiConfidence }
export interface Ai002Output { readonly capabilityId: "AI-002"; readonly inputRef: EntityReference; readonly outcome: "MATCH_CANDIDATE" | "UNRESOLVED" | "NEW_MASTER_CANDIDATE" | "CONFLICT" | "NOT_APPLICABLE"; readonly candidates: readonly Readonly<{ entityRef: EntityReference; entityType: "LOCATION" | "PROPERTY" | "BUILDING" | "TOWER" | "FLOOR" | "UNIT" | "ALIAS"; evidenceRefs: readonly AiEvidenceReference[]; contradictions: readonly string[]; confidence: AiConfidence }>[]; readonly ambiguities: readonly string[]; readonly overallConfidence: AiConfidence }
export interface Ai003Output { readonly capabilityId: "AI-003"; readonly comparedRefs: readonly EntityReference[]; readonly relationship: "SAME_SOURCE_COPY" | "SAME_CANDIDATE" | "SAME_UNIT_DIFFERENT_OFFER" | "SAME_OFFER_DIFFERENT_SOURCE" | "RELATED_PROPERTY" | "NOT_DUPLICATE" | "UNCERTAIN"; readonly recommendation: "LINK_ONLY" | "MERGE_CANDIDATE" | "KEEP_SEPARATE" | "SAME_UNIT_SEPARATE_OFFERS" | "NEEDS_MORE_EVIDENCE"; readonly signals: readonly Readonly<{ signalType: string; direction: "SUPPORTS" | "CONTRADICTS" | "NEUTRAL"; explanation: string }>[]; readonly contradictions: readonly string[]; readonly confidence: AiConfidence }
export interface Ai004Output { readonly capabilityId: "AI-004"; readonly inputRef: EntityReference; readonly intent: "RENT" | "BUY" | "OTHER" | "UNKNOWN"; readonly budget: Readonly<{ valueState: "PRESENT" | "MISSING" | "AMBIGUOUS" | "CONFLICTING"; currency?: string; minimum?: number; maximum?: number; frequency?: string; flexible?: boolean; confidence: AiConfidence }>; readonly locations: readonly Readonly<{ rawText: string; canonicalCandidateRef?: EntityReference; constraintType: "HARD" | "SOFT" | "EXCLUDE" | "INFORMATIONAL" | "UNKNOWN"; confidence: AiConfidence }>[]; readonly propertyTypes: readonly string[]; readonly preferences: readonly Readonly<{ criterion: string; value?: Scalar; constraintType: "HARD" | "SOFT" | "EXCLUDE" | "INFORMATIONAL" | "UNKNOWN"; confidence: AiConfidence }>[]; readonly clarificationNeeds: readonly string[]; readonly overallConfidence: AiConfidence }
export interface Ai005Output { readonly capabilityId: "AI-005"; readonly requirementRef: EntityReference; readonly candidateRef: EntityReference; readonly offerRef?: EntityReference; readonly cohortRef: string; readonly factors: readonly Readonly<{ factor: string; kind: "HARD" | "SOFT" | "QUALITY" | "INFORMATIONAL"; outcome: "PASS" | "FAIL" | "PARTIAL" | "UNKNOWN" | "NOT_APPLICABLE"; score?: number; weight?: number; explanation: string }>[]; readonly hardConstraintOutcome: "PASS" | "FAIL" | "UNKNOWN"; readonly score: number; readonly rank: number; readonly explanation: string; readonly confidence: AiConfidence }
export interface Ai006Output { readonly capabilityId: "AI-006"; readonly intent: "PROPERTY_DISCOVERY" | "REQUIREMENT_SEARCH" | "COMPARE" | "STATUS_INQUIRY" | "OPERATIONAL_LOOKUP" | "UNSUPPORTED_WRITE" | "UNKNOWN"; readonly filters: readonly Readonly<{ field: string; operator: "EQUALS" | "IN" | "RANGE" | "CONTAINS" | "NEAR" | "EXISTS"; value: Scalar | readonly Scalar[]; negated: boolean }>[]; readonly sort: readonly Readonly<{ field: string; direction: "ASC" | "DESC" }>[]; readonly requestedResultClass: "INTERNAL_CANDIDATE" | "CLIENT_ELIGIBLE" | "PUBLISHED" | "RESTRICTED_OPERATIONAL"; readonly unresolvedTerms: readonly string[]; readonly warnings: readonly string[]; readonly confidence: AiConfidence }
export interface Ai007Output { readonly capabilityId: AiCapabilityId; readonly subjectRef: EntityReference; readonly overallConfidence: AiConfidence; readonly fieldConfidences: Readonly<Record<string, AiConfidence>>; readonly validationOutcome: "VALID_DRAFT" | "HUMAN_REVIEW_REQUIRED" | "REJECTED" | "QUARANTINED"; readonly reviewRoute: "NORMAL_REVIEW" | "SPECIALIST_REVIEW" | "SECURITY_REVIEW" | "MANUAL_FALLBACK" | "NONE_REJECTED" }
export type CanonicalAiOutput = Ai001Output | Ai002Output | Ai003Output | Ai004Output | Ai005Output | Ai006Output | Ai007Output;

export interface AdvisoryResultEnvelope {
  readonly schemaVersion: "1.0";
  readonly schemaId: AiSchemaId;
  readonly capabilityId: AiCapabilityId;
  readonly subjectRef: EntityReference;
  readonly provenance: readonly EntityReference[];
  readonly inputChecksum?: string;
  readonly classification: DataClassification;
  readonly output: CanonicalAiOutput;
}

export interface AdvisoryValidationDecision {
  readonly status: "VALID" | "REJECTED";
  readonly route: ReviewRoute;
  readonly reasonCode?: string;
}

interface ValidateRequest {
  readonly expectedCapabilityId: AiCapabilityId;
  readonly expectedSubject: Readonly<Omit<EntityReference, "version"> & { readonly version: string | number }>;
  readonly inputClassifications: readonly DataClassification[];
  readonly result: unknown;
}

const schemaIds = Object.freeze({ "AI-001": "urn:ai-mls:schema:listing-parser-output:v0.1", "AI-002": "urn:ai-mls:schema:property-normalization-output:v0.1", "AI-003": "urn:ai-mls:schema:duplicate-detection-output:v0.1", "AI-004": "urn:ai-mls:schema:requirement-parser-output:v0.1", "AI-005": "urn:ai-mls:schema:matching-result:v0.1", "AI-006": "urn:ai-mls:schema:search-interpretation-output:v0.1", "AI-007": "urn:ai-mls:schema:confidence-result:v0.1" } as const);
export function canonicalAiSchemaId(capabilityId: AiCapabilityId): AiSchemaId { return schemaIds[capabilityId]; }
const topLevelKeys = new Set(["schemaVersion", "schemaId", "capabilityId", "subjectRef", "provenance", "inputChecksum", "classification", "output"]);
const outputFieldKeys = new Set(["inputRef", "fields", "warnings", "overallConfidence", "outcome", "candidates", "ambiguities", "comparedRefs", "relationship", "recommendation", "signals", "contradictions", "confidence", "intent", "budget", "locations", "propertyTypes", "preferences", "clarificationNeeds", "requirementRef", "candidateRef", "offerRef", "cohortRef", "factors", "hardConstraintOutcome", "score", "rank", "explanation", "filters", "sort", "requestedResultClass", "unresolvedTerms", "validationOutcome", "reviewRoute", "fieldConfidences"]);
const authorityKeys = new Set(["approval", "approve", "approved", "activate", "authority", "canonicalMutation", "createCanonicalProperty", "execute", "executionAuthority", "grantPermission", "merge", "publicationCommand", "publish", "recover", "retry", "verificationApproved", "verifiedBusinessTruth", "writeAuthoritative"]);
const classificationRank: Readonly<Record<DataClassification, number>> = { PUBLIC_APPROVED: 0, INTERNAL: 1, CONFIDENTIAL_BUSINESS: 2, RESTRICTED_PERSONAL: 3, RESTRICTED_SECURITY: 4 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}

function validCanonicalRef(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["entityType", "entityId", "version"])
    && typeof value["entityType"] === "string" && value["entityType"].length > 0
    && typeof value["entityId"] === "string" && value["entityId"].length > 0
    && typeof value["version"] === "string" && value["version"].length > 0;
}

function validConfidence(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["band", "reasonCodes", "policyVersion"], ["numericValue"])
    && ["HIGH", "MEDIUM", "LOW", "UNKNOWN"].includes(String(value["band"]))
    && Array.isArray(value["reasonCodes"]) && value["reasonCodes"].length > 0
    && value["reasonCodes"].every((reason) => typeof reason === "string" && reason.length > 0)
    && typeof value["policyVersion"] === "string" && value["policyVersion"].length > 0
    && (value["numericValue"] === undefined || (typeof value["numericValue"] === "number" && Number.isFinite(value["numericValue"])));
}

function validEvidenceRef(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["sourceRef", "evidenceLocator"])
    && validCanonicalRef(value["sourceRef"])
    && typeof value["evidenceLocator"] === "string" && value["evidenceLocator"].length > 0;
}

function validAi001Field(value: unknown): boolean {
  return isRecord(value)
    && hasExactKeys(value, ["fieldName", "valueState", "evidenceRefs", "confidence"], ["rawValue", "normalizedValue"])
    && typeof value["fieldName"] === "string" && value["fieldName"].length > 0
    && ["PRESENT", "MISSING", "AMBIGUOUS", "CONFLICTING", "WITHHELD", "NOT_APPLICABLE"].includes(String(value["valueState"]))
    && (value["rawValue"] === undefined || scalar(value["rawValue"]))
    && (value["normalizedValue"] === undefined || scalar(value["normalizedValue"]))
    && Array.isArray(value["evidenceRefs"]) && value["evidenceRefs"].every(validEvidenceRef)
    && validConfidence(value["confidence"]);
}

function sameRef(left: unknown, right: Readonly<Omit<EntityReference, "version"> & { readonly version: string | number }>): boolean {
  return isRecord(left) && left["entityType"] === right.entityType && left["entityId"] === right.entityId && left["version"] === String(right.version);
}

function containsAuthority(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsAuthority);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, nested]) => authorityKeys.has(key) || containsAuthority(nested));
}

function reject(reasonCode: string, route: ReviewRoute = "MANUAL_FALLBACK"): AdvisoryValidationDecision {
  return Object.freeze({ status: "REJECTED", route, reasonCode });
}

function strings(value: unknown): boolean { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function finite(value: unknown): boolean { return typeof value === "number" && Number.isFinite(value); }
function scalar(value: unknown): boolean { return value === null || typeof value === "string" || typeof value === "boolean" || finite(value); }
function oneOf(value: unknown, values: readonly string[]): boolean { return typeof value === "string" && values.includes(value); }
function validString(value: unknown): boolean { return typeof value === "string" && value.length > 0; }
function validAi002Candidate(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["entityRef", "entityType", "evidenceRefs", "contradictions", "confidence"]) && validCanonicalRef(value["entityRef"]) && oneOf(value["entityType"], ["LOCATION", "PROPERTY", "BUILDING", "TOWER", "FLOOR", "UNIT", "ALIAS"]) && Array.isArray(value["evidenceRefs"]) && value["evidenceRefs"].every(validEvidenceRef) && strings(value["contradictions"]) && validConfidence(value["confidence"]); }
function validSignal(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["signalType", "direction", "explanation"]) && validString(value["signalType"]) && oneOf(value["direction"], ["SUPPORTS", "CONTRADICTS", "NEUTRAL"]) && validString(value["explanation"]); }
function validBudget(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["valueState", "confidence"], ["currency", "minimum", "maximum", "frequency", "flexible"]) && oneOf(value["valueState"], ["PRESENT", "MISSING", "AMBIGUOUS", "CONFLICTING"]) && (value["currency"] === undefined || typeof value["currency"] === "string") && (value["minimum"] === undefined || finite(value["minimum"])) && (value["maximum"] === undefined || finite(value["maximum"])) && (value["frequency"] === undefined || typeof value["frequency"] === "string") && (value["flexible"] === undefined || typeof value["flexible"] === "boolean") && validConfidence(value["confidence"]); }
const constraintTypes = ["HARD", "SOFT", "EXCLUDE", "INFORMATIONAL", "UNKNOWN"] as const;
function validLocation(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["rawText", "constraintType", "confidence"], ["canonicalCandidateRef"]) && typeof value["rawText"] === "string" && (value["canonicalCandidateRef"] === undefined || validCanonicalRef(value["canonicalCandidateRef"])) && oneOf(value["constraintType"], constraintTypes) && validConfidence(value["confidence"]); }
function validPreference(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["criterion", "constraintType", "confidence"], ["value"]) && typeof value["criterion"] === "string" && (value["value"] === undefined || scalar(value["value"])) && oneOf(value["constraintType"], constraintTypes) && validConfidence(value["confidence"]); }
function validFactor(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["factor", "kind", "outcome", "explanation"], ["score", "weight"]) && typeof value["factor"] === "string" && oneOf(value["kind"], ["HARD", "SOFT", "QUALITY", "INFORMATIONAL"]) && oneOf(value["outcome"], ["PASS", "FAIL", "PARTIAL", "UNKNOWN", "NOT_APPLICABLE"]) && (value["score"] === undefined || finite(value["score"])) && (value["weight"] === undefined || finite(value["weight"])) && typeof value["explanation"] === "string"; }
function validFilterValue(value: unknown): boolean { return scalar(value) || (Array.isArray(value) && value.every(scalar)); }
function validFilter(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["field", "operator", "value", "negated"]) && validString(value["field"]) && oneOf(value["operator"], ["EQUALS", "IN", "RANGE", "CONTAINS", "NEAR", "EXISTS"]) && validFilterValue(value["value"]) && typeof value["negated"] === "boolean"; }
function validSort(value: unknown): boolean { return isRecord(value) && hasExactKeys(value, ["field", "direction"]) && typeof value["field"] === "string" && oneOf(value["direction"], ["ASC", "DESC"]); }
function validConfidenceMap(value: unknown): boolean { return isRecord(value) && Object.entries(value).every(([key, nested]) => key.length > 0 && validConfidence(nested)); }
function withinBounds(value: unknown, depth = 0): boolean { if (depth > 12) return false; if (typeof value === "string") return value.length <= 16_384; if (Array.isArray(value)) return value.length <= 1_000 && value.every((item) => withinBounds(item, depth + 1)); if (!isRecord(value)) return true; const entries = Object.entries(value); return entries.length <= 100 && entries.every(([key, nested]) => key.length <= 256 && withinBounds(nested, depth + 1)); }

function validOutput(capabilityId: AiCapabilityId, output: Record<string, unknown>): boolean {
  switch (capabilityId) {
    case "AI-001": return hasExactKeys(output, ["capabilityId", "inputRef", "fields", "warnings", "overallConfidence"]) && output["capabilityId"] === "AI-001" && validCanonicalRef(output["inputRef"]) && Array.isArray(output["fields"]) && output["fields"].every(validAi001Field) && strings(output["warnings"]) && validConfidence(output["overallConfidence"]);
    case "AI-002": return hasExactKeys(output, ["capabilityId", "inputRef", "outcome", "candidates", "ambiguities", "overallConfidence"]) && output["capabilityId"] === "AI-002" && validCanonicalRef(output["inputRef"]) && oneOf(output["outcome"], ["MATCH_CANDIDATE", "UNRESOLVED", "NEW_MASTER_CANDIDATE", "CONFLICT", "NOT_APPLICABLE"]) && Array.isArray(output["candidates"]) && output["candidates"].every(validAi002Candidate) && strings(output["ambiguities"]) && validConfidence(output["overallConfidence"]);
    case "AI-003": return hasExactKeys(output, ["capabilityId", "comparedRefs", "relationship", "recommendation", "signals", "contradictions", "confidence"]) && output["capabilityId"] === "AI-003" && Array.isArray(output["comparedRefs"]) && output["comparedRefs"].length >= 2 && output["comparedRefs"].every(validCanonicalRef) && oneOf(output["relationship"], ["SAME_SOURCE_COPY", "SAME_CANDIDATE", "SAME_UNIT_DIFFERENT_OFFER", "SAME_OFFER_DIFFERENT_SOURCE", "RELATED_PROPERTY", "NOT_DUPLICATE", "UNCERTAIN"]) && oneOf(output["recommendation"], ["LINK_ONLY", "MERGE_CANDIDATE", "KEEP_SEPARATE", "SAME_UNIT_SEPARATE_OFFERS", "NEEDS_MORE_EVIDENCE"]) && Array.isArray(output["signals"]) && output["signals"].every(validSignal) && strings(output["contradictions"]) && validConfidence(output["confidence"]);
    case "AI-004": return hasExactKeys(output, ["capabilityId", "inputRef", "intent", "budget", "locations", "propertyTypes", "preferences", "clarificationNeeds", "overallConfidence"]) && output["capabilityId"] === "AI-004" && validCanonicalRef(output["inputRef"]) && oneOf(output["intent"], ["RENT", "BUY", "OTHER", "UNKNOWN"]) && validBudget(output["budget"]) && Array.isArray(output["locations"]) && output["locations"].every(validLocation) && strings(output["propertyTypes"]) && Array.isArray(output["preferences"]) && output["preferences"].every(validPreference) && strings(output["clarificationNeeds"]) && validConfidence(output["overallConfidence"]);
    case "AI-005": return hasExactKeys(output, ["capabilityId", "requirementRef", "candidateRef", "cohortRef", "factors", "hardConstraintOutcome", "score", "rank", "explanation", "confidence"], ["offerRef"]) && output["capabilityId"] === "AI-005" && validCanonicalRef(output["requirementRef"]) && validCanonicalRef(output["candidateRef"]) && (output["offerRef"] === undefined || validCanonicalRef(output["offerRef"])) && validString(output["cohortRef"]) && Array.isArray(output["factors"]) && output["factors"].every(validFactor) && oneOf(output["hardConstraintOutcome"], ["PASS", "FAIL", "UNKNOWN"]) && finite(output["score"]) && Number.isInteger(output["rank"]) && Number(output["rank"]) >= 1 && validString(output["explanation"]) && validConfidence(output["confidence"]);
    case "AI-006": return hasExactKeys(output, ["capabilityId", "intent", "filters", "sort", "requestedResultClass", "unresolvedTerms", "warnings", "confidence"]) && output["capabilityId"] === "AI-006" && oneOf(output["intent"], ["PROPERTY_DISCOVERY", "REQUIREMENT_SEARCH", "COMPARE", "STATUS_INQUIRY", "OPERATIONAL_LOOKUP", "UNSUPPORTED_WRITE", "UNKNOWN"]) && Array.isArray(output["filters"]) && output["filters"].every(validFilter) && Array.isArray(output["sort"]) && output["sort"].every(validSort) && oneOf(output["requestedResultClass"], ["INTERNAL_CANDIDATE", "CLIENT_ELIGIBLE", "PUBLISHED", "RESTRICTED_OPERATIONAL"]) && strings(output["unresolvedTerms"]) && strings(output["warnings"]) && validConfidence(output["confidence"]);
    case "AI-007": return hasExactKeys(output, ["capabilityId", "subjectRef", "overallConfidence", "fieldConfidences", "validationOutcome", "reviewRoute"]) && oneOf(output["capabilityId"], ["AI-001", "AI-002", "AI-003", "AI-004", "AI-005", "AI-006", "AI-007"]) && validCanonicalRef(output["subjectRef"]) && validConfidence(output["overallConfidence"]) && validConfidenceMap(output["fieldConfidences"]) && oneOf(output["validationOutcome"], ["VALID_DRAFT", "HUMAN_REVIEW_REQUIRED", "REJECTED", "QUARANTINED"]) && oneOf(output["reviewRoute"], ["NORMAL_REVIEW", "SPECIALIST_REVIEW", "SECURITY_REVIEW", "MANUAL_FALLBACK", "NONE_REJECTED"]);
  }
}

function outputConfidence(capabilityId: AiCapabilityId, output: Record<string, unknown>): Record<string, unknown> { return output[capabilityId === "AI-003" || capabilityId === "AI-005" || capabilityId === "AI-006" ? "confidence" : "overallConfidence"] as Record<string, unknown>; }

function canonicalReferences(value: unknown): readonly EntityReference[] {
  if (validCanonicalRef(value)) return [value as EntityReference];
  if (Array.isArray(value)) return value.flatMap(canonicalReferences);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(canonicalReferences);
}

export function validateAdvisoryResult(request: ValidateRequest): AdvisoryValidationDecision {
  if (containsAuthority(request.result)) return reject("PROHIBITED_AUTHORITY_FIELD");
  if (!withinBounds(request.result)) return reject("STRUCTURE_BOUNDS_EXCEEDED");
  if (!isRecord(request.result)) return reject("AI_RESULT_SCHEMA_INVALID");
  const extraKeys = Object.keys(request.result).filter((key) => !topLevelKeys.has(key));
  if (extraKeys.some((key) => outputFieldKeys.has(key))) return reject("WRAPPER_OUTPUT_COLLISION");
  if (extraKeys.length > 0) return reject("AI_RESULT_SCHEMA_INVALID");
  if (request.result["schemaVersion"] !== "1.0" || request.result["capabilityId"] !== request.expectedCapabilityId || !sameRef(request.result["subjectRef"], request.expectedSubject)) return reject("EVIDENCE_MISMATCH");
  if (request.result["schemaId"] !== schemaIds[request.expectedCapabilityId]) return reject("SCHEMA_CAPABILITY_MISMATCH");
  if (request.result["inputChecksum"] !== undefined && !validString(request.result["inputChecksum"])) return reject("AI_RESULT_SCHEMA_INVALID");
  if (!Array.isArray(request.result["provenance"]) || request.result["provenance"].length === 0 || !request.result["provenance"].every(validCanonicalRef)) return reject("PROVENANCE_REQUIRED");
  if (!request.result["provenance"].some((item) => sameRef(item, request.expectedSubject))) return reject("EVIDENCE_MISMATCH");
  const classification = request.result["classification"];
  if (typeof classification !== "string" || !(classification in classificationRank)) return reject("AI_RESULT_SCHEMA_INVALID");
  if (request.inputClassifications.length === 0) return reject("CLASSIFICATION_REQUIRED");
  const requiredRank = Math.max(...request.inputClassifications.map((item) => classificationRank[item]));
  if (classificationRank[classification as DataClassification] < requiredRank) return reject("CLASSIFICATION_DOWNGRADE_DENIED");
  const output = request.result["output"];
  if (!isRecord(output) || !validOutput(request.expectedCapabilityId, output)) return reject("AI_RESULT_SCHEMA_INVALID");
  const provenance = request.result["provenance"];
  if (canonicalReferences(output).some((reference) => !(provenance as readonly unknown[]).some((item) => validCanonicalRef(item) && sameRef(reference, item as EntityReference)))) return reject("EVIDENCE_MISMATCH");
  if (["AI-001", "AI-002", "AI-004"].includes(request.expectedCapabilityId) && !sameRef(output["inputRef"], request.expectedSubject)) return reject("EVIDENCE_MISMATCH");
  if (request.expectedCapabilityId === "AI-007" && !sameRef(output["subjectRef"], request.expectedSubject)) return reject("EVIDENCE_MISMATCH");
  const confidence = outputConfidence(request.expectedCapabilityId, output);
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
