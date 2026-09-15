import type { AuditPrincipal, AuditTarget, DataClassification, RoleCode } from "../../../packages/security-contracts/src/index.js";
import { isSensitiveSecurityDetailKey, isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import type { AuditVisibilityBinding } from "./durable-audit-event-store.js";

export type MaterializationReadySourceDomain = "SOURCE_REGISTRY" | "INTAKE" | "PROPERTY" | "LISTING" | "CONTACT" | "MATCHING" | "API-017";
export type AuditEventCategory = "COMMAND_ACCEPTED" | "STATE_CHANGED" | "EVIDENCE_APPENDED" | "SECURITY_DECISION";
export type AuditPrincipalProvenance =
  | Readonly<{ kind: "TRUSTED_SNAPSHOT"; principal: AuditPrincipal }>
  | Readonly<{ kind: "IMMUTABLE_REFERENCE"; principalId: string; evidenceRef: string }>;

export interface EnrichedAuditIntentV2<SourceDomain extends MaterializationReadySourceDomain = MaterializationReadySourceDomain> {
  readonly auditIntentContractVersion: "v2";
  readonly intentId: string;
  readonly sourceDomain: SourceDomain;
  readonly aggregateId: string;
  readonly mutationIdentity: string;
  readonly eventType: string;
  readonly eventCategory: AuditEventCategory;
  readonly action: string;
  readonly target: AuditTarget;
  readonly principalProvenance: AuditPrincipalProvenance;
  readonly visibility: AuditVisibilityBinding;
  readonly purpose: string;
  readonly policyVersion: string;
  readonly classification: DataClassification;
  readonly decision: "ALLOW" | "DENY" | "NOT_APPLICABLE";
  readonly outcome: "ACCEPTED" | "COMPLETED" | "FAILED" | "UNKNOWN";
  readonly committedAt: string;
  readonly correlationId: string;
  readonly requestId?: string;
  readonly reason?: string;
  readonly evidenceRefs: readonly string[];
}

export type EnrichedAuditIntentValidationErrorCode = "INTENT_INVALID" | "SOURCE_NOT_MATERIALIZATION_READY";

export class EnrichedAuditIntentValidationError extends Error {
  public constructor(public readonly code: EnrichedAuditIntentValidationErrorCode) {
    super(code);
    this.name = "EnrichedAuditIntentValidationError";
  }
}

const roles = new Set<RoleCode>(["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"]);
const classifications = new Set<DataClassification>(["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"]);
const decisions = new Set(["ALLOW", "DENY", "NOT_APPLICABLE"]);
const outcomes = new Set(["ACCEPTED", "COMPLETED", "FAILED", "UNKNOWN"]);
const categories = new Set<AuditEventCategory>(["COMMAND_ACCEPTED", "STATE_CHANGED", "EVIDENCE_APPENDED", "SECURITY_DECISION"]);
const propertyTypes = new Set(["Location", "Property", "Building", "Tower", "Floor", "Unit"]);
const sourceDomains: readonly MaterializationReadySourceDomain[] = Object.freeze(["SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING", "API-017"]);

const mappings = new Map<string, Readonly<{ action: string; targets: ReadonlySet<string>; category: AuditEventCategory; outcome: EnrichedAuditIntentV2["outcome"] }>>();
function map(source: MaterializationReadySourceDomain, eventType: string, action: string, targets: readonly string[], category: AuditEventCategory, outcome: EnrichedAuditIntentV2["outcome"]): void {
  mappings.set(`${source}:${eventType}`, Object.freeze({ action, targets: new Set(targets), category, outcome }));
}
map("SOURCE_REGISTRY", "SOURCE_POLICY_PROPOSED", "source.propose", ["SourceRegistry"], "COMMAND_ACCEPTED", "ACCEPTED");
map("INTAKE", "INTAKE_CREATED", "intake.create", ["Intake"], "COMMAND_ACCEPTED", "ACCEPTED");
map("INTAKE", "RAW_ATTACHMENT_LINKED", "intake.attach-evidence", ["Intake"], "EVIDENCE_APPENDED", "COMPLETED");
map("INTAKE", "INTAKE_VALIDATED", "intake.validate", ["Intake"], "STATE_CHANGED", "COMPLETED");
map("INTAKE", "INTAKE_AI_REQUESTED", "intake.request-ai", ["Intake"], "COMMAND_ACCEPTED", "ACCEPTED");
map("INTAKE", "INTAKE_AI_RESULT_ROUTED", "intake.validate", ["Intake"], "STATE_CHANGED", "COMPLETED");
map("INTAKE", "INTAKE_MANUAL_FALLBACK", "intake.validate", ["Intake"], "STATE_CHANGED", "COMPLETED");
map("INTAKE", "INTAKE_REVIEWED", "intake.review", ["Intake"], "STATE_CHANGED", "COMPLETED");
for (const eventType of ["PROPERTY_PROPOSED", "PROPERTY_DECIDED"] as const) {
  map("PROPERTY", eventType, eventType === "PROPERTY_PROPOSED" ? "property.propose" : "property.decide", [...propertyTypes], eventType === "PROPERTY_PROPOSED" ? "COMMAND_ACCEPTED" : "STATE_CHANGED", "COMPLETED");
}
map("PROPERTY", "PROPERTY_ALIAS_PROPOSED", "property.propose", ["PropertyAlias"], "COMMAND_ACCEPTED", "COMPLETED");
map("LISTING", "CANDIDATE_CREATED", "candidate.create", ["CandidateListing"], "COMMAND_ACCEPTED", "COMPLETED");
map("LISTING", "CANDIDATE_REGISTERED_FROM_INTAKE", "candidate.create", ["CandidateListing"], "STATE_CHANGED", "COMPLETED");
map("LISTING", "CANDIDATE_REVISED", "candidate.revise", ["CandidateListing"], "STATE_CHANGED", "COMPLETED");
map("LISTING", "LISTING_OFFER_CREATED", "offer.create", ["ListingOffer"], "COMMAND_ACCEPTED", "COMPLETED");
map("LISTING", "LISTING_OFFER_REVISED", "offer.revise", ["ListingOffer"], "STATE_CHANGED", "COMPLETED");
map("LISTING", "DUPLICATE_SUGGESTED", "duplicate.suggest", ["DuplicateGroup"], "COMMAND_ACCEPTED", "COMPLETED");
map("LISTING", "DUPLICATE_DISPOSED", "duplicate.dispose", ["DuplicateGroup"], "STATE_CHANGED", "COMPLETED");
map("CONTACT", "CONTACT_CREATED", "contact.create", ["Contact"], "COMMAND_ACCEPTED", "COMPLETED");
map("CONTACT", "CONTACT_CORRECTED", "contact.edit", ["Contact"], "STATE_CHANGED", "COMPLETED");
map("CONTACT", "CONTACT_CHANNEL_ADDED", "contact.edit", ["ContactChannel"], "STATE_CHANGED", "COMPLETED");
map("CONTACT", "CONTACT_CHANNEL_REVOKED", "contact.edit", ["ContactChannel"], "STATE_CHANGED", "COMPLETED");
map("CONTACT", "CONTACT_ATTEMPT_RECORDED", "contact.attempt", ["ContactCase"], "EVIDENCE_APPENDED", "COMPLETED");
map("MATCHING", "MATCH_RUN_CREATED", "matching.request", ["MatchRun"], "COMMAND_ACCEPTED", "COMPLETED");
map("MATCHING", "MATCH_RESULT_REVIEWED", "matching.review", ["MatchResult"], "STATE_CHANGED", "COMPLETED");
map("MATCHING", "MATCH_RESULT_STALE", "matching.stale", ["MatchResult"], "STATE_CHANGED", "COMPLETED");
map("API-017", "JOB_SUBMITTED", "job.submit", ["BackgroundJob"], "COMMAND_ACCEPTED", "ACCEPTED");
map("API-017", "JOB_STARTED", "job.start", ["BackgroundJob"], "STATE_CHANGED", "ACCEPTED");
map("API-017", "JOB_SUCCEEDED", "job.succeed", ["BackgroundJob"], "STATE_CHANGED", "COMPLETED");
map("API-017", "JOB_FAILED", "job.fail", ["BackgroundJob"], "STATE_CHANGED", "FAILED");
map("API-017", "JOB_CANCELLED", "job.cancel", ["BackgroundJob"], "STATE_CHANGED", "COMPLETED");
map("API-017", "JOB_EXPIRED", "job.expire", ["BackgroundJob"], "STATE_CHANGED", "COMPLETED");
map("API-017", "JOB_RETRY_SUBMITTED", "job.retry", ["BackgroundJob"], "COMMAND_ACCEPTED", "ACCEPTED");

export function validateEnrichedAuditIntentV2<SourceDomain extends MaterializationReadySourceDomain>(
  value: unknown,
  expectedSource: SourceDomain,
): EnrichedAuditIntentV2<SourceDomain>;
export function validateEnrichedAuditIntentV2(
  value: unknown,
  expectedSource?: MaterializationReadySourceDomain,
): EnrichedAuditIntentV2;
export function validateEnrichedAuditIntentV2(
  value: unknown,
  expectedSource?: MaterializationReadySourceDomain,
): EnrichedAuditIntentV2 {
  if (!plain(value)) throw failure("INTENT_INVALID");
  const allowed = ["auditIntentContractVersion", "intentId", "sourceDomain", "aggregateId", "mutationIdentity", "eventType", "eventCategory", "action", "target", "principalProvenance", "visibility", "purpose", "policyVersion", "classification", "decision", "outcome", "committedAt", "correlationId", "requestId", "reason", "evidenceRefs"];
  if (Object.keys(value).some((key) => !allowed.includes(key)) || value["auditIntentContractVersion"] !== "v2") throw failure("INTENT_INVALID");
  const source = value["sourceDomain"];
  if (!isMaterializationReadySourceDomain(source)) throw failure("SOURCE_NOT_MATERIALIZATION_READY");
  if (expectedSource !== undefined && source !== expectedSource) throw failure("INTENT_INVALID");
  const mapping = mappings.get(`${source}:${String(value["eventType"])}`);
  if (mapping === undefined || value["action"] !== mapping.action || value["eventCategory"] !== mapping.category || value["outcome"] !== mapping.outcome || !plain(value["target"]) || !mapping.targets.has(String(value["target"]["type"]))) throw failure("INTENT_INVALID");
  if (!safeText(value["intentId"]) || !safeText(value["aggregateId"]) || !safeText(value["mutationIdentity"]) || !safeText(value["eventType"]) || !categories.has(value["eventCategory"] as AuditEventCategory)
    || !validateTarget(value["target"]) || !validateProvenance(value["principalProvenance"]) || !validateVisibility(value["visibility"], source)
    || !safeText(value["purpose"]) || !safeText(value["policyVersion"]) || !classifications.has(value["classification"] as DataClassification)
    || !decisions.has(String(value["decision"])) || !outcomes.has(String(value["outcome"])) || !instant(value["committedAt"]) || !safeText(value["correlationId"])
    || (value["requestId"] !== undefined && !safeText(value["requestId"])) || (value["reason"] !== undefined && !safeText(value["reason"])) || !safeEvidenceRefs(value["evidenceRefs"])) throw failure("INTENT_INVALID");
  return snapshot(value) as unknown as EnrichedAuditIntentV2;
}

export function isMaterializationReadySourceDomain(value: unknown): value is MaterializationReadySourceDomain {
  return sourceDomains.includes(value as MaterializationReadySourceDomain);
}

function validateTarget(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => ["type", "id", "version"].includes(key)) && safeText(value["type"]) && safeText(value["id"])
    && (value["version"] === undefined || (Number.isInteger(value["version"]) && Number(value["version"]) > 0));
}

