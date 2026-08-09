import type { PublicationClock } from "./publication-clock.js";
import { PUBLICATION_EVENT_CONTRACT_VERSION, PUBLICATION_EVENT_SCHEMA_VERSION, validatePublicationEventEnvelope, verifyPublicationEventIntegrity, type PublicationEventEnvelope, type PublicationEventType } from "./publication-event-contracts.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { LISTING_PROJECTION_DEFINITION_VERSION, LISTING_PROJECTION_SCHEMA_VERSION, LISTING_PROJECTION_TYPE, immutableProjection, type ListingProjectionAuditRecord, type ListingProjectionEventDisposition, type ListingProjectionGeneration, type ListingProjectionIdentity, type ListingProjectionRecord, type ListingProjectionView } from "./listing-projection-contracts.js";
import { ListingProjectionError, projectionError, type ListingProjectionErrorCode } from "./listing-projection-error.js";
import type { ListingProjectionAuditStore, ListingProjectionStore } from "./listing-projection-store.js";
import type { PublicationOperationsObserver } from "./publication-operations-contracts.js";

export interface ListingProjectionApplyResult {
  readonly status: "APPLIED" | "DUPLICATE_IGNORED" | "NO_STATE_CHANGE" | "CONTROL_APPLIED";
  readonly record: ListingProjectionRecord;
}

const eventDispositions: Readonly<Record<PublicationEventType, ListingProjectionEventDisposition>> = Object.freeze({
  "EVT-003": "APPLY", "EVT-004": "APPLY", "EVT-005": "NO_STATE_CHANGE", "EVT-006": "APPLY",
  "EVT-007": "APPLY", "EVT-008": "APPLY", "EVT-009": "APPLY", "EVT-010": "CONTROL",
  "EVT-011": "CONTROL", "EVT-012": "NO_STATE_CHANGE",
});

export class ListingProjectionConsumer {
  public readonly journalIdentity: PublicationEventJournal;

  public constructor(private readonly dependencies: {
    readonly journal: PublicationEventJournal;
    readonly store: ListingProjectionStore;
    readonly audit: ListingProjectionAuditStore;
    readonly clock: PublicationClock;
    readonly operations?: PublicationOperationsObserver;
  }) {
    this.journalIdentity = dependencies.journal;
  }

