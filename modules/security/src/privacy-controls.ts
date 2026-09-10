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

const unsafeSqlStatementValuePatterns = Object.freeze([
  /\bselect\b/iu,
  /\b(?:insert|replace)\s+into\b/iu,
  /\bdelete\s+from\b/iu,
  /\b(?:create|alter|drop)\s+table\b/iu,
  /\bpragma\b/iu,
  /\bvalues\s*\(/iu,
]);

const unsafeSqlDiagnosticValuePatterns = Object.freeze([
  /\bsqlite(?:_[a-z0-9_]+)?\b/iu,
  /\bdatabase\s+(?:disk\s+image\s+is\s+malformed|is\s+locked)\b/iu,
  /\battempt\s+to\s+write\s+a\s+readonly\s+database\b/iu,
  /\bsql\s+logic\s+error\b/iu,
  /\bdatatype\s+mismatch\b/iu,
  /\b(?:no\s+such|unknown)\s+(?:table|column|schema)\b/iu,
  /\bhas\s+no\s+(?:table|column)\b/iu,
]);

function isUnsafeSqlDiagnosticValue(value: string): boolean {
  if (
    unsafeSqlStatementValuePatterns.some((pattern) => pattern.test(value)) ||
    unsafeSqlDiagnosticValuePatterns.some((pattern) => pattern.test(value))
  ) {
    return true;
  }

  const isUpdateStatement = /\bupdate\b/iu.test(value) && /\bset\b/iu.test(value);
  const isSyntaxDiagnostic =
    /\bnear\b/iu.test(value) && /\bsyntax\s+error\b/iu.test(value);
  const isConstraintDiagnostic =
    /\b(?:foreign\s+key|unique|check|not\s+null|constraint)\b/iu.test(value) &&
    /\b(?:failed|violation)\b/iu.test(value);

  return isUpdateStatement || isSyntaxDiagnostic || isConstraintDiagnostic;
}

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
    return isUnsafeSecurityDetailValue(input) || isUnsafeSqlDiagnosticValue(input)
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
