import { createHash } from "node:crypto";

import {
  immutableOperationalEvidence,
  validateOperationalReference,
  validateOperationalResourceReference,
} from "./operational-telemetry-contracts.js";
import { deriveEvidenceFreshness, type EvidenceFreshness, type OperationalReadiness } from "./operational-status-projection.js";

export type OperationalReadinessType = "BACKUP" | "DEPLOYMENT" | "ROLLBACK";
export type OperationalReadinessEvidenceOutcome = "SATISFIED" | "BLOCKING" | "DEGRADED";
export type OperationalReadinessEvidenceType =
  | "BACKUP_CONFIGURATION" | "BACKUP_EXECUTION" | "BACKUP_INTEGRITY" | "RESTORE_VALIDATION"
  | "DEPLOYMENT_CHECKLIST" | "RELEASE_VERIFICATION" | "CANDIDATE_VERIFICATION"
  | "ARCHITECTURE_CHECKSUM" | "DEPENDENCY_AUDIT" | "SECURITY_SCAN"
  | "BACKUP_READINESS" | "ROLLBACK_READINESS" | "MONITORING_READINESS" | "PRODUCTION_CONFIGURATION"
  | "ROLLBACK_PROCEDURE" | "ROLLBACK_TARGET" | "ROLLBACK_COMPATIBILITY" | "ROLLBACK_CHECKLIST"
  | "BACKUP_RECOVERY_READINESS" | "POST_ROLLBACK_VALIDATION" | "F19_RECOVERY_REFERENCE";
export type OperationalReadinessSourceClassification =
  | "BACKUP_SYSTEM" | "RECOVERY_VALIDATOR" | "RELEASE_GOVERNANCE" | "BUILD_SYSTEM"
  | "ARCHITECTURE_VALIDATOR" | "DEPENDENCY_AUDITOR" | "SECURITY_SCANNER"
  | "OPERATIONS_MONITORING" | "PRODUCTION_COMPOSITION" | "F19_RECOVERY";

export type OperationalReadinessEvidenceErrorCode =
  | "READINESS_EVIDENCE_INVALID"
  | "READINESS_EVIDENCE_IDENTITY_CONFLICT"
  | "READINESS_EVIDENCE_NOT_FOUND";

export class OperationalReadinessEvidenceError extends Error {
  public constructor(public readonly code: OperationalReadinessEvidenceErrorCode, message: string) {
    super(message);
    this.name = "OperationalReadinessEvidenceError";
  }
}

export interface OperationalReadinessBinding {
  readonly subjectRef: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly candidateRef: string | null;
  readonly environmentRef: string | null;
  readonly protectedSetRef: string | null;
  readonly rollbackTargetRef: string | null;
}

export interface OperationalReadinessEvidence {
  readonly evidenceId: string;
  readonly readinessType: OperationalReadinessType;
  readonly evidenceType: OperationalReadinessEvidenceType;
  readonly sourceClassification: OperationalReadinessSourceClassification;
  readonly binding: OperationalReadinessBinding;
  readonly outcome: OperationalReadinessEvidenceOutcome;
  readonly occurredAt: string;
  readonly freshnessThresholdMs: number | null;
  readonly evidenceRefs: readonly string[];
}

export interface OperationalReadinessEvidenceAdmissionPort {
  admit(candidate: unknown): OperationalReadinessEvidence | undefined;
}

export interface OperationalReadinessProjectionRequest {
  readonly readinessProjectionId: string;
  readonly readinessType: OperationalReadinessType;
  readonly binding: OperationalReadinessBinding;
  readonly evidence: readonly OperationalReadinessEvidence[];
  readonly evaluatedAt: string;
}

export interface OperationalReadinessProjectionPersistenceRequest extends Omit<OperationalReadinessProjectionRequest, "evidence"> {
  readonly evidenceIds: readonly string[];
}

export interface OperationalReadinessProjection {
  readonly readinessProjectionId: string;
  readonly readinessType: OperationalReadinessType;
  readonly binding: OperationalReadinessBinding;
  readonly readiness: OperationalReadiness;
  readonly freshness: EvidenceFreshness;
  readonly safeReasonCodes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly evaluatedAt: string;
}

