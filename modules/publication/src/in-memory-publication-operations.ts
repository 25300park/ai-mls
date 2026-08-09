import { operationsError } from "./publication-operations-error.js";
import {
  immutableOperations,
  type PublicationOperationalEvidence,
  type PublicationOperationalEvidenceFilter,
  type PublicationOperationalEvidenceStore,
  type PublicationOperationalMetric,
  type PublicationOperationalMetrics,
  type PublicationOperationalMetricsSnapshot,
} from "./publication-operations-contracts.js";

const zeroMetrics: PublicationOperationalMetricsSnapshot = Object.freeze({
  operationsObserved: 0,
  operationsSucceeded: 0,
  operationsFailed: 0,
  retryAttempts: 0,
  retryExhausted: 0,
  journalAppendFailures: 0,
  journalIntegrityFailures: 0,
  projectionApplyFailures: 0,
  projectionDriftDetected: 0,
  projectionRebuildRequested: 0,
  projectionRebuildSucceeded: 0,
  projectionRebuildFailed: 0,
  connectorFailures: 0,
  reconciliationFailures: 0,
});

export class InMemoryPublicationOperationalEvidenceStore implements PublicationOperationalEvidenceStore {
  readonly #records = new Map<string, PublicationOperationalEvidence>();

  public append(evidence: PublicationOperationalEvidence): PublicationOperationalEvidence {
    const existing = this.#records.get(evidence.operationEvidenceId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) === JSON.stringify(evidence)) return immutableOperations(existing);
      throw operationsError("OPERATIONS_RECOVERY_CONFLICT", "Operational evidence identity conflicts with existing evidence.");
    }
    const stored = immutableOperations(evidence);
    this.#records.set(stored.operationEvidenceId, stored);
    return immutableOperations(stored);
  }

  public list(filter: PublicationOperationalEvidenceFilter = {}): readonly PublicationOperationalEvidence[] {
    return immutableOperations([...this.#records.values()].filter((record) =>
      (filter.component === undefined || record.component === filter.component)
      && (filter.sourceReference === undefined || record.sourceReference === filter.sourceReference)));
  }
}

export class InMemoryPublicationOperationalMetrics implements PublicationOperationalMetrics {
  private readonly values: Record<PublicationOperationalMetric, number> = { ...zeroMetrics };

  public increment(metric: PublicationOperationalMetric): void {
    this.values[metric] += 1;
  }

  public snapshot(): PublicationOperationalMetricsSnapshot {
    return immutableOperations(this.values);
  }
}
