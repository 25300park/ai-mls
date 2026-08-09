import { createHash } from "node:crypto";

import type { PublicationClock } from "./publication-clock.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { LISTING_PROJECTION_DEFINITION_VERSION, LISTING_PROJECTION_SCHEMA_VERSION, LISTING_PROJECTION_TYPE, immutableProjection, type ListingProjectionAuditRecord, type ListingProjectionRecord } from "./listing-projection-contracts.js";
import { ListingProjectionError, projectionError } from "./listing-projection-error.js";
import { ListingProjectionConsumer } from "./listing-projection.js";
import type { ListingProjectionAuditStore, ListingProjectionStore } from "./listing-projection-store.js";

export interface ListingProjectionRebuildRequest {
  readonly tenantId: string;
  readonly publicationId: string;
  readonly projectionId: "PRJ-002";
  readonly generationId: string;
  readonly expectedServingGenerationId?: string;
  readonly actorOrServiceReference: string;
  readonly purpose: "PROJECTION_REBUILD";
  readonly reason: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly sourceFromSequence: number;
}

export interface ListingProjectionRebuildAuthority {
  authorize(request: ListingProjectionRebuildRequest): boolean;
}

export interface ListingProjectionRebuildResult {
  readonly generationId: string;
  readonly record: ListingProjectionRecord;
  readonly replayed: boolean;
}

export const denyListingProjectionRebuildAuthority: ListingProjectionRebuildAuthority = Object.freeze({ authorize: () => false });

export class ListingProjectionRebuildCoordinator {
  public readonly journalIdentity: PublicationEventJournal;
  private readonly idempotency = new Map<string, Readonly<{ fingerprint: string; result: ListingProjectionRebuildResult }>>();

  public constructor(private readonly dependencies: {
    readonly journal: PublicationEventJournal;
    readonly store: ListingProjectionStore;
    readonly audit: ListingProjectionAuditStore;
    readonly clock: PublicationClock;
    readonly authority: ListingProjectionRebuildAuthority;
  }) {
    this.journalIdentity = dependencies.journal;
  }

  public rebuild(request: ListingProjectionRebuildRequest): ListingProjectionRebuildResult {
    validateRequest(request);
    if (!this.dependencies.authority.authorize(request)) throw projectionError("PROJECTION_REBUILD_UNAUTHORIZED", "Listing Projection rebuild is not authorized.");
    const idempotencyKey = JSON.stringify([request.tenantId, request.projectionId, request.idempotencyKey]);
    const fingerprint = rebuildFingerprint(request);
    const prior = this.idempotency.get(idempotencyKey);
    if (prior !== undefined) {
      if (prior.fingerprint !== fingerprint) throw projectionError("PROJECTION_REBUILD_FAILED", "Projection rebuild idempotency identity conflicts with a different request.");
      return immutableProjection({ ...prior.result, replayed: true });
    }
    let created = false;
    let cutover = false;
    let archivedPrior = false;
    const identity = { tenantId: request.tenantId, publicationId: request.publicationId };
    try {
      this.appendAudit(request, "REBUILD_REQUESTED", "COMPLETED", "PROJECTION_REBUILD_REQUESTED");
      this.dependencies.store.createGeneration({ projectionType: LISTING_PROJECTION_TYPE, ...identity, generationId: request.generationId, lifecycle: "REBUILDING", projectionDefinitionVersion: LISTING_PROJECTION_DEFINITION_VERSION, projectionSchemaVersion: LISTING_PROJECTION_SCHEMA_VERSION, createdAt: this.dependencies.clock.now(), updatedAt: this.dependencies.clock.now(), complete: false });
      created = true;
      this.appendAudit(request, "REBUILD_STARTED", "COMPLETED", "PROJECTION_REBUILD_STARTED");
      const events = this.dependencies.journal.listByAggregate(request.tenantId, request.publicationId).filter((event) => event.eventSequence >= request.sourceFromSequence);
      if (events.length === 0 || events[0]?.eventSequence !== request.sourceFromSequence) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection rebuild source stream is incomplete.");
      const consumer = new ListingProjectionConsumer({ journal: this.dependencies.journal, store: this.dependencies.store, audit: this.dependencies.audit, clock: this.dependencies.clock });
      for (const event of events) consumer.consume(request.tenantId, event.eventId, request.generationId);
      const record = this.dependencies.store.getByGeneration({ tenantId: request.tenantId, publicationId: request.publicationId }, request.generationId);
      const last = events.at(-1);
      if (record === undefined || last === undefined || record.stale || record.lastEventSequence !== last.eventSequence || record.aggregateVersion !== last.aggregateVersion) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection rebuild candidate did not reach complete source progress.");
      this.dependencies.store.markGeneration(identity, request.generationId, { lifecycle: "ACTIVE", complete: true, finalEventSequence: record.lastEventSequence, sourceAggregateVersion: record.aggregateVersion, publicationVersion: record.publicationVersion, sourceClassification: record.sourceClassification, privacyScope: record.privacyScope, purpose: record.purpose, targetReference: record.targetReference, channelReference: record.channelReference, updatedAt: this.dependencies.clock.now() });
      this.appendAudit(request, "REBUILD_VALIDATED", "COMPLETED", "PROJECTION_REBUILD_VALIDATED", record);
      this.dependencies.store.compareAndSwapServingGeneration(identity, request.expectedServingGenerationId, request.generationId);
      cutover = true;
      const serving = this.dependencies.store.getServing({ tenantId: request.tenantId, publicationId: request.publicationId });
      if (serving === undefined) throw projectionError("PROJECTION_CUTOVER_FAILED", "Projection serving generation cutover did not expose the validated candidate.");
      this.appendAudit(request, "GENERATION_CUTOVER", "COMPLETED", "PROJECTION_GENERATION_CUTOVER", serving);
      const priorGenerationId = request.expectedServingGenerationId;
      if (priorGenerationId !== undefined && priorGenerationId !== request.generationId) {
        const priorRecord = this.dependencies.store.getByGeneration(identity, priorGenerationId);
        this.dependencies.store.markGeneration(identity, priorGenerationId, { lifecycle: "ARCHIVED", updatedAt: this.dependencies.clock.now() });
        archivedPrior = true;
        this.appendAudit({ ...request, generationId: priorGenerationId }, "GENERATION_ARCHIVED", "COMPLETED", "PROJECTION_GENERATION_ARCHIVED", priorRecord);
      }
      const result = immutableProjection({ generationId: request.generationId, record: serving, replayed: false });
      this.idempotency.set(idempotencyKey, immutableProjection({ fingerprint, result }));
      return result;
    } catch (error) {
      if (cutover) {
        try {
          if (archivedPrior && request.expectedServingGenerationId !== undefined) {
            this.dependencies.store.markGeneration(identity, request.expectedServingGenerationId, { lifecycle: "ACTIVE", updatedAt: this.dependencies.clock.now() });
          }
          this.dependencies.store.compareAndSwapServingGeneration(identity, request.generationId, request.expectedServingGenerationId);
        } catch { /* Preserve the canonical rebuild failure while preventing unrelated mutation. */ }
      }
      if (created) {
        try { this.dependencies.store.markGeneration(identity, request.generationId, { lifecycle: "FAILED", complete: false, updatedAt: this.dependencies.clock.now() }); } catch { /* Preserve the canonical rebuild failure. */ }
      }
      try { this.appendAudit(request, "REBUILD_FAILED", "FAILED", error instanceof ListingProjectionError ? error.code : "INTERNAL_PROJECTION_ERROR"); } catch { /* Preserve the canonical safe rebuild error. */ }
      if (error instanceof ListingProjectionError && error.code === "PROJECTION_GENERATION_CONFLICT") throw error;
      throw projectionError("PROJECTION_REBUILD_FAILED", "Listing Projection rebuild failed safely.");
    }
  }

