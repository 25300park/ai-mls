import { createHash } from "node:crypto";

import type { AuditPrincipal, AuditTarget, DataClassification, RoleCode } from "../../../packages/security-contracts/src/index.js";
import { isSensitiveSecurityDetailKey, isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import { DurableAuditEventStoreError, type AuditVisibilityBinding, type DurableAuditEventStore, type DurableMaterializedAuditEvent } from "./durable-audit-event-store.js";

export type MaterializationReadySourceDomain = "SOURCE_REGISTRY" | "INTAKE" | "PROPERTY" | "LISTING" | "CONTACT" | "MATCHING";
export type AuditEventCategory = "COMMAND_ACCEPTED" | "STATE_CHANGED" | "EVIDENCE_APPENDED" | "SECURITY_DECISION";
export type AuditPrincipalProvenance =
  | Readonly<{ kind: "TRUSTED_SNAPSHOT"; principal: AuditPrincipal }>
  | Readonly<{ kind: "IMMUTABLE_REFERENCE"; principalId: string; evidenceRef: string }>;

export interface EnrichedAuditIntentV2 {
  readonly auditIntentContractVersion: "v2";
  readonly intentId: string;
  readonly sourceDomain: MaterializationReadySourceDomain;
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

export interface AuditIntentSourcePort {
  readonly sourceDomain: MaterializationReadySourceDomain;
  readByIntentId(intentId: string): EnrichedAuditIntentV2 | undefined;
  listEligible(input: Readonly<{ continuation?: string; limit?: number }>): Readonly<{ intents: readonly EnrichedAuditIntentV2[]; continuation?: string }>;
}

export function createAuditIntentSourcePort(input: Readonly<{ sourceDomain: MaterializationReadySourceDomain; read(): readonly unknown[] }>): AuditIntentSourcePort {
  if (!isSource(input.sourceDomain) || typeof input.read !== "function") throw new Error("INTENT_SOURCE_INPUT_INVALID");
  const eligible = (): readonly EnrichedAuditIntentV2[] => Object.freeze(input.read().filter((value): value is EnrichedAuditIntentV2 => plain(value) && value["auditIntentContractVersion"] === "v2" && value["sourceDomain"] === input.sourceDomain));
  return Object.freeze({
    sourceDomain: input.sourceDomain,
    readByIntentId: (intentId: string) => safeIdentifier(intentId) ? eligible().find((value) => value.intentId === intentId) : undefined,
    listEligible: (request: Readonly<{ continuation?: string; limit?: number }>) => {
      if ((request.continuation !== undefined && !safeIdentifier(request.continuation)) || (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit < 1 || request.limit > 100))) throw new Error("INTENT_SOURCE_INPUT_INVALID");
      const ordered = eligible().slice().sort((left, right) => left.intentId.localeCompare(right.intentId));
      const after = request.continuation === undefined ? ordered : ordered.filter((value) => value.intentId > request.continuation!);
      const limit = request.limit ?? 100;
      const intents = after.slice(0, limit);
      const continuation = after.length > limit ? intents.at(-1)?.intentId : undefined;
      return Object.freeze({ intents: Object.freeze(intents), ...(continuation === undefined ? {} : { continuation }) });
    },
  });
}

export type AuditIntentMaterializationErrorCode = "INTENT_INVALID" | "INTENT_NOT_MATERIALIZATION_READY" | "MATERIALIZATION_FAILED" | "MATERIALIZATION_IDENTITY_CONFLICT" | "SOURCE_NOT_MATERIALIZATION_READY";

export class AuditIntentMaterializationError extends Error {
  public constructor(public readonly code: AuditIntentMaterializationErrorCode) { super(code); this.name = "AuditIntentMaterializationError"; }
}

interface Dependencies {
  readonly store: DurableAuditEventStore;
  readonly clock: () => Date;
  readonly principalEvidenceResolver?: Readonly<{ resolve(evidenceRef: string): AuditPrincipal | undefined }>;
}

const roles = new Set<RoleCode>(["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"]);
const classifications = new Set<DataClassification>(["PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY"]);
const decisions = new Set(["ALLOW", "DENY", "NOT_APPLICABLE"]);
const outcomes = new Set(["ACCEPTED", "COMPLETED", "FAILED", "UNKNOWN"]);
const categories = new Set<AuditEventCategory>(["COMMAND_ACCEPTED", "STATE_CHANGED", "EVIDENCE_APPENDED", "SECURITY_DECISION"]);
const propertyTypes = new Set(["Location", "Property", "Building", "Tower", "Floor", "Unit"]);

const mappings = new Map<string, Readonly<{ action: string; targets: ReadonlySet<string>; category: AuditEventCategory }>>();
function map(source: MaterializationReadySourceDomain, eventType: string, action: string, targets: readonly string[], category: AuditEventCategory): void { mappings.set(`${source}:${eventType}`, Object.freeze({ action, targets: new Set(targets), category })); }
map("SOURCE_REGISTRY", "SOURCE_POLICY_PROPOSED", "source.propose", ["SourceRegistry"], "COMMAND_ACCEPTED");
map("INTAKE", "INTAKE_CREATED", "intake.create", ["Intake"], "COMMAND_ACCEPTED");
map("INTAKE", "RAW_ATTACHMENT_LINKED", "intake.attach-evidence", ["Intake"], "EVIDENCE_APPENDED");
map("INTAKE", "INTAKE_VALIDATED", "intake.validate", ["Intake"], "STATE_CHANGED");
map("INTAKE", "INTAKE_AI_REQUESTED", "intake.request-ai", ["Intake"], "COMMAND_ACCEPTED");
map("INTAKE", "INTAKE_AI_RESULT_ROUTED", "intake.validate", ["Intake"], "STATE_CHANGED");
map("INTAKE", "INTAKE_MANUAL_FALLBACK", "intake.validate", ["Intake"], "STATE_CHANGED");
map("INTAKE", "INTAKE_REVIEWED", "intake.review", ["Intake"], "STATE_CHANGED");
for (const eventType of ["PROPERTY_PROPOSED", "PROPERTY_DECIDED"] as const) map("PROPERTY", eventType, eventType === "PROPERTY_PROPOSED" ? "property.propose" : "property.decide", [...propertyTypes], eventType === "PROPERTY_PROPOSED" ? "COMMAND_ACCEPTED" : "STATE_CHANGED");
map("PROPERTY", "PROPERTY_ALIAS_PROPOSED", "property.propose", ["PropertyAlias"], "COMMAND_ACCEPTED");
map("LISTING", "CANDIDATE_CREATED", "candidate.create", ["CandidateListing"], "COMMAND_ACCEPTED");
map("LISTING", "CANDIDATE_REGISTERED_FROM_INTAKE", "candidate.create", ["CandidateListing"], "STATE_CHANGED");
map("LISTING", "CANDIDATE_REVISED", "candidate.revise", ["CandidateListing"], "STATE_CHANGED");
map("LISTING", "LISTING_OFFER_CREATED", "offer.create", ["ListingOffer"], "COMMAND_ACCEPTED");
map("LISTING", "LISTING_OFFER_REVISED", "offer.revise", ["ListingOffer"], "STATE_CHANGED");
map("LISTING", "DUPLICATE_SUGGESTED", "duplicate.suggest", ["DuplicateGroup"], "COMMAND_ACCEPTED");
map("LISTING", "DUPLICATE_DISPOSED", "duplicate.dispose", ["DuplicateGroup"], "STATE_CHANGED");
map("CONTACT", "CONTACT_CREATED", "contact.create", ["Contact"], "COMMAND_ACCEPTED");
map("CONTACT", "CONTACT_CORRECTED", "contact.edit", ["Contact"], "STATE_CHANGED");
map("CONTACT", "CONTACT_CHANNEL_ADDED", "contact.edit", ["ContactChannel"], "STATE_CHANGED");
map("CONTACT", "CONTACT_CHANNEL_REVOKED", "contact.edit", ["ContactChannel"], "STATE_CHANGED");
map("CONTACT", "CONTACT_ATTEMPT_RECORDED", "contact.attempt", ["ContactCase"], "EVIDENCE_APPENDED");
map("MATCHING", "MATCH_RUN_CREATED", "matching.request", ["MatchRun"], "COMMAND_ACCEPTED");
map("MATCHING", "MATCH_RESULT_REVIEWED", "matching.review", ["MatchResult"], "STATE_CHANGED");
map("MATCHING", "MATCH_RESULT_STALE", "matching.stale", ["MatchResult"], "STATE_CHANGED");

export class AuditIntentMaterializer {
  public constructor(private readonly dependencies: Dependencies) {}

  public materialize(value: unknown): Readonly<{ status: "MATERIALIZED" | "REPLAYED"; event: DurableMaterializedAuditEvent }> {
    if (plain(value) && value["auditIntentContractVersion"] !== "v2") throw failure("INTENT_NOT_MATERIALIZATION_READY");
    if (plain(value) && value["sourceDomain"] === "CLIENT_REQUIREMENT") throw failure("SOURCE_NOT_MATERIALIZATION_READY");
    const intent = validateIntent(value);
    const principal = resolvePrincipal(intent.principalProvenance, this.dependencies.principalEvidenceResolver);
    const evidenceRefs = [...intent.evidenceRefs].sort();
    const event = snapshot({
      id: `audit:${intent.sourceDomain}:${intent.intentId}`,
      eventType: intent.eventType,
      principal,
      action: intent.action,
      target: intent.target,
      purpose: intent.purpose,
      policyVersion: intent.policyVersion,
      classification: intent.classification,
      decision: intent.decision,
      outcome: intent.outcome,
      ...(intent.reason === undefined ? {} : { reason: intent.reason }),
      ...(intent.requestId === undefined ? {} : { requestId: intent.requestId }),
      correlationId: intent.correlationId,
      details: { evidenceRefs },
      occurredAt: intent.committedAt,
      sourceDomain: intent.sourceDomain,
      auditIntentId: intent.intentId,
      aggregateId: intent.aggregateId,
      mutationIdentity: intent.mutationIdentity,
      visibility: intent.visibility,
      materializedAt: this.dependencies.clock().toISOString(),
      evidenceRefs,
    }) as DurableMaterializedAuditEvent;
    const fingerprint = fingerprintOf({ ...event, materializedAt: undefined });
    try { return this.dependencies.store.append({ fingerprint, event }); }
    catch (error) {
      if (error instanceof DurableAuditEventStoreError && error.code === "MATERIALIZATION_IDENTITY_CONFLICT") throw failure("MATERIALIZATION_IDENTITY_CONFLICT");
      throw failure("MATERIALIZATION_FAILED");
    }
  }

  public consume(source: AuditIntentSourcePort): readonly DurableMaterializedAuditEvent[] {
    if (!mappingsFor(source.sourceDomain)) throw failure("SOURCE_NOT_MATERIALIZATION_READY");
    const batch = source.listEligible({ limit: 100 });
    return Object.freeze(batch.intents.map((intent) => this.materialize(intent).event));
  }
}

function validateIntent(value: unknown): EnrichedAuditIntentV2 {
  if (!plain(value)) throw failure("INTENT_INVALID");
  const allowed = ["auditIntentContractVersion", "intentId", "sourceDomain", "aggregateId", "mutationIdentity", "eventType", "eventCategory", "action", "target", "principalProvenance", "visibility", "purpose", "policyVersion", "classification", "decision", "outcome", "committedAt", "correlationId", "requestId", "reason", "evidenceRefs"];
  if (Object.keys(value).some((key) => !allowed.includes(key)) || value["auditIntentContractVersion"] !== "v2") throw failure("INTENT_INVALID");
  const source = value["sourceDomain"];
  if (!isSource(source)) throw failure("SOURCE_NOT_MATERIALIZATION_READY");
  const mapping = mappings.get(`${source}:${String(value["eventType"])}`);
  if (mapping === undefined || value["action"] !== mapping.action || value["eventCategory"] !== mapping.category || !plain(value["target"]) || !mapping.targets.has(String(value["target"]["type"]))) throw failure("INTENT_INVALID");
  if (!safeText(value["intentId"]) || !safeText(value["aggregateId"]) || !safeText(value["mutationIdentity"]) || !safeText(value["eventType"]) || !categories.has(value["eventCategory"] as AuditEventCategory)
    || !validateTarget(value["target"]) || !validateProvenance(value["principalProvenance"]) || !validateVisibility(value["visibility"], source)
    || !safeText(value["purpose"]) || !safeText(value["policyVersion"]) || !classifications.has(value["classification"] as DataClassification)
    || !decisions.has(String(value["decision"])) || !outcomes.has(String(value["outcome"])) || !instant(value["committedAt"]) || !safeText(value["correlationId"])
    || (value["requestId"] !== undefined && !safeText(value["requestId"])) || (value["reason"] !== undefined && !safeText(value["reason"])) || !safeEvidenceRefs(value["evidenceRefs"])) throw failure("INTENT_INVALID");
  return snapshot(value) as unknown as EnrichedAuditIntentV2;
}

function validateTarget(value: Record<string, unknown>): boolean { const keys = Object.keys(value); return keys.every((key) => ["type", "id", "version"].includes(key)) && safeText(value["type"]) && safeText(value["id"]) && (value["version"] === undefined || (Number.isInteger(value["version"]) && Number(value["version"]) > 0)); }
function validateProvenance(value: unknown): boolean {
  if (!plain(value)) return false;
  if (value["kind"] === "TRUSTED_SNAPSHOT") return Object.keys(value).every((key) => ["kind", "principal"].includes(key)) && validatePrincipal(value["principal"]);
  return value["kind"] === "IMMUTABLE_REFERENCE" && Object.keys(value).every((key) => ["kind", "principalId", "evidenceRef"].includes(key)) && safeText(value["principalId"]) && safeEvidenceRef(value["evidenceRef"]);
}
function validatePrincipal(value: unknown): value is AuditPrincipal { if (!plain(value)) return false; const keys = Object.keys(value); return keys.every((key) => ["id", "type", "roles", "teamId", "sessionId"].includes(key)) && safeText(value["id"]) && ["HUMAN", "SERVICE"].includes(String(value["type"])) && Array.isArray(value["roles"]) && value["roles"].length <= 20 && value["roles"].every((role) => roles.has(role as RoleCode)) && (value["teamId"] === undefined || safeText(value["teamId"])) && (value["sessionId"] === undefined || safeText(value["sessionId"])); }
function validateVisibility(value: unknown, source: MaterializationReadySourceDomain): value is AuditVisibilityBinding { if (!plain(value)) return false; if (source === "PROPERTY") return value["kind"] === "SYSTEM_BOUND" && value["scopeRef"] === "system:property-master" && Object.keys(value).length === 2; return value["kind"] === "TENANT_BOUND" && safeText(value["tenantId"]) && safeText(value["scopeRef"]) && Object.keys(value).length === 3; }
function resolvePrincipal(value: AuditPrincipalProvenance, resolver: Dependencies["principalEvidenceResolver"]): AuditPrincipal { if (value.kind === "TRUSTED_SNAPSHOT") return snapshot(value.principal); const principal = resolver?.resolve(value.evidenceRef); if (principal?.id !== value.principalId || !validatePrincipal(principal)) throw failure("INTENT_INVALID"); return snapshot(principal); }
function safeEvidenceRefs(value: unknown): value is readonly string[] { return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every(safeEvidenceRef); }
function safeEvidenceRef(value: unknown): value is string { return safeText(value) && /^[A-Za-z][A-Za-z0-9._-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value) && !isUnsafeSecurityDetailValue(value); }
function safeText(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value) && !isSensitiveSecurityDetailKey(value) && !isUnsafeSecurityDetailValue(value); }
function safeIdentifier(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 256 && value.trim() === value && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value); }
function instant(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function isSource(value: unknown): value is MaterializationReadySourceDomain { return ["SOURCE_REGISTRY", "INTAKE", "PROPERTY", "LISTING", "CONTACT", "MATCHING"].includes(String(value)); }
function mappingsFor(source: MaterializationReadySourceDomain): boolean { return [...mappings.keys()].some((key) => key.startsWith(`${source}:`)); }
function fingerprintOf(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }
function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (plain(value)) return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`; return JSON.stringify(value); }
function snapshot<T>(value: T): T { const copy = structuredClone(value); deepFreeze(copy); return copy; }
function deepFreeze(value: unknown): void { if (value === null || typeof value !== "object" || Object.isFrozen(value)) return; for (const nested of Object.values(value)) deepFreeze(nested); Object.freeze(value); }
function failure(code: AuditIntentMaterializationErrorCode): AuditIntentMaterializationError { return new AuditIntentMaterializationError(code); }
