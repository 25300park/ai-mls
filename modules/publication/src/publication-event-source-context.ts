import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import {
  immutableDomain,
  PUBLICATION_CLASSIFICATIONS,
  type PublicationBinding,
  type PublicationSnapshot,
} from "./publication-contracts.js";
import type { PublicationEventEnvelope, PublicationEventPurpose } from "./publication-event-contracts.js";
import { eventError } from "./publication-event-error.js";
import type { PublicationClock } from "./publication-clock.js";
import { validatePublicationGovernanceContext, type PublicationGovernanceContextStore } from "./publication-governance-context.js";

export interface PublicationEventSourceContextRequest {
  readonly publicationId: string;
  readonly tenantId: string;
  readonly classification: DataClassification;
  readonly binding?: PublicationBinding;
  readonly purpose: PublicationEventPurpose;
  readonly sourceVersion: number;
}

export interface PublicationEventSourceContext {
  readonly publicationId: string;
  readonly tenantId: string;
  readonly classification: DataClassification;
  readonly privacyScope: string;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly purpose: PublicationEventPurpose;
  readonly sourceVersion: number;
}

export interface PublicationEventSourceContextResolver {
  resolve(request: PublicationEventSourceContextRequest): PublicationEventSourceContext | undefined;
}

export class StoredPublicationEventSourceContextResolver implements PublicationEventSourceContextResolver {
  public constructor(
    private readonly store: PublicationGovernanceContextStore,
    private readonly clock: PublicationClock,
  ) {}

  public resolve(request: PublicationEventSourceContextRequest): PublicationEventSourceContext | undefined {
    const record = this.store.findCurrentByPublicationId(request.publicationId, request.tenantId, request.purpose);
    if (record === undefined) return undefined;
    const current = validatePublicationGovernanceContext(record);
    const now = Date.parse(this.clock.now());
    if (current.status !== "ACTIVE" || !Number.isFinite(now) || now < Date.parse(current.effectiveFrom) || now >= Date.parse(current.effectiveUntil)) {
      throw eventError("EVENT_SOURCE_CONTEXT_UNAVAILABLE", "Canonical Event source governance context is not currently effective.");
    }
    if (current.publicationId !== request.publicationId || current.tenantId !== request.tenantId) throw eventError("EVENT_TENANT_MISMATCH", "Governance Context identity does not match the requested Publication.");
    if (current.sourceVersion !== request.sourceVersion) throw eventError("EVENT_SOURCE_VERSION_STALE", "Governance Context source version is stale.");
    if (current.purpose !== request.purpose) throw eventError("EVENT_PURPOSE_VIOLATION", "Governance Context purpose does not match the approved Event operation.");
    if (classificationRank(current.classification) < classificationRank(request.classification)) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Governance Context classification would downgrade the Publication restriction.");
    return immutableDomain({
      publicationId: current.publicationId,
      tenantId: current.tenantId,
      classification: current.classification,
      privacyScope: current.privacyScope,
      consentOrLegalBasis: current.consentOrLegalBasis,
      audienceRestriction: current.audienceRestriction,
      purpose: current.purpose,
      sourceVersion: current.sourceVersion,
    });
  }
}

export function resolvePublicationEventSourceContext(
  resolver: PublicationEventSourceContextResolver | undefined,
  snapshot: PublicationSnapshot,
  purpose: PublicationEventPurpose,
): PublicationEventSourceContext {
  const request = immutableDomain({
    publicationId: snapshot.publicationId,
    tenantId: snapshot.tenantScopeId,
    classification: snapshot.classification,
    purpose,
    sourceVersion: snapshot.binding.representationVersion,
  });
  const resolved = resolver?.resolve(request);
  if (resolved === undefined) throw eventError("EVENT_SOURCE_CONTEXT_UNAVAILABLE", "Canonical Event source governance context is unavailable.");
  const text = [resolved.publicationId, resolved.tenantId, resolved.privacyScope, resolved.consentOrLegalBasis, resolved.audienceRestriction, resolved.purpose];
  if (text.some((value) => typeof value !== "string" || value.trim().length === 0)) {
    throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Canonical Event source governance context is incomplete.");
  }
  if (resolved.privacyScope.startsWith("SOURCE_CLASSIFICATION:")) {
    throw eventError("EVENT_PRIVACY_VIOLATION", "Synthetic classification-derived privacy evidence is prohibited.");
  }
  if (resolved.publicationId !== snapshot.publicationId || resolved.tenantId !== snapshot.tenantScopeId) {
    throw eventError("EVENT_TENANT_MISMATCH", "Canonical Event source governance identity does not match the Aggregate.");
  }
  if (resolved.sourceVersion !== snapshot.binding.representationVersion) {
    throw eventError("EVENT_SOURCE_VERSION_STALE", "Canonical Event source governance context is stale.");
  }
  if (resolved.purpose !== purpose) throw eventError("EVENT_PURPOSE_VIOLATION", "Canonical Event source purpose does not match the approved operation.");
  if (!PUBLICATION_CLASSIFICATIONS.includes(resolved.classification)
    || classificationRank(resolved.classification) < classificationRank(snapshot.classification)) {
    throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Canonical Event source classification would downgrade the Aggregate restriction.");
  }
  return immutableDomain(resolved);
}

export function resolvePublicationTechnicalEventSourceContext(
  resolver: PublicationEventSourceContextResolver | undefined,
  sourceEvent: PublicationEventEnvelope,
): PublicationEventSourceContext {
  const resolved = resolver?.resolve(immutableDomain({
    publicationId: sourceEvent.aggregateId,
    tenantId: sourceEvent.tenantId,
    classification: sourceEvent.classification,
    purpose: "RECOVERY_VALIDATION" as const,
    sourceVersion: sourceEvent.governanceSourceVersion,
  }));
  if (resolved === undefined) throw eventError("EVENT_SOURCE_CONTEXT_UNAVAILABLE", "Canonical technical Event governance context is unavailable.");
  const text = [resolved.publicationId, resolved.tenantId, resolved.privacyScope, resolved.consentOrLegalBasis, resolved.audienceRestriction, resolved.purpose];
  if (text.some((value) => value.trim().length === 0)) throw eventError("EVENT_SOURCE_CONTEXT_INVALID", "Canonical technical Event governance context is incomplete.");
  if (resolved.publicationId !== sourceEvent.aggregateId || resolved.tenantId !== sourceEvent.tenantId) throw eventError("EVENT_TENANT_MISMATCH", "Canonical technical Event governance identity does not match its source Event.");
  if (resolved.sourceVersion !== sourceEvent.governanceSourceVersion) throw eventError("EVENT_SOURCE_VERSION_STALE", "Canonical technical Event governance context is stale.");
  if (resolved.purpose !== "RECOVERY_VALIDATION") throw eventError("EVENT_PURPOSE_VIOLATION", "Canonical technical Event requires recovery-validation purpose.");
  if (classificationRank(resolved.classification) < classificationRank(sourceEvent.classification)) throw eventError("EVENT_CLASSIFICATION_VIOLATION", "Canonical technical Event governance context would downgrade classification.");
  if (resolved.privacyScope !== sourceEvent.privacyScope || resolved.consentOrLegalBasis !== sourceEvent.consentOrLegalBasis || resolved.audienceRestriction !== sourceEvent.audienceRestriction) {
    throw eventError("EVENT_PRIVACY_VIOLATION", "Canonical technical Event governance context must preserve source restrictions exactly.");
  }
  return immutableDomain(resolved);
}

function classificationRank(classification: DataClassification): number {
  return PUBLICATION_CLASSIFICATIONS.indexOf(classification);
}
