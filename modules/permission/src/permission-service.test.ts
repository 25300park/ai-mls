import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { Verification } from "../../verification/src/verification-service.js";
import {
  PermissionService,
  type PermissionAudience,
  type PermissionPurpose,
} from "./permission-service.js";

let now = new Date("2026-07-19T08:00:00.000Z");
const clock = (): Date => new Date(now);

function actor(
  principalId: string,
  roles: SessionContext["roles"],
  overrides: Partial<SessionContext> = {},
): SessionContext {
  return Object.freeze({
    id: `session-${principalId}`,
    principalId,
    principalType: "HUMAN",
    roles,
    teamId: "team-a",
    state: "ACTIVE",
    assurance: "MFA",
    isMfaVerified: true,
    authenticatedAt: "2026-07-19T07:00:00.000Z",
    expiresAt: "2026-08-31T08:00:00.000Z",
    absoluteExpiresAt: "2026-09-01T08:00:00.000Z",
    familyId: `family-${principalId}`,
    refreshReference: `refresh-${principalId}`,
    ...overrides,
  });
}

const permissionPurposes: readonly PermissionPurpose[] = [
  "PURPOSE_INTERNAL_REVIEW", "PURPOSE_CLIENT_MATCHING", "PURPOSE_CLIENT_PRESENTATION",
  "PURPOSE_BROKER_COORDINATION", "PURPOSE_TRANSACTION", "PURPOSE_CONTRACT_PREPARATION",
  "PURPOSE_CONTACT_DISCLOSURE", "PURPOSE_PUBLICATION_APPROVAL",
];

