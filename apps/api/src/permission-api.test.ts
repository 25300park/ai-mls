import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { Permission } from "../../../modules/permission/src/permission-service.js";
import { composeApiModules, type ApiModuleDependencies } from "./composition.js";
import { PermissionApi, type PermissionApiDependencies } from "./permission-api.js";

const baseActor: SessionContext = Object.freeze({ id: "session-api-permission", principalId: "agent-api-permission", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T07:00:00.000Z", expiresAt: "2026-08-20T08:00:00.000Z", absoluteExpiresAt: "2026-08-21T08:00:00.000Z", familyId: "family-api-permission", refreshReference: "refresh-api-permission" });
const permission = Object.freeze({ id: "permission-api-1", version: 1, teamId: "team-a", subjectRef: { entityType: "ListingOffer", entityId: "offer-api-permission-1", version: 2 }, verificationId: "verification-api-permission-1", verificationVersion: 3, fieldScope: ["PRICE"], permissionType: "CLIENT_SHARING", permissionPurpose: "PURPOSE_CLIENT_PRESENTATION", audience: { code: "AUD_NAMED_CLIENT", recipientRef: { entityType: "Client", entityId: "client-api-permission-1", version: 1 } }, status: "DRAFT", createdBy: baseActor.principalId, requestedAt: "2026-07-19T08:00:00.000Z", validFrom: "2026-07-19T08:00:00.000Z", validUntil: "2026-08-02T08:00:00.000Z", validityBasis: "DEFAULT_14_DAYS", reviewHistory: [], approvalHistory: [], statusHistory: [{ status: "DRAFT", actorId: baseActor.principalId, occurredAt: "2026-07-19T08:00:00.000Z", reason: "Named client presentation requested" }], classification: "RESTRICTED_PERSONAL", policyVersion: "permission-policy-v1" } satisfies Permission);

function dependencies(seen: SessionContext[], actor: SessionContext = baseActor, failCode?: string): PermissionApiDependencies {
  const update = (request: { readonly actor: SessionContext }): Permission => { seen.push(request.actor); if (failCode !== undefined) throw new Error(failCode); return Object.freeze({ ...permission, version: 2, status: "UNDER_REVIEW" }); };
  return { sessionReader: () => actor, permissionService: {
    requestPermission: update,
    beginReview: update,
    recordReviewSupport: update,
    decide: (request) => Object.freeze({ ...update(request), status: request.decision === "GRANT" ? "ACTIVE" : "REJECTED" }),
    revoke: (request) => Object.freeze({ ...update(request), status: "REVOKED" }),
    evaluateExpiry: (request) => Object.freeze({ ...update(request), status: "EXPIRED" }),
    checkEffective: (request) => { seen.push(request.actor); return { effective: true, reasonCode: "PERMISSION_EFFECTIVE" }; },
    readPermission: update,
    readHistory: (request) => { seen.push(request.actor); return [permission]; },
    listQueue: (request) => { seen.push(request.actor); return [permission]; },
    listExpiry: (request) => { seen.push(request.actor); return [Object.freeze({ ...permission, status: "ACTIVE" })]; },
    validateEvidence: (request) => { seen.push(request.actor); return { status: "VALID", route: "HUMAN_REVIEW_REQUIRED" }; },
  } };
}

test("TEST-032 API-012 derives Actor from session and exposes bounded UI-028 detail", () => {
  const seen: SessionContext[] = []; const pmr = Object.freeze({ ...baseActor, principalId: "pmr-api-permission", roles: ["PMR"] as const }); const api = new PermissionApi(dependencies(seen, pmr));
  const response = api.readPermission({ context: { sessionId: pmr.id, correlationId: "correlation-api-permission" }, permissionId: permission.id, purpose: "PURPOSE_CLIENT_PRESENTATION" });
  const history = api.readHistory({ context: { sessionId: pmr.id, correlationId: "correlation-api-permission-history" }, permissionId: permission.id, purpose: "PURPOSE_CLIENT_PRESENTATION" });
  assert.equal(response.ok, true);
  if (response.ok) { assert.equal(response.data.screenId, "UI-028"); assert.equal(response.data.presentationState, "UNDER_REVIEW"); assert.deepEqual(response.data.allowedActions, ["READ", "REQUEST", "REVIEW", "GRANT", "DENY", "REVOKE", "CHECK_EFFECTIVE"]); assert.equal(response.data.accessibility.keyboardOperable, true); assert.equal(response.data.accessibility.errorSummaryLinked, true); assert.equal(JSON.stringify(response.data).match(/phone|email|contactValue/giu), null); }
  assert.equal(history.ok, true); if (history.ok) assert.deepEqual(history.data, [permission]);
  assert.deepEqual(seen, [pmr, pmr]);
});

test("TEST-038/054 UI-028 role visibility follows AO-012–016 while server authorization remains authoritative", () => {
  const expectations = [
    ["REV", ["READ", "REVIEW_EVIDENCE"]],
    ["VER", ["READ"]],
    ["PUA", ["READ"]],
    ["SAG", ["READ"]],
    ["AGT", ["READ"]],
    ["MGR", ["READ"]],
    ["SEC", ["READ"]],
    ["ADM", ["READ"]],
  ] as const;
  for (const [role, allowed] of expectations) {
    const roleActor = Object.freeze({ ...baseActor, principalId: `actor-${role}`, roles: [role] }); const api = new PermissionApi(dependencies([], roleActor));
    const response = api.readPermission({ context: { sessionId: roleActor.id, correlationId: `correlation-${role}` }, permissionId: permission.id, purpose: "PURPOSE_CLIENT_PRESENTATION" });
    assert.equal(response.ok, true); if (response.ok) assert.deepEqual(response.data.allowedActions, allowed, role);
  }
});

test("TEST-024/038 Permission portions of UI-026 and UI-032 exclude downstream behavior", () => {
  const pmr = Object.freeze({ ...baseActor, principalId: "pmr-api-permission", roles: ["PMR"] as const }); const api = new PermissionApi(dependencies([], pmr));
  const queue = api.readQueue({ context: { sessionId: pmr.id, correlationId: "correlation-permission-queue" }, purpose: "PURPOSE_CLIENT_PRESENTATION" });
  const expiry = api.readExpiry({ context: { sessionId: pmr.id, correlationId: "correlation-permission-expiry" }, purpose: "PURPOSE_CLIENT_PRESENTATION" });
  assert.equal(queue.ok, true); assert.equal(expiry.ok, true);
  if (queue.ok) { assert.equal(queue.data.screenId, "UI-026"); assert.equal(queue.data.presentationState, "READY"); assert.equal(queue.data.allowedActions.includes("PUBLICATION_APPROVAL" as never), false); }
  if (expiry.ok) { assert.equal(expiry.data.screenId, "UI-032"); assert.equal(expiry.data.presentationState, "ACTION_REQUIRED"); assert.deepEqual(expiry.data.allowedActions, ["READ", "REVOKE", "CHECK_EFFECTIVE"]); }
});

test("TEST-032 API-012 ignores forged actors and returns stable privacy-safe errors", () => {
  const seen: SessionContext[] = []; const api = new PermissionApi(dependencies(seen, baseActor, "PERMISSION_NOT_FOUND"));
  const response = api.requestPermission({ context: { sessionId: baseActor.id, correlationId: "correlation-forged-permission" }, subjectRef: permission.subjectRef, verificationId: permission.verificationId, fieldScope: permission.fieldScope, permissionType: permission.permissionType, permissionPurpose: permission.permissionPurpose, audience: permission.audience, reason: "Permission request", idempotencyKey: "api-permission-1", purpose: permission.permissionPurpose, actor: { principalId: "forged" } } as unknown as Parameters<PermissionApi["requestPermission"]>[0]);
  const noSession = api.readQueue({ context: { correlationId: "correlation-no-session-permission" }, purpose: permission.permissionPurpose });
  const versionApi = new PermissionApi(dependencies([], baseActor, "VERSION_CONFLICT"));
  const versionConflict = versionApi.beginReview({ context: { sessionId: baseActor.id, correlationId: "correlation-version-permission" }, permissionId: permission.id, expectedVersion: permission.version + 1, reason: "Stale review request", idempotencyKey: "api-version-conflict", purpose: permission.permissionPurpose });
  assert.equal(response.ok, false); if (!response.ok) { assert.equal(response.error.code, "PERMISSION_NOT_FOUND"); assert.equal(response.error.message, "Request could not be completed."); assert.equal(JSON.stringify(response.error).match(/phone|email|contactValue/giu), null); }
  assert.equal(versionConflict.ok, false); if (!versionConflict.ok) assert.equal(versionConflict.error.code, "VERSION_CONFLICT");
  assert.equal(noSession.ok, false); assert.deepEqual(seen, [baseActor]);
});

test("SP-007 composition adds API-012 without replacing API-001–011 modules", () => {
  const composed = composeApiModules({ sessionService: { readSession: () => baseActor }, permissionService: dependencies([]).permissionService, verificationService: {}, authorizationService: {}, administrationService: {}, auditLog: {}, sourceRegistryService: {}, intakeService: {}, jobService: {}, propertyService: {}, listingService: {}, contactService: {}, clientRequirementService: {}, matchingService: {}, matchingInputResolver: {} } as unknown as ApiModuleDependencies);
  assert.ok(composed.permission instanceof PermissionApi); assert.ok("identity" in composed); assert.ok("verification" in composed); assert.equal("publication" in composed, false); assert.equal("proposal" in composed, false);
});