  public consume(tenantId: string, eventId: string, generationId?: string): ListingProjectionApplyResult {
    const event = this.dependencies.journal.findByEventId(tenantId, eventId);
    if (event === undefined) throw projectionError("PROJECTION_EVENT_UNSUPPORTED", "Canonical Event is unavailable to the Projection consumer.");
    if (event.tenantId !== tenantId) throw projectionError("PROJECTION_TENANT_MISMATCH", "Projection Event tenant does not match the requested tenant.");
    const identity = { tenantId, publicationId: event.aggregateId };
    const generation = generationId === undefined
      ? this.ensureServingGeneration(identity)
      : { generation: this.dependencies.store.getGeneration(identity, generationId), created: false };
    if (generation.generation === undefined) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection generation is unavailable.");
    const actualGenerationId = generation.generation.generationId;
    const existing = this.dependencies.store.getByGeneration(identity, actualGenerationId);
    try {
      this.validateEvent(event, existing);
      const duplicate = existing?.appliedEvents.find((applied) => applied.eventId === event.eventId);
      if (duplicate !== undefined) {
        if (existing === undefined) throw projectionError("PROJECTION_PROVENANCE_INCOMPLETE", "Duplicate Projection Event has no prior Projection state.");
        if (duplicate.integrity !== event.integrity.digest || duplicate.eventSequence !== event.eventSequence) throw projectionError("PROJECTION_EVENT_DUPLICATE_CONFLICT", "Projection Event identity conflicts with prior content.");
        this.appendAudit("DUPLICATE_IGNORED", "COMPLETED", "PROJECTION_EVENT_DUPLICATE_IDEMPOTENT", event, existing, "projection-consumer");
        return immutableProjection({ status: "DUPLICATE_IGNORED" as const, record: existing });
      }
      const next = this.project(event, existing, actualGenerationId);
      const disposition = eventDispositions[event.eventType];
      const saved = this.dependencies.store.saveWithAudit(
        next,
        existing?.projectionRecordVersion,
        this.auditRecord("EVENT_APPLIED", "COMPLETED", `PROJECTION_${disposition}`, event, next, event.actorReference),
        this.dependencies.audit,
      );
      const identity = { tenantId: event.tenantId, publicationId: event.aggregateId };
      if (generationId === undefined && this.dependencies.store.getServingGeneration(identity) === undefined) {
        this.dependencies.store.markGeneration(identity, actualGenerationId, {
          lifecycle: "ACTIVE",
          complete: true,
          finalEventSequence: saved.lastEventSequence,
          sourceAggregateVersion: saved.aggregateVersion,
          publicationVersion: saved.publicationVersion,
          sourceClassification: saved.sourceClassification,
          privacyScope: saved.privacyScope,
          purpose: saved.purpose,
          targetReference: saved.targetReference,
          channelReference: saved.channelReference,
          updatedAt: this.dependencies.clock.now(),
        });
        this.dependencies.store.compareAndSwapServingGeneration(identity, undefined, actualGenerationId);
      }
      safelyObserve(this.dependencies.operations, { component: "LISTING_PROJECTION", result: "COMPLETED", sourceReference: event.eventId, correlationId: event.correlationId, actorOrServiceReference: event.actorReference });
      return immutableProjection({ status: disposition === "APPLY" ? "APPLIED" as const : disposition === "CONTROL" ? "CONTROL_APPLIED" as const : "NO_STATE_CHANGE" as const, record: saved });
    } catch (error) {
      const isProjectionFailure = error instanceof ListingProjectionError;
      const mapped = isProjectionFailure ? error : projectionError(mapEventFailure(error), "Projection Event validation failed.");
      if (isProjectionFailure) this.markStale(existing, event, mapped.code);
      safelyObserve(this.dependencies.operations, { component: "LISTING_PROJECTION", result: "FAILED", failureCode: mapped.code, sourceReference: event.eventId, correlationId: event.correlationId, actorOrServiceReference: event.actorReference });
      if (generation.created) {
        try { this.dependencies.store.deleteGeneration(identity, actualGenerationId); } catch { /* Preserve the canonical apply failure. */ }
      }
      throw mapped;
    }
  }