  private appendAudit(request: ListingProjectionRebuildRequest, operation: ListingProjectionAuditRecord["operation"], result: ListingProjectionAuditRecord["result"], safeReasonCode: string, record?: ListingProjectionRecord): void {
    this.dependencies.audit.append({ auditId: JSON.stringify([request.tenantId, request.publicationId, request.generationId, operation, request.idempotencyKey, safeReasonCode]), projectionId: `PRJ-002:${request.tenantId}:${request.publicationId}`, projectionType: LISTING_PROJECTION_TYPE, tenantId: request.tenantId, publicationId: request.publicationId, generationId: request.generationId, ...(record === undefined ? {} : { eventId: record.lastEventId, eventSequence: record.lastEventSequence, sourceAggregateVersion: record.aggregateVersion, publicationVersion: record.publicationVersion, projectionRecordVersion: record.projectionRecordVersion }), operation, result, safeReasonCode, actorOrServiceReference: request.actorOrServiceReference, correlationId: request.correlationId, recordedAt: this.dependencies.clock.now() });
  }
}

function validateRequest(request: ListingProjectionRebuildRequest): void {
  const values = [request.tenantId, request.publicationId, request.generationId, request.actorOrServiceReference, request.reason, request.correlationId, request.idempotencyKey];
  if (request.projectionId !== LISTING_PROJECTION_TYPE || request.purpose !== "PROJECTION_REBUILD" || values.some((value) => value.trim().length === 0) || !Number.isSafeInteger(request.sourceFromSequence) || request.sourceFromSequence < 1) throw projectionError("PROJECTION_REBUILD_UNAUTHORIZED", "Projection rebuild request is invalid.");
}

function rebuildFingerprint(request: ListingProjectionRebuildRequest): string {
  return createHash("sha256").update(JSON.stringify({ tenantId: request.tenantId, publicationId: request.publicationId, projectionId: request.projectionId, generationId: request.generationId, expectedServingGenerationId: request.expectedServingGenerationId, actorOrServiceReference: request.actorOrServiceReference, purpose: request.purpose, reason: request.reason, correlationId: request.correlationId, sourceFromSequence: request.sourceFromSequence })).digest("hex");
}
