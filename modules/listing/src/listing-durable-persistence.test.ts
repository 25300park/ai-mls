import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createAuditIntentSourcePort, type EnrichedAuditIntentV2 } from "../../audit/src/audit-intent-materializer.js";
import { DurableListingStore, ListingPersistenceError, type ListingAuditIntent } from "./listing-durable-persistence.js";
import type { CandidateListing, DuplicateGroup, ListingOffer } from "./listing-service.js";

const now = "2026-09-13T03:00:00.000Z";
const candidate: CandidateListing = {
  id: "candidate-a", version: 1, status: "candidate", authority: "CANDIDATE",
  sourceRefs: [{ entityType: "RawSource", entityId: "raw-a", version: 1 }],
  intakeRef: { entityType: "Intake", entityId: "intake-a", version: 1 }, unresolvedFields: [], relatedCandidateIds: [],
  classification: "CONFIDENTIAL_BUSINESS", createdBy: "actor-a",
};
const candidateB: CandidateListing = { ...candidate, id: "candidate-b" };
const offer: ListingOffer = {
  id: "offer-a", version: 1, candidateId: candidate.id, status: "draft", authority: "CANDIDATE_CLAIM",
  transactionType: "sale", terms: { currency: "USD" }, sourceRefs: candidate.sourceRefs, classification: "CONFIDENTIAL_BUSINESS",
};
const duplicate: DuplicateGroup = {
  id: "duplicate-a", version: 1, status: "DUPLICATE.SUGGESTED", authority: "ADVISORY",
  subjectRefs: [
    { entityType: "CandidateListing", entityId: candidate.id, version: 1 },
    { entityType: "CandidateListing", entityId: candidateB.id, version: 1 },
  ],
  aiResultRef: { entityType: "AiResult", entityId: "ai-a", version: 1 }, relationship: "possible-duplicate",
  recommendation: "review", signals: ["same-address"], contradictions: [], confidence: "MEDIUM", decisionHistory: [],
  classification: "INTERNAL", createdBy: "actor-a",
};

