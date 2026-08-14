import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { MatchingService, type CandidateMatchSnapshot, type RequirementMatchSnapshot } from "./matching-service.js";

const clock = (): Date => new Date("2026-07-19T08:00:00.000Z");
function actor(overrides: Partial<SessionContext> = {}): SessionContext { return Object.freeze({ id: "session-match", principalId: "agent-match", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T07:00:00.000Z", expiresAt: "2026-07-19T09:00:00.000Z", absoluteExpiresAt: "2026-07-19T10:00:00.000Z", familyId: "family-match", refreshReference: "refresh-match", ...overrides }); }
const requirement: RequirementMatchSnapshot = Object.freeze({ id: "requirement-match", version: 3, teamId: "team-a", status: "ACTIVE", classification: "RESTRICTED_PERSONAL", locations: ["loc-a"], propertyTypes: ["APARTMENT"], budget: { lower: 900, upper: 1100 }, bedrooms: { minimum: 2 }, area: { minimum: 70 }, optionalPreferences: ["BALCONY", "PARKING"], hardCriteria: ["LOCATION", "PROPERTY_TYPE", "BEDROOMS"] as const });
function candidate(id: string, overrides: Partial<CandidateMatchSnapshot> = {}): CandidateMatchSnapshot { return Object.freeze({ id, version: 1, teamId: "team-a", status: "candidate", classification: "CONFIDENTIAL_BUSINESS", offerId: `offer-${id}`, offerVersion: 1, offerStatus: "active", locationId: "loc-a", propertyType: "APARTMENT", price: 1000, bedrooms: 2, area: 80, optionalPreferences: ["BALCONY", "PARKING"], unresolvedCritical: false, ...overrides }); }
function fixture() {
  let sequence = 0;
  const audit = new AuditLog({ clock, idFactory: () => `audit-match-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [
    { id: "assignment-match-agent", principalId: "agent-match", role: "AGT", teamIds: ["team-a"], resourceTypes: ["MatchRun", "MatchResult"], purposes: ["CLIENT_MATCHING"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
    { id: "assignment-match-service", principalId: "service-match", role: "SVC", teamIds: ["team-a"], resourceTypes: ["MatchRun", "MatchResult"], purposes: ["CLIENT_MATCHING"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
  ];
  const authorization = new AuthorizationService({ assignments, authoritySource: "STATIC_TEST_COMPATIBILITY", auditSink: audit, clock, policyVersion: "authorization-v1" });
  return { service: new MatchingService({ authorizationService: authorization, auditSink: audit, clock, idFactory: () => `match-object-${String(++sequence)}`, policyVersion: "matching-policy-v1" }), audit };
}
function context() { return { actor: actor(), purpose: "CLIENT_MATCHING", correlationId: "correlation-match" } as const; }

test("TEST-019 FEAT-011 applies hard eligibility before deterministic weighted ranking", () => {
  const { service } = fixture();
  const run = service.requestMatch({ ...context(), requirement, candidates: [candidate("candidate-b", { optionalPreferences: ["BALCONY"] }), candidate("candidate-a"), candidate("candidate-ineligible", { locationId: "loc-b" })], idempotencyKey: "match-run-1" });
  assert.equal(run.status, "REVIEW_REQUIRED"); assert.equal(run.cohortSize, 2);
  assert.deepEqual(run.results.map((result) => result.candidateRef.id), ["candidate-a", "candidate-b"]);
  assert.equal(run.results[0]?.score, 100);
  assert.deepEqual(run.results[0]?.components.map((item) => [item.factor, item.weight]), [["LOCATION", 30], ["PROPERTY_TYPE", 25], ["BUDGET", 20], ["BEDROOMS", 15], ["AREA", 5], ["OPTIONAL_PREFERENCES", 5]]);
  assert.equal(run.results.every((result) => result.authority === "ADVISORY" && result.hardEligibility === "PASS"), true);
});

test("TEST-043 equal scores resolve by budget fit, listing revision, then stable UUID", () => {
  const { service } = fixture();
  const run = service.requestMatch({ ...context(), requirement, candidates: [candidate("uuid-z-budget-better", { version: 1, optionalPreferences: [] }), candidate("uuid-a-budget-worse", { version: 1, price: 1467 }), candidate("uuid-b", { version: 2 }), candidate("uuid-a", { version: 2 }), candidate("uuid-new", { version: 5 })], idempotencyKey: "tie-run" });
  assert.deepEqual(run.results.map((item) => item.candidateRef.id), ["uuid-new", "uuid-a", "uuid-b", "uuid-z-budget-better", "uuid-a-budget-worse"]);
  assert.deepEqual(run.results.map((item) => item.rank), [1, 2, 3, 4, 5]);
});

test("TEST-031 cohort is eligible-only, bounded to 100, and review list is top 20", () => {
  const { service } = fixture();
  const oneHundred = Array.from({ length: 100 }, (_, index) => candidate(`candidate-${String(index).padStart(3, "0")}`));
  const run = service.requestMatch({ ...context(), requirement, candidates: [...oneHundred, candidate("withdrawn", { status: "withdrawn" })], idempotencyKey: "cohort-run" });
  assert.equal(run.cohortSize, 100); assert.equal(run.reviewResults.length, 20);
  assert.throws(() => service.requestMatch({ ...context(), requirement, candidates: [...oneHundred, candidate("candidate-101")], idempotencyKey: "cohort-too-large" }), /MATCH_COHORT_LIMIT_EXCEEDED/u);
});

test("TEST-019/031 review and staleness append immutable versions without granting downstream authority", () => {
  const { service } = fixture(); const run = service.requestMatch({ ...context(), requirement, candidates: [candidate("candidate-review")], idempotencyKey: "review-run" }); const original = run.results[0]; assert.ok(original);
  const accepted = service.reviewResult({ ...context(), resultId: original.id, expectedVersion: 1, decision: "ACCEPTED", reason: "Evidence reviewed for internal shortlist" });
  assert.equal(accepted.status, "ACCEPTED"); assert.equal(accepted.authority, "ADVISORY"); assert.equal("verification" in accepted, false); assert.equal("permission" in accepted, false);
  const stale = service.markStale({ ...context(), resultId: accepted.id, expectedVersion: 2, reason: "Requirement revision changed" });
  assert.equal(stale.status, "STALE"); assert.equal(service.readResultHistory({ ...context(), resultId: stale.id }).length, 3); assert.equal(Object.isFrozen(service.readResultHistory({ ...context(), resultId: stale.id })), true);
  assert.throws(() => service.reviewResult({ ...context(), resultId: stale.id, expectedVersion: 3, decision: "ACCEPTED", reason: "Do not reuse stale" }), /MATCH_INPUT_STALE/u);
});

test("TEST-045 AI-005 explanation validation is closed-schema advisory-only", () => {
  const { service } = fixture(); const run = service.requestMatch({ ...context(), requirement, candidates: [candidate("candidate-ai")], idempotencyKey: "ai-run" }); const result = run.results[0]; assert.ok(result);
  const envelope = { schemaVersion: "1.0", capabilityId: "AI-005", subjectRef: { entityType: "MatchResult", entityId: result.id, version: result.version }, provenance: [{ entityType: "MatchResult", entityId: result.id, version: result.version }], classification: "RESTRICTED_PERSONAL", confidence: { band: "HIGH", reasonCodes: ["STRUCTURED_FACTORS"], policyVersion: "confidence-contract-v1" }, output: { requirementRef: result.requirementRef, candidateRef: result.candidateRef, hardConstraintOutcome: "PASS", factors: result.components, explanation: "Grounded advisory explanation." } } as const;
  assert.equal(service.validateExplanation({ ...context(), resultId: result.id, expectedVersion: 1, capabilityId: "AI-005", result: envelope }).status, "VALID"); assert.equal(service.readResult({ ...context(), resultId: result.id }).version, 1);
  assert.equal(service.validateExplanation({ ...context(), resultId: result.id, expectedVersion: 1, capabilityId: "AI-005", result: { ...envelope, output: { ...envelope.output, approve: true } } }).status, "REJECTED");
});

test("TEST-038 security defaults deny cross-team/service review and never stores Contact fields", () => {
  const { service, audit } = fixture(); const run = service.requestMatch({ ...context(), requirement, candidates: [candidate("candidate-private")], idempotencyKey: "privacy-run" }); const result = run.results[0]; assert.ok(result);
  assert.equal(JSON.stringify(run).match(/phone|email|contactValue/giu), null);
  assert.throws(() => service.readResult({ ...context(), actor: actor({ teamId: "team-b" }), resultId: result.id }), /MATCH_RESULT_NOT_FOUND/u);
  const serviceActor = actor({ id: "session-service-match", principalId: "service-match", principalType: "SERVICE", roles: ["SVC"] });
  assert.throws(() => service.reviewResult({ ...context(), actor: serviceActor, resultId: result.id, expectedVersion: 1, decision: "ACCEPTED", reason: "Service cannot approve" }), /HUMAN_AUTHORITY_REQUIRED|CAPABILITY_DENIED/u);
  assert.equal(JSON.stringify(audit.query({ requesterId: "security-review", purpose: "AUDIT_INTEGRITY" })).match(/phone|email|contactValue/giu), null);
});