function validateProvenance(value: unknown): boolean {
  if (!plain(value)) return false;
  if (value["kind"] === "TRUSTED_SNAPSHOT") return Object.keys(value).every((key) => ["kind", "principal"].includes(key)) && validatePrincipal(value["principal"]);
  return value["kind"] === "IMMUTABLE_REFERENCE" && Object.keys(value).every((key) => ["kind", "principalId", "evidenceRef"].includes(key))
    && safeText(value["principalId"]) && safeEvidenceRef(value["evidenceRef"]);
}

function validatePrincipal(value: unknown): value is AuditPrincipal {
  if (!plain(value)) return false;
  const keys = Object.keys(value);
  return keys.every((key) => ["id", "type", "roles", "teamId", "sessionId"].includes(key)) && safeText(value["id"])
    && ["HUMAN", "SERVICE"].includes(String(value["type"])) && Array.isArray(value["roles"]) && value["roles"].length <= 20
    && value["roles"].every((role) => roles.has(role as RoleCode)) && (value["teamId"] === undefined || safeText(value["teamId"]))
    && (value["sessionId"] === undefined || safeText(value["sessionId"]));
}

function validateVisibility(value: unknown, source: MaterializationReadySourceDomain): value is AuditVisibilityBinding {
  if (!plain(value)) return false;
  if (source === "PROPERTY") return value["kind"] === "SYSTEM_BOUND" && value["scopeRef"] === "system:property-master" && Object.keys(value).length === 2;
  return value["kind"] === "TENANT_BOUND" && safeText(value["tenantId"]) && safeText(value["scopeRef"]) && Object.keys(value).length === 3;
}

function safeEvidenceRefs(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(safeEvidenceRef);
}

function safeEvidenceRef(value: unknown): value is string {
  return safeText(value) && /^[A-Za-z][A-Za-z0-9._-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value)
    && !isUnsafeSecurityDetailValue(value);
}

function safeText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value) && !isSensitiveSecurityDetailKey(value) && !isUnsafeSecurityDetailValue(value);
}

function instant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function plain(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function snapshot<T>(value: T): T {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const nested of Object.values(value)) deepFreeze(nested);
  Object.freeze(value);
}

function failure(code: EnrichedAuditIntentValidationErrorCode): EnrichedAuditIntentValidationError {
  return new EnrichedAuditIntentValidationError(code);
}
