import {
  isSensitiveSecurityDetailKey,
  isUnsafeSecurityDetailValue,
  type DataClassification,
} from "../../../packages/security-contracts/src/index.js";

export type ClassificationInput = DataClassification | "UNKNOWN";

const classificationRank: Readonly<Record<DataClassification, number>> = {
  PUBLIC_APPROVED: 0,
  INTERNAL: 1,
  CONFIDENTIAL_BUSINESS: 2,
  RESTRICTED_PERSONAL: 3,
  RESTRICTED_SECURITY: 4,
};

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((nestedValue) => {
      deepFreeze(nestedValue);
    });
    Object.freeze(value);
  }
  return value;
}

export function classifyCombinedData(
  inputs: readonly ClassificationInput[],
): DataClassification {
  if (inputs.length === 0 || inputs.includes("UNKNOWN")) {
    return "RESTRICTED_SECURITY";
  }

  const classifiedInputs = inputs as readonly DataClassification[];
  return classifiedInputs.reduce<DataClassification>(
    (highest, input) =>
      classificationRank[input] > classificationRank[highest] ? input : highest,
    "PUBLIC_APPROVED",
  );
}

export function maskRestrictedValue(
  value: string,
  classification: DataClassification,
): string {
  if (classification === "RESTRICTED_SECURITY") {
    return "[REDACTED]";
  }
  if (classification === "RESTRICTED_PERSONAL") {
    return `***${value.slice(-4)}`;
  }
  return value;
}

export function sanitizeSecurityDetails(
  input: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return deepFreeze(sanitizeValue(input) as Record<string, unknown>);
}

function sanitizeValue(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((entry) => sanitizeValue(entry));
  }
  if (typeof input === "string") {
    return isUnsafeSecurityDetailValue(input)
      ? "[REDACTED]"
      : input;
  }
  if (input === null || typeof input !== "object") {
    return input;
  }

  return Object.fromEntries(
    Object.entries(input)
      .filter(([key]) => !isSensitiveSecurityDetailKey(key))
      .map(([key, value]) => [key, sanitizeValue(value)]),
  );
}
