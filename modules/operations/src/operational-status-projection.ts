import {
  immutableOperationalEvidence,
  validateOperationalCategory,
  validateOperationalReference,
  validateOperationalResourceReference,
} from "./operational-telemetry-contracts.js";

export type OperationalHealth = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
export type OperationalReadiness = "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN";
export type EvidenceFreshness = "FRESH" | "STALE" | "UNKNOWN";

export type OperationalStatusErrorCode =
  | "OPERATIONAL_STATUS_INVALID"
  | "OPERATIONAL_STATUS_IDENTITY_CONFLICT"
  | "TELEMETRY_NOT_FOUND";

export class OperationalStatusError extends Error {
  public constructor(public readonly code: OperationalStatusErrorCode, message: string) {
    super(message);
    this.name = "OperationalStatusError";
  }
}

export interface OperationalStatusProjectionRequest {
  readonly statusSnapshotId: string;
  readonly telemetryEventId: string;
  readonly health: OperationalHealth;
  readonly readiness: OperationalReadiness;
  readonly evaluatedAt: string;
  readonly freshnessThresholdMs?: number | null | undefined;
}

export interface ValidatedOperationalStatusProjectionRequest extends Omit<OperationalStatusProjectionRequest, "freshnessThresholdMs"> {
  readonly freshnessThresholdMs: number | null;
}

export interface OperationalStatusSnapshot extends Omit<OperationalStatusProjectionRequest, "freshnessThresholdMs"> {
  readonly component: string;
  readonly resourceType: string;
  readonly resourceRef: string;
  readonly freshness: EvidenceFreshness;
  readonly evidenceOccurredAt: string;
  readonly freshnessThresholdMs: number | null;
}

const healthValues = new Set<OperationalHealth>(["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"]);
const readinessValues = new Set<OperationalReadiness>(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]);
const freshnessValues = new Set<EvidenceFreshness>(["FRESH", "STALE", "UNKNOWN"]);
const requestRequiredKeys = Object.freeze(["statusSnapshotId", "telemetryEventId", "health", "readiness", "evaluatedAt"]);
const requestKeys = Object.freeze([...requestRequiredKeys, "freshnessThresholdMs"]);
const snapshotKeys = Object.freeze([...requestKeys, "component", "resourceType", "resourceRef", "freshness", "evidenceOccurredAt"]);

export function validateOperationalStatusProjectionRequest(input: unknown): ValidatedOperationalStatusProjectionRequest {
  if (!isExactRecord(input, requestRequiredKeys, requestKeys)) invalid();
  validateOperationalReference(input["statusSnapshotId"], "status-snapshot:");
  validateOperationalReference(input["telemetryEventId"], "telemetry:");
  assertHealth(input["health"]);
  assertReadiness(input["readiness"]);
  assertTimestamp(input["evaluatedAt"]);
  const threshold = input["freshnessThresholdMs"] ?? null;
  assertThreshold(threshold);
  return immutableOperationalEvidence({ ...input, freshnessThresholdMs: threshold } as ValidatedOperationalStatusProjectionRequest);
}

export function validateOperationalStatusSnapshot(input: unknown): OperationalStatusSnapshot {
  if (!isExactRecord(input, snapshotKeys, snapshotKeys)) invalid();
  validateOperationalReference(input["statusSnapshotId"], "status-snapshot:");
  validateOperationalReference(input["telemetryEventId"], "telemetry:");
  validateOperationalCategory(input["component"]);
  validateOperationalCategory(input["resourceType"]);
  validateOperationalResourceReference(input["resourceRef"]);
  assertHealth(input["health"]);
  assertReadiness(input["readiness"]);
  assertFreshness(input["freshness"]);
  assertTimestamp(input["evidenceOccurredAt"]);
  assertTimestamp(input["evaluatedAt"]);
  assertThreshold(input["freshnessThresholdMs"]);
  if (deriveEvidenceFreshness(input["evidenceOccurredAt"], input["evaluatedAt"], input["freshnessThresholdMs"]) !== input["freshness"]) invalid();
  return immutableOperationalEvidence(input as unknown as OperationalStatusSnapshot);
}

export function deriveEvidenceFreshness(evidenceOccurredAt: string, evaluatedAt: string, freshnessThresholdMs: number | null): EvidenceFreshness {
  assertTimestamp(evidenceOccurredAt);
  assertTimestamp(evaluatedAt);
  assertThreshold(freshnessThresholdMs);
  const evidenceTime = Date.parse(evidenceOccurredAt);
  const evaluationTime = Date.parse(evaluatedAt);
  if (evidenceTime > evaluationTime) invalid();
  if (freshnessThresholdMs === null) return "UNKNOWN";
  return evaluationTime - evidenceTime <= freshnessThresholdMs ? "FRESH" : "STALE";
}

function assertHealth(value: unknown): asserts value is OperationalHealth {
  if (typeof value !== "string" || !healthValues.has(value as OperationalHealth)) invalid();
}

function assertReadiness(value: unknown): asserts value is OperationalReadiness {
  if (typeof value !== "string" || !readinessValues.has(value as OperationalReadiness)) invalid();
}

function assertFreshness(value: unknown): asserts value is EvidenceFreshness {
  if (typeof value !== "string" || !freshnessValues.has(value as EvidenceFreshness)) invalid();
}

function assertThreshold(value: unknown): asserts value is number | null {
  if (value !== null && (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)) invalid();
}

function assertTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string") invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) invalid();
}

function isExactRecord(value: unknown, requiredKeys: readonly string[], allowedKeys: readonly string[]): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && requiredKeys.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowedKeys.includes(key));
}

function invalid(): never {
  throw new OperationalStatusError("OPERATIONAL_STATUS_INVALID", "Operational status projection is invalid.");
}
