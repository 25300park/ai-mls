import type { PublicationApplicationCommand } from "./publication-application-contracts.js";
import type { PublicationAuditStore } from "./publication-audit-store.js";
import type { PublicationClock } from "./publication-clock.js";
import { immutableDomain, type PublicationSnapshot } from "./publication-contracts.js";
import { createPublicationEventEnvelope, type PublicationEventEnvelope } from "./publication-event-contracts.js";
import { eventError, PublicationEventError } from "./publication-event-error.js";
import type { PublicationEventJournal } from "./publication-event-journal.js";
import { mapAcceptedPublicationTransition } from "./publication-event-mapper.js";
import { resolvePublicationEventSourceContext, type PublicationEventSourceContextResolver } from "./publication-event-source-context.js";

export interface PublicationEventEmissionTransaction {
  readonly eventJournal: PublicationEventJournal;
  readonly audit: PublicationAuditStore;
}

export class PublicationEventCoordinator {
  public constructor(
    private readonly clock: PublicationClock,
    private readonly sourceContextResolver?: PublicationEventSourceContextResolver,
  ) {}

  public appendAcceptedTransition(
    transaction: PublicationEventEmissionTransaction,
    previous: PublicationSnapshot | undefined,
    current: PublicationSnapshot,
    command: PublicationApplicationCommand,
  ): readonly PublicationEventEnvelope[] {
    const candidates = mapAcceptedPublicationTransition(previous, current, command);
    if (candidates.length === 0) return Object.freeze([]);
    const domain = command.input.command;
    if (domain.authorityContext !== "PUBLICATION_EXECUTION") throw eventError("EVENT_PURPOSE_VIOLATION", "Accepted Publication transition has no canonical Event purpose.");
    const governance = resolvePublicationEventSourceContext(this.sourceContextResolver, current, "PUBLICATION_EXECUTION");
    const commandId = command.kind === "MODIFY_PUBLICATION" && "attempt" in command.input
      ? command.input.attempt.commandId
      : `${domain.correlationId}:${command.kind === "CREATE_PUBLICATION" ? command.kind : command.input.type}`;
    let sequence = transaction.eventJournal.getLastSequence(current.tenantScopeId, current.aggregateId);
    const committed = transaction.eventJournal.listByAggregate(current.tenantScopeId, current.aggregateId);
    const envelopes = candidates.map((candidate) => {
      const existing = committed.find((event) => event.aggregateVersion === current.aggregateVersion && event.eventType === candidate.eventType && event.commandId === commandId);
      const eventSequence = existing?.eventSequence ?? ++sequence;
      return createPublicationEventEnvelope({
      source: {
        tenantId: current.tenantScopeId,
        aggregateId: current.aggregateId,
        aggregateVersion: current.aggregateVersion,
        classification: governance.classification,
        privacyScope: governance.privacyScope,
        consentOrLegalBasis: governance.consentOrLegalBasis,
        audienceRestriction: governance.audienceRestriction,
        governanceSourceVersion: governance.sourceVersion,
        purpose: governance.purpose,
      },
      eventType: candidate.eventType,
      aggregateId: current.aggregateId,
      aggregateVersion: current.aggregateVersion,
      eventSequence,
      occurredAt: domain.occurredAt,
      recordedAt: existing?.recordedAt ?? this.clock.now(),
      correlationId: domain.correlationId,
      causationId: commandId,
      commandId,
      ...(candidate.attemptId === undefined ? {} : { attemptId: candidate.attemptId }),
      actorReference: domain.actorId,
      tenantId: current.tenantScopeId,
      classification: governance.classification,
      privacyScope: governance.privacyScope,
      consentOrLegalBasis: governance.consentOrLegalBasis,
      audienceRestriction: governance.audienceRestriction,
      governanceSourceVersion: governance.sourceVersion,
      purpose: governance.purpose,
      payload: candidate.payload,
      });
    });
    let results;
    try {
      results = transaction.eventJournal.appendAll(envelopes);
    } catch (error) {
      const first = envelopes[0];
      if (error instanceof PublicationEventError && first !== undefined) throw eventError(error.code, "Canonical Event append was rejected.", eventEvidence(first));
      throw error;
    }
    for (const result of results) {
      transaction.audit.append({
        id: JSON.stringify([current.tenantScopeId, current.aggregateId, "canonical-event", result.event.eventId, result.status]),
        tenantScopeId: current.tenantScopeId,
        aggregateId: current.aggregateId,
        command: "APPEND_CANONICAL_EVENT",
        actorId: domain.actorId,
        timestamp: result.event.recordedAt,
        version: current.aggregateVersion,
        result: "COMPLETED",
        correlationId: result.event.correlationId,
        eventId: result.event.eventId,
        eventType: result.event.eventType,
        eventSequence: result.event.eventSequence,
        safeReasonCode: result.status === "APPENDED" ? "EVENT_APPENDED" : "EVENT_DUPLICATE_IDEMPOTENT",
      });
    }
    return immutableDomain(results.map((result) => result.event));
  }
}

function eventEvidence(event: PublicationEventEnvelope): Readonly<{ eventId: string; eventType: string; eventSequence: number; correlationId: string }> {
  return Object.freeze({ eventId: event.eventId, eventType: event.eventType, eventSequence: event.eventSequence, correlationId: event.correlationId });
}