function assignment(principalId: string, role: RoleAssignment["role"]): RoleAssignment {
  return Object.freeze({ id: `authority-${principalId}-${role}`, principalId, role, teamIds: ["team-a"], resourceTypes: ["Permission"], purposes: permissionPurposes, effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-08-30T00:00:00.000Z", status: "ACTIVE" });
}

const verification = Object.freeze({
  id: "verification-permission-1", version: 4, teamId: "team-a",
  subjectRef: { entityType: "ListingOffer", entityId: "offer-permission-1", version: 3 },
  fields: ["AVAILABILITY", "PRICE", "CONTACT_REACHABILITY"],
  evidenceReferences: [{ entityType: "Communication", entityId: "communication-permission-1", version: 1, classification: "RESTRICTED_PERSONAL" }],
  status: "VERIFIED", result: "VERIFIED", assignmentId: "verification-assignment-1", createdBy: "agent", requestedAt: "2026-07-18T08:00:00.000Z",
  fieldResults: [
    { field: "AVAILABILITY", result: "VERIFIED", validFrom: "2026-07-19T07:00:00.000Z", validUntil: "2026-07-26T08:00:00.000Z" },
    { field: "PRICE", result: "VERIFIED", validFrom: "2026-07-19T07:00:00.000Z", validUntil: "2026-08-02T08:00:00.000Z" },
    { field: "CONTACT_REACHABILITY", result: "VERIFIED", validFrom: "2026-07-19T07:00:00.000Z", validUntil: "2026-08-18T08:00:00.000Z" },
  ],
  reviewHistory: [],
  approvalHistory: [{ actorId: "verifier", decision: "VERIFIED", reason: "Evidence confirmed", occurredAt: "2026-07-19T07:00:00.000Z", managerOverride: false }],
  statusHistory: [], classification: "RESTRICTED_PERSONAL", policyVersion: "verification-policy-v1",
} satisfies Verification);

function fixture(verificationOverride: Partial<Verification> = {}) {
  now = new Date("2026-07-19T08:00:00.000Z"); let sequence = 0;
  let currentVerification: Verification = Object.freeze({ ...verification, ...verificationOverride });
  const audit = new AuditLog({ clock, idFactory: () => `audit-permission-${String(++sequence)}` });
  const authorization = new AuthorizationService({ assignments: [assignment("agent", "AGT"), assignment("requester", "PMR"), assignment("pmr", "PMR"), assignment("reviewer", "REV"), assignment("verifier", "VER"), assignment("manager-pmr", "PMR"), assignment("manager-pmr", "MGR"), assignment("manager", "MGR"), assignment("security", "SEC"), assignment("scheduler", "SVC")], auditSink: audit, clock, policyVersion: "authorization-v1" });
  const service = new PermissionService({ authorizationService: authorization, auditSink: audit, clock, idFactory: () => `permission-object-${String(++sequence)}`, policyVersion: "permission-policy-v1", verificationResolver: (verificationId) => verificationId === currentVerification.id ? currentVerification : undefined });
  return { service, audit, setVerification: (next: Verification): void => { currentVerification = next; } };
}

const context = (principalId = "requester", roles: SessionContext["roles"] = ["PMR"] as const) => ({ actor: actor(principalId, roles), purpose: "PURPOSE_CLIENT_PRESENTATION" as PermissionPurpose, correlationId: `correlation-${principalId}` } as const);
const namedClient = Object.freeze({ code: "AUD_NAMED_CLIENT", recipientRef: { entityType: "Client", entityId: "client-permission-1", version: 1 } } satisfies PermissionAudience);

function request(service: PermissionService, overrides: Partial<Parameters<PermissionService["requestPermission"]>[0]> = {}) {
  return service.requestPermission({ ...context(), subjectRef: verification.subjectRef, verificationId: verification.id, fieldScope: ["AVAILABILITY", "PRICE"], permissionType: "CLIENT_SHARING", permissionPurpose: "PURPOSE_CLIENT_PRESENTATION", audience: namedClient, reason: "Named client presentation requested", idempotencyKey: "permission-request-1", ...overrides });
}

function active(service: PermissionService, requestOverrides: Partial<Parameters<PermissionService["requestPermission"]>[0]> = {}) {
  const draft = request(service, requestOverrides);
  const underReview = service.beginReview({ ...context("pmr", ["PMR"]), permissionId: draft.id, expectedVersion: draft.version, reason: "Permission evidence review started", idempotencyKey: `review-${draft.id}` });
  return service.decide({ ...context("pmr", ["PMR"]), permissionId: draft.id, expectedVersion: underReview.version, decision: "GRANT", reason: "Scope and grant evidence approved", idempotencyKey: `grant-${draft.id}` });
}

test("TEST-012/032 FEAT-013 binds a DRAFT Permission to exact revision, scope, purpose and audience", () => {
  const { service } = fixture(); const permission = request(service);
  assert.equal(permission.status, "DRAFT"); assert.equal(permission.subjectRef.version, 3); assert.deepEqual(permission.fieldScope, ["AVAILABILITY", "PRICE"]); assert.equal(permission.permissionPurpose, "PURPOSE_CLIENT_PRESENTATION"); assert.deepEqual(permission.audience, namedClient); assert.equal(permission.validUntil, "2026-07-26T08:00:00.000Z"); assert.equal(Object.isFrozen(permission), true); assert.equal("publicationApprovalId" in permission, false); assert.equal("publicationId" in permission, false);
  assert.throws(() => service.beginReview({ ...context("pmr", ["PMR"]), permissionId: permission.id, expectedVersion: permission.version + 1, reason: "Stale client update", idempotencyKey: "version-conflict" }), /VERSION_CONFLICT/u);
  assert.throws(() => request(service, { purpose: "PURPOSE_INTERNAL_REVIEW", idempotencyKey: "purpose-mismatch" }), /PERMISSION_PURPOSE_INVALID/u);
});

test("TEST-020/032 only PMR grants or denies while REV is review support only", () => {
  const { service } = fixture(); const draft = request(service);
  assert.throws(() => service.beginReview({ ...context("reviewer", ["REV"]), permissionId: draft.id, expectedVersion: draft.version, reason: "Reviewer cannot own decision review", idempotencyKey: "review-rev-denied" }), /CAPABILITY_DENIED/u);
  const underReview = service.beginReview({ ...context("pmr", ["PMR"]), permissionId: draft.id, expectedVersion: draft.version, reason: "PMR begins review", idempotencyKey: "review-pmr" });
  assert.throws(() => service.beginReview({ ...context("pmr", ["AGT"]), permissionId: draft.id, expectedVersion: draft.version, reason: "PMR begins review", idempotencyKey: "review-pmr" }), /CAPABILITY_DENIED/u);
  assert.throws(() => service.beginReview({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_INTERNAL_REVIEW", permissionId: draft.id, expectedVersion: draft.version, reason: "PMR begins review", idempotencyKey: "review-pmr" }), /PERMISSION_PURPOSE_DENIED/u);
  const supported = service.recordReviewSupport({ ...context("reviewer", ["REV"]), permissionId: draft.id, expectedVersion: underReview.version, action: "REQUEST_EVIDENCE", recommendation: "Confirm named recipient identity", idempotencyKey: "support-rev" });
  assert.equal(supported.reviewHistory.at(-1)?.action, "REQUEST_EVIDENCE");
  assert.throws(() => service.decide({ ...context("reviewer", ["REV"]), permissionId: draft.id, expectedVersion: supported.version, decision: "GRANT", reason: "Reviewer cannot grant", idempotencyKey: "grant-rev" }), /PERMISSION_DECISION_DENIED|CAPABILITY_DENIED/u);
  const granted = service.decide({ ...context("pmr", ["PMR"]), permissionId: draft.id, expectedVersion: supported.version, decision: "GRANT", reason: "PMR grants exact scope", idempotencyKey: "grant-pmr" }); assert.equal(granted.status, "ACTIVE");
});

test("TEST-001/047 rejects self-permission and same verifier except explicit PMR+MGR override", () => {
  const { service } = fixture({ approvalHistory: [{ actorId: "manager-pmr", decision: "VERIFIED", reason: "Evidence confirmed", occurredAt: "2026-07-19T07:00:00.000Z", managerOverride: false }] });
  const selfDraft = request(service, { actor: actor("pmr", ["PMR"]), idempotencyKey: "self-request" });
  const selfReview = service.beginReview({ ...context("pmr", ["PMR"]), permissionId: selfDraft.id, expectedVersion: selfDraft.version, reason: "Self review", idempotencyKey: "self-review" });
  assert.throws(() => service.decide({ ...context("pmr", ["PMR"]), permissionId: selfDraft.id, expectedVersion: selfReview.version, decision: "GRANT", reason: "Self grant denied", idempotencyKey: "self-grant" }), /SEPARATION_OF_DUTIES_DENIED/u);
  const draft = request(service, { idempotencyKey: "verifier-conflict" });
  const review = service.beginReview({ ...context("manager-pmr", ["PMR", "MGR"]), permissionId: draft.id, expectedVersion: draft.version, reason: "Override review", idempotencyKey: "override-review" });
  assert.throws(() => service.decide({ ...context("manager", ["MGR"]), permissionId: draft.id, expectedVersion: review.version, decision: "GRANT", reason: "MGR alone denied", idempotencyKey: "manager-grant", managerOverride: true }), /PERMISSION_DECISION_DENIED|CAPABILITY_DENIED/u);
  const overridden = service.decide({ ...context("manager-pmr", ["PMR", "MGR"]), permissionId: draft.id, expectedVersion: review.version, decision: "GRANT", reason: "MFA manager override for verifier conflict", idempotencyKey: "override-grant", managerOverride: true });
  assert.equal(overridden.status, "ACTIVE"); assert.equal(overridden.approvalHistory.at(-1)?.managerOverride, true);
});

test("TEST-024/032 applies type validity, Verification caps and immutable successors", () => {
  const { service } = fixture(); const activePermission = active(service); assert.equal(activePermission.validUntil, "2026-07-26T08:00:00.000Z");
  const successorDraft = request(service, { priorPermissionId: activePermission.id, permissionPurpose: "PURPOSE_TRANSACTION", purpose: "PURPOSE_TRANSACTION", idempotencyKey: "successor-request" });
  const successorReview = service.beginReview({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_TRANSACTION", permissionId: successorDraft.id, expectedVersion: successorDraft.version, reason: "Successor purpose review", idempotencyKey: "successor-review" });
  const successor = service.decide({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_TRANSACTION", permissionId: successorDraft.id, expectedVersion: successorReview.version, decision: "GRANT", reason: "Successor purpose granted", idempotencyKey: "successor-grant" });
  assert.equal(successor.priorPermissionId, activePermission.id); assert.equal(service.readPermission({ ...context("pmr", ["PMR"]), permissionId: activePermission.id }).status, "SUPERSEDED"); assert.equal(service.readHistory({ ...context("pmr", ["PMR"]), permissionId: activePermission.id }).some((item) => item.status === "ACTIVE"), true);
});

test("TEST-012/024 effective checks isolate revision, field scope, purpose, audience and Verification validity", () => {
  const { service, setVerification } = fixture(); const permission = active(service);
  const base = { ...context("pmr", ["PMR"]), permissionId: permission.id, subjectRef: permission.subjectRef, fieldScope: ["PRICE"] as const, permissionPurpose: permission.permissionPurpose, audience: permission.audience };
  assert.deepEqual(service.checkEffective(base), { effective: true, reasonCode: "PERMISSION_EFFECTIVE" });
  assert.equal(service.checkEffective({ ...base, subjectRef: { ...base.subjectRef, version: 4 } }).reasonCode, "PERMISSION_SUBJECT_STALE"); assert.equal(service.checkEffective({ ...base, fieldScope: ["CONTACT_REACHABILITY"] }).reasonCode, "PERMISSION_SCOPE_DENIED"); assert.equal(service.checkEffective({ ...base, permissionPurpose: "PURPOSE_TRANSACTION" }).reasonCode, "PERMISSION_PURPOSE_DENIED"); assert.equal(service.checkEffective({ ...base, audience: { code: "AUD_PUBLIC" } }).reasonCode, "PERMISSION_AUDIENCE_DENIED");
  setVerification(Object.freeze({ ...verification, status: "REVOKED", result: "REVOKED" })); assert.equal(service.checkEffective(base).reasonCode, "VERIFICATION_NOT_EFFECTIVE");
});

test("TEST-032 exact Verification version and purpose-scoped queues fail closed", () => {
  const { service, setVerification } = fixture(); const permission = active(service);
  setVerification(Object.freeze({ ...verification, version: verification.version + 1 }));
  assert.equal(service.checkEffective({ ...context("pmr", ["PMR"]), permissionId: permission.id, subjectRef: permission.subjectRef, fieldScope: ["PRICE"], permissionPurpose: permission.permissionPurpose, audience: permission.audience }).reasonCode, "VERIFICATION_NOT_EFFECTIVE");

  const transaction = request(service, { purpose: "PURPOSE_TRANSACTION", permissionPurpose: "PURPOSE_TRANSACTION", idempotencyKey: "transaction-queue" });
  const clientQueue = service.listQueue({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_CLIENT_PRESENTATION" });
  assert.equal(clientQueue.some((item) => item.id === transaction.id), false);
  assert.throws(() => service.readPermission({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_INTERNAL_REVIEW", permissionId: transaction.id }), /PERMISSION_PURPOSE_DENIED/u);
  assert.throws(() => service.readPermission({ ...context("other-team", ["PMR"]), actor: actor("other-team", ["PMR"], { teamId: "team-b" }), permissionId: transaction.id }), /PERMISSION_NOT_FOUND/u);
});

test("TEST-024 successor activation is atomic when predecessor is no longer ACTIVE", () => {
  const { service } = fixture(); const predecessor = active(service);
  const successorDraft = request(service, { priorPermissionId: predecessor.id, purpose: "PURPOSE_TRANSACTION", permissionPurpose: "PURPOSE_TRANSACTION", idempotencyKey: "atomic-successor" });
  const successorReview = service.beginReview({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_TRANSACTION", permissionId: successorDraft.id, expectedVersion: successorDraft.version, reason: "Review successor", idempotencyKey: "atomic-review" });
  service.revoke({ ...context("pmr", ["PMR"]), permissionId: predecessor.id, expectedVersion: predecessor.version, reason: "Predecessor withdrawn", idempotencyKey: "atomic-predecessor-revoke" });
  assert.throws(() => service.decide({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_TRANSACTION", permissionId: successorDraft.id, expectedVersion: successorReview.version, decision: "GRANT", reason: "Cannot grant orphan successor", idempotencyKey: "atomic-grant" }), /PERMISSION_SUCCESSOR_INVALID/u);
  assert.equal(service.readPermission({ ...context("pmr", ["PMR"]), purpose: "PURPOSE_TRANSACTION", permissionId: successorDraft.id }).status, "UNDER_REVIEW");
});

test("TEST-024/051 expiry and revocation are terminal and cannot be replayed into ACTIVE", () => {
  const { service } = fixture(); const permission = active(service);
  const revoked = service.revoke({ ...context("pmr", ["PMR"]), permissionId: permission.id, expectedVersion: permission.version, reason: "Grantor withdrew exact disclosure", idempotencyKey: "revoke-1" });
  const replay = service.revoke({ ...context("pmr", ["PMR"]), permissionId: permission.id, expectedVersion: permission.version, reason: "Grantor withdrew exact disclosure", idempotencyKey: "revoke-1" });
  assert.equal(revoked.status, "REVOKED"); assert.equal(replay.version, revoked.version); assert.throws(() => service.beginReview({ ...context("pmr", ["PMR"]), permissionId: revoked.id, expectedVersion: revoked.version, reason: "Cannot reactivate", idempotencyKey: "reactivate" }), /STATE_TRANSITION_INVALID/u);
  const expiring = active(service, { idempotencyKey: "expiry-request" }); now = new Date("2026-07-26T08:00:00.001Z");
  const expired = service.evaluateExpiry({ ...context("scheduler", ["SVC"]), actor: actor("scheduler", ["SVC"], { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false }), permissionId: expiring.id, expectedVersion: expiring.version }); assert.equal(expired.status, "EXPIRED");
});

test("TEST-020/029/048 CONTACT_DISCLOSURE requires named audience and stores no raw Contact value", () => {
  const { service, audit } = fixture();
  assert.throws(() => request(service, { permissionType: "CONTACT_DISCLOSURE", permissionPurpose: "PURPOSE_CONTACT_DISCLOSURE", purpose: "PURPOSE_CONTACT_DISCLOSURE", audience: { code: "AUD_PUBLIC" }, fieldScope: ["CONTACT_REACHABILITY"], idempotencyKey: "contact-public" }), /CONTACT_DISCLOSURE_SCOPE_INVALID/u);
  assert.throws(() => request(service, { audience: { code: "AUD_PUBLIC" }, idempotencyKey: "client-public" }), /PERMISSION_AUDIENCE_INVALID/u);
  assert.throws(() => request(service, { permissionType: "PUBLIC_PUBLICATION", permissionPurpose: "PURPOSE_PUBLICATION_APPROVAL", purpose: "PURPOSE_PUBLICATION_APPROVAL", audience: namedClient, idempotencyKey: "publication-named" }), /PERMISSION_AUDIENCE_INVALID/u);
  const contact = request(service, { permissionType: "CONTACT_DISCLOSURE", permissionPurpose: "PURPOSE_CONTACT_DISCLOSURE", purpose: "PURPOSE_CONTACT_DISCLOSURE", audience: { code: "AUD_NAMED_BROKER", recipientRef: { entityType: "Contact", entityId: "broker-contact-1", version: 1 } }, fieldScope: ["CONTACT_REACHABILITY"], idempotencyKey: "contact-named" });
  assert.equal(contact.validUntil, "2026-07-26T08:00:00.000Z"); assert.equal(JSON.stringify(contact).match(/phone|email|contactValue/giu), null); assert.equal(JSON.stringify(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY" })).match(/phone|email|contactValue/giu), null); assert.throws(() => request(service, { reason: "Send to person@example.com", idempotencyKey: "raw-contact" }), /SENSITIVE_FIELD_RESTRICTED/u);
});

test("TEST-032/045 AI-007 remains advisory and cannot mutate Permission authority", () => {
  const { service } = fixture(); const permission = request(service);
  const envelope = { schemaVersion: "1.0", capabilityId: "AI-007", subjectRef: { entityType: "Permission", entityId: permission.id, version: permission.version }, provenance: [{ entityType: "Permission", entityId: permission.id, version: permission.version }], classification: "RESTRICTED_PERSONAL", confidence: { band: "HIGH", reasonCodes: ["SCOPE_COMPLETE"], policyVersion: "confidence-contract-v1" }, output: { validationOutcome: "CONSISTENT", reviewRoute: "HUMAN_REVIEW_REQUIRED", fieldConfidences: [{ field: "PRICE", band: "HIGH" }] } } as const;
  assert.equal(service.validateEvidence({ ...context("pmr", ["PMR"]), permissionId: permission.id, expectedVersion: permission.version, result: envelope }).status, "VALID"); assert.equal(service.readPermission({ ...context("pmr", ["PMR"]), permissionId: permission.id }).version, permission.version); assert.equal(service.validateEvidence({ ...context("pmr", ["PMR"]), permissionId: permission.id, expectedVersion: permission.version, result: { ...envelope, output: { ...envelope.output, grantPermission: true } } }).status, "REJECTED");
});
