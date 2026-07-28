import type {
  PublicationPresentationCategory,
  PublicationPresentationResult,
  PublicationPresentationViewModel,
} from "./publication-presentation-contracts.js";

export type PublicationPresentationValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly failureCode: "PRESENTATION_MODEL_INVALID" };

const results = new Set<PublicationPresentationResult>(["SUCCESS", "ERROR"]);
const categories = new Set<PublicationPresentationCategory>([
  "SUCCESS",
  "VALIDATION",
  "NOT_FOUND",
  "CONFLICT",
  "APPLICATION_REJECTION",
  "INTERNAL_ERROR",
]);

export class StructuralPublicationPresentationValidator {
  public validate(value: unknown): PublicationPresentationValidationResult {
    return isValidModel(value)
      ? { valid: true }
      : { valid: false, failureCode: "PRESENTATION_MODEL_INVALID" };
  }
}

function isValidModel(value: unknown): value is PublicationPresentationViewModel {
  if (!isRecord(value) || !hasOnlyKeys(value, ["presentationResult", "category", "message", "fields", "metadata"])) {
    return false;
  }
  if (!results.has(value["presentationResult"] as PublicationPresentationResult)) return false;
  if (!categories.has(value["category"] as PublicationPresentationCategory)) return false;
  if (!isNonBlank(value["message"]) || !Array.isArray(value["fields"]) || !isRecord(value["metadata"])) return false;
  if (value["presentationResult"] === "SUCCESS" ? value["category"] !== "SUCCESS" : value["category"] === "SUCCESS") return false;
  const keys = new Set<string>();
  for (const field of value["fields"]) {
    if (!isRecord(field) || !hasOnlyKeys(field, ["key", "label", "value"])) return false;
    if (!isNonBlank(field["key"]) || !isNonBlank(field["label"]) || typeof field["value"] !== "string") return false;
    if (keys.has(field["key"])) return false;
    keys.add(field["key"]);
  }
  const metadata = value["metadata"];
  return hasOnlyKeys(metadata, ["generatedAt", "version", "requestId", "resultType"])
    && isNonBlank(metadata["generatedAt"])
    && metadata["version"] === "1"
    && isNonBlank(metadata["requestId"])
    && results.has(metadata["resultType"] as PublicationPresentationResult)
    && metadata["resultType"] === value["presentationResult"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isNonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
