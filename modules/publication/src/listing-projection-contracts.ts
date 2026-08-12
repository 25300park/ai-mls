import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import type { PublicationEventType, PublicationEventPurpose } from "./publication-event-contracts.js";
import type { PublicationLifecycleState, PublicationSuspensionStatus } from "./publication-contracts.js";

export const LISTING_PROJECTION_DEFINITION_VERSION = "v0.1" as const;
export const LISTING_PROJECTION_SCHEMA_VERSION = "v1" as const;
export const LISTING_PROJECTION_TYPE = "PRJ-002" as const;

export type ListingProjectionLifecycle = "BUILDING" | "ACTIVE" | "STALE" | "REBUILDING" | "FAILED" | "ARCHIVED";
export type ListingProjectionEventDisposition = "APPLY" | "NO_STATE_CHANGE" | "CONTROL" | "UNSUPPORTED";

export interface ListingProjectionIdentity {
  readonly tenantId: string;
  readonly publicationId: string;
}

export interface ListingProjectionRecord extends ListingProjectionIdentity {
  readonly projectionId: string;
  readonly projectionType: typeof LISTING_PROJECTION_TYPE;
  readonly lifecycle: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly aggregateVersion: number;
  readonly publicationVersion: number;
  readonly effectiveVersion?: number;
  readonly lastEventId: string;
  readonly lastEventType: PublicationEventType;
  readonly lastEventSequence: number;
  readonly lastEventIntegrity: string;
  readonly eventContractVersion: string;
  readonly targetReference: string;
  readonly channelReference: string;
  readonly sourceClassification: DataClassification;
  readonly privacyScope: string;
  readonly purpose: PublicationEventPurpose;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly projectionDefinitionVersion: string;
  readonly projectionSchemaVersion: string;
  readonly projectionRecordVersion: number;
  readonly generationId: string;
  readonly generatedAt: string;
  readonly updatedAt: string;
  readonly stale: boolean;
  readonly staleReason?: string;
  readonly appliedEvents: readonly Readonly<{ readonly eventId: string; readonly eventSequence: number; readonly integrity: string }>[];
}

export interface ListingProjectionGeneration extends ListingProjectionIdentity {
  readonly projectionType: typeof LISTING_PROJECTION_TYPE;
  readonly tenantId: string;
  readonly generationId: string;
  readonly lifecycle: ListingProjectionLifecycle;
  readonly projectionDefinitionVersion: typeof LISTING_PROJECTION_DEFINITION_VERSION;
  readonly projectionSchemaVersion: typeof LISTING_PROJECTION_SCHEMA_VERSION;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly complete: boolean;
  readonly finalEventSequence?: number;
  readonly sourceAggregateVersion?: number;
  readonly publicationVersion?: number;
  readonly sourceClassification?: DataClassification;
  readonly privacyScope?: string;
  readonly purpose?: PublicationEventPurpose;
  readonly consentOrLegalBasis?: string;
  readonly audienceRestriction?: string;
  readonly targetReference?: string;
  readonly channelReference?: string;
}

export type ListingProjectionAuditOperation =
  | "EVENT_APPLIED" | "DUPLICATE_IGNORED" | "DRIFT_DETECTED" | "PROJECTION_MARKED_STALE"
  | "REBUILD_REQUESTED" | "REBUILD_STARTED" | "REBUILD_FAILED" | "REBUILD_VALIDATED"
  | "GENERATION_CUTOVER" | "GENERATION_ARCHIVED";

export interface ListingProjectionAuditRecord extends ListingProjectionIdentity {
  readonly auditId: string;
  readonly projectionId: string;
  readonly projectionType: typeof LISTING_PROJECTION_TYPE;
  readonly generationId: string;
  readonly eventId?: string;
  readonly eventSequence?: number;
  readonly sourceAggregateVersion?: number;
  readonly publicationVersion?: number;
  readonly projectionRecordVersion?: number;
  readonly operation: ListingProjectionAuditOperation;
  readonly result: "COMPLETED" | "FAILED";
  readonly safeReasonCode: string;
  readonly actorOrServiceReference: string;
  readonly correlationId: string;
  readonly recordedAt: string;
}

export interface ListingProjectionView {
  readonly projectionId: string;
  readonly projectionType: typeof LISTING_PROJECTION_TYPE;
  readonly publicationId: string;
  readonly lifecycle: PublicationLifecycleState;
  readonly suspensionStatus: PublicationSuspensionStatus;
  readonly effectiveVersion?: number;
  readonly targetReference: string;
  readonly channelReference: string;
  readonly sourceClassification: DataClassification;
  readonly privacyScope: string;
  readonly purpose: PublicationEventPurpose;
  readonly consentOrLegalBasis: string;
  readonly audienceRestriction: string;
  readonly sourceAggregateVersion: number;
  readonly publicationVersion: number;
  readonly lastEventSequence: number;
  readonly projectionRecordVersion: number;
  readonly projectionGeneration: string;
  readonly stale: boolean;
  readonly staleReason?: string;
  readonly provenance: Readonly<{ readonly eventId: string; readonly eventType: PublicationEventType; readonly eventContractVersion: string }>;
}

export function immutableProjection<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
