import { LISTING_PROJECTION_DEFINITION_VERSION, LISTING_PROJECTION_SCHEMA_VERSION, immutableProjection, type ListingProjectionAuditRecord, type ListingProjectionGeneration, type ListingProjectionIdentity, type ListingProjectionRecord } from "./listing-projection-contracts.js";
import { projectionError } from "./listing-projection-error.js";
import type { ListingProjectionAuditStore, ListingProjectionStore } from "./listing-projection-store.js";

export class InMemoryListingProjectionStore implements ListingProjectionStore {
  private readonly records = new Map<string, ListingProjectionRecord>();
  private readonly generations = new Map<string, ListingProjectionGeneration>();
  private readonly serving = new Map<string, string>();

  public getServing(identity: ListingProjectionIdentity): ListingProjectionRecord | undefined {
    const generationId = this.serving.get(servingKey(identity));
    return generationId === undefined ? undefined : this.getByGeneration(identity, generationId);
  }

  public getByGeneration(identity: ListingProjectionIdentity, generationId: string): ListingProjectionRecord | undefined {
    this.assertGenerationIdentity(identity, generationId);
    const record = this.records.get(recordKey(identity.tenantId, generationId, identity.publicationId));
    return record === undefined ? undefined : immutableProjection(record);
  }

  public save(record: ListingProjectionRecord, expectedRecordVersion: number | undefined): ListingProjectionRecord {
    this.assertGenerationIdentity(record, record.generationId);
    const key = recordKey(record.tenantId, record.generationId, record.publicationId);
    const existing = this.records.get(key);
    const actualVersion = existing?.projectionRecordVersion;
    if (actualVersion !== expectedRecordVersion) throw projectionError("PROJECTION_RECORD_VERSION_CONFLICT", "Projection record version conflicts with the stored record.");
    if (record.projectionRecordVersion !== (expectedRecordVersion ?? 0) + 1) throw projectionError("PROJECTION_RECORD_VERSION_CONFLICT", "Projection record version does not advance exactly once.");
    const snapshot = immutableProjection(record);
    this.records.set(key, snapshot);
    return immutableProjection(snapshot);
  }

  public saveWithAudit(record: ListingProjectionRecord, expectedRecordVersion: number | undefined, auditRecord: ListingProjectionAuditRecord, auditStore: ListingProjectionAuditStore): ListingProjectionRecord {
    const key = recordKey(record.tenantId, record.generationId, record.publicationId);
    const prior = this.records.get(key);
    const saved = this.save(record, expectedRecordVersion);
    try {
      auditStore.append(auditRecord);
      return saved;
    } catch (error) {
      if (prior === undefined) this.records.delete(key);
      else this.records.set(key, prior);
      throw error;
    }
  }

  public listGeneration(tenantId: string, generationId: string): readonly ListingProjectionRecord[] {
    this.assertGenerationTenant(tenantId, generationId);
    return immutableProjection([...this.records.values()]
      .filter((record) => record.tenantId === tenantId && record.generationId === generationId)
      .sort((left, right) => left.publicationId.localeCompare(right.publicationId)));
  }

  public createGeneration(generation: ListingProjectionGeneration): ListingProjectionGeneration {
    const key = generationKey(generation.tenantId, generation.generationId);
    if (this.generations.has(key)) throw projectionError("PROJECTION_GENERATION_CONFLICT", "Projection generation already exists.");
    const snapshot = immutableProjection(generation);
    this.generations.set(key, snapshot);
    return immutableProjection(snapshot);
  }

  public deleteGeneration(identity: ListingProjectionIdentity, generationId: string): void {
    this.assertGenerationIdentity(identity, generationId);
    if (this.serving.get(servingKey(identity)) === generationId) throw projectionError("PROJECTION_GENERATION_CONFLICT", "A serving Projection generation cannot be deleted.");
    if (this.records.has(recordKey(identity.tenantId, generationId, identity.publicationId))) throw projectionError("PROJECTION_GENERATION_CONFLICT", "A populated Projection generation cannot be deleted.");
    this.generations.delete(generationKey(identity.tenantId, generationId));
  }

  public getGeneration(identity: ListingProjectionIdentity, generationId: string): ListingProjectionGeneration | undefined {
    this.assertGenerationIdentity(identity, generationId, false);
    const generation = this.generations.get(generationKey(identity.tenantId, generationId));
    return generation === undefined ? undefined : immutableProjection(generation);
  }