  private validateEvent(event: PublicationEventEnvelope, existing: ListingProjectionRecord | undefined): void {
    if (event.eventSchemaVersion !== PUBLICATION_EVENT_SCHEMA_VERSION || event.eventContractVersion !== PUBLICATION_EVENT_CONTRACT_VERSION) throw projectionError("PROJECTION_SCHEMA_VERSION_DRIFT", "Projection Event schema or contract version drifted.");
    try { validatePublicationEventEnvelope(event); } catch (error) { throw projectionError(mapEventFailure(error), "Projection Event contract validation failed."); }
    if (!verifyPublicationEventIntegrity(event)) throw projectionError("PROJECTION_PROVENANCE_INCOMPLETE", "Projection Event integrity is invalid.");
    if (event.payload["publicationId"] !== event.aggregateId) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection Event Publication identity conflicts with its payload.");
    if (eventDispositions[event.eventType] === "UNSUPPORTED") throw projectionError("PROJECTION_EVENT_UNSUPPORTED", "Projection Event type is unsupported.");
    if (existing === undefined) {
      if (event.eventSequence !== 1) throw projectionError("PROJECTION_SEQUENCE_GAP", "Projection Event stream does not begin at sequence one.");
      if (event.eventType !== "EVT-003") throw projectionError("PROJECTION_PROVENANCE_INCOMPLETE", "Listing Projection requires an activation Event as its first state.");
      return;
    }
    if (existing.stale) throw projectionError("PROJECTION_STALE", "A stale Listing Projection requires controlled rebuild before further Event application.");
    if (existing.tenantId !== event.tenantId) throw projectionError("PROJECTION_TENANT_MISMATCH", "Projection Event tenant drifted.");
    if (existing.projectionDefinitionVersion !== LISTING_PROJECTION_DEFINITION_VERSION) throw projectionError("PROJECTION_DEFINITION_VERSION_DRIFT", "Projection definition version drifted.");
    if (existing.projectionSchemaVersion !== LISTING_PROJECTION_SCHEMA_VERSION) throw projectionError("PROJECTION_SCHEMA_VERSION_DRIFT", "Projection schema version drifted.");
    if (event.eventSequence > existing.lastEventSequence + 1) throw projectionError("PROJECTION_SEQUENCE_GAP", "Projection Event sequence contains a gap.");
    if (event.eventSequence <= existing.lastEventSequence && !existing.appliedEvents.some(({ eventId }) => eventId === event.eventId)) throw projectionError("PROJECTION_EVENT_OUT_OF_ORDER", "Projection Event is out of aggregate-local order.");
    if (event.aggregateVersion < existing.aggregateVersion) throw projectionError("PROJECTION_SOURCE_VERSION_DRIFT", "Projection source Aggregate version regressed.");
    if (event.publicationVersion !== undefined && event.publicationVersion < existing.publicationVersion) throw projectionError("PROJECTION_PUBLICATION_VERSION_DRIFT", "Projection Publication version regressed.");
    if (event.classification !== existing.sourceClassification) throw projectionError("PROJECTION_CLASSIFICATION_VIOLATION", "Projection source classification drifted.");
    if (event.privacyScope !== existing.privacyScope) throw projectionError("PROJECTION_PURPOSE_VIOLATION", "Projection privacy boundary expanded.");
    const disposition = eventDispositions[event.eventType];
    if (event.purpose !== existing.purpose && (disposition === "APPLY" || event.purpose !== "RECOVERY_VALIDATION")) throw projectionError("PROJECTION_PURPOSE_VIOLATION", "Projection purpose boundary expanded.");
    if ((event.eventType === "EVT-007" || event.eventType === "EVT-008" || event.eventType === "EVT-009")
      && (event.targetReference !== existing.targetReference || event.channelReference !== existing.channelReference)) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection Target or Channel provenance conflicts with the current listing lineage.");
  }

  private project(event: PublicationEventEnvelope, existing: ListingProjectionRecord | undefined, generationId: string): ListingProjectionRecord {
    const now = this.dependencies.clock.now();
    const requiredProvenance = event.eventType === "EVT-003" || event.eventType === "EVT-007" || event.eventType === "EVT-008" || event.eventType === "EVT-009";
    if (requiredProvenance && (event.publicationVersion === undefined || event.targetReference === undefined || event.channelReference === undefined)) throw projectionError("PROJECTION_PROVENANCE_INCOMPLETE", "Projection Event lacks required 011A provenance.");
    const lifecycle = event.eventType === "EVT-003" || event.eventType === "EVT-008" ? "ACTIVE" : event.eventType === "EVT-007" ? "WITHDRAWN" : existing?.lifecycle;
    if (lifecycle === undefined) throw projectionError("PROJECTION_PROVENANCE_INCOMPLETE", "Projection lifecycle cannot be reconstructed from the Event stream.");
    const suspensionStatus = event.eventType === "EVT-004" ? String(event.payload["suspensionStatus"]) : existing?.suspensionStatus ?? "NOT_SUSPENDED";
    if (suspensionStatus !== "NOT_SUSPENDED" && suspensionStatus !== "SUSPENDED_OPERATIONAL" && suspensionStatus !== "SUSPENDED_SECURITY" && suspensionStatus !== "SUSPENDED_COMPLIANCE" && suspensionStatus !== "SUSPENDED_PROVIDER_POLICY") throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection suspension status is not canonical.");
    const generation = this.dependencies.store.getGeneration({ tenantId: event.tenantId, publicationId: event.aggregateId }, generationId);
    if (generation === undefined) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection generation is unavailable.");
    const effectiveVersionValue = event.payload["effectiveVersion"] ?? existing?.effectiveVersion;
    if (effectiveVersionValue !== undefined && (!Number.isSafeInteger(effectiveVersionValue) || (effectiveVersionValue as number) < 0)) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection effective version is invalid.");
    return immutableProjection({
      projectionId: `PRJ-002:${event.tenantId}:${event.aggregateId}`, projectionType: LISTING_PROJECTION_TYPE,
      publicationId: event.aggregateId, tenantId: event.tenantId, lifecycle, suspensionStatus,
      aggregateVersion: event.aggregateVersion, publicationVersion: event.publicationVersion ?? existing?.publicationVersion ?? 0,
      ...(effectiveVersionValue === undefined ? {} : { effectiveVersion: effectiveVersionValue as number }),
      lastEventId: event.eventId, lastEventType: event.eventType, lastEventSequence: event.eventSequence,
      lastEventIntegrity: event.integrity.digest, eventContractVersion: event.eventContractVersion,
      targetReference: event.targetReference ?? existing?.targetReference ?? "",
      channelReference: event.channelReference ?? existing?.channelReference ?? "",
      sourceClassification: event.classification, privacyScope: event.privacyScope, purpose: existing?.purpose ?? event.purpose,
      projectionDefinitionVersion: LISTING_PROJECTION_DEFINITION_VERSION, projectionSchemaVersion: LISTING_PROJECTION_SCHEMA_VERSION,
      projectionRecordVersion: (existing?.projectionRecordVersion ?? 0) + 1, generationId,
      generatedAt: existing?.generatedAt ?? now, updatedAt: now,
      stale: false,
      appliedEvents: [...(existing?.appliedEvents ?? []), { eventId: event.eventId, eventSequence: event.eventSequence, integrity: event.integrity.digest }],
    });
  }

