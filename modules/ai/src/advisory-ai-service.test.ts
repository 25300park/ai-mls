import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { AdvisoryAiService, validateAdvisoryResult, type AdvisoryResultEnvelope, type AiCapabilityId } from "./advisory-ai-service.js";

const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-1", version: "2" });
const provenance = Object.freeze([subject]);
const confidence = Object.freeze({ band: "MEDIUM", reasonCodes: ["AMBIGUOUS_INPUT"], policyVersion: "ai-policy-v1" });
const schemaIds = Object.freeze({
  "AI-001": "urn:ai-mls:schema:listing-parser-output:v0.1",
  "AI-002": "urn:ai-mls:schema:property-normalization-output:v0.1",
  "AI-003": "urn:ai-mls:schema:duplicate-detection-output:v0.1",
  "AI-004": "urn:ai-mls:schema:requirement-parser-output:v0.1",
  "AI-005": "urn:ai-mls:schema:matching-result:v0.1",
  "AI-006": "urn:ai-mls:schema:search-interpretation-output:v0.1",
  "AI-007": "urn:ai-mls:schema:confidence-result:v0.1",
} as const);

function output(capabilityId: AiCapabilityId): Readonly<Record<string, unknown>> {
  switch (capabilityId) {
    case "AI-001": return { capabilityId, inputRef: subject, fields: [{ fieldName: "propertyName", valueState: "PRESENT", rawValue: "Example Tower", normalizedValue: "Example Tower", evidenceRefs: [{ sourceRef: subject, evidenceLocator: "text:0-13" }], confidence }], warnings: [], overallConfidence: confidence };
    case "AI-002": return { capabilityId, inputRef: subject, outcome: "UNRESOLVED", candidates: [{ entityRef: { entityType: "Property", entityId: "property-1", version: "1" }, entityType: "PROPERTY", evidenceRefs: [{ sourceRef: subject, evidenceLocator: "record:1" }], contradictions: [], confidence }], ambiguities: ["unit missing"], overallConfidence: confidence };
    case "AI-003": return { capabilityId, comparedRefs: [subject, { entityType: "CandidateListing", entityId: "candidate-2", version: "1" }], relationship: "UNCERTAIN", recommendation: "NEEDS_MORE_EVIDENCE", signals: [{ signalType: "alias", direction: "NEUTRAL", explanation: "Alias alone is inconclusive" }], contradictions: [], confidence };
    case "AI-004": return { capabilityId, inputRef: subject, intent: "RENT", budget: { valueState: "MISSING", confidence }, locations: [{ rawText: "Gangnam", constraintType: "SOFT", confidence }], propertyTypes: ["OFFICE"], preferences: [{ criterion: "parking", value: true, constraintType: "SOFT", confidence }], clarificationNeeds: ["budget missing"], overallConfidence: confidence };
    case "AI-005": return { capabilityId, requirementRef: subject, candidateRef: { entityType: "CandidateListing", entityId: "candidate-1", version: "1" }, cohortRef: "cohort-1", factors: [{ factor: "budget", kind: "HARD", outcome: "PASS", score: 1, weight: 1, explanation: "Within budget" }], hardConstraintOutcome: "PASS", score: 1, rank: 1, explanation: "Advisory match", confidence };
    case "AI-006": return { capabilityId, intent: "PROPERTY_DISCOVERY", filters: [{ field: "propertyName", operator: "CONTAINS", value: "Tower", negated: false }], sort: [{ field: "updatedAt", direction: "DESC" }], requestedResultClass: "INTERNAL_CANDIDATE", unresolvedTerms: [], warnings: [], confidence };
    case "AI-007": return { capabilityId, subjectRef: subject, overallConfidence: confidence, fieldConfidences: { propertyName: confidence }, validationOutcome: "HUMAN_REVIEW_REQUIRED", reviewRoute: "NORMAL_REVIEW" };
  }
}

function result(capabilityId: AiCapabilityId): AdvisoryResultEnvelope {
  const capabilityOutput = output(capabilityId);
  const boundProvenance = capabilityId === "AI-002"
    ? [...provenance, (capabilityOutput["candidates"] as readonly Record<string, unknown>[])[0]!["entityRef"]]
    : capabilityId === "AI-003"
      ? [...provenance, ...(capabilityOutput["comparedRefs"] as readonly unknown[])]
      : capabilityId === "AI-005"
        ? [...provenance, capabilityOutput["requirementRef"], capabilityOutput["candidateRef"]]
        : provenance;
  return { schemaVersion: "1.0", schemaId: schemaIds[capabilityId], capabilityId, subjectRef: subject, provenance: boundProvenance, classification: "CONFIDENTIAL_BUSINESS", output: capabilityOutput } as unknown as AdvisoryResultEnvelope;
}