const requiredEvidence = Object.freeze<Record<OperationalReadinessType, readonly OperationalReadinessEvidenceType[]>>({
  BACKUP: Object.freeze(["BACKUP_CONFIGURATION", "BACKUP_EXECUTION", "BACKUP_INTEGRITY", "RESTORE_VALIDATION"]),
  DEPLOYMENT: Object.freeze(["DEPLOYMENT_CHECKLIST", "RELEASE_VERIFICATION", "CANDIDATE_VERIFICATION", "ARCHITECTURE_CHECKSUM", "DEPENDENCY_AUDIT", "SECURITY_SCAN", "BACKUP_READINESS", "ROLLBACK_READINESS", "MONITORING_READINESS", "PRODUCTION_CONFIGURATION"]),
  ROLLBACK: Object.freeze(["ROLLBACK_PROCEDURE", "ROLLBACK_TARGET", "ROLLBACK_COMPATIBILITY", "ROLLBACK_CHECKLIST", "BACKUP_RECOVERY_READINESS", "POST_ROLLBACK_VALIDATION"]),
});

const sourceForEvidence = Object.freeze<Record<OperationalReadinessEvidenceType, OperationalReadinessSourceClassification>>({
  BACKUP_CONFIGURATION: "BACKUP_SYSTEM", BACKUP_EXECUTION: "BACKUP_SYSTEM", BACKUP_INTEGRITY: "BACKUP_SYSTEM",
  RESTORE_VALIDATION: "RECOVERY_VALIDATOR", DEPLOYMENT_CHECKLIST: "RELEASE_GOVERNANCE",
  RELEASE_VERIFICATION: "RELEASE_GOVERNANCE", CANDIDATE_VERIFICATION: "BUILD_SYSTEM",
  ARCHITECTURE_CHECKSUM: "ARCHITECTURE_VALIDATOR", DEPENDENCY_AUDIT: "DEPENDENCY_AUDITOR",
  SECURITY_SCAN: "SECURITY_SCANNER", BACKUP_READINESS: "BACKUP_SYSTEM",
  ROLLBACK_READINESS: "RELEASE_GOVERNANCE", MONITORING_READINESS: "OPERATIONS_MONITORING",
  PRODUCTION_CONFIGURATION: "PRODUCTION_COMPOSITION", ROLLBACK_PROCEDURE: "RELEASE_GOVERNANCE",
  ROLLBACK_TARGET: "RELEASE_GOVERNANCE", ROLLBACK_COMPATIBILITY: "RELEASE_GOVERNANCE",
  ROLLBACK_CHECKLIST: "RELEASE_GOVERNANCE", BACKUP_RECOVERY_READINESS: "BACKUP_SYSTEM",
  POST_ROLLBACK_VALIDATION: "RECOVERY_VALIDATOR", F19_RECOVERY_REFERENCE: "F19_RECOVERY",
});

const evidenceTypeForReadiness = Object.freeze<Record<OperationalReadinessType, ReadonlySet<OperationalReadinessEvidenceType>>>({
  BACKUP: new Set([...requiredEvidence.BACKUP, "F19_RECOVERY_REFERENCE"]),
  DEPLOYMENT: new Set(requiredEvidence.DEPLOYMENT),
  ROLLBACK: new Set([...requiredEvidence.ROLLBACK, "F19_RECOVERY_REFERENCE"]),
});

