import assert from "node:assert/strict";
import test from "node:test";

import { AuditLog } from "../../audit/src/audit-log.js";
import { AuthorizationService, type RoleAssignment } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";
import { ListingService } from "./listing-service.js";

function actor(id: string, role: "AGT" | "DUR"): SessionContext {
  return Object.freeze({ id: `session-${id}`, principalId: id, principalType: "HUMAN", roles: [role], teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T01:00:00.000Z", absoluteExpiresAt: "2026-07-19T02:00:00.000Z", familyId: `family-${id}`, refreshReference: `refresh-${id}` });
}

function fixture(): ListingService {
  let sequence = 0;
  const clock = (): Date => new Date("2026-07-19T00:05:00.000Z");
  const audit = new AuditLog({ clock, idFactory: () => `audit-listing-${String(++sequence)}` });
  const assignments: readonly RoleAssignment[] = [
    { id: "assignment-agent", principalId: "agent-1", role: "AGT", teamIds: ["team-a"], resourceTypes: ["CandidateListing", "ListingOffer", "DuplicateGroup"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
    { id: "assignment-duplicate", principalId: "duplicate-1", role: "DUR", teamIds: ["team-a"], resourceTypes: ["DuplicateGroup"], purposes: ["LISTING_GOVERNANCE"], effectiveFrom: "2026-07-18T00:00:00.000Z", effectiveUntil: "2026-07-20T00:00:00.000Z", status: "ACTIVE" },
  ];
  const authorizationService = new AuthorizationService({ assignments, auditSink: audit, clock, policyVersion: "auth-v1" });
  return new ListingService({ authorizationService, auditSink: audit, clock, idFactory: () => `listing-${String(++sequence)}`, policyVersion: "listing-v1" });
}

function createCandidate(service: ListingService, suffix: string) {
  return service.createCandidate({ actor: actor("agent-1", "AGT"), propertyRef: { entityType: "Property", entityId: `property-${suffix}`, version: 1 }, sourceRefs: [{ entityType: "RawSource", entityId: `raw-${suffix}`, version: 1 }], intakeRef: { entityType: "Intake", entityId: `intake-${suffix}`, version: 3 }, unresolvedFields: [], purpose: "LISTING_GOVERNANCE", correlationId: `correlation-candidate-${suffix}` });
}

test("TEST-010 Candidate and Offer remain unverified claims", () => {
  const service = fixture();
  const candidate = createCandidate(service, "1");
  const offer = service.createOffer({ actor: actor("agent-1", "AGT"), candidateId: candidate.id, expectedCandidateVersion: candidate.version, transactionType: "RENT", terms: { currency: "OPAQUE", amountReference: "term-bundle-1" }, sourceRefs: candidate.sourceRefs, purpose: "LISTING_GOVERNANCE", correlationId: "correlation-offer" });
  assert.equal(candidate.authority, "CANDIDATE");
  assert.equal(Object.isFrozen(candidate.sourceRefs), true);
  assert.equal(Object.isFrozen(candidate.sourceRefs[0]), true);
  assert.equal(candidate.status, "candidate");
  assert.equal(offer.authority, "CANDIDATE_CLAIM");
  assert.equal("verificationStatus" in candidate, false);
  assert.equal("publicationStatus" in offer, false);

  const revisedCandidate = service.reviseCandidate({ actor: actor("agent-1", "AGT"), candidateId: candidate.id, expectedVersion: candidate.version, status: "verification-pending", unresolvedFields: ["availability"], reason: "Verification requested without asserting outcome", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-candidate-revise" });
  const revisedOffer = service.reviseOffer({ actor: actor("agent-1", "AGT"), offerId: offer.id, expectedVersion: offer.version, status: "active", terms: { amountReference: "bundle-2" }, reason: "Offer terms refreshed", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-offer-revise" });
  assert.equal(revisedCandidate.status, "verification-pending");
  assert.equal(revisedOffer.version, 2);
});

test("API-006 candidate create is idempotent for the same normalized intent", () => {
  const service = fixture();
  const request = { actor: actor("agent-1", "AGT"), propertyRef: { entityType: "Property", entityId: "property-idempotent", version: 1 }, sourceRefs: [{ entityType: "RawSource", entityId: "raw-idempotent", version: 1 }], intakeRef: { entityType: "Intake", entityId: "intake-idempotent", version: 3 }, unresolvedFields: [], idempotencyKey: "candidate-create-1", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-candidate-idempotent" } as const;
  const first = service.createCandidate(request);
  const replay = service.createCandidate({ ...request, correlationId: "correlation-candidate-replay" });
  assert.equal(replay.id, first.id);
  assert.throws(() => service.createCandidate({ ...request, intakeRef: { ...request.intakeRef, version: 4 }, correlationId: "correlation-candidate-conflict" }), /IDEMPOTENCY_CONFLICT/);
});

test("TEST-017 duplicate AI suggestion has no effect until DUR disposition", () => {
  const service = fixture();
  const first = createCandidate(service, "1");
  const second = createCandidate(service, "2");
  const suggested = service.suggestDuplicate({ actor: actor("agent-1", "AGT"), subjectRefs: [{ entityType: "CandidateListing", entityId: first.id, version: first.version }, { entityType: "CandidateListing", entityId: second.id, version: second.version }], aiResultRef: { entityType: "AiResult", entityId: "ai-duplicate-1", version: 1 }, relationship: "UNCERTAIN", recommendation: "NEEDS_MORE_EVIDENCE", signals: ["similar alias"], contradictions: [], confidence: "MEDIUM", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-duplicate-suggest" });
  assert.equal(suggested.status, "DUPLICATE.SUGGESTED");
  assert.equal(service.readCandidate(first.id).relatedCandidateIds.length, 0);

  const decided = service.disposeDuplicate({ actor: actor("duplicate-1", "DUR"), groupId: suggested.id, expectedVersion: suggested.version, decision: "RESOLVED_LINK", reason: "Same opportunity, distinct evidence retained", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-duplicate-decide" });
  assert.equal(decided.status, "DUPLICATE.RESOLVED_LINK");
  assert.deepEqual(service.readCandidate(first.id).relatedCandidateIds, [second.id]);
  assert.equal(decided.decisionHistory[0]?.actorId, "duplicate-1");
  assert.deepEqual(decided.subjectRefs, suggested.subjectRefs);
  assert.equal(Object.isFrozen(decided.decisionHistory), true);
});

test("TEST-028 duplicate disposition enforces optimistic concurrency and evidence", () => {
  const service = fixture();
  const first = createCandidate(service, "1");
  const second = createCandidate(service, "2");
  const suggested = service.suggestDuplicate({ actor: actor("agent-1", "AGT"), subjectRefs: [{ entityType: "CandidateListing", entityId: first.id, version: 1 }, { entityType: "CandidateListing", entityId: second.id, version: 1 }], aiResultRef: { entityType: "AiResult", entityId: "ai-duplicate-2", version: 1 }, relationship: "SAME_CANDIDATE", recommendation: "MERGE_CANDIDATE", signals: ["same source"], contradictions: [], confidence: "HIGH", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-duplicate-2" });
  const needsEvidence = service.disposeDuplicate({ actor: actor("duplicate-1", "DUR"), groupId: suggested.id, expectedVersion: suggested.version, decision: "NEEDS_EVIDENCE", reason: "Conflicting unit identity", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-evidence" });
  assert.equal(needsEvidence.status, "DUPLICATE.NEEDS_EVIDENCE");
  assert.throws(() => service.disposeDuplicate({ actor: actor("duplicate-1", "DUR"), groupId: suggested.id, expectedVersion: suggested.version, decision: "RESOLVED_SEPARATE", reason: "stale", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-stale" }), /VERSION_CONFLICT/);
});

test("TEST-017 merge requires a senior duplicate reviewer role stack", () => {
  const service = fixture();
  const first = createCandidate(service, "merge-1");
  const second = createCandidate(service, "merge-2");
  const suggested = service.suggestDuplicate({ actor: actor("agent-1", "AGT"), subjectRefs: [{ entityType: "CandidateListing", entityId: first.id, version: 1 }, { entityType: "CandidateListing", entityId: second.id, version: 1 }], aiResultRef: { entityType: "AiResult", entityId: "ai-merge", version: 1 }, relationship: "SAME_CANDIDATE", recommendation: "MERGE_CANDIDATE", signals: ["same evidence"], contradictions: [], confidence: "HIGH", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-merge" });
  assert.throws(() => service.disposeDuplicate({ actor: actor("duplicate-1", "DUR"), groupId: suggested.id, expectedVersion: 1, decision: "RESOLVED_MERGE", reason: "merge", purpose: "LISTING_GOVERNANCE", correlationId: "correlation-merge-denied" }), /SENIOR_REVIEW_REQUIRED/);
});
