import assert from "node:assert/strict";
import test from "node:test";

import type { SessionContext } from "../../../modules/identity/src/session-service.js";
import type { CandidateListing, DuplicateGroup, ListingOffer } from "../../../modules/listing/src/listing-service.js";
import type { PropertyAlias, PropertyNode } from "../../../modules/property/src/property-service.js";
import { PropertyListingApi, type PropertyListingApiDependencies } from "./property-listing-api.js";

const actor: SessionContext = Object.freeze({ id: "session-agent", principalId: "agent-1", principalType: "HUMAN", roles: ["AGT"] as const, teamId: "team-a", state: "ACTIVE", assurance: "MFA", isMfaVerified: true, authenticatedAt: "2026-07-19T00:00:00.000Z", expiresAt: "2026-07-19T01:00:00.000Z", absoluteExpiresAt: "2026-07-19T02:00:00.000Z", familyId: "family-agent", refreshReference: "refresh-agent" });
const property: PropertyNode = Object.freeze({ id: "property-1", version: 1, entityType: "Property", canonicalName: "River Park", status: "proposed", authority: "CANONICAL_MASTER", classification: "INTERNAL", proposedBy: actor.principalId, createdAt: "2026-07-19T00:05:00.000Z" });
const alias: PropertyAlias = Object.freeze({ id: "alias-1", version: 1, targetRef: { entityType: "Property" as const, entityId: property.id, version: 1 }, alias: "River Pk", language: "en", sourceRef: { entityType: "RawSource" as const, entityId: "raw-1", version: 1 }, confidence: "MEDIUM", status: "proposed", classification: "INTERNAL" });
const candidate: CandidateListing = Object.freeze({ id: "candidate-1", version: 1, status: "candidate", authority: "CANDIDATE", sourceRefs: [{ entityType: "RawSource", entityId: "raw-1", version: 1 }], intakeRef: { entityType: "Intake", entityId: "intake-1", version: 3 }, unresolvedFields: [], relatedCandidateIds: [], classification: "CONFIDENTIAL_BUSINESS", createdBy: actor.principalId });
const offer: ListingOffer = Object.freeze({ id: "offer-1", version: 1, candidateId: candidate.id, status: "draft", authority: "CANDIDATE_CLAIM", transactionType: "RENT", terms: { amountReference: "bundle-1" }, sourceRefs: candidate.sourceRefs, classification: "CONFIDENTIAL_BUSINESS" });
const duplicate: DuplicateGroup = Object.freeze({ id: "duplicate-1", version: 1, status: "DUPLICATE.SUGGESTED", authority: "ADVISORY", subjectRefs: [{ entityType: "CandidateListing", entityId: candidate.id, version: 1 }, { entityType: "CandidateListing", entityId: "candidate-2", version: 1 }], aiResultRef: { entityType: "AiResult", entityId: "ai-1", version: 1 }, relationship: "UNCERTAIN", recommendation: "NEEDS_MORE_EVIDENCE", signals: ["similar"], contradictions: [], confidence: "MEDIUM", decisionHistory: [], classification: "INTERNAL", createdBy: actor.principalId });

function dependencies(seen: SessionContext[], failDisposal = false): PropertyListingApiDependencies {
  return {
    sessionReader: () => actor,
    propertyService: { propose: (request) => { seen.push(request.actor); return property; }, decide: (request) => { seen.push(request.actor); return { ...property, version: 2, status: "active" }; }, proposeAlias: (request) => { seen.push(request.actor); return alias; }, search: (request) => { seen.push(request.actor); return [property]; }, readForActor: (request) => { seen.push(request.actor); return property; } },
    listingService: { createCandidate: (request) => { seen.push(request.actor); return candidate; }, reviseCandidate: (request) => { seen.push(request.actor); return { ...candidate, version: 2 }; }, createOffer: (request) => { seen.push(request.actor); return offer; }, reviseOffer: (request) => { seen.push(request.actor); return { ...offer, version: 2 }; }, suggestDuplicate: (request) => { seen.push(request.actor); return duplicate; }, disposeDuplicate: (request) => { if (failDisposal) throw new Error("VERSION_CONFLICT"); seen.push(request.actor); return { ...duplicate, version: 2, status: "DUPLICATE.NEEDS_EVIDENCE", authority: "HUMAN_DISPOSITION" }; }, readCandidateForActor: (request) => { seen.push(request.actor); return candidate; }, listCandidates: (request) => { seen.push(request.actor); return [candidate]; }, readDuplicateForActor: (request) => { seen.push(request.actor); return duplicate; } },
  };
}

test("TEST-028 API-005 derives actor from session and returns explicit UI state", () => {
  const seen: SessionContext[] = [];
  const api = new PropertyListingApi(dependencies(seen));
  const response = api.proposeProperty({ context: { sessionId: actor.id, correlationId: "correlation-api-property" }, entityType: "Property", canonicalName: "River Park", reason: "Evidence", purpose: "LISTING_GOVERNANCE", actor: { principalId: "forged" } } as Parameters<PropertyListingApi["proposeProperty"]>[0] & { actor: unknown });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.data.presentationState, "READY");
    assert.equal(response.data.canonicalState, "proposed");
  }
  assert.deepEqual(seen, [actor]);
  assert.equal(api.readProperty({ context: { sessionId: actor.id, correlationId: "correlation-api-property-read" }, nodeId: property.id, purpose: "LISTING_GOVERNANCE" }).ok, true);
  assert.equal(api.listCandidates({ context: { sessionId: actor.id, correlationId: "correlation-api-candidates" }, purpose: "LISTING_GOVERNANCE" }).ok, true);
});

test("TEST-017 API-006 keeps duplicate suggestion visibly advisory", () => {
  const seen: SessionContext[] = [];
  const api = new PropertyListingApi(dependencies(seen));
  const response = api.suggestDuplicate({ context: { sessionId: actor.id, correlationId: "correlation-api-duplicate" }, subjectRefs: duplicate.subjectRefs, aiResultRef: duplicate.aiResultRef, relationship: duplicate.relationship, recommendation: duplicate.recommendation, signals: duplicate.signals, contradictions: [], confidence: "MEDIUM", purpose: "LISTING_GOVERNANCE" });
  assert.equal(response.ok, true);
  if (response.ok) {
    assert.equal(response.data.authority, "ADVISORY");
    assert.equal(response.data.presentationState, "REVIEW_REQUIRED");
  }
});

test("API-005/006 fail safely when session or version is invalid", () => {
  const api = new PropertyListingApi(dependencies([]));
  const noSession = api.searchProperties({ context: { correlationId: "correlation-no-session" }, query: "river", purpose: "LISTING_GOVERNANCE" });
  assert.equal(noSession.ok, false);
  const stale = new PropertyListingApi(dependencies([], true)).disposeDuplicate({ context: { sessionId: actor.id, correlationId: "correlation-stale" }, groupId: duplicate.id, expectedVersion: 0, decision: "NEEDS_EVIDENCE", reason: "stale", purpose: "LISTING_GOVERNANCE" });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, "VERSION_CONFLICT");
});
