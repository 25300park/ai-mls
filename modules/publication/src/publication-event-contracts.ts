import { createHash } from "node:crypto";

import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import { immutableDomain, PUBLICATION_CLASSIFICATIONS, type PublicationSnapshot } from "./publication-contracts.js";
import { eventError } from "./publication-event-error.js";

export const PUBLICATION_EVENT_TYPES = ["EVT-003", "EVT-004", "EVT-005", "EVT-006", "EVT-007", "EVT-008", "EVT-009", "EVT-010", "EVT-011", "EVT-012"] as const;
export type PublicationEventType = typeof PUBLICATION_EVENT_TYPES[number];
export type PublicationEventPurpose = "PUBLICATION_EXECUTION" | "RECOVERY_VALIDATION";
export const PUBLICATION_EVENT_SCHEMA_VERSION = "v2" as const;
export const PUBLICATION_EVENT_CONTRACT_VERSION = "v2" as const;

export interface PublicationEventSource {
  readonly tenantId: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly classification: DataClassification;
  readonly privacyScope: string;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly governanceSourceVersion: number;
  readonly purpose: PublicationEventPurpose;
}

const projectionProvenanceBrand: unique symbol = Symbol("PublicationEventProjectionProvenance");

export interface PublicationEventProjectionProvenance {
  readonly publicationVersion: number;
  readonly targetReference: string;
  readonly channelReference: string;
  readonly [projectionProvenanceBrand]: Readonly<{
    readonly tenantId: string;
    readonly aggregateId: string;
    readonly aggregateVersion: number;
  }>;
}

export type PublicationEventPayload = Readonly<Record<string, unknown>>;

export interface PublicationEventIntegrity {
  readonly algorithm: "SHA-256";
  readonly digest: string;
}

export interface PublicationEventEnvelope {
  readonly eventId: string;
  readonly eventType: PublicationEventType;
  readonly eventSchemaVersion: typeof PUBLICATION_EVENT_SCHEMA_VERSION;
  readonly eventContractVersion: typeof PUBLICATION_EVENT_CONTRACT_VERSION;
  readonly aggregateType: "Publication";
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly publicationVersion?: number;
  readonly targetReference?: string;
  readonly channelReference?: string;
  readonly eventSequence: number;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly commandId: string;
  readonly attemptId?: string;
  readonly actorReference: string;
  readonly tenantId: string;
  readonly classification: DataClassification;
  readonly privacyScope: string;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly governanceSourceVersion: number;
  readonly purpose: PublicationEventPurpose;
  readonly payload: PublicationEventPayload;
  readonly integrity: PublicationEventIntegrity;
}

export interface CreatePublicationEventEnvelopeInput extends Omit<PublicationEventEnvelope, "eventId" | "eventSchemaVersion" | "eventContractVersion" | "aggregateType" | "integrity" | "publicationVersion" | "targetReference" | "channelReference"> {
  readonly source: PublicationEventSource;
  readonly projectionProvenance?: PublicationEventProjectionProvenance;
  readonly eventSchemaVersion?: string;
  readonly eventContractVersion?: string;
}

const projectionProvenanceEventTypes = new Set<PublicationEventType>(["EVT-003", "EVT-007", "EVT-008", "EVT-009"]);

const payloadKeys: Readonly<Record<PublicationEventType, readonly string[]>> = Object.freeze({
  "EVT-003": ["publicationId", "priorLifecycle", "newLifecycle", "attemptId", "effectiveVersion", "evidenceReferences"],
  "EVT-004": ["publicationId", "suspensionStatus", "reasonCode"],
  "EVT-005": ["publicationId", "revalidationReference", "outcome", "evidenceReferences"],
  "EVT-006": ["publicationId", "caseId", "attemptId", "resolutionCategory", "evidenceReferences"],
  "EVT-007": ["publicationId", "priorLifecycle", "newLifecycle", "attemptId", "effectiveVersion", "evidenceReferences"],
  "EVT-008": ["publicationId", "priorLifecycle", "newLifecycle", "attemptId", "effectiveVersion", "evidenceReferences"],
  "EVT-009": ["publicationId", "representationId", "representationVersion", "dispositionReference"],
  "EVT-010": ["publicationId", "projectionId", "rebuildGeneration", "sourceAggregateVersion"],
  "EVT-011": ["publicationId", "projectionId", "rebuildGeneration", "sourceAggregateVersion", "validationStatus"],
  "EVT-012": ["publicationId", "replayVersion", "replayedFromSequence", "replayedToSequence", "validatedEventCount"],
});

