import { createHash } from "node:crypto";

import {
  OperationalEvidenceError,
  immutableOperationalEvidence,
  validateOperationalCategory,
  validateOperationalReference,
  validateOperationalResourceReference,
} from "./operational-telemetry-contracts.js";

export const CANONICAL_ALERT_TYPES = Object.freeze([
  "COMPONENT_UNHEALTHY", "COMPONENT_NOT_READY", "STALE_OPERATIONAL_EVIDENCE",
  "PUBLICATION_UNKNOWN_OUTCOME", "CONNECTOR_AMBIGUITY", "OPEN_RECOVERY_CASE",
  "SUSPENDED_INTEGRATION_CONTRACT", "AUTHORIZATION_FAILURE_SPIKE", "IDEMPOTENCY_CONFLICT_SPIKE",
  "SECRET_LEAKAGE_DETECTED", "DEPENDENCY_SECURITY_FINDING", "ARCHITECTURE_DRIFT_DETECTED",
  "BACKUP_READINESS_FAILURE", "DEPLOYMENT_READINESS_FAILURE",
] as const);

export type OperationalAlertType = typeof CANONICAL_ALERT_TYPES[number];
export type OperationalAlertSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";
export type OperationalAlertState = "ACTIVE" | "CLEARED";
export type OperationalAlertErrorCode = "OPERATIONAL_ALERT_INVALID" | "OPERATIONAL_ALERT_IDENTITY_CONFLICT" | "OPERATIONAL_ALERT_NOT_FOUND";

export class OperationalAlertError extends Error {
  public constructor(public readonly code: OperationalAlertErrorCode, message: string) {
    super(message);
    this.name = "OperationalAlertError";
  }
}

interface AlertSourceCommon {
  readonly sourceId: string;
  readonly conditionRef: string;
  readonly component: string;
  readonly resourceRef: string;
  readonly tenantId: string;
  readonly scopeRef: string;
  readonly evidenceRefs: readonly string[];
  readonly observedAt: string;
}