export function deriveOperationalReadinessBindingFingerprint(
  readinessType: OperationalReadinessType,
  binding: OperationalReadinessBinding,
): string {
  const validType = oneOf(readinessType, ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  const validBinding = validateOperationalReadinessBinding(binding);
  validateBindingShape(validType, validBinding);
  const sourceManifest = requiredEvidence[validType].map((evidenceType) => ({
    evidenceType,
    sourceClassification: sourceForEvidence[evidenceType],
  }));
  const canonicalBinding = [
    validType,
    validBinding.subjectRef,
    validBinding.tenantId,
    validBinding.scopeRef,
    validBinding.candidateRef,
    validBinding.environmentRef,
    validBinding.protectedSetRef,
    validBinding.rollbackTargetRef,
    sourceManifest.map(({ evidenceType, sourceClassification }) => [evidenceType, sourceClassification]),
  ];
  return createHash("sha256").update(JSON.stringify(canonicalBinding)).digest("hex");
}

export function validateOperationalReadinessEvidence(input: unknown): OperationalReadinessEvidence {
  if (!isRecord(input) || !hasExactKeys(input, ["evidenceId", "readinessType", "evidenceType", "sourceClassification", "binding", "outcome", "occurredAt", "freshnessThresholdMs", "evidenceRefs"])) invalid();
  const readinessType = oneOf(input["readinessType"], ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  const evidenceType = oneOf(input["evidenceType"], Object.keys(sourceForEvidence) as OperationalReadinessEvidenceType[]);
  const sourceClassification = oneOf(input["sourceClassification"], Object.values(sourceForEvidence));
  if (!evidenceTypeForReadiness[readinessType].has(evidenceType) || sourceForEvidence[evidenceType] !== sourceClassification) invalid();
  oneOf(input["outcome"], ["SATISFIED", "BLOCKING", "DEGRADED"]);
  validateReference(input["evidenceId"], "readiness-evidence:");
  validateTimestamp(input["occurredAt"]);
  validateThreshold(input["freshnessThresholdMs"]);
  validateEvidenceRefs(input["evidenceRefs"], false);
  const binding = validateOperationalReadinessBinding(input["binding"]);
  validateBindingShape(readinessType, binding);
  const valid = { ...input, binding } as unknown as OperationalReadinessEvidence;
  return immutableOperationalEvidence(valid);
}

export function validateOperationalReadinessBinding(input: unknown): OperationalReadinessBinding {
  if (!isRecord(input) || !hasExactKeys(input, ["subjectRef", "tenantId", "scopeRef", "candidateRef", "environmentRef", "protectedSetRef", "rollbackTargetRef"])) invalid();
  try { validateOperationalResourceReference(input["subjectRef"]); } catch { invalid(); }
  validateScope(input["tenantId"]); validateScope(input["scopeRef"]);
  validateNullableReference(input["candidateRef"], "release-candidate:");
  validateNullableReference(input["environmentRef"], "environment:");
  validateNullableReference(input["protectedSetRef"], "protected-set:");
  validateNullableReference(input["rollbackTargetRef"], "release-candidate:");
  return immutableOperationalEvidence(input as unknown as OperationalReadinessBinding);
}

export function validateOperationalReadinessProjection(input: unknown): OperationalReadinessProjection {
  if (!isRecord(input) || !hasExactKeys(input, ["readinessProjectionId", "readinessType", "binding", "readiness", "freshness", "safeReasonCodes", "evidenceIds", "evidenceRefs", "evaluatedAt"])) invalid();
  validateReference(input["readinessProjectionId"], "readiness-projection:");
  const readinessType = oneOf(input["readinessType"], ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  oneOf(input["readiness"], ["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]);
  oneOf(input["freshness"], ["FRESH", "STALE", "UNKNOWN"]);
  validateCategories(input["safeReasonCodes"]); validateReferences(input["evidenceIds"], "readiness-evidence:");
  validateEvidenceRefs(input["evidenceRefs"], true); validateTimestamp(input["evaluatedAt"]);
  const binding = validateOperationalReadinessBinding(input["binding"]);
  validateBindingShape(readinessType, binding);
  return immutableOperationalEvidence({ ...input, readinessType, binding } as unknown as OperationalReadinessProjection);
}

export function deriveOperationalReadiness(request: OperationalReadinessProjectionRequest): OperationalReadinessProjection {
  const validRequest = validateProjectionRequest(request);
  const matching = validRequest.evidence.filter((record) => sameBinding(record.binding, validRequest.binding));
  const byType = new Map<OperationalReadinessEvidenceType, OperationalReadinessEvidence>();
  for (const record of matching) {
    if (byType.has(record.evidenceType)) invalid();
    byType.set(record.evidenceType, record);
  }
  const required = requiredEvidence[validRequest.readinessType];
  const present = required.map((type) => byType.get(type)).filter((record): record is OperationalReadinessEvidence => record !== undefined);
  const missing = required.filter((type) => !byType.has(type));
  const freshnesses = present.map((record) => deriveEvidenceFreshness(record.occurredAt, validRequest.evaluatedAt, record.freshnessThresholdMs));
  const hasBlocking = present.some((record) => record.outcome === "BLOCKING");
  const hasStale = freshnesses.includes("STALE");
  const hasDegraded = present.some((record) => record.outcome === "DEGRADED");
  const readiness: OperationalReadiness = hasBlocking || hasStale
    ? "NOT_READY"
    : missing.length > 0
      ? "UNKNOWN"
      : hasDegraded ? "DEGRADED" : "READY";
  const freshness: EvidenceFreshness = hasStale ? "STALE" : freshnesses.length > 0 && freshnesses.every((value) => value === "FRESH") ? "FRESH" : "UNKNOWN";
  const reasons = [
    ...missing.map((type) => `MISSING_${type}`),
    ...present.filter((record) => record.outcome === "BLOCKING").map((record) => `BLOCKING_${record.evidenceType}`),
    ...present.filter((record) => deriveEvidenceFreshness(record.occurredAt, validRequest.evaluatedAt, record.freshnessThresholdMs) === "STALE").map((record) => `STALE_${record.evidenceType}`),
    ...present.filter((record) => record.outcome === "DEGRADED").map((record) => `DEGRADED_${record.evidenceType}`),
  ].sort();
  return validateOperationalReadinessProjection({
    readinessProjectionId: validRequest.readinessProjectionId,
    readinessType: validRequest.readinessType,
    binding: validRequest.binding,
    readiness,
    freshness,
    safeReasonCodes: reasons,
    evidenceIds: matching.map((record) => record.evidenceId).sort(),
    evidenceRefs: [...new Set(matching.flatMap((record) => record.evidenceRefs))].sort(),
    evaluatedAt: validRequest.evaluatedAt,
  });
}

export function validateOperationalReadinessProjectionPersistenceRequest(input: unknown): OperationalReadinessProjectionPersistenceRequest {
  if (!isRecord(input) || !hasExactKeys(input, ["readinessProjectionId", "readinessType", "binding", "evidenceIds", "evaluatedAt"])) invalid();
  validateReference(input["readinessProjectionId"], "readiness-projection:");
  const readinessType = oneOf(input["readinessType"], ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  const validBinding = validateOperationalReadinessBinding(input["binding"]);
  validateBindingShape(readinessType, validBinding);
  validateReferences(input["evidenceIds"], "readiness-evidence:");
  if (new Set(input["evidenceIds"] as readonly string[]).size !== (input["evidenceIds"] as readonly string[]).length) invalid();
  validateTimestamp(input["evaluatedAt"]);
  return immutableOperationalEvidence({
    readinessProjectionId: input["readinessProjectionId"] as string,
    readinessType,
    binding: validBinding,
    evidenceIds: input["evidenceIds"] as readonly string[],
    evaluatedAt: input["evaluatedAt"] as string,
  });
}

function validateProjectionRequest(input: unknown): OperationalReadinessProjectionRequest {
  if (!isRecord(input) || !hasExactKeys(input, ["readinessProjectionId", "readinessType", "binding", "evidence", "evaluatedAt"]) || !Array.isArray(input["evidence"]) || input["evidence"].length > 32) invalid();
  validateReference(input["readinessProjectionId"], "readiness-projection:");
  const readinessType = oneOf(input["readinessType"], ["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
  const validBinding = validateOperationalReadinessBinding(input["binding"]);
  validateBindingShape(readinessType, validBinding);
  validateTimestamp(input["evaluatedAt"]);
  const evidence = input["evidence"].map(validateOperationalReadinessEvidence);
  return immutableOperationalEvidence({
    readinessProjectionId: input["readinessProjectionId"] as string,
    readinessType,
    binding: validBinding,
    evidence,
    evaluatedAt: input["evaluatedAt"] as string,
  });
}

function validateBindingShape(type: OperationalReadinessType, binding: OperationalReadinessBinding): void {
  const valid = type === "BACKUP"
    ? binding.protectedSetRef !== null && binding.candidateRef === null && binding.environmentRef === null && binding.rollbackTargetRef === null
    : type === "DEPLOYMENT"
      ? binding.candidateRef !== null && binding.environmentRef !== null && binding.protectedSetRef === null && binding.rollbackTargetRef === null
      : binding.rollbackTargetRef !== null && binding.candidateRef === null && binding.environmentRef === null && binding.protectedSetRef === null;
  if (!valid) invalid();
}

function sameBinding(left: OperationalReadinessBinding, right: OperationalReadinessBinding): boolean {
  return Object.keys(right).every((key) => left[key as keyof OperationalReadinessBinding] === right[key as keyof OperationalReadinessBinding]);
}

function validateNullableReference(value: unknown, prefix: string): void { if (value !== null) validateReference(value, prefix); }
function validateReference(value: unknown, prefix: string): void { try { validateOperationalReference(value, prefix); } catch { invalid(); } }
function validateEvidenceRefs(value: unknown, allowEmpty: boolean): void {
  validateReferences(value, "evidence:");
  if (!allowEmpty && (value as readonly string[]).length === 0) invalid();
}
function validateReferences(value: unknown, prefix: string): void {
  if (!Array.isArray(value) || value.length > 32) invalid();
  for (const item of value) validateReference(item, prefix);
}
function validateCategories(value: unknown): void {
  if (!Array.isArray(value) || value.length > 32 || value.some((item) => typeof item !== "string" || !/^[A-Z][A-Z0-9_]{0,95}$/u.test(item))) invalid();
}
function validateScope(value: unknown): void { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)) invalid(); }
function validateTimestamp(value: unknown): void {
  if (typeof value !== "string") invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) invalid();
}
function validateThreshold(value: unknown): void { if (value !== null && (!Number.isSafeInteger(value) || (value as number) <= 0)) invalid(); }
function oneOf<Value extends string>(value: unknown, values: readonly Value[]): Value { if (typeof value !== "string" || !values.includes(value as Value)) invalid(); return value as Value; }
function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean { return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)); }
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function invalid(): never { throw new OperationalReadinessEvidenceError("READINESS_EVIDENCE_INVALID", "Operational readiness evidence is invalid."); }
