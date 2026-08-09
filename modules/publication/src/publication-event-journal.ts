import type { PublicationEventEnvelope } from "./publication-event-contracts.js";

export interface PublicationEventAppendResult {
  readonly status: "APPENDED" | "REPLAYED";
  readonly event: PublicationEventEnvelope;
}

export interface PublicationEventJournal {
  append(event: PublicationEventEnvelope): PublicationEventAppendResult;
  appendAll(events: readonly PublicationEventEnvelope[]): readonly PublicationEventAppendResult[];
  findByEventId(tenantId: string, eventId: string): PublicationEventEnvelope | undefined;
  listByAggregate(tenantId: string, aggregateId: string): readonly PublicationEventEnvelope[];
  getLastSequence(tenantId: string, aggregateId: string): number;
}
