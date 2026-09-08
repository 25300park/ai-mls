import type { JobInputReference } from "./job-service.js";
import { validateAdvisoryResult, type AdvisoryValidationDecision, type AiCapabilityId as CanonicalAiCapabilityId, type AiSchemaId } from "../../ai/src/advisory-ai-service.js";
import type { DataClassification } from "../../../packages/security-contracts/src/index.js";

export type AiCapabilityId = Extract<CanonicalAiCapabilityId, "AI-001" | "AI-002">;
export type AiResultRoute = AdvisoryValidationDecision["route"];
export type AiValidationDecision = AdvisoryValidationDecision;

interface ValidateAiResultRequest {
  readonly capabilityId: AiCapabilityId;
  readonly schemaId: Extract<AiSchemaId, "urn:ai-mls:schema:listing-parser-output:v0.1" | "urn:ai-mls:schema:property-normalization-output:v0.1">;
  readonly expectedInput: JobInputReference;
  readonly inputClassifications: readonly DataClassification[];
  readonly result: unknown;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function rejected(reasonCode: string): AiValidationDecision {
  return Object.freeze({ status: "REJECTED", route: "MANUAL_FALLBACK", reasonCode });
}

export function validateAiResult(request: ValidateAiResultRequest): AiValidationDecision {
  const decision = validateAdvisoryResult({
    expectedCapabilityId: request.capabilityId,
    expectedSubject: { entityType: request.expectedInput.type, entityId: request.expectedInput.id, version: request.expectedInput.version },
    inputClassifications: request.inputClassifications,
    result: request.result,
  });
  if (decision.reasonCode === "PROHIBITED_AUTHORITY_FIELD") return decision;
  if (!record(request.result) || request.result["schemaId"] !== request.schemaId) {
    return rejected("SCHEMA_CAPABILITY_MISMATCH");
  }
  if (request.result["inputChecksum"] !== request.expectedInput.checksum) {
    return rejected("EVIDENCE_MISMATCH");
  }
  return decision;
}