test("TEST-039–045 validate every provider-neutral AI capability contract", () => {
  const valid = [
    result("AI-001"), result("AI-002"), result("AI-003"), result("AI-004"), result("AI-005"), result("AI-006"), result("AI-007"),
  ];

  for (const envelope of valid) {
    assert.equal(validateAdvisoryResult({
      expectedCapabilityId: envelope.capabilityId,
      expectedSubject: subject,
      inputClassifications: ["INTERNAL", "CONFIDENTIAL_BUSINESS"],
      result: envelope,
    }).status, "VALID", envelope.capabilityId);
  }
});

test("TEST-007 and TEST-045 reject authority, hallucinated fields, stale evidence and declassification", () => {
  const authoritative = { ...result("AI-001"), output: { ...output("AI-001"), publicationCommand: true } };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: authoritative }).reasonCode, "PROHIBITED_AUTHORITY_FIELD");

  const openSchema = { ...result("AI-006"), providerSecret: "not-allowed" };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-006", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: openSchema }).reasonCode, "AI_RESULT_SCHEMA_INVALID");

  const stale = { ...result("AI-003"), subjectRef: { ...subject, version: "3" } };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-003", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: stale }).reasonCode, "EVIDENCE_MISMATCH");

  const detached = { ...result("AI-002"), provenance: [{ entityType: "RawSource", entityId: "raw-other", version: "1" }] };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-002", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: detached }).reasonCode, "EVIDENCE_MISMATCH");

  const declassified = { ...result("AI-004"), classification: "INTERNAL" as const };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-004", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: declassified }).reasonCode, "CLASSIFICATION_DOWNGRADE_DENIED");
});

test("TEST-013 routes confidence bands without numeric thresholds", () => {
  for (const [band, route] of [["HIGH", "HUMAN_REVIEW_REQUIRED"], ["MEDIUM", "HUMAN_REVIEW_REQUIRED"], ["LOW", "MANUAL_CORRECTION_REQUIRED"], ["UNKNOWN", "MANUAL_FALLBACK"]] as const) {
    const envelope = { ...result("AI-007"), output: { ...output("AI-007"), overallConfidence: { band, reasonCodes: ["POLICY_ROUTE"], policyVersion: "ai-policy-v1" } } };
    assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-007", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: envelope }).route, route);
  }
});