function intent(overrides: Partial<EnrichedAuditIntentV2> = {}): ListingAuditIntent {
  return {
    auditIntentContractVersion: "v2", intentId: "01-candidate-create", sourceDomain: "LISTING", aggregateId: candidate.id,
    mutationIdentity: "01-candidate-create", eventType: "CANDIDATE_CREATED", eventCategory: "COMMAND_ACCEPTED", action: "candidate.create",
    target: { type: "CandidateListing", id: candidate.id, version: 1 },
    principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-a", sessionId: "session-a" } },
    visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-a" }, purpose: "LISTING_GOVERNANCE",
    policyVersion: "listing-v1", classification: "CONFIDENTIAL_BUSINESS", decision: "ALLOW", outcome: "COMPLETED",
    committedAt: now, correlationId: "correlation-a", evidenceRefs: ["evidence:candidate-a"], ...overrides,
  } as unknown as ListingAuditIntent;
}
function candidateIntent(record: CandidateListing, commandId: string, eventType: "CANDIDATE_CREATED" | "CANDIDATE_REGISTERED_FROM_INTAKE" = "CANDIDATE_CREATED"): ListingAuditIntent {
  return intent({ intentId: commandId, aggregateId: record.id, mutationIdentity: commandId, eventType,
    eventCategory: eventType === "CANDIDATE_CREATED" ? "COMMAND_ACCEPTED" : "STATE_CHANGED", action: "candidate.create",
    target: { type: "CandidateListing", id: record.id, version: record.version }, purpose: eventType === "CANDIDATE_CREATED" ? "LISTING_GOVERNANCE" : "SOURCE_INTAKE",
    outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}
function candidateRevision(record: CandidateListing): ListingAuditIntent {
  return intent({ intentId: "03-candidate-revise", aggregateId: record.id, mutationIdentity: "03-candidate-revise", eventType: "CANDIDATE_REVISED",
    eventCategory: "STATE_CHANGED", action: "candidate.revise", target: { type: "CandidateListing", id: record.id, version: record.version }, outcome: "COMPLETED" });
}
function offerIntent(record: ListingOffer, revised = false): ListingAuditIntent {
  return intent({ intentId: revised ? "05-offer-revise" : "04-offer-create", aggregateId: record.id, mutationIdentity: revised ? "05-offer-revise" : "04-offer-create",
    eventType: revised ? "LISTING_OFFER_REVISED" : "LISTING_OFFER_CREATED", eventCategory: revised ? "STATE_CHANGED" : "COMMAND_ACCEPTED",
    action: revised ? "offer.revise" : "offer.create", target: { type: "ListingOffer", id: record.id, version: record.version },
    outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}
function duplicateIntent(record: DuplicateGroup, disposed = false): ListingAuditIntent {
  return intent({ intentId: disposed ? "07-duplicate-dispose" : "06-duplicate-suggest", aggregateId: record.id, mutationIdentity: disposed ? "07-duplicate-dispose" : "06-duplicate-suggest",
    eventType: disposed ? "DUPLICATE_DISPOSED" : "DUPLICATE_SUGGESTED", eventCategory: disposed ? "STATE_CHANGED" : "COMMAND_ACCEPTED",
    action: disposed ? "duplicate.dispose" : "duplicate.suggest", target: { type: "DuplicateGroup", id: record.id, version: record.version },
    classification: "INTERNAL", outcome: "COMPLETED", evidenceRefs: [`evidence:${record.id}`] });
}
function fixture(): Readonly<{ directory: string; databasePath: string }> { const directory = mkdtempSync(join(tmpdir(), "rel001-listing-store-")); return { directory, databasePath: join(directory, "listing.sqlite") }; }
function resolver() { return {
  resolveCandidateBinding(input: Readonly<{ intakeId: string; sourceIds: readonly string[] }>) { return input.intakeId === "intake-a" && input.sourceIds.includes("raw-a") ? { tenantId: "tenant-a", teamId: "team-a" } : undefined; },
}; }
function createCandidate(store: DurableListingStore, record: CandidateListing = candidate, commandId = "01-candidate-create", auditIntent: ListingAuditIntent = candidateIntent(record, commandId)) { return store.createCandidate({ record, commandId, commandFingerprint: `sha256:${commandId}`, auditIntent }); }
function reverseObjectKeyOrder<T>(value: T): T { if (Array.isArray(value)) return value.map(reverseObjectKeyOrder) as T; if (value === null || typeof value !== "object") return value; return Object.fromEntries(Object.entries(value).reverse().map(([key, nested]) => [key, reverseObjectKeyOrder(nested)])) as T; }
function count(database: DatabaseSync, table: string): number { return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.["count"]); }
test("Listing stores all seven enriched v2 mapping families across restart", () => {
  const f = fixture(); let store: DurableListingStore | undefined;
  try {
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.equal(createCandidate(store).status, "STORED");
    assert.equal(createCandidate(store, candidateB, "02-candidate-register", candidateIntent(candidateB, "02-candidate-register", "CANDIDATE_REGISTERED_FROM_INTAKE")).status, "STORED");
    const revisedCandidate = { ...candidate, version: 2, status: "review" as const };
    assert.deepEqual(store.updateCandidate({ tenantId: "tenant-a", expectedVersion: 1, record: revisedCandidate, auditIntent: candidateRevision(revisedCandidate) }), revisedCandidate);
    assert.equal(store.createOffer({ record: offer, commandId: "04-offer-create", commandFingerprint: "sha256:04-offer-create", auditIntent: offerIntent(offer) }).status, "STORED");
    const revisedOffer = { ...offer, version: 2, status: "active" as const };
    assert.deepEqual(store.updateOffer({ tenantId: "tenant-a", expectedVersion: 1, record: revisedOffer, auditIntent: offerIntent(revisedOffer, true) }), revisedOffer);
    assert.equal(store.createDuplicate({ record: duplicate, commandId: "06-duplicate-suggest", commandFingerprint: "sha256:06-duplicate-suggest", auditIntent: duplicateIntent(duplicate) }).status, "STORED");
    const disposedDuplicate: DuplicateGroup = { ...duplicate, version: 2, status: "DUPLICATE.RESOLVED_LINK", authority: "HUMAN_DISPOSITION", decisionHistory: [{ actorId: "actor-a", decision: "DUPLICATE.RESOLVED_LINK", reason: "confirmed", occurredAt: now }] };
    assert.deepEqual(store.updateDuplicate({ tenantId: "tenant-a", expectedVersion: 1, record: disposedDuplicate, auditIntent: duplicateIntent(disposedDuplicate, true) }), disposedDuplicate);
    store.close(); store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    assert.deepEqual(store.readCandidate({ tenantId: "tenant-a", candidateId: candidate.id }), revisedCandidate);
    assert.deepEqual(store.readOffer({ tenantId: "tenant-a", offerId: offer.id }), revisedOffer);
    assert.deepEqual(store.readDuplicate({ tenantId: "tenant-a", groupId: duplicate.id }), disposedDuplicate);
    assert.equal(store.listAuditIntents({ tenantId: "tenant-a" }).length, 7);
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing rejects v1 new writes and candidate mapping, provenance, purpose, tenant, scope, and identity conflicts before mutation", () => {
  const legacy = { intentId: "01-candidate-create", domainOwner: "LISTING", aggregateId: candidate.id, mutationIdentity: "01-candidate-create", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "LISTING_MUTATION", committedAt: now, evidenceRefs: ["evidence:candidate-a"] };
  const missingProvenance = { ...intent() } as unknown as Record<string, unknown>; delete missingProvenance["principalProvenance"];
  const invalid: readonly unknown[] = [legacy, missingProvenance,
    intent({ eventType: "LISTING_OFFER_CREATED", action: "offer.create", target: { type: "ListingOffer", id: candidate.id, version: 1 } }),
    intent({ target: { type: "DuplicateGroup", id: candidate.id, version: 1 } }), intent({ action: "candidate.revise" }), intent({ eventCategory: "STATE_CHANGED" }),
    intent({ purpose: "CONTACT_MANAGEMENT" }), intent({ decision: "DENY" }), intent({ outcome: "ACCEPTED" }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-b", scopeRef: "team:team-a" } }),
    intent({ visibility: { kind: "TENANT_BOUND", tenantId: "tenant-a", scopeRef: "team:team-b" } }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-b", type: "HUMAN", roles: ["AGT"], teamId: "team-a" } } }),
    intent({ principalProvenance: { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"], teamId: "team-b" } } }),
    intent({ aggregateId: "candidate-b" }), intent({ mutationIdentity: "other-command" }), intent({ target: { type: "CandidateListing", id: candidate.id, version: 2 } }),
  ];
  for (const [index, auditIntent] of invalid.entries()) {
    const f = fixture(); let store: DurableListingStore | undefined;
    try {
      store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
      assert.throws(() => createCandidate(store!, candidate, "01-candidate-create", auditIntent as ListingAuditIntent), (error: unknown) => error instanceof ListingPersistenceError && ["PERSISTENCE_INPUT_INVALID", "TENANT_BINDING_INVALID"].includes(error.code), `invalid candidate intent ${String(index)}`);
      assert.equal(store.readCandidate({ tenantId: "tenant-a", candidateId: candidate.id }), undefined); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), []);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Listing accepts both closed provenance alternatives against authoritative resolver scope", () => {
  const provenance: readonly EnrichedAuditIntentV2["principalProvenance"][] = [
    { kind: "TRUSTED_SNAPSHOT", principal: { id: "actor-a", type: "HUMAN", roles: ["AGT"] } },
    { kind: "IMMUTABLE_REFERENCE", principalId: "actor-a", evidenceRef: "evidence:principal-a" },
  ];
  for (const [index, principalProvenance] of provenance.entries()) {
    const f = fixture(); let store: DurableListingStore | undefined;
    try {
      store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
      assert.equal(createCandidate(store, candidate, "01-candidate-create", intent({ principalProvenance })).status, "STORED", `provenance case ${String(index)}`);
      store.close(); store = undefined;
    } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
  }
});

test("Listing rejects wrong offer and duplicate create/update operation mappings", () => {
  const f = fixture(); let store: DurableListingStore | undefined;
  try {
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() }); createCandidate(store); createCandidate(store, candidateB, "02-candidate-register", candidateIntent(candidateB, "02-candidate-register", "CANDIDATE_REGISTERED_FROM_INTAKE"));
    assert.throws(() => store!.createOffer({ record: offer, commandId: "04-offer-create", commandFingerprint: "sha256:04-offer-create", auditIntent: duplicateIntent({ ...duplicate, id: offer.id }) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.createDuplicate({ record: duplicate, commandId: "06-duplicate-suggest", commandFingerprint: "sha256:06-duplicate-suggest", auditIntent: offerIntent({ ...offer, id: duplicate.id }) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.equal(store.createOffer({ record: offer, commandId: "04-offer-create", commandFingerprint: "sha256:04-offer-create", auditIntent: offerIntent(offer) }).status, "STORED");
    assert.equal(store.createDuplicate({ record: duplicate, commandId: "06-duplicate-suggest", commandFingerprint: "sha256:06-duplicate-suggest", auditIntent: duplicateIntent(duplicate) }).status, "STORED");
    assert.throws(() => store!.updateCandidate({ tenantId: "tenant-a", expectedVersion: 1, record: { ...candidate, version: 2, status: "review" }, auditIntent: candidateIntent({ ...candidate, version: 2 }, "candidate-wrong") }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.updateOffer({ tenantId: "tenant-a", expectedVersion: 1, record: { ...offer, version: 2, status: "active" }, auditIntent: offerIntent({ ...offer, version: 2 }, false) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    assert.throws(() => store!.updateDuplicate({ tenantId: "tenant-a", expectedVersion: 1, record: { ...duplicate, version: 2, status: "DUPLICATE.NEEDS_EVIDENCE" }, auditIntent: duplicateIntent({ ...duplicate, version: 2 }, false) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_INPUT_INVALID");
    store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing exact replay is JSON-canonical, compares intent structurally, and appends zero duplicates", () => {
  const f = fixture(); let store: DurableListingStore | undefined;
  try {
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() });
    const firstIntent = candidateIntent(candidate, "01-candidate-create"); assert.equal(createCandidate(store, candidate, "01-candidate-create", firstIntent).status, "STORED");
    const replayRecord = reverseObjectKeyOrder({ ...candidate, propertyRef: undefined }) as unknown as CandidateListing;
    const replayIntent = reverseObjectKeyOrder({ ...firstIntent, requestId: undefined, reason: undefined }) as unknown as ListingAuditIntent;
    assert.equal(createCandidate(store, replayRecord, "01-candidate-create", replayIntent).status, "REPLAYED"); assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]);
    const conflicts: EnrichedAuditIntentV2[] = [
      { ...candidateIntent(candidate, "01-candidate-create") as unknown as EnrichedAuditIntentV2, evidenceRefs: ["evidence:candidate-a", "evidence:other"] },
      { ...candidateIntent(candidate, "01-candidate-create") as unknown as EnrichedAuditIntentV2, correlationId: "correlation-b" },
      { ...candidateIntent(candidate, "01-candidate-create") as unknown as EnrichedAuditIntentV2, evidenceRefs: ["evidence:other"] },
    ];
    for (const conflicting of conflicts) assert.throws(() => createCandidate(store!, candidate, "01-candidate-create", conflicting as unknown as ListingAuditIntent), (error: unknown) => error instanceof ListingPersistenceError && error.code === "IDEMPOTENCY_CONFLICT");
    assert.deepEqual(store.listAuditIntents({ tenantId: "tenant-a" }), [firstIntent]); store.close(); store = undefined;
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing audit failure rolls back create state, history, command idempotency, and intent, then rolls back update", () => {
  const f = fixture(); let store: DurableListingStore | undefined;
  try {
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => createCandidate(store!), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    let sqlite = new DatabaseSync(f.databasePath, { readOnly: true });
    assert.equal(count(sqlite, "listing_records"), 0); assert.equal(count(sqlite, "listing_history"), 0); assert.equal(count(sqlite, "listing_commands"), 0); assert.equal(count(sqlite, "listing_audit_intents"), 0); sqlite.close();
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() }); assert.equal(createCandidate(store).status, "STORED"); store.close();
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver(), beforeAuditIntentWrite: () => { throw new Error("injected audit failure"); } });
    assert.throws(() => store!.updateCandidate({ tenantId: "tenant-a", expectedVersion: 1, record: { ...candidate, version: 2, status: "review" }, auditIntent: candidateRevision({ ...candidate, version: 2, status: "review" }) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE"); store.close(); store = undefined;
    sqlite = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(sqlite.prepare("SELECT version FROM listing_records WHERE record_kind = 'CANDIDATE' AND record_id = ?").get(candidate.id)?.["version"], 1);
    assert.equal(count(sqlite, "listing_history"), 1); assert.equal(count(sqlite, "listing_commands"), 1); assert.equal(count(sqlite, "listing_audit_intents"), 1); sqlite.close();
  } finally { store?.close(); rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing preserves a pre-existing v1 row byte-for-byte and keeps it non-materializable", () => {
  const f = fixture();
  const legacy = { intentId: "legacy-listing-intent", domainOwner: "LISTING", aggregateId: candidate.id, mutationIdentity: "legacy-command", actorId: "actor-a", tenantId: "tenant-a", scopeRef: "team:team-a", classificationRef: "LISTING_MUTATION", committedAt: now, evidenceRefs: ["evidence:candidate-a"] } as const;
  const legacyJson = JSON.stringify(legacy);
  try {
    let store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() }); store.close();
    const sqlite = new DatabaseSync(f.databasePath); sqlite.prepare("INSERT INTO listing_audit_intents (intent_id, aggregate_id, tenant_id, mutation_identity, payload_json) VALUES (?, ?, ?, ?, ?)").run(legacy.intentId, legacy.aggregateId, legacy.tenantId, legacy.mutationIdentity, legacyJson); sqlite.close();
    store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: resolver() }); const rows = store.listAuditIntents({ tenantId: "tenant-a" }); assert.deepEqual(rows, [legacy]);
    const port = createAuditIntentSourcePort({ sourceDomain: "LISTING", read: () => rows }); assert.deepEqual(port.listEligible({}), { intents: [] }); store.close();
    const verify = new DatabaseSync(f.databasePath, { readOnly: true }); assert.equal(verify.prepare("SELECT payload_json FROM listing_audit_intents WHERE intent_id = ?").get(legacy.intentId)?.["payload_json"], legacyJson); verify.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});

test("Listing preserves authoritative tenant/team binding, live revalidation, optimistic versioning, and safe resolver errors", () => {
  const f = fixture(); let tenantId = "tenant-a";
  try {
    const store = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: { resolveCandidateBinding: () => ({ tenantId, teamId: "team-a" }) } }); createCandidate(store);
    tenantId = "tenant-b";
    assert.throws(() => store.updateCandidate({ tenantId: "tenant-a", expectedVersion: 1, record: { ...candidate, version: 2, status: "review" }, auditIntent: candidateRevision({ ...candidate, version: 2, status: "review" }) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "TENANT_BINDING_INVALID");
    tenantId = "tenant-a";
    assert.throws(() => store.updateCandidate({ tenantId: "tenant-a", expectedVersion: 0, record: { ...candidate, status: "review" }, auditIntent: candidateRevision({ ...candidate, status: "review" }) }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "VERSION_CONFLICT"); store.close();
    const unavailable = new DurableListingStore({ databasePath: f.databasePath, tenantResolver: { resolveCandidateBinding() { throw new Error("C:\\internal\\tenant.sqlite bearer raw-token"); } } });
    assert.throws(() => unavailable.createCandidate({ record: candidateB, commandId: "new-command", commandFingerprint: "sha256:new", auditIntent: candidateIntent(candidateB, "new-command") }), (error: unknown) => error instanceof ListingPersistenceError && error.code === "PERSISTENCE_UNAVAILABLE" && error.message === "PERSISTENCE_UNAVAILABLE"); unavailable.close();
  } finally { rmSync(f.directory, { recursive: true, force: true }); }
});