export type AuthoritativeAlertSource = AlertSourceCommon & (
  | Readonly<{ sourceKind: "OPERATIONAL_STATUS"; health: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN"; readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN"; freshness: "FRESH" | "STALE" | "UNKNOWN"; freshnessThresholdMs: number | null }>
  | Readonly<{ sourceKind: "PUBLICATION_OUTCOME"; outcome: "PENDING" | "CONFIRMED" | "NO_EFFECT" | "UNKNOWN" }>
  | Readonly<{ sourceKind: "CONNECTOR_INVOCATION"; state: "PREPARED" | "AMBIGUOUS" | "SUCCEEDED" | "FAILED" }>
  | Readonly<{ sourceKind: "RECOVERY_CASE"; status: "OPEN" | "RESOLVED" }>
  | Readonly<{ sourceKind: "INTEGRATION_CONTRACT"; status: "ACTIVE" | "SUSPENDED" }>
  | Readonly<{ sourceKind: "SECURITY_FINDING"; detected: boolean }>
  | Readonly<{ sourceKind: "DEPENDENCY_AUDIT"; active: boolean; auditSeverity: string; classification: "PRODUCTION" | "APPROVED_DEVELOPMENT_ONLY" | "UNAPPROVED" }>
  | Readonly<{ sourceKind: "ARCHITECTURE_CHECKSUM"; matchesBaseline: boolean; approvedDelta: boolean }>
  | Readonly<{ sourceKind: "AUTHORIZATION_AGGREGATE"; failureCount: number }>
  | Readonly<{ sourceKind: "IDEMPOTENCY_AGGREGATE"; conflictCount: number }>
  | Readonly<{ sourceKind: "BACKUP_READINESS"; readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN" }>
  | Readonly<{ sourceKind: "DEPLOYMENT_READINESS"; readiness: "READY" | "NOT_READY" | "DEGRADED" | "UNKNOWN" }>
);

export interface OperationalAlertSignal {
  readonly sourceId: string;
  readonly sourceKind: AuthoritativeAlertSource["sourceKind"];
  readonly conditionRef: string;
  readonly alertType: OperationalAlertType;
  readonly severity: OperationalAlertSeverity;
  readonly component: string;
  readonly resourceRef: string;
  readonly conditionFingerprint: string;
  readonly active: boolean;
  readonly safeReasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly observedAt: string;
  readonly tenantId: string;
  readonly scopeRef: string;
}

export interface OperationalAlertProjection {
  readonly alertId: string;
  readonly alertType: OperationalAlertType;
  readonly severity: OperationalAlertSeverity;
  readonly component: string;
  readonly resourceRef: string;
  readonly currentState: OperationalAlertState;
  readonly safeReasonCode: string;
  readonly evidenceRefs: readonly string[];
  readonly openedAt: string;
  readonly lastEvaluatedAt: string;
  readonly clearedAt: string | null;
}

const fixedSeverity = Object.freeze<Partial<Record<OperationalAlertType, OperationalAlertSeverity>>>({
  COMPONENT_UNHEALTHY: "HIGH",
  COMPONENT_NOT_READY: "HIGH",
  STALE_OPERATIONAL_EVIDENCE: "WARNING",
  PUBLICATION_UNKNOWN_OUTCOME: "HIGH",
  CONNECTOR_AMBIGUITY: "HIGH",
  OPEN_RECOVERY_CASE: "WARNING",
  SUSPENDED_INTEGRATION_CONTRACT: "WARNING",
  SECRET_LEAKAGE_DETECTED: "CRITICAL",
  ARCHITECTURE_DRIFT_DETECTED: "HIGH",
});

const dependencySeverity = Object.freeze<Record<string, OperationalAlertSeverity>>({
  informational: "INFO", info: "INFO", low: "INFO", moderate: "WARNING", medium: "WARNING", high: "HIGH", critical: "CRITICAL",
});

export function canonicalSeverityForAlert(alertType: OperationalAlertType, sourceSeverity?: string): OperationalAlertSeverity | undefined {
  if (!CANONICAL_ALERT_TYPES.includes(alertType)) invalid();
  if (alertType === "DEPENDENCY_SECURITY_FINDING") {
    if (typeof sourceSeverity !== "string") invalid();
    const mapped = dependencySeverity[sourceSeverity.toLowerCase()];
    if (mapped === undefined) invalid();
    return mapped;
  }
  if (sourceSeverity !== undefined) invalid();
  return fixedSeverity[alertType];
}

export function normalizeAuthoritativeAlertSignals(input: unknown): readonly OperationalAlertSignal[] {
  const source = validateAuthoritativeAlertSource(input);
  switch (source.sourceKind) {
    case "OPERATIONAL_STATUS": {
      const signals = [
        signal(source, "COMPONENT_UNHEALTHY", source.health === "UNHEALTHY"),
        signal(source, "COMPONENT_NOT_READY", source.readiness === "NOT_READY"),
      ];
      if (source.freshnessThresholdMs === null) {
        if (source.freshness !== "UNKNOWN") invalid();
        signals.push(signal(source, "STALE_OPERATIONAL_EVIDENCE", false));
      } else {
        signals.push(signal(source, "STALE_OPERATIONAL_EVIDENCE", source.freshness === "STALE"));
      }
      return immutableOperationalEvidence(signals);
    }
    case "PUBLICATION_OUTCOME": return immutableOperationalEvidence([signal(source, "PUBLICATION_UNKNOWN_OUTCOME", source.outcome === "UNKNOWN")]);
    case "CONNECTOR_INVOCATION": return immutableOperationalEvidence([signal(source, "CONNECTOR_AMBIGUITY", source.state === "AMBIGUOUS")]);
    case "RECOVERY_CASE": return immutableOperationalEvidence([signal(source, "OPEN_RECOVERY_CASE", source.status === "OPEN")]);
    case "INTEGRATION_CONTRACT": return immutableOperationalEvidence([signal(source, "SUSPENDED_INTEGRATION_CONTRACT", source.status === "SUSPENDED")]);
    case "SECURITY_FINDING": return immutableOperationalEvidence([signal(source, "SECRET_LEAKAGE_DETECTED", source.detected)]);
    case "DEPENDENCY_AUDIT": return immutableOperationalEvidence([signal(source, "DEPENDENCY_SECURITY_FINDING", source.active, source.auditSeverity, source.classification)]);
    case "ARCHITECTURE_CHECKSUM": {
      return immutableOperationalEvidence([signal(source, "ARCHITECTURE_DRIFT_DETECTED", !source.matchesBaseline && !source.approvedDelta)]);
    }
    case "AUTHORIZATION_AGGREGATE":
    case "IDEMPOTENCY_AGGREGATE":
    case "BACKUP_READINESS":
    case "DEPLOYMENT_READINESS":
      return Object.freeze([]);
  }
}

export function validateOperationalAlertSignal(input: unknown): OperationalAlertSignal {
  const keys = ["sourceId", "sourceKind", "conditionRef", "alertType", "severity", "component", "resourceRef", "conditionFingerprint", "active", "safeReasonCode", "evidenceRefs", "observedAt", "tenantId", "scopeRef"];
  if (!isRecord(input) || !hasExactKeys(input, keys) || !CANONICAL_ALERT_TYPES.includes(input["alertType"] as OperationalAlertType)) invalid();
  try {
    validateOperationalReference(input["sourceId"]);
    validateOperationalReference(input["conditionRef"], "condition:");
    validateOperationalCategory(input["component"]);
    validateOperationalResourceReference(input["resourceRef"]);
    validateOperationalCategory(input["safeReasonCode"]);
    validateEvidenceRefs(input["evidenceRefs"]);
  } catch (error) {
    if (error instanceof OperationalEvidenceError) invalid();
    throw error;
  }
  validateScope(input["tenantId"]); validateScope(input["scopeRef"]);
  if (!["OPERATIONAL_STATUS", "PUBLICATION_OUTCOME", "CONNECTOR_INVOCATION", "RECOVERY_CASE", "INTEGRATION_CONTRACT", "SECURITY_FINDING", "DEPENDENCY_AUDIT", "ARCHITECTURE_CHECKSUM", "AUTHORIZATION_AGGREGATE", "IDEMPOTENCY_AGGREGATE", "BACKUP_READINESS", "DEPLOYMENT_READINESS"].includes(input["sourceKind"] as string)) invalid();
  validateTimestamp(input["observedAt"]); assertBoolean(input["active"]);
  if (typeof input["conditionFingerprint"] !== "string" || !/^[a-f0-9]{64}$/u.test(input["conditionFingerprint"])) invalid();
  const alertType = input["alertType"] as OperationalAlertType;
  const severity = input["severity"];
  if (!(["INFO", "WARNING", "HIGH", "CRITICAL"] as const).includes(severity as OperationalAlertSeverity)) invalid();
  if (alertType === "DEPENDENCY_SECURITY_FINDING") {
    if (!Object.values(dependencySeverity).includes(severity as OperationalAlertSeverity)) invalid();
  } else if (canonicalSeverityForAlert(alertType) !== severity) invalid();
  return immutableOperationalEvidence(input as unknown as OperationalAlertSignal);
}

export function validateOperationalAlertProjection(input: unknown): OperationalAlertProjection {
  const keys = ["alertId", "alertType", "severity", "component", "resourceRef", "currentState", "safeReasonCode", "evidenceRefs", "openedAt", "lastEvaluatedAt", "clearedAt"];
  if (!isRecord(input) || !hasExactKeys(input, keys) || !CANONICAL_ALERT_TYPES.includes(input["alertType"] as OperationalAlertType)) invalid();
  try {
    validateOperationalReference(input["alertId"], "alert:");
    validateOperationalCategory(input["component"]);
    validateOperationalResourceReference(input["resourceRef"]);
    validateOperationalCategory(input["safeReasonCode"]);
    validateEvidenceRefs(input["evidenceRefs"]);
  } catch (error) {
    if (error instanceof OperationalEvidenceError) invalid();
    throw error;
  }
  if (input["currentState"] !== "ACTIVE" && input["currentState"] !== "CLEARED") invalid();
  if (!(["INFO", "WARNING", "HIGH", "CRITICAL"] as const).includes(input["severity"] as OperationalAlertSeverity)) invalid();
  const alertType = input["alertType"] as OperationalAlertType;
  if (alertType !== "DEPENDENCY_SECURITY_FINDING" && canonicalSeverityForAlert(alertType) !== input["severity"]) invalid();
  validateTimestamp(input["openedAt"]); validateTimestamp(input["lastEvaluatedAt"]);
  if (input["clearedAt"] !== null) validateTimestamp(input["clearedAt"]);
  if (input["currentState"] === "ACTIVE" ? input["clearedAt"] !== null : input["clearedAt"] === null) invalid();
  if (Date.parse(input["openedAt"] as string) > Date.parse(input["lastEvaluatedAt"] as string)) invalid();
  return immutableOperationalEvidence(input as unknown as OperationalAlertProjection);
}

function signal(
  source: AuthoritativeAlertSource,
  alertType: OperationalAlertType,
  active: boolean,
  sourceSeverity?: string,
  classification?: string,
): OperationalAlertSignal {
  const severity = canonicalSeverityForAlert(alertType, sourceSeverity);
  if (severity === undefined) invalid();
  const safeReasonCode = classification === undefined ? alertType : `${classification}_${alertType}`;
  return immutableOperationalEvidence({
    sourceId: source.sourceId,
    sourceKind: source.sourceKind,
    conditionRef: source.conditionRef,
    alertType,
    severity,
    component: source.component,
    resourceRef: source.resourceRef,
    conditionFingerprint: createHash("sha256").update(`${alertType}|${source.component}|${source.resourceRef}|${source.conditionRef}`).digest("hex"),
    active,
    safeReasonCode,
    evidenceRefs: source.evidenceRefs,
    observedAt: source.observedAt,
    tenantId: source.tenantId,
    scopeRef: source.scopeRef,
  });
}

export function validateAuthoritativeAlertSource(input: unknown): AuthoritativeAlertSource {
  if (!isRecord(input) || typeof input["sourceKind"] !== "string") invalid();
  const required = ["sourceId", "conditionRef", "sourceKind", "component", "resourceRef", "tenantId", "scopeRef", "evidenceRefs", "observedAt"];
  const specific: Record<string, readonly string[]> = {
    OPERATIONAL_STATUS: ["health", "readiness", "freshness", "freshnessThresholdMs"],
    PUBLICATION_OUTCOME: ["outcome"], CONNECTOR_INVOCATION: ["state"], RECOVERY_CASE: ["status"],
    INTEGRATION_CONTRACT: ["status"], SECURITY_FINDING: ["detected"],
    DEPENDENCY_AUDIT: ["active", "auditSeverity", "classification"],
    ARCHITECTURE_CHECKSUM: ["matchesBaseline", "approvedDelta"], AUTHORIZATION_AGGREGATE: ["failureCount"],
    IDEMPOTENCY_AGGREGATE: ["conflictCount"], BACKUP_READINESS: ["readiness"], DEPLOYMENT_READINESS: ["readiness"],
  };
  const extra = specific[input["sourceKind"]];
  if (extra === undefined || !hasExactKeys(input, [...required, ...extra])) invalid();
  try {
    validateOperationalReference(input["sourceId"]);
    validateOperationalReference(input["conditionRef"], "condition:");
    validateOperationalCategory(input["component"]);
    validateOperationalResourceReference(input["resourceRef"]);
    validateScope(input["tenantId"]); validateScope(input["scopeRef"]);
    validateEvidenceRefs(input["evidenceRefs"]);
    validateTimestamp(input["observedAt"]);
  } catch (error) {
    if (error instanceof OperationalEvidenceError) invalid();
    throw error;
  }
  validateSpecific(input);
  return immutableOperationalEvidence(input as unknown as AuthoritativeAlertSource);
}

function validateSpecific(input: Readonly<Record<string, unknown>>): void {
  const oneOf = (key: string, values: readonly unknown[]): void => { if (!values.includes(input[key])) invalid(); };
  switch (input["sourceKind"]) {
    case "OPERATIONAL_STATUS":
      oneOf("health", ["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"]);
      oneOf("readiness", ["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]);
      oneOf("freshness", ["FRESH", "STALE", "UNKNOWN"]);
      if (input["freshnessThresholdMs"] !== null && (!Number.isSafeInteger(input["freshnessThresholdMs"]) || Number(input["freshnessThresholdMs"]) <= 0)) invalid();
      break;
    case "PUBLICATION_OUTCOME": oneOf("outcome", ["PENDING", "CONFIRMED", "NO_EFFECT", "UNKNOWN"]); break;
    case "CONNECTOR_INVOCATION": oneOf("state", ["PREPARED", "AMBIGUOUS", "SUCCEEDED", "FAILED"]); break;
    case "RECOVERY_CASE": oneOf("status", ["OPEN", "RESOLVED"]); break;
    case "INTEGRATION_CONTRACT": oneOf("status", ["ACTIVE", "SUSPENDED"]); break;
    case "SECURITY_FINDING": assertBoolean(input["detected"]); break;
    case "DEPENDENCY_AUDIT":
      assertBoolean(input["active"]); oneOf("classification", ["PRODUCTION", "APPROVED_DEVELOPMENT_ONLY", "UNAPPROVED"]);
      canonicalSeverityForAlert("DEPENDENCY_SECURITY_FINDING", typeof input["auditSeverity"] === "string" ? input["auditSeverity"] : undefined);
      break;
    case "ARCHITECTURE_CHECKSUM": assertBoolean(input["matchesBaseline"]); assertBoolean(input["approvedDelta"]); break;
    case "AUTHORIZATION_AGGREGATE": assertCount(input["failureCount"]); break;
    case "IDEMPOTENCY_AGGREGATE": assertCount(input["conflictCount"]); break;
    case "BACKUP_READINESS":
    case "DEPLOYMENT_READINESS": oneOf("readiness", ["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]); break;
    default: invalid();
  }
}

function validateEvidenceRefs(value: unknown): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) invalid();
  for (const reference of value) validateOperationalReference(reference, "evidence:");
}

function validateScope(value: unknown): void {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) invalid();
}

function validateTimestamp(value: unknown): void {
  if (typeof value !== "string") invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) invalid();
}

function assertBoolean(value: unknown): asserts value is boolean { if (typeof value !== "boolean") invalid(); }
function assertCount(value: unknown): void { if (!Number.isSafeInteger(value) || Number(value) < 0) invalid(); }
function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => keys.includes(key));
}
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function invalid(): never { throw new OperationalAlertError("OPERATIONAL_ALERT_INVALID", "Operational Alert input is invalid."); }
