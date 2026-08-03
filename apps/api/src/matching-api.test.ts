import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { MatchResult, MatchRun } from "../../../modules/matching/src/matching-service.js";
import { MatchingApi, type MatchingApiDependencies } from "./matching-api.js";
import { composeApiModulesBeforePublication, type ApiModuleDependencies } from "./composition.js";

const actor: SessionContext = Object.freeze({ id: "session-api-match", principalId: "agent-api-match", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T07:00:00.000Z", expiresAt: "2026-07-19T09:00:00.000Z", absoluteExpiresAt: "2026-07-19T10:00:00.000Z", familyId: "family-api-match", refreshReference: "refresh-api-match" });
const result: MatchResult = { id: "match-result-api", version: 1, runId: "match-run-api", teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", classification: "RESTRICTED_PERSONAL", requirementRef: { id: "requirement-api", version: 2 }, candidateRef: { id: "candidate-api", version: 3 }, offerRef: { id: "offer-api", version: 1 }, hardEligibility: "PASS", hardMatchCount: 3, score: 95, budgetFit: 100, rank: 1, components: [], explanation: { kind: "DETERMINISTIC", reasonCodes: ["LOCATION_MATCH"], limitations: [] }, matcherVersion: "deterministic-matching-v1", policyVersion: "matching-policy-v1", calculatedAt: "2026-07-19T08:00:00.000Z", reviewHistory: [] };
const run: MatchRun = Object.freeze({ id: "match-run-api", version: 1, teamId: "team-a", status: "REVIEW_REQUIRED", authority: "ADVISORY", requirementRef: { id: "requirement-api", version: 2 }, cohortSize: 1, results: [result], reviewResults: [result], requestedBy: actor.principalId, calculatedAt: "2026-07-19T08:00:00.000Z", policyVersion: "matching-policy-v1" });

function dependencies(seen: SessionContext[], fail = false): MatchingApiDependencies {
  return { sessionReader: () => actor, matchingInputResolver: { resolve: (request) => { seen.push(request.actor); return { requirement: {} as never, candidates: [] }; } }, matchingService: {
    requestMatch: (request) => { seen.push(request.actor); if (fail) throw new Error("REQUIREMENT_NOT_ACTIVE"); return run; },
    readRun: (request) => { seen.push(request.actor); return run; }, readResult: () => result, readResultHistory: () => [result],
    reviewResult: (request) => ({ ...result, version: 2, status: request.decision, reviewHistory: [{ actorId: request.actor.principalId, status: request.decision, reason: request.reason, occurredAt: "2026-07-19T08:00:00.000Z" }] }),
    markStale: () => ({ ...result, version: 2, status: "STALE", staleReason: "Input changed" }),
    validateExplanation: () => ({ status: "VALID", route: "HUMAN_REVIEW_REQUIRED" }),
  } };
}

test("TEST-031 API-010 derives Actor from session and exposes bounded UI-024 review state", () => {
  const seen: SessionContext[] = []; const api = new MatchingApi(dependencies(seen));
  const response = api.requestMatch({ context: { sessionId: actor.id, correlationId: "correlation-api-match" }, requirementRef: { id: "requirement-api", version: 2 }, candidateRefs: [{ id: "candidate-api", version: 3 }], idempotencyKey: "api-match", purpose: "CLIENT_MATCHING", actor: { principalId: "forged" }, requirement: { status: "ACTIVE" } } as unknown as Parameters<MatchingApi["requestMatch"]>[0]);
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.data.screenId, "UI-024"); assert.equal(response.data.presentationState, "REVIEW_REQUIRED"); assert.equal(response.data.reviewResults.length, 1);
    assert.deepEqual(response.data.allowedActions, ["READ", "REQUEST_MATCH", "REVIEW", "MARK_STALE"]);
    assert.equal(response.data.accessibility.keyboardOperable, true); assert.equal(response.data.accessibility.liveRegion, "polite"); assert.equal(JSON.stringify(response.data).includes("contact"), false);
  }
  assert.deepEqual(seen, [actor, actor]);
});

test("TEST-038/055 UI-024 hides review actions from read-only roles while server authorization remains authoritative", () => {
  const manager = Object.freeze({ ...actor, roles: ["MGR"] as const }); const api = new MatchingApi({ ...dependencies([]), sessionReader: () => manager });
  const response = api.readRun({ context: { sessionId: manager.id, correlationId: "correlation-api-manager" }, runId: run.id, purpose: "CLIENT_MATCHING" });
  assert.equal(response.ok, true); if (response.ok) assert.deepEqual(response.data.allowedActions, ["READ"]);
});

test("TEST-038/054 UI-024 represents empty and stale states without downstream Proposal actions", () => {
  const empty: MatchRun = Object.freeze({ ...run, status: "EMPTY", cohortSize: 0, results: [], reviewResults: [] });
  const api = new MatchingApi({ ...dependencies([]), matchingService: { ...dependencies([]).matchingService, readRun: () => empty } });
  const emptyResponse = api.readRun({ context: { sessionId: actor.id, correlationId: "correlation-api-empty" }, runId: empty.id, purpose: "CLIENT_MATCHING" });
  const staleResponse = api.markStale({ context: { sessionId: actor.id, correlationId: "correlation-api-stale" }, resultId: result.id, expectedVersion: 1, reason: "Input changed", purpose: "CLIENT_MATCHING" });
  assert.equal(emptyResponse.ok && emptyResponse.data.presentationState, "EMPTY"); assert.equal(staleResponse.ok && staleResponse.data.presentationState, "STALE");
  if (staleResponse.ok) assert.equal(staleResponse.data.allowedActions.includes("GENERATE_PROPOSAL" as never), false);
});

test("API-010 returns safe errors for missing session and inactive Requirement", () => {
  const api = new MatchingApi(dependencies([], true));
  const noSession = api.readRun({ context: { correlationId: "correlation-no-session" }, runId: run.id, purpose: "CLIENT_MATCHING" });
  const inactive = api.requestMatch({ context: { sessionId: actor.id, correlationId: "correlation-inactive" }, requirementRef: { id: "requirement-api", version: 2 }, candidateRefs: [], idempotencyKey: "inactive", purpose: "CLIENT_MATCHING" });
  assert.equal(noSession.ok, false); assert.equal(inactive.ok, false); if (!inactive.ok) assert.equal(inactive.error.code, "REQUIREMENT_NOT_ACTIVE");
});

test("SP-005 composition adds API-010 without replacing SP-001–004 modules", () => {
  const composed = composeApiModulesBeforePublication({ sessionService: { readSession: () => actor }, matchingService: dependencies([]).matchingService, matchingInputResolver: dependencies([]).matchingInputResolver, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {} } as unknown as ApiModuleDependencies);
  assert.ok(composed.matching instanceof MatchingApi); assert.ok("identity" in composed); assert.ok("contactClient" in composed);
});