export function createPublicationEventEnvelope(input: CreatePublicationEventEnvelopeInput): PublicationEventEnvelope {
  if (!PUBLICATION_EVENT_TYPES.includes(input.eventType)) throw eventError("EVENT_TYPE_UNSUPPORTED", "Canonical Event type is unsupported.");
  if ((input.eventSchemaVersion ?? PUBLICATION_EVENT_SCHEMA_VERSION) !== PUBLICATION_EVENT_SCHEMA_VERSION) throw eventError("EVENT_SCHEMA_VERSION_UNSUPPORTED", "Event schema version is unsupported.");
  if ((input.eventContractVersion ?? PUBLICATION_EVENT_CONTRACT_VERSION) !== PUBLICATION_EVENT_CONTRACT_VERSION) throw eventError("EVENT_CONTRACT_VERSION_UNSUPPORTED", "Event contract version is unsupported.");
  assertTextFields(input);
  assertPositive(input.aggregateVersion);
  assertPositive(input.eventSequence);
  assertPositive(input.governanceSourceVersion);
  if (input.aggregateId !== input.source.aggregateId || input.aggregateVersion !== input.source.aggregateVersion) throw eventError("EVENT_AGGREGATE_VERSION_MISMATCH", "Event source Aggregate version does not match.");
  if (input.tenantId !== input.source.tenantId) throw eventError("EVENT_TENANT_MISMATCH", "Event tenant does not match its source.");
  if (input.classification !== input.source.classification || !PUBLICATION_CLASSIFICATIONS.includes(input.classification)) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Event classification must exactly inherit its source.");
  if (input.privacyScope.startsWith("SOURCE_CLASSIFICATION:") || input.source.privacyScope.startsWith("SOURCE_CLASSIFICATION:")) throw eventError("EVENT_PRIVACY_VIOLATION", "Synthetic classification-derived privacy evidence is prohibited.");
  if (input.privacyScope !== input.source.privacyScope) throw eventError("EVENT_PRIVACY_VIOLATION", "Event privacy scope must exactly inherit its source.");
  if (input.consentOrLegalBasis !== input.source.consentOrLegalBasis) throw eventError("EVENT_PRIVACY_VIOLATION", "Event consent or legal-basis reference must exactly inherit its source.");
  if (input.audienceRestriction !== input.source.audienceRestriction) throw eventError("EVENT_AUDIENCE_VIOLATION", "Event audience restriction must exactly inherit its source.");
  if (input.governanceSourceVersion !== input.source.governanceSourceVersion) throw eventError("EVENT_SOURCE_VERSION_STALE", "Event governance source version must exactly inherit its source.");
  if (input.purpose !== input.source.purpose) throw eventError("EVENT_PURPOSE_VIOLATION", "Event purpose must exactly inherit its source.");
  validatePayload(input.eventType, input.payload);
  const projectionProvenance = projectionProvenanceEventTypes.has(input.eventType)
    ? requireProjectionProvenance(input.projectionProvenance, input)
    : undefined;
  if (!projectionProvenanceEventTypes.has(input.eventType) && input.projectionProvenance !== undefined) {
    throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event does not permit speculative projection provenance.");
  }
  const eventId = derivePublicationEventId(input);
  const unsigned = {
    eventId, eventType: input.eventType, eventSchemaVersion: PUBLICATION_EVENT_SCHEMA_VERSION,
    eventContractVersion: PUBLICATION_EVENT_CONTRACT_VERSION, aggregateType: "Publication" as const,
    aggregateId: input.aggregateId, aggregateVersion: input.aggregateVersion, eventSequence: input.eventSequence,
    ...(projectionProvenance === undefined ? {} : {
      publicationVersion: projectionProvenance.publicationVersion,
      targetReference: projectionProvenance.targetReference,
      channelReference: projectionProvenance.channelReference,
    }),
    occurredAt: input.occurredAt, recordedAt: input.recordedAt, correlationId: input.correlationId,
    causationId: input.causationId, commandId: input.commandId,
    ...(input.attemptId === undefined ? {} : { attemptId: input.attemptId }), actorReference: input.actorReference,
    tenantId: input.tenantId, classification: input.classification, privacyScope: input.privacyScope,
    consentOrLegalBasis: input.consentOrLegalBasis, audienceRestriction: input.audienceRestriction,
    governanceSourceVersion: input.governanceSourceVersion,
    purpose: input.purpose, payload: input.payload,
  };
  return immutableDomain({ ...unsigned, integrity: { algorithm: "SHA-256" as const, digest: sha256(canonicalJson(unsigned)) } });
}

