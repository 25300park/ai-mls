import type { PublicationEventEnvelope } from "./publication-event-contracts.js";

export interface PublicationEventAppendResult {
  readonly status: "APPENDED" | "REPLAYED";
  readonly event: PublicationEventEnvelope;
}

export interface PublicationEventJournal {
  prepareAppend?(event: PublicationEventEnvelope): Promise<Readonly<{
    event: PublicationEventEnvelope;
    commit(): Promise<PublicationEventAppendResult>;
  }>>;
  append(event: PublicationEventEnvelope): Promise<PublicationEventAppendResult>;
  appendAll(events: readonly PublicationEventEnvelope[]): Promise<readonly PublicationEventAppendResult[]>;
  findByEventId(tenantId: string, eventId: string): Promise<PublicationEventEnvelope | undefined>;
  listByAggregate(tenantId: string, aggregateId: string): Promise<readonly PublicationEventEnvelope[]>;
  getLastSequence(tenantId: string, aggregateId: string): Promise<number>;
}