function aiFixture(): { readonly service: AdvisoryAiService; readonly reviewer: SessionContext } {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => `audit-ai-${String(++sequence)}` });
  const reviewer: SessionContext = Object.freeze({ id: "session-air", principalId: "air-1", principalType: "HUMAN", roles: ["AIR"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T01:00:00.000Z", absoluteExpiresAt: "2026-07-19T02:00:00.000Z", familyId: "family-air", refreshReference: "refresh-air" });
  const assignment: RoleAssignment = { id: "assignment-air", principalId: "air-1", role: "AIR", teamIds: ["team-a"], resourceTypes: ["AiResult"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" };
  const authorizationService = new AuthorizationService({ assignments: [assignment], authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit, clock, policyVersion: "auth-v1" });
  return { reviewer, service: new AdvisoryAiService({ authorizationService, auditSink: audit, clock, idFactory: () => `ai-${String(++sequence)}`, policyVersion: "ai-policy-v1" }) };
}

test("TEST-013 human AI review is append-only and never authoritative", () => {
  const { service, reviewer } = aiFixture();
  const envelope = result("AI-001");
  const stored = service.recordValidated({ validation: validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: envelope }), envelope, correlationId: "correlation-ai-record" });
  const reviewed = service.review({ actor: reviewer, resultId: stored.id, expectedVersion: stored.version, decision: "ACCEPTED_AS_DRAFT", reason: "Reviewed against exact source version", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-ai-review" });
  assert.equal(reviewed.reviewStatus, "ACCEPTED_AS_DRAFT");
  assert.equal(reviewed.authority, "ADVISORY");
  assert.equal(reviewed.reviewHistory.length, 1);
  assert.equal(Object.isFrozen(reviewed.reviewHistory), true);
  assert.equal(Object.isFrozen(reviewed.provenance[0]), true);
  assert.throws(() => service.review({ actor: reviewer, resultId: stored.id, expectedVersion: stored.version, decision: "ACCEPTED_AS_DRAFT", reason: "stale", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-ai-stale" }), /VERSION_CONFLICT/);
});

test("FEAT-022-B rejects malformed canonical output recursively and fails closed on authority", () => {
  const validate = (value: unknown, capabilityId: AiCapabilityId = "AI-001") => validateAdvisoryResult({ expectedCapabilityId: capabilityId, expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: value });
  const base = structuredClone(result("AI-001")) as unknown as Record<string, unknown>;
  const missing = structuredClone(base); delete (missing["output"] as Record<string, unknown>)["fields"];
  assert.equal(validate(missing).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  assert.equal(validate({ ...base, unknown: true }).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  const nestedUnknown = structuredClone(base); ((nestedUnknown["output"] as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["unknown"] = true;
  assert.equal(validate(nestedUnknown).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  const invalidEnum = structuredClone(base); ((invalidEnum["output"] as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["valueState"] = "UNSUPPORTED";
  assert.equal(validate(invalidEnum).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  const malformedEvidence = structuredClone(base); ((((malformedEvidence["output"] as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["evidenceRefs"] as Record<string, unknown>[])[0]!)["sourceRef"] = { entityType: "RawSource", entityId: "raw-1", version: 2 };
  assert.equal(validate(malformedEvidence).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  const detachedEvidence = structuredClone(base); ((((detachedEvidence["output"] as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!["evidenceRefs"] as Record<string, unknown>[])[0]!)["sourceRef"] = { entityType: "RawSource", entityId: "raw-other", version: "1" };
  assert.equal(validate(detachedEvidence).reasonCode, "EVIDENCE_MISMATCH");
  const invalidConfidence = structuredClone(base); (((invalidConfidence["output"] as Record<string, unknown>)["overallConfidence"] as Record<string, unknown>)["reasonCodes"] as unknown[]) = [];
  assert.equal(validate(invalidConfidence).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  assert.equal(validate({ ...base, schemaId: schemaIds["AI-002"] }).reasonCode, "SCHEMA_CAPABILITY_MISMATCH");
  assert.equal(validate({ ...base, fields: [] }).reasonCode, "WRAPPER_OUTPUT_COLLISION");
  const authority = structuredClone(base); (authority["output"] as Record<string, unknown>)["approval"] = { status: "APPROVED" };
  assert.equal(validate(authority).reasonCode, "PROHIBITED_AUTHORITY_FIELD");
});

test("FEAT-022-B requires every capability schema field and bounds recursive structures", () => {
  const requiredField = { "AI-001": "fields", "AI-002": "outcome", "AI-003": "signals", "AI-004": "budget", "AI-005": "cohortRef", "AI-006": "sort", "AI-007": "fieldConfidences" } as const;
  for (const capabilityId of Object.keys(requiredField) as AiCapabilityId[]) {
    const malformed = structuredClone(result(capabilityId)) as unknown as Record<string, unknown>;
    delete (malformed["output"] as Record<string, unknown>)[requiredField[capabilityId]];
    assert.equal(validateAdvisoryResult({ expectedCapabilityId: capabilityId, expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: malformed }).reasonCode, "AI_RESULT_SCHEMA_INVALID", capabilityId);
  }
  const oversized = structuredClone(result("AI-001")) as unknown as Record<string, unknown>;
  (oversized["output"] as Record<string, unknown>)["warnings"] = Array.from({ length: 1_001 }, () => "bounded");
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: oversized }).reasonCode, "STRUCTURE_BOUNDS_EXCEEDED");
});

test("FEAT-022-B rejects fabricated canonical references and non-JSON numbers", () => {
  for (const capabilityId of ["AI-003", "AI-005"] as const) {
    const fabricated = structuredClone(result(capabilityId)) as unknown as Record<string, unknown>;
    const capabilityOutput = fabricated["output"] as Record<string, unknown>;
    if (capabilityId === "AI-003") capabilityOutput["comparedRefs"] = [{ entityType: "CandidateListing", entityId: "fabricated-1", version: "1" }, { entityType: "CandidateListing", entityId: "fabricated-2", version: "1" }];
    else capabilityOutput["candidateRef"] = { entityType: "CandidateListing", entityId: "fabricated-1", version: "1" };
    assert.equal(validateAdvisoryResult({ expectedCapabilityId: capabilityId, expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: fabricated }).reasonCode, "EVIDENCE_MISMATCH", capabilityId);
  }
  for (const invalidNumber of [Number.NaN, Number.POSITIVE_INFINITY]) {
    const malformed = structuredClone(result("AI-001")) as unknown as Record<string, unknown>;
    (((malformed["output"] as Record<string, unknown>)["fields"] as Record<string, unknown>[])[0]!)["rawValue"] = invalidNumber;
    assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: malformed }).reasonCode, "AI_RESULT_SCHEMA_INVALID");
  }
});
