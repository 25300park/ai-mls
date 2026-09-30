import { immutableDomain } from "./publication-contracts.js";
import { samePublicationEvent, validatePublicationEventEnvelope, type PublicationEventEnvelope } from "./publication-event-contracts.js";
import { eventError } from "./publication-event-error.js";
import type { PublicationEventAppendResult, PublicationEventJournal } from "./publication-event-journal.js";
import { InMemoryPersistenceState } from "./in-memory-persistence-state.js";

export class InMemoryPublicationEventJournal implements PublicationEventJournal {
  public constructor(
    private readonly state: InMemoryPersistenceState = new InMemoryPersistenceState(),
    private readonly scope?: { readonly publicationId: string; readonly tenantScopeId: string },
    private readonly assertUsable: () => void = () => undefined,
  ) {}

  public async append(event: PublicationEventEnvelope): Promise<PublicationEventAppendResult> {
    return (await this.appendAll([event]))[0]!;
  }

  public async prepareAppend(event: PublicationEventEnvelope): Promise<Readonly<{ event: PublicationEventEnvelope; commit(): Promise<PublicationEventAppendResult> }>> {
    await Promise.resolve();
    this.assertUsable();
    const staged = structuredClone(this.state.events);
    const result = this.appendTo(staged, event);
    let committed = false;
    return Object.freeze({
      event: immutableDomain(result.event),
      commit: async () => {
        await Promise.resolve();
        if (!committed) {
          this.state.events = staged;
          if (result.status === "APPENDED") this.state.markScopeChanged(result.event.tenantId, result.event.aggregateId);
          committed = true;
        }
        return immutableDomain(result);
      },
    });
  }

  public async appendAll(events: readonly PublicationEventEnvelope[]): Promise<readonly PublicationEventAppendResult[]> {
    await Promise.resolve();
    this.assertUsable();
    const staged = structuredClone(this.state.events);
    const results: PublicationEventAppendResult[] = [];
    for (const event of events) results.push(this.appendTo(staged, event));
    this.state.events = staged;
    for (const result of results) if (result.status === "APPENDED") this.state.markScopeChanged(result.event.tenantId, result.event.aggregateId);
    return immutableDomain(results);
  }

  public async findByEventId(tenantId: string, eventId: string): Promise<PublicationEventEnvelope | undefined> {
    await Promise.resolve();
    this.assertUsable();
    const event = this.state.events.get(eventKey(tenantId, eventId));
    if (event !== undefined) this.assertScope(event.tenantId, event.aggregateId);
    return event === undefined ? undefined : immutableDomain(event);
  }

  public async listByAggregate(tenantId: string, aggregateId: string): Promise<readonly PublicationEventEnvelope[]> {
    await Promise.resolve();
    this.assertUsable();
    this.assertScope(tenantId, aggregateId);
    return immutableDomain([...this.state.events.values()]
      .filter((event) => event.tenantId === tenantId && event.aggregateId === aggregateId)
      .sort((left, right) => left.eventSequence - right.eventSequence));
  }

  public async getLastSequence(tenantId: string, aggregateId: string): Promise<number> {
    return (await this.listByAggregate(tenantId, aggregateId)).at(-1)?.eventSequence ?? 0;
  }

  private appendTo(target: Map<string, PublicationEventEnvelope>, event: PublicationEventEnvelope): PublicationEventAppendResult {
    this.assertScope(event.tenantId, event.aggregateId);
    validatePublicationEventEnvelope(event);
    const key = eventKey(event.tenantId, event.eventId);
    const existing = target.get(key);
    if (existing !== undefined) {
      if (!samePublicationEvent(existing, event)) throw eventError("EVENT_IDENTITY_CONFLICT", "Canonical Event identity conflicts with an existing occurrence.");
      return immutableDomain({ status: "REPLAYED" as const, event: existing });
    }
    const stream = [...target.values()].filter((item) => item.tenantId === event.tenantId && item.aggregateId === event.aggregateId);
    const last = stream.sort((left, right) => left.eventSequence - right.eventSequence).at(-1);
    const expected = (last?.eventSequence ?? 0) + 1;
    if (event.eventSequence < expected) throw eventError("EVENT_OUT_OF_ORDER", "Canonical Event is out of aggregate-local order.");
    if (event.eventSequence > expected) throw eventError("EVENT_SEQUENCE_GAP", "Canonical Event sequence contains a gap.");
    if (last !== undefined && event.aggregateVersion < last.aggregateVersion) throw eventError("EVENT_AGGREGATE_VERSION_MISMATCH", "Canonical Event Aggregate version is stale.");
    const snapshot = immutableDomain(event);
    target.set(key, snapshot);
    return immutableDomain({ status: "APPENDED" as const, event: snapshot });
  }

  private assertScope(tenantId: string, aggregateId: string): void {
    if (this.scope !== undefined && (this.scope.tenantScopeId !== tenantId || this.scope.publicationId !== aggregateId)) throw eventError("EVENT_TENANT_MISMATCH", "Event operation is outside the transaction scope.");
  }
}

function eventKey(tenantId: string, eventId: string): string { return JSON.stringify([tenantId, eventId]); }