  public markGeneration(identity: ListingProjectionIdentity, generationId: string, update: Partial<Pick<ListingProjectionGeneration, "lifecycle" | "complete" | "finalEventSequence" | "sourceAggregateVersion" | "publicationVersion" | "sourceClassification" | "privacyScope" | "purpose" | "consentOrLegalBasis" | "audienceRestriction" | "targetReference" | "channelReference" | "updatedAt">>): ListingProjectionGeneration {
    const existing = this.generations.get(generationKey(identity.tenantId, generationId));
    if (existing === undefined) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection generation is unavailable.");
    if (existing.publicationId !== identity.publicationId) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection generation belongs to another Publication.");
    const changed = immutableProjection({ ...existing, ...update });
    this.generations.set(generationKey(identity.tenantId, generationId), changed);
    return immutableProjection(changed);
  }

  public getServingGeneration(identity: ListingProjectionIdentity): ListingProjectionGeneration | undefined {
    const generationId = this.serving.get(servingKey(identity));
    return generationId === undefined ? undefined : this.getGeneration(identity, generationId);
  }

  public compareAndSwapServingGeneration(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string | undefined): string | undefined {
    const key = servingKey(identity);
    const current = this.serving.get(key);
    if (candidateGenerationId === undefined) {
      if (current !== expectedGenerationId) throw projectionError("PROJECTION_GENERATION_CONFLICT", "Serving Projection generation changed concurrently.");
      this.serving.delete(key);
      return undefined;
    }
    this.validateCutoverCandidate(identity, expectedGenerationId, candidateGenerationId);
    if (current === candidateGenerationId) return candidateGenerationId;
    this.serving.set(key, candidateGenerationId);
    return candidateGenerationId;
  }

  public commitServingGenerationCutover(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string, appendCompletionEvidence: () => void, updatedAt: string): string {
    const key = servingKey(identity);
    const current = this.serving.get(key);
    this.validateCutoverCandidate(identity, expectedGenerationId, candidateGenerationId);
    if (current === candidateGenerationId) return candidateGenerationId;
    // Synchronous evidence append occurs only after every CAS/candidate check and
    // before the infallible in-memory pointer update. If evidence fails, neither
    // the serving pointer nor the prior generation lifecycle is changed.
    appendCompletionEvidence();
    if (expectedGenerationId !== undefined && expectedGenerationId !== candidateGenerationId) {
      const priorKey = generationKey(identity.tenantId, expectedGenerationId);
      const prior = this.generations.get(priorKey);
      if (prior !== undefined) this.generations.set(priorKey, immutableProjection({ ...prior, lifecycle: "ARCHIVED", updatedAt }));
    }
    this.serving.set(key, candidateGenerationId);
    return candidateGenerationId;
  }

  public validateServingGenerationCutover(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string): void {
    this.validateCutoverCandidate(identity, expectedGenerationId, candidateGenerationId);
  }

  private validateCutoverCandidate(identity: ListingProjectionIdentity, expectedGenerationId: string | undefined, candidateGenerationId: string): void {
    const current = this.serving.get(servingKey(identity));
    const candidate = this.generations.get(generationKey(identity.tenantId, candidateGenerationId));
    if (candidate?.lifecycle !== "ACTIVE" || !candidate.complete) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Candidate Projection generation is incomplete.");
    if (candidate.publicationId !== identity.publicationId) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Candidate Projection generation belongs to another Publication.");
    const record = this.records.get(recordKey(identity.tenantId, candidateGenerationId, identity.publicationId));
    if (record === undefined
      || candidate.finalEventSequence !== record.lastEventSequence
      || candidate.sourceAggregateVersion !== record.aggregateVersion
      || candidate.publicationVersion !== record.publicationVersion
      || candidate.projectionDefinitionVersion !== LISTING_PROJECTION_DEFINITION_VERSION
      || candidate.projectionSchemaVersion !== LISTING_PROJECTION_SCHEMA_VERSION
      || record.projectionDefinitionVersion !== LISTING_PROJECTION_DEFINITION_VERSION
      || record.projectionSchemaVersion !== LISTING_PROJECTION_SCHEMA_VERSION
      || record.stale
      || candidate.sourceClassification !== record.sourceClassification
      || candidate.privacyScope !== record.privacyScope
      || candidate.purpose !== record.purpose
      || candidate.consentOrLegalBasis !== record.consentOrLegalBasis
      || candidate.audienceRestriction !== record.audienceRestriction
      || candidate.targetReference !== record.targetReference
      || candidate.channelReference !== record.channelReference) {
      throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Candidate Projection generation does not match validated source progress.");
    }
    if (current === candidateGenerationId) return;
    if (current !== expectedGenerationId) throw projectionError("PROJECTION_GENERATION_CONFLICT", "Serving Projection generation changed concurrently.");
  }

