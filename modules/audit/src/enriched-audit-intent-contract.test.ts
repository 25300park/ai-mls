import assert from "node:assert/strict";
import test from "node:test";

import {
  validateEnrichedAuditIntentV2,
  type EnrichedAuditIntentV2,
} from "./enriched-audit-intent-contract.js";

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): EnrichedAuditIntentV2 {
  return {
    auditIntentContractVersion: "v2",
    intentId: "intent-1",
    sourceDomain: "SOURCE_REGISTRY",
    aggregateId: "source-1",
    mutationIdentity: "command-1",
    eventType: "SOURCE_POLICY_PROPOSED",
    eventCategory: "COMMAND_ACCEPTED",
    action: "source.propose",
    target: { type: "SourceRegistry", id: "source-1", version: 1 },
    principalProvenance: {
      kind: "TRUSTED_SNAPSHOT",
      principal: { id: "actor-1", type: "HUMAN", roles: ["ADM"], sessionId: "session-1" },
    },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-1", scopeRef: "tenant:tenant-1" },
    purpose: "SOURCE_GOVERNANCE",
    policyVersion: "policy-v1",
    classification: "CONFIDENTIAL_BUSINESS",
    decision: "ALLOW",
    outcome: "ACCEPTED",
    committedAt: "2026-09-13T00:00:00.000Z",
    correlationId: "correlation-1",
    evidenceRefs: ["evidence:source-1"],
    ...overrides,
  };
}

test("enriched v2 validator returns an immutable snapshot constrained to the expected source", () => {
  const supplied = intent();
  const validated = validateEnrichedAuditIntentV2(supplied, "SOURCE_REGISTRY");
  assert.deepEqual(validated, supplied);
  assert.notEqual(validated, supplied);
  assert.equal(Object.isFrozen(validated), true);
  assert.equal(Object.isFrozen(validated.target), true);
  assert.equal(Object.isFrozen(validated.principalProvenance), true);
  assert.equal(Object.isFrozen(validated.evidenceRefs), true);
});

test("enriched v2 validator rejects legacy v1 and missing trusted principal provenance", () => {
  const legacy = { intentId: "legacy-1", domainOwner: "SOURCE_REGISTRY", actorId: "actor-1" };
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>;
  delete missingProvenance["principalProvenance"];
  assert.throws(() => validateEnrichedAuditIntentV2(legacy, "SOURCE_REGISTRY"), /INTENT_INVALID/);
  assert.throws(() => validateEnrichedAuditIntentV2(missingProvenance, "SOURCE_REGISTRY"), /INTENT_INVALID/);
});

