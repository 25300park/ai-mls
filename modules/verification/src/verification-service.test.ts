import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { VerificationService, type VerificationField } from "./verification-service.js";

let now = new Date("2026-07-19T08:00:00.000Z");
const clock = (): Date => new Date(now);

function actor(principalId: string, role: SessionContext["roles"][number], overrides: Partial<SessionContext> = {}): SessionContext {
  return Object.freeze({ id: `session-${principalId}`, principalId, principalType: "HUMAN", roles: [role], teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T07:00:00.000Z", expiresAt: "2026-07-31T08:00:00.000Z", absoluteExpiresAt: "2026-08-01T08:00:00.000Z", familyId: `family-${principalId}`, refreshReference: `refresh-${principalId}`, ...overrides });
}

function assignment(principalId: string, role: RoleAssignment["role"]): RoleAssignment {
  return Object.freeze({ id: `authority-${principalId}`, principalId, role, teamIds: ["team-a"], resourceTypes: ["Verification", "VerifierAssignment", "ReverificationRequest"], purposes: ["LISTING_VERIFICATION"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-30T00:00:00.000Z", status: "ACTIVE" });
}

function fixture() {
  now = new Date("2026-07-19T08:00:00.000Z");
  let sequence = 0;
  const audit = new AuditLog({ clock, idFactory: () => `audit-verification-${String(++sequence)}` });
  const authorization = new AuthorizationService({ assignments: [assignment("agent", "AGT"), assignment("verifier", "VER"), assignment("manager", "MGR"), assignment("reviewer", "REV"), assignment("senior-agent", "SAG"), assignment("scheduler", "SVC")], auditSink: audit, clock, policyVersion: "authorization-v1" });
  return { service: new VerificationService({ authorizationService: authorization, auditSink: audit, clock, idFactory: () => `verification-object-${String(++sequence)}`, policyVersion: "verification-policy-v1" }), audit };
}

const context = (principalId = "agent", role: SessionContext["roles"][number] = "AGT") => ({ actor: actor(principalId, role), purpose: "LISTING_VERIFICATION", correlationId: `correlation-${principalId}` } as const);
const evidence = Object.freeze([{ entityType: "Communication", entityId: "communication-1", version: 1, classification: "RESTRICTED_PERSONAL" as const }]);

function requested(service: VerificationService, fields: readonly VerificationField[] = ["AVAILABILITY", "PRICE"]) {
  return service.requestVerification({ ...context(), subjectRef: { entityType: "ListingOffer", entityId: "offer-1", version: 3 }, matchResultRef: { entityType: "MatchResult", entityId: "match-1", version: 2 }, fields, evidenceReferences: evidence, reason: "Reviewed match requires current facts", idempotencyKey: "request-1" });
}

test("TEST-010/020 FEAT-012 requests exact field-level Verification without promoting the Match Result", () => {
  const { service } = fixture();
  const verification = requested(service);
  assert.equal(verification.status, "REQUESTED");
  assert.deepEqual(verification.fields, ["AVAILABILITY", "PRICE"]);
  assert.equal(verification.subjectRef.version, 3);
  assert.equal(verification.matchResultRef?.version, 2);
  assert.equal("permissionId" in verification, false);
  assert.equal("publicationId" in verification, false);
  assert.equal(Object.isFrozen(verification), true);
});

test("TEST-020/032 only MGR assigns and only VER or MGR produces Verification decisions", () => {
  const { service } = fixture(); const verification = requested(service);
  assert.throws(() => service.assignVerifier({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: 1, assigneePrincipalId: "verifier", assigneeRole: "VER", qualificationReference: "qualification-ver-1", effectiveUntil: "2026-07-20T00:00:00.000Z", reason: "Self assignment denied" }), /CAPABILITY_DENIED/u);
  const assigned = service.assignVerifier({ ...context("manager", "MGR"), verificationId: verification.id, expectedVersion: 1, assigneePrincipalId: "verifier", assigneeRole: "VER", qualificationReference: "qualification-ver-1", effectiveUntil: "2026-07-20T00:00:00.000Z", reason: "Qualified verifier assigned" });
  assert.equal(assigned.verification.status, "IN_REVIEW");
  assert.equal(assigned.assignment.role, "VER");
  assert.throws(() => service.decide({ ...context("senior-agent", "SAG"), verificationId: verification.id, expectedVersion: 2, decision: "VERIFIED", reason: "SAG cannot decide" }), /CAPABILITY_DENIED/u);
  assert.throws(() => service.decide({ ...context("reviewer", "REV"), verificationId: verification.id, expectedVersion: 2, decision: "VERIFIED", reason: "REV cannot decide" }), /CAPABILITY_DENIED/u);
  const decided = service.decide({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: 2, decision: "VERIFIED", reason: "Evidence supports scoped facts" });
  assert.equal(decided.status, "VERIFIED");
  assert.equal(decided.fieldResults.find((item) => item.field === "AVAILABILITY")?.validUntil, "2026-07-26T08:00:00.000Z");
  assert.equal(decided.fieldResults.find((item) => item.field === "PRICE")?.validUntil, "2026-08-02T08:00:00.000Z");
});

test("TEST-032 REV supports evidence review but cannot decide", () => {
  const { service } = fixture(); const verification = requested(service);
  const assigned = service.assignVerifier({ ...context("manager", "MGR"), verificationId: verification.id, expectedVersion: 1, assigneePrincipalId: "reviewer", assigneeRole: "REV", qualificationReference: "review-support-1", effectiveUntil: "2026-07-20T00:00:00.000Z", reason: "Evidence review support" });
  const reviewed = service.recordReviewSupport({ ...context("reviewer", "REV"), verificationId: verification.id, expectedVersion: assigned.verification.version, action: "REQUEST_EVIDENCE", recommendation: "Price evidence is missing a current source reference" });
  assert.equal(reviewed.reviewHistory[0]?.action, "REQUEST_EVIDENCE");
  assert.equal(reviewed.status, "IN_REVIEW");
  assert.throws(() => service.decide({ ...context("reviewer", "REV"), verificationId: verification.id, expectedVersion: reviewed.version, decision: "INSUFFICIENT", reason: "Support role cannot decide" }), /CAPABILITY_DENIED/u);
});

test("TEST-001/047 self-verification is denied except explicit MFA MGR override", () => {
  const { service, audit } = fixture();
  const createdByVerifier = service.requestVerification({ ...context("verifier", "VER"), subjectRef: { entityType: "ListingOffer", entityId: "offer-self", version: 1 }, fields: ["LEGAL_DOCUMENTS"], evidenceReferences: evidence, reason: "Request own review", idempotencyKey: "self-1" });
  const assignedVerifier = service.assignVerifier({ ...context("manager", "MGR"), verificationId: createdByVerifier.id, expectedVersion: 1, assigneePrincipalId: "verifier", assigneeRole: "VER", qualificationReference: "qualification-ver-1", effectiveUntil: "2026-07-20T00:00:00.000Z", reason: "Assignment for separation test" });
  assert.throws(() => service.decide({ ...context("verifier", "VER"), verificationId: createdByVerifier.id, expectedVersion: assignedVerifier.verification.version, decision: "VERIFIED", reason: "Self decision denied" }), /SEPARATION_OF_DUTIES_DENIED/u);
  const createdByManager = service.requestVerification({ ...context("manager", "MGR"), subjectRef: { entityType: "ListingOffer", entityId: "offer-manager", version: 1 }, fields: ["CONTACT_REACHABILITY"], evidenceReferences: evidence, reason: "Urgent manager request", idempotencyKey: "manager-self-1" });
  const assignedManager = service.assignVerifier({ ...context("manager", "MGR"), verificationId: createdByManager.id, expectedVersion: 1, assigneePrincipalId: "manager", assigneeRole: "MGR", qualificationReference: "manager-override-authority", effectiveUntil: "2026-07-20T00:00:00.000Z", reason: "Manager override assignment" });
  const overridden = service.decide({ ...context("manager", "MGR"), verificationId: createdByManager.id, expectedVersion: assignedManager.verification.version, decision: "VERIFIED", reason: "Emergency manager override with independent evidence", managerOverride: true });
  assert.equal(overridden.status, "VERIFIED");
  assert.equal(overridden.approvalHistory.at(-1)?.managerOverride, true);
  const revoked = service.revoke({ ...context("manager", "MGR"), verificationId: overridden.id, expectedVersion: overridden.version, trigger: "CONTACT_CHANGE", reason: "Manager invalidated changed contact evidence", managerOverride: true });
  assert.equal(revoked.status, "REVOKED");
  assert.equal(revoked.approvalHistory.at(-1)?.managerOverride, true);
  const overrideEvent = audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY", targetId: revoked.id }).find((event) => event.eventType === "VERIFICATION_REVOKED");
  assert.equal(overrideEvent?.details?.["managerOverride"], true);
});

test("TEST-024 applies default validity, expires without renewal and creates immutable reverification successors", () => {
  const { service } = fixture(); const verification = requested(service, ["AVAILABILITY"]);
  const assigned = service.assignVerifier({ ...context("manager", "MGR"), verificationId: verification.id, expectedVersion: 1, assigneePrincipalId: "verifier", assigneeRole: "VER", qualificationReference: "qualification-ver-1", effectiveUntil: "2026-07-30T00:00:00.000Z", reason: "Availability verification" });
  const verified = service.decide({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: assigned.verification.version, decision: "VERIFIED", reason: "Availability confirmed" });
  now = new Date("2026-07-26T08:00:00.001Z");
  const expired = service.evaluateExpiry({ ...context("scheduler", "SVC"), actor: actor("scheduler", "SVC", { principalType: "SERVICE", assurance: "WORKLOAD", isMfaVerified: false, authenticatedAt: "2026-07-26T07:00:00.000Z", expiresAt: "2026-07-26T09:00:00.000Z", absoluteExpiresAt: "2026-07-27T08:00:00.000Z" }), verificationId: verified.id, expectedVersion: verified.version });
  assert.equal(expired.status, "EXPIRED");
  const successor = service.requestReverification({ ...context(), priorVerificationId: expired.id, expectedVersion: expired.version, trigger: "EXPIRATION", reason: "Availability expired", idempotencyKey: "reverify-1" });
  const replay = service.requestReverification({ ...context(), priorVerificationId: expired.id, expectedVersion: expired.version, trigger: "EXPIRATION", reason: "Availability expired", idempotencyKey: "reverify-1" });
  assert.equal(successor.verification.status, "REQUESTED");
  assert.equal(successor.verification.priorVerificationId, expired.id);
  assert.equal(successor.request.status, "SCHEDULED");
  assert.equal(replay.verification.id, successor.verification.id);
  assert.equal(replay.verification.version, successor.verification.version);
  assert.equal(replay.request.id, successor.request.id);
  assert.equal(service.readHistory({ ...context(), verificationId: expired.id }).some((item) => item.status === "VERIFIED"), true);
});

test("TEST-024 only VER or MGR revokes material changes and history stays append-only", () => {
  const { service } = fixture(); const verification = requested(service, ["PRICE"]);
  const assigned = service.assignVerifier({ ...context("manager", "MGR"), verificationId: verification.id, expectedVersion: 1, assigneePrincipalId: "verifier", assigneeRole: "VER", qualificationReference: "qualification-ver-1", effectiveUntil: "2026-07-30T00:00:00.000Z", reason: "Price verification" });
  const verified = service.decide({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: assigned.verification.version, decision: "VERIFIED", reason: "Price confirmed" });
  const revoked = service.revoke({ ...context("manager", "MGR"), verificationId: verified.id, expectedVersion: verified.version, trigger: "PRICE_CHANGE", reason: "Listing price changed" });
  assert.equal(revoked.status, "REVOKED");
  assert.deepEqual(service.readHistory({ ...context("manager", "MGR"), verificationId: revoked.id }).map((item) => item.status), ["REQUESTED", "IN_REVIEW", "VERIFIED", "REVOKED"]);
});

test("TEST-045 AI-007 validates evidence advisory output without mutating Verification", () => {
  const { service } = fixture(); const verification = requested(service, ["LEGAL_DOCUMENTS"]);
  const envelope = { schemaVersion: "1.0", capabilityId: "AI-007", subjectRef: { entityType: "Verification", entityId: verification.id, version: verification.version }, provenance: [{ entityType: "Verification", entityId: verification.id, version: verification.version }], classification: "RESTRICTED_PERSONAL", confidence: { band: "HIGH", reasonCodes: ["EVIDENCE_CONSISTENT"], policyVersion: "confidence-contract-v1" }, output: { validationOutcome: "CONSISTENT", reviewRoute: "HUMAN_REVIEW_REQUIRED", fieldConfidences: [{ field: "LEGAL_DOCUMENTS", band: "HIGH" }] } } as const;
  assert.equal(service.validateEvidence({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: 1, result: envelope }).status, "VALID");
  assert.equal(service.readVerification({ ...context("verifier", "VER"), verificationId: verification.id }).version, 1);
  assert.equal(service.validateEvidence({ ...context("verifier", "VER"), verificationId: verification.id, expectedVersion: 1, result: { ...envelope, output: { ...envelope.output, verificationApproved: true } } }).status, "REJECTED");
});

test("TEST-048/051 evidence remains reference-only, classified and privacy-safe in audit", () => {
  const { service, audit } = fixture(); const verification = requested(service, ["CONTACT_REACHABILITY"]);
  assert.equal(verification.classification, "RESTRICTED_PERSONAL");
  assert.equal(JSON.stringify(verification).match(/phone|email|contactValue/giu), null);
  assert.equal(JSON.stringify(audit.query({ requesterId: "security", purpose: "AUDIT_INTEGRITY" })).match(/phone|email|contactValue/giu), null);
  assert.throws(() => service.readVerification({ ...context(), actor: actor("other-team", "AGT", { teamId: "team-b" }), verificationId: verification.id }), /VERIFICATION_NOT_FOUND/u);
  assert.throws(() => service.requestVerification({ ...context(), subjectRef: { entityType: "ListingOffer", entityId: "offer-sensitive", version: 1 }, fields: ["CONTACT_REACHABILITY"], evidenceReferences: evidence, reason: "Contact person@example.com", idempotencyKey: "sensitive-reason" }), /SENSITIVE_FIELD_RESTRICTED/u);
});
