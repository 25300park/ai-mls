import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { Verification } from "../../../modules/verification/src/verification-service.js";
import { composeApiModulesBeforePublication, type ApiModuleDependencies } from "./composition.js";
import { VerificationApi, type VerificationApiDependencies } from "./verification-api.js";

const baseActor: SessionContext = Object.freeze({ id: "session-api-verification", principalId: "agent-api-verification", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T07:00:00.000Z", expiresAt: "2026-07-20T08:00:00.000Z", absoluteExpiresAt: "2026-07-21T08:00:00.000Z", familyId: "family-api-verification", refreshReference: "refresh-api-verification" });
const verification: Verification = Object.freeze({ id: "verification-api-1", version: 1, teamId: "team-a", subjectRef: { entityType: "ListingOffer", entityId: "offer-api-1", version: 2 }, matchResultRef: { entityType: "MatchResult", entityId: "match-api-1", version: 3 }, fields: ["AVAILABILITY"], evidenceReferences: [{ entityType: "Communication", entityId: "communication-api-1", version: 1, classification: "RESTRICTED_PERSONAL" }], status: "REQUESTED", createdBy: baseActor.principalId, requestedAt: "2026-07-19T08:00:00.000Z", fieldResults: [], reviewHistory: [], approvalHistory: [], statusHistory: [{ status: "REQUESTED", actorId: baseActor.principalId, occurredAt: "2026-07-19T08:00:00.000Z", reason: "Verification requested" }], classification: "RESTRICTED_PERSONAL", policyVersion: "verification-policy-v1" } satisfies Verification);

function dependencies(seen: SessionContext[], actor: SessionContext = baseActor, fail = false): VerificationApiDependencies {
  const update = (request: { readonly actor: SessionContext }): Verification => { seen.push(request.actor); if (fail) throw new Error("VERIFICATION_NOT_FOUND"); return Object.freeze({ ...verification, version: 2, status: "IN_REVIEW" }); };
  return { sessionReader: () => actor, verificationService: {
    requestVerification: update, assignVerifier: (request) => ({ verification: update(request), assignment: {} as never }), recordReviewSupport: update,
    decide: (request) => Object.freeze({ ...update(request), status: request.decision, result: request.decision }), revoke: (request) => Object.freeze({ ...update(request), status: "REVOKED", result: "REVOKED" }),
    evaluateExpiry: (request) => Object.freeze({ ...update(request), status: "EXPIRED" }), requestReverification: (request) => ({ verification: Object.freeze({ ...update(request), priorVerificationId: verification.id }), request: {} as never }),
    readVerification: update, readHistory: (request) => { seen.push(request.actor); return [verification]; }, readAvailability: () => undefined,
    listQueue: (request) => { seen.push(request.actor); return [verification]; }, listExpiry: (request) => { seen.push(request.actor); return [Object.freeze({ ...verification, status: "EXPIRED" })]; },
    validateEvidence: (request) => { seen.push(request.actor); return { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" }; },
  } };
}

test("TEST-032 API-011 derives Actor from session and exposes bounded UI-026 queue", () => {
  const seen: SessionContext[] = []; const api = new VerificationApi(dependencies(seen));
  const response = api.readQueue({ context: { sessionId: baseActor.id, correlationId: "correlation-api-verification" }, purpose: "LISTING_VERIFICATION" });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.data.screenId, "UI-026"); assert.equal(response.data.presentationState, "READY"); assert.deepEqual(response.data.allowedActions, ["READ", "REQUEST"]);
    assert.equal(response.data.accessibility.keyboardOperable, true); assert.equal(response.data.accessibility.liveRegion, "polite"); assert.equal(JSON.stringify(response.data).match(/phone|email|contactValue/giu), null);
  }
  assert.deepEqual(seen, [baseActor]);
});

test("TEST-038/054 UI-027 role visibility follows AO-011 while server authorization remains authoritative", () => {
  const expectations = [
    ["VER", ["READ", "REQUEST", "DECIDE", "REVOKE", "REVERIFY"]],
    ["MGR", ["READ", "REQUEST", "ASSIGN", "DECIDE", "REVOKE", "REVERIFY"]],
    ["REV", ["READ", "REVIEW_EVIDENCE"]],
    ["SAG", ["READ"]],
  ] as const;
  for (const [role, allowed] of expectations) {
    const roleActor = Object.freeze({ ...baseActor, principalId: `actor-${role}`, roles: [role] }); const api = new VerificationApi(dependencies([], roleActor));
    const response = api.readVerification({ context: { sessionId: roleActor.id, correlationId: `correlation-${role}` }, verificationId: verification.id, purpose: "LISTING_VERIFICATION" });
    assert.equal(response.ok, true); if (response.ok) { assert.equal(response.data.screenId, "UI-027"); assert.deepEqual(response.data.allowedActions, allowed); assert.equal(response.data.accessibility.errorSummaryLinked, true); }
  }
});

test("TEST-024/054 UI-032 exposes only Verification expiry and reverification actions", () => {
  const verifier = Object.freeze({ ...baseActor, principalId: "verifier-api", roles: ["VER"] as const }); const api = new VerificationApi(dependencies([], verifier));
  const response = api.readExpiry({ context: { sessionId: verifier.id, correlationId: "correlation-expiry" }, purpose: "LISTING_VERIFICATION" });
  assert.equal(response.ok, true); if (response.ok) { assert.equal(response.data.screenId, "UI-032"); assert.equal(response.data.presentationState, "ACTION_REQUIRED"); assert.deepEqual(response.data.allowedActions, ["READ", "REVERIFY"]); assert.equal(response.data.allowedActions.includes("GRANT_PERMISSION" as never), false); }
});

test("TEST-032 API-011 ignores forged actors and returns stable safe errors", () => {
  const seen: SessionContext[] = []; const api = new VerificationApi(dependencies(seen, baseActor, true));
  const response = api.requestVerification({ context: { sessionId: baseActor.id, correlationId: "correlation-forged" }, subjectRef: verification.subjectRef, fields: verification.fields, evidenceReferences: verification.evidenceReferences, reason: "Request verification", idempotencyKey: "api-request-1", purpose: "LISTING_VERIFICATION", actor: { principalId: "forged" } } as unknown as Parameters<VerificationApi["requestVerification"]>[0]);
  const noSession = api.readQueue({ context: { correlationId: "correlation-no-session" }, purpose: "LISTING_VERIFICATION" });
  assert.equal(response.ok, false); if (!response.ok) { assert.equal(response.error.code, "VERIFICATION_NOT_FOUND"); assert.equal(response.error.message, "Request could not be completed."); }
  assert.equal(noSession.ok, false); assert.deepEqual(seen, [baseActor]);
});

test("SP-006 composition adds API-011 without replacing SP-001–005 modules", () => {
  const composed = composeApiModulesBeforePublication({ sessionService: { readSession: () => baseActor }, verificationService: dependencies([]).verificationService, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {}, matchingService: {}, matchingInputResolver: {} } as unknown as ApiModuleDependencies);
  assert.ok(composed.verification instanceof VerificationApi); assert.ok("identity" in composed); assert.ok("matching" in composed); assert.equal("publication" in composed, false); assert.equal("proposal" in composed, false);
});
