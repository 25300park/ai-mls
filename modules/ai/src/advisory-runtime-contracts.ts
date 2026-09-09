import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import type { AdvisoryResultEnvelope, AdvisoryValidationDecision, AiCapabilityId, AiSchemaId, EntityReference } from "./advisory-ai-service.js";

export type AdvisoryPromptStatus = "ACTIVE" | "RETIRED";

export interface AdvisoryPromptRecord {
  readonly promptId: string;
  readonly promptVersion: string;
  readonly capabilityId: AiCapabilityId;
  readonly schemaId: AiSchemaId;
  readonly contentFingerprint: string;
  readonly status: AdvisoryPromptStatus;
  readonly createdAt: string;
}

export interface TrustedAdvisorySnapshot {
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly subjectRef: EntityReference;
  readonly provenance: readonly EntityReference[];
  readonly inputClassifications: readonly DataClassification[];
  readonly inputFingerprint: string;
  readonly evidenceFingerprint: string;
}

export interface AcceptedAdvisoryRecord {
  readonly advisoryId: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly capabilityId: AiCapabilityId;
  readonly schemaId: AiSchemaId;
  readonly inputFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly inputClassifications: readonly DataClassification[];
  readonly promptId: string;
  readonly promptVersion: string;
  readonly adapterVersion: string;
  readonly executionFingerprint: string;
  readonly envelope: AdvisoryResultEnvelope;
  readonly validationResult: AdvisoryValidationDecision;
  readonly generatedAt: string;
  readonly reviewRequired: boolean;
  readonly reviewEvidenceRef?: string;
  readonly reviewedAt?: string;
  readonly reviewerRef?: string;
  readonly authority: "ADVISORY";
}

export interface AdvisoryIdempotencyBinding {
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly idempotencyKey: string;
  readonly executionFingerprint: string;
  readonly advisoryId: string;
}

export type AdvisoryPersistenceErrorCode =
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_UNAVAILABLE"
  | "PROMPT_IDENTITY_CONFLICT"
  | "PROMPT_SCHEMA_MISMATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "ADVISORY_IDENTITY_CONFLICT";

export class AdvisoryPersistenceError extends Error {
  public constructor(public readonly code: AdvisoryPersistenceErrorCode, message: string) {
    super(message);
    this.name = "AdvisoryPersistenceError";
  }
}

export interface AdvisoryPersistence {
  registerPrompt(record: AdvisoryPromptRecord): AdvisoryPromptRecord;
  findPrompt(promptId: string, promptVersion: string): AdvisoryPromptRecord | undefined;
  findReplay(tenantId: string, scopeRef: string, idempotencyKey: string, executionFingerprint: string): AcceptedAdvisoryRecord | undefined;
  findAdvisory(tenantId: string, scopeRef: string, advisoryId: string): AcceptedAdvisoryRecord | undefined;
  recordAccepted(record: AcceptedAdvisoryRecord, idempotencyKey: string): AcceptedAdvisoryRecord;
  close(): void;
}

export interface AdvisoryExecutionRequest {
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly capabilityId: AiCapabilityId;
  readonly schemaId: AiSchemaId;
  readonly inputReference: EntityReference;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly idempotencyKey: string;
}

export interface AdvisorySnapshotResolver {
  resolve(request: Readonly<Pick<AdvisoryExecutionRequest, "tenantId" | "scopeRef" | "capabilityId" | "inputReference">>): TrustedAdvisorySnapshot | undefined;
}

export interface AdvisoryAdapterIntent {
  readonly capabilityId: AiCapabilityId;
  readonly schemaId: AiSchemaId;
  readonly subjectRef: EntityReference;
  readonly provenance: readonly EntityReference[];
  readonly classification: DataClassification;
  readonly inputFingerprint: string;
  readonly evidenceFingerprint: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptFingerprint: string;
  readonly executionFingerprint: string;
}

export interface AdvisoryAdapter {
  readonly adapterVersion: string;
  generate(intent: AdvisoryAdapterIntent): unknown;
}

export type AdvisoryRuntimeErrorCode =
  | "ADVISORY_INPUT_UNAVAILABLE"
  | "PROMPT_NOT_ACTIVE"
  | "SCHEMA_CAPABILITY_MISMATCH"
  | "ADVISORY_OUTPUT_REJECTED"
  | "ADVISORY_UNAVAILABLE";

export class AdvisoryRuntimeError extends Error {
  public constructor(public readonly code: AdvisoryRuntimeErrorCode, message: string) {
    super(message);
    this.name = "AdvisoryRuntimeError";
  }
}