  private assertGenerationTenant(tenantId: string, generationId: string, required = true): void {
    const exact = this.generations.has(generationKey(tenantId, generationId));
    if (exact) return;
    if ([...this.generations.values()].some((generation) => generation.generationId === generationId)) throw projectionError("PROJECTION_TENANT_MISMATCH", "Projection generation belongs to another tenant.");
    if (required) throw projectionError("PROJECTION_GENERATION_INCOMPLETE", "Projection generation is unavailable.");
  }

  private assertGenerationIdentity(identity: ListingProjectionIdentity, generationId: string, required = true): void {
    this.assertGenerationTenant(identity.tenantId, generationId, required);
    const generation = this.generations.get(generationKey(identity.tenantId, generationId));
    if (generation !== undefined && generation.publicationId !== identity.publicationId) throw projectionError("PROJECTION_PROVENANCE_CONFLICT", "Projection generation belongs to another Publication.");
  }
}

export class InMemoryListingProjectionAuditStore implements ListingProjectionAuditStore {
  private readonly records = new Map<string, ListingProjectionAuditRecord>();

  public append(record: ListingProjectionAuditRecord): ListingProjectionAuditRecord {
    const existing = this.records.get(record.auditId);
    if (existing !== undefined) {
      if (JSON.stringify(existing) === JSON.stringify(record)) return immutableProjection(existing);
      throw projectionError("PROJECTION_EVENT_DUPLICATE_CONFLICT", "Projection audit identity already exists.");
    }
    const snapshot = immutableProjection(record);
    this.records.set(record.auditId, snapshot);
    return immutableProjection(snapshot);
  }

  public prepareAppend(record: ListingProjectionAuditRecord): Readonly<{ record: ListingProjectionAuditRecord; commit(): ListingProjectionAuditRecord }> {
    const prepared = this.prepareAppendAll([record]);
    return Object.freeze({ record: prepared.records[0]!, commit: () => prepared.commit()[0]! });
  }

  public prepareAppendAll(records: readonly ListingProjectionAuditRecord[]): Readonly<{ records: readonly ListingProjectionAuditRecord[]; commit(): readonly ListingProjectionAuditRecord[] }> {
    const staged = structuredClone(this.records);
    const snapshots: ListingProjectionAuditRecord[] = [];
    for (const record of records) {
      const existing = staged.get(record.auditId);
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(record)) {
        throw projectionError("PROJECTION_EVENT_DUPLICATE_CONFLICT", "Projection audit identity already exists.");
      }
      const snapshot = immutableProjection(existing ?? record);
      staged.set(record.auditId, snapshot);
      snapshots.push(snapshot);
    }
    let committed = false;
    return Object.freeze({
      records: immutableProjection(snapshots),
      commit: () => {
        if (!committed) {
          this.records.clear();
          for (const [key, value] of staged) this.records.set(key, value);
          committed = true;
        }
        return immutableProjection(snapshots);
      },
    });
  }

  public list(identity: ListingProjectionIdentity): readonly ListingProjectionAuditRecord[] {
    return immutableProjection([...this.records.values()].filter((record) => record.tenantId === identity.tenantId && record.publicationId === identity.publicationId));
  }
}

function generationKey(tenantId: string, generationId: string): string { return JSON.stringify([tenantId, generationId]); }
function recordKey(tenantId: string, generationId: string, publicationId: string): string { return JSON.stringify([tenantId, generationId, publicationId]); }
function servingKey(identity: ListingProjectionIdentity): string { return JSON.stringify([identity.tenantId, identity.publicationId]); }
