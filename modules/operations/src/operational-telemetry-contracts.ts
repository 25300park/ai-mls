export type OperationalEvidenceErrorCode =
  | "TELEMETRY_INPUT_INVALID"
  | "TELEMETRY_UNSAFE_CONTENT"
  | "TELEMETRY_IDENTITY_CONFLICT"
  | "PERSISTENCE_UNAVAILABLE";

export class OperationalEvidenceError extends Error {
  public constructor(public readonly code: OperationalEvidenceErrorCode, message: string) {
    super(message);
    this.name = "OperationalEvidenceError";
  }
}

export interface OperationalTelemetryRecord {
  readonly telemetryEventId: string;
  readonly eventType: string;
  readonly component: string;
  readonly operation: string;
  readonly resourceType: string;
  readonly resourceRef: string;
  readonly outcome: string;
  readonly safeErrorCode: string | null;
  readonly correlationId: string | null;
  readonly evidenceRefs: readonly string[];
  readonly occurredAt: string;
  readonly attemptId?: string;
  readonly invocationId?: string;
  readonly recoveryCaseId?: string;
  readonly recoveryId?: string;
  readonly advisoryId?: string;
}

const requiredKeys = Object.freeze([
  "telemetryEventId", "eventType", "component", "operation", "resourceType",
  "resourceRef", "outcome", "safeErrorCode", "correlationId", "evidenceRefs", "occurredAt",
] as const);

const optionalKeys = Object.freeze([
  "attemptId", "invocationId", "recoveryCaseId", "recoveryId", "advisoryId",
] as const);

const categoryPattern = /^[A-Z][A-Z0-9_]{0,63}$/u;
const opaqueReferencePattern = /^[a-z][a-z0-9-]{1,31}:[A-Za-z0-9][A-Za-z0-9._:#-]{0,223}$/u;
const opaqueResourceReferencePattern = /^[a-z][a-z0-9-]{1,31}:sha256:[a-f0-9]{64}$/u;
const unsafeReferencePattern = /(?:^|[:._/-])(?:api-?key|authorization|bearer|cookie|credential|password|private-?key|raw-?(?:body|payload|prompt|request|response)|secret|session-?token|token)(?:$|[:._/#-])/iu;

export function validateOperationalTelemetryRecord(input: unknown): OperationalTelemetryRecord {
  if (!isRecord(input) || !hasExactKeys(input, requiredKeys, optionalKeys)) invalid();
  for (const key of ["eventType", "component", "operation", "outcome"] as const) {
    assertCategory(input[key]);
  }
  const resourceType = input["resourceType"];
  assertCategory(resourceType);
  assertOpaqueReference(input["telemetryEventId"], "telemetry:");
  assertResourceReference(input["resourceRef"], resourceType);
  assertNullableCategory(input["safeErrorCode"]);
  assertNullableReference(input["correlationId"]);
  assertEvidenceReferences(input["evidenceRefs"]);
  assertTimestamp(input["occurredAt"]);
  const optionalPrefixes = { attemptId: "attempt:", invocationId: "invocation:", recoveryCaseId: "recovery-case:", recoveryId: "recovery:", advisoryId: "advisory:" } as const;
  for (const key of optionalKeys) {
    if (Object.hasOwn(input, key)) assertOpaqueReference(input[key], optionalPrefixes[key]);
  }
  return immutableOperationalEvidence(input as unknown as OperationalTelemetryRecord);
}

export function immutableOperationalEvidence<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

export function validateOperationalReference(value: unknown, requiredPrefix?: string): string {
  assertOpaqueReference(value, requiredPrefix);
  return value;
}

export function validateOperationalCategory(value: unknown): string {
  assertCategory(value);
  return value;
}

export function validateOperationalResourceReference(value: unknown): string {
  assertResourceReference(value);
  return value;
}

function assertCategory(value: unknown): asserts value is string {
  if (typeof value !== "string" || !categoryPattern.test(value)) invalid();
}

function assertNullableCategory(value: unknown): asserts value is string | null {
  if (value !== null) assertCategory(value);
}

function assertNullableReference(value: unknown): asserts value is string | null {
  if (value !== null) assertOpaqueReference(value, "correlation:");
}

function assertOpaqueReference(value: unknown, requiredPrefix?: string): asserts value is string {
  if (typeof value !== "string") invalid();
  if (value.includes("@") || value.includes("=") || value.startsWith("{") || value.startsWith("[") || unsafeReferencePattern.test(value)) unsafe();
  if (!opaqueReferencePattern.test(value) || (requiredPrefix !== undefined && !value.startsWith(requiredPrefix))) invalid();
  const identifier = value.slice(value.indexOf(":") + 1);
  if (!/[0-9]/u.test(identifier)) unsafe();
}

function assertResourceReference(value: unknown, resourceType?: string): asserts value is string {
  if (typeof value !== "string") invalid();
  if (value.includes("@") || value.includes("=") || unsafeReferencePattern.test(value)) unsafe();
  if (!opaqueResourceReferencePattern.test(value)) invalid();
  if (resourceType !== undefined && !value.startsWith(`${resourceType.toLowerCase().replaceAll("_", "-")}:sha256:`)) invalid();
}

function assertEvidenceReferences(value: unknown): asserts value is readonly string[] {
  if (!Array.isArray(value) || value.length > 16) invalid();
  for (const reference of value) assertOpaqueReference(reference, "evidence:");
}

function assertTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string") invalid();
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) invalid();
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  required: readonly string[],
  optional: readonly string[],
): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

function invalid(): never {
  throw new OperationalEvidenceError("TELEMETRY_INPUT_INVALID", "Operational telemetry input is invalid.");
}

function unsafe(): never {
  throw new OperationalEvidenceError("TELEMETRY_UNSAFE_CONTENT", "Operational telemetry contains unsafe content.");
}
