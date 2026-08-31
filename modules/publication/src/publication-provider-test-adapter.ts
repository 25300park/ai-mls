import { createHash } from "node:crypto";
import type {
  PublicationConnectorDispatcher,
  PublicationConnectorDispatchInput,
  PublicationConnectorDispatchResult,
  PublicationConnectorOutcome,
} from "./publication-service.js";

/** No-network fixture adapter. Production composition rejects all dispatcher injection. */
export class DeterministicPublicationConnectorTestAdapter implements PublicationConnectorDispatcher {
  readonly #fingerprints = new Map<string, string>();
  readonly #outcome: PublicationConnectorOutcome;

  public constructor(outcome: PublicationConnectorOutcome) {
    this.#outcome = outcome;
  }

  public dispatch(input: PublicationConnectorDispatchInput): PublicationConnectorDispatchResult {
    const fingerprint = createHash("sha256").update(JSON.stringify([
      input.publicationId, input.tenantScopeId, input.commandId, input.attemptId,
      input.targetId, input.targetVersion, input.channelId, input.channelPolicyVersion,
      input.representationId, input.representationVersion, input.representationChecksum,
      input.approvalDecisionReference,
    ])).digest("hex");
    const expectedKey = `publication:${input.tenantScopeId}:${input.publicationId}:${input.commandId}:${input.attemptId}`;
    const previous = this.#fingerprints.get(expectedKey);
    if (input.providerIdempotencyKey !== expectedKey || (previous !== undefined && previous !== fingerprint)) {
      return Object.freeze({ outcome: "UNKNOWN", evidenceRefs: Object.freeze([`test-provider:${fingerprint}:idempotency-conflict`]) });
    }
    this.#fingerprints.set(expectedKey, fingerprint);
    const outcome = this.#outcome === "CONFIRMED" || this.#outcome === "REJECTED" ? this.#outcome : "UNKNOWN";
    return Object.freeze({
      outcome,
      evidenceRefs: Object.freeze([`test-provider:${fingerprint}:${outcome.toLowerCase()}`]),
      ...(outcome === "CONFIRMED" ? { externalObjectReference: `test-external:${fingerprint}` } : {}),
    });
  }
}