  private ensureServingGeneration(identity: ListingProjectionIdentity): Readonly<{ generation: ListingProjectionGeneration; created: boolean }> {
    const existing = this.dependencies.store.getServingGeneration(identity);
    if (existing !== undefined) return { generation: existing, created: false };
    const generationId = `PRJ-002:SERVING:${identity.tenantId}:${identity.publicationId}`;
    const generation = this.dependencies.store.createGeneration({ projectionType: LISTING_PROJECTION_TYPE, ...identity, generationId, lifecycle: "BUILDING", projectionDefinitionVersion: LISTING_PROJECTION_DEFINITION_VERSION, projectionSchemaVersion: LISTING_PROJECTION_SCHEMA_VERSION, createdAt: this.dependencies.clock.now(), updatedAt: this.dependencies.clock.now(), complete: false });
    return { generation, created: true };
  }

  private markStale(existing: ListingProjectionRecord | undefined, event: PublicationEventEnvelope, reason: ListingProjectionErrorCode): void {
    try {
      this.appendAudit("DRIFT_DETECTED", "FAILED", reason, event, existing, "projection-consumer");
    } catch { return; }
    if (existing !== undefined && !existing.stale) {
      const staleCandidate = immutableProjection({ ...existing, stale: true, staleReason: driftReason(reason), projectionRecordVersion: existing.projectionRecordVersion + 1, updatedAt: this.dependencies.clock.now() });
      try {
        this.dependencies.store.saveWithAudit(staleCandidate, existing.projectionRecordVersion, this.auditRecord("PROJECTION_MARKED_STALE", "COMPLETED", driftReason(reason), event, staleCandidate, "projection-consumer"), this.dependencies.audit);
      } catch { /* Reject the Event with its original canonical drift error. */ }
    }
  }

  private appendAudit(operation: ListingProjectionAuditRecord["operation"], result: ListingProjectionAuditRecord["result"], safeReasonCode: string, event: PublicationEventEnvelope, record: ListingProjectionRecord | undefined, actor: string): void {
    this.dependencies.audit.append(this.auditRecord(operation, result, safeReasonCode, event, record, actor));
  }

  private auditRecord(operation: ListingProjectionAuditRecord["operation"], result: ListingProjectionAuditRecord["result"], safeReasonCode: string, event: PublicationEventEnvelope, record: ListingProjectionRecord | undefined, actor: string): ListingProjectionAuditRecord {
    return { auditId: JSON.stringify([event.tenantId, event.aggregateId, record?.generationId ?? "UNAVAILABLE", operation, event.eventId, safeReasonCode]), projectionId: `PRJ-002:${event.tenantId}:${event.aggregateId}`, projectionType: LISTING_PROJECTION_TYPE, publicationId: event.aggregateId, tenantId: event.tenantId, generationId: record?.generationId ?? "UNAVAILABLE", eventId: event.eventId, eventSequence: event.eventSequence, sourceAggregateVersion: event.aggregateVersion, ...(event.publicationVersion === undefined ? {} : { publicationVersion: event.publicationVersion }), ...(record === undefined ? {} : { projectionRecordVersion: record.projectionRecordVersion }), operation, result, safeReasonCode, actorOrServiceReference: actor, correlationId: event.correlationId, recordedAt: this.dependencies.clock.now() };
  }
}

