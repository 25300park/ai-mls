export class AdministrationContractValidationError extends Error {
  public constructor() {
    super("ADMINISTRATION_CONTRACT_INVALID");
    this.name = "AdministrationContractValidationError";
  }
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) failValidation();
  const prototype = Object.getPrototypeOf(value) as object | null;
  if (prototype !== Object.prototype && prototype !== null) failValidation();
  return value as Record<string, unknown>;
}

export function requireExactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional]);
  if (
    required.some((key) => !Object.hasOwn(value, key))
    || Object.keys(value).some((key) => !allowed.has(key))
  ) {
    failValidation();
  }
}

export function requireBoundedString(value: unknown, minimum = 1, maximum = 128): string {
  if (typeof value !== "string") failValidation();
  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) failValidation();
  return normalized;
}

export function requireCanonicalId(value: unknown): string {
  const normalized = requireBoundedString(value, 3, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)) failValidation();
  return normalized;
}

export function requireCanonicalVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) failValidation();
  return value as number;
}

export function requireClosedValue<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): Value {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) failValidation();
  return value as Value;
}

export function requireCanonicalIdList(value: unknown, maximum = 50): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) failValidation();
  const normalized = value.map(requireCanonicalId);
  if (new Set(normalized).size !== normalized.length) failValidation();
  return Object.freeze(normalized);
}

export function requireIsoTimestamp(value: unknown): string {
  const timestamp = requireBoundedString(value, 20, 40);
  const parsed = Date.parse(timestamp);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp) || !Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) failValidation();
  return timestamp;
}

export function requireSafeReason(value: unknown): string {
  const reason = requireBoundedString(value, 8, 500).replace(/\s+/g, " ");
  if (/(?:token|secret|password|api[_-]?key)\s*[=:]/i.test(reason)) failValidation();
  return reason;
}

export function failValidation(): never {
  throw new AdministrationContractValidationError();
}
