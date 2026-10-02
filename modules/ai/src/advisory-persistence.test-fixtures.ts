import type { AcceptedAdvisoryRecord, AdvisoryPromptRecord } from "./advisory-runtime-contracts.js";

export const advisoryTestPrompt = Object.freeze<AdvisoryPromptRecord>({
  promptId: "PRM-AI-001-001",
  promptVersion: "v1.0",
  capabilityId: "AI-001",
  schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
  contentFingerprint: "sha256:prompt-fixture-001",
  status: "ACTIVE",
  createdAt: "2026-09-09T01:00:00.000Z",
});
const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-022-c", version: "4" });
const confidence = Object.freeze({ band: "MEDIUM" as const, reasonCodes: ["REVIEW_REQUIRED"], policyVersion: "ai-policy-v1" });

export function acceptedAdvisoryFixture(): AcceptedAdvisoryRecord {
  return Object.freeze<AcceptedAdvisoryRecord>({
    advisoryId: "advisory-022-c-001",
    tenantId: "tenant-a",
    scopeRef: "team:team-a",
    capabilityId: "AI-001",
    schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
    inputFingerprint: "sha256:input-001",
    evidenceFingerprint: "sha256:evidence-001",
    inputClassifications: ["CONFIDENTIAL_BUSINESS"],
    promptId: advisoryTestPrompt.promptId,
    promptVersion: advisoryTestPrompt.promptVersion,
    adapterVersion: "deterministic-advisory-v1",
    executionFingerprint: "sha256:execution-001",
    envelope: {
      schemaVersion: "1.0",
      schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1",
      capabilityId: "AI-001",
      subjectRef: subject,
      provenance: [subject],
      classification: "CONFIDENTIAL_BUSINESS",
      output: { capabilityId: "AI-001", inputRef: subject, fields: [{ fieldName: "propertyName", valueState: "PRESENT", normalizedValue: "Example Tower", evidenceRefs: [{ sourceRef: subject, evidenceLocator: "field:propertyName" }], confidence }], warnings: [], overallConfidence: confidence },
    },
    validationResult: { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" },
    generatedAt: "2026-09-09T01:01:00.000Z",
    reviewRequired: true,
    reviewEvidenceRef: "advisory:advisory-022-c-001:review-required",
    authority: "ADVISORY",
  });
}
