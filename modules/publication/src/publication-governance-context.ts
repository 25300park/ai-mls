import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import { immutableDomain, PUBLICATION_CLASSIFICATIONS } from "./publication-contracts.js";
import type { PublicationEventPurpose } from "./publication-event-contracts.js";
import { eventError } from "./publication-event-error.js";

export const PUBLICATION_GOVERNANCE_CONTEXT_STATUSES = ["ACTIVE", "INACTIVE", "EXPIRED"] as const;
export type PublicationGovernanceContextStatus = typeof PUBLICATION_GOVERNANCE_CONTEXT_STATUSES[number];

export interface PublicationGovernanceContext {
  readonly governanceContextId: string;
  readonly publicationId: string;
  readonly tenantId: string;
  readonly classification: DataClassification;
  readonly privacyScope: string;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly purpose: PublicationEventPurpose;
  readonly sourceVersion: number;
  readonly effectiveFrom: string;
  readonly effectiveUntil: string;
  readonly status: PublicationGovernanceContextStatus;
}

export interface PublicationGovernanceContextStore {
  findCurrentByPublicationId(publicationId: string, tenantId: string, purpose: PublicationEventPurpose): PublicationGovernanceContext | undefined;
  findById(governanceContextId: string, tenantId: string): PublicationGovernanceContext | undefined;
}

export class InMemoryPublicationGovernanceContextStore implements PublicationGovernanceContextStore {
  readonly #records: readonly PublicationGovernanceContext[];

  public constructor(seed: readonly PublicationGovernanceContext[] = []) {
    const records = seed.map(validatePublicationGovernanceContext);
    const identities = new Set<string>();
    for (const record of records) {
      const identity = JSON.stringify([record.tenantId, record.governanceContextId]);
      if (identities.has(identity)) throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Governance Context identity is duplicated.");
      identities.add(identity);
    }
    this.#records = immutableDomain(records);
  }

  public findCurrentByPublicationId(publicationId: string, tenantId: string, purpose: PublicationEventPurpose): PublicationGovernanceContext | undefined {
    const records = this.#records
      .filter((record) => record.publicationId === publicationId && record.tenantId === tenantId && record.purpose === purpose)
      .sort((left, right) => right.sourceVersion - left.sourceVersion || right.effectiveFrom.localeCompare(left.effectiveFrom));
    return records[0] === undefined ? undefined : immutableDomain(records[0]);
  }

  public findById(governanceContextId: string, tenantId: string): PublicationGovernanceContext | undefined {
    const record = this.#records.find((candidate) => candidate.governanceContextId === governanceContextId && candidate.tenantId === tenantId);
    return record === undefined ? undefined : immutableDomain(record);
  }
}

export function validatePublicationGovernanceContext(input: PublicationGovernanceContext): PublicationGovernanceContext {
  const values = [input.governanceContextId, input.publicationId, input.tenantId, input.privacyScope, input.consentOrLegalBasis, input.audienceRestriction, input.purpose, input.effectiveFrom, input.effectiveUntil];
  if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Governance Context is incomplete.");
  if (!PUBLICATION_CLASSIFICATIONS.includes(input.classification)) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Governance Context classification is invalid.");
  if (!PUBLICATION_GOVERNANCE_CONTEXT_STATUSES.includes(input.status)) throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Governance Context status is invalid.");
  if (!Number.isSafeInteger(input.sourceVersion) || input.sourceVersion < 1) throw eventError("EVENT_SOURCE_VERSION_STALE", "Governance Context source version is invalid.");
  if (!Number.isFinite(Date.parse(input.effectiveFrom)) || !Number.isFinite(Date.parse(input.effectiveUntil)) || Date.parse(input.effectiveFrom) >= Date.parse(input.effectiveUntil)) {
    throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Governance Context effective period is invalid.");
  }
  if (input.privacyScope.startsWith("SOURCE_CLASSIFICATION:")) throw eventError("EVENT_PRIVACY_VIOLATION", "Synthetic classification-derived privacy evidence is prohibited.");
  return immutableDomain(input);
}
