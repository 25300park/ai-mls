import assert from "node:assert/strict";
import test from "node:test";

import { validateAiResult } from "./ai-result-validator.js";

const input = Object.freeze({
  type: "RawSource",
  id: "raw-source-1",
  version: 1,
  checksum: "sha256-input-1",
});

test("TEST-039 accepts advisory listing extraction with evidence", () => {
  const decision = validateAiResult({
    capabilityId: "AI-001",
    schemaId: "AI_LISTING_PARSE_RESULT_V1",
    expectedInput: input,
    result: {
      input,
      confidence: "MEDIUM",
      fields: [{ name: "address", value: "candidate", evidence: input }],
      ambiguities: [],
    },
  });

  assert.deepEqual(decision, {
    status: "VALID",
    route: "HUMAN_REVIEW_REQUIRED",
  });
});

test("TEST-039 rejects authority fields and stale evidence", () => {
  assert.deepEqual(validateAiResult({
    capabilityId: "AI-001",
    schemaId: "AI_LISTING_PARSE_RESULT_V1",
    expectedInput: input,
    result: { input, confidence: "HIGH", fields: [], publicationCommand: true },
  }).reasonCode, "PROHIBITED_AUTHORITY_FIELD");

  assert.deepEqual(validateAiResult({
    capabilityId: "AI-001",
    schemaId: "AI_LISTING_PARSE_RESULT_V1",
    expectedInput: input,
    result: {
      input: { ...input, version: 2 },
      confidence: "HIGH",
      fields: [],
    },
  }).reasonCode, "EVIDENCE_MISMATCH");
});

test("TEST-039 unknown confidence fails closed to manual fallback", () => {
  assert.deepEqual(validateAiResult({
    capabilityId: "AI-001",
    schemaId: "AI_LISTING_PARSE_RESULT_V1",
    expectedInput: input,
    result: { input, confidence: "UNKNOWN", fields: [] },
  }), {
    status: "REJECTED",
    route: "MANUAL_FALLBACK",
    reasonCode: "CONFIDENCE_UNRESOLVED",
  });
});

test("TEST-040 preserves unresolved property ambiguity without mutation", () => {
  const decision = validateAiResult({
    capabilityId: "AI-002",
    schemaId: "AI_PROPERTY_NORMALIZATION_RESULT_V1",
    expectedInput: input,
    result: {
      input,
      confidence: "LOW",
      resolution: "UNRESOLVED",
      candidates: [{ propertyId: "property-1", version: 3 }],
      ambiguities: ["unit is missing"],
    },
  });
  assert.equal(decision.status, "VALID");
  assert.equal(decision.route, "HUMAN_REVIEW_REQUIRED");

  assert.deepEqual(validateAiResult({
    capabilityId: "AI-002",
    schemaId: "AI_PROPERTY_NORMALIZATION_RESULT_V1",
    expectedInput: input,
    result: {
      input,
      confidence: "HIGH",
      resolution: "MATCHED",
      candidates: [],
      createCanonicalProperty: true,
    },
  }).reasonCode, "PROHIBITED_AUTHORITY_FIELD");
});
