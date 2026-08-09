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
  markGeneration(identity: ListingProjectionIdentity, generationId: string, update: Partial<Pick<ListingProjectionGeneration, "lifecycle" | "complete" | "finalEventSequence" | "sourceAggregateVersion" | "publicationVersion" | "sourceClassification" | "privacyScope" | "purpose" | "targetReference" | "channelReference" | "updatedAt">>): ListingProjectionGeneration;
  getServingGeneration(identity: ListingProjectionIdentity): ListingProjectionGeneration | undefined;
  compareAndSwapServingGeneration(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string | undefined): string | undefined;
}

export interface ListingProjectionAuditStore {
  append(record: ListingProjectionAuditRecord): ListingProjectionAuditRecord;
  list(identity: ListingProjectionIdentity): readonly ListingProjectionAuditRecord[];
}
