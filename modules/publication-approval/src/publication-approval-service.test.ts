import assert from "node:assert/strict";
import test from "node:test";
import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import type { Permission } from "../../permission/src/permission-service.js";
import type { Verification } from "../../verification/src/verification-service.js";
import { PublicationApprovalService, computeRepresentationChecksum, type PublicationTargetPolicySnapshot, type RepresentationSourceSnapshot } from "./publication-approval-service.js";

let now = new Date("2026-07-23T02:00:00.000Z");
let sequence = 0;
const clock = () => new Date(now);
const idFactory = () => `approval-id-${String(++sequence)}`;

function actor(id: string, roles: SessionContext["roles"], options: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({ id: `session-${id}`, principalId: id, principalType: "HUMAN", roles: Object.freeze([...roles]), teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-23T00:00:00.000Z", expiresAt: "2026-07-24T00:00:00.000Z", absoluteExpiresAt: "2026-07-25T00:00:00.000Z", familyId: `family-${id}`, refreshReference: `refresh-${id}`, ...options });
}

const subjectRef = Object.freeze({ entityType: "CandidateListing", entityId: "candidate-1", version: 4 });
const publicAudience = Object.freeze({ code: "AUD_PUBLIC" as const });
const verification: Verification = Object.freeze({
  id: "verification-1", version: 2, teamId: "team-a", subjectRef, fields: ["PRICE", "AVAILABILITY"], evidenceReferences: [{ entityType: "SourceProvenance", entityId: "source-1", version: 1, classification: "CONFIDENTIAL_BUSINESS" }], status: "VERIFIED", result: "VERIFIED", assignmentId: "verification-assignment", createdBy: "agent-2", requestedAt: "2026-07-22T00:00:00.000Z",
  fieldResults: [{ field: "PRICE", result: "VERIFIED", validFrom: "2026-07-22T00:00:00.000Z", validUntil: "2026-07-30T00:00:00.000Z" }, { field: "AVAILABILITY", result: "VERIFIED", validFrom: "2026-07-22T00:00:00.000Z", validUntil: "2026-07-29T00:00:00.000Z" }],
  reviewHistory: [], approvalHistory: [{ actorId: "verifier-1", decision: "VERIFIED", reason: "Exact evidence verified", occurredAt: "2026-07-22T00:00:00.000Z", managerOverride: false }], statusHistory: [], classification: "CONFIDENTIAL_BUSINESS", policyVersion: "verification-v1",
} as const);
const permission: Permission = Object.freeze({
  id: "permission-1", version: 3, teamId: "team-a", subjectRef, verificationId: verification.id, verificationVersion: verification.version, fieldScope: ["PRICE", "AVAILABILITY"], permissionType: "PUBLIC_PUBLICATION", permissionPurpose: "PURPOSE_PUBLICATION_APPROVAL", audience: publicAudience, status: "ACTIVE", createdBy: "agent-2", requestedAt: "2026-07-22T00:00:00.000Z", validFrom: "2026-07-22T00:00:00.000Z", validUntil: "2026-07-28T00:00:00.000Z", validityBasis: "UNTIL_PUBLICATION_APPROVAL_DECISION", reviewHistory: [], approvalHistory: [{ actorId: "pmr-1", decision: "GRANTED", reason: "Public scope granted", occurredAt: "2026-07-22T00:00:00.000Z", managerOverride: false }], statusHistory: [], classification: "RESTRICTED_PERSONAL", policyVersion: "permission-v1",
} as const);
const targetPolicy: PublicationTargetPolicySnapshot = Object.freeze({ targetId: "target-1", channelId: "channel-1", targetStatus: "ACTIVE", channelStatus: "ACTIVE", targetPolicyVersion: "target-policy-v2", channelPolicyVersion: "channel-policy-v3", allowedLanguages: ["en"], allowedAudienceCodes: ["AUD_PUBLIC"], allowedFields: ["PRICE", "AVAILABILITY"], allowedMedia: ["PHOTO"] } as const);
const source = (provenanceId = "source-1", content: Readonly<Record<string, unknown>> = canonicalContent): RepresentationSourceSnapshot => Object.freeze({ teamId: "team-a", subjectRef, provenanceRef: { entityType: "SourceProvenance", entityId: provenanceId, version: 1 }, canonicalContent: content, fieldScope: ["PRICE", "AVAILABILITY"], mediaScope: ["PHOTO"], creatorId: "creator-1", editorIds: ["editor-1"], classification: "RESTRICTED_SECURITY", privacyValidated: true } as const);

const allActors = ["requester-1", "creator-1", "pua-1", "pua-2", "manager-1", "admin-1", "security-1", "reviewer-1", "verifier-1", "pmr-1", "editor-1", "ops-1"];
function fixture() {
  sequence = 0; now = new Date("2026-07-23T02:00:00.000Z"); const audit = new AuditLog({ clock, idFactory });
  const roleByActor: Readonly<Record<string, RoleAssignment["role"]>> = { "requester-1": "AGT", "creator-1": "PUA", "pua-1": "PUA", "pua-2": "PUA", "manager-1": "MGR", "admin-1": "ADM", "security-1": "SEC", "reviewer-1": "REV", "verifier-1": "PUA", "pmr-1": "PUA", "editor-1": "PUA", "ops-1": "OPS" };
  const assignments: RoleAssignment[] = allActors.map((principalId) => ({ id: `assignment-${principalId}`, principalId, role: roleByActor[principalId]!, teamIds: ["team-a"], resourceTypes: ["ImmutableRepresentationSnapshot", "PublicationApproval"], purposes: ["PURPOSE_PUBLICATION_APPROVAL"], effectiveFrom: "2026-07-22T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" }));
  assignments.push({ id: "assignment-requester-pua", principalId: "requester-1", role: "PUA", teamIds: ["team-a"], resourceTypes: ["PublicationApproval"], purposes: ["PURPOSE_PUBLICATION_APPROVAL"], effectiveFrom: "2026-07-22T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" });
  assignments.push({ id: "assignment-pua-ops", principalId: "pua-1", role: "OPS", teamIds: ["team-a"], resourceTypes: ["PublicationApproval"], purposes: ["PURPOSE_PUBLICATION_APPROVAL"], effectiveFrom: "2026-07-22T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" });
  assignments.push({ id: "assignment-scheduler", principalId: "scheduler-1", role: "SVC", teamIds: ["team-a"], resourceTypes: ["PublicationApproval"], purposes: ["PURPOSE_PUBLICATION_APPROVAL"], effectiveFrom: "2026-07-22T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" });
  const authorization = new AuthorizationService({ assignments, auditSink: audit, clock, policyVersion: "authorization-v1" });
  let currentVerification = verification; let currentPermission = permission; let currentTargetPolicy = targetPolicy; const eligible = new Set(["requester-1", "creator-1", "pua-1", "pua-2", "verifier-1", "pmr-1", "editor-1"]);
  const sources = new Map<string, RepresentationSourceSnapshot>([["source-1", source()], ["source-2", source("source-2", { ...canonicalContent, price: 1250 })]]);
  const service = new PublicationApprovalService({ authorizationService: authorization, auditSink: audit, clock, idFactory, policyVersion: "publication-approval-v1", verificationResolver: (id: string) => id === currentVerification.id ? currentVerification : undefined, permissionResolver: (id: string) => id === currentPermission.id ? currentPermission : undefined, targetPolicyResolver: (targetId: string, channelId: string) => targetId === currentTargetPolicy.targetId && channelId === currentTargetPolicy.channelId ? currentTargetPolicy : undefined, representationSourceResolver: (teamId, sourceSubject, provenance) => teamId === "team-a" && sameTestRef(sourceSubject, subjectRef) ? sources.get(provenance.entityId) : undefined, puaEligibilityResolver: (principalId: string) => eligible.has(principalId), schedulerEligibilityResolver: (principalId: string) => principalId === "scheduler-1" });
  return { service, audit, setVerification: (value: Verification) => { currentVerification = value; }, setPermission: (value: Permission) => { currentPermission = value; }, setTargetPolicy: (value: PublicationTargetPolicySnapshot) => { currentTargetPolicy = value; }, revokeEligibility: (id: string) => eligible.delete(id) };
}

const context = (id: string, roles: SessionContext["roles"], options: Partial<SessionContext> = {}) => ({ actor: actor(id, roles, options), purpose: "PURPOSE_PUBLICATION_APPROVAL" as const, correlationId: `correlation-${id}` });
const canonicalContent = Object.freeze({ title: "Verified listing", price: 1200, availability: "AVAILABLE", maskedContact: true });
function sameTestRef(left: { readonly entityType: string; readonly entityId: string; readonly version: number }, right: { readonly entityType: string; readonly entityId: string; readonly version: number }): boolean { return left.entityType === right.entityType && left.entityId === right.entityId && left.version === right.version; }
function createSnapshot(service: PublicationApprovalService, overrides: Readonly<Record<string, unknown>> = {}) {
  const input = { ...context("requester-1", ["AGT"]), subjectRef, canonicalContent, fieldScope: ["PRICE", "AVAILABILITY"] as const, mediaScope: ["PHOTO"], language: "en", audience: publicAudience, targetId: "target-1", channelId: "channel-1", targetPolicyVersion: "target-policy-v2", channelPolicyVersion: "channel-policy-v3", provenanceRef: { entityType: "SourceProvenance", entityId: "source-1", version: 1 }, creatorId: "creator-1", editorIds: ["editor-1"], sourceClassification: "RESTRICTED_SECURITY" as const, reason: "Freeze exact public representation", idempotencyKey: "representation-create-1", ...overrides };
  return service.createRepresentationSnapshot({ ...input, checksum: computeRepresentationChecksum(input) });
}
function requestApproval(service: PublicationApprovalService, snapshot = createSnapshot(service), overrides: Readonly<Record<string, unknown>> = {}) {
  return service.createApprovalRequest({ ...context("requester-1", ["AGT"]), representationId: snapshot.id, representationVersion: snapshot.version, representationChecksum: snapshot.checksum, subjectRef, verificationId: verification.id, verificationVersion: verification.version, permissionId: permission.id, permissionVersion: permission.version, expectedVersion: 0, reason: "Request independent publication approval", idempotencyKey: `request-${snapshot.id}-${String(snapshot.version)}`, ...overrides });
}
function claim(service: PublicationApprovalService, approvalId: string, expectedVersion: number, actorId = "pua-1") { return service.assignOrClaimApprover({ ...context(actorId, ["PUA"]), approvalId, expectedVersion, assigneeActorId: actorId, reason: "Claim exact review", idempotencyKey: `claim-${approvalId}-${actorId}` }); }
function approve(service: PublicationApprovalService, approvalId: string, expectedVersion: number, actorId = "pua-1") { return service.decideApproval({ ...context(actorId, ["PUA"]), approvalId, expectedVersion, decision: "APPROVED", reason: "Exact scope approved after human review", idempotencyKey: `approve-${approvalId}-${actorId}` }); }

test("TEST-022 creates immutable checksum-bound representation versions without a Publication entity", () => {
  const { service } = fixture(); const first = createSnapshot(service); assert.equal(first.version, 1); assert.equal(Object.isFrozen(first), true); assert.equal("publicationId" in first, false);
  assert.throws(() => service.createRepresentationSnapshot({ ...context("requester-1", ["AGT"]), subjectRef, canonicalContent, fieldScope: ["PRICE", "AVAILABILITY"], mediaScope: ["PHOTO"], language: "en", audience: publicAudience, targetId: "target-1", channelId: "channel-1", targetPolicyVersion: "target-policy-v2", channelPolicyVersion: "channel-policy-v3", provenanceRef: { entityType: "SourceProvenance", entityId: "source-1", version: 1 }, creatorId: "creator-1", editorIds: ["editor-1"], sourceClassification: "RESTRICTED_SECURITY", checksum: "sha256:wrong", reason: "Invalid checksum", idempotencyKey: "bad-checksum" }), /REPRESENTATION_CHECKSUM_MISMATCH/u);
  const changed = { ...canonicalContent, price: 1250 }; const successorInput = { ...context("requester-1", ["AGT"]), representationId: first.id, expectedPreviousVersion: first.version, subjectRef, canonicalContent: changed, fieldScope: ["PRICE", "AVAILABILITY"] as const, mediaScope: ["PHOTO"], language: "en", audience: publicAudience, targetId: "target-1", channelId: "channel-1", targetPolicyVersion: "target-policy-v2", channelPolicyVersion: "channel-policy-v3", provenanceRef: { entityType: "SourceProvenance", entityId: "source-2", version: 1 }, creatorId: "creator-1", editorIds: ["editor-1"], sourceClassification: "RESTRICTED_SECURITY" as const, reason: "Create corrected immutable version", idempotencyKey: "representation-create-2" };
  const second = service.createRepresentationSnapshot({ ...successorInput, checksum: computeRepresentationChecksum(successorInput) }); assert.equal(second.id, first.id); assert.equal(second.version, 2); assert.equal(first.canonicalContent["price"], 1200); assert.equal(second.canonicalContent["price"], 1250);
});

test("TEST-022 resolves representation authorship, classification and privacy from authoritative provenance", () => {
  const { service } = fixture();
  assert.throws(() => createSnapshot(service, { creatorId: "pua-1", editorIds: [], idempotencyKey: "spoofed-authorship" }), /PUBLICATION_NOT_ELIGIBLE/u);
  assert.throws(() => createSnapshot(service, { sourceClassification: "PUBLIC_APPROVED", idempotencyKey: "spoofed-classification" }), /PUBLICATION_NOT_ELIGIBLE/u);
  assert.throws(() => createSnapshot(service, { canonicalContent: { ...canonicalContent, contactName: "Restricted Person" }, idempotencyKey: "spoofed-content" }), /PUBLICATION_NOT_ELIGIBLE/u);
  const snapshot = createSnapshot(service, { idempotencyKey: "authoritative-source" }); assert.equal(snapshot.creatorId, "creator-1"); assert.deepEqual(snapshot.editorIds, ["editor-1"]); assert.equal(snapshot.classification, "RESTRICTED_SECURITY");
});

test("TEST-022 implements REQUESTED to UNDER_REVIEW to APPROVED with immutable history", () => {
  const { service } = fixture(); const requested = requestApproval(service); const underReview = claim(service, requested.id, requested.version); const approved = approve(service, requested.id, underReview.version);
  assert.equal(requested.status, "REQUESTED"); assert.equal(underReview.status, "UNDER_REVIEW"); assert.equal(approved.status, "APPROVED"); assert.equal(approved.decisionActorId, "pua-1"); assert.equal(Object.isFrozen(approved), true);
  assert.deepEqual(service.readApprovalHistory({ ...context("pua-1", ["PUA"]), approvalId: approved.id }).map((item: { readonly status: string }) => item.status), ["REQUESTED", "UNDER_REVIEW", "APPROVED"]);
  assert.throws(() => service.decideApproval({ ...context("pua-1", ["PUA"]), approvalId: approved.id, expectedVersion: approved.version, decision: "REJECTED", reason: "Cannot rewrite terminal decision", idempotencyKey: "terminal-rewrite" }), /STATE_TRANSITION_INVALID/u);
});

test("TEST-022 supports REQUESTED or UNDER_REVIEW rejection and corrected successor requests", () => {
  const { service } = fixture(); const first = requestApproval(service); const rejected = service.decideApproval({ ...context("pua-1", ["PUA"]), approvalId: first.id, expectedVersion: first.version, decision: "REJECTED", reason: "Exact representation requires correction", idempotencyKey: "reject-requested" }); assert.equal(rejected.status, "REJECTED");
  const correctedSnapshot = createSnapshot(service, { idempotencyKey: "corrected-representation" }); const successor = requestApproval(service, correctedSnapshot, { predecessorApprovalId: rejected.id, idempotencyKey: "successor-request" }); assert.equal(successor.predecessorApprovalId, rejected.id); assert.notEqual(successor.id, rejected.id);
  const second = requestApproval(service, createSnapshot(service, { idempotencyKey: "review-reject-representation" }), { idempotencyKey: "review-reject-request" }); const review = claim(service, second.id, second.version, "pua-2"); const reviewRejected = service.decideApproval({ ...context("pua-2", ["PUA"]), approvalId: second.id, expectedVersion: review.version, decision: "REJECTED", reason: "Review found mismatch", idempotencyKey: "reject-under-review" }); assert.equal(reviewRejected.status, "REJECTED");
});

test("TEST-022 denies invalid Verification, Permission, target/channel and policy bindings before queue entry", () => {
  const { service, setVerification, setPermission, setTargetPolicy } = fixture(); const snapshot = createSnapshot(service);
  setVerification(Object.freeze({ ...verification, teamId: "team-b" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "cross-team-verification" }), /VERIFICATION_STALE/u);
  setVerification(Object.freeze({ ...verification, status: "EXPIRED" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "stale-verification" }), /VERIFICATION_STALE/u);
  setVerification(verification); setPermission(Object.freeze({ ...permission, teamId: "team-b" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "cross-team-permission" }), /PERMISSION_SCOPE_MISMATCH/u);
  setPermission(Object.freeze({ ...permission, status: "REVOKED" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "revoked-permission" }), /PERMISSION_REQUIRED/u);
  setPermission(Object.freeze({ ...permission, fieldScope: ["PRICE"] as const })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "permission-scope" }), /PERMISSION_SCOPE_MISMATCH/u);
  setPermission(permission); setTargetPolicy(Object.freeze({ ...targetPolicy, channelStatus: "INACTIVE" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "inactive-channel" }), /CHANNEL_NOT_ALLOWED/u);
  setTargetPolicy(Object.freeze({ ...targetPolicy, targetPolicyVersion: "target-policy-v99" })); assert.throws(() => requestApproval(service, snapshot, { idempotencyKey: "target-policy-change" }), /TARGET_POLICY_CHANGED/u);
});