test("enriched v2 validator rejects wrong closed mapping, expected source, and tenant visibility shape", () => {
  assert.throws(() => validateEnrichedAuditIntentV2(intent({ action: "source.activate" }), "SOURCE_REGISTRY"), /INTENT_INVALID/);
  assert.throws(() => validateEnrichedAuditIntentV2(intent(), "INTAKE"), /INTENT_INVALID/);
  assert.throws(
    () => validateEnrichedAuditIntentV2(intent({ visibility: { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" } }), "SOURCE_REGISTRY"),
    /INTENT_INVALID/,
  );
});

test("enriched v2 validator enforces the canonical outcome for every six-source event mapping", () => {
  const cases: readonly Readonly<{
    sourceDomain: EnrichedAuditIntentV2["sourceDomain"];
    eventType: string;
    eventCategory: EnrichedAuditIntentV2["eventCategory"];
    action: string;
    targetType: string;
    outcome: EnrichedAuditIntentV2["outcome"];
  }>[] = [
    { sourceDomain: "SOURCE_REGISTRY", eventType: "SOURCE_POLICY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "source.propose", targetType: "SourceRegistry", outcome: "ACCEPTED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "intake.create", targetType: "Intake", outcome: "ACCEPTED" },
    { sourceDomain: "INTAKE", eventType: "RAW_ATTACHMENT_LINKED", eventCategory: "EVIDENCE_APPENDED", action: "intake.attach-evidence", targetType: "Intake", outcome: "COMPLETED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_VALIDATED", eventCategory: "STATE_CHANGED", action: "intake.validate", targetType: "Intake", outcome: "COMPLETED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_AI_REQUESTED", eventCategory: "COMMAND_ACCEPTED", action: "intake.request-ai", targetType: "Intake", outcome: "ACCEPTED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_AI_RESULT_ROUTED", eventCategory: "STATE_CHANGED", action: "intake.validate", targetType: "Intake", outcome: "COMPLETED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_MANUAL_FALLBACK", eventCategory: "STATE_CHANGED", action: "intake.validate", targetType: "Intake", outcome: "COMPLETED" },
    { sourceDomain: "INTAKE", eventType: "INTAKE_REVIEWED", eventCategory: "STATE_CHANGED", action: "intake.review", targetType: "Intake", outcome: "COMPLETED" },
    { sourceDomain: "PROPERTY", eventType: "PROPERTY_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "property.propose", targetType: "Property", outcome: "COMPLETED" },
    { sourceDomain: "PROPERTY", eventType: "PROPERTY_DECIDED", eventCategory: "STATE_CHANGED", action: "property.decide", targetType: "Property", outcome: "COMPLETED" },
    { sourceDomain: "PROPERTY", eventType: "PROPERTY_ALIAS_PROPOSED", eventCategory: "COMMAND_ACCEPTED", action: "property.propose", targetType: "PropertyAlias", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "CANDIDATE_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "candidate.create", targetType: "CandidateListing", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "CANDIDATE_REGISTERED_FROM_INTAKE", eventCategory: "STATE_CHANGED", action: "candidate.create", targetType: "CandidateListing", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "CANDIDATE_REVISED", eventCategory: "STATE_CHANGED", action: "candidate.revise", targetType: "CandidateListing", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "LISTING_OFFER_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "offer.create", targetType: "ListingOffer", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "LISTING_OFFER_REVISED", eventCategory: "STATE_CHANGED", action: "offer.revise", targetType: "ListingOffer", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "DUPLICATE_SUGGESTED", eventCategory: "COMMAND_ACCEPTED", action: "duplicate.suggest", targetType: "DuplicateGroup", outcome: "COMPLETED" },
    { sourceDomain: "LISTING", eventType: "DUPLICATE_DISPOSED", eventCategory: "STATE_CHANGED", action: "duplicate.dispose", targetType: "DuplicateGroup", outcome: "COMPLETED" },
    { sourceDomain: "CONTACT", eventType: "CONTACT_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "contact.create", targetType: "Contact", outcome: "COMPLETED" },
    { sourceDomain: "CONTACT", eventType: "CONTACT_CORRECTED", eventCategory: "STATE_CHANGED", action: "contact.edit", targetType: "Contact", outcome: "COMPLETED" },
    { sourceDomain: "CONTACT", eventType: "CONTACT_CHANNEL_ADDED", eventCategory: "STATE_CHANGED", action: "contact.edit", targetType: "ContactChannel", outcome: "COMPLETED" },
    { sourceDomain: "CONTACT", eventType: "CONTACT_CHANNEL_REVOKED", eventCategory: "STATE_CHANGED", action: "contact.edit", targetType: "ContactChannel", outcome: "COMPLETED" },
    { sourceDomain: "CONTACT", eventType: "CONTACT_ATTEMPT_RECORDED", eventCategory: "EVIDENCE_APPENDED", action: "contact.attempt", targetType: "ContactCase", outcome: "COMPLETED" },
    { sourceDomain: "MATCHING", eventType: "MATCH_RUN_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "matching.request", targetType: "MatchRun", outcome: "COMPLETED" },
    { sourceDomain: "MATCHING", eventType: "MATCH_RESULT_REVIEWED", eventCategory: "STATE_CHANGED", action: "matching.review", targetType: "MatchResult", outcome: "COMPLETED" },
    { sourceDomain: "MATCHING", eventType: "MATCH_RESULT_STALE", eventCategory: "STATE_CHANGED", action: "matching.stale", targetType: "MatchResult", outcome: "COMPLETED" },
  ];

  for (const item of cases) {
    const visibility: EnrichedAuditIntentV2["visibility"] = item.sourceDomain === "PROPERTY"
      ? { kind: "SYSTEM_BOUND", scopeRef: "system:property-master" }
      : { kind: "TENANT_BOUND", tenantId: "tenant-1", scopeRef: "team:team-1" };
    const supplied = intent({
      sourceDomain: item.sourceDomain,
      eventType: item.eventType,
      eventCategory: item.eventCategory,
      action: item.action,
      target: { type: item.targetType, id: "aggregate-1", version: 1 },
      visibility,
      outcome: item.outcome,
    });
    assert.doesNotThrow(() => validateEnrichedAuditIntentV2(supplied, item.sourceDomain), item.eventType);
    const nonCanonicalOutcome = item.outcome === "ACCEPTED" ? "COMPLETED" : "ACCEPTED";
    assert.throws(
      () => validateEnrichedAuditIntentV2({ ...supplied, outcome: nonCanonicalOutcome }, item.sourceDomain),
      /INTENT_INVALID/,
      item.eventType,
    );
  }
});

test("enriched v2 validator recursively rejects unknown and unsafe nested data", () => {
  assert.throws(
    () => validateEnrichedAuditIntentV2({ ...intent(), target: { ...intent().target, rawProviderPayload: "forbidden" } }, "SOURCE_REGISTRY"),
    /INTENT_INVALID/,
  );
  assert.throws(
    () => validateEnrichedAuditIntentV2(intent({ evidenceRefs: ["C:\\runtime\\audit.sqlite"] }), "SOURCE_REGISTRY"),
    /INTENT_INVALID/,
  );
});
