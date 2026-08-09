import type { PublicationAuditRecord, PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationBinding, type PublicationIdentity } from "./publication-contracts.js";
import { createPublicationEventEnvelope, validatePublicationEventEnvelope, type PublicationEventEnvelope } from "./publication-event-contracts.js";
import { eventError, PublicationEventError } from "./publication-event-error.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import type { PublicationRepository } from "./publication-repository.js";
import type { PublicationUnitOfWork } from "./publication-unit-of-work.js";
import { resolvePublicationEventSourceContext, type PublicationEventSourceContextResolver } from "./publication-event-source-context.js";

export interface PublicationEventReplayAuthority {
  authorize(input: { readonly identity: PublicationIdentity; readonly actorId: string; readonly purpose: string; readonly correlationId: string }): boolean;
}

export interface PublicationEventReplayConsumer {
  accept(event: PublicationEventEnvelope): void;
}

export interface PublicationEventReplayRequest extends PublicationIdentity {
  readonly actorId: string;
  readonly purpose: "RECOVERY_VALIDATION";
  readonly correlationId: string;
  readonly commandId: string;
  readonly replayVersion: number;
  readonly occurredAt: string;
}

export interface PublicationEventReplayResult {
  readonly validatedEventCount: number;
  readonly completionEvent: PublicationEventEnvelope;
  readonly replayed: boolean;
}

export class PublicationEventReplayService {
  public constructor(private readonly dependencies: {
    readonly repository: PublicationRepository;
    readonly journal: PublicationEventJournal;
    readonly unitOfWork: PublicationUnitOfWork;
    readonly audit: PublicationAuditStore;
    readonly clock: PublicationClock;
    readonly authority: PublicationEventReplayAuthority;
    readonly sourceContextResolver?: PublicationEventSourceContextResolver;
  }) {}

  public replay(request: PublicationEventReplayRequest, consumer: PublicationEventReplayConsumer): PublicationEventReplayResult {
    const identity = { publicationId: request.publicationId, tenantScopeId: request.tenantScopeId };
    let version = 0;
    try {
      const snapshot = this.dependencies.repository.find(identity);
      if (snapshot === undefined) throw eventError("EVENT_REPLAY_UNAUTHORIZED", "Canonical Event replay source is unavailable.");
      version = snapshot.aggregateVersion;
      const events = this.dependencies.journal.listByAggregate(request.tenantScopeId, request.publicationId);
      if (events.length === 0) throw eventError("EVENT_REPLAY_UNAUTHORIZED", "Canonical Event replay has no validated source stream.");
      let priorSequence = 0;
      for (const event of events) {
        try { validatePublicationEventEnvelope(event); } catch { throw eventError("EVENT_REPLAY_FORBIDDEN_EFFECT", "Canonical Event replay validation failed."); }
        if (event.eventSequence !== priorSequence + 1) throw eventError("EVENT_REPLAY_FORBIDDEN_EFFECT", "Canonical Event replay validation failed.");
        validateEventAgainstCurrentGovernance(event, snapshot.binding, this.dependencies.sourceContextResolver);
        priorSequence = event.eventSequence;
      }
      const governance = resolvePublicationEventSourceContext(this.dependencies.sourceContextResolver, snapshot, "RECOVERY_VALIDATION");
      if (!this.dependencies.authority.authorize({ identity, actorId: request.actorId, purpose: request.purpose, correlationId: request.correlationId })) throw eventError("EVENT_REPLAY_UNAUTHORIZED", "Canonical Event replay is not authorized.");
      appendReplayStart(this.dependencies.audit, request, version);
      const priorCompletion = events.find((event) => event.eventType === "EVT-012" && event.payload["replayVersion"] === request.replayVersion);
      if (priorCompletion !== undefined) {
        if (priorCompletion.commandId !== request.commandId || priorCompletion.correlationId !== request.correlationId || priorCompletion.actorReference !== request.actorId) throw eventError("EVENT_IDENTITY_CONFLICT", "Replay version is already bound to a different canonical occurrence.");
        return immutableDomain({ validatedEventCount: Number(priorCompletion.payload["validatedEventCount"]), completionEvent: priorCompletion, replayed: true });
      }
      for (const event of events) {
        consumer.accept(immutableDomain(event));
      }
      const transaction = this.dependencies.unitOfWork.begin(identity);
      try {
      const completion = createPublicationEventEnvelope({
        source: {
          tenantId: snapshot.tenantScopeId,
          aggregateId: snapshot.aggregateId,
          aggregateVersion: snapshot.aggregateVersion,
          classification: governance.classification,
          privacyScope: governance.privacyScope,
          consentOrLegalBasis: governance.consentOrLegalBasis,
          audienceRestriction: governance.audienceRestriction,
          governanceSourceVersion: governance.sourceVersion,
          purpose: governance.purpose,
        },
        eventType: "EVT-012",
        aggregateId: snapshot.aggregateId,
        aggregateVersion: snapshot.aggregateVersion,
        eventSequence: priorSequence + 1,
        occurredAt: request.occurredAt,
        recordedAt: this.dependencies.clock.now(),
        correlationId: request.correlationId,
        causationId: request.commandId,
        commandId: request.commandId,
        actorReference: request.actorId,
        tenantId: snapshot.tenantScopeId,
        classification: governance.classification,
        privacyScope: governance.privacyScope,
        consentOrLegalBasis: governance.consentOrLegalBasis,
        audienceRestriction: governance.audienceRestriction,
        governanceSourceVersion: governance.sourceVersion,
        purpose: governance.purpose,
        payload: { publicationId: snapshot.publicationId, replayVersion: request.replayVersion, replayedFromSequence: 1, replayedToSequence: priorSequence, validatedEventCount: events.length },
      });
      transaction.eventJournal.append(completion);
      transaction.audit.append(replayAudit(completion, request.actorId));
      transaction.commit();
      return immutableDomain({ validatedEventCount: events.length, completionEvent: completion, replayed: false });
      } catch (error) {
        try { transaction.rollback(); } catch { /* Transaction may already be closed. */ }
        throw error;
      }
    } catch (error) {
      appendReplayFailure(this.dependencies.audit, request, version, error);
      throw error;
    }
  }
}