test("TEST-022 actor-level SoD denies requester, creator, editor, verifier and Permission decision actor despite role stacking", () => {
  const { service, audit } = fixture(); const approval = requestApproval(service);
  for (const [id, roles] of [["requester-1", ["AGT", "PUA"]], ["creator-1", ["PUA"]], ["editor-1", ["PUA"]], ["verifier-1", ["PUA"]], ["pmr-1", ["PUA"]]] as const) {
    assert.throws(() => service.assignOrClaimApprover({ ...context(id, roles), approvalId: approval.id, expectedVersion: approval.version, assigneeActorId: id, reason: "Conflicted self claim denied", idempotencyKey: `conflict-${id}` }), /APPROVAL_CONFLICT/u);
  }
  assert.equal(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", eventType: "PUBLICATION_APPROVAL_DENIED", targetId: approval.id }).length >= 4, true);
});

test("TEST-022 denies inherited MGR, ADM, SEC, REV, service and non-MFA decision authority", () => {
  const { service } = fixture(); const approval = requestApproval(service);
  for (const [id, roles] of [["manager-1", ["MGR"]], ["admin-1", ["ADM"]], ["security-1", ["SEC"]], ["reviewer-1", ["REV"]]] as const) assert.throws(() => service.assignOrClaimApprover({ ...context(id, roles), approvalId: approval.id, expectedVersion: approval.version, assigneeActorId: id, reason: "No inherited authority", idempotencyKey: `inherit-${id}` }), /APPROVER_NOT_ELIGIBLE|CAPABILITY_DENIED/u);
  const review = claim(service, approval.id, approval.version);
  assert.throws(() => service.decideApproval({ ...context("pua-1", ["PUA"], { assurance: "SINGLE_FACTOR", isMfaVerified: false }), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED", reason: "MFA missing", idempotencyKey: "no-mfa" }), /REAUTHENTICATION_REQUIRED|MFA_REQUIRED/u);
  assert.throws(() => service.decideApproval({ ...context("pua-1", ["PUA"]), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED", reason: "", idempotencyKey: "no-reason" }), /REASON_REQUIRED/u);
  assert.throws(() => service.decideApproval({ ...context("scheduler-1", ["SVC"], { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false }), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED", reason: "Service cannot decide", idempotencyKey: "service-decision" }), /APPROVER_NOT_ELIGIBLE|HUMAN_AUTHORITY_REQUIRED/u);
});

test("TEST-022 requires assignment, current session and exact expected version", () => {
  const { service } = fixture(); const approval = requestApproval(service);
  assert.throws(() => service.decideApproval({ ...context("pua-1", ["PUA"]), approvalId: approval.id, expectedVersion: approval.version, decision: "APPROVED", reason: "Cannot approve before assignment", idempotencyKey: "approve-unassigned" }), /APPROVAL_ASSIGNMENT_REQUIRED/u);
  assert.throws(() => service.assignOrClaimApprover({ ...context("pua-1", ["PUA"]), approvalId: approval.id, expectedVersion: approval.version + 1, assigneeActorId: "pua-1", reason: "Stale expected version", idempotencyKey: "stale-expected-version" }), /EXPECTED_VERSION_MISMATCH/u);
  assert.throws(() => service.assignOrClaimApprover({ ...context("pua-1", ["PUA"], { expiresAt: "2026-07-23T01:00:00.000Z" }), approvalId: approval.id, expectedVersion: approval.version, assigneeActorId: "pua-1", reason: "Expired session denied", idempotencyKey: "stale-session" }), /AUTHENTICATION_REQUIRED/u);
});

test("TEST-022 preserves assignment/release/reassignment evidence and revalidates current authority on replay", () => {
  const { service, revokeEligibility } = fixture(); const requested = requestApproval(service); const claimed = claim(service, requested.id, requested.version); const released = service.reassignOrReleaseApprover({ ...context("pua-1", ["PUA"]), approvalId: claimed.id, expectedVersion: claimed.version, reason: "Release workload", idempotencyKey: "release-1" }); assert.equal(released.assignedApproverActorId, undefined);
  const reassigned = service.assignOrClaimApprover({ ...context("pua-2", ["PUA"]), approvalId: released.id, expectedVersion: released.version, assigneeActorId: "pua-2", reason: "Claim released review", idempotencyKey: "claim-pua-2" }); assert.equal(reassigned.assignmentHistory.length, 3);
  const approved = approve(service, reassigned.id, reassigned.version, "pua-2"); assert.equal(approve(service, reassigned.id, reassigned.version, "pua-2").version, approved.version);
  revokeEligibility("pua-2"); assert.throws(() => approve(service, reassigned.id, reassigned.version, "pua-2"), /APPROVER_NOT_ELIGIBLE/u);
});

test("TEST-022 replay revalidates a distinct assignee and current assignment", () => {
  const { service, revokeEligibility } = fixture(); const requested = requestApproval(service);
  const assigned = service.assignOrClaimApprover({ ...context("pua-1", ["PUA"]), approvalId: requested.id, expectedVersion: requested.version, assigneeActorId: "pua-2", reason: "Assign independent eligible reviewer", idempotencyKey: "assign-distinct-pua" }); assert.equal(assigned.assignedApproverActorId, "pua-2");
  revokeEligibility("pua-2"); assert.throws(() => service.assignOrClaimApprover({ ...context("pua-1", ["PUA"]), approvalId: requested.id, expectedVersion: requested.version, assigneeActorId: "pua-2", reason: "Assign independent eligible reviewer", idempotencyKey: "assign-distinct-pua" }), /APPROVER_NOT_ELIGIBLE/u);
});

test("TEST-022 release and reassignment replays safely return the prior idempotent result", () => {
  const { service } = fixture(); const first = requestApproval(service); const claimed = claim(service, first.id, first.version); const releaseRequest = { ...context("pua-1", ["PUA"]), approvalId: claimed.id, expectedVersion: claimed.version, reason: "Release exact assignment", idempotencyKey: "release-replay" } as const; const released = service.reassignOrReleaseApprover(releaseRequest); assert.equal(service.reassignOrReleaseApprover(releaseRequest).version, released.version);
  const second = requestApproval(service, createSnapshot(service, { idempotencyKey: "reassign-replay-representation" }), { idempotencyKey: "reassign-replay-request" }); const secondClaimed = claim(service, second.id, second.version); const reassignRequest = { ...context("pua-1", ["PUA"]), approvalId: secondClaimed.id, expectedVersion: secondClaimed.version, assigneeActorId: "pua-2", reason: "Reassign exact review", idempotencyKey: "reassign-replay" } as const; const reassigned = service.reassignOrReleaseApprover(reassignRequest); assert.equal(service.reassignOrReleaseApprover(reassignRequest).version, reassigned.version);
});

test("TEST-022 distinguishes eligible manual revocation from scheduler-only idempotent expiry", () => {
  const { service } = fixture(); const first = requestApproval(service); const approved = approve(service, first.id, claim(service, first.id, first.version).version);
  const revoked = service.revokeApproval({ ...context("pua-2", ["PUA"]), approvalId: approved.id, expectedVersion: approved.version, reason: "Dependency invalidated exact scope", impactScope: ["target-1", "channel-1"], idempotencyKey: "revoke-approval" }); assert.equal(revoked.status, "REVOKED");
  assert.throws(() => service.revokeApproval({ ...context("manager-1", ["MGR"]), approvalId: revoked.id, expectedVersion: revoked.version, reason: "Manager cannot revoke", impactScope: ["target-1"], idempotencyKey: "manager-revoke" }), /APPROVER_NOT_ELIGIBLE|CAPABILITY_DENIED|STATE_TRANSITION_INVALID/u);
  const second = requestApproval(service, createSnapshot(service, { idempotencyKey: "expiry-representation" }), { idempotencyKey: "expiry-request" }); const secondApproved = approve(service, second.id, claim(service, second.id, second.version).version); now = new Date("2026-07-28T00:00:00.001Z");
  const expiryRequest = { ...context("scheduler-1", ["SVC"], { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false, expiresAt: "2026-07-30T12:00:00.000Z", absoluteExpiresAt: "2026-07-31T12:00:00.000Z" }), approvalId: secondApproved.id, expectedVersion: secondApproved.version, idempotencyKey: "expire-approval" } as const;
  const expired = service.expireApproval(expiryRequest); assert.equal(expired.status, "EXPIRED"); assert.equal(service.expireApproval(expiryRequest).version, expired.version);
  assert.throws(() => service.revokeApproval({ ...expiryRequest, reason: "Scheduler revoke denied", impactScope: ["target-1"] }), /APPROVER_NOT_ELIGIBLE|HUMAN_AUTHORITY_REQUIRED/u);
  assert.throws(() => service.expireApproval({ ...expiryRequest, actor: actor("worker-1", ["SVC"], { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false }), idempotencyKey: "worker-expiry" }), /SERVICE_AUTHORITY_REQUIRED/u);
});

test("TEST-033 CheckEffectiveApproval requires exact complete binding and never implies delivery", () => {
  const { service, audit } = fixture(); const requested = requestApproval(service); const approved = approve(service, requested.id, claim(service, requested.id, requested.version).version);
  const binding = { ...context("ops-1", ["OPS"]), approvalId: approved.id, approvalVersion: approved.version, representationId: approved.representationId, representationVersion: approved.representationVersion, representationChecksum: approved.representationChecksum, subjectRef, targetId: approved.targetId, channelId: approved.channelId, fieldScope: approved.approvedFieldScope, mediaScope: approved.approvedMediaScope, audience: approved.audience, language: approved.language, verificationId: approved.verificationId, verificationVersion: approved.verificationRevision, permissionId: approved.permissionId, permissionVersion: approved.permissionRevision, targetPolicyVersion: approved.targetPolicyVersion, channelPolicyVersion: approved.channelPolicyVersion, consumerDuty: "EXECUTION" } as const;
  const effective = service.checkEffectiveApproval(binding); assert.equal(effective.effective, true); assert.equal(service.checkEffectiveApproval({ ...binding, ...context("ops-1", ["OPS"]) }).effective, true); assert.equal(effective.reasonCodes.includes("DELIVERY_REQUESTED"), false); assert.equal("publicationId" in effective, false); assert.equal("externalReference" in effective, false);
  assert.throws(() => service.checkEffectiveApproval({ ...binding, consumerDuty: undefined as never }), /FORBIDDEN/u);
  assert.equal(JSON.stringify(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", eventType: "PUBLICATION_APPROVAL_EFFECTIVE_CHECKED", targetId: approved.id })).includes("EXECUTION"), true);
  assert.equal(service.checkEffectiveApproval({ ...binding, representationChecksum: "sha256:changed" }).effective, false);
  assert.equal(service.checkEffectiveApproval({ ...binding, channelId: "channel-2" }).effective, false);
  assert.equal(service.checkEffectiveApproval({ ...binding, actor: actor(approved.decisionActorId!, ["PUA", "OPS"]), consumerDuty: "EXECUTION" }).effective, false);
});

test("TEST-022 changed representations and terminal Approvals are never effective", () => {
  const { service } = fixture(); const requested = requestApproval(service); const approved = approve(service, requested.id, claim(service, requested.id, requested.version).version);
  const binding = { ...context("ops-1", ["OPS"]), approvalId: approved.id, approvalVersion: approved.version, representationId: approved.representationId, representationVersion: approved.representationVersion, representationChecksum: approved.representationChecksum, subjectRef, targetId: approved.targetId, channelId: approved.channelId, fieldScope: approved.approvedFieldScope, mediaScope: approved.approvedMediaScope, audience: approved.audience, language: approved.language, verificationId: approved.verificationId, verificationVersion: approved.verificationRevision, permissionId: approved.permissionId, permissionVersion: approved.permissionRevision, targetPolicyVersion: approved.targetPolicyVersion, channelPolicyVersion: approved.channelPolicyVersion, consumerDuty: "EXECUTION" as const };
  const changed = { ...canonicalContent, price: 1250 }; const successorInput = { ...context("requester-1", ["AGT"]), representationId: approved.representationId, expectedPreviousVersion: approved.representationVersion, subjectRef, canonicalContent: changed, fieldScope: ["PRICE", "AVAILABILITY"] as const, mediaScope: ["PHOTO"], language: "en", audience: publicAudience, targetId: "target-1", channelId: "channel-1", targetPolicyVersion: "target-policy-v2", channelPolicyVersion: "channel-policy-v3", provenanceRef: { entityType: "SourceProvenance", entityId: "source-2", version: 1 }, creatorId: "creator-1", editorIds: ["editor-1"], sourceClassification: "RESTRICTED_SECURITY" as const, reason: "Material change creates successor", idempotencyKey: "effective-successor" }; service.createRepresentationSnapshot({ ...successorInput, checksum: computeRepresentationChecksum(successorInput) });
  assert.equal(service.checkEffectiveApproval(binding).reasonCodes.includes("REPRESENTATION_CHANGED"), true);
  const separate = requestApproval(service, createSnapshot(service, { idempotencyKey: "revoke-effective-representation" }), { idempotencyKey: "revoke-effective-request" }); const separatelyApproved = approve(service, separate.id, claim(service, separate.id, separate.version).version); const revoked = service.revokeApproval({ ...context("pua-2", ["PUA"]), approvalId: separatelyApproved.id, expectedVersion: separatelyApproved.version, reason: "Invalidate exact Approval", impactScope: ["target-1"], idempotencyKey: "effective-revoke" });
  assert.equal(service.checkEffectiveApproval({ ...binding, approvalId: revoked.id, approvalVersion: revoked.version, representationId: revoked.representationId, representationVersion: revoked.representationVersion, representationChecksum: revoked.representationChecksum }).reasonCodes.includes("APPROVAL_REVOKED"), true);
});

test("TEST-022 excludes expired pending reviews from the active queue without inventing a lifecycle transition", () => {
  const { service } = fixture(); const approval = requestApproval(service); now = new Date("2026-07-28T00:00:00.001Z"); const validReader = context("pua-1", ["PUA"], { expiresAt: "2026-07-29T00:00:00.000Z", absoluteExpiresAt: "2026-07-30T00:00:00.000Z" }); assert.equal(service.listApprovalQueue({ ...validReader, filters: { status: "REQUESTED" } }).length, 0); assert.equal(service.readApproval({ ...validReader, approvalId: approval.id }).status, "REQUESTED");
});

test("TEST-022 queue and review context are team/purpose scoped, privacy-safe and show current prerequisite validity", () => {
  const { service } = fixture(); const approval = requestApproval(service); const queue = service.listApprovalQueue({ ...context("pua-1", ["PUA"]), filters: { status: "REQUESTED", targetId: "target-1" } }); assert.equal(queue.length, 1);
  const review = service.getApprovalReviewContext({ ...context("pua-1", ["PUA"]), approvalId: approval.id }); assert.equal(review.representation.checksum, approval.representationChecksum); assert.equal(review.verificationValid, true); assert.equal(review.permissionValid, true); assert.equal(JSON.stringify(review).match(/phone|email|contactValue/giu), null);
  assert.throws(() => service.readApproval({ ...context("pua-1", ["PUA"], { teamId: "team-b" }), approvalId: approval.id }), /NOT_FOUND|APPROVAL_REQUIRED/u);
});

test("TEST-022 inherits representation classification and rejects session-switch conflict bypass", () => {
  const { service } = fixture(); const restricted = createSnapshot(service, { sourceClassification: "RESTRICTED_SECURITY", idempotencyKey: "restricted-representation" }); assert.equal(restricted.classification, "RESTRICTED_SECURITY");
  const approval = requestApproval(service, restricted, { idempotencyKey: "restricted-request" });
  assert.throws(() => service.assignOrClaimApprover({ ...context("requester-1", ["AGT", "PUA"], { id: "different-session-same-actor" }), approvalId: approval.id, expectedVersion: approval.version, assigneeActorId: "requester-1", reason: "Session switch cannot remove conflict", idempotencyKey: "session-switch-conflict" }), /APPROVAL_CONFLICT/u);
});

test("TEST-022 audits failed MFA and rejects break-glass, AI and connector decision attempts", () => {
  const { service, audit } = fixture(); const approval = requestApproval(service); const review = claim(service, approval.id, approval.version);
  const noMfa = { ...context("pua-1", ["PUA"], { assurance: "SINGLE_FACTOR", isMfaVerified: false }), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED" as const, reason: "MFA result is insufficient", idempotencyKey: "audit-no-mfa" };
  assert.throws(() => service.decideApproval(noMfa), /MFA_REQUIRED/u);
  assert.equal(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", eventType: "PUBLICATION_APPROVAL_DENIED", targetId: approval.id }).some((event) => event.reason === "MFA_REQUIRED"), true);
  assert.throws(() => service.decideApproval({ ...context("pua-1", ["PUA"]), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED", reason: "Break glass cannot bypass approval", idempotencyKey: "break-glass", breakGlass: true }), /FORBIDDEN/u);
  for (const id of ["ai-1", "connector-1"]) assert.throws(() => service.decideApproval({ ...context(id, ["SVC"], { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false }), approvalId: approval.id, expectedVersion: review.version, decision: "APPROVED", reason: "Non-human decision denied", idempotencyKey: `non-human-${id}` }), /APPROVER_NOT_ELIGIBLE/u);
});

test("TEST-022 replay revalidates current Permission and records safe idempotency evidence", () => {
  const { service, setPermission, audit } = fixture(); const approval = requestApproval(service); const claimed = claim(service, approval.id, approval.version); assert.equal(claim(service, approval.id, approval.version).version, claimed.version);
  assert.equal(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", eventType: "PUBLICATION_APPROVAL_REPLAY_AUTHORIZED", targetId: approval.id }).length, 1);
  setPermission(Object.freeze({ ...permission, status: "REVOKED" })); assert.throws(() => claim(service, approval.id, approval.version), /PERMISSION_REQUIRED/u);
});

test("TEST-033 effective Approval denies same-actor reconciler without invoking reconciliation", () => {
  const { service } = fixture(); const requested = requestApproval(service); const approved = approve(service, requested.id, claim(service, requested.id, requested.version).version);
  const binding = { ...context(approved.decisionActorId!, ["PUA", "OPS"]), approvalId: approved.id, approvalVersion: approved.version, representationId: approved.representationId, representationVersion: approved.representationVersion, representationChecksum: approved.representationChecksum, subjectRef, targetId: approved.targetId, channelId: approved.channelId, fieldScope: approved.approvedFieldScope, mediaScope: approved.approvedMediaScope, audience: approved.audience, language: approved.language, verificationId: approved.verificationId, verificationVersion: approved.verificationRevision, permissionId: approved.permissionId, permissionVersion: approved.permissionRevision, targetPolicyVersion: approved.targetPolicyVersion, channelPolicyVersion: approved.channelPolicyVersion, consumerDuty: "RECONCILIATION" } as const;
  const result = service.checkEffectiveApproval(binding); assert.equal(result.effective, false); assert.equal(result.reasonCodes.includes("APPROVAL_CONFLICT"), true); assert.equal(JSON.stringify(result).includes("RECONCILIATION"), false);
});
