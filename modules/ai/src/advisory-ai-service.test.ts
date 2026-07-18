import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { AdvisoryAiService, validateAdvisoryResult, type AdvisoryResultEnvelope } from "./advisory-ai-service.js";

const subject = Object.freeze({ entityType: "RawSource", entityId: "raw-1", version: 2 });
const provenance = Object.freeze([{ entityType: "RawSource", entityId: "raw-1", version: 2 }]);

function result(capabilityId: `AI-00${1 | 2 | 3 | 4 | 5 | 6 | 7}`, output: Readonly<Record<string, unknown>>): AdvisoryResultEnvelope {
  return {
    schemaVersion: "1.0",
    capabilityId,
    subjectRef: subject,
    provenance,
    classification: "CONFIDENTIAL_BUSINESS" as const,
    confidence: { band: "MEDIUM" as const, reasonCodes: ["AMBIGUOUS_INPUT"], policyVersion: "ai-policy-v1" },
    output,
  };
}

test("TEST-039–045 validate every provider-neutral AI capability contract", () => {
  const valid = [
    result("AI-001", { fields: [{ name: "propertyName", value: "candidate", evidenceRefs: [provenance[0]] }], warnings: [] }),
    result("AI-002", { outcome: "AMBIGUOUS", candidates: [{ recordRef: { entityType: "Property", entityId: "property-1", version: 1 }, confidence: "MEDIUM" }], ambiguities: ["unit missing"] }),
    result("AI-003", { comparedRefs: [{ entityType: "CandidateListing", entityId: "candidate-1", version: 1 }, { entityType: "CandidateListing", entityId: "candidate-2", version: 1 }], relationship: "UNCERTAIN", recommendation: "NEEDS_MORE_EVIDENCE", signals: ["same alias"], contradictions: [] }),
    result("AI-004", { intent: "RENT", constraints: [], clarifications: ["budget missing"] }),
    result("AI-005", { requirementRef: { entityType: "Requirement", entityId: "requirement-1", version: 1 }, candidateRef: { entityType: "CandidateListing", entityId: "candidate-1", version: 1 }, hardConstraintOutcome: "PASS", factors: [], explanation: "advisory only" }),
    result("AI-006", { intent: "PROPERTY_SEARCH", filters: [{ field: "propertyName", operator: "CONTAINS", value: "candidate" }], resultClass: "PROPERTY", unresolved: [], warnings: [] }),
    result("AI-007", { validationOutcome: "REVIEW_REQUIRED", reviewRoute: "HUMAN_REVIEW_REQUIRED", fieldConfidences: [] }),
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
  const authoritative = result("AI-001", { fields: [], publicationCommand: true });
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: authoritative }).reasonCode, "PROHIBITED_AUTHORITY_FIELD");

  const openSchema = { ...result("AI-006", { intent: "PROPERTY_SEARCH", filters: [], resultClass: "PROPERTY", unresolved: [], warnings: [] }), providerSecret: "not-allowed" };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-006", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: openSchema }).reasonCode, "AI_RESULT_SCHEMA_INVALID");

  const stale = { ...result("AI-003", { comparedRefs: [], relationship: "UNCERTAIN", recommendation: "NEEDS_MORE_EVIDENCE", signals: [], contradictions: [] }), subjectRef: { ...subject, version: 3 } };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-003", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: stale }).reasonCode, "EVIDENCE_MISMATCH");

  const detached = { ...result("AI-002", { outcome: "NO_MATCH", candidates: [], ambiguities: [] }), provenance: [{ entityType: "RawSource", entityId: "raw-other", version: 1 }] };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-002", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: detached }).reasonCode, "EVIDENCE_MISMATCH");

  const declassified = { ...result("AI-004", { intent: "RENT", constraints: [], clarifications: [] }), classification: "INTERNAL" as const };
  assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-004", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: declassified }).reasonCode, "CLASSIFICATION_DOWNGRADE_DENIED");
});

test("TEST-013 routes confidence bands without numeric thresholds", () => {
  for (const [band, route] of [["HIGH", "HUMAN_REVIEW_REQUIRED"], ["MEDIUM", "HUMAN_REVIEW_REQUIRED"], ["LOW", "MANUAL_CORRECTION_REQUIRED"], ["UNKNOWN", "MANUAL_FALLBACK"]] as const) {
    const envelope = { ...result("AI-007", { validationOutcome: "REVIEW_REQUIRED", reviewRoute: route, fieldConfidences: [] }), confidence: { band, reasonCodes: ["POLICY_ROUTE"], policyVersion: "ai-policy-v1" } };
    assert.equal(validateAdvisoryResult({ expectedCapabilityId: "AI-007", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: envelope }).route, route);
  }
});

function aiFixture(): { readonly service: AdvisoryAiService; readonly reviewer: SessionContext } {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => `audit-ai-${String(++sequence)}` });
  const reviewer: SessionContext = Object.freeze({ id: "session-air", principalId: "air-1", principalType: "HUMAN", roles: ["AIR"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T01:00:00.000Z", absoluteExpiresAt: "2026-07-19T02:00:00.000Z", familyId: "family-air", refreshReference: "refresh-air" });
  const assignment: RoleAssignment = { id: "assignment-air", principalId: "air-1", role: "AIR", teamIds: ["team-a"], resourceTypes: ["AiResult"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" };
  const authorizationService = new AuthorizationService({ assignments: [assignment], auditSink: audit, clock, policyVersion: "auth-v1" });
  return { reviewer, service: new AdvisoryAiService({ authorizationService, auditSink: audit, clock, idFactory: () => `ai-${String(++sequence)}`, policyVersion: "ai-policy-v1" }) };
}

test("TEST-013 human AI review is append-only and never authoritative", () => {
  const { service, reviewer } = aiFixture();
  const stored = service.recordValidated({ validation: validateAdvisoryResult({ expectedCapabilityId: "AI-001", expectedSubject: subject, inputClassifications: ["CONFIDENTIAL_BUSINESS"], result: result("AI-001", { fields: [], warnings: [] }) }), envelope: result("AI-001", { fields: [], warnings: [] }), correlationId: "correlation-ai-record" });
  const reviewed = service.review({ actor: reviewer, resultId: stored.id, expectedVersion: stored.version, decision: "ACCEPTED_AS_DRAFT", reason: "Reviewed against exact source version", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-ai-review" });
  assert.equal(reviewed.reviewStatus, "ACCEPTED_AS_DRAFT");
  assert.equal(reviewed.authority, "ADVISORY");
  assert.equal(reviewed.reviewHistory.length, 1);
  assert.equal(Object.isFrozen(reviewed.reviewHistory), true);
  assert.equal(Object.isFrozen(reviewed.provenance[0]), true);
  assert.throws(() => service.review({ actor: reviewer, resultId: stored.id, expectedVersion: stored.version, decision: "ACCEPTED_AS_DRAFT", reason: "stale", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-ai-stale" }), /VERSION_CONFLICT/);
});
