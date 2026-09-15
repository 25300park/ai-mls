import { isUnsafeSecurityDetailValue, type AuditPrincipal, type DataClassification, type RoleCode } from "../../../packages/security-contracts/src/index.js";
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
  readonly capabilityVersion?: string;
  readonly correlationId?: string;
  readonly initiatingPrincipalEvidenceRef?: string;
  readonly initiatingPrincipalProvenance?: AdvisoryInitiatingPrincipalProvenance;
}

export type AdvisoryInitiatingPrincipalProvenance =
  | Readonly<{ readonly kind: "TRUSTED_SNAPSHOT"; readonly principal: AuditPrincipal }>
  | Readonly<{ readonly kind: "IMMUTABLE_REFERENCE"; readonly principalId: string; readonly evidenceRef: string }>;

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
  readonly capabilityVersion?: string;
  readonly correlationId?: string;
  readonly initiatingPrincipalEvidenceRef?: string;
  readonly initiatingPrincipalProvenance?: AdvisoryInitiatingPrincipalProvenance;
}

export interface AdvisorySnapshotResolver {
  resolve(request: Readonly<Pick<AdvisoryExecutionRequest, "tenantId" | "scopeRef" | "capabilityId" | "inputReference">>): TrustedAdvisorySnapshot | undefined;
}

export interface AdvisoryAdapterIntent {
  readonly capabilityId: AiCapabilityId;
  readonly capabilityVersion?: string;
  readonly correlationId?: string;
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
  recordValidationOutcome?(intent: AdvisoryAdapterIntent, outcome: "SUCCESS" | "ADVISORY_OUTPUT_REJECTED"): void;
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

const roleCodes = new Set<RoleCode>(["COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "RELEASE_OWNER", "SVC", "EXT"]);

export function isSafeAdvisoryText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value
    && !/[\u0000-\u001f\u007f]/u.test(value) && !isUnsafeSecurityDetailValue(value);
}

export function isSafeAdvisoryEvidenceRef(value: unknown): value is string {
  return isSafeAdvisoryText(value) && /^[A-Za-z][A-Za-z0-9._-]{0,63}:[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value);
}

export function isSafeAdvisoryPrincipalProvenance(value: unknown): value is AdvisoryInitiatingPrincipalProvenance {
  if (!plain(value)) return false;
  if (value["kind"] === "IMMUTABLE_REFERENCE") {
    return exactKeys(value, ["kind", "principalId", "evidenceRef"])
      && isSafeAdvisoryText(value["principalId"]) && isSafeAdvisoryEvidenceRef(value["evidenceRef"]);
  }
  if (value["kind"] !== "TRUSTED_SNAPSHOT" || !exactKeys(value, ["kind", "principal"]) || !plain(value["principal"])) return false;
  const principal = value["principal"];
  return exactKeys(principal, ["id", "type", "roles"], ["teamId", "sessionId"])
    && isSafeAdvisoryText(principal["id"])
    && ["HUMAN", "SERVICE"].includes(String(principal["type"]))
    && Array.isArray(principal["roles"]) && principal["roles"].length <= 20 && principal["roles"].every((role) => roleCodes.has(role as RoleCode))
    && (principal["teamId"] === undefined || isSafeAdvisoryText(principal["teamId"]))
    && (principal["sessionId"] === undefined || isSafeAdvisoryText(principal["sessionId"]));
}

function plain(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []): boolean { const allowed = new Set([...required, ...optional]); return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key)); }
