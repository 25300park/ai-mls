import type { JobInputReference } from "./job-service.js";

export type AiCapabilityId = "AI-001" | "AI-002";
export type AiResultRoute = "HUMAN_REVIEW_REQUIRED" | "MANUAL_FALLBACK";

export interface AiValidationDecision {
  readonly status: "VALID" | "REJECTED";
  readonly route: AiResultRoute;
  readonly reasonCode?: string;
}

interface ValidateAiResultRequest {
  readonly capabilityId: AiCapabilityId;
  readonly schemaId:
    | "AI_LISTING_PARSE_RESULT_V1"
    | "AI_PROPERTY_NORMALIZATION_RESULT_V1";
  readonly expectedInput: JobInputReference;
  readonly result: unknown;
}

const prohibitedAuthorityKeys = new Set([
  "verificationApproved",
  "publicationCommand",
  "createCanonicalProperty",
  "approveListing",
  "publish",
]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsProhibitedAuthority(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsProhibitedAuthority);
  }
  if (!record(value)) {
    return false;
  }
  return Object.entries(value).some(
    ([key, nested]) => prohibitedAuthorityKeys.has(key) || containsProhibitedAuthority(nested),
  );
}

function sameReference(value: unknown, expected: JobInputReference): boolean {
  return record(value) &&
    value["type"] === expected.type &&
    value["id"] === expected.id &&
    value["version"] === expected.version &&
    value["checksum"] === expected.checksum;
}

function rejected(reasonCode: string): AiValidationDecision {
  return Object.freeze({ status: "REJECTED", route: "MANUAL_FALLBACK", reasonCode });
}

export function validateAiResult(request: ValidateAiResultRequest): AiValidationDecision {
  if (containsProhibitedAuthority(request.result)) {
    return rejected("PROHIBITED_AUTHORITY_FIELD");
  }
  if (!record(request.result) || !sameReference(request.result["input"], request.expectedInput)) {
    return rejected("EVIDENCE_MISMATCH");
  }
  const confidence = request.result["confidence"];
  if (confidence === "UNKNOWN" || !["HIGH", "MEDIUM", "LOW"].includes(String(confidence))) {
    return rejected("CONFIDENCE_UNRESOLVED");
  }

  if (request.capabilityId === "AI-001") {
    if (
      request.schemaId !== "AI_LISTING_PARSE_RESULT_V1" ||
      !Array.isArray(request.result["fields"]) ||
      request.result["fields"].some((field) =>
        !record(field) ||
        typeof field["name"] !== "string" ||
        !("value" in field) ||
        !sameReference(field["evidence"], request.expectedInput)
      )
    ) {
      return rejected("AI_RESULT_SCHEMA_INVALID");
    }
  } else if (
    request.schemaId !== "AI_PROPERTY_NORMALIZATION_RESULT_V1" ||
    !["MATCHED", "UNRESOLVED"].includes(String(request.result["resolution"])) ||
    !Array.isArray(request.result["candidates"]) ||
    request.result["candidates"].some((candidate) =>
      !record(candidate) ||
      typeof candidate["propertyId"] !== "string" ||
      !Number.isInteger(candidate["version"]) ||
      Number(candidate["version"]) < 1
    )
  ) {
    return rejected("AI_RESULT_SCHEMA_INVALID");
  }

  return Object.freeze({ status: "VALID", route: "HUMAN_REVIEW_REQUIRED" });
}
