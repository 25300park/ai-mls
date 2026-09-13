import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  DurableListingStore,
  ListingPersistenceError,
  type ListingAuditIntent,
} from "./listing-durable-persistence.js";
import type { CandidateListing, DuplicateGroup, ListingOffer } from "./listing-service.js";

const now = "2026-09-13T03:00:00.000Z";
const candidate: CandidateListing = {
  id: "candidate-a",
  version: 1,
  status: "candidate",
  authority: "CANDIDATE",
  sourceRefs: [{ entityType: "RawSource", entityId: "raw-a", version: 1 }],
  intakeRef: { entityType: "Intake", entityId: "intake-a", version: 1 },
  unresolvedFields: [],
  relatedCandidateIds: [],
  classification: "CONFIDENTIAL_BUSINESS",
  createdBy: "actor-a",
};
const offer: ListingOffer = {
  id: "offer-a",
  version: 1,
  candidateId: candidate.id,
  status: "draft",
  authority: "CANDIDATE_CLAIM",
  transactionType: "sale",
  terms: { currency: "USD" },
  sourceRefs: candidate.sourceRefs,
  classification: "CONFIDENTIAL_BUSINESS",
};
const duplicate: DuplicateGroup = {
  id: "duplicate-a",
  version: 1,
  status: "DUPLICATE.SUGGESTED",
  authority: "ADVISORY",
  subjectRefs: [
    { entityType: "CandidateListing", entityId: candidate.id, version: 1 },
    { entityType: "CandidateListing", entityId: "candidate-b", version: 1 },
  ],
  aiResultRef: { entityType: "AiResult", entityId: "ai-a", version: 1 },
  relationship: "possible-duplicate",
  recommendation: "review",
  signals: ["same-address"],
  contradictions: [],
  confidence: "MEDIUM",
  decisionHistory: [],
  classification: "INTERNAL",
  createdBy: "actor-a",
};

function intent(id: string, aggregateId: string, tenantId = "tenant-a"): ListingAuditIntent {
  return {
    intentId: id,
    domainOwner: "LISTING",
    aggregateId,
    mutationIdentity: id,
    actorId: "actor-a",
    tenantId,
    scopeRef: "team:team-a",
    classificationRef: "LISTING_MUTATION",
    committedAt: now,
    evidenceRefs: [`evidence:${aggregateId}`],
  };
}
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "rel001-listing-store-"));
  return { directory, databasePath: join(directory, "listing.sqlite") };
}
function resolver() {
  return {
    resolveCandidateTenant(input: Readonly<{ intakeId: string; sourceIds: readonly string[] }>) {
      return input.intakeId === "intake-a" && input.sourceIds.includes("raw-a") ? "tenant-a" : undefined;
    },
  };
}

test("Listing persists candidate, offer and duplicate with derived tenant and stable restart replay", () => {
  const f = fixture();
  try {
    let store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.equal(store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) }).status, "STORED");
    assert.equal(store.createCandidate({ record: { ...candidate, id: "candidate-b" }, commandId: "candidate-b-command", commandFingerprint: "sha256:candidate-b", auditIntent: intent("candidate-b-command", "candidate-b") }).status, "STORED");
    assert.equal(store.createOffer({ record: offer, commandId: "offer-command", commandFingerprint: "sha256:offer", auditIntent: intent("offer-command", offer.id) }).status, "STORED");
    assert.equal(store.createDuplicate({ record: duplicate, commandId: "duplicate-command", commandFingerprint: "sha256:duplicate", auditIntent: intent("duplicate-command", duplicate.id) }).status, "STORED");
    store.close();

    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.deepEqual(store.readCandidate({ tenantId: "tenant-a", candidateId: candidate.id }), candidate);
    assert.equal(store.readCandidate({ tenantId: "tenant-b", candidateId: candidate.id }), undefined);
    assert.deepEqual(store.readOffer({ tenantId: "tenant-a", offerId: offer.id }), offer);
    assert.deepEqual(store.readDuplicate({ tenantId: "tenant-a", groupId: duplicate.id }), duplicate);
    assert.equal(store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) }).status, "REPLAYED");
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 4);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing rejects non-authoritative tenant binding and cross-tenant dependent records", () => {
  const f = fixture();
  try {
    const store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.throws(() => store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id, "tenant-b") }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) });
    assert.throws(() => store.createOffer({ record: offer, commandId: "offer-command", commandFingerprint: "sha256:offer", auditIntent: intent("offer-command", offer.id, "tenant-b") }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing rejects stale VERSION_ONLY revisions and conflicting command replay", () => {
  const f = fixture();
  try {
    const store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) });
    assert.throws(() => store.createCandidate({ record: { ...candidate, status: "review" }, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.throws(() => store.updateCandidate({ tenantId: "tenant-a", expectedVersion: 0, record: { ...candidate, status: "review" }, auditIntent: intent("candidate-update", candidate.id) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "VERSION_CONFLICT");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing revalidates current derived tenant binding before update", () => {
  const f = fixture();
  let tenantId = "tenant-a";
  try {
    const store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: { resolveCandidateTenant: () => tenantId } });
    store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) });
    tenantId = "tenant-b";
    assert.throws(() => store.updateCandidate({ tenantId: "tenant-a", expectedVersion: 1, record: { ...candidate, version: 2, status: "review" }, auditIntent: intent("candidate-update", candidate.id) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    assert.equal(store.readCandidate({ tenantId: "tenant-a", candidateId: candidate.id })?.version, 1);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing rolls back domain mutation when durable audit intent append fails", () => {
  const f = fixture();
  try {
    let store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("fail"); } });
    assert.throws(() => store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE");
    store.close();
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.equal(store.readCandidate({ tenantId: "tenant-a", candidateId: candidate.id }), undefined);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 0);
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing conceals authoritative tenant resolver diagnostics", () => {
  const f = fixture();
  try {
    const store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: { resolveCandidateTenant() { throw new Error("C:\\internal\\tenant.sqlite bearer raw-token"); } } });
    assert.throws(() => store.createCandidate({ record: candidate, commandId: "candidate-command", commandFingerprint: "sha256:candidate", auditIntent: intent("candidate-command", candidate.id) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE");
    store.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