function validateEventAgainstCurrentGovernance(
  event: PublicationEventEnvelope,
  binding: PublicationBinding,
  resolver: PublicationEventSourceContextResolver | undefined,
): void {
  const current = resolver?.resolve({
    publicationId: event.aggregateId,
    tenantId: event.tenantId,
    classification: event.classification,
    binding,
    purpose: event.purpose,
    sourceVersion: event.governanceSourceVersion,
  });
  if (current === undefined) throw eventError("EVENT_SOURCE_CONTEXT_UNAVAILABLE", "Canonical Event replay governance context is unavailable.");
  if (current.publicationId !== event.aggregateId || current.tenantId !== event.tenantId) throw eventError("EVENT_TENANT_MISMATCH", "Canonical Event replay governance identity changed.");
  if (current.sourceVersion !== event.governanceSourceVersion) throw eventError("EVENT_SOURCE_VERSION_STALE", "Canonical Event replay governance version changed.");
  if (current.classification !== event.classification) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Canonical Event replay classification changed.");
  if (current.privacyScope !== event.privacyScope || current.consentOrLegalBasis !== event.consentOrLegalBasis) throw eventError("EVENT_PRIVACY_VIOLATION", "Canonical Event replay privacy boundary changed.");
  if (current.audienceRestriction !== event.audienceRestriction) throw eventError("EVENT_AUDIENCE_VIOLATION", "Canonical Event replay audience boundary changed.");
  if (current.purpose !== event.purpose) throw eventError("EVENT_PURPOSE_VIOLATION", "Canonical Event replay purpose changed.");
}

function replayAudit(event: PublicationEventEnvelope, actorId: string): PublicationAuditRecord {
  return {
    id: JSON.stringify([event.tenantId, event.aggregateId, "canonical-event", event.eventId, "APPENDED"]),
    tenantScopeId: event.tenantId,
    aggregateId: event.aggregateId,
    command: "APPEND_CANONICAL_EVENT",
    actorId,
    timestamp: event.recordedAt,
    version: event.aggregateVersion,
    result: "COMPLETED" as const,
    correlationId: event.correlationId,
    eventId: event.eventId,
    eventType: event.eventType,
    eventSequence: event.eventSequence,
    safeReasonCode: "EVENT_REPLAY_COMPLETED",
  };
}

function appendReplayStart(audit: PublicationAuditStore, request: PublicationEventReplayRequest, version: number): void {
  const id = JSON.stringify([request.tenantScopeId, request.publicationId, "replay-start", request.commandId, request.replayVersion]);
  if (audit.list(request).some((record) => record.id === id)) return;
  audit.append({ id, tenantScopeId: request.tenantScopeId, aggregateId: request.publicationId, command: "REPLAY_CANONICAL_EVENTS_STARTED", actorId: request.actorId, timestamp: request.occurredAt, version, result: "COMPLETED", correlationId: request.correlationId });
}

function appendReplayFailure(audit: PublicationAuditStore, request: PublicationEventReplayRequest, version: number, error: unknown): void {
  const reason = error instanceof PublicationEventError ? error.code : "INTERNAL_EVENT_JOURNAL_ERROR";
  const id = JSON.stringify([request.tenantScopeId, request.publicationId, "replay-failure", request.commandId, request.replayVersion, reason]);
  try {
    if (audit.list(request).some((record) => record.id === id)) return;
    audit.append({ id, tenantScopeId: request.tenantScopeId, aggregateId: request.publicationId, command: "REPLAY_CANONICAL_EVENTS_FAILED", actorId: request.actorId, timestamp: request.occurredAt, version, result: "FAILED", failureReason: reason, correlationId: request.correlationId });
  } catch { /* Replay failure remains authoritative if audit evidence cannot be appended. */ }
}

export const denyPublicationEventReplayAuthority: PublicationEventReplayAuthority = Object.freeze({ authorize: () => false });