export function createPublicationEventProjectionProvenance(snapshot: PublicationSnapshot): PublicationEventProjectionProvenance {
  assertNonNegative(snapshot.publicationVersion);
  const targetReference = requireProjectionText(`${snapshot.binding.targetId}@${String(snapshot.binding.targetVersion)}`);
  const channelReference = requireProjectionText(snapshot.binding.channelId);
  return Object.freeze({
    publicationVersion: snapshot.publicationVersion,
    targetReference,
    channelReference,
    [projectionProvenanceBrand]: Object.freeze({
      tenantId: snapshot.tenantScopeId,
      aggregateId: snapshot.aggregateId,
      aggregateVersion: snapshot.aggregateVersion,
    }),
  });
}

export function verifyPublicationEventIntegrity(event: PublicationEventEnvelope | Readonly<Record<string, unknown>>): boolean {
  if (!isRecord(event.integrity) || event.integrity["algorithm"] !== "SHA-256" || typeof event.integrity["digest"] !== "string") return false;
  const { integrity, ...unsigned } = event;
  return sha256(canonicalJson(unsigned)) === integrity["digest"];
}

export function validatePublicationEventEnvelope(event: PublicationEventEnvelope): void {
  const required = ["eventId", "eventType", "eventSchemaVersion", "eventContractVersion", "aggregateType", "aggregateId", "aggregateVersion", "eventSequence", "occurredAt", "recordedAt", "correlationId", "causationId", "commandId", "actorReference", "tenantId", "classification", "privacyScope", "consentOrLegalBasis", "audienceRestriction", "governanceSourceVersion", "purpose", "payload", "integrity"];
  const keys = Object.keys(event);
  if (!PUBLICATION_EVENT_TYPES.includes(event.eventType)) throw eventError("EVENT_TYPE_UNSUPPORTED", "Canonical Event type is unsupported.");
  const requiresProjectionProvenance = projectionProvenanceEventTypes.has(event.eventType);
  const projectionKeys = ["publicationVersion", "targetReference", "channelReference"] as const;
  if (requiresProjectionProvenance && (projectionKeys.some((key) => !keys.includes(key))
    || !Number.isSafeInteger(event.publicationVersion) || (event.publicationVersion ?? -1) < 0
    || typeof event.targetReference !== "string" || event.targetReference.trim().length === 0
    || typeof event.channelReference !== "string" || event.channelReference.trim().length === 0)) {
    throw eventError("EVENT_PROJECTION_PROVENANCE_INCOMPLETE", "Canonical Event projection provenance is incomplete.");
  }
  if (!requiresProjectionProvenance && projectionKeys.some((key) => keys.includes(key))) {
    throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event contains speculative projection provenance.");
  }
  const allowed = new Set([...required, "attemptId", ...(requiresProjectionProvenance ? projectionKeys : [])]);
  if (required.some((key) => !keys.includes(key)) || keys.some((key) => !allowed.has(key))) throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event envelope is not a closed schema.");
  if (event.eventSchemaVersion !== PUBLICATION_EVENT_SCHEMA_VERSION) throw eventError("EVENT_SCHEMA_VERSION_UNSUPPORTED", "Event schema version is unsupported.");
  if (event.eventContractVersion !== PUBLICATION_EVENT_CONTRACT_VERSION) throw eventError("EVENT_CONTRACT_VERSION_UNSUPPORTED", "Event contract version is unsupported.");
  if (event.aggregateType !== "Publication") throw eventError("EVENT_TYPE_UNSUPPORTED", "Canonical Event aggregate type is unsupported.");
  assertPositive(event.aggregateVersion);
  assertPositive(event.eventSequence);
  assertPositive(event.governanceSourceVersion);
  if (!PUBLICATION_CLASSIFICATIONS.includes(event.classification)) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Canonical Event classification is invalid.");
  if (event.privacyScope.startsWith("SOURCE_CLASSIFICATION:")) throw eventError("EVENT_PRIVACY_VIOLATION", "Synthetic classification-derived privacy evidence is prohibited.");
  validatePayload(event.eventType, event.payload);
  if (event.eventId !== derivePublicationEventId(event)) throw eventError("EVENT_IDENTITY_CONFLICT", "Canonical Event identity does not match its occurrence.");
  if (!verifyPublicationEventIntegrity(event)) throw eventError("EVENT_INTEGRITY_FAILURE", "Canonical Event integrity validation failed.");
}

