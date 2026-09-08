import assert from "node:assert/strict";
import test from "node:test";

import { validateAiResult } from "./ai-result-validator.js";

const input = Object.freeze({ type: "RawSource", id: "raw-source-1", version: 1, checksum: "sha256-input-1" });
const subjectRef = Object.freeze({ entityType: input.type, entityId: input.id, version: String(input.version) });
const confidence = (band: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN") => Object.freeze({ band, reasonCodes: ["EVIDENCE_BOUND"], policyVersion: "ai-policy-v1" });

function listingEnvelope(band: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" = "MEDIUM") {
  const outputConfidence = confidence(band);
  return { schemaVersion: "1.0", schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1", capabilityId: "AI-001", subjectRef, provenance: [subjectRef], inputChecksum: input.checksum, classification: "CONFIDENTIAL_BUSINESS", output: { capabilityId: "AI-001", inputRef: subjectRef, fields: [{ fieldName: "address", valueState: "PRESENT", normalizedValue: "candidate", evidenceRefs: [{ sourceRef: subjectRef, evidenceLocator: "field:address" }], confidence: outputConfidence }], warnings: [], overallConfidence: outputConfidence } } as const;
}

function normalizationEnvelope() {
  const outputConfidence = confidence("LOW");
  const propertyRef = { entityType: "Property", entityId: "property-1", version: "3" } as const;
  return { schemaVersion: "1.0", schemaId: "urn:ai-mls:schema:property-normalization-output:v0.1", capabilityId: "AI-002", subjectRef, provenance: [subjectRef, propertyRef], inputChecksum: input.checksum, classification: "CONFIDENTIAL_BUSINESS", output: { capabilityId: "AI-002", inputRef: subjectRef, outcome: "UNRESOLVED", candidates: [{ entityRef: propertyRef, entityType: "PROPERTY", evidenceRefs: [{ sourceRef: subjectRef, evidenceLocator: "field:property" }], contradictions: [], confidence: outputConfidence }], ambiguities: ["unit is missing"], overallConfidence: outputConfidence } } as const;
}

const request = (capabilityId: "AI-001" | "AI-002", schemaId: "urn:ai-mls:schema:listing-parser-output:v0.1" | "urn:ai-mls:schema:property-normalization-output:v0.1", result: unknown) => ({ capabilityId, schemaId, expectedInput: input, inputClassifications: ["CONFIDENTIAL_BUSINESS"] as const, result });

test("TEST-039 accepts canonical advisory listing extraction with evidence", () => {
  assert.deepEqual(validateAiResult(request("AI-001", "urn:ai-mls:schema:listing-parser-output:v0.1", listingEnvelope())), { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" });
});

test("TEST-039 rejects authority fields, stale evidence, checksum mismatch, and legacy shapes", () => {
  const canonical = listingEnvelope();
  assert.equal(validateAiResult(request("AI-001", canonical.schemaId, { ...canonical, output: { ...canonical.output, publicationCommand: true } })).reasonCode, "PROHIBITED_AUTHORITY_FIELD");
  assert.equal(validateAiResult(request("AI-001", canonical.schemaId, { ...canonical, subjectRef: { ...subjectRef, version: "2" } })).reasonCode, "EVIDENCE_MISMATCH");
  assert.equal(validateAiResult({ ...request("AI-001", canonical.schemaId, canonical), expectedInput: { ...input, checksum: "sha256-other" } }).reasonCode, "EVIDENCE_MISMATCH");
  assert.equal(validateAiResult(request("AI-001", canonical.schemaId, { input, confidence: "HIGH", fields: [] })).status, "REJECTED");
});

test("TEST-039 unknown confidence fails closed to manual fallback", () => {
  assert.deepEqual(validateAiResult(request("AI-001", "urn:ai-mls:schema:listing-parser-output:v0.1", listingEnvelope("UNKNOWN"))), { status: "REJECTED", route: "MANUAL_FALLBACK", reasonCode: "CONFIDENCE_UNRESOLVED" });
});

test("TEST-040 preserves unresolved property ambiguity without mutation", () => {
  const canonical = normalizationEnvelope();
  const decision = validateAiResult(request("AI-002", canonical.schemaId, canonical));
  assert.equal(decision.status, "VALID");
  assert.equal(decision.route, "MANUAL_CORRECTION_REQUIRED");
  assert.equal(validateAiResult(request("AI-002", canonical.schemaId, { ...canonical, output: { ...canonical.output, createCanonicalProperty: true } })).reasonCode, "PROHIBITED_AUTHORITY_FIELD");
});
