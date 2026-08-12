import type { ListingProjectionAuditRecord, ListingProjectionGeneration, ListingProjectionIdentity, ListingProjectionRecord } from "./listing-projection-contracts.js";

export interface ListingProjectionStore {
  getServing(identity: ListingProjectionIdentity): ListingProjectionRecord | undefined;
  getByGeneration(identity: ListingProjectionIdentity, generationId: string): ListingProjectionRecord | undefined;
  save(record: ListingProjectionRecord, expectedRecordVersion: number | undefined): ListingProjectionRecord;
  saveWithAudit(record: ListingProjectionRecord, expectedRecordVersion: number | undefined, auditRecord: ListingProjectionAuditRecord, auditStore: ListingProjectionAuditStore): ListingProjectionRecord;
  listGeneration(tenantId: string, generationId: string): readonly ListingProjectionRecord[];
  createGeneration(generation: ListingProjectionGeneration): ListingProjectionGeneration;
  deleteGeneration(identity: ListingProjectionIdentity, generationId: string): void;
  getGeneration(identity: ListingProjectionIdentity, generationId: string): ListingProjectionGeneration | undefined;
  markGeneration(identity: ListingProjectionIdentity, generationId: string, update: Partial<Pick<ListingProjectionGeneration, "lifecycle" | "complete" | "finalEventSequence" | "sourceAggregateVersion" | "publicationVersion" | "sourceClassification" | "privacyScope" | "purpose" | "consentOrLegalBasis" | "audienceRestriction" | "targetReference" | "channelReference" | "updatedAt">>): ListingProjectionGeneration;
  getServingGeneration(identity: ListingProjectionIdentity): ListingProjectionGeneration | undefined;
  compareAndSwapServingGeneration(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string | undefined): string | undefined;
  validateServingGenerationCutover(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string): void;
  commitServingGenerationCutover(
    identity: ListingProjectionIdentity,
    expectedGenerationId: string | undefined,
    candidateGenerationId: string,
    appendCompletionEvidence: () => void,
    updatedAt: string,
  ): string;
}

export interface ListingProjectionAuditStore {
  prepareAppend?(record: ListingProjectionAuditRecord): Readonly<{
    record: ListingProjectionAuditRecord;
    commit(): ListingProjectionAuditRecord;
  }>;
  prepareAppendAll?(records: readonly ListingProjectionAuditRecord[]): Readonly<{
    records: readonly ListingProjectionAuditRecord[];
    commit(): readonly ListingProjectionAuditRecord[];
  }>;
  append(record: ListingProjectionAuditRecord): ListingProjectionAuditRecord;
  list(identity: ListingProjectionIdentity): readonly ListingProjectionAuditRecord[];
}