function safelyObserve(observer: PublicationOperationsObserver | undefined, observation: Parameters<PublicationOperationsObserver["observe"]>[0]): void {
  try { observer?.observe(observation); } catch { /* Observability cannot alter Projection application semantics. */ }
}

export class ListingProjectionReadService {
  public constructor(private readonly store: ListingProjectionStore) {}

  public getServing(identity: ListingProjectionIdentity): ListingProjectionView | undefined {
    const record = this.store.getServing(identity);
    if (record === undefined) return undefined;
    return immutableProjection({ projectionId: record.projectionId, projectionType: record.projectionType, publicationId: record.publicationId, lifecycle: record.lifecycle, suspensionStatus: record.suspensionStatus, ...(record.effectiveVersion === undefined ? {} : { effectiveVersion: record.effectiveVersion }), targetReference: record.targetReference, channelReference: record.channelReference, sourceAggregateVersion: record.aggregateVersion, publicationVersion: record.publicationVersion, lastEventSequence: record.lastEventSequence, projectionRecordVersion: record.projectionRecordVersion, projectionGeneration: record.generationId, stale: record.stale, ...(record.staleReason === undefined ? {} : { staleReason: record.staleReason }), provenance: { eventId: record.lastEventId, eventType: record.lastEventType, eventContractVersion: record.eventContractVersion } });
  }
}

function mapEventFailure(error: unknown): ListingProjectionErrorCode {
  if (error !== null && typeof error === "object" && "code" in error) {
    const code = String(error.code);
    if (code.includes("SCHEMA_VERSION") || code.includes("CONTRACT_VERSION")) return "PROJECTION_SCHEMA_VERSION_DRIFT";
    if (code.includes("INTEGRITY")) return "PROJECTION_PROVENANCE_INCOMPLETE";
    if (code.includes("TENANT")) return "PROJECTION_TENANT_MISMATCH";
    if (code.includes("CLASSIFICATION")) return "PROJECTION_CLASSIFICATION_VIOLATION";
    if (code.includes("PURPOSE") || code.includes("PRIVACY") || code.includes("AUDIENCE")) return "PROJECTION_PURPOSE_VIOLATION";
    if (code.includes("PROVENANCE")) return "PROJECTION_PROVENANCE_INCOMPLETE";
  }
  return "INTERNAL_PROJECTION_ERROR";
}

function driftReason(code: ListingProjectionErrorCode): string {
  const map: Partial<Record<ListingProjectionErrorCode, string>> = {
    PROJECTION_SEQUENCE_GAP: "EVENT_SEQUENCE_GAP", PROJECTION_EVENT_OUT_OF_ORDER: "EVENT_OUT_OF_ORDER",
    PROJECTION_SOURCE_VERSION_DRIFT: "SOURCE_VERSION_DRIFT", PROJECTION_PUBLICATION_VERSION_DRIFT: "PUBLICATION_VERSION_DRIFT",
    PROJECTION_SCHEMA_VERSION_DRIFT: "SCHEMA_VERSION_DRIFT", PROJECTION_DEFINITION_VERSION_DRIFT: "DEFINITION_VERSION_DRIFT",
    PROJECTION_CLASSIFICATION_VIOLATION: "CLASSIFICATION_DRIFT", PROJECTION_PURPOSE_VIOLATION: "PURPOSE_DRIFT",
    PROJECTION_TENANT_MISMATCH: "TENANT_DRIFT", PROJECTION_PROVENANCE_INCOMPLETE: "PROJECTION_PROVENANCE_INCOMPLETE",
  };
  return map[code] ?? code;
}