export function samePublicationEvent(left: PublicationEventEnvelope, right: PublicationEventEnvelope): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function validatePayload(type: PublicationEventType, payload: PublicationEventPayload): void {
  if (!isRecord(payload)) throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event payload is invalid.");
  const allowed = payloadKeys[type];
  const keys = Object.keys(payload);
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key)) || allowed.some((key) => !keys.includes(key))) throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event payload does not match its closed schema.");
  for (const value of Object.values(payload)) {
    const scalar = typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0);
    const references = Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
    if (!scalar && !references) throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event payload is not a bounded serializable value.");
  }
}

function assertTextFields(input: CreatePublicationEventEnvelopeInput): void {
  const values = [input.aggregateId, input.occurredAt, input.recordedAt, input.correlationId, input.causationId, input.commandId, input.actorReference, input.tenantId, input.privacyScope, input.consentOrLegalBasis, input.audienceRestriction, input.purpose];
  if (values.some((value) => value.trim().length === 0)) throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Canonical Event envelope contains an empty governance field.");
  if (Number.isNaN(Date.parse(input.occurredAt)) || Number.isNaN(Date.parse(input.recordedAt))) throw eventError("EVENT_PAYLOAD_INVALID", "Canonical Event timestamps are invalid.");
}

function assertPositive(value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) throw eventError("EVENT_AGGREGATE_VERSION_MISMATCH", "Canonical Event version or sequence is invalid.");
}

function assertNonNegative(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw eventError("EVENT_PROJECTION_PROVENANCE_INCOMPLETE", "Canonical Event Publication version is invalid.");
}

function requireProjectionText(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw eventError("EVENT_PROJECTION_PROVENANCE_INCOMPLETE", "Canonical Event projection provenance is incomplete.");
  return value;
}

function requireProjectionProvenance(
  value: PublicationEventProjectionProvenance | undefined,
  input: Pick<CreatePublicationEventEnvelopeInput, "tenantId" | "aggregateId" | "aggregateVersion">,
): PublicationEventProjectionProvenance {
  if (value === undefined) {
    throw eventError("EVENT_PROJECTION_PROVENANCE_INCOMPLETE", "Canonical Event projection provenance is incomplete.");
  }
  const sourceIdentity: PublicationEventProjectionProvenance[typeof projectionProvenanceBrand] | undefined = value[projectionProvenanceBrand];
  if (sourceIdentity?.tenantId !== input.tenantId
    || sourceIdentity.aggregateId !== input.aggregateId
    || sourceIdentity.aggregateVersion !== input.aggregateVersion) {
    throw eventError("EVENT_PROJECTION_PROVENANCE_INCOMPLETE", "Canonical Event projection provenance is incomplete.");
  }
  assertNonNegative(value.publicationVersion);
  requireProjectionText(value.targetReference);
  requireProjectionText(value.channelReference);
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (isRecord(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  return value;
}

function sha256(value: string): string { return createHash("sha256").update(value).digest("hex"); }
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return value !== null && typeof value === "object" && !Array.isArray(value); }

function derivePublicationEventId(input: Pick<CreatePublicationEventEnvelopeInput, "tenantId" | "aggregateId" | "aggregateVersion" | "eventType" | "eventSequence" | "causationId" | "commandId">): string {
  return `evt_${sha256(canonicalJson({ tenantId: input.tenantId, aggregateId: input.aggregateId, aggregateVersion: input.aggregateVersion, eventType: input.eventType, eventSequence: input.eventSequence, causationId: input.causationId, commandId: input.commandId }))}`;
}
