import { immutableDomain, type PublicationIdentity } from "./publication-contracts.js";
import type { PublicationConnectorDispatchResult } from "./publication-service.js";

export interface PublicationConnectorDispatchEvidence extends PublicationIdentity {
  readonly commandId: string;
  readonly attemptId: string;
  readonly dispatchFingerprint: string;
  readonly result: PublicationConnectorDispatchResult;
}

export interface PublicationConnectorDispatchEvidenceStore {
  find(identity: PublicationIdentity, commandId: string): PublicationConnectorDispatchEvidence | undefined;
  record(evidence: PublicationConnectorDispatchEvidence): PublicationConnectorDispatchEvidence;
}

export class InMemoryPublicationConnectorDispatchEvidenceStore implements PublicationConnectorDispatchEvidenceStore {
  readonly #records = new Map<string, PublicationConnectorDispatchEvidence>();

  public find(identity: PublicationIdentity, commandId: string): PublicationConnectorDispatchEvidence | undefined {
    const found = this.#records.get(key(identity, commandId));
    return found === undefined ? undefined : immutableDomain(found);
  }

  public record(evidence: PublicationConnectorDispatchEvidence): PublicationConnectorDispatchEvidence {
    const evidenceKey = key(evidence, evidence.commandId);
    const existing = this.#records.get(evidenceKey);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(evidence)) throw new Error("CONNECTOR_DISPATCH_EVIDENCE_CONFLICT");
    if (existing !== undefined) return immutableDomain(existing);
    const stored = immutableDomain(evidence);
    this.#records.set(evidenceKey, stored);
    return immutableDomain(stored);
  }
}

function key(identity: PublicationIdentity, commandId: string): string {
  return JSON.stringify([identity.tenantScopeId, identity.publicationId, commandId]);
}
